import test from 'node:test';
import assert from 'node:assert/strict';
import {achievementShare,achievementRange} from '../lib/share-achievement.ts';

const money=value=>`$ ${Math.round(value).toLocaleString('es-AR')}`;
const DAY=86400000;
const iso=value=>new Date(value).toISOString().slice(0,10);
const run=(start,count,revenue=()=>100000,orders=()=>2)=>Array.from({length:count},(_,i)=>({date:iso(Date.parse(`${start}T00:00:00Z`)+i*DAY),orders:orders(i),revenue:revenue(i)}));

test('a record without amounts shows how much it beat the previous one, never money',()=>{
  const event={id:'week-2026-04-20',kind:'week',date:'2026-04-24',value:5300000,previous:4500000,previousDate:'2026-04-13'};
  const share=achievementShare(event,run('2026-04-20',7),'2026-11-20',money,{product:{name:'Sérum facial',units:42,profit:380000,image:'/api/products/image?x'}});
  assert.equal(share.title,'Mi mejor semana');
  assert.equal(share.privateValue,'+18 %');
  assert.equal(share.achievement.privateSubtitle,'más que mi récord anterior');
  assert.equal(share.value,'$ 5.300.000');
  assert.equal(share.achievement.product.privateDetail,'42 vendidos');
  assert.equal(share.image,'/api/products/image?x');
  // Con producto estrella va un solo dato extra, y sin montos ninguno muestra plata.
  assert.equal(share.stats.length,1);
  for(const stat of share.stats)assert.doesNotMatch(stat.privateValue,/\$/);
  assert.deepEqual(achievementRange(event,'2026-11-20'),{start:'2026-04-20',end:'2026-04-26'});
});

test('records compare with the same period a year before when there is history',()=>{
  const days=[...run('2025-04-01',30,()=>50000),...run('2026-04-01',30,()=>100000)];
  const share=achievementShare({id:'month-2026-04',kind:'month',date:'2026-04-20',value:3000000,previous:2000000,previousDate:'2026-03'},days,'2026-11-20',money);
  assert.equal(share.title,'Abril, mi mejor mes');
  assert.deepEqual(share.stats[0],{label:'Contra abril de 2025',value:'+100 %',privateValue:'+100 %'});
});

test('streaks, sales goals and growing weeks get their extra facts',()=>{
  const days=run('2026-06-01',30,i=>i===10?900000:100000,()=>3);
  const streak=achievementShare({id:'streak-30',kind:'streak',date:'2026-06-30',value:30,previous:null,previousDate:null},days,'2026-11-20',money);
  assert.equal(streak.privateValue,'30 días');
  assert.deepEqual(streak.stats.map(s=>[s.label,s.privateValue]),[['En la racha','90 órdenes'],['Mejor día de la racha','11 de junio']]);
  const goal=achievementShare({id:'orders-1000',kind:'orders',date:'2026-06-30',value:1000,previous:null,previousDate:null},days,'2026-11-20',money,{provinces:18});
  assert.equal(goal.title,'Meta cumplida');
  assert.equal(goal.privateValue,'1.000 ventas');
  assert.deepEqual(goal.stats.map(s=>s.privateValue),['29 días','18 provincias']);
  const growth=achievementShare({id:'growth-3-2026-06-28',kind:'growth',date:'2026-06-28',value:3,previous:null,previousDate:null},run('2026-05-25',35,i=>10000*(1+Math.floor(i/7))),'2026-11-20',money);
  assert.equal(growth.stats[0].label,'Crecimiento en la racha');
  assert.equal(growth.stats[0].privateValue,'+150 %');
});
