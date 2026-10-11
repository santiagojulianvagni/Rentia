import { z } from 'zod';
import { cancelSubscription, getOrderQuota, getOrderUsageLast30Days, getOrCreateSubscription, saveRequestedPlan } from '../../../db/database';
import { billingEnforced } from '../../../lib/billing';
import { cancelProviderSubscription } from '../../../lib/payments';
import { getPlan, recommendedPlan, RENTIA_PLANS } from '../../../lib/plans';
import { requireRecentVerification } from '../../../lib/reverification';
import { canManageRentia } from '../../../lib/session';
import { TERMS_VERSION } from '../../../lib/terms';
import { HttpError, route } from '../../../server/http/route';

function serialize(userId:string,subscription:NonNullable<Awaited<ReturnType<typeof getOrCreateSubscription>>>,orders:number,canManage:boolean,quota:Awaited<ReturnType<typeof getOrderQuota>>) {
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
    },
    usage:{orders,limit,percent:limit?Math.min(100,Math.round(orders/limit*100)):0},
    currentPlan,
    recommendation,
    plans:RENTIA_PLANS,
    billingEnabled:billingEnforced(),
    termsVersion:TERMS_VERSION,
    quota,
    canManage,
  };
}

const PlanBody=z.object({action:z.unknown().optional(),planId:z.unknown().optional(),billingCycle:z.unknown().optional(),acceptTerms:z.unknown().optional(),confirmation:z.unknown().optional()}).default({});

export const GET=route({},async({user})=>{
  const [subscription,orders]=await Promise.all([getOrCreateSubscription(user.id),getOrderUsageLast30Days(user.id)]);
  if (!subscription) throw new HttpError(404,'account_not_found');
  return serialize(user.id,subscription,orders,canManageRentia(user),await getOrderQuota(user.id));
});

export const POST=route({access:'manager',body:PlanBody,invalidBody:'invalid_plan'},async({user,body})=>{
  if (body.action==='cancel') {
    // Doble resguardo contra una baja sin querer: confirmación escrita y verificación de identidad reciente.
    if (body.confirmation!=='DAR DE BAJA') throw new HttpError(400,'confirmation_required');
    const reverify=await requireRecentVerification();
    if (reverify) return reverify;
    const current=await getOrCreateSubscription(user.id);
    if (!current) throw new HttpError(404,'account_not_found');
    if (current.status==='active') {
      try { await cancelProviderSubscription(current); }
      catch { throw new HttpError(502,'provider_cancel_failed'); }
    }
    const subscription=await cancelSubscription(user.id,user.clerkUserId||user.email);
    if (!subscription) throw new HttpError(404,'account_not_found');
    const orders=await getOrderUsageLast30Days(user.id);
    const message=current.status==='active'
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
