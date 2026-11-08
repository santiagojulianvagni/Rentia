import { createHash, randomInt } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { countRecentWithdrawals, createWithdrawalRequest } from '../../../db/database';
import { EMAIL_REPLY_TO, sendEmail } from '../../../lib/email/send';
import { withdrawalInternalEmail, withdrawalReceivedEmail } from '../../../lib/email/templates';

// Botón de arrepentimiento (Res. 424/2020): no pide cuenta ni registro. Devuelve el código de
// trámite en el momento y lo manda por mail; a Rentia le llega un aviso para resolverlo.
const Body=z.object({
  name:z.string().trim().min(2).max(120),
  email:z.string().trim().toLowerCase().email().max(200),
  store:z.string().trim().max(120).optional().default(''),
  reason:z.string().trim().max(1000).optional().default(''),
  website:z.string().max(0).optional().default(''), // trampa para bots: los humanos no la ven
});

const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const withdrawalCode=()=>`ARR-${Array.from({length:8},()=>ALPHABET[randomInt(ALPHABET.length)]).join('')}`;

export async function POST(request:Request) {
  let parsed;
  try { parsed=Body.safeParse(await request.json()); }
  catch { return NextResponse.json({error:'invalid_body'},{status:400}); }
  if (!parsed.success) return NextResponse.json({error:'invalid_body',fields:parsed.error.issues.map(issue=>issue.path.join('.'))},{status:400});
  const body=parsed.data;
  const ip=(request.headers.get('x-forwarded-for')||'').split(',')[0].trim();
  const ipHash=ip?createHash('sha256').update(`rentia-withdrawal:${ip}`).digest('hex').slice(0,32):null;
  if (ipHash&&await countRecentWithdrawals(ipHash,new Date(Date.now()-60*60*1000).toISOString())>=5) return NextResponse.json({error:'too_many_requests'},{status:429});
  const code=withdrawalCode();
  const {userId}=await createWithdrawalRequest({code,name:body.name,email:body.email,store:body.store||null,reason:body.reason||null,ipHash});
  // Los mails no frenan el pedido: el código ya quedó registrado y se muestra en pantalla.
  await Promise.all([
    sendEmail(body.email,withdrawalReceivedEmail({name:body.name,code}),{idempotencyKey:`withdrawal:${code}:user`}),
    sendEmail(EMAIL_REPLY_TO,withdrawalInternalEmail({code,name:body.name,email:body.email,store:body.store||null,reason:body.reason||null,accountFound:Boolean(userId)}),{idempotencyKey:`withdrawal:${code}:internal`}),
  ]).catch(()=>undefined);
  return NextResponse.json({ok:true,code});
}
