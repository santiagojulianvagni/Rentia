'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Share2 } from 'lucide-react';
import RpChart from './rp-chart';
import ShareDialog, { type ShareContent } from './share-card';
import { achievements } from '../../lib/achievements';
import { buildAlerts, type AlertSettings } from '../../lib/alerts';
import { campaignMargins, campaignProfits, type MeliCampaignInput, type MetaCampaignInput } from '../../lib/campaign-profit';

type WeekMetrics={revenue:number;totalRevenue:number;profit:number;profitBeforeAds:number;margin:number;orders:number;totalOrders:number;totalAdSpend?:number;adSpend:number;reportedRoas:number;totalAov:number;adSpendComparable:boolean;meliAdsComparable?:boolean};
type WeekDashboard={metrics:WeekMetrics;timeline:Array<{date:string;storeRevenue:number;externalRevenue:number;profit:number}>;channels:Array<{provider:string;revenue:number;orders:number;completeOrders:number;profit:number|null;profitBeforeAds?:number|null}>;quality:{completeOrders:number;totalOrders:number};ads:{connected:boolean};meliAds?:{connected:boolean;campaigns:MeliCampaignInput[]};sync:{status:string}|null};
type WeekProduct={product_name:string;units_sold:number;profit:number;stock:number|null;days_stock:number|null;rentia_archived:number};
type Week={start:string;end:string};

const DAY=24*60*60*1000;
const iso=(date:Date)=>date.toISOString().slice(0,10);
// Semanas de lunes a domingo en la hora de Argentina; offset 0 es la última semana completa.
export function completedWeek(offset:number,now=Date.now()):Week {
  const local=new Date(now-3*60*60*1000);
  const today=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate());
  const monday=today-((new Date(today).getUTCDay()+6)%7)*DAY;
  const start=monday-7*DAY*(offset+1);
  return {start:iso(new Date(start)),end:iso(new Date(start+6*DAY))};
}
const dayMonth=new Intl.DateTimeFormat('es-AR',{day:'numeric',month:'long',timeZone:'UTC'});
const shortDay=new Intl.DateTimeFormat('es-AR',{weekday:'short',day:'numeric',timeZone:'UTC'});
const weekLabel=(week:Week)=>`${dayMonth.format(new Date(`${week.start}T00:00:00Z`)).replace(/ de \w+$/,'')} al ${dayMonth.format(new Date(`${week.end}T00:00:00Z`))}`;
const change=(current:number,previous:number|undefined)=>previous?((current-previous)/Math.abs(previous))*100:null;
const signed=(value:number|null)=>value===null?'—':`${value>0?'+':''}${Math.round(value)}%`;

function Delta({value,inverse=false}:{value:number|null;inverse?:boolean}) {
  if(value===null)return <span className="p-sub">Sin semana anterior</span>;
  const good=inverse?value<0:value>0;
  return <span className={`p-chip ${Math.abs(value)<1?'p-n':good?'p-g':'p-r'}`}>{signed(value)} vs semana anterior</span>;
}

async function getJson<T>(url:string):Promise<T|null> {
  const response=await fetch(url,{cache:'no-store'});
  return response.ok?await response.json() as T:null;
}

