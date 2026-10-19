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

test('the contact for recovering a cart and a ready WhatsApp message',async()=>{
  const {checkoutContact,whatsappLink,recoveryMessage}=await import('../lib/abandoned-carts.ts');
  assert.deepEqual(checkoutContact({contact_name:'Ana Pérez',contact_email:'ana@example.com',contact_phone:'011 15-5555-0000',abandoned_checkout_url:'https://tienda.com/checkout/v3/abc'}),{name:'Ana Pérez',email:'ana@example.com',phone:'011 15-5555-0000',recoveryUrl:'https://tienda.com/checkout/v3/abc'});
  assert.equal(checkoutContact({abandoned_checkout_url:'javascript:alert(1)'}),null);
  assert.equal(whatsappLink('11 5555 0000','hola'),'https://wa.me/5491155550000?text=hola');
  assert.equal(whatsappLink('+54 11 5555 0000','hola'),'https://wa.me/5491155550000?text=hola');
  assert.equal(whatsappLink('011 15-5555-0000','hola'),'https://wa.me/5491155550000?text=hola');
  assert.equal(whatsappLink('0351 15 555-0000','hola'),'https://wa.me/5493515550000?text=hola');
  assert.equal(whatsappLink('123',''),null);
  assert.match(recoveryMessage('Naturae','Ana Pérez','https://t.co/x'),/^¡Hola Ana! Te escribimos de Naturae\..*https:\/\/t\.co\/x/);
});

test('contacted carts go last, and a later payment counts as recovered after the message',()=>{
  const base={currency:'ARS',units:1,items:[]};
  const summary=cartSummary([
    {...base,externalId:'a',createdAt:'2026-10-10T10:00:00Z',completedAt:null,total:1000,contactedAt:'2026-10-10T12:00:00Z',contactedBy:'Santi',contactedVia:'whatsapp'},
    {...base,externalId:'b',createdAt:'2026-10-09T10:00:00Z',completedAt:null,total:2000},
    {...base,externalId:'c',createdAt:'2026-10-08T10:00:00Z',completedAt:'2026-10-08T20:00:00Z',total:3000,contactedAt:'2026-10-08T12:00:00Z'},
  ],10);
  assert.deepEqual(summary.recent.map(cart=>cart.externalId),['b','a']);
  assert.deepEqual([summary.contacted,summary.pendingContact,summary.recoveredAfterContact,summary.recoveredValue],[2,1,1,3000]);
});
