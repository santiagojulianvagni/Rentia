import test from 'node:test';
import assert from 'node:assert/strict';
import {channelRates,simulateLaunch,priceForMargin} from '../lib/launch-simulator.ts';

// Canal con 100 órdenes: comisiones 10 %, impuestos 5 %, envío promedio $ 2.000, margen 30 %.
const rates=channelRates({orders:100,revenue:1000000,commissions:100000,taxes:50000,additional:0,shipping:200000,profitBeforeAds:300000});

test('the simulator uses the real rates of the channel',()=>{
  assert.deepEqual(rates,{commissionRate:0.1,taxRate:0.05,otherRate:0,shippingPerOrder:2000,marginBeforeAds:0.3,orders:100});
  assert.equal(channelRates({orders:0,revenue:0}),null);
});

test('profit per sale, maximum ad cost and break-even ROAS of a new product',()=>{
  const result=simulateLaunch({price:20000,unitCost:8000,discount:0,freeShipping:true,installmentSurcharge:0},rates);
  // 20.000 − 8.000 − 2.000 (comisión) − 1.000 (impuestos) − 2.000 (envío) = 7.000.
  assert.equal(result.profit,7000);
  assert.equal(result.margin,0.35);
  assert.equal(result.maxCpa,7000);
  assert.ok(Math.abs(result.breakEvenRoas-20000/7000)<1e-9);
  assert.ok(Math.abs(result.vsAverage-0.05)<1e-9);
  const discounted=simulateLaunch({price:20000,unitCost:8000,discount:10,freeShipping:false,installmentSurcharge:5},rates);
  // 18.000 − 8.000 − 1.800 − 900 (cuotas) − 900 = 6.400.
  assert.equal(discounted.price,18000);assert.equal(discounted.profit,6400);
  assert.ok(discounted.lines.some(line=>line.key==='installments'));
  assert.ok(!discounted.lines.some(line=>line.key==='shipping'));
});

test('the price needed for a target margin',()=>{
  const input={price:20000,unitCost:8000,discount:0,freeShipping:true,installmentSurcharge:0};
  const price=priceForMargin(0.4,input,rates);
  // (8.000 + 2.000) / (1 − 0,15 − 0,40) = 22.222 → se redondea a 22.300.
  assert.equal(price,22300);
  assert.ok(simulateLaunch({...input,price},rates).margin>=0.4);
  assert.equal(priceForMargin(0.9,input,rates),null);
});
