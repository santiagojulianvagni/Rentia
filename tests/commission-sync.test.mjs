import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {merchantCommissionCost} from '../lib/tiendanube-commissions.ts';
import {tiendanubeFetch,tiendanubeRetryDelay} from '../lib/tiendanube-http.ts';
import {rentiaInvitationUrl} from '../lib/invitation-url.ts';

test('historical missing commissions are revisited once per run without touching real fees or other tenants',()=>{
  const source=readFileSync(new URL('../db/database.ts',import.meta.url),'utf8');
  const sql=source.split('export async function getOrdersAwaitingSourceCommission')[1].match(/prepare\("([^"]+)"\)/)[1];
  const db=new DatabaseSync(':memory:');
  db.exec('CREATE TABLE orders (user_id TEXT,provider TEXT,external_order_id TEXT,currency TEXT,payment_status TEXT,status TEXT,source_commission_cost REAL,source_commission_checked_at TEXT,source_created_at TEXT)');
  const insert=db.prepare('INSERT INTO orders VALUES (?,?,?,?,?,?,?,?,?)');
  const old='2026-09-30T14:00:00.000Z',cutoff='2026-09-30T19:00:00.000Z',checked='2026-09-30T19:00:01.000Z';
  for(let id=0;id<374;id++)insert.run('naturae','tiendanube',String(id),'ARS','paid','open',id<322?100:null,old,old);
  insert.run('other','tiendanube','other','ARS','paid','open',null,old,old);
  insert.run('naturae','tiendanube','cancelled','ARS','paid','cancelled',null,old,old);
  insert.run('naturae','tiendanube','unpaid','ARS','pending','open',null,old,old);
  insert.run('naturae','tiendanube','free','ARS','paid','open',0,old,old);
  const select=db.prepare(sql),visited=[];
  const update=db.prepare('UPDATE orders SET source_commission_checked_at=? WHERE user_id=? AND external_order_id=?');
  for(;;){
    const batch=select.all('naturae','tiendanube',cutoff,20);
    if(!batch.length)break;
    visited.push(batch.length);
    for(const row of batch)update.run(checked,'naturae',row.external_order_id);
  }
  assert.deepEqual(visited,[20,20,12]);
  assert.equal(select.all('naturae','tiendanube',cutoff,100).length,0);
  assert.equal(select.all('naturae','tiendanube','2026-09-30T20:00:00.000Z',100).length,52);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM orders WHERE user_id='naturae' AND source_commission_cost=100").get().n,322);
  assert.equal(db.prepare("SELECT source_commission_checked_at AS checked FROM orders WHERE user_id='other'").get().checked,old);
  db.close();
});

test('real merchant costs include financing and tax but exclude consumer charges and other currencies',()=>{
  const charge=(type,value,currency='ARS')=>({type,amount:{value,currency}});
  const transaction={status:'paid',info:{merchant_charges:[charge('payment_processing_fee',3000),charge('financing_cost',700),charge('tax',576.14),charge('other',99,'USD')],consumer_charges:[charge('financing_cost',1500)]}};
  assert.equal(merchantCommissionCost([transaction],'ARS'),4276.14);
  assert.equal(merchantCommissionCost([{status:'paid',info:{merchant_charges:[]}}],'ARS'),0);
  assert.equal(merchantCommissionCost([{status:'paid',info:{}}],'ARS'),null);
  assert.equal(merchantCommissionCost([{...transaction,status:'pending'}],'ARS'),null);
});

test('rate limit pauses are bounded and a transient failure is retried',async()=>{
  const original=globalThis.fetch,calls=[];
  globalThis.fetch=async(_url,init)=>{calls.push({at:Date.now(),signal:init.signal});return new Response('{}',{status:calls.length===1?429:200,headers:{'retry-after':'1'}});};
  try{
    const response=await tiendanubeFetch('rate-test','https://example.test/orders');
    assert.equal(response.status,200);assert.equal(calls.length,2);
    assert.ok(calls[1].at-calls[0].at>=950);
    assert.ok(calls.every(call=>call.signal instanceof AbortSignal));
    assert.equal(tiendanubeRetryDelay(new Response('',{status:429,headers:{'retry-after':'99999'}})),20000);
  }finally{globalThis.fetch=original;}
});

test('concurrent requests for a store are spaced, not fired in a burst',async()=>{
  const original=globalThis.fetch,calls=[];
  globalThis.fetch=async()=>{calls.push(Date.now());return new Response('{}');};
  try{
    // Medido desde el inicio: una demora por carga solo puede atrasar un pedido, nunca adelantarlo.
    const start=Date.now();
    await Promise.all([1,2,3].map(()=>tiendanubeFetch('concurrent-test','https://example.test/orders')));
    calls.sort((x,y)=>x-y);
    assert.ok(calls[1]-start>=500,'second request waited');assert.ok(calls[2]-start>=1000,'third request waited');
  }finally{globalThis.fetch=original;}
});

test('invitation redirect points to the absolute Rentia acceptance route, not the Clerk portal',()=>{
  const url=new URL(rentiaInvitationUrl('https://rentia-ecommerce.scardullacatalina.chatgpt.site/','org_test'));
  assert.equal(url.origin,'https://rentia-ecommerce.scardullacatalina.chatgpt.site');
  assert.equal(url.pathname,'/invitacion');assert.equal(url.searchParams.get('organization_id'),'org_test');
  assert.throws(()=>rentiaInvitationUrl('/panel','org_test'));
  assert.throws(()=>rentiaInvitationUrl('http://untrusted.test','org_test'));
});
