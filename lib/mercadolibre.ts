import {env} from './env';
import {decryptToken,encryptToken} from './token-crypto';
import {publicOrigin} from './public-origin';

// OAuth infrastructure. Live seller validation remains separate from fixture
// checks; missing runtime credentials always keep the connection unavailable.
export const MELI_CALLBACK_PATH='/api/integrations/mercadolibre/callback';
export const MELI_WEBHOOK_PATH='/api/webhooks/mercadolibre';
export const MELI_OAUTH_COOKIE='__Host-rentia_meli_oauth';
export const MELI_OAUTH_SECONDS=600;

type Runtime={MELI_APP_ID?:string;MELI_APP_SECRET?:string;TOKEN_ENCRYPTION_KEY?:string;RENTIA_PUBLIC_ORIGIN?:string};
export function mercadoLibreRuntime():Runtime { return env as unknown as Runtime; }

export function mercadoLibreOrigin() { return publicOrigin(); }

export function mercadoLibreConfigured() {
  const runtime=mercadoLibreRuntime();
  try {
    mercadoLibreOrigin();
    return !!runtime.MELI_APP_ID&&/^\d+$/.test(runtime.MELI_APP_ID)&&!!runtime.MELI_APP_SECRET&&!!runtime.TOKEN_ENCRYPTION_KEY&&atob(runtime.TOKEN_ENCRYPTION_KEY).length===32;
  } catch { return false; }
}

function base64url(bytes:Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
}
export function mercadoLibreNonce() { return base64url(crypto.getRandomValues(new Uint8Array(32))); }
export async function mercadoLibreChallenge(verifier:string) {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
}

export type MercadoLibreAttempt={state:string;verifier:string;storeUserId:string;actorId:string;expiresAt:number};
export async function sealMercadoLibreAttempt(attempt:MercadoLibreAttempt) {
  const key=mercadoLibreRuntime().TOKEN_ENCRYPTION_KEY;
  if(!key) throw new Error('mercadolibre_credentials_missing');
  const encrypted=await encryptToken(JSON.stringify(attempt),key);
  return `${encrypted.iv}.${encrypted.encryptedToken}`;
}
export async function readMercadoLibreAttempt(cookie:string):Promise<MercadoLibreAttempt|null> {
  try {
    const [iv,encrypted,...rest]=cookie.split('.');
    const key=mercadoLibreRuntime().TOKEN_ENCRYPTION_KEY;
    if(!iv||!encrypted||rest.length||!key) return null;
    const value=JSON.parse(await decryptToken(encrypted,iv,key)) as MercadoLibreAttempt;
    if(!/^[A-Za-z0-9_-]{43}$/.test(value.state)||!/^[A-Za-z0-9_-]{43}$/.test(value.verifier)||typeof value.storeUserId!=='string'||typeof value.actorId!=='string'||!Number.isFinite(value.expiresAt)||value.expiresAt<=Date.now()) return null;
    return value;
  } catch { return null; }
}

