import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {createTestDatabase} from './helpers/postgres.mjs';

// Límite mensual de órdenes por plan: solo se aplica con el cobro activo y nunca pierde datos.
registerHooks({resolve(specifier,context,next){
  try{return next(specifier,context);}catch(error){
    if(error.code==='ERR_MODULE_NOT_FOUND'&&specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return next(`${specifier}.ts`,context);
    throw error;
  }
}});
const {setDatabase}=await import('../db/client.ts');
const database=await import('../db/database.ts');
const {monthlyOrderLimit}=await import('../lib/billing.ts');

const order=(id,createdAt)=>({externalId:id,number:id,currency:'ARS',status:'open',paymentStatus:'paid',paymentMethod:'pago-nube',paymentType:null,paymentInstallments:null,shippingStatus:null,shippingCost:0,total:1000,subtotal:1000,discount:0,createdAt,updatedAt:createdAt,items:[]});
async function store(status,trialEndsAt='2026-09-01T00:00:00.000Z',plan='free') {
  const {pg,driver}=await createTestDatabase();setDatabase(driver);
  await pg.query("INSERT INTO accounts (user_id,email,owner_name,store_name,trial_started_at,created_at,updated_at) VALUES ('s','s@example.invalid','Owner','Store','2026-08-01','2026-08-01','2026-08-01')");
  await pg.query("INSERT INTO subscriptions (user_id,plan_id,status,billing_cycle,trial_ends_at,created_at,updated_at) VALUES ('s',$1,$2,'monthly',$3,'2026-08-01','2026-08-01')",[plan,status,trialEndsAt]);
  return pg;
}
const count=async(pg,table)=>Number((await pg.query(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0].n);

test('the plan limit depends on trial, paid status and plan',()=>{
  const now=Date.parse('2026-10-11T00:00:00Z');
  assert.equal(monthlyOrderLimit({plan_id:'free',status:'trialing',trial_ends_at:'2026-10-20T00:00:00Z'},now),null);
  assert.equal(monthlyOrderLimit({plan_id:'free',status:'trialing',trial_ends_at:'2026-10-01T00:00:00Z'},now),50);
  assert.equal(monthlyOrderLimit({plan_id:'growth',status:'active',trial_ends_at:'2026-10-01T00:00:00Z'},now),1000);
  assert.equal(monthlyOrderLimit({plan_id:'growth',status:'past_due',trial_ends_at:'2026-10-01T00:00:00Z'},now),50);
  assert.equal(monthlyOrderLimit({plan_id:'enterprise',status:'active',trial_ends_at:'2026-10-01T00:00:00Z'},now),null);
});

test('without billing enforced every order is imported',async()=>{
  delete process.env.RENTIA_BILLING_ENFORCED;
  const pg=await store('free');
  await database.upsertOrders('s','tiendanube',Array.from({length:60},(_,i)=>order(`o${i}`,'2026-10-02T10:00:00+0000')));
  assert.equal(await count(pg,'orders'),60);
  assert.equal(await count(pg,'skipped_orders'),0);
});

test('a free store imports 50 orders per month, keeps updating them and records the rest',async()=>{
  process.env.RENTIA_BILLING_ENFORCED='1';
  try {
    const pg=await store('free');
    await database.upsertOrders('s','tiendanube',Array.from({length:45},(_,i)=>order(`o${i}`,'2026-10-02T10:00:00+0000')));
    await database.upsertOrders('s','tiendanube',Array.from({length:10},(_,i)=>order(`n${i}`,'2026-10-05T10:00:00+0000')));
    await database.upsertOrders('s','tiendanube',[order('sept','2026-09-30T10:00:00+0000')]);
    assert.equal(await count(pg,'orders'),51);
    assert.equal(await count(pg,'skipped_orders'),5);
    // Una orden ya importada se sigue actualizando aunque el mes esté completo.
    await database.upsertOrders('s','tiendanube',[{...order('o1','2026-10-02T10:00:00+0000'),total:2500}]);
    assert.equal(Number((await pg.query("SELECT total FROM orders WHERE external_order_id='o1'")).rows[0].total),2500);
    const quota=await database.getOrderQuota('s',new Date('2026-10-11T00:00:00Z'));
    assert.deepEqual({limit:quota.limit,used:quota.used,skipped:quota.skippedThisMonth},{limit:50,used:50,skipped:5});
    // Al pasar a un plan pago, las omitidas se pueden volver a guardar y salen de la lista.
    await pg.query("UPDATE subscriptions SET plan_id='starter',status='active'");
    const skipped=await database.getSkippedOrders('s','tiendanube');
    assert.equal(skipped.length,5);
    await database.upsertOrders('s','tiendanube',skipped.map(id=>order(id,'2026-10-05T10:00:00+0000')));
    assert.equal(await count(pg,'orders'),56);
    assert.equal(await count(pg,'skipped_orders'),0);
  } finally { delete process.env.RENTIA_BILLING_ENFORCED; }
});

test('an active trial has no limit even with billing enforced',async()=>{
  process.env.RENTIA_BILLING_ENFORCED='1';
  try {
    const pg=await store('trialing','2099-01-01T00:00:00.000Z');
    await database.upsertOrders('s','tiendanube',Array.from({length:70},(_,i)=>order(`o${i}`,'2026-10-02T10:00:00+0000')));
    assert.equal(await count(pg,'orders'),70);
  } finally { delete process.env.RENTIA_BILLING_ENFORCED; }
});
