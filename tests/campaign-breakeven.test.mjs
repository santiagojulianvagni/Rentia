import test from 'node:test';
import assert from 'node:assert/strict';
import {campaignProfits,campaignTotals,brandBreakEven,productBreakEvens} from '../lib/campaign-profit.ts';

const campaign=(id,spend,value,budget)=>({external_campaign_id:id,name:id,status:'ACTIVE',effective_status:'ACTIVE',spend,purchases:1,purchase_value:value,daily_budget:budget});

test('campaigns are rentable, at the limit or losing money against the break-even ROAS',()=>{
  // Margen 50 %: equilibrio 2x. Rentable desde 2,3x; al límite entre 1,9x y 2,3x.
  const rows=campaignProfits({meta:[campaign('rentable',100,240,150000),campaign('limite',100,210,null),campaign('justo',100,190,null),campaign('pierde',100,150,null)],metaMargin:0.5,meliMargin:null});
  const byName=Object.fromEntries(rows.map(row=>[row.name,row]));
  assert.equal(byName.rentable.verdict,'gana');
  assert.equal(byName.rentable.dailyBudget,150000);
  assert.equal(byName.limite.verdict,'limite');
  assert.equal(byName.justo.verdict,'limite');
  assert.equal(byName.pierde.verdict,'pierde');
  assert.equal(byName.limite.dailyBudget,null);
  const totals=campaignTotals(rows);
  assert.equal(totals.winners,1);assert.equal(totals.atLimit,2);assert.equal(totals.losers,1);
});

test('the brand break-even compares the general ROAS with the real margin',()=>{
  assert.deepEqual(brandBreakEven(0.4,1000000,200000),{breakEven:2.5,roas:5,margin:0.4});
  assert.deepEqual(brandBreakEven(null,1000,0),{breakEven:null,roas:null,margin:null});
});

test('each product gets its minimum ROAS from its own margin, variants grouped',()=>{
  const rows=[
    {provider:'tiendanube',external_product_id:'1',product_name:'Sérum',revenue:600,profit:300,units_sold:6,cost_source:'manual'},
    {provider:'tiendanube',external_product_id:'1',product_name:'Sérum',revenue:400,profit:200,units_sold:4,cost_source:'manual'},
    {provider:'tiendanube',external_product_id:'2',product_name:'Protector',revenue:2000,profit:-100,units_sold:20,cost_source:'manual'},
    {provider:'tiendanube',external_product_id:'3',product_name:'Sin costo',revenue:5000,profit:5000,units_sold:9,cost_source:'sin_costo'},
    {provider:'tiendanube',external_product_id:'4',product_name:'Archivado',revenue:9000,profit:100,units_sold:9,rentia_archived:1},
  ];
  assert.deepEqual(productBreakEvens(rows),[{name:'Protector',margin:-0.05,breakEven:null,units:20},{name:'Sérum',margin:0.5,breakEven:2,units:10}]);
});
