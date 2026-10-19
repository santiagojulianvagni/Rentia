// Compara un evento comercial (Hot Sale, Cyber Monday, un lanzamiento) contra días normales.
// "Normal" es el promedio diario de las 4 semanas anteriores, salteando la semana previa al
// evento, porque ahí mucha gente espera las ofertas y las ventas suelen bajar.
const DAY=24*60*60*1000;
export const BASELINE_DAYS=28;
export const BASELINE_GAP_DAYS=7;
export const AFTER_DAYS=7;
export const EVENT_MAX_DAYS=31;
export const EVENT_NAME_SUGGESTIONS=['Hot Sale','Cyber Monday','Black Friday','Día de la Madre','Día del Padre','Navidad','Lanzamiento','Promoción propia'];

export type Range={start:string;end:string;days:number};
export type EventMetrics={revenue:number;orders:number;profitBeforeAds:number;totalAdSpend:number;profit:number;fixedCosts:number};

const toTime=(value:string)=>Date.parse(`${value}T00:00:00Z`);
const toIso=(time:number)=>new Date(time).toISOString().slice(0,10);
export const rangeDays=(start:string,end:string)=>Math.round((toTime(end)-toTime(start))/DAY)+1;

export function validEventDates(start:string,end:string) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end))return false;
  if(Number.isNaN(toTime(start))||Number.isNaN(toTime(end))||toIso(toTime(start))!==start||toIso(toTime(end))!==end)return false;
  const days=rangeDays(start,end);
  return days>=1&&days<=EVENT_MAX_DAYS;
}

// Ventanas a pedir al resumen. La semana siguiente solo existe si ya terminó (today es la
// fecha de hoy en Argentina, AAAA-MM-DD).
export function eventWindows(start:string,end:string,today:string) {
  const startTime=toTime(start),endTime=toTime(end);
  const baselineEnd=startTime-(BASELINE_GAP_DAYS+1)*DAY;
  const afterStart=endTime+DAY,afterEnd=endTime+AFTER_DAYS*DAY;
  return {
    event:{start,end,days:rangeDays(start,end)},
    baseline:{start:toIso(baselineEnd-(BASELINE_DAYS-1)*DAY),end:toIso(baselineEnd),days:BASELINE_DAYS},
    after:afterEnd<toTime(today)?{start:toIso(afterStart),end:toIso(afterEnd),days:AFTER_DAYS}:null,
    finished:endTime<toTime(today),
  };
}

// Ganancia del evento antes de gastos fijos: los fijos se pagan igual, haya evento o no.
const contribution=(m:EventMetrics)=>m.profit+m.fixedCosts;
const perDay=(m:EventMetrics,days:number,target:number)=>{
  const factor=days>0?target/days:0;
  return {revenue:m.revenue*factor,orders:m.orders*factor,profitBeforeAds:m.profitBeforeAds*factor,totalAdSpend:m.totalAdSpend*factor,contribution:contribution(m)*factor};
};
const pct=(current:number,base:number)=>base?((current-base)/Math.abs(base))*100:null;
const margin=(profit:number,revenue:number)=>revenue?profit/revenue*100:null;

export type EventRow={key:string;label:string;event:number;normal:number;change:number|null;kind:'money'|'count'|'percent'|'ratio';inverse?:boolean};
export type EventVerdict={tone:'good'|'warn'|'bad'|'neutral';title:string;text:string};

