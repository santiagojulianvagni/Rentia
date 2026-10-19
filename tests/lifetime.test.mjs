import test from 'node:test';
import assert from 'node:assert/strict';
import {acquisitionCheck,lifetimeValue} from '../lib/lifetime.ts';

const order=(customerKey,createdAt,total)=>({customerKey,createdAt,total});
const orders=[
  // Ana: compra en julio, vuelve a los 20 días y otra vez en septiembre.
  order('ana','2026-07-05T12:00:00Z',10000),order('ana','2026-07-25T12:00:00Z',5000),order('ana','2026-09-10T12:00:00Z',5000),
  // Beto: una sola compra en julio.
  order('beto','2026-07-15T12:00:00Z',8000),
  // Caro: compra en agosto y vuelve en agosto mismo (a los 10 días).
  order('caro','2026-08-01T12:00:00Z',6000),order('caro','2026-08-11T12:00:00Z',6000),
  // Dani: cliente nuevo de octubre.
  order('dani','2026-10-10T12:00:00Z',4000),
];

test('lifetime value, repeat rate, time between purchases and repurchase windows',()=>{
  const result=lifetimeValue(orders,{now:'2026-10-19T00:00:00Z',periodStart:'2026-10-01T00:00:00Z',periodEnd:'2026-11-01T00:00:00Z'});
  assert.equal(result.customers,4);
  assert.equal(result.revenue,44000);
  assert.equal(result.averageValue,11000);
  assert.equal(result.medianValue,10000);
  assert.equal(result.repeatRate,.5);
  assert.equal(Math.round(result.repeatRevenueShare*100),73);
  // Días entre compras de quienes volvieron: 20, 47 y 10 → mediana 20.
  assert.equal(result.daysBetween,20);
  // A 30 días: de Ana, Beto y Caro (Dani es reciente) volvieron Ana y Caro.
  const thirty=result.repurchase.find(item=>item.days===30);
  assert.equal(thirty.eligible,3);assert.equal(Math.round(thirty.rate*100),67);
  assert.equal(result.newInPeriod,1);
  assert.deepEqual(result.frequency.map(item=>item.customers),[2,1,1,0]);
});

test('cohorts show who came back each month and the value accumulated per customer',()=>{
  const {cohorts}=lifetimeValue(orders,{now:'2026-10-19T00:00:00Z'});
  assert.deepEqual(cohorts.map(cohort=>[cohort.month,cohort.customers]),[['2026-10',1],['2026-08',1],['2026-07',2]]);
  const july=cohorts.find(cohort=>cohort.month==='2026-07');
  // Julio: Ana volvió en el mismo mes (offset 0) y en septiembre (offset 2).
  assert.deepEqual(july.months.map(month=>month.returning),[1,0,1,0]);
  assert.equal(july.months[0].valuePerCustomer,11500);
  assert.equal(july.months[3].valuePerCustomer,14000);
});

test('what you can spend to win a customer',()=>{
  const check=acquisitionCheck({averageValue:20000,marginBeforeAds:.4,adSpend:30000,newCustomers:10});
  assert.equal(check.lifetimeProfit,8000);assert.equal(check.costPerCustomer,3000);assert.equal(Math.round(check.ratio*100)/100,2.67);
  assert.equal(acquisitionCheck({averageValue:1,marginBeforeAds:null,adSpend:0,newCustomers:0}).ratio,null);
});
