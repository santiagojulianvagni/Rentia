import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateDays,guessMapping,parseAmount,parseCsv,parseDate} from '../lib/sales-import.ts';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){
  try{return next(specifier,context);}catch(error){
    if(error.code==='ERR_MODULE_NOT_FOUND'&&specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return next(`${specifier}.ts`,context);
    throw error;
  }
}});
const {splitStoreSales}=await import('../lib/physical-stores.ts');

test('amounts in Argentine, US and plain formats',()=>{
  assert.equal(parseAmount('$ 1.234,56'),1234.56);
  assert.equal(parseAmount('1,234.56'),1234.56);
  assert.equal(parseAmount('1.234'),1234);
  assert.equal(parseAmount('1234,5'),1234.5);
  assert.equal(parseAmount('12.5'),12.5);
  assert.equal(parseAmount('(500,00)'),-500);
  assert.equal(parseAmount(98765),98765);
  assert.equal(parseAmount('Total'),null);
});

test('dates from text, Excel serial numbers and Date cells',()=>{
  assert.equal(parseDate('03/04/2026'),'2026-04-03');
  assert.equal(parseDate('03/04/2026',false),'2026-03-04');
  assert.equal(parseDate('3-4-26 18:30'),'2026-04-03');
  assert.equal(parseDate('2026-04-03T10:00:00'),'2026-04-03');
  assert.equal(parseDate(46115),'2026-04-03');
  assert.equal(parseDate(new Date(Date.UTC(2026,3,3))),'2026-04-03');
  assert.equal(parseDate('31/02/2026'),null);
});

test('a semicolon CSV with one row per sale is grouped by day and counts each row as an order',()=>{
  const rows=parseCsv('﻿Reporte de ventas;;\nFecha;Comprobante;Importe total\n01/10/2026;A-0001;"$ 10.000,00"\n01/10/2026;A-0002;"5.500,50"\n02/10/2026;A-0003;2000\n;;\n');
  const mapping=guessMapping(rows);
  assert.equal(mapping.headerRow,1);
  assert.equal(mapping.date,0);assert.equal(mapping.revenue,2);assert.equal(mapping.rowsAre,'sales');
  const result=aggregateDays(rows,mapping);
  assert.deepEqual(result.days,[{date:'2026-10-01',orders:2,revenue:15500.5,productCost:null},{date:'2026-10-02',orders:1,revenue:2000,productCost:null}]);
  assert.deepEqual(result.range,{from:'2026-10-01',to:'2026-10-02'});
});

test('a daily summary with tickets and cost columns keeps them, and US dates are detected',()=>{
  const rows=[['Date','Tickets','Total sales','Costo mercaderia'],['10/30/2026',12,'120,000.00','48,000.00'],['10/31/2026',8,'80,000.00','']];
  const mapping=guessMapping(rows);
  assert.equal(mapping.orders,1);assert.equal(mapping.cost,3);assert.equal(mapping.rowsAre,'days');
  const result=aggregateDays(rows,mapping);
  assert.deepEqual(result.days,[{date:'2026-10-30',orders:12,revenue:120000,productCost:48000},{date:'2026-10-31',orders:8,revenue:80000,productCost:null}]);
});

test('rows that cannot be read are reported instead of being silently dropped',()=>{
  const rows=[['Fecha','Total'],['01/10/2026','1000'],['mañana','500'],['02/10/2026','sin dato']];
  const result=aggregateDays(rows,guessMapping(rows));
  assert.equal(result.days.length,1);
  assert.deepEqual(result.skipped.map(item=>item.row),[3,4]);
});

test('a store with a cost percentage becomes a channel with profit; one without costs stays separate',()=>{
  const stores=[{id:1,name:'Local Palermo',costPercent:40,feePercent:3,taxPercent:3.5},{id:2,name:'Showroom',costPercent:0,feePercent:0,taxPercent:0}];
  const rows=[
    {revenue_date:'2026-10-01',order_count:10,revenue:100000,store_id:1,product_cost:null},
    {revenue_date:'2026-10-02',order_count:5,revenue:50000,store_id:1,product_cost:15000},
    {revenue_date:'2026-10-01',order_count:3,revenue:30000,store_id:2,product_cost:null},
    {revenue_date:'2026-10-01',order_count:1,revenue:9000,store_id:null,product_cost:null},
  ];
  const result=splitStoreSales(rows,stores);
  // Día 1: 100.000 − 40.000 − 3.000 − 3.500 = 53.500. Día 2 con costo real: 50.000 − 15.000 − 1.500 − 1.750 = 31.750.
  assert.equal(result.totals.profit,85250);
  assert.equal(result.channels.length,1);
  assert.equal(result.channels[0].provider,'local:1');
  assert.equal(result.channels[0].label,'Local Palermo');
  assert.equal(result.unpriced.length,2);
  assert.equal(result.unpriced.reduce((sum,day)=>sum+day.revenue,0),39000);
});
