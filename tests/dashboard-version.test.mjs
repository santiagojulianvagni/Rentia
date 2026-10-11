import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {createTestDatabase} from './helpers/postgres.mjs';

// El panel recalcula el resumen solo cuando cambia esta versión: tiene que cambiar con
// cualquier dato que entre en la ganancia y quedarse quieta cuando no pasa nada.
registerHooks({resolve(specifier,context,next){
  try{return next(specifier,context);}catch(error){
    if(error.code==='ERR_MODULE_NOT_FOUND'&&specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return next(`${specifier}.ts`,context);
    throw error;
  }
}});
const {setDatabase}=await import('../db/client.ts');
const database=await import('../db/database.ts');

const now=new Date('2026-10-11T15:20:00Z');
const order=(id,createdAt)=>({externalId:id,number:id,currency:'ARS',status:'open',paymentStatus:'paid',paymentMethod:'pago-nube',paymentType:null,paymentInstallments:null,shippingStatus:null,shippingCost:0,total:1000,subtotal:1000,discount:0,createdAt,updatedAt:createdAt,items:[]});
const rule={category:'additional',name:'Alquiler',matchValue:null,calculation:'fixed_monthly',amount:1000,percentage:0,startsAt:null,endsAt:null};
const pause=()=>new Promise(resolve=>setTimeout(resolve,5));

test('the dashboard version changes only when profit inputs change',async()=>{
  const {pg,driver}=await createTestDatabase();setDatabase(driver);
  await pg.query("INSERT INTO accounts (user_id,email,owner_name,store_name,trial_started_at,created_at,updated_at) VALUES ('s','s@example.invalid','Owner','Store','2026-08-01','2026-08-01','2026-08-01')");
  const version=()=>database.getDashboardVersion('s',now);

  const empty=await version();
  assert.equal(await version(),empty,'stable when nothing changes');

  await database.upsertOrders('s','tiendanube',[order('o1','2026-10-02T10:00:00+0000')]);
  const withOrder=await version();
  assert.notEqual(withOrder,empty,'a new order');

  await pause();
  await database.replaceMetaCampaignsAndInsights('s','act_1',[{externalId:'c1',name:'C',status:'ACTIVE',effectiveStatus:'ACTIVE',dailyBudget:0,lifetimeBudget:0}],[{campaignId:'c1',date:'2026-10-02',spend:50,impressions:1,clicks:1,purchases:0,purchaseValue:0}],'2026-10-01');
  const withMeta=await version();
  assert.notEqual(withMeta,withOrder,'new Meta spend');

  await pause();
  await database.createCostRule('s',rule);
  const withRule=await version();
  assert.notEqual(withRule,withMeta,'a new cost');
  const id=Number((await pg.query("SELECT id FROM cost_rules WHERE user_id='s'")).rows[0].id);
  await database.deleteCostRule('s',id);
  assert.notEqual(await version(),withRule,'a deleted cost');

  assert.notEqual(await database.getDashboardVersion('s',new Date('2026-10-11T16:00:00Z')),await version(),'the rolling window moves every hour');
});
