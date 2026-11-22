import test from 'node:test';
import assert from 'node:assert/strict';

// Creativos: veredicto de cada anuncio según su ROAS contra el de equilibrio, con un mínimo de
// gasto para decidir, y el porqué cuando conviene apagarlo.
const {analyzeCreatives}=await import('../lib/creative-analysis.ts');
const ad=(id,extra)=>({adId:id,name:id,campaign:'Ventas',adset:'Frío',status:'ACTIVE',kind:'video',thumbnail:null,spend:0,impressions:10000,linkClicks:150,purchases:0,purchaseValue:0,videoViews3s:3000,thruplays:600,purchasesClick:extra?.purchases??0,purchaseValueClick:extra?.purchaseValue??0,...extra});

test('creatives get a verdict against the break-even ROAS',()=>{
  // Margen 60 % → equilibrio 1,67x. Ticket 50.000 → equilibrio por compra 30.000; decidir desde 45.000.
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

test('click-only mode drops purchases Meta counts just for viewing the ad, and totals add up',()=>{
  // Como el Ad9 de Naturae: 63.599 de gasto y una compra de 94.667 que Meta cuenta por haber visto el anuncio.
  const rows=[ad('ad9',{spend:63599,purchases:1,purchaseValue:94667,purchasesClick:0,purchaseValueClick:0}),ad('ad3',{spend:8990,purchases:1,purchaseValue:123748})];
  const all=analyzeCreatives(rows,{margin:0.6,averageTicket:50000});
  assert.equal(all.ads.find(row=>row.adId==='ad9').purchases,1);
  assert.equal(all.ads.find(row=>row.adId==='ad9').viewPurchases,1);
  const clicks=analyzeCreatives(rows,{margin:0.6,averageTicket:50000,clickOnly:true});
  const ad9=clicks.ads.find(row=>row.adId==='ad9');
  assert.equal(ad9.purchases,0);
  assert.equal(ad9.roas,0);
  assert.equal(ad9.verdict,'apagar');
  assert.equal(clicks.summary.spend,63599+8990);
  assert.equal(clicks.summary.spendWithoutSales,63599);
  assert.equal(Math.round(clicks.summary.profit),Math.round(-63599+123748*0.6-8990));
});

test('an ad that already spent more than one sale leaves, without selling, is switched off early',()=>{
  // Equilibrio por compra: 50.000 × 60 % = 30.000. Gastó 35.000 sin vender: ya no puede ganar.
  const {ads}=analyzeCreatives([ad('sinVentas',{spend:35000}),ad('recien',{spend:20000})],{margin:0.6,averageTicket:50000});
  assert.equal(ads[0].verdict,'apagar');
  assert.match(ads[0].reason,/más de lo que te deja una venta/);
  assert.equal(ads[1].verdict,'aprendiendo');
});
