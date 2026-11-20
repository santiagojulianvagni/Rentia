// Historial de logros de la tienda ("Mis logros"), recalculado desde las ventas por día.
// Usa los mismos mínimos que el festejo del panel (lib/mascot.ts) para que "récord" signifique
// lo mismo en los dos lugares. No se guarda nada: si cambia el historial, cambian los logros.

import type { SalesDay } from './mascot';

// Las mismas metas de ventas que festeja el panel (ORDER_MILESTONES en lib/mascot.ts; una prueba
// verifica que coincidan). Van repetidas para que este archivo no dependa del otro al ejecutarse.
export const ORDER_MILESTONES=[100,500,1000,5000,10000,50000,100000];

export type AchievementKind='day'|'week'|'month'|'orders'|'streak'|'growth';
export type AchievementEvent={id:string;kind:AchievementKind;date:string;value:number;previous:number|null;previousDate:string|null};
export type AchievementHistory={
  events:AchievementEvent[];
  bestDay:{date:string;value:number}|null;
  bestMonth:{month:string;value:number}|null;
  totalOrders:number;
  firstSale:string|null;
  next:{goal:number;remaining:number;progress:number}|null;
};

const DAY=24*60*60*1000;
const time=(date:string)=>Date.parse(`${date}T00:00:00Z`);
const iso=(value:number)=>new Date(value).toISOString().slice(0,10);
const mondayOf=(date:string)=>{const value=time(date);return iso(value-((new Date(value).getUTCDay()+6)%7)*DAY);};
export const STREAK_MILESTONES=[7,30,60,100,365];
export const GROWTH_MILESTONES=[3,5,8,12];
const MIN_DAYS=14,MIN_WEEKS=4,MIN_MONTHS=3;

export function achievementHistory(days:SalesDay[],today:string):AchievementHistory {
  const by=new Map(days.filter(day=>day.date<=today).map(day=>[day.date,day]));
  const withSales=[...by.values()].filter(day=>day.orders>0||day.revenue>0).sort((a,b)=>a.date.localeCompare(b.date));
  const empty:AchievementHistory={events:[],bestDay:null,bestMonth:null,totalOrders:0,firstSale:null,next:{goal:ORDER_MILESTONES[0],remaining:ORDER_MILESTONES[0],progress:0}};
  if(!withSales.length)return empty;

  const events:AchievementEvent[]=[];
  let bestDay:{date:string;value:number}|null=null,salesDays=0,orders=0,streak=0;
  // Semanas y meses: total acumulado del período en curso y los totales cerrados anteriores.
  const weekTotals=new Map<string,number>(),monthTotals=new Map<string,number>();
  const weekDone=new Set<string>(),monthDone=new Set<string>();
  const growthDone=new Set<string>();

  for(let value=time(withSales[0].date);value<=time(today);value+=DAY){
    const date=iso(value),day=by.get(date)||{date,orders:0,revenue:0};

    // Mejor día.
    if(day.revenue>0){
      if(bestDay&&salesDays>=MIN_DAYS&&day.revenue>bestDay.value)events.push({id:`day-${date}`,kind:'day',date,value:day.revenue,previous:bestDay.value,previousDate:bestDay.date});
      if(!bestDay||day.revenue>bestDay.value)bestDay={date,value:day.revenue};
      salesDays++;
    }

    // Hitos de ventas.
    const before=orders;orders+=day.orders;
    for(const goal of ORDER_MILESTONES)if(before<goal&&orders>=goal)events.push({id:`orders-${goal}`,kind:'orders',date,value:goal,previous:null,previousDate:null});

    // Días seguidos vendiendo.
    streak=day.orders>0?streak+1:0;
    if(STREAK_MILESTONES.includes(streak))events.push({id:`streak-${streak}-${date}`,kind:'streak',date,value:streak,previous:null,previousDate:null});

    // Mejor semana y mejor mes: se festeja el día en que el período supera al mejor anterior.
    for(const [key,totals,done,kind,minimum] of [[mondayOf(date),weekTotals,weekDone,'week',MIN_WEEKS],[date.slice(0,7),monthTotals,monthDone,'month',MIN_MONTHS]] as const){
      const running=(totals.get(key)||0)+day.revenue;totals.set(key,running);
      if(done.has(key)||day.revenue<=0)continue;
      const previous=[...totals.entries()].filter(([other,total])=>other<key&&total>0);
      if(previous.length<minimum)continue;
      const best=previous.reduce((a,b)=>b[1]>a[1]?b:a);
      if(running>best[1]){done.add(key);events.push({id:`${kind}-${key}`,kind,date,value:running,previous:best[1],previousDate:best[0]});}
    }

    // Semanas seguidas creciendo: se mira cada domingo, con la semana ya cerrada.
    if(new Date(value).getUTCDay()===0&&date<today){
      let run=0;
      for(let monday=time(mondayOf(date));;monday-=7*DAY){const now=weekTotals.get(iso(monday))||0,prev=weekTotals.get(iso(monday-7*DAY))||0;if(prev>0&&now>prev)run++;else break;}
      if(GROWTH_MILESTONES.includes(run)&&!growthDone.has(`${run}-${date}`)){growthDone.add(`${run}-${date}`);events.push({id:`growth-${run}-${date}`,kind:'growth',date,value:run,previous:null,previousDate:null});}
    }
  }

  // El valor de una semana o un mes es el total final (o el acumulado si sigue en curso).
  for(const event of events){
    if(event.kind==='week')event.value=weekTotals.get(event.id.slice(5))||event.value;
    if(event.kind==='month')event.value=monthTotals.get(event.id.slice(6))||event.value;
  }

  const bestMonthEntry=[...monthTotals.entries()].reduce<[string,number]|null>((a,b)=>!a||b[1]>a[1]?b:a,null);
  const goal=ORDER_MILESTONES.find(value=>value>orders);
  const reached=[...ORDER_MILESTONES].reverse().find(value=>value<=orders)||0;
  return {
    events:events.sort((a,b)=>b.date.localeCompare(a.date)||order(b.kind)-order(a.kind)),
    bestDay,
    bestMonth:bestMonthEntry&&bestMonthEntry[1]>0?{month:bestMonthEntry[0],value:bestMonthEntry[1]}:null,
    totalOrders:orders,
    firstSale:withSales[0].date,
    next:goal?{goal,remaining:goal-orders,progress:Math.max(0,Math.min(1,(orders-reached)/(goal-reached)))}:null,
  };
}

// Dentro del mismo día, primero lo más importante.
const order=(kind:AchievementKind)=>({orders:6,month:5,week:4,growth:3,streak:2,day:1})[kind];
