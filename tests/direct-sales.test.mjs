import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {createTestDatabase} from './helpers/postgres.mjs';

// Ventas directas (WhatsApp, Instagram, en persona): entran como órdenes con el costo real del
// catálogo, descuentan el stock de Rentia, lo devuelven al borrarse y no cuentan para el plan.
registerHooks({resolve(specifier,context,next){
  try{return next(specifier,context);}catch(error){
    if(error.code==='ERR_MODULE_NOT_FOUND'&&specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return next(`${specifier}.ts`,context);
    throw error;
  }
}});
const {setDatabase}=await import('../db/client.ts');
const database=await import('../db/database.ts');
const {calculateOrderCosts}=await import('../lib/cost-engine.ts');
const {salesChannelLabel}=await import('../lib/sales-channels.ts');
const {directSaleProfit,directChannelOf}=await import('../lib/direct-sales.ts');

test('a direct sale uses catalog costs, moves Rentia stock and stays out of the plan quota',async()=>{
  const {pg,driver}=await createTestDatabase();setDatabase(driver);
  await pg.query("INSERT INTO accounts (user_id,email,owner_name,store_name,trial_started_at,created_at,updated_at) VALUES ('s','s@example.invalid','Owner','Store','2026-08-01','2026-08-01','2026-08-01')");
  await pg.query("INSERT INTO products (user_id,provider,external_product_id,name,synced_at) VALUES ('s','tiendanube','p1','Deos','2026-11-01')");
  await pg.query("INSERT INTO product_variants (user_id,provider,external_product_id,external_variant_id,sku,price,cost,stock,stock_management,synced_at) VALUES ('s','tiendanube','p1','v1','DEO-1',54999,7000,5,1,'2026-11-01')");
  const variant=(await pg.query("SELECT id FROM product_variants WHERE external_variant_id='v1'")).rows[0].id;

  const now=new Date('2026-11-22T18:00:00.000Z');
  const sale=await database.createDirectSale('s',{date:'2026-11-22',provider:'directa_whatsapp',paymentLabel:'Transferencia',commission:0,shipping:1500,note:'Laura',items:[{variantId:variant,quantity:2,unitPrice:50000}],amount:null,productCost:null},now);
  assert.equal(sale.total,100000);
  assert.equal(sale.orderNumber,'V-1');
  assert.equal(sale.createdAt,now.toISOString(),'a sale from today keeps the real time');
  assert.equal((await pg.query("SELECT stock FROM product_variants WHERE id=$1",[variant])).rows[0].stock,3,'Rentia stock goes down');

  // El costo sale de la variante del catálogo, aunque la orden sea de otro canal.
  const orders=[];for await (const row of database.iterateAnalyticsOrders('s',30,0,{start:'2026-11-01',end:'2026-11-22'}))orders.push(row);
  assert.equal(orders.length,1);
  assert.equal(Number(orders[0].product_cost),14000);
  assert.equal(Number(orders[0].missing_product_costs),0);

  // Otro producto que no es de la tienda: no se guarda nada.
  assert.equal(await database.createDirectSale('s',{date:'2026-11-20',provider:'directa_otro',paymentLabel:'Efectivo',commission:0,shipping:0,note:null,items:[{variantId:999999,quantity:1,unitPrice:10}],amount:null,productCost:null},now),null);
  // Solo el monto, otro día: queda al mediodía de ese día.
  const plain=await database.createDirectSale('s',{date:'2026-11-20',provider:'directa_local',paymentLabel:'Efectivo',commission:0,shipping:0,note:null,items:[],amount:20000,productCost:8000},now);
  assert.equal(plain.createdAt,'2026-11-20T15:00:00.000Z');
  assert.equal(plain.orderNumber,'V-2');

  // No consumen el límite de órdenes del plan.
  assert.equal((await database.getOrderQuota('s',now)).used,0);

  const list=await database.listDirectSales('s');
  assert.deepEqual(list.map(row=>row.order_number),['V-1','V-2']);
  assert.deepEqual(list[0].items,[{name:'Deos',quantity:2,unitPrice:50000}]);

  // Borrar la venta devuelve el stock.
  assert.equal(await database.deleteDirectSale('s',sale.id),true);
  assert.equal((await pg.query("SELECT stock FROM product_variants WHERE id=$1",[variant])).rows[0].stock,5);
  assert.equal(await database.deleteDirectSale('s',sale.id),false);
  assert.equal((await database.listDirectSales('s')).length,1);
});

test('direct sales use the shipping the store entered, never the average, and have their own labels',()=>{
  const settings={shipping_cost_ars:8349,shipping_mode:'average_only',commission_percent:5,tax_percent:0};
  const costs=calculateOrderCosts({provider:'directa_whatsapp',total:100000,currency:'ARS',payment_method:'Transferencia',source_shipping_cost:0,manual_commission_cost:0},settings,[]);
  assert.equal(costs.shipping,0);
  assert.equal(costs.commissions,0);
  assert.equal(salesChannelLabel('directa_whatsapp'),'WhatsApp');
  assert.equal(directChannelOf('directa_feria'),'feria');
  assert.equal(directChannelOf('tiendanube'),null);
  const result=directSaleProfit({total:100000,productCost:14000,shipping:1500,commission:0,taxPercent:3});
  assert.equal(result.taxes,3000);
  assert.equal(result.profit,81500);
});
