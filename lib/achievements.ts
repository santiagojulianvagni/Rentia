// Logros para compartir. Cada uno tiene una versión con montos y otra sin montos, para que
// la tienda decida si muestra cuánto vende o solo cuánto creció.

export type AchievementMetrics={revenue:number;profit:number;margin:number;orders:number;reportedRoas?:number;adSpend?:number};
export type TimelineDay={date:string;storeRevenue:number;externalRevenue?:number};
export type Achievement={id:string;title:string;value:string;privateValue:string;detail:string};

const percent=(value:number)=>`${value>0?'+':''}${Math.round(value)}%`;
const decimal=(value:number,digits=1)=>value.toFixed(digits).replace('.',',');
const MILESTONES=[5000,1000,500,250,100,50,25,10];
const weekday=new Intl.DateTimeFormat('es-AR',{weekday:'long',day:'numeric',timeZone:'UTC'});

export function achievements(current:AchievementMetrics|null,previous:AchievementMetrics|null,timeline:TimelineDay[],money:(value:number)=>string):Achievement[] {
  if(!current||current.orders<=0)return [];
  const list:Achievement[]=[];
  if(previous&&previous.revenue>0) {
    const growth=(current.revenue-previous.revenue)/previous.revenue*100;
    if(growth>=10)list.push({id:'revenue-growth',title:'Ventas en crecimiento',value:percent(growth),privateValue:percent(growth),detail:`Facturaste ${money(current.revenue)} frente a ${money(previous.revenue)} del período anterior.`});
  }
  if(previous&&previous.profit>0&&current.profit>0) {
    const growth=(current.profit-previous.profit)/previous.profit*100;
    if(growth>=10)list.push({id:'profit-growth',title:'Más ganancia',value:percent(growth),privateValue:percent(growth),detail:`Ganaste ${money(current.profit)} frente a ${money(previous.profit)} del período anterior.`});
  }
  if(current.margin>=20)list.push({id:'margin',title:'Margen real saludable',value:`${decimal(current.margin)}%`,privateValue:`${decimal(current.margin)}%`,detail:'Lo que queda después de productos, envíos, comisiones, impuestos y publicidad.'});
  if(previous&&previous.revenue>0&&current.margin-previous.margin>=2)list.push({id:'margin-up',title:'Margen en alza',value:`+${decimal(current.margin-previous.margin)} pts`,privateValue:`+${decimal(current.margin-previous.margin)} pts`,detail:`Pasó de ${decimal(previous.margin)}% a ${decimal(current.margin)}%.`});
  const milestone=MILESTONES.find(value=>current.orders>=value);
  if(milestone)list.push({id:'orders',title:'Órdenes en el período',value:current.orders.toLocaleString('es-AR'),privateValue:`+${milestone.toLocaleString('es-AR')}`,detail:`Superaste las ${milestone.toLocaleString('es-AR')} órdenes.`});
  if((current.reportedRoas||0)>=3&&(current.adSpend||0)>0)list.push({id:'roas',title:'Publicidad que rinde',value:`${decimal(current.reportedRoas||0,2)}x`,privateValue:`${decimal(current.reportedRoas||0,2)}x`,detail:'Cada peso invertido en Meta Ads volvió multiplicado en ventas atribuidas.'});
  const best=timeline.reduce<TimelineDay|null>((top,day)=>{const total=day.storeRevenue+(day.externalRevenue||0);return !top||total>top.storeRevenue+(top.externalRevenue||0)?day:top;},null);
  if(best&&timeline.length>=3&&best.storeRevenue+(best.externalRevenue||0)>0) {
    const label=weekday.format(new Date(`${best.date}T00:00:00Z`));
    list.push({id:'best-day',title:'Mejor día de ventas',value:money(best.storeRevenue+(best.externalRevenue||0)),privateValue:label.charAt(0).toUpperCase()+label.slice(1),detail:`El ${label} fue el día con más facturación del período.`});
  }
  return list;
}
