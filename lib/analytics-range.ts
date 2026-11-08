import type { AnalyticsDateRange } from '../db/database';

const DAY=24*60*60*1000;

function validDate(value:string|null) {
  if (!value||!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed=new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==value?null:parsed;
}

export function analyticsRangeFromUrl(url:URL) {
  const startValue=url.searchParams.get('start');
  const endValue=url.searchParams.get('end');
  const start=validDate(startValue);
  const end=validDate(endValue);
  if (start&&end&&start<=end) {
    const days=Math.floor((end.getTime()-start.getTime())/DAY)+1;
    return {days,range:{start:startValue!,end:endValue!} satisfies AnalyticsDateRange};
  }
  const requested=Number(url.searchParams.get('days')||30);
  return {days:[7,30,90,365].includes(requested)?requested:30,range:undefined};
}

export type AnalyticsWindow={days:number;range:AnalyticsDateRange|undefined;historyFrom?:string};

// Recorta un rango personalizado para que no empiece antes del historial visible del plan.
// Los rangos rápidos (7, 30, 90 y 365 días) siempre entran en el plan más chico (12 meses).
export function clampToHistory(window:{days:number;range:AnalyticsDateRange|undefined},firstVisible:string|null):AnalyticsWindow {
  if (!firstVisible||!window.range||window.range.start>=firstVisible) return window;
  const end=window.range.end<firstVisible?firstVisible:window.range.end;
  const days=Math.floor((Date.parse(`${end}T00:00:00.000Z`)-Date.parse(`${firstVisible}T00:00:00.000Z`))/DAY)+1;
  return {days,range:{start:firstVisible,end},historyFrom:firstVisible};
}
