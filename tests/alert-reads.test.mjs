import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {createTestDatabase} from './helpers/postgres.mjs';

// Alertas vistas u ocultadas: son de cada persona y una oculta no vuelve a aparecer por
// marcar todas como vistas.
registerHooks({resolve(specifier,context,next){
  try{return next(specifier,context);}catch(error){
    if(error.code==='ERR_MODULE_NOT_FOUND'&&specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return next(`${specifier}.ts`,context);
    throw error;
  }
}});
const {setDatabase}=await import('../db/client.ts');
const database=await import('../db/database.ts');

test('each person marks alerts as seen or hidden on their own',async()=>{
  const {pg,driver}=await createTestDatabase();setDatabase(driver);
  await pg.query("INSERT INTO accounts (user_id,email,owner_name,store_name,trial_started_at,created_at,updated_at) VALUES ('s','s@example.invalid','Owner','Store','2026-08-01','2026-08-01','2026-08-01')");
  await database.saveAlertReads('s','owner',['stock:3 SKU','costs:2 SKU sin costo'],'seen');
  await database.saveAlertReads('s','owner',['stock:3 SKU'],'dismissed');
  // Marcar todas como vistas no "desoculta" la que ya estaba oculta.
  const reads=await database.saveAlertReads('s','owner',['stock:3 SKU','costs:2 SKU sin costo'],'seen');
  assert.deepEqual(reads,{'stock:3 SKU':'dismissed','costs:2 SKU sin costo':'seen'});
  assert.deepEqual(await database.getAlertReads('s','admin'),{},'another teammate still sees them as new');
});
