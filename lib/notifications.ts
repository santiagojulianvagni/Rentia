import { claimEmail, finishEmail, getAccount, releaseEmail, trialsEndingSoon, trialsRecentlyEnded } from '../db/database';
import { sendEmail, type SendResult } from './email/send';
import { trialEndedEmail, trialEndingEmail, type Email } from './email/templates';

// Avisos por mail al dueño de la tienda. Cada uno lleva un tipo y una referencia: el mismo aviso
// nunca sale dos veces. Un mail que falla nunca rompe lo que lo disparó (cobro, baja, etc.).
type Account={email:string;owner_name:string|null;store_name:string|null};
export type Sender=(to:string,email:Email,options:{idempotencyKey:string})=>Promise<SendResult>;
const TRANSIENT=new Set(['not_configured','network','timeout']);

export async function notify(userId:string,kind:string,ref:string,build:(account:Account)=>Email,send:Sender=sendEmail) {
  try {
    const account=await getAccount(userId) as Account|null;
    if (!account?.email||account.email.endsWith('.invalid')) return {sent:false,reason:'no_recipient'};
    const id=await claimEmail(userId,kind,ref);
    if (id===null) return {sent:false,reason:'already_sent'};
    const result=await send(account.email,build(account),{idempotencyKey:`${userId}:${kind}:${ref}`});
    if (result.sent) await finishEmail(id,{status:'sent',providerId:result.id});
    else if (TRANSIENT.has(result.reason)||/^resend_5/.test(result.reason)) await releaseEmail(id);
    else await finishEmail(id,{status:result.reason==='invalid_recipient'?'skipped':'failed',error:result.reason});
    return result;
  } catch {
    return {sent:false,reason:'error'};
  }
}

export const storeName=(account:Account)=>account.store_name?.trim()||'tu tienda';

// Tarea diaria: aviso 3 días y 1 día antes de que termine la prueba, y cuando terminó.
export async function dailyTrialNotifications(now=new Date(),send:Sender=sendEmail) {
  const result={ending:0,ended:0};
  for (const trial of await trialsEndingSoon(now)) {
    const daysLeft=Math.max(1,Math.ceil((Date.parse(trial.trial_ends_at)-now.getTime())/86400000));
    const bucket=daysLeft<=1?'1':'3';
    const sent=await notify(trial.user_id,'trial_ending',`${trial.trial_ends_at}:${bucket}`,account=>trialEndingEmail({ownerName:account.owner_name,storeName:storeName(account),daysLeft,trialEndsAt:trial.trial_ends_at}),send);
    if (sent.sent) result.ending++;
  }
  for (const trial of await trialsRecentlyEnded(now)) {
    const sent=await notify(trial.user_id,'trial_ended',trial.trial_ends_at,account=>trialEndedEmail({ownerName:account.owner_name,storeName:storeName(account)}),send);
    if (sent.sent) result.ended++;
  }
  return result;
}
