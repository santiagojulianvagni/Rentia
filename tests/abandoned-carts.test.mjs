import test from 'node:test';
import assert from 'node:assert/strict';
import {cartSummary,normalizeTiendanubeCheckout} from '../lib/abandoned-carts.ts';

test('a Tiendanube checkout is stored without any contact data',()=>{
  const cart=normalizeTiendanubeCheckout({id:77,created_at:'2026-10-10T12:00:00+0000',completed_at:null,total:'15000.00',currency:'ARS',contact_email:'ana@example.com',contact_name:'Ana',contact_phone:'1155550000',abandoned_checkout_url:'https://tienda.com/checkout/v3/abc',
    products:[{name:'Remera',quantity:2,price:'5000',product_id:1,variant_id:11},{name:{es:'Gorra'},quantity:1,price:'5000',product_id:2,variant_id:21}]});
  assert.deepEqual(Object.keys(cart).sort(),['completedAt','createdAt','currency','externalId','items','total','units']);
  assert.ok(!JSON.stringify(cart).includes('ana@example.com')&&!JSON.stringify(cart).includes('1155550000')&&!JSON.stringify(cart).includes('checkout/v3'));
  assert.equal(cart.total,15000);assert.equal(cart.units,3);assert.equal(cart.items[1].name,'Gorra');
  assert.equal(normalizeTiendanubeCheckout({created_at:'2026-10-10'}),null);
});

test('the summary counts open carts, money left behind, the abandonment rate and the most abandoned products',()=>{
  const cart=(id,date,total,items,completedAt=null)=>({externalId:id,createdAt:date,completedAt,total,currency:'ARS',units:items.reduce((sum,item)=>sum+item.quantity,0),items});
  const remera={name:'Remera',quantity:1,price:5000,productId:'1',variantId:'11'};
  const gorra={name:'Gorra',quantity:2,price:2000,productId:'2',variantId:'21'};
  const summary=cartSummary([
    cart('a','2026-10-10T12:00:00Z',9000,[remera,gorra]),
    cart('b','2026-10-10T18:00:00Z',5000,[remera]),
    cart('c','2026-10-11T09:00:00Z',4000,[gorra],'2026-10-11T10:00:00Z'),
  ],6);
  assert.deepEqual([summary.count,summary.value,summary.average,summary.recovered],[2,14000,7000,1]);
  assert.equal(summary.rate,.25);
  assert.equal(summary.topProducts[0].name,'Remera');assert.equal(summary.topProducts[0].carts,2);
  assert.deepEqual(summary.daily,[{date:'2026-10-10',carts:2,value:14000}]);
});
