'use client';

import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from 'react';
import { type MarketQuote, type QuotePoint, type RateType, rateLabels } from '../lib/exchange-rates';

const pesos=(value:number|null|undefined)=>value==null?'—':new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:2}).format(value);
const dayLabel=(date:string,full=false)=>new Date(`${date}T12:00:00Z`).toLocaleDateString('es-AR',{timeZone:'UTC',day:'numeric',month:'short',...(full?{year:'numeric'}:{})});
function daysBefore(date:string,days:number){const point=new Date(`${date}T12:00:00Z`);point.setUTCDate(point.getUTCDate()-days);return point.toISOString().slice(0,10);}

export default function ExchangeRateHistory({rateType,quote,refreshKey}:{rateType:RateType;quote?:MarketQuote;refreshKey:string}) {
  const [data,setData]=useState<{type:RateType;points:QuotePoint[];cached:boolean}|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(false);
  const [period,setPeriod]=useState(30);
  const [active,setActive]=useState<number|null>(null);
  const [width,setWidth]=useState(900);
  const chart=useRef<HTMLDivElement>(null);
  const gradient=useId().replace(/:/g,'');
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Argentina/Buenos_Aires'}).format(new Date());
  useEffect(()=>{
    if(rateType==='manual')return;
    let cancelled=false;const controller=new AbortController();setLoading(true);setError(false);setActive(null);
    fetch(`/api/finance/exchange-history?type=${rateType}`,{signal:controller.signal,cache:'no-store'}).then(async response=>{if(!response.ok)throw new Error('history');return response.json() as Promise<{history:QuotePoint[];status:string}>;}).then(result=>{
      if(!cancelled)setData({type:rateType,points:result.history||[],cached:result.status==='cached'});
    }).catch(()=>{if(!cancelled)setError(true);}).finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;controller.abort();};
  },[rateType,refreshKey]);
  useEffect(()=>{
    const node=chart.current;if(!node)return;
    const measure=()=>setWidth(Math.max(260,node.clientWidth));measure();
    const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect();
  },[rateType]);
  const history=data?.type===rateType&&!error?data.points:[];
  const points=useMemo(()=>history.filter(point=>point.date>=daysBefore(today,period-1)&&point.date<=today),[history,today,period]);
  const current=quote?.sell??null;
  const inspect=points[active===null?points.length-1:Math.min(active,points.length-1)];
  const left=70,right=18,top=24,bottom=244,height=288;
  const minimum=points.length?Math.min(...points.map(point=>point.sell)):0;
  const maximum=points.length?Math.max(...points.map(point=>point.sell)):0;
  const padding=Math.max((maximum-minimum)*.2,maximum*.015,1);
  const low=minimum-padding,high=maximum+padding;
  const first=points[0]?Date.parse(points[0].date):0,last=points.at(-1)?Date.parse(points.at(-1)!.date):0;
  const x=(point:QuotePoint)=>left+(Date.parse(point.date)-first)/Math.max(1,last-first)*(width-left-right);
  const y=(value:number)=>bottom-(value-low)/(high-low)*(bottom-top);
  const line=points.map((point,index)=>`${index?'L':'M'}${x(point).toFixed(2)},${y(point.sell).toFixed(2)}`).join(' ');
  const area=points.length?`${line} L${x(points.at(-1)!)},${bottom} L${left},${bottom} Z`:'';
  function inspectPointer(event:PointerEvent<SVGSVGElement>) {
    if(!points.length)return;
    const bounds=event.currentTarget.getBoundingClientRect();const position=(event.clientX-bounds.left)*width/bounds.width;let nearest=0;
    points.forEach((point,index)=>{if(Math.abs(x(point)-position)<Math.abs(x(points[nearest])-position))nearest=index;});setActive(nearest);
  }

  if(rateType==='manual')return <section className="p-card p-reveal"><h3>Cotización manual</h3><p className="p-sub">El valor lo definís vos. No mostramos una evolución automática porque no hay un historial de mercado para esta configuración.</p></section>;
  return <section className="p-quoteHistory" aria-label="Historial de cotizaciones">
    <div className="p-grid p-g4" style={{marginBottom:16}}>
      <div className="p-card p-kpi p-hero p-reveal"><small>Precio actual · {rateLabels[rateType]}</small><b className="p-mono" style={{fontSize:21}}>{pesos(current)}</b><span className="p-sub" style={{fontSize:11.5}}>Venta, sin ajuste personalizado</span></div>
      {[{days:7,label:'Hace 7 días'},{days:30,label:'Hace 30 días'},{days:365,label:'Hace un año'}].map(({days,label})=>{
        const target=daysBefore(today,days);const previous=[...history].reverse().find(point=>point.date<=target&&point.date>=daysBefore(target,7));
        const change=previous&&current!==null?(current/previous.sell-1)*100:null;
        return <div className="p-card p-kpi p-reveal" key={days}><small>{label}</small><b className="p-mono" style={{fontSize:21}}>{loading?'—':pesos(previous?.sell)}</b>{change!==null&&!loading&&<span className={`p-delta ${change<0?'p-down':'p-up'}`}>{change>0?'▲ +':'▼ '}{new Intl.NumberFormat('es-AR',{maximumFractionDigits:1}).format(change)}%</span>}<span className="p-sub" style={{fontSize:11.5,display:'block',marginTop:4}}>{loading?'Consultando historial…':previous?`${dayLabel(previous.date,true)} · variación hasta hoy`:'Sin datos para esa fecha'}</span></div>;
      })}
    </div>
    <div className="p-card p-reveal">
      <div className="p-cardHead"><div><h3>Evolución del dólar {rateLabels[rateType]}</h3><span className="p-sub">Precio de venta en ARS, sin tu ajuste</span></div><div className="p-tabs" role="group" aria-label="Período del gráfico">{[7,30,365].map(days=><button type="button" key={days} className={period===days?'p-on':''} aria-pressed={period===days} onClick={()=>{setPeriod(days);setActive(null);}}>{days===365?'1 año':`${days} días`}</button>)}</div></div>
      <div className="p-quoteInspection" aria-live="polite"><span>{!loading&&inspect?dayLabel(inspect.date,true):'Cotización histórica'}</span><b>{!loading&&inspect?pesos(inspect.sell):'—'}</b><small>{points.length>1?'Pasá el cursor o usá las flechas para explorar':''}</small></div>
      <div ref={chart} className="p-quoteChart quoteChart" {...(!loading&&points.length?{role:'slider',tabIndex:0,'aria-label':`Explorar cotización histórica del dólar ${rateLabels[rateType]}`,'aria-valuemin':0,'aria-valuemax':points.length-1,'aria-valuenow':active??points.length-1,'aria-valuetext':inspect?`${dayLabel(inspect.date,true)}: ${pesos(inspect.sell)}`:undefined}: {})} onKeyDown={event=>{
        if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)&&points.length){event.preventDefault();setActive(index=>event.key==='Home'?0:event.key==='End'?points.length-1:Math.max(0,Math.min(points.length-1,(index??points.length-1)+(event.key==='ArrowLeft'?-1:1))));}
      }}>
        {loading?<div className="quoteChartEmpty" role="status">Consultando cotizaciones históricas…</div>:error?<div className="quoteChartEmpty">No pudimos consultar el historial. Podés reintentar con “Actualizar cotización”.</div>:!points.length?<div className="quoteChartEmpty">No hay cotizaciones disponibles para este período.</div>:<svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true" onPointerMove={inspectPointer} onPointerDown={inspectPointer} onPointerLeave={()=>setActive(null)}>
          <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22d5bc" stopOpacity=".24"/><stop offset="100%" stopColor="#22d5bc" stopOpacity="0"/></linearGradient></defs>
          {[0,1,2,3].map(index=>{const value=low+(high-low)*index/3;return <g key={index}><line x1={left} x2={width-right} y1={y(value)} y2={y(value)} className="quoteGridLine"/><text x={left-12} y={y(value)+4} textAnchor="end">{new Intl.NumberFormat('es-AR',{maximumFractionDigits:0}).format(value)}</text></g>;})}
          <path d={area} fill={`url(#${gradient})`}/><path d={line} className="quoteChartLine"/>
          {points.map((point,index)=>{const show=(points.length<=7&&width>550)||index===0||index===points.length-1||(width>550&&index===Math.floor(points.length/2));return <g key={point.date}>{points.length<=35&&<circle cx={x(point)} cy={y(point.sell)} r={2.5} className="quoteChartDot"/>}{show&&<text x={x(point)} y={height-15} textAnchor={index===0?'start':index===points.length-1?'end':'middle'}>{dayLabel(point.date)}</text>}</g>;})}
          {inspect&&active!==null&&<g><line x1={x(inspect)} x2={x(inspect)} y1={top} y2={bottom} className="quoteCrosshair"/><circle cx={x(inspect)} cy={y(inspect.sell)} r={5} className="quoteActiveDot"/></g>}
        </svg>}
      </div>
      <div className="p-quoteFooter"><span>Fuente: <a href="https://argentinadatos.com/docs/operations/get-cotizaciones-dolares-casa" target="_blank" rel="noreferrer">ArgentinaDatos · DolarApi</a>{data?.cached?' · última consulta disponible':''}</span><span>{!loading&&points.length?`${dayLabel(points[0].date,true)} — ${dayLabel(points.at(-1)!.date,true)}`:'Solo mostramos datos informados por la fuente'}</span></div>
    </div>
  </section>;
}
