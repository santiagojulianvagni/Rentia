import test from 'node:test';
import assert from 'node:assert/strict';
import {achievementHistory,ORDER_MILESTONES} from '../lib/achievement-history.ts';
import {ORDER_MILESTONES as PANEL_MILESTONES} from '../lib/mascot.ts';

test('the achievements page and the panel celebrate the same sales goals',()=>{
  assert.deepEqual(ORDER_MILESTONES,PANEL_MILESTONES);
});

const DAY=86400000;
const iso=value=>new Date(value).toISOString().slice(0,10);
// `count` días seguidos con ventas desde `start`.
const run=(start,count,revenue=(i)=>100000,orders=()=>2)=>Array.from({length:count},(_,i)=>({date:iso(Date.parse(`${start}T00:00:00Z`)+i*DAY),orders:orders(i),revenue:revenue(i)}));

test('without sales there are no achievements and the first goal is 100 sales',()=>{
  const data=achievementHistory([],'2026-11-20');
  assert.deepEqual(data.events,[]);
  assert.deepEqual(data.next,{goal:100,remaining:100,progress:0});
});

test('a best day needs 14 previous days with sales and keeps its date and previous mark',()=>{
  const days=[...run('2026-10-01',20),{date:'2026-10-21',orders:5,revenue:250000}];
  const data=achievementHistory(days,'2026-11-20');
  const best=data.events.filter(event=>event.kind==='day');
  assert.equal(best.length,1);
  assert.deepEqual(best[0],{id:'day-2026-10-21',kind:'day',date:'2026-10-21',value:250000,previous:100000,previousDate:'2026-10-01'});
  assert.deepEqual(data.bestDay,{date:'2026-10-21',value:250000});
  // Un pico en los primeros días no cuenta como récord.
  assert.equal(achievementHistory([...run('2026-10-01',3),{date:'2026-10-04',orders:1,revenue:900000}],'2026-11-20').events.filter(e=>e.kind==='day').length,0);
});

test('order milestones and sales streaks are dated on the day they happen',()=>{
  const data=achievementHistory(run('2026-01-01',40,()=>10000,()=>3),'2026-03-01');
  const milestone=data.events.find(event=>event.id==='orders-100');
  assert.equal(milestone.date,'2026-02-03'); // 34 días × 3 = 102
  assert.deepEqual(data.events.filter(e=>e.kind==='streak').map(e=>[e.value,e.date]),[[30,'2026-01-30'],[7,'2026-01-07']]);
  assert.equal(data.totalOrders,120);
  assert.deepEqual(data.next,{goal:500,remaining:380,progress:20/400});
});

test('best weeks, best months and growing weeks are detected once',()=>{
  // Ventas que crecen todos los días durante 5 meses.
  const days=run('2026-06-01',150,i=>10000+i*1000);
  const data=achievementHistory(days,'2026-11-20');
  const months=data.events.filter(e=>e.kind==='month').map(e=>e.id);
  assert.deepEqual(months,['month-2026-10','month-2026-09']);
  const weeks=data.events.filter(e=>e.kind==='week');
  assert.equal(new Set(weeks.map(e=>e.id)).size,weeks.length);
  assert.ok(weeks.length>5);
  assert.ok(data.events.some(e=>e.kind==='growth'&&e.value===3));
  // El más nuevo primero.
  const dates=data.events.map(e=>e.date);
  assert.deepEqual(dates,[...dates].sort().reverse());
  assert.equal(data.bestMonth.month,'2026-10');
});
