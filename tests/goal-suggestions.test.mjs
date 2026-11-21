import test from 'node:test';
import assert from 'node:assert/strict';
import {niceAmount,closedMonths,goalSuggestions,nextGoal} from '../lib/goal-suggestions.ts';

const money=value=>`$ ${Math.round(value).toLocaleString('es-AR')}`;
const month=(prefix,total)=>[{date:`${prefix}-10`,orders:5,revenue:total/2},{date:`${prefix}-20`,orders:5,revenue:total/2}];

test('goals are rounded up to easy numbers',()=>{
  assert.equal(niceAmount(1234567),1250000);
  assert.equal(niceAmount(318000),320000);
  assert.equal(niceAmount(5400000),5500000);
  assert.equal(niceAmount(1000000),1000000);
  assert.equal(niceAmount(0),0);
});

test('suggestions come from the closed months: keep the pace, grow and beat the record',()=>{
  const days=[...month('2026-07',800000),...month('2026-08',1000000),...month('2026-09',900000),...month('2026-10',1100000),...month('2026-11',300000)];
  assert.deepEqual(closedMonths(days,'2026-11-21').map(([key])=>key),['2026-07','2026-08','2026-09','2026-10']);
  const list=goalSuggestions(days,'2026-11-21',1200000,money);
  // Promedio de ago-oct: 1.000.000. Crecer: máx(1.150.000, 1.210.000) → 1.250.000. El récord (1.155.000) queda abajo y no se ofrece.
  assert.deepEqual(list.map(item=>[item.key,item.amount,item.recommended]),[['ritmo',1000000,false],['crecer',1250000,true]]);
  const steady=goalSuggestions([...month('2026-08',1000000),...month('2026-09',1000000),...month('2026-10',1000000),...month('2026-06',1500000)],'2026-11-21',0,money);
  assert.deepEqual(steady.map(item=>[item.key,item.amount]),[['ritmo',1000000],['crecer',1150000],['record',1600000]]);
  // Un mes excepcional muy lejano (27 veces el ritmo) no se ofrece como meta.
  const far=goalSuggestions([...month('2026-05',7200000),...month('2026-08',280000),...month('2026-09',280000),...month('2026-10',280000)],'2026-11-21',0,money);
  assert.deepEqual(far.map(item=>item.key),['ritmo','crecer']);
  const growing=goalSuggestions([...month('2026-08',500000),...month('2026-09',600000),...month('2026-10',2000000)],'2026-11-21',0,money);
  assert.deepEqual(growing.map(item=>[item.key,item.amount,item.recommended]),[['ritmo',1050000,false],['crecer',2200000,true]]);
});

test('without closed months the base is this month projection, and nothing without sales',()=>{
  const list=goalSuggestions(month('2026-11',300000),'2026-11-21',450000,money);
  assert.deepEqual(list.map(item=>[item.key,item.amount]),[['ritmo',450000],['crecer',550000]]);
  assert.deepEqual(goalSuggestions([],'2026-11-21',0,money),[]);
});

test('when the goal is reached the next one is a step above',()=>{
  assert.equal(nextGoal(1000000,1050000),1300000);
  assert.equal(nextGoal(270000,250000),330000);
});
