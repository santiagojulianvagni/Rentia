import { z } from 'zod';
import { applyPreapprovalStatus, cancelSubscription, listEmailLog, getOrderQuota, getOrderUsageLast30Days, getOrCreateSubscription, listSubscriptionPayments, recordError, savePendingCheckout, saveRequestedPlan } from '../../../db/database';
import { billingTestMode, checkoutEnabledFor, planAmountArs, syncPreapproval } from '../../../lib/billing-checkout';
import { createPreapproval, mercadoPagoToken } from '../../../lib/mercadopago';
import { publicOrigin } from '../../../lib/public-origin';
import { billingEnforced } from '../../../lib/billing';
import { cancelProviderSubscription } from '../../../lib/payments';
import { notify, storeName } from '../../../lib/notifications';
import { subscriptionCanceledEmail } from '../../../lib/email/templates';
import { getPlan, recommendedPlan, RENTIA_PLANS } from '../../../lib/plans';
import { requireRecentVerification } from '../../../lib/reverification';
import { canManageRentia } from '../../../lib/session';
import { TERMS_VERSION } from '../../../lib/terms';
import { HttpError, route } from '../../../server/http/route';

type Checkout={checkoutEnabled:boolean;testMode:boolean;payerEmail:string;payments:Awaited<ReturnType<typeof listSubscriptionPayments>>};
function serialize(userId:string,subscription:NonNullable<Awaited<ReturnType<typeof getOrCreateSubscription>>>,orders:number,canManage:boolean,quota:Awaited<ReturnType<typeof getOrderQuota>>,checkout?:Checkout) {
  const currentPlan=getPlan(subscription.plan_id);
  const recommendation=recommendedPlan(orders);
  const trialMs=new Date(subscription.trial_ends_at).getTime()-Date.now();
  const trialDaysRemaining=Math.max(0,Math.ceil(trialMs/(24*60*60*1000)));
  const limit=subscription.status==='trialing'?recommendation.orders:currentPlan.orders;
  return {
    userId,
    subscription:{
      planId:subscription.plan_id,
      requestedPlanId:subscription.requested_plan_id,
      status:subscription.status,
      billingCycle:subscription.billing_cycle,
      trialEndsAt:subscription.trial_ends_at,
      trialDaysRemaining,
      currentPeriodEnd:subscription.current_period_end,
      cancelAtPeriodEnd:Boolean(subscription.cancel_at_period_end),
      canceledAt:subscription.canceled_at??null,
      termsAcceptedAt:subscription.terms_accepted_at??null,
      providerStatus:subscription.provider_status??null,
      pastDueSince:subscription.past_due_since??null,
      providerAmount:subscription.provider_amount??null,
      complimentary:subscription.provider==='complimentary',
    },
    usage:{orders,limit,percent:limit?Math.min(100,Math.round(orders/limit*100)):0},
    currentPlan,
    recommendation,
    plans:RENTIA_PLANS,
    billingEnabled:billingEnforced(),
    termsVersion:TERMS_VERSION,
    quota,
    canManage,
    ...(checkout||{checkoutEnabled:false,testMode:false,payerEmail:'',payments:[]}),
  };
}

async function checkoutInfo(user:{id:string;email:string}):Promise<Checkout> {
  return {checkoutEnabled:checkoutEnabledFor(user.email),testMode:billingTestMode(),payerEmail:user.email,payments:await listSubscriptionPayments(user.id)};
}

const PlanBody=z.object({action:z.unknown().optional(),planId:z.unknown().optional(),billingCycle:z.unknown().optional(),acceptTerms:z.unknown().optional(),confirmation:z.unknown().optional(),payerEmail:z.unknown().optional(),preapprovalId:z.unknown().optional()}).default({});

export const GET=route({},async({user})=>{
  const [subscription,orders]=await Promise.all([getOrCreateSubscription(user.id),getOrderUsageLast30Days(user.id)]);
  if (!subscription) throw new HttpError(404,'account_not_found');
  const emails=canManageRentia(user)?(await listEmailLog(user.id)).filter(email=>email.status==='sent').map(email=>({kind:email.kind,sentAt:email.sent_at||email.created_at})):[];
  return {...serialize(user.id,subscription,orders,canManageRentia(user),await getOrderQuota(user.id),await checkoutInfo(user)),emails};
});

