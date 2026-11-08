import { currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isRentiaOwnerEmail } from '../../../../lib/billing-checkout';
import { sendEmail } from '../../../../lib/email/send';
import * as templates from '../../../../lib/email/templates';

// Mail de prueba para revisar el diseño: solo los dueños y solo a su propio email.
const SAMPLES:Record<string,(name:string)=>templates.Email>={
  welcome:name=>templates.welcomeEmail({ownerName:name,storeName:'Tu tienda',trialDays:14}),
  trial_ending:name=>templates.trialEndingEmail({ownerName:name,storeName:'Tu tienda',daysLeft:3,trialEndsAt:new Date(Date.now()+3*86400000).toISOString()}),
  trial_ended:name=>templates.trialEndedEmail({ownerName:name,storeName:'Tu tienda'}),
  subscription_active:name=>templates.subscriptionActiveEmail({ownerName:name,storeName:'Tu tienda',planName:'Growth',amount:61230,cycle:'monthly',nextPaymentDate:new Date(Date.now()+30*86400000).toISOString()}),
  payment_failed:name=>templates.paymentFailedEmail({ownerName:name,storeName:'Tu tienda',planName:'Growth',graceUntil:new Date(Date.now()+7*86400000).toISOString()}),
  subscription_canceled:name=>templates.subscriptionCanceledEmail({ownerName:name,storeName:'Tu tienda',planName:'Growth',until:new Date(Date.now()+20*86400000).toISOString()}),
  plan_expired:name=>templates.planExpiredEmail({ownerName:name,storeName:'Tu tienda'}),
  price_increase:name=>templates.priceIncreaseEmail({ownerName:name,storeName:'Tu tienda',planName:'Growth',previous:56000,next:63000,rate:1650}),
  weekly_summary:name=>templates.weeklySummaryEmail({ownerName:name,storeName:'Tu tienda',from:'2026-11-02',to:'2026-11-08',current:{revenue:1850000,profit:412000,margin:22.3,orders:46,aov:40217,adSpend:210000},previous:{revenue:1520000,profit:365000,margin:24,orders:39,aov:38974,adSpend:180000}}),
  customer_data_request:name=>templates.customerDataRequestEmail({ownerName:name,storeName:'Tu tienda',requestId:'456',orders:3,carts:1,cartContacts:1}),
  withdrawal:name=>templates.withdrawalReceivedEmail({name,code:'ARR-PRUEBA23'}),
};

export async function POST(request:Request) {
  const user=await currentUser();
  const primary=user?.emailAddresses.find(item=>item.id===user.primaryEmailAddressId);
  if (!primary||primary.verification?.status!=='verified'||!isRentiaOwnerEmail(primary.emailAddress)) return NextResponse.json({error:'forbidden'},{status:403});
  if (request.headers.get('origin')!==new URL(request.url).origin) return NextResponse.json({error:'invalid_origin'},{status:403});
  const parsed=z.object({kind:z.enum(Object.keys(SAMPLES) as [string,...string[]])}).safeParse(await request.json().catch(()=>null));
  if (!parsed.success) return NextResponse.json({error:'invalid_kind'},{status:400});
  const email=SAMPLES[parsed.data.kind](user?.firstName||'');
  const result=await sendEmail(primary.emailAddress,{...email,subject:`[Prueba] ${email.subject}`},{idempotencyKey:`test:${primary.emailAddress}:${parsed.data.kind}:${Date.now()}`});
  return NextResponse.json(result,{status:result.sent?200:502});
}
