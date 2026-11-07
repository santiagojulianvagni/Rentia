import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){
  try{return next(specifier,context);}catch(error){
    if(error.code==='ERR_MODULE_NOT_FOUND'&&specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return next(`${specifier}.ts`,context);
    throw error;
  }
}});
const {arsAmount,isTestToken,periodEnd,planUsd,statusFromPreapproval,verifyWebhookSignature}=await import('../lib/mercadopago.ts');
const {getPlan}=await import('../lib/plans.ts');

test('the price in pesos comes from the dollar price at the official rate',()=>{
  assert.equal(planUsd(getPlan('starter'),'monthly'),15);
  assert.equal(planUsd(getPlan('starter'),'annual'),150);
  assert.equal(planUsd(getPlan('enterprise'),'monthly'),null);
  assert.equal(arsAmount(15,1452.5),21788);
  assert.equal(arsAmount(0.001,10),15,'Mercado Pago needs at least $15');
  assert.equal(arsAmount(15,0),null);
  assert.ok(isTestToken('TEST-123'));assert.ok(!isTestToken('APP_USR-123'));
});

test('Mercado Pago statuses map to Rentia plan statuses and periods',()=>{
  assert.equal(statusFromPreapproval('authorized'),'active');
  assert.equal(statusFromPreapproval('paused'),'past_due');
  assert.equal(statusFromPreapproval('cancelled'),'canceled');
  assert.equal(statusFromPreapproval('pending'),'pending');
  assert.equal(periodEnd('2026-01-31T10:00:00.000Z','annual'),'2027-01-31T10:00:00.000Z');
  assert.equal(periodEnd('2026-11-07T10:00:00.000Z','monthly'),'2026-12-07T10:00:00.000Z');
});

test('only notifications signed with the webhook secret are accepted',()=>{
  const secret='clave-secreta',ts='1794083000',dataId='ABC123',requestId='req-1';
  const v1=createHmac('sha256',secret).update(`id:abc123;request-id:${requestId};ts:${ts};`).digest('hex');
  const now=Number(ts)*1000+60000;
  assert.ok(verifyWebhookSignature({signature:`ts=${ts},v1=${v1}`,requestId,dataId,secret,now}));
  assert.ok(!verifyWebhookSignature({signature:`ts=${ts},v1=${v1}`,requestId,dataId:'OTRO',secret,now}),'another id');
  assert.ok(!verifyWebhookSignature({signature:`ts=${ts},v1=${v1}`,requestId,dataId,secret:'otra',now}),'another secret');
  assert.ok(!verifyWebhookSignature({signature:`ts=${ts},v1=${v1}`,requestId,dataId,secret,now:now+3600000}),'too old');
  assert.ok(!verifyWebhookSignature({signature:null,requestId,dataId,secret,now}));
});