export const POST=route({access:'manager',body:PlanBody,invalidBody:'invalid_plan'},async({user,body})=>{
  if (body.action==='checkout') {
    // Ir a Mercado Pago a cargar la tarjeta. El plan se activa recién cuando Mercado Pago lo autoriza.
    if (!checkoutEnabledFor(user.email)) throw new HttpError(403,'checkout_disabled');
    const plan=RENTIA_PLANS.find(item=>item.id===body.planId);
    const cycle=body.billingCycle==='annual'?'annual':'monthly';
    if (!plan||plan.id==='free'||plan.id==='enterprise') throw new HttpError(400,'invalid_plan');
    if (body.acceptTerms!==true) throw new HttpError(400,'terms_required');
    const payerEmail=typeof body.payerEmail==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.payerEmail.trim())?body.payerEmail.trim().toLowerCase():user.email;
    const current=await getOrCreateSubscription(user.id);
    if (!current) throw new HttpError(404,'account_not_found');
    if (current.provider==='complimentary') throw new HttpError(409,'complimentary_plan');
    if (current.status==='active'&&current.provider_status==='authorized') throw new HttpError(409,'already_subscribed');
    const price=await planAmountArs(plan.id,cycle);
    if (!price) throw new HttpError(503,'exchange_rate_unavailable');
    const origin=publicOrigin();
    try {
      const preapproval=await createPreapproval({token:mercadoPagoToken(),reason:`Rentia ${plan.name} · ${cycle==='annual'?'anual':'mensual'}`,userId:user.id,payerEmail,amount:price.amount,cycle,backUrl:`${origin}/panel?section=plan&mp=volver`,notificationUrl:`${origin}/api/webhooks/mercadopago`});
      if (!preapproval.id||!preapproval.initPoint) throw new Error('missing_init_point');
      await savePendingCheckout(user.id,{planId:plan.id,cycle,preapprovalId:preapproval.id,amount:price.amount,termsVersion:TERMS_VERSION});
      return {ok:true,initPoint:preapproval.initPoint,amount:price.amount,rate:price.rate};
    } catch (error) {
      if (error instanceof HttpError) throw error;
      const detail=error instanceof Error?error.message:String(error);
      await recordError({source:'server',path:'/api/subscription checkout',message:detail}).catch(()=>undefined);
      // En modo prueba se muestra el motivo de Mercado Pago para poder corregirlo.
      throw new HttpError(502,'checkout_failed',billingTestMode()?{detail}:undefined);
    }
  }
  if (body.action==='sync') {
    // Al volver de Mercado Pago: se lee el estado real allá, no se confía en la dirección.
    const current=await getOrCreateSubscription(user.id);
    const preapprovalId=typeof body.preapprovalId==='string'&&body.preapprovalId?body.preapprovalId:current?.provider_subscription_id;
    if (!preapprovalId) throw new HttpError(404,'no_checkout');
    try { await syncPreapproval(preapprovalId,user.id); } catch { throw new HttpError(502,'sync_failed'); }
    const subscription=await getOrCreateSubscription(user.id);
    const orders=await getOrderUsageLast30Days(user.id);
    const message=subscription?.status==='active'?`¡Listo! Tu plan ${getPlan(subscription.plan_id).name} ya está activo.`:subscription?.provider_status==='pending'?'Mercado Pago todavía no confirmó el pago. Si ya lo hiciste, se activa solo en unos minutos.':'No se completó el pago en Mercado Pago.';
    return {...serialize(user.id,subscription!,orders,true,await getOrderQuota(user.id),await checkoutInfo(user)),message};
  }
  if (body.action==='cancel') {
    // Doble resguardo contra una baja sin querer: confirmación escrita y verificación de identidad reciente.
    if (body.confirmation!=='DAR DE BAJA') throw new HttpError(400,'confirmation_required');
    const reverify=await requireRecentVerification();
    if (reverify) return reverify;
    const current=await getOrCreateSubscription(user.id);
    if (!current) throw new HttpError(404,'account_not_found');
    if (current.provider==='complimentary') throw new HttpError(409,'complimentary_plan');
    if (current.status==='active'||current.status==='past_due') {
      let cancelled=false;
      try { cancelled=(await cancelProviderSubscription(current)).cancelled; }
      catch { throw new HttpError(502,'provider_cancel_failed'); }
      // Mercado Pago ya canceló: se anota enseguida, sin esperar su aviso, así no se le vuelve a ajustar el precio.
      if (cancelled) await applyPreapprovalStatus(user.id,{status:'cancelled',nextPaymentDate:null});
    }
    const subscription=await cancelSubscription(user.id,user.clerkUserId||user.email);
    if (!subscription) throw new HttpError(404,'account_not_found');
    if (current.status==='active'||current.status==='past_due') {
      await notify(user.id,'subscription_canceled',subscription.canceled_at||new Date().toISOString(),account=>subscriptionCanceledEmail({ownerName:account.owner_name,storeName:storeName(account),planName:getPlan(current.plan_id).name,until:subscription.current_period_end??null}));
    }
    const orders=await getOrderUsageLast30Days(user.id);
    const message=current.status==='active'||current.status==='past_due'
      ?`Listo, te diste de baja. No se te va a cobrar más y seguís con ${getPlan(current.plan_id).name} hasta el final del período pagado.`
      :'Listo, quitamos el plan que habías elegido. No se realizó ni se realizará ningún cobro.';
    return {...serialize(user.id,subscription,orders,true,await getOrderQuota(user.id)),message};
  }
  const plan=RENTIA_PLANS.find(item=>item.id===body.planId);
  const billingCycle=body.billingCycle==='annual'?'annual':'monthly';
  if (!plan||plan.id==='free') throw new HttpError(400,'invalid_plan');
  if (body.acceptTerms!==true) throw new HttpError(400,'terms_required');
  const subscription=await saveRequestedPlan(user.id,plan.id,billingCycle,TERMS_VERSION);
  if (!subscription) throw new HttpError(404,'account_not_found');
  const orders=await getOrderUsageLast30Days(user.id);
  return {...serialize(user.id,subscription,orders,true,await getOrderQuota(user.id)),message:'Plan guardado. Todavía no se realizó ningún cobro.'};
});
