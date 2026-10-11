import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {createTestDatabase} from './helpers/postgres.mjs';

// Al actualizar Meta, el panel nunca debe leer la inversión a medio cargar.
registerHooks({resolve(specifier,context,next){
  try{return next(specifier,context);}catch(error){
    if(error.code==='ERR_MODULE_NOT_FOUND'&&specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return next(`${specifier}.ts`,context);
    throw error;
  }
}});
const {setDatabase}=await import('../db/client.ts');
const database=await import('../db/database.ts');

const campaign={externalId:'c1',name:'Campaña',status:'ACTIVE',effectiveStatus:'ACTIVE',dailyBudget:0,lifetimeBudget:0};
const day=index=>new Date(Date.UTC(2026,6,1+index)).toISOString().slice(0,10);
const insights=(days,spend)=>Array.from({length:days},(_,index)=>({campaignId:'c1',date:day(index),spend,impressions:1,clicks:1,purchases:0,purchaseValue:0}));

test('a Meta sync never exposes a partially loaded spend total',async()=>{
  const {pg,driver}=await createTestDatabase();
  await pg.query("INSERT INTO accounts (user_id,email,owner_name,store_name,trial_started_at,created_at,updated_at) VALUES ('s','s@example.invalid','Owner','Store','2026-08-01','2026-08-01','2026-08-01')");
  const totals=[];
  const total=async()=>Number((await pg.query('SELECT COALESCE(SUM(spend),0) AS total FROM meta_insights_daily')).rows[0].total);
  setDatabase({...driver,transaction:async work=>{const result=await driver.transaction(work);totals.push(await total());return result;}});

  // 80 días con 10 cada uno (800): más de un lote de guardado.
  await database.replaceMetaCampaignsAndInsights('s','act_1',[campaign],insights(80,10),day(0));
  assert.equal(await total(),800);
  await new Promise(resolve=>setTimeout(resolve,5));

  // Meta vuelve a informar 79 de esos días con el mismo gasto: el último ya no existe.
  totals.length=0;
  await database.replaceMetaCampaignsAndInsights('s','act_1',[campaign],insights(79,10),day(0));
  assert.ok(totals.length>1,'the update runs in more than one batch');
  assert.ok(Math.min(...totals)>=790,`the panel saw a partial total: ${totals.join(', ')}`);
  assert.equal(await total(),790);
});
