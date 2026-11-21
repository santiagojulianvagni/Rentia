import test from 'node:test';
import assert from 'node:assert/strict';
import {incomeStatement,share,recentMonths,monthRange,previousMonth} from '../lib/income-statement.ts';

test('the income statement ends exactly at the panel profit',()=>{
  const metrics={revenue:1000,refundLoss:20,productCost:350,shipping:80,commissions:40,taxes:60,additional:0,profitBeforeAds:450,totalAdSpend:230,fixedCosts:70,profit:150};
  const lines=incomeStatement(metrics);
  const byKey=Object.fromEntries(lines.map(line=>[line.key,line.amount]));
  assert.equal(byKey.gross,630);
  assert.equal(byKey.beforeAds,450);
  assert.equal(byKey.contribution,220);
  assert.equal(byKey.net,150);
  // Los costos sumados desde la facturación llegan al resultado neto.
  const costs=lines.filter(line=>line.kind==='cost').reduce((sum,line)=>sum+line.amount,0);
  assert.equal(metrics.revenue+costs,byKey.net);
  assert.equal(lines.some(line=>line.key==='additional'),false);
  assert.equal(share(-350,1000),0.35);assert.equal(share(10,0),null);
});

test('months to choose and their date ranges, never past today',()=>{
  assert.deepEqual(recentMonths('2026-02',3),['2026-02','2026-01','2025-12']);
  assert.deepEqual(monthRange('2026-11','2026-11-21'),{start:'2026-11-01',end:'2026-11-21'});
  assert.deepEqual(monthRange('2026-10','2026-11-21'),{start:'2026-10-01',end:'2026-10-31'});
  assert.equal(previousMonth('2026-01'),'2025-12');
});
