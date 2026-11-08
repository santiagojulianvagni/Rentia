// Semana anterior (lunes a domingo, hora de Argentina) para el resumen semanal por mail.
const DAY=86400000;
const iso=(date:Date)=>date.toISOString().slice(0,10);

export function previousWeek(now=new Date()) {
  const local=new Date(now.getTime()-3*3600000); // Argentina, UTC-3
  const weekday=(local.getUTCDay()+6)%7; // lunes=0
  const thisMonday=new Date(Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate()-weekday));
  const from=new Date(thisMonday.getTime()-7*DAY),to=new Date(thisMonday.getTime()-DAY);
  return {isMonday:weekday===0,from:iso(from),to:iso(to),prevFrom:iso(new Date(from.getTime()-7*DAY)),prevTo:iso(new Date(from.getTime()-DAY))};
}

