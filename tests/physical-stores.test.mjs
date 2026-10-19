import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {createTestDatabase} from './helpers/postgres.mjs';

// Locales físicos: cada local guarda sus días por separado de los demás y de la facturación
// externa de antes; importar un archivo solo reemplaza los días que trae.
registerHooks({resolve(specifier,context,next){
  try{return next(specifier,context);}catch(error){
    if(error.code==='ERR_MODULE_NOT_FOUND'&&specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return next(`${specifier}.ts`,context);
    throw error;
  }
}});
const {setDatabase}=await import('../db/client.ts');
const database=await import('../db/database.ts');

test('stores keep their own days, imports replace only the file days, and old external revenue can be adopted',async()=>{
  const {pg,driver}=await createTestDatabase();setDatabase(driver);
  await pg.query("INSERT INTO accounts (user_id,email,owner_name,store_name,trial_started_at,created_at,updated_at) VALUES ('s','s@example.invalid','Owner','Store','2026-08-01','2026-08-01','2026-08-01')");
  // Facturación externa de antes, sin local.
  await database.saveExternalRevenueMonth('s','2026-09',[{revenueDate:'2026-09-01',orderCount:2,revenue:1000,currency:'ARS'}]);

  const palermo=await database.createPhysicalStore('s',{name:'Palermo',costPercent:40,feePercent:3,taxPercent:0});
  const belgrano=await database.createPhysicalStore('s',{name:'Belgrano',costPercent:35,feePercent:0,taxPercent:0});
  assert.equal(await database.createPhysicalStore('s',{name:'Palermo',costPercent:1,feePercent:1,taxPercent:1}),null,'names are unique per store');

  // El mismo día puede tener ventas en los dos locales.
  await database.importStoreSales('s',palermo.id,[{date:'2026-10-01',orders:5,revenue:50000,productCost:null},{date:'2026-10-02',orders:4,revenue:40000,productCost:16000}]);
  await database.importStoreSales('s',belgrano.id,[{date:'2026-10-01',orders:1,revenue:9000,productCost:null}]);
  // Reimportar un día lo reemplaza sin tocar el resto.
  await database.importStoreSales('s',palermo.id,[{date:'2026-10-02',orders:6,revenue:60000,productCost:null}]);
  const october=await database.getExternalRevenue('s','2026-10-01','2026-10-31',palermo.id);
  assert.deepEqual(october.results.map(row=>[row.revenue_date,Number(row.order_count),Number(row.revenue)]),[['2026-10-01',5,50000],['2026-10-02',6,60000]]);

  // Editar el mes a mano de un local conserva el costo importado de cada día.
  await database.saveExternalRevenueMonth('s','2026-10',[{revenueDate:'2026-10-01',orderCount:7,revenue:70000,currency:'ARS',productCost:null}],belgrano.id);
  assert.equal((await database.getExternalRevenue('s','2026-10-01','2026-10-31',palermo.id)).results.length,2,'editing one store never touches another');
  assert.equal((await database.getExternalRevenue('s','2026-09-01','2026-09-30',null)).results.length,1,'old external revenue is untouched');

  // La facturación vieja solo pasa a un local que todavía no tiene ventas.
  assert.equal(await database.adoptExternalRevenue('s',palermo.id),false);
  const nuevo=await database.createPhysicalStore('s',{name:'Showroom',costPercent:0,feePercent:0,taxPercent:0});
  assert.equal(await database.adoptExternalRevenue('s',nuevo.id),true);
  assert.equal((await database.getExternalRevenue('s','2026-09-01','2026-09-30',nuevo.id)).results.length,1);
  const counts=await database.externalRevenueCounts('s');
  assert.equal(counts.find(item=>item.storeId===null),undefined,'nothing is left without a store');

  // Borrar un local borra sus ventas.
  assert.equal(await database.deletePhysicalStore('s',belgrano.id),true);
  assert.equal((await pg.query('SELECT COUNT(*) AS total FROM external_revenue WHERE store_id=$1',[belgrano.id])).rows[0].total,0);
  await pg.close();
});

test('a channel can be wholesale without a store, and old cart contacts are erased after 90 days',async()=>{
  const {pg,driver}=await createTestDatabase();setDatabase(driver);
  await pg.query("INSERT INTO accounts (user_id,email,owner_name,store_name,trial_started_at,created_at,updated_at) VALUES ('s','s@example.invalid','Owner','Store','2026-08-01','2026-08-01','2026-08-01')");
  const wholesale=await database.createPhysicalStore('s',{name:'Mayorista',kind:'mayorista',costPercent:55,feePercent:0,taxPercent:3});
  assert.equal(wholesale.kind,'mayorista');
  assert.equal((await database.createPhysicalStore('s',{name:'Local',costPercent:40,feePercent:0,taxPercent:0})).kind,'local');
  const cart=(id,createdAt)=>({externalId:id,createdAt,completedAt:null,total:1000,currency:'ARS',units:1,items:[],contactEncrypted:'cifrado',contactIv:'iv'});
  await database.upsertAbandonedCarts('s','tiendanube',[cart('viejo','2026-06-01T10:00:00Z'),cart('nuevo','2026-10-15T10:00:00Z')]);
  // Una actualización sin contacto no borra el que ya estaba guardado.
  await database.upsertAbandonedCarts('s','tiendanube',[{...cart('nuevo','2026-10-15T10:00:00Z'),contactEncrypted:null,contactIv:null}]);
  await database.purgeOldCartContacts('s',Date.parse('2026-10-19T00:00:00Z'));
  const rows=(await pg.query('SELECT external_id,contact_encrypted FROM abandoned_checkouts ORDER BY external_id')).rows;
  assert.deepEqual(rows.map(row=>[row.external_id,row.contact_encrypted]),[['nuevo','cifrado'],['viejo',null]]);
  await pg.close();
});
