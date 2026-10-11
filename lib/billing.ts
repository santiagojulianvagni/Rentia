import { getPlan } from './plans';

export type BillingSubscription={plan_id:string;status:string;trial_ends_at:string};

// El límite de órdenes solo se aplica cuando el cobro está conectado. Mientras nadie
// pueda pagar, ninguna tienda queda limitada.
export function billingEnforced(env:Record<string,string|undefined>=process.env) {
  return env.RENTIA_BILLING_ENFORCED==='1';
}

// Órdenes por mes calendario que se importan. null = sin límite.
export function monthlyOrderLimit(subscription:BillingSubscription|null,now=Date.now()):number|null {
  if(!subscription)return getPlan('free').orders;
  if(subscription.status==='trialing'&&new Date(subscription.trial_ends_at).getTime()>now)return null;
  const plan=getPlan(subscription.status==='active'?subscription.plan_id:'free');
  return plan.orders;
}

export function monthKey(value:string|null|undefined) {
  return typeof value==='string'&&/^\d{4}-\d{2}/.test(value)?value.slice(0,7):new Date().toISOString().slice(0,7);
}
