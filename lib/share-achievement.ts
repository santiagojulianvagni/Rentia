// Contenido de la imagen para compartir un logro: título, número grande y hasta dos datos más.
// Sin "Mostrar montos" solo van porcentajes, cantidades y fechas, nunca plata.

import type { ShareContent, ShareStat } from '../components/panel/share-card';
import type { AchievementEvent } from './achievement-history';
import type { SalesDay } from './mascot';

export type StarProduct={name:string;units:number;profit:number;image:string|null};
export type ShareExtras={product?:StarProduct|null;provinces?:number|null};

const DAY=24*60*60*1000;
const time=(date:string)=>Date.parse(`${date}T00:00:00Z`);
const iso=(value:number)=>new Date(value).toISOString().slice(0,10);
const shift=(date:string,days:number)=>iso(time(date)+days*DAY);
const mondayOf=(date:string)=>{const value=time(date);return iso(value-((new Date(value).getUTCDay()+6)%7)*DAY);};
const n=(value:number)=>value.toLocaleString('es-AR');
const pct=(value:number)=>`${value>=0?'+':'−'}${Math.abs(Math.round(value)).toLocaleString('es-AR')} %`;
const fullDate=(date:string)=>new Intl.DateTimeFormat('es-AR',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(time(date)));
const dayMonth=(date:string)=>new Intl.DateTimeFormat('es-AR',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(time(date)));
const monthName=(month:string)=>new Intl.DateTimeFormat('es-AR',{month:'long',timeZone:'UTC'}).format(new Date(time(`${month}-01`)));
const capital=(text:string)=>text.charAt(0).toLocaleUpperCase('es-AR')+text.slice(1);
const plural=(value:number,one:string,many:string)=>`${n(value)} ${value===1?one:many}`;

// Rango de días de un logro de día, semana o mes (sin pasar de hoy).
export function achievementRange(event:Pick<AchievementEvent,'kind'|'date'>,today:string):{start:string;end:string} {
  if(event.kind==='week'){const start=mondayOf(event.date),end=shift(start,6);return {start,end:end>today?today:end};}
  if(event.kind==='month'){const start=`${event.date.slice(0,7)}-01`,next=new Date(time(start));next.setUTCMonth(next.getUTCMonth()+1);const end=iso(next.getTime()-DAY);return {start,end:end>today?today:end};}
  return {start:event.date,end:event.date};
}

const sumRange=(days:SalesDay[],start:string,end:string,key:'orders'|'revenue')=>days.reduce((total,day)=>day.date>=start&&day.date<=end?total+day[key]:total,0);

export function achievementShare(event:AchievementEvent,days:SalesDay[],today:string,money:(value:number)=>string,extras:ShareExtras={}):ShareContent {
  const stats:ShareStat[]=[];
  let tag='NUEVO LOGRO',title='',value='',privateValue='',subtitle='',privateSubtitle='';
  let product:NonNullable<ShareContent['achievement']>['product']=null;

  if(event.kind==='day'||event.kind==='week'||event.kind==='month'){
    tag='NUEVO RÉCORD';
    const {start,end}=achievementRange(event,today);
    title=event.kind==='day'?'Mi mejor día de ventas':event.kind==='week'?'Mi mejor semana':`${capital(monthName(event.date.slice(0,7)))}, mi mejor mes`;
    value=money(event.value);
    const growth=event.previous?(event.value-event.previous)/event.previous*100:null;
    privateValue=growth!==null?pct(growth):value;
    privateSubtitle=growth!==null?'más que mi récord anterior':'';
    subtitle=event.previous?`Mi récord anterior era de ${money(event.previous)}`:'';
    // Contra el mismo período del año anterior (52 semanas antes, así cae el mismo día de la semana).
    const lastStart=event.kind==='month'?`${Number(start.slice(0,4))-1}${start.slice(4)}`:shift(start,-364);
    const lastEnd=event.kind==='month'?`${Number(end.slice(0,4))-1}${end.slice(4)}`:shift(end,-364);
    const lastYear=sumRange(days,lastStart,lastEnd,'revenue');
    if(lastYear>0){
      const change=pct((sumRange(days,start,end,'revenue')-lastYear)/lastYear*100),year=lastStart.slice(0,4);
      const label=event.kind==='day'?'Contra hace un año':event.kind==='week'?`Contra la misma semana de ${year}`:`Contra ${monthName(lastStart.slice(0,7))} de ${year}`;
      stats.push({label,value:change,privateValue:change});
    }
    else {const orders=plural(sumRange(days,start,end,'orders'),'orden','órdenes');stats.push({label:'Órdenes',value:orders,privateValue:orders});}
    if(extras.product)product={name:extras.product.name,image:extras.product.image,detail:`${plural(extras.product.units,'vendido','vendidos')} · ${money(extras.product.profit)} de ganancia`,privateDetail:plural(extras.product.units,'vendido','vendidos')};
  }
  else if(event.kind==='streak'){
    title='Racha de ventas';value=privateValue=plural(event.value,'día','días');subtitle=privateSubtitle='seguidos con al menos una venta';
    const start=shift(event.date,-(event.value-1)),orders=plural(sumRange(days,start,event.date,'orders'),'orden','órdenes');
    stats.push({label:'En la racha',value:orders,privateValue:orders});
    const best=days.filter(day=>day.date>=start&&day.date<=event.date).reduce<SalesDay|null>((a,b)=>!a||b.revenue>a.revenue?b:a,null);
    if(best)stats.push({label:'Mejor día de la racha',value:money(best.revenue),privateValue:capital(dayMonth(best.date))});
  }
  else if(event.kind==='orders'){
    title='Meta cumplida';value=privateValue=`${n(event.value)} ventas`;subtitle=privateSubtitle='desde mi primera venta';
    const first=days.find(day=>day.orders>0)?.date;
    if(first){
      const elapsed=Math.max(1,Math.round((time(event.date)-time(first))/DAY));
      const months=Math.round(elapsed/30.44);
      const took=months>=2?plural(months,'mes','meses'):plural(elapsed,'día','días');
      stats.push({label:'Lo logré en',value:took,privateValue:took});
    }
    if(extras.provinces&&extras.provinces>1){const text=plural(extras.provinces,'provincia','provincias');stats.push({label:'Vendí en',value:text,privateValue:text});}
  }
  else {
    title='Creciendo sin parar';value=privateValue=plural(event.value,'semana','semanas');subtitle=privateSubtitle='seguidas vendiendo más que la anterior';
    // event.date es el domingo de la última semana de la racha.
    const lastMonday=mondayOf(event.date),baseMonday=shift(lastMonday,-7*event.value);
    const last=sumRange(days,lastMonday,event.date,'revenue'),base=sumRange(days,baseMonday,shift(baseMonday,6),'revenue');
    if(base>0){const change=pct((last-base)/base*100);stats.push({label:'Crecimiento en la racha',value:change,privateValue:change});}
    const orders=plural(sumRange(days,lastMonday,event.date,'orders'),'orden','órdenes');
    stats.push({label:'Última semana',value:orders,privateValue:orders});
  }

  return {eyebrow:tag,title,value,privateValue,period:fullDate(event.date),stats:stats.slice(0,product?1:2),image:product?.image||null,achievement:{tag,subtitle,privateSubtitle,product}};
}
