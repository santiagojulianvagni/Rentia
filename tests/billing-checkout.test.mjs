import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {createTestDatabase} from './helpers/postgres.mjs';

// Cobro con Mercado Pago: el plan se activa cuando Mercado Pago autoriza, un cobro rechazado
// deja 7 días de gracia y después pasa a Gratis; una baja termina al final del período pagado.
registerHooks({resolve(specifier,context,next){
  try{return next(specifier,context);}catch(error){
    if(error.code==='ERR_MODULE_NOT_FOUND'&&specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return next(`${specifier}.ts`,context);
    throw error;
  }
}});
const {setDatabase}=await import('../db/client.ts');
const database=await import('../db/database.ts');
const {checkoutEnabledFor}=await import('../lib/billing-checkout.ts');

test('only testers can pay until billing is opened, and nobody without credentials',()=>{
  assert.equal(checkoutEnabledFor('dueno@tienda.com',{}),false);
  assert.equal(checkoutEnabledFor('dueno@tienda.com',{MERCADOPAGO_ACCESS_TOKEN:'x',RENTIA_BILLING_TESTERS:'Dueno@Tienda.com, otro@x.com'}),true);
  assert.equal(checkoutEnabledFor('cliente@x.com',{MERCADOPAGO_ACCESS_TOKEN:'x',RENTIA_BILLING_TESTERS:'dueno@tienda.com'}),false);
  assert.equal(checkoutEnabledFor('cliente@x.com',{MERCADOPAGO_ACCESS_TOKEN:'x',RENTIA_BILLING_OPEN:'1'}),true);
});

test('authorized, rejected charge with grace, and cancellation at the end of the period',async()=>{
  const {pg,driver}=await createTestDatabase();setDatabase(driver);
  await pg.query("INSERT INTO accounts (user_id,email,owner_name,store_name,trial_started_at,created_at,updated_at) VALUES ('s','s@example.invalid','Owner','Store','2026-08-01','2026-08-01','2026-08-01')");
  await database.getOrCreateSubscription('s');
  await database.savePendingCheckout('s',{planId:'growth',cycle:'monthly',preapprovalId:'pre-1',amount:56000,termsVersion:'2026-10-12'});
  assert.equal((await database.findSubscriptionByPreapproval('pre-1')).user_id,'s');

  let subscription=await database.applyPreapprovalStatus('s',{status:'authorized',nextPaymentDate:'2026-12-07T10:00:00.000Z',amount:56000});
  assert.deepEqual([subscription.status,subscription.plan_id,subscription.requested_plan_id,subscription.current_period_end],['active','growth',null,'2026-12-07T10:00:00.000Z']);

  await database.recordSubscriptionPayment('s',{id:'pay-1',preapprovalId:'pre-1',amount:56000,currency:'ARS',status:'approved',date:'2026-11-07T10:00:00.000Z'});
  await database.recordSubscriptionPayment('s',{id:'pay-1',preapprovalId:'pre-1',amount:56000,currency:'ARS',status:'approved',date:'2026-11-07T10:00:00.000Z'});
  assert.equal((await database.listSubscriptionPayments('s')).length,1,'the same notification twice is one payment');

  subscription=await database.applyPreapprovalStatus('s',{status:'paused',nextPaymentDate:null});
  assert.equal(subscription.status,'past_due');
  const since=Date.parse(subscription.past_due_since);
  assert.deepEqual(await database.expireLapsedSubscriptions(7,new Date(since+3*86400000)),[],'still within the grace days');
  assert.deepEqual(await database.expireLapsedSubscriptions(7,new Date(since+8*86400000)),['s']);
  subscription=await database.getOrCreateSubscription('s');
  assert.deepEqual([subscription.status,subscription.plan_id],['free','free']);

  // Nueva suscripción y baja: sigue hasta el fin del período pagado.
  await database.savePendingCheckout('s',{planId:'pro',cycle:'annual',preapprovalId:'pre-2',amount:1400000,termsVersion:'2026-10-12'});
  await database.applyPreapprovalStatus('s',{status:'authorized',nextPaymentDate:'2027-11-07T10:00:00.000Z'});
  subscription=await database.applyPreapprovalStatus('s',{status:'cancelled',nextPaymentDate:null});
  assert.deepEqual([subscription.status,subscription.plan_id,Boolean(subscription.cancel_at_period_end)],['active','pro',true]);
  assert.deepEqual(await database.expireLapsedSubscriptions(7,new Date('2027-06-01T00:00:00Z')),[]);
  assert.deepEqual(await database.expireLapsedSubscriptions(7,new Date('2027-11-08T00:00:00Z')),['s']);
  await pg.close();
});
