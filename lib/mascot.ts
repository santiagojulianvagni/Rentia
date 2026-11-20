// Lo que dice el cangurito en el panel: el saludo del día y los récords que festeja.
// Todo sale del historial de ventas por día de la propia tienda (/api/insights/records).

export type SalesDay={date:string;orders:number;revenue:number};
export type Lang='es'|'en'|'pt';
export type Moment='morning'|'afternoon'|'night';
// Partes de un texto: las marcadas se muestran en negrita y, si tienen tono, en verde o rojo.
export type Piece={text:string;strong?:boolean;tone?:'up'|'down'};
export type Greeting={pose:'saluda'|'duerme';pieces:Piece[]};
export type RecordKind='day'|'yesterday'|'week'|'month'|'orders';
export type LiveRecord={id:string;kind:RecordKind;value:number;previous:number;previousDate:string|null};

const DAY=24*60*60*1000;
const time=(date:string)=>Date.parse(`${date}T00:00:00Z`);
const iso=(value:number)=>new Date(value).toISOString().slice(0,10);
const shift=(date:string,days:number)=>iso(time(date)+days*DAY);
const mondayOf=(date:string)=>{const value=time(date);return iso(value-((new Date(value).getUTCDay()+6)%7)*DAY);};
const LOCALE:Record<Lang,string>={es:'es-AR',en:'en-US',pt:'pt-BR'};
export const ORDER_MILESTONES=[100,500,1000,5000,10000,50000,100000];

// Mismos cortes que el saludo del encabezado: buen día de 5 a 12, buenas tardes de 12 a 20.
export const momentOf=(hour:number):Moment=>hour>=5&&hour<12?'morning':hour>=12&&hour<20?'afternoon':'night';

// Fecha de hoy en la Argentina, que es la zona de las ventas.
export const todayInArgentina=(now=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);

