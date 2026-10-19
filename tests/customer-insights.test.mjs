import test from 'node:test';
import assert from 'node:assert/strict';
import {argentinaSlot,customerInsights,paymentLabel} from '../lib/customer-insights.ts';
import {customerKey,placeName,tiendanubeCategories,tiendanubeOrderExtras} from '../lib/order-customer.ts';

const order=(values)=>({provider:'tiendanube',customerKey:null,firstOrderAt:null,province:null,city:null,shippingMethod:null,paymentMethod:null,paymentType:null,installments:null,createdAt:'2026-10-05T15:00:00.000Z',total:1000,storefront:'store',...values});

test('Tiendanube orders keep only an anonymous customer code plus where and how they ship',()=>{
  const extras=tiendanubeOrderExtras({customer:{id:123,email:'ana@example.com',name:'Ana'},shipping_address:{province:'BUENOS AIRES',city:'la plata'},shipping_option:'Correo Argentino - Clásico',storefront:'store'});
  assert.equal(extras.customerKey,customerKey('tiendanube','123'));
  assert.equal(extras.customerKey.length,24);
  assert.ok(!JSON.stringify(extras).includes('ana@example.com')&&!JSON.stringify(extras).includes('Ana'));
  assert.equal(extras.province,'Buenos Aires');
  assert.equal(extras.city,'La Plata');
  assert.equal(extras.shippingMethod,'Correo Argentino - Clásico');
  assert.equal(tiendanubeOrderExtras({shipping_pickup_type:'pickup'}).shippingMethod,'Retiro en el local');
  assert.equal(tiendanubeOrderExtras({}).customerKey,null);
  assert.equal(placeName('ciudad autónoma de buenos aires'),'Ciudad Autónoma de Buenos Aires');
  assert.deepEqual(tiendanubeCategories({categories:[{name:{es:'Remeras'}},{name:{es:'Verano'}},{name:{es:'Remeras'}}]}),['Remeras','Verano']);
});

test('new and returning customers, places, payments and the purchase heatmap',()=>{
  const orders=[
    order({customerKey:'a',firstOrderAt:'2026-10-02T10:00:00Z',province:'Córdoba',city:'Córdoba',paymentType:'credit_card',installments:3,total:3000}),
    order({customerKey:'a',firstOrderAt:'2026-10-02T10:00:00Z',province:'Córdoba',city:'Córdoba',paymentType:'credit_card',installments:1,total:1000}),
    order({customerKey:'b',firstOrderAt:'2026-03-01T10:00:00Z',province:'Buenos Aires',city:'La Plata',paymentMethod:'pago-nube',shippingMethod:'Retiro en el local',total:2000}),
    order({provider:'mercadolibre',paymentType:'account_money',createdAt:'2026-10-06T02:30:00Z',total:500}),
  ];
  const result=customerInsights(orders,'2026-10-01T00:00:00Z');
  assert.deepEqual([result.customers.total,result.customers.newCount,result.customers.returningCount,result.customers.repeatInPeriod],[2,1,1,1]);
  assert.equal(result.customers.newRevenue,4000);
  assert.equal(result.totals.coverage,.75);
  assert.equal(result.provinces[0].name,'Córdoba');
  assert.equal(result.provinces[0].orders,2);
  assert.deepEqual(result.payments.map(row=>row.name),['Tarjeta de crédito','Pago Nube','Dinero en cuenta']);
  assert.deepEqual(result.installments.map(row=>row.name).sort(),['1 pago','3 cuotas']);
  // 2026-10-05 15:00 UTC es lunes 12:00 en Argentina; 2026-10-06 02:30 UTC es lunes 23:30.
  assert.equal(result.heat[0][12].orders,3);
  assert.equal(result.heat[0][23].orders,1);
  assert.deepEqual(result.best,{day:'Lunes',hour:12});
});

test('payment names and Argentine time slots',()=>{
  assert.equal(paymentLabel({paymentType:null,paymentMethod:'mercadopago'}),'Mercado Pago');
  assert.equal(paymentLabel({paymentType:'bank_transfer',paymentMethod:null}),'Transferencia');
  assert.deepEqual(argentinaSlot('2026-10-04T02:00:00Z'),{weekday:5,hour:23});
});
