// Análisis de creativos de Meta: ganancia real de cada anuncio (con el margen de la tienda antes
// de publicidad), su ROAS contra el de equilibrio y un veredicto: escalar, mantener, apagar o
// "aprendiendo" cuando todavía gastó muy poco para decidir.

export type CreativeRow={adId:string;name:string;campaign:string;adset:string;status:string;kind:'video'|'imagen';thumbnail:string|null;spend:number;impressions:number;linkClicks:number;purchases:number;purchaseValue:number;purchasesClick:number;purchaseValueClick:number;videoViews3s:number;thruplays:number};
export type CreativeVerdict='escalar'|'mantener'|'apagar'|'aprendiendo';
// purchases y purchaseValue son los que se usan (con o sin las compras por solo ver el anuncio);
// viewPurchases son las que Meta cuenta solo porque la persona vio el anuncio, sin clic.
export type AnalyzedCreative=CreativeRow&{viewPurchases:number;roas:number|null;profit:number|null;ctr:number|null;cpa:number|null;hookRate:number|null;holdRate:number|null;verdict:CreativeVerdict;reason:string};

const SCALE_ABOVE=1.3,STOP_BELOW=0.95;
const ratio=(part:number,total:number)=>total>0?part/total:null;

export function analyzeCreatives(source:CreativeRow[],input:{margin:number|null;averageTicket:number|null;clickOnly?:boolean}) {
  const margin=input.margin&&input.margin>0?input.margin:null;
  // Con clickOnly, solo cuentan las compras que llegaron después de un clic en el anuncio.
  const rows=source.map(row=>{const viewPurchases=Math.max(0,row.purchases-row.purchasesClick);return input.clickOnly?{...row,purchases:row.purchasesClick,purchaseValue:row.purchaseValueClick,viewPurchases}:{...row,viewPurchases};});
  const breakEven=margin?1/margin:null;
  const totals=rows.reduce((sum,row)=>({spend:sum.spend+row.spend,purchases:sum.purchases+row.purchases,views:sum.views+row.videoViews3s,videoImpressions:sum.videoImpressions+(row.kind==='video'?row.impressions:0)}),{spend:0,purchases:0,views:0,videoImpressions:0});
  // Para decidir hace falta haber gastado al menos 1,5 ventas "de equilibrio" (o 1,5 veces el costo
  // por compra promedio de la cuenta si todavía no sabemos el margen).
  const breakEvenCpa=margin&&input.averageTicket?input.averageTicket*margin:null;
  const accountCpa=totals.purchases>0?totals.spend/totals.purchases:null;
  const learning=1.5*(breakEvenCpa??accountCpa??0);
  const ads:AnalyzedCreative[]=rows.map(row=>{
    const roas=row.spend>0?row.purchaseValue/row.spend:null;
    const profit=margin?row.purchaseValue*margin-row.spend:null;
    const ctr=ratio(row.linkClicks,row.impressions);
    const hookRate=row.kind==='video'?ratio(row.videoViews3s,row.impressions):null;
    const holdRate=row.kind==='video'?ratio(row.thruplays,row.videoViews3s):null;
    const base={...row,roas,profit,ctr,cpa:row.purchases>0?row.spend/row.purchases:null,hookRate,holdRate};
    if(!breakEven||row.spend<learning||!(row.spend>0))return {...base,verdict:'aprendiendo' as const,reason:breakEven?'Todavía gastó poco para decidir.':'Cargá tus costos para saber si este anuncio gana plata.'};
    const value=roas||0;
    if(value>=breakEven*SCALE_ABOVE)return {...base,verdict:'escalar' as const,reason:'Gana bien por encima de tu equilibrio.'};
    if(value>=breakEven*STOP_BELOW)return {...base,verdict:'mantener' as const,reason:'Está cerca del equilibrio: cubre costos con poco margen.'};
    const reason=hookRate!==null&&hookRate<0.15?'Engancha poco: casi nadie pasa de los 3 segundos.':ctr!==null&&ctr<0.008?'Pocos clics: el anuncio no convence.':'Atrae clics pero no se convierten en ventas.';
    return {...base,verdict:'apagar' as const,reason};
  });
  const count=(verdict:CreativeVerdict)=>ads.filter(ad=>ad.verdict===verdict).length;
  const profits=ads.map(ad=>ad.profit).filter((value):value is number=>value!==null);
  return {ads,breakEven,summary:{escalar:count('escalar'),mantener:count('mantener'),apagar:count('apagar'),aprendiendo:count('aprendiendo'),hookRate:ratio(totals.views,totals.videoImpressions),spend:totals.spend,profit:profits.length?profits.reduce((sum,value)=>sum+value,0):null,spendWithoutSales:ads.filter(ad=>ad.purchases<=0).reduce((sum,ad)=>sum+ad.spend,0)},insight:creativeInsight(ads)};
}

// Un dato de lo que mejor le funciona a la tienda, si hay datos suficientes para decirlo.
export function creativeInsight(ads:AnalyzedCreative[]):string|null {
  const roasOf=(list:AnalyzedCreative[])=>{const spend=list.reduce((sum,ad)=>sum+ad.spend,0),value=list.reduce((sum,ad)=>sum+ad.purchaseValue,0);return spend>0?value/spend:null;};
  const videos=ads.filter(ad=>ad.kind==='video'&&ad.hookRate!==null&&ad.spend>0);
  const hooked=videos.filter(ad=>(ad.hookRate||0)>=0.3),rest=videos.filter(ad=>(ad.hookRate||0)<0.3);
  const high=roasOf(hooked),low=roasOf(rest);
  if(hooked.length&&rest.length&&high&&low&&high>=low*1.2)return `Tus videos que enganchan a más del 30 % en los primeros 3 segundos venden ${(high/low).toLocaleString('es-AR',{maximumFractionDigits:1})} veces más por peso invertido.`;
  const images=ads.filter(ad=>ad.kind==='imagen'&&ad.spend>0),videoRoas=roasOf(ads.filter(ad=>ad.kind==='video'&&ad.spend>0)),imageRoas=roasOf(images);
  if(videoRoas&&imageRoas&&Math.max(videoRoas,imageRoas)>=Math.min(videoRoas,imageRoas)*1.3)return videoRoas>imageRoas?`Tus videos venden ${(videoRoas/imageRoas).toLocaleString('es-AR',{maximumFractionDigits:1})} veces más por peso invertido que tus imágenes.`:`Tus imágenes venden ${(imageRoas/videoRoas).toLocaleString('es-AR',{maximumFractionDigits:1})} veces más por peso invertido que tus videos.`;
  const best=[...ads].filter(ad=>ad.profit!==null&&ad.verdict!=='aprendiendo').sort((a,b)=>(b.profit||0)-(a.profit||0))[0];
  return best&&(best.profit||0)>0?`Tu anuncio que más ganancia dejó es "${best.name}".`:null;
}
