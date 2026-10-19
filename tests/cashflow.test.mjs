import test from 'node:test';
import assert from 'node:assert/strict';
import {cashflow,monthlyFixedCosts,daysInMonth,weeklySchedule,simulate,goalPlan} from '../lib/cashflow.ts';

const rule=(name,amount,extra={})=>({category:'additional',calculation:'fixed_monthly',amount,percentage:0,starts_at:null,ends_at:null,enabled:1,name,...extra});
// Al 10 de octubre: vendiste 100.000 con 60.000 de costos variables (margen 40%).
const metrics={revenue:100000,productCost:40000,shipping:10000,commissions:5000,taxes:0,refundLoss:0,totalAdSpend:5000,orders:20};

test('fixed costs count the days each expense is active in the month',()=>{
  assert.equal(daysInMonth('2026-10'),31);assert.equal(daysInMonth('2026-02'),28);
  const items=monthlyFixedCosts([rule('Alquiler',310000),rule('Nuevo empleado',310000,{starts_at:'2026-10-17'}),rule('Viejo',100,{ends_at:'2026-09-30'}),rule('Apagado',500,{enabled:0})],'2026-10');
  assert.deepEqual(items.map(item=>[item.name,Math.round(item.amount)]),[['Alquiler',310000],['Nuevo empleado',150000]]);
});

test('break-even, what is missing and the month-end projection',()=>{
  const result=cashflow({month:'2026-10',today:'2026-10-10',metrics,rules:[rule('Alquiler',120000)],recentDaily:Array(14).fill(10000)});
  assert.equal(result.margin,0.4);
  assert.equal(result.breakEven,300000);
  assert.equal(result.remaining,200000);
  assert.equal(result.daysLeft,21);
  assert.equal(result.ordersNeeded,40);
  assert.equal(result.projectedRevenue,310000);
  assert.equal(result.projectedProfit,310000*0.4-120000);
  assert.equal(result.status,'en-camino');
  assert.equal(result.breakEvenDay,'2026-10-30');
});

test('a slow pace is flagged as at risk, and covered months say so',()=>{
  const slow=cashflow({month:'2026-10',today:'2026-10-10',metrics,rules:[rule('Alquiler',120000)],recentDaily:Array(14).fill(2000)});
  assert.equal(slow.status,'en-riesgo');assert.equal(slow.breakEvenDay,null);assert.ok(slow.shortfall>0);
  const covered=cashflow({month:'2026-10',today:'2026-10-10',metrics,rules:[rule('Alquiler',20000)],recentDaily:[]});
  assert.equal(covered.status,'cubierto');assert.equal(covered.remaining,0);
  const noFixed=cashflow({month:'2026-10',today:'2026-10-10',metrics,rules:[],recentDaily:[]});
  assert.equal(noFixed.status,'sin-datos');assert.equal(noFixed.breakEven,null);
});

test('percentage expenses lower the contribution margin',()=>{
  const result=cashflow({month:'2026-10',today:'2026-10-10',metrics,rules:[rule('Alquiler',120000),{...rule('Regalías',0),calculation:'percentage_revenue',percentage:10}],recentDaily:[]});
  assert.ok(Math.abs(result.margin-0.3)<1e-9);
  assert.equal(Math.round(result.breakEven),400000);
});

test('the weekly calendar places fixed costs on their payment day',()=>{
  const weeks=weeklySchedule({today:'2026-10-12',weeks:3,receivables:{pagoNube:[{date:'2026-10-14',amount:5000},{date:'2026-10-21',amount:3000}],mercadolibre:{amount:2000}},
    rules:[{...rule('Alquiler',100000),due_day:20},{...rule('Sueldos',310000)}],dailySales:10000,marginBeforeAds:0.5,dailyAds:1000,openingBalance:50000});
  assert.equal(weeks[0].start,'2026-10-12');assert.equal(weeks[0].end,'2026-10-18');
  assert.equal(weeks[0].collections,7000);
  assert.deepEqual(weeks[1].fixedItems,[{name:'Alquiler',date:'2026-10-20',amount:100000}]);
  // Los sueldos sin día se reparten: 10.000 por día en un mes de 31 días.
  assert.equal(Math.round(weeks[0].fixed),70000);
  assert.equal(weeks[0].newSales,35000);assert.equal(weeks[0].ads,7000);
  assert.equal(Math.round(weeks[0].net),7000+35000-70000-7000);
  assert.equal(Math.round(weeks[0].balance),50000-35000);
});

test('the simulator shows what more ads or new prices would leave',()=>{
  const base={revenue:300000,productCost:120000,shipping:30000,commissions:15000,taxes:0,refundLoss:0,ads:30000,fixed:60000,percentageRate:0,roas:4};
  const same=simulate(base,0,0);
  assert.equal(same.current.profit,300000-120000-30000-15000-30000-60000);
  assert.equal(same.deltaProfit,0);
  // +50% de publicidad: 15.000 más que traen 60.000 de ventas (ROAS 4) con su costo variable.
  const ads=simulate(base,0.5,0);
  assert.equal(Math.round(ads.deltaRevenue),60000);
  assert.equal(Math.round(ads.deltaProfit),60000-(150000*0.2)-(15000*0.2)-15000);
  // +10% de precios con las mismas unidades: suma la facturación menos la comisión proporcional.
  const price=simulate(base,0,0.1);
  assert.equal(Math.round(price.deltaProfit),30000-1500);
});

test('the profit goal says how much to sell with today\'s margin, or how much margin is needed',()=>{
  // Ventas $1.000.000, costos variables $600.000 (incluye $100.000 de publicidad), fijos $200.000 → ganancia $200.000, margen 40%.
  const base={revenue:1000000,productCost:350000,shipping:50000,commissions:60000,taxes:40000,refundLoss:0,ads:100000,fixed:200000,percentageRate:0,roas:4,orders:100};
  const plan=goalPlan(base,400000,30);
  assert.equal(Math.round(plan.margin*100),40);
  assert.equal(plan.currentProfit,200000);
  assert.equal(Math.round(plan.requiredRevenue),1500000);
  assert.equal(Math.round(plan.extraPercent),50);
  assert.equal(plan.requiredOrders,150);
  assert.equal(Math.round(plan.perDay),50000);
  // Vendiendo lo mismo, haría falta un margen del 60%: 20 puntos más.
  assert.equal(Math.round(plan.marginGap),20);
  assert.equal(goalPlan(base,100000).reached,true);
  assert.equal(goalPlan({...base,productCost:1000000},100000).requiredRevenue,null,'without margin there is no sales target');
});
