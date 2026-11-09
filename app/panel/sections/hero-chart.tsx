'use client';

import { useEffect, useMemo, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { salesChannelLabel } from '../../../lib/sales-channels';
import { useMoney, type Dashboard, type TimelinePoint } from '../shared';

// Gráfico principal del dashboard (estilo glass): la ganancia real en grande, pestañas de período,
// chips por canal y áreas apiladas por canal con degradado. Opción A: las áreas son la ganancia de
// cada canal antes de publicidad y la línea blanca es la ganancia real (después de publicidad).
type Metric='profit'|'revenue'|'orders';
type Grain='día'|'semana'|'mes';
type Series={key:string;label:string;color:string;points:Map<string,TimelinePoint>};

const COLORS:Record<string,[string,string]>={tiendanube:['#4f8cff','#7aa8ff'],mercadolibre:['#ffd23f','#ffe27a'],otros:['#a78bfa','#c4b0ff']};
const METRIC_LABEL:Record<Metric,string>={profit:'Ganancia real',revenue:'Facturación',orders:'Órdenes'};
const W=800,H=250,TOP=12;

const valueOf=(point:TimelinePoint|undefined,metric:Metric)=>!point?0:metric==='profit'?Number(point.profit||0):metric==='revenue'?Number(point.storeRevenue||0)+Number(point.externalRevenue||0):Number(point.orders||0);
function bucketKey(date:string,grain:Grain) {
  if (grain==='mes') return date.slice(0,7);
  if (grain==='semana') { const day=new Date(`${date}T12:00:00Z`);const monday=new Date(day.getTime()-((day.getUTCDay()+6)%7)*86400000);return monday.toISOString().slice(0,10); }
  return date;
}
function bucketLabel(key:string,grain:Grain) {
  const date=new Date(`${grain==='mes'?`${key}-01`:key}T12:00:00Z`);
  return new Intl.DateTimeFormat('es-AR',grain==='mes'?{month:'short',timeZone:'UTC'}:{day:'numeric',month:'short',timeZone:'UTC'}).format(date).replace('.','');
}
// Curva monótona (Fritsch–Carlson): suave, pero nunca se pasa de los valores reales ni baja de cero.
function smooth(points:Array<[number,number]>) {
  const n=points.length;
  if (!n) return '';
  if (n<3) return points.map(([px,py],i)=>`${i?'L':'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ');
  const dx=points.slice(1).map((p,i)=>p[0]-points[i][0]);
  const slope=points.slice(1).map((p,i)=>(p[1]-points[i][1])/(dx[i]||1));
  const tangent=points.map((_,i)=>i===0?slope[0]:i===n-1?slope[n-2]:slope[i-1]*slope[i]<=0?0:(slope[i-1]+slope[i])/2);
  for (let i=0;i<n-1;i++) {
    if (slope[i]===0) { tangent[i]=0;tangent[i+1]=0;continue; }
    const a=tangent[i]/slope[i],b=tangent[i+1]/slope[i],h=a*a+b*b;
    if (h>9) { const t=3/Math.sqrt(h);tangent[i]=t*a*slope[i];tangent[i+1]=t*b*slope[i]; }
  }
  let d=`M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i=0;i<n-1;i++) {
    const [x0,y0]=points[i],[x1,y1]=points[i+1],h=dx[i]/3;
    d+=` C${(x0+h).toFixed(1)} ${(y0+tangent[i]*h).toFixed(1)} ${(x1-h).toFixed(1)} ${(y1-tangent[i+1]*h).toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return d;
}
const area=(top:Array<[number,number]>,bottom:Array<[number,number]>)=>`${smooth(top)} L${bottom[bottom.length-1][0].toFixed(1)} ${bottom[bottom.length-1][1].toFixed(1)}${smooth(bottom.slice().reverse()).replace(/^M[\d.\s-]*/,' ')} Z`;

export default function HeroChart({dashboard,previousDashboard,days,periodLabel,onPeriodChange}:{dashboard:Dashboard|null;previousDashboard:Dashboard|null;days:number;periodLabel:string;onPeriodChange?:(days:number)=>void}) {
  const money=useMoney();
  const [metric,setMetric]=useState<Metric>('profit');
  const [grainChoice,setGrainChoice]=useState<Grain|null>(null);
  const [focus,setFocus]=useState<string|null>(null);
  const [hover,setHover]=useState<number|null>(null);
  const [view,setView]=useState<'hoy'|'periodo'>('periodo');
  const [optionsOpen,setOptionsOpen]=useState(false);
  const [now,setNow]=useState<Date|null>(null);
  useEffect(()=>{queueMicrotask(()=>setNow(new Date()));},[]);
  const grain:Grain=grainChoice||(days>=180?'mes':days>45?'semana':'día');
  const format=(value:number)=>metric==='orders'?Math.round(value).toLocaleString('es-AR'):money(value);

  // Series por canal: Tiendanube, Mercado Libre y el resto juntos como "Otros canales".
  const chart=useMemo(()=>{
    const timelines=dashboard?.channelTimelines||{};
    const groups=new Map<string,Series>();
    if (view==='hoy') {
      // Hoy: por hora, con las órdenes del día (ganancia antes de publicidad).
      const today=now?`${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`:'';
      for (const order of dashboard?.orders||[]) {
        const created=new Date(order.source_created_at);
        if (`${created.getFullYear()}-${created.getMonth()}-${created.getDate()}`!==today) continue;
        if (['cancelled','canceled','voided'].includes(String(order.status).toLowerCase())) continue;
        const key=order.provider==='tiendanube'||order.provider==='mercadolibre'?order.provider:'otros';
        const series=groups.get(key)||{key,label:key==='otros'?'Otros canales':salesChannelLabel(key),color:COLORS[key]?.[0]||COLORS.otros[0],points:new Map()};
        const hour=String(created.getHours()).padStart(2,'0');
        const point=series.points.get(hour)||{date:hour,orders:0,storeRevenue:0,externalRevenue:0,profit:0,adSpend:0,operatingCosts:0};
        point.orders+=1;point.storeRevenue+=Number(order.total||0);point.profit+=Number(order.profit||0);
        series.points.set(hour,point);groups.set(key,series);
      }
      const hours=Array.from({length:now?now.getHours()+1:24},(_,hour)=>String(hour).padStart(2,'0'));
      // Acumulado: cada hora muestra lo que lleva el día hasta ese momento, así la curva termina en el total.
      for (const series of groups.values()) {
        let running={orders:0,storeRevenue:0,profit:0};
        for (const hour of hours) {
          const point=series.points.get(hour);
          running={orders:running.orders+(point?.orders||0),storeRevenue:running.storeRevenue+(point?.storeRevenue||0),profit:running.profit+(point?.profit||0)};
          series.points.set(hour,{date:hour,externalRevenue:0,adSpend:0,operatingCosts:0,...running});
        }
      }
      return {groups:[...groups.values()],keys:hours,labels:hours.map(hour=>`${Number(hour)} h`),real:null as Map<string,number>|null};
    }
    for (const [provider,points] of Object.entries(timelines)) {
      const key=provider==='tiendanube'||provider==='mercadolibre'?provider:'otros';
      const series=groups.get(key)||{key,label:key==='otros'?'Otros canales':salesChannelLabel(key),color:COLORS[key]?.[0]||COLORS.otros[0],points:new Map()};
      for (const point of points) {
        const bucket=bucketKey(point.date,grain);
        const current=series.points.get(bucket)||{date:bucket,orders:0,storeRevenue:0,externalRevenue:0,profit:0,adSpend:0,operatingCosts:0};
        current.orders+=point.orders;current.storeRevenue+=point.storeRevenue;current.externalRevenue+=point.externalRevenue;current.profit+=point.profit;
        series.points.set(bucket,current);
      }
      groups.set(key,series);
    }
    const keys=[...new Set((dashboard?.timeline||[]).map(point=>bucketKey(point.date,grain)))].sort();
    const real=new Map<string,number>();
    for (const point of dashboard?.timeline||[]) { const bucket=bucketKey(point.date,grain); real.set(bucket,(real.get(bucket)||0)+Number(point.profit||0)); }
    return {groups:[...groups.values()].sort((a,b)=>['tiendanube','mercadolibre','otros'].indexOf(a.key)-['tiendanube','mercadolibre','otros'].indexOf(b.key)),keys,labels:keys.map(key=>bucketLabel(key,grain)),real};
  },[dashboard,grain,view,now]);

  const {groups,keys,labels,real}=chart;
  const stacks=keys.map(key=>{let sum=0;return groups.map(series=>{sum+=Math.max(0,valueOf(series.points.get(key),metric));return sum;});});
  const realValues=metric==='profit'&&real?keys.map(key=>real.get(key)||0):[];
  const max=Math.max(1,...stacks.map(stack=>stack[stack.length-1]||0),...realValues)*1.1;
  const x=(index:number)=>keys.length>1?index/(keys.length-1)*W:W/2;
  const y=(value:number)=>H-Math.max(0,value)/max*(H-TOP);
  const base=keys.map((_,index)=>[x(index),H] as [number,number]);
  const layers=groups.map((series,layer)=>{
    const top=keys.map((_,index)=>[x(index),y(stacks[index][layer]||0)] as [number,number]);
    const bottom=layer?keys.map((_,index)=>[x(index),y(stacks[index][layer-1]||0)] as [number,number]):base;
    return {series,d:keys.length>1?area(top,bottom):''};
  });
  const realPath=realValues.length>1?smooth(realValues.map((value,index)=>[x(index),y(value)])):'';
  const totals=groups.map(series=>({series,total:view==='hoy'?valueOf(series.points.get(keys[keys.length-1]),metric):keys.reduce((sum,key)=>sum+valueOf(series.points.get(key),metric),0)}));

  // Número grande y comparación con el período anterior.
  const metrics=dashboard?.metrics,previous=previousDashboard?.metrics;
  const todayTotal=totals.reduce((sum,row)=>sum+row.total,0);
  const big=view==='hoy'?todayTotal:metric==='profit'?Number(metrics?.profit||0):metric==='revenue'?Number(metrics?.totalRevenue||0):Number(metrics?.totalOrders||0);
  const before=metric==='profit'?Number(previous?.profit||0):metric==='revenue'?Number(previous?.totalRevenue||0):Number(previous?.totalOrders||0);
  const delta=view==='periodo'&&before?((big-before)/Math.abs(before))*100:null;
  const tabs:[string,string,number|null][]=[['hoy','Hoy',null],['7','7 días',7],['30','30 días',30],['365','12 meses',365]];
  const activeTab=view==='hoy'?'hoy':String(days);
  const labelEvery=Math.max(1,Math.ceil(labels.length/7));
  const hovered=hover!==null&&keys[hover]?{label:labels[hover],rows:groups.map(series=>({series,value:valueOf(series.points.get(keys[hover]),metric)})),real:realValues[hover]}:null;

  return <div className="p-card p-span2 p-reveal p-heroChart">
    <div className="p-heroHead">
      <div>
        <span className="p-heroLabel">{view==='hoy'?`${METRIC_LABEL[metric]==='Ganancia real'?'Ganancia':METRIC_LABEL[metric]} de hoy`:`${METRIC_LABEL[metric]} · ${periodLabel.toLowerCase()}`}</span>
        <div className="p-heroValue"><b className="p-mono">{format(big)}</b>{delta!==null&&Number.isFinite(delta)&&<span className={`p-heroDelta ${delta<0?'p-down':''}`}>{delta<0?'▼':'▲'} {Math.abs(delta).toFixed(1).replace('.',',')} %</span>}</div>
        <span className="p-sub">{view==='hoy'?'antes de publicidad · acumulado del día':delta!==null?'frente al período anterior':' '}</span>
      </div>
      <div className="p-heroTools">
        <div className="p-heroTabs" role="group" aria-label="Período del gráfico">{tabs.map(([id,label,value])=><button type="button" key={id} className={activeTab===id?'p-on':''} onClick={()=>{setHover(null);if(value===null){setView('hoy');return;}setView('periodo');if(value!==days)onPeriodChange?.(value);}}>{label}</button>)}</div>
        <div className="p-heroOptionsWrap">
          <button type="button" className="p-iconBtn" aria-label="Opciones del gráfico" aria-expanded={optionsOpen} onClick={()=>setOptionsOpen(open=>!open)}><SlidersHorizontal className="p-i" aria-hidden="true"/></button>
          {optionsOpen&&<div className="p-heroOptions" role="dialog" aria-label="Opciones del gráfico">
            <small>Qué mostrar</small>
            <div className="p-heroSeg">{(['profit','revenue','orders'] as Metric[]).map(item=><button type="button" key={item} className={metric===item?'p-on':''} onClick={()=>setMetric(item)}>{item==='profit'?'Ganancia':METRIC_LABEL[item]}</button>)}</div>
            {view==='periodo'&&<><small>Agrupar por</small><div className="p-heroSeg">{(['día','semana','mes'] as Grain[]).map(item=><button type="button" key={item} className={grain===item?'p-on':''} onClick={()=>setGrainChoice(item)}>{item[0].toUpperCase()+item.slice(1)}</button>)}</div></>}
          </div>}
        </div>
      </div>
    </div>
    <div className="p-heroChips">{totals.map(({series,total})=><button type="button" key={series.key} className={`p-heroChip ${focus&&focus!==series.key?'p-dim':''} ${focus===series.key?'p-on':''}`} onClick={()=>setFocus(current=>current===series.key?null:series.key)} aria-pressed={focus===series.key}><i style={{background:series.color}}/>{series.label}<b className="p-mono">{format(total)}</b></button>)}
      {metric==='profit'&&view==='periodo'&&<span className="p-heroNote"><i/>Ganancia real (después de publicidad)</span>}
    </div>
    <div className="p-heroPlot" onMouseLeave={()=>setHover(null)}>
      {keys.length>1&&layers.some(layer=>layer.d)?<svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${METRIC_LABEL[metric]} por canal`}>
        <defs>{groups.map(series=><linearGradient key={series.key} id={`p-hero-${series.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={series.color} stopOpacity=".9"/><stop offset="1" stopColor={series.color} stopOpacity=".38"/></linearGradient>)}</defs>
        {[0.25,0.5,0.75].map(level=><line key={level} x1="0" x2={W} y1={H-level*(H-TOP)} y2={H-level*(H-TOP)} stroke="rgba(255,255,255,.07)"/>)}
        {layers.slice().reverse().map(({series,d})=><path key={series.key} d={d} fill={`url(#p-hero-${series.key})`} opacity={focus&&focus!==series.key?.18:1} style={{transition:'opacity .3s'}}/>)}
        {realPath&&<path d={realPath} fill="none" stroke="rgba(255,255,255,.85)" strokeWidth="2" strokeDasharray="1 0" vectorEffect="non-scaling-stroke"/>}
        {hover!==null&&<line x1={x(hover)} x2={x(hover)} y1={TOP} y2={H} stroke="rgba(255,255,255,.35)" vectorEffect="non-scaling-stroke"/>}
        {keys.map((key,index)=><rect key={key} x={x(index)-W/keys.length/2} y="0" width={W/keys.length} height={H} fill="transparent" onMouseEnter={()=>setHover(index)}/>)}
      </svg>:<div className="p-empty">{view==='hoy'?'Todavía no hay ventas hoy.':'Todavía no hay datos para este período.'}</div>}
      {hovered&&<div className="p-heroTip" style={{left:`${Math.min(82,Math.max(4,(hover!/(Math.max(1,keys.length-1)))*100-8))}%`}}>
        <b>{hovered.label}</b>
        {hovered.rows.map(row=><span key={row.series.key}><i style={{background:row.series.color}}/>{row.series.label}<b className="p-mono">{format(row.value)}</b></span>)}
        {metric==='profit'&&hovered.real!==undefined&&<span className="p-heroTipReal"><i/>Ganancia real<b className="p-mono">{money(hovered.real)}</b></span>}
      </div>}
    </div>
    <div className="p-heroAxis p-mono" aria-hidden="true">{labels.map((label,index)=>{const last=index===labels.length-1;if(!(last||(index%labelEvery===0&&labels.length-1-index>=labelEvery/2)))return null;const left=labels.length>1?index/(labels.length-1)*100:50;const alt=!last&&index>0&&(index/labelEvery)%2===1;return <span key={`${label}-${index}`} className={alt?'p-heroAxisAlt':undefined} style={{left:`${left}%`,transform:`translateX(${index===0?0:last?-100:-50}%)`}}>{label}</span>;})}</div>
  </div>;
}