const weekday=(date:string,lang:Lang)=>new Intl.DateTimeFormat(LOCALE[lang],{weekday:'long',timeZone:'UTC'}).format(new Date(time(date)));
const dayMonth=(date:string,lang:Lang)=>new Intl.DateTimeFormat(LOCALE[lang],{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(time(date)));
const monthYear=(month:string,lang:Lang)=>new Intl.DateTimeFormat(LOCALE[lang],{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(time(`${month}-01`)));
const monthOnly=(month:string,lang:Lang)=>new Intl.DateTimeFormat(LOCALE[lang],{month:'long',timeZone:'UTC'}).format(new Date(time(`${month}-01`)));
const capital=(text:string)=>text.charAt(0).toLocaleUpperCase()+text.slice(1);
const count=(value:number,lang:Lang)=>value.toLocaleString(LOCALE[lang]);
const orders=(value:number,lang:Lang)=>{
  const n=count(value,lang);
  if(lang==='en')return `${n} ${value===1?'order':'orders'}`;
  if(lang==='pt')return `${n} ${value===1?'pedido':'pedidos'}`;
  return `${n} ${value===1?'orden':'órdenes'}`;
};

// Texto que compara con el mismo día de la semana anterior.
function versus(current:number,before:number,date:string,lang:Lang):Piece[] {
  if(before<=0)return [{text:'.'}];
  const change=Math.round((current-before)/before*100),day=weekday(date,lang);
  if(change===0)return [{text:lang==='en'?`, the same as last ${day}.`:lang==='pt'?`, o mesmo que ${day==='sábado'||day==='domingo'?'no':'na'} ${day} passad${day==='sábado'||day==='domingo'?'o':'a'}.`:`, igual que el ${day} pasado.`}];
  const up=change>0,abs=`${Math.abs(change)} %`;
  const word=lang==='en'?(up?`${Math.abs(change)}% more`:`${Math.abs(change)}% less`):lang==='pt'?`${abs} ${up?'a mais':'a menos'}`:`${abs} ${up?'más':'menos'}`;
  const tail=lang==='en'?` than last ${day}.`:lang==='pt'?` que ${day==='sábado'||day==='domingo'?'no':'na'} ${day} passad${day==='sábado'||day==='domingo'?'o':'a'}.`:` que el ${day} pasado.`;
  return [{text:', '},{text:word,strong:true,tone:up?'up':'down'},{text:tail}];
}

// Saludo del día. Sin historial de ventas no dice nada: todavía no hay de qué hablar.
export function dailyGreeting(days:SalesDay[],today:string,hour:number,lang:Lang,money:(value:number)=>string):Greeting|null {
  if(!days.some(day=>day.orders>0))return null;
  const by=new Map(days.map(day=>[day.date,day]));
  const get=(date:string)=>by.get(date)||{date,orders:0,revenue:0};
  const moment=momentOf(hour),now=get(today),yesterday=get(shift(today,-1));
  if(moment==='morning'){
    if(yesterday.orders>0){
      const lead=lang==='en'?'Yesterday you sold ':lang==='pt'?'Ontem você vendeu ':'Ayer vendiste ';
      const mid=lang==='en'?` in ${orders(yesterday.orders,lang)}`:lang==='pt'?` em ${orders(yesterday.orders,lang)}`:` en ${orders(yesterday.orders,lang)}`;
      return {pose:'saluda',pieces:[{text:lead},{text:money(yesterday.revenue),strong:true},{text:mid},...versus(yesterday.revenue,get(shift(today,-8)).revenue,yesterday.date,lang)]};
    }
    return {pose:'saluda',pieces:[{text:lang==='en'?'No sales came in yesterday. Let’s make today a great day!':lang==='pt'?'Ontem não entraram vendas. Que hoje seja um ótimo dia!':'Ayer no entraron ventas. ¡Que hoy sea un gran día!'}]};
  }
  if(moment==='afternoon'){
    if(now.orders>0){
      const lead=lang==='en'?'So far today you have ':lang==='pt'?'Hoje você já tem ':'Hoy llevás ';
      const mid=lang==='en'?` in ${orders(now.orders,lang)}.`:lang==='pt'?` em ${orders(now.orders,lang)}.`:` en ${orders(now.orders,lang)}.`;
      const last=get(shift(today,-7)),day=weekday(last.date,lang);
      const tail:Piece[]=last.revenue>0?[{text:lang==='en'?` Last ${day} closed at `:lang==='pt'?` ${capital(day)} passad${day==='sábado'||day==='domingo'?'o':'a'} fechou com `:` El ${day} pasado cerraste con `},{text:money(last.revenue),strong:true},{text:'.'}]:[];
      return {pose:'saluda',pieces:[{text:lead},{text:money(now.revenue),strong:true},{text:mid},...tail]};
    }
    const tail:Piece[]=yesterday.revenue>0?[{text:lang==='en'?' Yesterday closed at ':lang==='pt'?' Ontem fechou com ':' Ayer cerraste con '},{text:money(yesterday.revenue),strong:true},{text:'.'}]:[];
    return {pose:'saluda',pieces:[{text:lang==='en'?'No sales yet today.':lang==='pt'?'Ainda não entrou nenhuma venda hoje.':'Todavía no entró ninguna venta hoy.'},...tail]};
  }
  if(now.orders>0){
    const lead=lang==='en'?'Good work today: ':lang==='pt'?'Hoje você vendeu ':'Hoy llevás ';
    const tail=lang==='en'?` in sales. Tomorrow I’ll tell you how the day closed.`:lang==='pt'?`. Amanhã te conto como o dia fechou.`:` vendidos. Mañana te cuento cómo cerró el día.`;
    return {pose:'duerme',pieces:[{text:lead},{text:money(now.revenue),strong:true},{text:tail}]};
  }
  return {pose:'duerme',pieces:[{text:lang==='en'?'No sales today yet. Tomorrow I’ll tell you how the day starts.':lang==='pt'?'Hoje ainda não entraram vendas. Amanhã te conto como o dia começa.':'Hoy todavía no entraron ventas. Mañana te cuento cómo arranca el día.'}]};
}

// Récords vigentes, del más importante al menos importante. Cada uno tiene un id fijo para
// festejarlo una sola vez. Se pide un mínimo de historial para que "récord" signifique algo.
export function liveRecords(days:SalesDay[],today:string):LiveRecord[] {
  const past=days.filter(day=>day.date<=today);
  const list:LiveRecord[]=[];
  const by=new Map(past.map(day=>[day.date,day]));
  const yesterday=shift(today,-1);

  // Hitos de órdenes cruzados hoy o ayer.
  const total=past.reduce((sum,day)=>sum+day.orders,0);
  const recent=(by.get(today)?.orders||0)+(by.get(yesterday)?.orders||0);
  const milestone=[...ORDER_MILESTONES].reverse().find(value=>total-recent<value&&total>=value);
  if(milestone)list.push({id:`orders-${milestone}`,kind:'orders',value:total,previous:milestone,previousDate:null});

  // Mejor mes (con al menos 3 meses anteriores con ventas).
  const months=new Map<string,number>();
  for(const day of past)months.set(day.date.slice(0,7),(months.get(day.date.slice(0,7))||0)+day.revenue);
  const month=today.slice(0,7),monthNow=months.get(month)||0;
  const prevMonths=[...months.entries()].filter(([key,value])=>key<month&&value>0);
  if(monthNow>0&&prevMonths.length>=3){const best=prevMonths.reduce((a,b)=>b[1]>a[1]?b:a);if(monthNow>best[1])list.push({id:`month-${month}`,kind:'month',value:monthNow,previous:best[1],previousDate:best[0]});}

  // Mejor semana de lunes a domingo (con al menos 4 semanas anteriores con ventas).
  const weeks=new Map<string,number>();
  for(const day of past){const key=mondayOf(day.date);weeks.set(key,(weeks.get(key)||0)+day.revenue);}
  const week=mondayOf(today),weekNow=weeks.get(week)||0;
  const prevWeeks=[...weeks.entries()].filter(([key,value])=>key<week&&value>0);
  if(weekNow>0&&prevWeeks.length>=4){const best=prevWeeks.reduce((a,b)=>b[1]>a[1]?b:a);if(weekNow>best[1])list.push({id:`week-${week}`,kind:'week',value:weekNow,previous:best[1],previousDate:best[0]});}

  // Mejor día: hoy o, si no, ayer (con al menos 14 días anteriores con ventas).
  for(const [date,kind] of [[today,'day'],[yesterday,'yesterday']] as const){
    const value=by.get(date)?.revenue||0;
    const before=past.filter(day=>day.date<date&&day.revenue>0);
    if(value<=0||before.length<14)continue;
    const best=before.reduce((a,b)=>b.revenue>a.revenue?b:a);
    if(value>best.revenue){list.push({id:`day-${date}`,kind,value,previous:best.revenue,previousDate:best.date});break;}
  }
  return list;
}

// Textos del festejo de un récord.
export function recordText(record:LiveRecord,today:string,lang:Lang,money:(value:number)=>string):{tag:string;title:string;pieces:Piece[]} {
  const tag=record.kind==='orders'?(lang==='en'?'NEW MILESTONE!':lang==='pt'?'NOVO MARCO!':'¡NUEVO LOGRO!'):(lang==='en'?'NEW RECORD!':lang==='pt'?'NOVO RECORDE!':'¡NUEVO RÉCORD!');
  const v={text:money(record.value),strong:true},prev=money(record.previous);
  const at=record.previousDate?dayMonth(record.previousDate,lang):'';
  switch(record.kind){
    case 'day':return {tag,title:lang==='en'?'Today is your best sales day ever':lang==='pt'?'Hoje é o seu melhor dia de vendas':'Hoy es tu mejor día de ventas',
      pieces:lang==='en'?[{text:'You have sold '},v,{text:` so far. Your previous record was ${prev}, on ${at}.`}]:lang==='pt'?[{text:'Você já vendeu '},v,{text:`. Seu recorde anterior era de ${prev}, em ${at}.`}]:[{text:'Llevás '},v,{text:` vendidos. Tu marca anterior era de ${prev}, el ${at}.`}]};
    case 'yesterday':return {tag,title:lang==='en'?'Yesterday was your best sales day ever':lang==='pt'?'Ontem foi o seu melhor dia de vendas':'Ayer fue tu mejor día de ventas',
      pieces:lang==='en'?[{text:'You sold '},v,{text:`. Your previous record was ${prev}, on ${at}.`}]:lang==='pt'?[{text:'Você vendeu '},v,{text:`. Seu recorde anterior era de ${prev}, em ${at}.`}]:[{text:'Vendiste '},v,{text:`. Tu marca anterior era de ${prev}, el ${at}.`}]};
    case 'week':return {tag,title:lang==='en'?'This is your best week ever':lang==='pt'?'Esta é a sua melhor semana':'Esta es tu mejor semana',
      pieces:lang==='en'?[{text:'You have sold '},v,{text:` since Monday. Your previous best week was ${prev}.`}]:lang==='pt'?[{text:'Você já vendeu '},v,{text:` desde segunda-feira. Sua melhor semana anterior foi de ${prev}.`}]:[{text:'Llevás '},v,{text:` vendidos desde el lunes. Tu mejor semana anterior fue de ${prev}.`}]};
    case 'month':{const name=capital(monthOnly(today.slice(0,7),lang)),before=record.previousDate?monthYear(record.previousDate,lang):'';return {tag,title:lang==='en'?`${name} is already your best month`:lang==='pt'?`${name} já é o seu melhor mês`:`${name} ya es tu mejor mes`,
      pieces:lang==='en'?[{text:'You have sold '},v,{text:`. Your previous best month was ${before}, with ${prev}.`}]:lang==='pt'?[{text:'Você já vendeu '},v,{text:`. Seu melhor mês anterior foi ${before}, com ${prev}.`}]:[{text:'Llevás '},v,{text:` vendidos. Tu mejor mes anterior fue ${before}, con ${prev}.`}]};}
    case 'orders':{const next=ORDER_MILESTONES.find(value=>value>record.value),goal=count(record.previous,lang),all=count(record.value,lang),nextText=next?count(next,lang):'';return {tag,title:lang==='en'?`You reached ${goal} sales!`:lang==='pt'?`Você chegou a ${goal} vendas!`:`¡Llegaste a las ${goal} ventas!`,
      pieces:lang==='en'?[{text:'You already have '},{text:all,strong:true},{text:` sales in total.${next?` Next stop: ${nextText}.`:''}`}]:lang==='pt'?[{text:'Já são '},{text:all,strong:true},{text:` vendas no total.${next?` Próxima meta: ${nextText}.`:''}`}]:[{text:'Ya son '},{text:all,strong:true},{text:` ventas en total.${next?` ¡Vamos por las ${nextText}!`:''}`}]};}
  }
}
