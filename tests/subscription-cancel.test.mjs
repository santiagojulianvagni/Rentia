import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {createTestDatabase} from './helpers/postgres.mjs';

// Elegir un plan exige aceptar los términos; darse de baja exige confirmación escrita y verificación reciente.
globalThis.__reverified=false;
registerHooks({resolve(specifier,context,next){
  if(/\/lib\/session$/.test(specifier))return {url:'data:text/javascript,export async function getRentiaUser(){return {id:"store-sub",role:"owner",email:"o@example.invalid",clerkUserId:"user_1"};}export function canManageRentia(){return true;}',shortCircuit:true};
  if(/\/lib\/reverification$/.test(specifier))return {url:'data:text/javascript,export async function requireRecentVerification(){return globalThis.__reverified?null:Response.json({clerk_error:{type:"forbidden",reason:"reverification-error"}},{status:403});}',shortCircuit:true};
  if(specifier==='next/server')return next('next/server.js',context);
  try{return next(specifier,context);}catch(error){
    if(error.code==='ERR_MODULE_NOT_FOUND'&&specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return next(`${specifier}.ts`,context);
    throw error;
  }
}});
const {setDatabase}=await import('../db/client.ts');
const endpoint=await import('../app/api/subscription/route.ts');
const post=body=>endpoint.POST(new Request('https://rentia.example.invalid/api/subscription',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}));

async function setup(status='trialing') {
  const {pg,driver}=await createTestDatabase();setDatabase(driver);
  await pg.query("INSERT INTO accounts (user_id,email,owner_name,store_name,trial_started_at,created_at,updated_at) VALUES ('store-sub','o@example.invalid','Owner','Store',$1,$1,$1)",[new Date().toISOString()]);
  if(status==='active')await pg.query("INSERT INTO subscriptions (user_id,plan_id,status,billing_cycle,trial_ends_at,current_period_end,created_at,updated_at) VALUES ('store-sub','growth','active','monthly','2026-01-01',$1,'2026-01-01','2026-01-01')",[new Date(Date.now()+10*864e5).toISOString()]);
  return pg;
}

test('choosing a plan requires accepting the terms and records the version',async()=>{
  const pg=await setup();
  assert.equal((await post({planId:'growth',billingCycle:'monthly'})).status,400);
  const ok=await post({planId:'growth',billingCycle:'monthly',acceptTerms:true});
  assert.equal(ok.status,200);
  const row=(await pg.query("SELECT requested_plan_id,terms_version,terms_accepted_at FROM subscriptions WHERE user_id='store-sub'")).rows[0];
  assert.equal(row.requested_plan_id,'growth');assert.ok(row.terms_version);assert.ok(row.terms_accepted_at);
});

test('cancelling needs the typed confirmation and a recent identity check',async()=>{
  const pg=await setup('active');
  globalThis.__reverified=false;
  assert.equal((await post({action:'cancel'})).status,400);
  assert.equal((await post({action:'cancel',confirmation:'DAR DE BAJA'})).status,403);
  assert.equal((await pg.query("SELECT cancel_at_period_end FROM subscriptions")).rows[0].cancel_at_period_end,false);
  globalThis.__reverified=true;
  const response=await post({action:'cancel',confirmation:'DAR DE BAJA'});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.subscription.cancelAtPeriodEnd,true);
  assert.equal(body.subscription.status,'active');
  const row=(await pg.query("SELECT cancel_at_period_end,canceled_by FROM subscriptions")).rows[0];
  assert.equal(row.cancel_at_period_end,true);assert.equal(row.canceled_by,'user_1');
  // Cuando termina el período pagado, pasa a Gratis sin perder la cuenta.
  await pg.query("UPDATE subscriptions SET current_period_end=$1",[new Date(Date.now()-1000).toISOString()]);
  const after=await (await endpoint.GET(new Request('https://rentia.example.invalid/api/subscription'))).json();
  assert.equal(after.subscription.status,'free');assert.equal(after.subscription.planId,'free');
  globalThis.__reverified=false;
});
