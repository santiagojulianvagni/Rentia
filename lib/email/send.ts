import type { Email } from './templates';

// Envío por Resend (https://resend.com) con su API HTTP, sin dependencias. Sin RESEND_API_KEY
// no se manda nada: la app funciona igual y el aviso queda registrado como "sin configurar".
export const EMAIL_FROM='Rentia <hola@rentiaapp.com>';
export const EMAIL_REPLY_TO='hola@rentiaapp.com';

export type SendResult={sent:true;id:string}|{sent:false;reason:string};

export async function sendEmail(to:string,email:Email,options:{idempotencyKey:string;apiKey?:string;fetcher?:typeof fetch}):Promise<SendResult> {
  const apiKey=options.apiKey??process.env.RESEND_API_KEY;
  if (!apiKey) return {sent:false,reason:'not_configured'};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)||to.endsWith('.invalid')) return {sent:false,reason:'invalid_recipient'};
  try {
    const response=await (options.fetcher||fetch)('https://api.resend.com/emails',{
      method:'POST',
      headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json','idempotency-key':options.idempotencyKey.slice(0,256)},
      body:JSON.stringify({from:EMAIL_FROM,to:[to],reply_to:EMAIL_REPLY_TO,subject:email.subject,html:email.html,text:email.text}),
      signal:AbortSignal.timeout(15000),
    });
    const data=await response.json().catch(()=>({})) as {id?:string;message?:string;name?:string};
    if (!response.ok||!data.id) return {sent:false,reason:`resend_${response.status}${data.name?`_${data.name}`:''}`};
    return {sent:true,id:data.id};
  } catch (error) {
    return {sent:false,reason:error instanceof Error&&error.name==='TimeoutError'?'timeout':'network'};
  }
}