export default function WeeklySummary({money,storeName,settings,onNavigate}:{money:(value:number)=>string;storeName:string;settings:AlertSettings;onNavigate:(section:string)=>void}) {
  const [offset,setOffset]=useState(0);
  const week=useMemo(()=>completedWeek(offset),[offset]);
  const previousWeek=useMemo(()=>completedWeek(offset+1),[offset]);
  const [data,setData]=useState<{current:WeekDashboard|null;previous:WeekDashboard|null;products:WeekProduct[];meta:MetaCampaignInput[]}|null>(null);
  const [error,setError]=useState(false);
  const [share,setShare]=useState<ShareContent|null>(null);

  useEffect(()=>{
    let cancelled=false;
    const query=(range:Week)=>`start=${range.start}&end=${range.end}`;
    void Promise.resolve().then(()=>{if(!cancelled){setData(null);setError(false);}});
    Promise.all([getJson<WeekDashboard>(`/api/dashboard?${query(week)}`),getJson<WeekDashboard>(`/api/dashboard?${query(previousWeek)}`),getJson<WeekProduct[]|{products?:WeekProduct[];rows?:WeekProduct[]}>(`/api/products/analytics?${query(week)}`),getJson<{campaigns?:MetaCampaignInput[]}>(`/api/ads?${query(week)}`)])
      .then(([current,previous,products,ads])=>{
        if(cancelled)return;
        if(!current){setError(true);return;}
        const productRows=Array.isArray(products)?products:products?.rows||products?.products||[];
        setData({current,previous,products:productRows.filter(row=>!row.rentia_archived),meta:ads?.campaigns||[]});
      }).catch(()=>{if(!cancelled)setError(true);});
    return ()=>{cancelled=true;};
  },[week,previousWeek]);

  const label=weekLabel(week);
  const view=useMemo(()=>{
    if(!data?.current)return null;
    const {current,previous}=data,m=current.metrics,p=previous?.metrics;
    const margins=campaignMargins(current);
    const campaigns=campaignProfits({meta:m.adSpendComparable?data.meta:[],mercadolibre:m.meliAdsComparable?current.meliAds?.campaigns||[]:[],metaMargin:margins.meta,meliMargin:margins.mercadolibre});
    const metrics={revenue:m.totalRevenue,profit:m.profit,margin:m.margin,orders:m.totalOrders};
    const previousMetrics=p?{revenue:p.totalRevenue,profit:p.profit,margin:p.margin,orders:p.totalOrders}:null;
    const alerts=buildAlerts({metrics,previous:previousMetrics,quality:current.quality,adsConnected:current.ads.connected,syncError:current.sync?.status==='error',products:data.products,missingCosts:0,campaigns,settings,money});
    const wins=achievements({...metrics,reportedRoas:m.reportedRoas,adSpend:m.adSpend},previousMetrics,current.timeline,money);
    const days=current.timeline.map(day=>({label:shortDay.format(new Date(`${day.date}T00:00:00Z`)),revenue:day.storeRevenue+day.externalRevenue,profit:day.profit}));
    const best=current.timeline.reduce<typeof current.timeline[number]|null>((top,day)=>!top||day.storeRevenue+day.externalRevenue>top.storeRevenue+top.externalRevenue?day:top,null);
    const topProducts=[...data.products].filter(row=>row.units_sold>0).sort((a,b)=>b.profit-a.profit).slice(0,3);
    const losing=campaigns.filter(row=>row.verdict==='pierde');
    const winning=[...campaigns].filter(row=>row.verdict==='gana').sort((a,b)=>(b.profit||0)-(a.profit||0));
    const story=[
      m.totalOrders?`Vendiste ${money(m.totalRevenue)} en ${m.totalOrders.toLocaleString('es-AR')} ${m.totalOrders===1?'orden':'órdenes'}${p?.totalRevenue?` (${signed(change(m.totalRevenue,p.totalRevenue))} frente a la semana anterior)`:''} y te quedó una ganancia de ${money(m.profit)}, un margen de ${m.margin.toFixed(1).replace('.',',')}%.`:'No hubo ventas registradas esta semana.',
      best&&best.storeRevenue+best.externalRevenue>0?`Tu mejor día fue el ${shortDay.format(new Date(`${best.date}T00:00:00Z`))}, con ${money(best.storeRevenue+best.externalRevenue)}.`:'',
      topProducts[0]?`El producto que más ganancia dejó fue ${topProducts[0].product_name} (${money(topProducts[0].profit)}).`:'',
      losing[0]?`Ojo: la campaña ${losing[0].name} perdió ${money(Math.abs(losing[0].profit||0))} estimados.`:winning[0]?`La campaña ${winning[0].name} dejó ${money(winning[0].profit||0)} de ganancia estimada.`:'',
    ].filter(Boolean);
    return {m,p,campaigns,alerts,wins,days,topProducts,losing,winning,story};
  },[data,settings,money]);

  const shareWeek=()=>{if(!view)return;const {m,p}=view;setShare({eyebrow:'Resumen semanal',title:'Mi semana en números',period:`Semana del ${label}`,stats:[
    {label:'Facturación',value:money(m.totalRevenue),privateValue:signed(change(m.totalRevenue,p?.totalRevenue))},
    {label:'Ganancia',value:money(m.profit),privateValue:signed(change(m.profit,p?.profit))},
    {label:'Margen real',value:`${m.margin.toFixed(1).replace('.',',')}%`,privateValue:`${m.margin.toFixed(1).replace('.',',')}%`},
    {label:'Órdenes',value:m.totalOrders.toLocaleString('es-AR'),privateValue:signed(change(m.totalOrders,p?.totalOrders))},
  ]});};

  return <>
    <div className="p-head"><div><div className="p-eyebrow">RESUMEN SEMANAL</div><h1>Semana del <em>{label}</em></h1><p>Lo más importante de la semana en un minuto: cuánto vendiste, cuánto ganaste y qué conviene revisar.</p></div>
      <div className="p-actions">
        <div className="p-weekNav"><button type="button" className="p-iconBtn" onClick={()=>setOffset(value=>value+1)} aria-label="Semana anterior"><ChevronLeft className="p-i" aria-hidden="true"/></button><button type="button" className="p-iconBtn" onClick={()=>setOffset(value=>Math.max(0,value-1))} disabled={offset===0} aria-label="Semana siguiente"><ChevronRight className="p-i" aria-hidden="true"/></button></div>
        <button type="button" className="p-btn p-primary" onClick={shareWeek} disabled={!view}><Share2 className="p-i" aria-hidden="true"/>Compartir</button>
      </div>
    </div>
    {error?<div className="p-empty" role="alert">No pudimos cargar la semana. <button type="button" className="p-btn p-small" onClick={()=>setOffset(value=>value)}>Reintentar</button></div>
    :!view?<div className="p-empty" role="status">Preparando el resumen…</div>
    :<>
      <div className="p-card p-reveal p-weekStory"><span className="p-eyebrowS">EN POCAS PALABRAS</span>{view.story.map(line=><p key={line}>{line}</p>)}</div>
      <div className="p-grid p-g4" style={{marginBottom:16}}>
        {([['Facturación',money(view.m.totalRevenue),change(view.m.totalRevenue,view.p?.totalRevenue),false],['Ganancia',money(view.m.profit),change(view.m.profit,view.p?.profit),false],['Margen real',`${view.m.margin.toFixed(1).replace('.',',')}%`,view.p&&view.p.totalRevenue>0?view.m.margin-view.p.margin:null,false],['Órdenes',view.m.totalOrders.toLocaleString('es-AR'),change(view.m.totalOrders,view.p?.totalOrders),false],['Inversión publicitaria',money(view.m.totalAdSpend??view.m.adSpend),change(view.m.totalAdSpend??view.m.adSpend,view.p?.totalAdSpend??view.p?.adSpend),true],['Ticket promedio',money(view.m.totalAov),change(view.m.totalAov,view.p?.totalAov),false]] as const).map(([title,value,delta,inverse],index)=>
          <div key={title} className={`p-card p-kpi p-reveal ${title==='Ganancia'?'p-hero':''}`} style={{'--i':index} as React.CSSProperties}><small><span className="p-kpiLabel">{title}</span></small><b className="p-mono">{value}</b>{title==='Margen real'&&delta!==null?<span className={`p-chip ${Math.abs(delta)<0.5?'p-n':delta>0?'p-g':'p-r'}`}>{delta>0?'+':''}{delta.toFixed(1).replace('.',',')} pts</span>:<Delta value={delta} inverse={inverse}/>}</div>)}
      </div>
      <div className="p-grid p-g2" style={{marginBottom:16}}>
        <div className="p-card p-reveal"><div className="p-cardHead"><div><span className="p-eyebrowS">DÍA POR DÍA</span><h3>Facturación y ganancia</h3></div></div>{view.days.some(day=>day.revenue>0)?<RpChart data={view.days} valueKey="revenue" secondKey="profit" type="bar" color="#3b8cff" secondColor="#21d4c2" height={220} format={value=>money(value)} name="Facturación" secondName="Ganancia"/>:<div className="p-empty">Sin ventas esta semana.</div>}</div>
        <div className="p-card p-reveal"><div className="p-cardHead"><div><span className="p-eyebrowS">PRODUCTOS</span><h3>Los que más ganancia dejaron</h3></div><button type="button" className="p-btn p-small" onClick={()=>onNavigate('productos')}>Ver productos</button></div>
          {view.topProducts.length?<ol className="p-weekList">{view.topProducts.map(row=><li key={row.product_name}><span title={row.product_name}>{row.product_name}</span><small className="p-sub">{row.units_sold} u.</small><b className={`p-mono ${row.profit<0?'p-neg':'p-pos'}`}>{money(row.profit)}</b></li>)}</ol>:<div className="p-empty">Sin productos vendidos esta semana.</div>}
        </div>
      </div>
      <div className="p-grid p-g2" style={{marginBottom:16}}>
        <div className="p-card p-reveal"><div className="p-cardHead"><div><span className="p-eyebrowS">PUBLICIDAD</span><h3>Campañas de la semana</h3></div><button type="button" className="p-btn p-small" onClick={()=>onNavigate('publicidad')}>Ver campañas</button></div>
          {view.campaigns.length?<ul className="p-weekList">{[...view.losing.slice(0,2),...view.winning.slice(0,2)].map(row=><li key={row.key}><span title={row.name}>{row.name}</span><span className={`p-chip ${row.verdict==='gana'?'p-g':'p-r'}`}>{row.verdict==='gana'?'Gana':'Pierde'}</span><b className={`p-mono ${(row.profit||0)<0?'p-neg':'p-pos'}`}>{money(row.profit||0)}</b></li>)}{!view.losing.length&&!view.winning.length&&<li><span className="p-sub">Las campañas estuvieron en equilibrio o falta el margen para estimarlas.</span></li>}</ul>:<div className="p-empty">Sin inversión publicitaria esta semana.</div>}
        </div>
        <div className="p-card p-reveal"><div className="p-cardHead"><div><span className="p-eyebrowS">PARA REVISAR</span><h3>Alertas de la semana</h3></div></div>
          {view.alerts.filter(alert=>alert.kind!=='info').length?<ul className="p-weekList">{view.alerts.filter(alert=>alert.kind!=='info').slice(0,4).map(alert=><li key={alert.id}><span>{alert.title}</span><button type="button" className="p-btn p-small" onClick={()=>onNavigate(alert.section)}>{alert.action}</button></li>)}</ul>:<div className="p-empty">Nada urgente esta semana.</div>}
        </div>
      </div>
      <div className="p-card p-reveal"><div className="p-cardHead"><div><span className="p-eyebrowS">LOGROS</span><h3>Para compartir</h3><span className="p-sub">Elegí uno y generá una imagen. Por defecto no muestra montos.</span></div></div>
        {view.wins.length?<div className="p-grid p-g3">{view.wins.map(win=><div key={win.id} className="p-win p-achievement"><small>{win.title}</small><b className="p-mono">{win.value}</b><span className="p-sub">{win.detail}</span><button type="button" className="p-btn p-small" onClick={()=>setShare({eyebrow:'Logro de la semana',title:win.title,value:win.value,privateValue:win.privateValue,period:`Semana del ${label}`})}><Share2 className="p-i" aria-hidden="true"/>Compartir</button></div>)}</div>:<div className="p-empty">Esta semana no hubo logros destacados. ¡La próxima seguro!</div>}
      </div>
      <div className="p-note" style={{marginTop:16}}>¿Querés recibir este resumen por email cada lunes? Activalo en <button type="button" className="p-linkBtn" onClick={()=>onNavigate('acciones')}>Acciones → Cuándo avisarte</button>.</div>
    </>}
    {share&&<ShareDialog content={share} storeName={storeName} onClose={()=>setShare(null)}/>}
  </>;
}
