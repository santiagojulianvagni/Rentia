import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {createTestDatabase} from './helpers/postgres.mjs';

// Mails: plantillas con el mismo diseño, texto escapado, y cada aviso una sola vez.
registerHooks({resolve(specifier,context,next){
  try{return next(specifier,context);}catch(error){
    if(error.code==='ERR_MODULE_NOT_FOUND'&&specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return next(`${specifier}.ts`,context);
    throw error;
  }
}});
const {setDatabase}=await import('../db/client.ts');
const templates=await import('../lib/email/templates.ts');
const {sendEmail}=await import('../lib/email/send.ts');
const {notify,dailyTrialNotifications}=await import('../lib/notifications.ts');

test('every template has a subject, the brand layout, a button and a plain-text version',()=>{
  const all=[
    templates.trialEndingEmail({ownerName:'Ana Pérez',storeName:'Casa <Norte>',daysLeft:3,trialEndsAt:'2026-11-20T12:00:00Z'}),
    templates.trialEndingEmail({ownerName:null,storeName:'Casa',daysLeft:1,trialEndsAt:'2026-11-20T12:00:00Z'}),
    templates.trialEndedEmail({ownerName:'Ana',storeName:'Casa'}),
    templates.subscriptionActiveEmail({ownerName:'Ana',storeName:'Casa',planName:'Growth',amount:61230,cycle:'monthly',nextPaymentDate:'2026-12-08T12:00:00Z'}),
    templates.paymentFailedEmail({ownerName:'Ana',storeName:'Casa',planName:'Growth',graceUntil:'2026-11-15T12:00:00Z'}),
    templates.subscriptionCanceledEmail({ownerName:'Ana',storeName:'Casa',planName:'Growth',until:'2026-12-08T12:00:00Z'}),
    templates.planExpiredEmail({ownerName:'Ana',storeName:'Casa'}),
    templates.customerDataRequestEmail({ownerName:'Ana',storeName:'Casa',requestId:'456',orders:2,carts:1,cartContacts:1}),
  ];
  for (const email of all) {
    assert.ok(email.subject.length>8&&email.subject.length<70,email.subject);
    assert.match(email.html,/apple-icon\.png/);
    assert.match(email.html,/hola@rentiaapp\.com/);
    assert.match(email.html,/<a href="https:\/\/[^"]+" style="display:inline-block/);
    assert.ok(email.text.includes('https://'),'the plain text has the link');
  }
  assert.match(all[0].html,/¡Hola, Ana!/);
  assert.ok(all[0].html.includes('Casa &lt;Norte&gt;')&&!all[0].html.includes('Casa <Norte>'),'store names are escaped');
  assert.match(all[0].subject,/3 días/);assert.match(all[1].subject,/mañana/);assert.match(all[1].html,/¡Hola!/);
  assert.match(all[3].html,/\$ 61\.230/);
});

test('without an API key nothing is sent, and a bad recipient is skipped',async()=>{
  const email=templates.trialEndedEmail({ownerName:'Ana',storeName:'Casa'});
  assert.deepEqual(await sendEmail('a@b.com',email,{idempotencyKey:'k',apiKey:''}),{sent:false,reason:'not_configured'});
  assert.deepEqual(await sendEmail('pending+tiendanube-1@rentia.invalid',email,{idempotencyKey:'k',apiKey:'re_x'}),{sent:false,reason:'invalid_recipient'});
  let request;
  const fetcher=async(url,init)=>{request={url,init};return new Response(JSON.stringify({id:'em_1'}),{status:200});};
  assert.deepEqual(await sendEmail('a@b.com',email,{idempotencyKey:'u:trial_ended:1',apiKey:'re_x',fetcher}),{sent:true,id:'em_1'});
  assert.equal(request.url,'https://api.resend.com/emails');
  assert.equal(request.init.headers['idempotency-key'],'u:trial_ended:1');
  assert.equal(JSON.parse(request.init.body).from,'Rentia <hola@rentiaapp.com>');
});

