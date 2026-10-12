import test from 'node:test';
import assert from 'node:assert/strict';
import {contributionRate,campaignProfits,campaignTotals} from '../lib/campaign-profit.ts';
import {buildAlerts,defaultAlertSettings,urgentAlerts} from '../lib/alerts.ts';
import {achievements} from '../lib/achievements.ts';

const money=value=>`$${Math.round(value)}`;

test('the channel margin uses only orders with complete costs',()=>{
  assert.equal(contributionRate({revenue:1000,orders:10,completeOrders:10,profit:300}),0.3);
  // La mitad de las órdenes tiene costos: 150 de ganancia sobre 500 facturados.
  assert.equal(contributionRate({revenue:1000,orders:10,completeOrders:5,profit:150}),0.3);
  assert.equal(contributionRate({revenue:1000,orders:10,completeOrders:0,profit:0}),null);
  assert.equal(contributionRate({revenue:1000,orders:10,completeOrders:10,profit:200,profitBeforeAds:400}),0.4);
});

test('campaign profit applies the real margin to attributed sales minus spend',()=>{
  const rows=campaignProfits({
    meta:[
      {external_campaign_id:'a',name:'Ganadora',status:'ACTIVE',effective_status:'ACTIVE',spend:100,purchases:5,purchase_value:1000},
      {external_campaign_id:'b',name:'Perdedora',status:'ACTIVE',effective_status:'ACTIVE',spend:500,purchases:2,purchase_value:1000},
      {external_campaign_id:'c',name:'Apagada sin gasto',status:'PAUSED',effective_status:'PAUSED',spend:0,purchases:0,purchase_value:0},
    ],
    mercadolibre:[{id:'m',name:'Product Ads',status:'active',spend:50,attributedRevenue:200,units:2}],
    metaMargin:0.3,meliMargin:null,
  });
  assert.deepEqual(rows.map(row=>[row.name,row.profit,row.verdict]),[['Perdedora',-200,'pierde'],['Ganadora',200,'gana'],['Product Ads',null,'sin-margen']]);
  assert.equal(rows[1].breakEvenRoas,1/0.3);
  const totals=campaignTotals(rows);
  assert.equal(totals.profit,0);assert.equal(totals.losers,1);assert.equal(totals.lost,-200);assert.equal(totals.withoutMargin,1);
});

test('alerts follow the configured thresholds and come most urgent first',()=>{
  const base={metrics:{revenue:1000,profit:50,margin:5,orders:10},previous:{revenue:2000,profit:400,margin:20,orders:20},quality:{completeOrders:10,totalOrders:10},adsConnected:true,products:[{product_name:'Remera',units_sold:3,profit:-20,stock:2,days_stock:3}],missingCosts:0,campaigns:[],settings:defaultAlertSettings,money};
  const ids=buildAlerts(base).map(alert=>alert.id);
  assert.deepEqual(ids,['products','margin-low','margin-drop','sales-drop','stock']);
  const relaxed=buildAlerts({...base,settings:{...defaultAlertSettings,marginMin:3,salesDrop:60,stockDays:1}}).map(alert=>alert.id);
  assert.ok(!relaxed.includes('margin-low')&&!relaxed.includes('sales-drop')&&!relaxed.includes('stock'));
  // Con costos incompletos no se alerta sobre el margen: sería un número provisorio.
  const partial=buildAlerts({...base,quality:{completeOrders:5,totalOrders:10}}).map(alert=>alert.id);
  assert.ok(!partial.includes('margin-low')&&!partial.includes('margin-drop'));
  assert.equal(urgentAlerts(buildAlerts({...base,adsConnected:false})).some(alert=>alert.id==='ads'),false);
});

test('achievements offer a version without amounts',()=>{
  const list=achievements({revenue:1500,profit:300,margin:22,orders:120,reportedRoas:3.4,adSpend:100},{revenue:1000,profit:200,margin:18,orders:80},[{date:'2026-10-05',storeRevenue:100},{date:'2026-10-08',storeRevenue:700},{date:'2026-10-09',storeRevenue:200}],money);
  const byId=Object.fromEntries(list.map(item=>[item.id,item]));
  assert.equal(byId['revenue-growth'].value,'+50%');
  assert.equal(byId['profit-growth'].value,'+50%');
  assert.equal(byId.orders.privateValue,'+100');
  assert.match(byId['best-day'].privateValue,/^Jueves 8$/);
  assert.equal(byId['best-day'].value,'$700');
  for(const item of list)assert.doesNotMatch(item.privateValue,/\$/,`${item.id} must not leak amounts`);
  assert.deepEqual(achievements({revenue:0,profit:0,margin:0,orders:0},null,[],money),[]);
});
