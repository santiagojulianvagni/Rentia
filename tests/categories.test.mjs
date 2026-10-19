import test from 'node:test';
import assert from 'node:assert/strict';
import {NO_CATEGORY,categorySummary,inCategory,productCategories} from '../lib/categories.ts';

test('sales and profit are grouped by category and products without one are kept apart',()=>{
  const rows=[
    {categories:'["Remeras","Verano"]',revenue:1000,profit:300,units_sold:10},
    {categories:'["Remeras"]',revenue:500,profit:50,units_sold:5},
    {categories:null,revenue:200,profit:20,units_sold:2,provider:'mercadolibre'},
  ];
  const {categories,hasCategories}=categorySummary(rows);
  assert.ok(hasCategories);
  assert.deepEqual(categories.map(row=>row.name),['Remeras','Verano',NO_CATEGORY]);
  const remeras=categories[0];
  assert.deepEqual([remeras.revenue,remeras.profit,remeras.units,remeras.products],[1500,350,15,2]);
  assert.equal(Math.round(remeras.margin*10)/10,23.3);
  assert.equal(Math.round(categories[2].share*1000)/1000,.118);
  assert.ok(inCategory(rows[0],'Verano'));assert.ok(!inCategory(rows[1],'Verano'));assert.ok(inCategory(rows[2],NO_CATEGORY));
  assert.deepEqual(productCategories('no es json'),[]);
  assert.equal(categorySummary([{categories:null,revenue:1,profit:1,units_sold:1}]).hasCategories,false);
});
