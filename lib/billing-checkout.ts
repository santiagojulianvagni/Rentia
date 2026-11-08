import { applyPreapprovalStatus, expireLapsedSubscriptions, findSubscriptionByPreapproval, recordSubscriptionPayment, saveProviderAmount, subscriptionsToReprice } from '../db/database';
import { getLiveRates } from './exchange-rate-provider';
import { GRACE_DAYS, arsAmount, getAuthorizedPayment, getPreapproval, mercadoPagoToken, planUsd, updatePreapprovalAmount, type BillingCycle } from './mercadopago';
import { getPlan } from './plans';
import { createHash } from 'node:crypto';

type Env=Record<string,string|undefined>;

// Dueños de Rentia que siempre pueden probar el cobro. Se guarda la huella del email, no el
// email: el repositorio es público.
const OWNER_HASHES=new Set(['d54d7d22fdd808660cfaa39fcbe81e05c1dd4e3975e98abecb40ed22f59200de','5f30737650ee791d884f4cfd7ec6c0f42e8ccfaac8c661799288c83cb23ac771']);
const ownerHash=(email:string)=>createHash('sha256').update(`rentia-tester:${email.trim().toLowerCase()}`).digest('hex');

// Quién puede pagar: mientras se prueba, solo los emails de RENTIA_BILLING_TESTERS; con
// RENTIA_BILLING_OPEN=1, todas las tiendas. Sin credenciales de Mercado Pago, nadie.
export function checkoutEnabledFor(email:string|null|undefined,env:Env=process.env) {
  if(!mercadoPagoToken(env))return false;
  if(env.RENTIA_BILLING_OPEN==='1')return true;
  if(!email)return false;
  const testers=(env.RENTIA_BILLING_TESTERS||'').split(',').map(item=>item.trim().toLowerCase()).filter(Boolean);
  return testers.includes(email.toLowerCase())||OWNER_HASHES.has(ownerHash(email));
}
// MERCADOPAGO_LIVE=1 gana sobre MERCADOPAGO_TEST: en Vercel editar una variable existente pide passkey,
// agregar una nueva no.
export const billingTestMode=(env:Env=process.env)=>env.MERCADOPAGO_TEST==='1'&&env.MERCADOPAGO_LIVE!=='1';

export async function officialDollar() {
  const rates=await getLiveRates(null);
  const sell=rates.quotes?.official?.sell;
  return typeof sell==='number'&&sell>0?sell:null;
}

export async function planAmountArs(planId:string,cycle:BillingCycle) {
  const usd=planUsd(getPlan(planId),cycle);
  const rate=await officialDollar();
  return usd===null||rate===null?null:{amount:arsAmount(usd,rate)!,usd,rate};
}

// Trae el estado real de la suscripción en Mercado Pago y lo aplica en Rentia. Se usa al
// volver de Mercado Pago y en cada aviso (webhook): nunca se confía en lo que dice la URL.
export async function syncPreapproval(preapprovalId:string,expectedUserId?:string) {
  const token=mercadoPagoToken();
  if(!token)throw new Error('payments_not_configured');
  const preapproval=await getPreapproval(token,preapprovalId);
  const stored=await findSubscriptionByPreapproval(preapproval.id);
  const userId=stored?.user_id||preapproval.externalReference;
  if(!userId||(expectedUserId&&userId!==expectedUserId))throw new Error('preapproval_not_owned');
  if(!stored)return null;
  return applyPreapprovalStatus(userId,{status:preapproval.status,nextPaymentDate:preapproval.nextPaymentDate,amount:preapproval.amount});
}

// Aviso de un cobro: se guarda en el historial y se vuelve a leer la suscripción, que trae
// el próximo vencimiento (o queda pausada si el cobro no pasó).
export async function syncAuthorizedPayment(paymentId:string) {
  const token=mercadoPagoToken();
  if(!token)throw new Error('payments_not_configured');
  const payment=await getAuthorizedPayment(token,paymentId);
  if(!payment.preapprovalId)return null;
  const stored=await findSubscriptionByPreapproval(payment.preapprovalId);
  if(!stored)return null;
  await recordSubscriptionPayment(stored.user_id,{id:payment.id,preapprovalId:payment.preapprovalId,amount:payment.amount,currency:payment.currency,status:payment.status||'pendiente',date:payment.date});
  return syncPreapproval(payment.preapprovalId);
}

// Tarea diaria: actualiza el monto en pesos de cada suscripción al dólar oficial del día y
// pasa a Gratis las que terminaron su período o su gracia (sin borrar datos).
export async function dailyBillingMaintenance() {
  const token=mercadoPagoToken();
  const result={repriced:0,failed:0,expired:0};
  if(token) {
    const rate=await officialDollar();
    if(rate) for(const subscription of await subscriptionsToReprice()) {
      const usd=planUsd(getPlan(subscription.plan_id),subscription.billing_cycle==='annual'?'annual':'monthly');
      const amount=usd===null?null:arsAmount(usd,rate);
      if(!amount||amount===Number(subscription.provider_amount))continue;
      try {await updatePreapprovalAmount(token,subscription.provider_subscription_id,amount);await saveProviderAmount(subscription.user_id,amount);result.repriced++;}
      catch {result.failed++;}
    }
  }
  result.expired=(await expireLapsedSubscriptions(GRACE_DAYS)).length;
  return result;
}
