import test from 'node:test';
import assert from 'node:assert/strict';
import {compareEvent,eventWindows,validEventDates} from '../lib/sales-events.ts';

const money=value=>`$${Math.round(value)}`;
const metrics=(revenue,orders,profitBeforeAds,ads,fixed=0)=>({revenue,orders,profitBeforeAds,totalAdSpend:ads,profit:profitBeforeAds-ads-fixed,fixedCosts:fixed});

test('the normal baseline skips the week before the event and the next week waits until it ends',()=>{
  const windows=eventWindows('2026-11-02','2026-11-04','2026-11-20');
  assert.deepEqual(windows.event,{start:'2026-11-02',end:'2026-11-04',days:3});
  // 28 días que terminan 8 días antes del inicio: se saltea la semana previa.
  assert.deepEqual(windows.baseline,{start:'2026-09-28',end:'2026-10-25',days:28});
  assert.deepEqual(windows.after,{start:'2026-11-05',end:'2026-11-11',days:7});
  assert.equal(eventWindows('2026-11-02','2026-11-04','2026-11-08').after,null);
  assert.equal(eventWindows('2026-11-02','2026-11-04','2026-11-03').finished,false);
});

test('event dates must be real days, in order, and at most a month long',()=>{
  assert.ok(validEventDates('2026-05-11','2026-05-13'));
  assert.ok(!validEventDates('2026-05-13','2026-05-11'));
  assert.ok(!validEventDates('2026-02-30','2026-03-01'));
  assert.ok(!validEventDates('2026-01-01','2026-03-01'));
});

test('an event that sells more and earns more reports the extra profit against normal days',()=>{
  // 28 días normales: $2.800.000 en ventas, 40% de margen, $280.000 de publicidad → $100.000 por día de ventas.
  const result=compareEvent({event:metrics(900000,60,360000,120000,30000),baseline:metrics(2800000,280,1120000,280000,280000),eventDays:3,money});
  const sales=result.rows.find(row=>row.key==='revenue');
  assert.equal(sales.normal,300000);
  assert.equal(Math.round(sales.change),200);
  // Ganancia antes de fijos: evento 360.000−120.000=240.000; normal (1.120.000−280.000)/28×3=90.000.
  assert.equal(result.extra,150000);
  assert.equal(result.verdict.tone,'good');
  assert.match(result.verdict.title,/\$150000 más/);
});

test('selling more with deeper discounts can earn less, and the following week shows pulled-forward sales',()=>{
  const result=compareEvent({event:metrics(600000,50,90000,80000),baseline:metrics(2800000,280,1120000,280000),after:metrics(400000,35,150000,40000),eventDays:3,money});
  assert.equal(result.verdict.tone,'warn');
  assert.ok(result.notes.some(note=>/margen antes de publicidad bajó de 40% a 15%/.test(note)));
  // Semana normal: (1.120.000−280.000)/28×7=210.000; la siguiente ganó 110.000 → 48% menos.
  assert.match(result.after.text,/48% menos/);
});

test('without sales before the event there is nothing to compare',()=>{
  const result=compareEvent({event:metrics(500000,20,200000,50000),baseline:metrics(0,0,0,0),eventDays:3,money});
  assert.equal(result.verdict.tone,'neutral');
});
