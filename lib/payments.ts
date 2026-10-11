// Proveedor de cobros. Hoy no hay uno conectado: el cobro se habilita cuando la SRL
// tenga su cuenta de Mercado Pago (MERCADOPAGO_ACCESS_TOKEN en Vercel).

export function paymentsConfigured(env:Record<string,string|undefined>=process.env) {
  return Boolean(env.MERCADOPAGO_ACCESS_TOKEN);
}

// Cancela los cobros futuros en el proveedor. Sin proveedor o sin suscripción en el
// proveedor no hay nada que cancelar.
export async function cancelProviderSubscription(subscription:{provider:string|null;provider_subscription_id:string|null},env:Record<string,string|undefined>=process.env) {
  if(!subscription.provider||!subscription.provider_subscription_id)return {cancelled:false,reason:'no_provider_subscription'};
  if(subscription.provider!=='mercadopago')throw new Error('unsupported_payment_provider');
  const token=env.MERCADOPAGO_ACCESS_TOKEN;
  if(!token)throw new Error('payments_not_configured');
  const response=await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(subscription.provider_subscription_id)}`,{
    method:'PUT',
    headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},
    body:JSON.stringify({status:'cancelled'}),
    signal:AbortSignal.timeout(15000),
  });
  if(!response.ok)throw new Error(`mercadopago_cancel_failed_${response.status}`);
  return {cancelled:true};
}
