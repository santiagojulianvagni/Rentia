import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {createTestDatabase} from './helpers/postgres.mjs';

// Cost configuration endpoints against an in-process Postgres.
registerHooks({resolve(specifier,context,next){
  if(/\/lib\/session$/.test(specifier))return {url:'data:text/javascript,export async function getRentiaUser(){return {id:"store-costs",role:"owner"};}export function canManageRentia(){return true;}',shortCircuit:true};
  if(specifier==='next/server')return next('next/server.js',context);
  try{return next(specifier,context);}catch(error){
    if(error.code==='ERR_MODULE_NOT_FOUND'&&specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return next(`${specifier}.ts`,context);
    throw error;
  }
}});
const {setDatabase}=await import('../db/client.ts');
const database=await import('../db/database.ts');
const settingsEndpoint=await import('../app/api/settings/route.ts');
const costsEndpoint=await import('../app/api/costs/products/route.ts');
const archiveEndpoint=await import('../app/api/products/archive/route.ts');
const request=(method,body,headers={})=>new Request('https://rentia.example.invalid/api',{method,headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)});

test('costs for a 1,500-variant catalog, the fallback commission and archiving are saved',async()=>{
  const {pg,driver}=await createTestDatabase();setDatabase(driver);
  await pg.query("INSERT INTO accounts (user_id,email,owner_name,store_name,trial_started_at,created_at,updated_at) VALUES ('store-costs','c@example.invalid','Owner','Store','2026-10-01','2026-10-01','2026-10-01')");

  const saved=await settingsEndpoint.POST(request('POST',{type:'costs',shipping:0,shippingMode:'actual',fees:3,taxes:5,pagoNubePayoutDays:'1',pagoNubePlan:'impulso'}));
  assert.equal(saved.status,200);
  const settings=await database.getSettings('store-costs');
  assert.equal(settings.commission_percent,3);assert.equal(settings.tax_percent,5);assert.equal(settings.pago_nube_payout_days,1);assert.equal(settings.pago_nube_plan_override,'impulso');

  await database.upsertProducts('store-costs','tiendanube',Array.from({length:1500},(_,index)=>({externalId:`p${index}`,name:`Producto ${index}`,imageUrl:null,published:true,createdAt:null,updatedAt:null,variants:[{externalId:`v${index}`,sku:null,price:100,cost:0,stock:1,stockManagement:true}]})));
  const rows=(await database.getProductCostRows('store-costs')).results;
  assert.equal(rows.length,1500);
  const updates=rows.map((row,index)=>({variantId:row.variant_id,manualCost:index%2?null:index+0.5}));
  const response=await costsEndpoint.PUT(request('PUT',{updates}));
  assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true,updated:1500});
  const after=(await database.getProductCostRows('store-costs')).results;
  assert.equal(after.filter(row=>row.manual_cost!==null).length,750);
  assert.equal(after.find(row=>row.variant_id===rows[0].variant_id).manual_cost,0.5);
  assert.equal(after.find(row=>row.variant_id===rows[0].variant_id).cost_source,'manual');

  // Clearing a cost goes back to the store's value.
  await costsEndpoint.PUT(request('PUT',{updates:[{variantId:rows[0].variant_id,manualCost:null}]}));
  assert.equal((await database.getProductCostRows('store-costs')).results.find(row=>row.variant_id===rows[0].variant_id).manual_cost,null);

  const archived=await archiveEndpoint.PATCH(request('PATCH',{productId:rows[1].product_id,archived:true,confirmation:'ARCHIVAR'},{origin:'https://rentia.example.invalid'}));
  assert.equal(archived.status,200);
  assert.equal((await database.getProductCostRows('store-costs')).results.find(row=>row.product_id===rows[1].product_id).rentia_archived,1);
  setDatabase(null);await pg.close();
});
