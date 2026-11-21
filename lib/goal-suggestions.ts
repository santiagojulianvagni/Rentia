// Metas sugeridas para el mes, a partir de la facturación real de la tienda. Tres opciones:
// mantener el ritmo, crecer (la recomendada) y superar el mejor mes. Cuando se cumple la meta,
// se propone la siguiente. Los montos se redondean a números fáciles de recordar.

import type { SalesDay } from './mascot';

export type GoalSuggestion={key:'ritmo'|'crecer'|'record';label:string;detail:string;amount:number;recommended:boolean};

// Redondea hacia arriba a un número "lindo", con pasos más finos cuanto más chico el primer dígito:
// 1.234.567 → 1.250.000; 318.000 → 320.000; 5.400.000 → 5.500.000.
export function niceAmount(value:number):number {
  if(!(value>0))return 0;
  const magnitude=10**Math.floor(Math.log10(value)),leading=value/magnitude;
  const step=leading<2.5?magnitude/20:leading<5?magnitude/10:magnitude/4;
  return Math.round(Math.ceil(value/step-1e-9)*step);
}

// Facturación por mes (AAAA-MM) de los meses ya cerrados, del más viejo al más nuevo.
export function closedMonths(days:SalesDay[],today:string) {
  const current=today.slice(0,7),months=new Map<string,number>();
  for(const day of days){const month=day.date.slice(0,7);if(month<current)months.set(month,(months.get(month)||0)+day.revenue);}
  return [...months.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
}

const monthName=(month:string)=>new Intl.DateTimeFormat('es-AR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${month}-01T12:00:00Z`));

export function goalSuggestions(days:SalesDay[],today:string,projected:number,money:(value:number)=>string):GoalSuggestion[] {
  const months=closedMonths(days,today).filter(([,revenue])=>revenue>0);
  // Sin meses cerrados, la base es la proyección del mes en curso.
  if(!months.length){
    if(!(projected>0))return [];
    return [
      {key:'ritmo',label:'Mantener el ritmo',detail:`Lo que proyectamos para este mes (${money(projected)})`,amount:niceAmount(projected),recommended:false},
      {key:'crecer',label:'Crecer',detail:'Un 20 % arriba de tu ritmo actual',amount:niceAmount(projected*1.2),recommended:true},
    ];
  }
  const recent=months.slice(-3),average=recent.reduce((sum,[,revenue])=>sum+revenue,0)/recent.length;
  const [lastMonth,lastRevenue]=months[months.length-1];
  const [bestMonth,bestRevenue]=months.reduce((a,b)=>b[1]>a[1]?b:a);
  const growth=Math.max(average*1.15,lastRevenue*1.1);
  const list:GoalSuggestion[]=[
    {key:'ritmo',label:'Mantener el ritmo',detail:recent.length>1?`Tu promedio de los últimos ${recent.length} meses (${money(average)})`:`Lo que facturaste en ${monthName(lastMonth)} (${money(lastRevenue)})`,amount:niceAmount(average),recommended:false},
    {key:'crecer',label:'Crecer',detail:growth===lastRevenue*1.1?`Un 10 % más que ${monthName(lastMonth)}`:'Un 15 % más que tu promedio',amount:niceAmount(growth),recommended:true},
  ];
  // "Superar tu récord" solo si queda por encima de "crecer" y al alcance (hasta 1,5 veces esa
  // meta): un mes excepcional muy lejano no sirve como meta.
  const record=bestRevenue*1.05;
  if(niceAmount(record)>niceAmount(growth)&&record<=growth*1.5)list.push({key:'record',label:'Superar tu récord',detail:`Tu mejor mes fue ${monthName(bestMonth)} (${money(bestRevenue)})`,amount:niceAmount(bestRevenue*1.05),recommended:false});
  // Sin opciones repetidas: si dos dan lo mismo, queda la más ambiciosa con su explicación.
  const seen=new Set<number>();
  const unique=[...list].reverse().filter(item=>{if(seen.has(item.amount))return false;seen.add(item.amount);return true;}).reverse();
  // La recomendada es "crecer"; si se fusionó con otra, la más ambiciosa que quedó.
  const recommended=unique.some(item=>item.key==='crecer')?'crecer':unique[unique.length-1].key;
  return unique.map(item=>({...item,recommended:item.key===recommended}));
}

// Próxima meta cuando se cumple la actual: un escalón más arriba de lo ya facturado
// (20 % sobre la meta o sobre lo facturado, lo que sea mayor).
export function nextGoal(target:number,revenue:number) {
  return niceAmount(Math.max(target,revenue)*1.2);
}
