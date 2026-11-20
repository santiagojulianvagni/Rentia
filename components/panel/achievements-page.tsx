'use client';

import { useEffect, useState } from 'react';
import { CalendarRange, Flame, Share2, Sun, Target, TrendingUp, Trophy, type LucideIcon } from 'lucide-react';
import { Mascot, useSalesHistory } from './mascot';
import ShareDialog, { type ShareContent } from './share-card';
import { buildAchievementShare } from './achievement-share';
import { achievementHistory, type AchievementEvent, type AchievementKind } from '../../lib/achievement-history';
import { todayInArgentina } from '../../lib/mascot';

type Lang='es'|'en'|'pt';
const LOCALE:Record<Lang,string>={es:'es-AR',en:'en-US',pt:'pt-BR'};
const ICONS:Record<AchievementKind,LucideIcon>={day:Sun,week:CalendarRange,month:Trophy,orders:Target,streak:Flame,growth:TrendingUp};
const time=(date:string)=>new Date(`${date}T12:00:00Z`);

// Textos de la sección en los tres idiomas del panel.
const COPY={
  es:{eyebrow:'TU CUENTA',title:'Mis',titleEm:'logros',lead:'Cada récord y cada meta que alcanzó tu tienda, con la fecha. Se calculan con tu historial de ventas, así que también aparecen los de antes de usar Rentia.',count:'Logros',since:'desde',bestDay:'Mejor día',bestMonth:'Mejor mes',total:'Ventas totales',fromStart:'desde la primera venta',next:'Próximo logro',sales:'ventas',left:'Te faltan',share:'Compartir',loading:'Buscando tus logros…',none:'Todavía no hay logros. Con unas semanas de ventas empiezan a aparecer tus récords.',all:'Llegaste a todas las metas de ventas. ¡Impresionante!'},
  en:{eyebrow:'YOUR ACCOUNT',title:'My',titleEm:'achievements',lead:'Every record and goal your store reached, with its date. They come from your sales history, so achievements from before Rentia show up too.',count:'Achievements',since:'since',bestDay:'Best day',bestMonth:'Best month',total:'Total sales',fromStart:'since the first sale',next:'Next achievement',sales:'sales',left:'Remaining',share:'Share',loading:'Looking for your achievements…',none:'No achievements yet. After a few weeks of sales your records start to show up.',all:'You reached every sales goal. Impressive!'},
  pt:{eyebrow:'SUA CONTA',title:'Minhas',titleEm:'conquistas',lead:'Cada recorde e cada meta que sua loja alcançou, com a data. Elas vêm do seu histórico de vendas, então também aparecem as de antes do Rentia.',count:'Conquistas',since:'desde',bestDay:'Melhor dia',bestMonth:'Melhor mês',total:'Vendas totais',fromStart:'desde a primeira venda',next:'Próxima conquista',sales:'vendas',left:'Faltam',share:'Compartilhar',loading:'Buscando suas conquistas…',none:'Ainda não há conquistas. Com algumas semanas de vendas seus recordes começam a aparecer.',all:'Você alcançou todas as metas de vendas. Impressionante!'},
};

function describe(event:AchievementEvent,lang:Lang,money:(value:number)=>string):{title:string;detail:string;value:string} {
  const locale=LOCALE[lang],n=(value:number)=>value.toLocaleString(locale);
  const dayMonth=(date:string)=>new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',timeZone:'UTC'}).format(time(date));
  const monthYear=(month:string)=>new Intl.DateTimeFormat(locale,{month:'long',year:'numeric',timeZone:'UTC'}).format(time(`${month}-01`));
  const prev=event.previous===null?'':money(event.previous);
  switch(event.kind){
    case 'day':return {value:money(event.value),title:lang==='en'?'Best sales day':lang==='pt'?'Melhor dia de vendas':'Mejor día de ventas',detail:lang==='en'?`Beat ${prev} from ${dayMonth(event.previousDate!)}`:lang==='pt'?`Superou ${prev} de ${dayMonth(event.previousDate!)}`:`Superó los ${prev} del ${dayMonth(event.previousDate!)}`};
    case 'week':return {value:money(event.value),title:lang==='en'?'Best week':lang==='pt'?'Melhor semana':'Mejor semana',detail:lang==='en'?`Beat the week of ${dayMonth(event.previousDate!)} (${prev})`:lang==='pt'?`Superou a semana de ${dayMonth(event.previousDate!)} (${prev})`:`Superó la semana del ${dayMonth(event.previousDate!)} (${prev})`};
    case 'month':return {value:money(event.value),title:lang==='en'?'Best month':lang==='pt'?'Melhor mês':'Mejor mes',detail:lang==='en'?`Beat ${monthYear(event.previousDate!)} (${prev})`:lang==='pt'?`Superou ${monthYear(event.previousDate!)} (${prev})`:`Superó a ${monthYear(event.previousDate!)} (${prev})`};
    case 'orders':return {value:n(event.value),title:lang==='en'?`You reached ${n(event.value)} sales`:lang==='pt'?`Você chegou a ${n(event.value)} vendas`:`Llegaste a las ${n(event.value)} ventas`,detail:lang==='en'?'Counting every paid order':lang==='pt'?'Contando todos os pedidos pagos':'Contando todas las órdenes pagas'};
    case 'streak':return {value:lang==='en'?`${event.value} days`:lang==='pt'?`${event.value} dias`:`${event.value} días`,title:lang==='en'?`${event.value} days in a row with sales`:lang==='pt'?`${event.value} dias seguidos vendendo`:`${event.value} días seguidos vendiendo`,detail:lang==='en'?'At least one sale every day':lang==='pt'?'Pelo menos uma venda por dia':'Al menos una venta todos los días'};
    case 'growth':return {value:lang==='en'?`${event.value} weeks`:lang==='pt'?`${event.value} semanas`:`${event.value} semanas`,title:lang==='en'?`${event.value} weeks in a row growing`:lang==='pt'?`${event.value} semanas seguidas crescendo`:`${event.value} semanas seguidas creciendo`,detail:lang==='en'?'Each week sold more than the previous one':lang==='pt'?'Cada semana vendeu mais que a anterior':'Cada semana vendió más que la anterior'};
  }
}

