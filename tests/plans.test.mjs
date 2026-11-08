import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){
  try{return next(specifier,context);}catch(error){
    if(error.code==='ERR_MODULE_NOT_FOUND'&&specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return next(`${specifier}.ts`,context);
    throw error;
  }
}});
const { RENTIA_PLANS, annualPrice, getPlan, planQuote, recommendedPlan }=await import('../lib/plans.ts');

test('each plan shows its visible history without changing team sizes',()=>{
  assert.deepEqual(RENTIA_PLANS.map(plan=>plan.history),['Últimos 12 meses','Últimos 12 meses','Últimos 24 meses','Últimos 36 meses','Últimos 36 meses','Todo el historial']);
  assert.deepEqual(RENTIA_PLANS.map(plan=>plan.users),[1,2,5,10,20,null]);
});

test('each order-volume boundary recommends the correct existing plan',()=>{
  for(const [orders,id] of [[0,'free'],[50,'free'],[51,'starter'],[300,'starter'],[301,'growth'],[1000,'growth'],[1001,'pro'],[5000,'pro'],[5001,'scale'],[10000,'scale'],[10001,'enterprise']]) {
    assert.equal(recommendedPlan(orders).id,id,`${orders} orders`);
  }
});

test('the monthly explorer keeps all existing monthly prices',()=>{
  assert.deepEqual(RENTIA_PLANS.map(plan=>plan.monthlyPrice),[0,15,39,99,149,null]);
  for(const plan of RENTIA_PLANS) {
    assert.deepEqual(planQuote(plan,false),{total:plan.monthlyPrice,monthlyEquivalent:plan.monthlyPrice,savings:0});
  }
});

test('annual quotes charge ten months and clearly calculate the equivalent and savings',()=>{
  for(const plan of RENTIA_PLANS.filter(plan=>plan.monthlyPrice!==null)) {
    const quote=planQuote(plan,true);
    assert.equal(annualPrice(plan),plan.monthlyPrice*10);
    assert.equal(quote.total,plan.monthlyPrice*10);
    assert.equal(quote.monthlyEquivalent,quote.total/12);
    assert.equal(quote.savings,plan.monthlyPrice*2);
  }
  assert.deepEqual(planQuote(getPlan('growth'),true),{total:390,monthlyEquivalent:32.5,savings:78});
});

test('free remains zero and Enterprise remains a custom quote in both billing cycles',()=>{
  for(const annual of [true,false]) {
    assert.deepEqual(planQuote(getPlan('free'),annual),{total:0,monthlyEquivalent:0,savings:0});
    assert.deepEqual(planQuote(getPlan('enterprise'),annual),{total:null,monthlyEquivalent:null,savings:0});
  }
});
