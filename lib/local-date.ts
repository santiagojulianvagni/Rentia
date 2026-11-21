// Días y meses en hora de Argentina (UTC−3, sin horario de verano desde 2009).
// Las plataformas guardan la hora de cada venta en UTC: una venta del viernes a las 21:30
// llega como "sábado 00:30". Para agrupar por día o por mes hay que pasarla a hora argentina.

const OFFSET_MS=3*60*60*1000;

// Día argentino (AAAA-MM-DD) de una fecha y hora en UTC. Una fecha sin hora queda igual.
export function argentinaDay(value:string):string {
  if(value.length<=10)return value;
  const time=Date.parse(value);
  return Number.isNaN(time)?value.slice(0,10):new Date(time-OFFSET_MS).toISOString().slice(0,10);
}

export const argentinaMonth=(value:string)=>argentinaDay(value).slice(0,7);

// Comienzo de un día argentino, en UTC: las 00:00 de Argentina son las 03:00 UTC.
export const argentinaDayStart=(day:string)=>`${day}T03:00:00.000Z`;

// Lo mismo en SQL (Postgres), para agrupar o filtrar por día o mes argentino.
export const ARGENTINA_DAY_SQL=(column:string)=>`(CASE WHEN length(${column})<=10 THEN ${column} ELSE to_char((${column}::timestamptz AT TIME ZONE 'UTC') - interval '3 hours','YYYY-MM-DD') END)`;
export const ARGENTINA_MONTH_SQL=(column:string)=>`left(${ARGENTINA_DAY_SQL(column)},7)`;
