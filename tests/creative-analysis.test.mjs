import test from 'node:test';
import assert from 'node:assert/strict';

// Creativos: veredicto de cada anuncio según su ROAS contra el de equilibrio, con un mínimo de
// gasto para decidir, y el porqué cuando conviene apagarlo.
const {analyzeCreatives}=await import('../lib/creative-analysis.ts');
const ad=(id,extra)=>({adId:id,name:id,campaign:'Ventas',adset:'Frío',status:'ACTIVE',kind:'video',thumbnail:null,spend:0,impressions:10000,linkClicks:150,purchases:0,purchaseValue:0,videoViews3s:3000,thruplays:600,...extra});

test('creatives get a verdict against the break-even ROAS',()=>{
  // Margen 60 % → equilibrio 1,67x. Ticket 50.000 → equilibrio por compra 30.000; decidir desde 60.000.
  const {ads,breakEven,summary,insight}=analyzeCreatives([
    ad('gana',{spend:100000,purchaseValue:580000,purchases:10,videoViews3s:3800}),
    ad('justo',{spend:100000,purchaseValue:180000,purchases:4}),
    ad('pierde',{spend:100000,purchaseValue:120000,purchases:2,videoViews3s:1000,thruplays:60}),
    ad('nuevo',{spend:20000,purchaseValue:0}),
    ad('foto',{kind:'imagen',spend:90000,purchaseValue:90000,purchases:2,linkClicks:40,videoViews3s:0,thruplays:0}),
  ],{margin:0.6,averageTicket:50000});
  assert.equal(Math.round(breakEven*100)/100,1.67);
  const by=Object.fromEntries(ads.map(row=>[row.adId,row]));
  assert.equal(by.gana.verdict,'escalar');
  assert.equal(by.gana.profit,580000*0.6-100000);
  assert.equal(by.gana.hookRate,0.38);
  assert.equal(by.justo.verdict,'mantener');
  assert.equal(by.pierde.verdict,'apagar');
  assert.match(by.pierde.reason,/Engancha poco/);
  assert.equal(by.nuevo.verdict,'aprendiendo');
  assert.equal(by.foto.verdict,'apagar');
  assert.match(by.foto.reason,/Pocos clics/);
  assert.equal(by.foto.hookRate,null);
  assert.deepEqual({escalar:summary.escalar,apagar:summary.apagar,mantener:summary.mantener,aprendiendo:summary.aprendiendo},{escalar:1,apagar:2,mantener:1,aprendiendo:1});
  assert.match(insight,/enganchan a más del 30 %/);
});

test('without a known margin every creative waits for costs',()=>{
  const {ads,breakEven}=analyzeCreatives([ad('a',{spend:100000,purchaseValue:300000,purchases:5})],{margin:null,averageTicket:null});
  assert.equal(breakEven,null);
  assert.equal(ads[0].verdict,'aprendiendo');
  assert.equal(ads[0].profit,null);
  assert.match(ads[0].reason,/Cargá tus costos/);
});
