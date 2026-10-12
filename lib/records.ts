import type { Achievement } from './achievements';

// Récords, rachas e hitos de una semana, comparando con todo el historial de ventas de la
// tienda. Todo se mide hasta el final de la semana elegida, así una semana vieja muestra
// los logros que tenía en ese momento.

export type SalesDay={date:string;orders:number;revenue:number};
const DAY=24*60*60*1000;
const time=(date:string)=>Date.parse(`${date}T00:00:00Z`);
const iso=(value:number)=>new Date(value).toISOString().slice(0,10);
const mondayOf=(value:number)=>value-((new Date(value).getUTCDay()+6)%7)*DAY;
const MILESTONES=[100000,50000,25000,10000,5000,2500,1000,500,250,100];
const monthName=new Intl.DateTimeFormat('es-AR',{month:'long',year:'numeric',timeZone:'UTC'});

export function recordAchievements(days:SalesDay[],week:{start:string;end:string},money:(value:number)=>string):Achievement[] {
  const start=time(week.start),end=time(week.end);
  const upToWeek=days.filter(day=>time(day.date)<=end);
  if(!upToWeek.length)return [];
  const list:Achievement[]=[];

  // Totales por semana (lunes a domingo) hasta la semana elegida.
  const weeks=new Map<number,number>();
  for(const day of upToWeek){const monday=mondayOf(time(day.date));weeks.set(monday,(weeks.get(monday)||0)+day.revenue);}
  const current=weeks.get(start)||0;
  const previousWeeks=[...weeks.entries()].filter(([monday,revenue])=>monday<start&&revenue>0);
  if(current>0&&previousWeeks.length>=3&&current>Math.max(...previousWeeks.map(([,revenue])=>revenue)))
    list.push({id:'record-week',title:'Mi mejor semana',value:money(current),privateValue:'Récord',detail:`Vendí más que en cualquiera de las ${previousWeeks.length} semanas anteriores con ventas.`});

  let streak=0;
  for(let monday=start;;monday-=7*DAY){const now=weeks.get(monday)||0,before=weeks.get(monday-7*DAY)||0;if(before>0&&now>before)streak++;else break;}
  if(streak>=3)list.push({id:'growth-streak',title:'Semanas seguidas creciendo',value:`${streak} semanas`,privateValue:`${streak} semanas`,detail:'Cada semana vendí más que la anterior.'});

  const withSales=new Set(upToWeek.filter(day=>day.orders>0).map(day=>day.date));
  let salesDays=0;
  for(let day=end;withSales.has(iso(day));day-=DAY)salesDays++;
  if(salesDays>=7)list.push({id:'sales-streak',title:'Días seguidos vendiendo',value:`${salesDays} días`,privateValue:`${salesDays} días`,detail:'Todos los días con al menos una venta.'});

  const before=upToWeek.filter(day=>time(day.date)<start).reduce((sum,day)=>sum+day.orders,0);
  const total=upToWeek.reduce((sum,day)=>sum+day.orders,0);
  const crossed=MILESTONES.find(value=>before<value&&total>=value);
  if(crossed)list.push({id:'milestone-orders',title:`Superé las ${crossed.toLocaleString('es-AR')} órdenes`,value:total.toLocaleString('es-AR'),privateValue:`+${crossed.toLocaleString('es-AR')}`,detail:'Contando todo el historial de la tienda.'});

  // Mejor mes, solo si ese mes terminó durante la semana elegida.
  for(let day=start;day<=end;day+=DAY) {
    const date=new Date(day);
    if(new Date(day+DAY).getUTCMonth()===date.getUTCMonth())continue;
    const key=iso(day).slice(0,7);
    const months=new Map<string,number>();
    for(const row of upToWeek)months.set(row.date.slice(0,7),(months.get(row.date.slice(0,7))||0)+row.revenue);
    const month=months.get(key)||0;
    const earlier=[...months.entries()].filter(([name,revenue])=>name<key&&revenue>0);
    if(month>0&&earlier.length>=2&&month>Math.max(...earlier.map(([,revenue])=>revenue))) {
      const label=monthName.format(new Date(`${key}-01T00:00:00Z`));
      list.push({id:'record-month',title:`Mi mejor mes: ${label}`,value:money(month),privateValue:'Récord',detail:`Superó a los ${earlier.length} meses anteriores con ventas.`});
    }
  }
  return list;
}
