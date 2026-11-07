import { createHmac, timingSafeEqual } from 'node:crypto';
import type { RentiaPlan } from './plans';
import { annualPrice } from './plans';

// Cobro de la suscripción de Rentia con Suscripciones de Mercado Pago (preapproval): la
// persona carga su tarjeta en Mercado Pago y Mercado Pago cobra solo cada mes o cada año.
// Los precios están en dólares y se cobran en pesos al dólar oficial: el monto en pesos de
// cada suscripción se actualiza todos los días (Mercado Pago necesita un monto fijo).
type Env=Record<string,string|undefined>;
const API='https://api.mercadopago.com';

export type BillingCycle='monthly'|'annual';
export type PreapprovalStatus='pending'|'authorized'|'paused'|'cancelled';

export function mercadoPagoToken(env:Env=process.env) {
  return env.MERCADOPAGO_ACCESS_TOKEN||'';
}
// Las credenciales de prueba empiezan con TEST-: así la pantalla avisa que es modo prueba.
export const isTestToken=(token:string)=>token.startsWith('TEST-');

// Precio en dólares del plan para el ciclo elegido.
export function planUsd(plan:RentiaPlan,cycle:BillingCycle) {
  if(plan.monthlyPrice===null)return null;
  return cycle==='annual'?annualPrice(plan):plan.monthlyPrice;
}

// Monto en pesos: dólar oficial (venta) redondeado a pesos enteros. Mercado Pago pide al menos $15.
export function arsAmount(usd:number,officialRate:number) {
  if(!(usd>0)||!(officialRate>0))return null;
  return Math.max(15,Math.round(usd*officialRate));
}

// Estado de Rentia según el de Mercado Pago. Una suscripción pausada es un cobro que no
// pudo hacerse: queda "con pago pendiente" unos días antes de pasar a Gratis.
export function statusFromPreapproval(status:string):'active'|'past_due'|'canceled'|'pending' {
  if(status==='authorized')return 'active';
  if(status==='paused')return 'past_due';
  if(status==='cancelled')return 'canceled';
  return 'pending';
}

// Días de gracia cuando falla un cobro, antes de bajar a Gratis (los datos no se borran).
export const GRACE_DAYS=7;

// Firma de las notificaciones de Mercado Pago: x-signature "ts=…,v1=…" con HMAC-SHA256 del
// texto "id:{data.id};request-id:{x-request-id};ts:{ts};" usando la clave secreta del webhook.
export function verifyWebhookSignature(input:{signature:string|null;requestId:string|null;dataId:string|null;secret:string|undefined;now?:number}) {
  if(!input.signature||!input.secret||!input.dataId)return false;
  const parts=Object.fromEntries(input.signature.split(',').map(part=>part.trim().split('=') as [string,string]));
  const ts=parts.ts,v1=parts.v1;
  if(!ts||!v1||!/^[a-f0-9]{64}$/i.test(v1))return false;
  // Notificaciones de más de 10 minutos no se aceptan (evita que se repitan viejas).
  const sent=Number(ts)>1e12?Number(ts):Number(ts)*1000;
  if(!Number.isFinite(sent)||Math.abs((input.now??Date.now())-sent)>10*60*1000)return false;
  const id=/^[a-z0-9]+$/i.test(input.dataId)?input.dataId.toLowerCase():input.dataId;
  const manifest=`id:${id};${input.requestId?`request-id:${input.requestId};`:''}ts:${ts};`;
  const expected=createHmac('sha256',input.secret).update(manifest).digest();
  const received=Buffer.from(v1,'hex');
  return received.length===expected.length&&timingSafeEqual(received,expected);
}

// Próximo vencimiento: un mes o un año después del cobro.
export function periodEnd(from:string,cycle:BillingCycle) {
  const date=new Date(from);
  if(Number.isNaN(date.getTime()))return null;
  if(cycle==='annual')date.setUTCFullYear(date.getUTCFullYear()+1);else date.setUTCMonth(date.getUTCMonth()+1);
  return date.toISOString();
}

async function request(path:string,init:RequestInit&{token:string}) {
  const {token,...rest}=init;
  const response=await fetch(`${API}${path}`,{...rest,headers:{authorization:`Bearer ${token}`,'content-type':'application/json',...(rest.headers||{})},signal:AbortSignal.timeout(15000)});
  const body=await response.json().catch(()=>({})) as Record<string,unknown>;
  if(!response.ok) {
    // El detalle (cause) dice qué dato rechazó Mercado Pago; se guarda en el registro de errores.
    const cause=Array.isArray(body.cause)?body.cause.map(item=>{const entry=item as Record<string,unknown>;return [entry.code,entry.description].filter(Boolean).join(' ');}).join('; '):'';
    throw new Error(`mercadopago_${response.status}_${String(body.message||body.error||'error').slice(0,120)}${cause?` (${cause.slice(0,200)})`:''}`);
  }
  return body;
}

// Crea la suscripción pendiente y devuelve el link de Mercado Pago donde se carga la tarjeta.
export async function createPreapproval(input:{token:string;reason:string;userId:string;payerEmail:string;amount:number;cycle:BillingCycle;backUrl:string;notificationUrl?:string}) {
  const body=await request('/preapproval',{method:'POST',token:input.token,body:JSON.stringify({
    reason:input.reason,
    external_reference:input.userId,
    payer_email:input.payerEmail,
    back_url:input.backUrl,
    ...(input.notificationUrl?{notification_url:input.notificationUrl}:{}),
    status:'pending',
    auto_recurring:{frequency:input.cycle==='annual'?12:1,frequency_type:'months',transaction_amount:input.amount,currency_id:'ARS'},
  })});
  return {id:String(body.id||''),initPoint:String(body.init_point||body.sandbox_init_point||'')};
}

export async function getPreapproval(token:string,id:string) {
  const body=await request(`/preapproval/${encodeURIComponent(id)}`,{method:'GET',token});
  const recurring=(body.auto_recurring||{}) as Record<string,unknown>;
  return {id:String(body.id||id),status:String(body.status||'pending'),externalReference:String(body.external_reference||''),amount:Number(recurring.transaction_amount||0),nextPaymentDate:body.next_payment_date?String(body.next_payment_date):null,payerEmail:body.payer_email?String(body.payer_email):null};
}

export async function updatePreapprovalAmount(token:string,id:string,amount:number) {
  await request(`/preapproval/${encodeURIComponent(id)}`,{method:'PUT',token,body:JSON.stringify({auto_recurring:{transaction_amount:amount,currency_id:'ARS'}})});
}

// Cobro de una suscripción (subscription_authorized_payment): aprobado, rechazado, etc.
export async function getAuthorizedPayment(token:string,id:string) {
  const body=await request(`/authorized_payments/${encodeURIComponent(id)}`,{method:'GET',token});
  const payment=(body.payment||{}) as Record<string,unknown>;
  return {id:String(body.id||id),preapprovalId:String(body.preapproval_id||''),amount:Number(body.transaction_amount||0),currency:String(body.currency_id||'ARS'),status:String(payment.status||body.status||''),date:String(body.debit_date||body.date_created||new Date().toISOString()),paymentId:payment.id?String(payment.id):null};
}