export default function AchievementsPage({storeName,money,language}:{storeName:string;money:(value:number)=>string;language:string}) {
  const days=useSalesHistory();
  const lang=(language in COPY?language:'es') as Lang,copy=COPY[lang],locale=LOCALE[lang];
  const [today,setToday]=useState<string|null>(null);
  const [share,setShare]=useState<ShareContent|null>(null);
  const [preparing,setPreparing]=useState<string|null>(null);
  useEffect(()=>{queueMicrotask(()=>setToday(todayInArgentina()));},[]);
  const head=<div className="p-head"><div><div className="p-eyebrow">{copy.eyebrow}</div><h1>{copy.title} <em>{copy.titleEm}</em></h1><p>{copy.lead}</p></div></div>;
  if(!days||!today)return <div translate="no">{head}<div className="p-card p-empty">{copy.loading}</div></div>;

  const data=achievementHistory(days,today);
  const fullDate=(date:string)=>new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(time(date));
  const shortDate=(date:string)=>new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(time(date));
  const monthYear=(month:string)=>new Intl.DateTimeFormat(locale,{month:'long',year:'numeric',timeZone:'UTC'}).format(time(`${month}-01`));
  const groups=new Map<string,AchievementEvent[]>();
  for(const event of data.events){const key=event.date.slice(0,7);groups.set(key,[...(groups.get(key)||[]),event]);}
  // La imagen trae datos extra (producto estrella, provincias) que se piden al tocar Compartir.
  const shareEvent=async(event:AchievementEvent)=>{setPreparing(event.id);try{setShare(await buildAchievementShare(event,days,today,money));}finally{setPreparing(null);}};

  return <div translate="no">
    {head}
    <div className="p-lgHero p-reveal">
      <Mascot pose="festeja" size={92}/>
      <div className="p-lgStats">
        <div className="p-lgStat"><small>{copy.count}</small><b>{data.events.length.toLocaleString(locale)}</b><span>{data.firstSale?`${copy.since} ${monthYear(data.firstSale.slice(0,7))}`:'—'}</span></div>
        <div className="p-lgStat"><small>{copy.bestDay}</small><b className="p-mono">{data.bestDay?money(data.bestDay.value):'—'}</b><span>{data.bestDay?fullDate(data.bestDay.date):'—'}</span></div>
        <div className="p-lgStat"><small>{copy.bestMonth}</small><b className="p-mono">{data.bestMonth?money(data.bestMonth.value):'—'}</b><span>{data.bestMonth?monthYear(data.bestMonth.month):'—'}</span></div>
        <div className="p-lgStat"><small>{copy.total}</small><b className="p-mono">{data.totalOrders.toLocaleString(locale)}</b><span>{copy.fromStart}</span></div>
      </div>
    </div>
    <div className="p-card p-lgNext p-reveal">
      <span className="p-lgIcon"><Target className="p-i" aria-hidden="true"/></span>
      {data.next?<><div><b>{copy.next}: {data.next.goal.toLocaleString(locale)} {copy.sales}</b><small className="p-sub">{copy.left} {data.next.remaining.toLocaleString(locale)}</small></div><div className="p-lgBar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(data.next.progress*100)}><i style={{width:`${Math.round(data.next.progress*100)}%`}}/></div></>:<b>{copy.all}</b>}
    </div>
    {!data.events.length&&<div className="p-card p-empty">{copy.none}</div>}
    {[...groups.entries()].map(([month,events])=><section key={month}>
      <div className="p-lgMonth">{monthYear(month).toLocaleUpperCase(locale)}</div>
      {events.map(event=>{const Icon=ICONS[event.kind],text=describe(event,lang,money);return <div className="p-lgItem" key={event.id}>
        <span className="p-lgIcon"><Icon className="p-i" aria-hidden="true"/></span>
        <div className="p-lgText"><b>{text.title}</b><small>{text.detail}</small></div>
        <b className="p-mono p-lgValue">{text.value}</b>
        <time className="p-lgDate" dateTime={event.date}>{shortDate(event.date)}</time>
        <button type="button" className="p-btn p-small" onClick={()=>void shareEvent(event)} disabled={preparing!==null}><Share2 className="p-i" aria-hidden="true"/>{preparing===event.id?'…':copy.share}</button>
      </div>;})}
    </section>)}
    {share&&<ShareDialog content={share} storeName={storeName} onClose={()=>setShare(null)}/>}
  </div>;
}
