import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {registerHooks} from 'node:module';
import {createTestDatabase} from './helpers/postgres.mjs';

// Plan sin cargo: Enterprise para la tienda del dueño, sin Mercado Pago y sin vencimiento.
registerHooks({resolve(specifier,context,next){
  try{return next(specifier,context);}catch(error){
    if(error.code==='ERR_MODULE_NOT_FOUND'&&specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return next(`${specifier}.ts`,context);
    throw error;
  }
}});
const {setDatabase}=await import('../db/client.ts');
const database=await import('../db/database.ts');
const {monthlyOrderLimit}=await import('../lib/billing.ts');
const {historyEntitlement,teamEntitlement}=await import('../lib/plans.ts');

test('the database computes the same owner fingerprint as the code',async()=>{
  const {pg}=await createTestDatabase();
  const email='  Dueno@Tienda.com ';
  const fromDb=(await pg.query("SELECT encode(sha256(convert_to('rentia-tester:'||lower(trim($1::text)),'UTF8')),'hex') AS h",[email])).rows[0].h;
  assert.equal(fromDb,createHash('sha256').update(`rentia-tester:${email.trim().toLowerCase()}`).digest('hex'));
});

test('a complimentary plan has no limits, never expires and is not touched by the grace rules',async()=>{
  const {pg,driver}=await createTestDatabase();setDatabase(driver);
  await pg.query("INSERT INTO accounts (user_id,email,owner_name,store_name,trial_started_at,created_at,updated_at) VALUES ('s','s@example.invalid','Owner','Store','2026-08-01','2026-08-01','2026-08-01')");
  await database.getOrCreateSubscription('s');
  await database.savePendingCheckout('s',{planId:'starter',cycle:'monthly',preapprovalId:'pre-1',amount:23550,termsVersion:'2026-11-08'});
  await database.applyPreapprovalStatus('s',{status:'authorized',nextPaymentDate:'2026-12-07T10:00:00.000Z',amount:23550});
  await database.cancelSubscription('s','owner');
  let subscription=await database.grantComplimentaryPlan('s','enterprise');
  assert.deepEqual([subscription.provider,subscription.plan_id,subscription.status,subscription.cancel_at_period_end,subscription.current_period_end,subscription.provider_subscription_id],['complimentary','enterprise','active',false,null,null]);
  assert.equal(monthlyOrderLimit(subscription),null);
  assert.equal(historyEntitlement(subscription).months,null);
  assert.equal(teamEntitlement(subscription).limit,null);
  assert.deepEqual(await database.expireLapsedSubscriptions(7,new Date('2030-01-01T00:00:00Z')),[]);
  assert.equal(await database.findSubscriptionByPreapproval('pre-1'),null,'old Mercado Pago notices no longer reach it');
  assert.deepEqual(await database.subscriptionsToReprice(),[],'it is never repriced');
  subscription=await database.getOrCreateSubscription('s');
  assert.deepEqual([subscription.plan_id,subscription.status],['enterprise','active']);
});

test('MERCADOPAGO_LIVE turns the test mode off',async()=>{
  const {billingTestMode}=await import('../lib/billing-checkout.ts');
  assert.equal(billingTestMode({MERCADOPAGO_TEST:'1'}),true);
  assert.equal(billingTestMode({MERCADOPAGO_TEST:'1',MERCADOPAGO_LIVE:'1'}),false);
  assert.equal(billingTestMode({}),false);
});
