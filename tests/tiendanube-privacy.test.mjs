import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {createTestDatabase} from './helpers/postgres.mjs';

// Avisos de privacidad de Tiendanube (LGPD): borrar un comprador, pedir sus datos y borrar la tienda.
registerHooks({resolve(specifier,context,next){
  try{return next(specifier,context);}catch(error){
    if(error.code==='ERR_MODULE_NOT_FOUND'&&specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return next(`${specifier}.ts`,context);
    throw error;
  }
}});
const {setDatabase}=await import('../db/client.ts');
const {handleTiendanubePrivacy,isPrivacyTopic}=await import('../lib/tiendanube-privacy.ts');
const {customerKey}=await import('../lib/order-customer.ts');
const {encryptToken}=await import('../lib/token-crypto.ts');
const database=await import('../db/database.ts');

const KEY=Buffer.alloc(32,7).toString('base64');
const now='2026-11-07T10:00:00.000Z';

async function seed() {
  const {pg,driver}=await createTestDatabase();setDatabase(driver);
  await pg.query("INSERT INTO accounts (user_id,email,owner_name,store_name,trial_started_at,created_at,updated_at) VALUES ('s','s@example.invalid','Owner','Store',$1,$1,$1)",[now]);
  await pg.query("INSERT INTO integrations (user_id,provider,external_store_id,encrypted_access_token,token_iv,status,connected_at,updated_at) VALUES ('s','tiendanube','123','x','y','connected',$1,$1)",[now]);
  const ana=customerKey('tiendanube','1');
  for(const [id,key,city] of [['o1',ana,'Rosario'],['o2',null,'Córdoba'],['o3',customerKey('tiendanube','2'),'Mendoza']])
    await pg.query("INSERT INTO orders (user_id,provider,external_order_id,status,payment_status,total,subtotal,discount,source_created_at,synced_at,customer_key,ship_province,ship_city) VALUES ('s','tiendanube',$1,'open','paid',100,100,0,$2,$2,$3,'Santa Fe',$4)",[id,now,key,city]);
  for(const [id,contact] of [['c1',{email:'ANA@example.com',phone:null}],['c2',{email:null,phone:'+54 9 11 5555-0000'}],['c3',{email:'otro@example.com',phone:'1144443333'}]]){
    const sealed=await encryptToken(JSON.stringify(contact),KEY);
    await pg.query("INSERT INTO abandoned_checkouts (user_id,provider,external_id,created_at,total,items_json,synced_at,contact_encrypted,contact_iv) VALUES ('s','tiendanube',$1,$2,10,'[]',$2,$3,$4)",[id,now,sealed.encryptedToken,sealed.iv]);
  }
  return pg;
}

test('only the three privacy topics have an address',()=>{
  assert.ok(isPrivacyTopic('store-redact')&&isPrivacyTopic('customers-redact')&&isPrivacyTopic('customers-data-request'));
  assert.ok(!isPrivacyTopic('constructor')&&!isPrivacyTopic('order-created'));
});

test('a customer redaction erases the code, the city and the cart contacts of that buyer only',async()=>{
  const pg=await seed();
  const result=await handleTiendanubePrivacy('customers-redact',{store_id:123,customer:{id:1,email:'ana@example.com',phone:'011 15 5555-0000'},orders_to_redact:['o2']},{TOKEN_ENCRYPTION_KEY:KEY});
  assert.deepEqual([result.orders,result.carts],[2,2]);
  const orders=(await pg.query("SELECT external_order_id,customer_key,ship_city,ship_province FROM orders ORDER BY external_order_id")).rows;
  assert.deepEqual(orders.map(o=>[o.external_order_id,Boolean(o.customer_key),o.ship_city,o.ship_province]),[['o1',false,null,'Santa Fe'],['o2',false,null,'Santa Fe'],['o3',true,'Mendoza','Santa Fe']]);
  const carts=(await pg.query("SELECT external_id FROM abandoned_checkouts WHERE contact_encrypted IS NOT NULL")).rows.map(row=>row.external_id);
  assert.deepEqual(carts,['c3']);
  const log=await database.listPrivacyRequests('s');
  assert.equal(log[0].kind,'customers/redact');
  assert.ok(!log[0].result_json.includes('ana@'),'the log keeps no personal data');
});

test('a data request is logged with what Rentia holds, without changing anything',async()=>{
  const pg=await seed();
  const result=await handleTiendanubePrivacy('customers-data-request',{store_id:'123',customer:{id:1,email:'ana@example.com'},orders_requested:['o1'],checkouts_requested:['c1','c9'],data_request:{id:456}},{TOKEN_ENCRYPTION_KEY:KEY});
  assert.deepEqual([result.orders,result.carts,result.cartContacts],[1,1,1]);
  assert.equal((await database.listPrivacyRequests('s'))[0].external_id,'456');
  assert.equal((await pg.query("SELECT COUNT(*)::int AS n FROM abandoned_checkouts WHERE contact_encrypted IS NOT NULL")).rows[0].n,3);
});

test('a store redaction waits for the uninstall, then erases buyer data and the credentials but keeps the sales',async()=>{
  const pg=await seed();
  assert.equal((await handleTiendanubePrivacy('store-redact',{store_id:123})).skipped,'store_reconnected');
  await database.disconnectIntegrationByStore('tiendanube','123');
  const result=await handleTiendanubePrivacy('store-redact',{store_id:123});
  assert.deepEqual([result.orders,result.carts],[3,3]);
  assert.equal((await pg.query("SELECT COUNT(*)::int AS n FROM integrations")).rows[0].n,0);
  assert.equal((await pg.query("SELECT COUNT(*)::int AS n FROM orders WHERE customer_key IS NULL AND ship_city IS NULL")).rows[0].n,3);
  assert.equal((await handleTiendanubePrivacy('store-redact',{store_id:999})).storeKnown,false);
});