export type MercadoLibreTokens={access_token:string;refresh_token:string;expires_in:number;scope:string;user_id:string};
const tokenErrors=['invalid_client','invalid_grant','invalid_scope','invalid_request','unsupported_grant_type','forbidden','local_rate_limited','unauthorized_client','unauthorized_application','invalid_operator_user_id'] as const;
type TokenError=typeof tokenErrors[number]|'unknown'|'invalid_response'|'network'|'timeout';
export class MercadoLibreExchangeError extends Error {
  constructor(readonly category:TokenError,readonly status:number|null=null) {
    super('mercadolibre_token_exchange_failed');
    this.name='MercadoLibreExchangeError';
  }
}
export async function exchangeMercadoLibreCode(code:string,verifier:string):Promise<MercadoLibreTokens> {
  const runtime=mercadoLibreRuntime();
  if(!mercadoLibreConfigured()) throw new Error('mercadolibre_credentials_missing');
  const body=new URLSearchParams({grant_type:'authorization_code',client_id:runtime.MELI_APP_ID!,client_secret:runtime.MELI_APP_SECRET!,code,redirect_uri:`${mercadoLibreOrigin()}${MELI_CALLBACK_PATH}`,code_verifier:verifier});
  let response:Response;
  try {
    // Workerd rejects redirect:'error' before transmitting the request. Manual
    // mode does not follow redirects or forward credentials to another host.
    response=await fetch('https://api.mercadolibre.com/oauth/token',{method:'POST',headers:{accept:'application/json','content-type':'application/x-www-form-urlencoded'},body,redirect:'manual',signal:AbortSignal.timeout(15000)});
  } catch(error) {
    throw new MercadoLibreExchangeError(error instanceof Error&&['TimeoutError','AbortError'].includes(error.name)?'timeout':'network');
  }
  let result:Record<string,unknown>|null;
  try { result=await response.json() as Record<string,unknown>|null; }
  catch { throw new MercadoLibreExchangeError('invalid_response',response.status); }
  // Do not forward upstream bodies or errors: they can contain credentials.
  if(!response.ok) {
    const upstream=tokenErrors.find(category=>category===result?.error);
    const category=upstream||(response.status===403?'forbidden':response.status===429?'local_rate_limited':'unknown');
    throw new MercadoLibreExchangeError(category,response.status);
  }
  if(!result||typeof result.access_token!=='string'||!result.access_token||typeof result.refresh_token!=='string'||!result.refresh_token||!Number.isFinite(Number(result.expires_in))||Number(result.expires_in)<=0||!/^\d+$/.test(String(result.user_id))) throw new MercadoLibreExchangeError('invalid_response',response.status);
  return {access_token:result.access_token,refresh_token:result.refresh_token,expires_in:Number(result.expires_in),scope:typeof result.scope==='string'?result.scope:'',user_id:String(result.user_id)};
}

export type MercadoLibreNotice={id:string;topic:'orders_v2'|'items'|'shipments'|'claims';resource:string;sellerId:string;applicationId:string;sent:string};
export function parseMercadoLibreNotice(value:unknown):MercadoLibreNotice|null {
  if(!value||typeof value!=='object'||Array.isArray(value)) return null;
  const body=value as Record<string,unknown>;
  const topic=body.topic;
  const pattern=topic==='orders_v2'?/^\/orders\/\d+$/:topic==='items'?/^\/items\/[A-Z]{3}\d+$/:topic==='shipments'?/^\/shipments\/\d+$/:topic==='claims'?/^\/post-purchase\/v1\/claims\/\d+$/:null;
  if(!pattern||typeof body.resource!=='string'||!pattern.test(body.resource)||typeof body._id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(body._id)||!/^\d+$/.test(String(body.user_id))||!/^\d+$/.test(String(body.application_id))||typeof body.sent!=='string'||!Number.isFinite(Date.parse(body.sent))) return null;
  return {id:body._id,topic:topic as MercadoLibreNotice['topic'],resource:body.resource,sellerId:String(body.user_id),applicationId:String(body.application_id),sent:new Date(body.sent).toISOString()};
}

export async function readMercadoLibreWebhookBody(request:Request) {
  const limit=8192;
  if(Number(request.headers.get('content-length'))>limit) throw new Error('body_too_large');
  const reader=request.body?.getReader();
  if(!reader) throw new Error('invalid_json');
  const chunks:Uint8Array[]=[];
  let size=0;
  try {
    for(;;) {
      const {done,value}=await reader.read();
      if(done) break;
      size+=value.byteLength;
      if(size>limit) { await reader.cancel(); throw new Error('body_too_large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes=new Uint8Array(size);
  let offset=0;
  for(const chunk of chunks) { bytes.set(chunk,offset); offset+=chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)) as unknown; }
  catch { throw new Error('invalid_json'); }
}