export function compareEvent(input:{event:EventMetrics;baseline:EventMetrics;after?:EventMetrics|null;eventDays:number;baselineDays?:number;afterDays?:number;money:(value:number)=>string}) {
  const {event,baseline,eventDays,money}=input,baselineDays=input.baselineDays??BASELINE_DAYS;
  const normal=perDay(baseline,baselineDays,eventDays);
  const current={revenue:event.revenue,orders:event.orders,profitBeforeAds:event.profitBeforeAds,totalAdSpend:event.totalAdSpend,contribution:contribution(event)};
  const eventMargin=margin(current.profitBeforeAds,current.revenue),normalMargin=margin(normal.profitBeforeAds,normal.revenue);
  const eventTicket=current.orders?current.revenue/current.orders:0,normalTicket=normal.orders?normal.revenue/normal.orders:0;
  const eventRoas=current.totalAdSpend?current.revenue/current.totalAdSpend:0,normalRoas=normal.totalAdSpend?normal.revenue/normal.totalAdSpend:0;
  const rows:EventRow[]=[
    {key:'revenue',label:'Ventas',event:current.revenue,normal:normal.revenue,change:pct(current.revenue,normal.revenue),kind:'money'},
    {key:'orders',label:'Órdenes',event:current.orders,normal:normal.orders,change:pct(current.orders,normal.orders),kind:'count'},
    {key:'ticket',label:'Ticket promedio',event:eventTicket,normal:normalTicket,change:pct(eventTicket,normalTicket),kind:'money'},
    {key:'margin',label:'Margen antes de publicidad',event:eventMargin??0,normal:normalMargin??0,change:eventMargin!==null&&normalMargin!==null?eventMargin-normalMargin:null,kind:'percent'},
    {key:'ads',label:'Publicidad',event:current.totalAdSpend,normal:normal.totalAdSpend,change:pct(current.totalAdSpend,normal.totalAdSpend),kind:'money',inverse:true},
    {key:'roas',label:'ROAS total (ventas ÷ publicidad)',event:eventRoas,normal:normalRoas,change:pct(eventRoas,normalRoas),kind:'ratio'},
    {key:'profit',label:'Ganancia antes de gastos fijos',event:current.contribution,normal:normal.contribution,change:pct(current.contribution,normal.contribution),kind:'money'},
  ];
  const extra=current.contribution-normal.contribution;
  const days=`${eventDays} ${eventDays===1?'día normal':'días normales'}`;
  let verdict:EventVerdict;
  if(!baseline.revenue&&!baseline.orders) verdict={tone:'neutral',title:'Falta historia para comparar',text:'No hay ventas en las 4 semanas anteriores al evento. Cuando haya historial, la comparación se arma sola.'};
  else if(current.revenue<normal.revenue) verdict={tone:'bad',title:'Vendiste menos que en días normales',text:`Las ventas quedaron ${money(normal.revenue-current.revenue)} por debajo de ${days}.`};
  else if(extra>0) verdict={tone:'good',title:`El evento dejó ${money(extra)} más de ganancia`,text:`Comparado con ${days}, después de costos y publicidad.`};
  else verdict={tone:'warn',title:'Vendiste más, pero no ganaste más',text:`Las ventas subieron, pero la ganancia quedó ${extra===0?'igual que en':`${money(Math.abs(extra))} por debajo de`} ${days}: los descuentos, las cuotas o la publicidad se llevaron la diferencia.`};

  let after:{change:number|null;text:string}|null=null;
  if(input.after) {
    const afterDays=input.afterDays??AFTER_DAYS,normalAfter=perDay(baseline,baselineDays,afterDays);
    const change=pct(contribution(input.after),normalAfter.contribution);
    after={change,text:change===null?'Sin datos de una semana normal para comparar la semana siguiente.'
      :change<=-15?`La semana siguiente ganaste ${Math.round(Math.abs(change))}% menos que una normal: parte de las ventas del evento se adelantaron.`
      :change>=15?`La semana siguiente ganaste ${Math.round(change)}% más que una normal: el evento siguió empujando ventas.`
      :'La semana siguiente fue parecida a una normal: el evento no se comió ventas futuras.'};
  }
  const notes:string[]=[];
  if(eventMargin!==null&&normalMargin!==null&&normalMargin-eventMargin>=5) notes.push(`El margen antes de publicidad bajó de ${Math.round(normalMargin)}% a ${Math.round(eventMargin)}%: revisá descuentos y cuotas en los productos de menor margen.`);
  if(current.totalAdSpend>normal.totalAdSpend*1.5&&eventRoas<normalRoas) notes.push('Invertiste bastante más en publicidad y cada peso trajo menos ventas que en días normales.');
  return {rows,verdict,after,notes,extra};
}