test('each notice is sent once; a passing failure is retried and the trial reminders follow the days left',async()=>{
  const {pg,driver}=await createTestDatabase();setDatabase(driver);
  await pg.query("INSERT INTO accounts (user_id,email,owner_name,store_name,trial_started_at,created_at,updated_at) VALUES ('s','dueno@tienda.com','Ana','Casa Norte','2026-11-01','2026-11-01','2026-11-01')");
  const sent=[];
  const ok=async(to,email)=>{sent.push([to,email.subject]);return {sent:true,id:`em_${sent.length}`};};
  const build=()=>templates.trialEndedEmail({ownerName:'Ana',storeName:'Casa'});
  assert.equal((await notify('s','trial_ended','x',build,ok)).sent,true);
  assert.equal((await notify('s','trial_ended','x',build,ok)).reason,'already_sent');
  assert.equal((await notify('s','trial_ended','y',build,async()=>({sent:false,reason:'network'}))).sent,false);
  assert.equal((await notify('s','trial_ended','y',build,ok)).sent,true,'a network failure is retried later');
  assert.equal(sent.length,2);

  await pg.query("INSERT INTO subscriptions (user_id,plan_id,status,billing_cycle,trial_ends_at,created_at,updated_at) VALUES ('s','free','trialing','monthly','2026-11-15T12:00:00.000Z','2026-11-01','2026-11-01')");
  sent.length=0;
  await dailyTrialNotifications(new Date('2026-11-12T13:00:00Z'),ok);
  await dailyTrialNotifications(new Date('2026-11-12T20:00:00Z'),ok);
  assert.deepEqual(sent.map(item=>item[1]),['Tu prueba de Rentia termina en 3 días'],'once for the 3-day notice');
  await dailyTrialNotifications(new Date('2026-11-14T13:00:00Z'),ok);
  assert.equal(sent.at(-1)[1],'Tu prueba de Rentia termina mañana');
  await dailyTrialNotifications(new Date('2026-11-15T13:00:00Z'),ok);
  assert.equal(sent.at(-1)[1],'Terminó tu prueba de Rentia');
  assert.equal(sent.length,3);
});

test('the new templates: weekly summary, price increase, welcome and withdrawal',()=>{
  const week=templates.weeklySummaryEmail({ownerName:'Ana',storeName:'Casa',from:'2026-11-02',to:'2026-11-08',current:{revenue:200000,profit:50000,margin:25,orders:10,aov:20000,adSpend:15000},previous:{revenue:100000,profit:40000,margin:40,orders:5,aov:20000,adSpend:0}});
  assert.match(week.subject,/\$ 50\.000/);
  assert.match(week.html,/▲ \+100 %/);assert.match(week.html,/Tu margen bajó/);assert.match(week.html,/nuevo/);
  const price=templates.priceIncreaseEmail({ownerName:'Ana',storeName:'Casa',planName:'Growth',previous:50000,next:56000,rate:1570});
  assert.match(price.html,/\+12 %/);assert.match(price.html,/El precio en dólares no cambió/);
  assert.match(templates.welcomeEmail({ownerName:'Ana Pérez',storeName:'Casa',trialDays:14}).html,/Bienvenido a Rentia, Ana/);
  const withdrawal=templates.withdrawalReceivedEmail({name:'Ana',code:'ARR-ABCD2345'});
  assert.match(withdrawal.subject,/ARR-ABCD2345/);assert.match(withdrawal.html,/Código de trámite: ARR-ABCD2345/);
});

test('the weekly summary goes out on Mondays (Argentina time) with last Monday-to-Sunday',async()=>{
  const {previousWeek}=await import('../lib/weekly.ts');
  assert.deepEqual(previousWeek(new Date('2026-11-09T09:00:00Z')),{isMonday:true,from:'2026-11-02',to:'2026-11-08',prevFrom:'2026-10-26',prevTo:'2026-11-01'});
  assert.equal(previousWeek(new Date('2026-11-09T02:00:00Z')).isMonday,false,'still Sunday in Argentina');
  assert.equal(previousWeek(new Date('2026-11-10T09:00:00Z')).isMonday,false);
});

test('withdrawal requests are linked to the account by email and limited per connection',async()=>{
  const {pg,driver}=await createTestDatabase();setDatabase(driver);
  const database=await import('../db/database.ts');
  await pg.query("INSERT INTO accounts (user_id,email,owner_name,store_name,trial_started_at,created_at,updated_at) VALUES ('s','dueno@tienda.com','Ana','Casa','2026-11-01','2026-11-01','2026-11-01')");
  assert.equal((await database.createWithdrawalRequest({code:'ARR-1',name:'Ana',email:'Dueno@Tienda.com',store:null,reason:null,ipHash:'h'})).userId,'s');
  assert.equal((await database.createWithdrawalRequest({code:'ARR-2',name:'Otro',email:'otro@x.com',store:null,reason:null,ipHash:'h'})).userId,null);
  assert.equal(await database.countRecentWithdrawals('h',new Date(Date.now()-3600000).toISOString()),2);
});
