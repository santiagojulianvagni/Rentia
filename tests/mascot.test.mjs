import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyGreeting,liveRecords,recordText,momentOf,todayInArgentina} from '../lib/mascot.ts';

const money=value=>`$ ${Math.round(value).toLocaleString('es-AR')}`;
const text=greeting=>greeting.pieces.map(piece=>piece.text).join('');
// Días seguidos con ventas que terminan el día anterior a `end`.
function history(end,count,revenue=100000,orders=3) {
  const list=[];const last=Date.parse(`${end}T00:00:00Z`);
  for(let i=count;i>=1;i--)list.push({date:new Date(last-i*86400000).toISOString().slice(0,10),orders,revenue});
  return list;
}

test('the greeting follows the same hours as the panel header',()=>{
  assert.equal(momentOf(5),'morning');assert.equal(momentOf(11),'morning');
  assert.equal(momentOf(12),'afternoon');assert.equal(momentOf(19),'afternoon');
  assert.equal(momentOf(20),'night');assert.equal(momentOf(3),'night');
  assert.equal(todayInArgentina(new Date('2026-11-21T02:30:00Z')),'2026-11-20');
});

test('the morning greeting compares yesterday with the same weekday of last week',()=>{
  // 2026-11-20 es viernes: ayer jueves 19, el jueves anterior 12.
  const days=[{date:'2026-11-12',orders:20,revenue:400000},{date:'2026-11-19',orders:23,revenue:480000}];
  const greeting=dailyGreeting(days,'2026-11-20',9,'es',money);
  assert.equal(greeting.pose,'saluda');
  assert.equal(text(greeting),'Ayer vendiste $ 480.000 en 23 órdenes, 20 % más que el jueves pasado.');
  assert.equal(greeting.pieces.find(piece=>piece.tone).tone,'up');
  assert.match(text(dailyGreeting(days,'2026-11-20',9,'en',money)),/^Yesterday you sold \$ 480\.000 in 23 orders, 20% more than last Thursday\.$/);
});

test('afternoon and night greetings talk about today, and say nothing without sales history',()=>{
  const days=[{date:'2026-11-13',orders:5,revenue:300000},{date:'2026-11-20',orders:1,revenue:50000}];
  assert.equal(text(dailyGreeting(days,'2026-11-20',15,'es',money)),'Hoy llevás $ 50.000 en 1 orden. El viernes pasado cerraste con $ 300.000.');
  const night=dailyGreeting(days,'2026-11-20',22,'es',money);
  assert.equal(night.pose,'duerme');
  assert.equal(text(night),'Hoy llevás $ 50.000 vendidos. Mañana te cuento cómo cerró el día.');
  assert.equal(text(dailyGreeting([{date:'2026-11-18',orders:2,revenue:1000}],'2026-11-20',15,'es',money)),'Todavía no entró ninguna venta hoy.');
  assert.equal(dailyGreeting([],'2026-11-20',9,'es',money),null);
});

test('a best day only counts with enough history and beats every previous day',()=>{
  const past=history('2026-11-20',20,100000);
  assert.deepEqual(liveRecords([...past,{date:'2026-11-20',orders:9,revenue:150000}],'2026-11-20').map(r=>r.kind),['day']);
  assert.deepEqual(liveRecords([...past,{date:'2026-11-20',orders:2,revenue:90000}],'2026-11-20'),[]);
  // Con poco historial no hay récord.
  assert.deepEqual(liveRecords([...history('2026-11-20',5),{date:'2026-11-20',orders:9,revenue:900000}],'2026-11-20').filter(r=>r.kind==='day'),[]);
  // Si ayer fue el mejor día y hoy no, festeja lo de ayer.
  const yesterday=liveRecords([...history('2026-11-19',20),{date:'2026-11-19',orders:9,revenue:500000}],'2026-11-20');
  assert.equal(yesterday.find(r=>r.kind==='yesterday').id,'day-2026-11-19');
});

test('order milestones, best week and best month are detected and worded',()=>{
  const days=[...history("2026-11-20",120,10000,0),{date:"2026-11-20",orders:120,revenue:2000000}];
  const records=liveRecords(days,'2026-11-20');
  assert.deepEqual(records.map(r=>r.kind),['orders','month','week','day']);
  assert.equal(records[0].id,'orders-100');
  const milestone=recordText(records[0],'2026-11-20','es',money);
  assert.equal(milestone.title,'¡Llegaste a las 100 ventas!');
  assert.equal(recordText(records[1],'2026-11-20','es',money).title,'Noviembre ya es tu mejor mes');
  assert.equal(recordText(records[3],'2026-11-20','es',money).tag,'¡NUEVO RÉCORD!');
});
