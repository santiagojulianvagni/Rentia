'use client';

import { useEffect, useMemo, useState } from 'react';
import { cashflow, type CashflowRule } from '../../lib/cashflow';

type MonthDashboard={metrics:{revenue:number;productCost:number;shipping:number;commissions:number;taxes:number;refundLoss?:number;totalAdSpend?:number;adSpend:number;orders:number};timeline:Array<{date:string;storeRevenue:number}>;quality:{completeOrders:number;totalOrders:number}};

const DAY=24*60*60*1000;
const iso=(value:number)=>new Date(value).toISOString().slice(0,10);
// Fecha de hoy en Argentina.
const todayAr=()=>{const local=new Date(Date.now()-3*60*60*1000);return iso(Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate()));};
const monthLabel=new Intl.DateTimeFormat('es-AR',{month:'long',year:'numeric',timeZone:'UTC'});
const dayLabel=new Intl.DateTimeFormat('es-AR',{day:'numeric',month:'long',timeZone:'UTC'});
const percent=(value:number)=>`${(value*100).toFixed(1).replace('.',',')}%`;

async function getJson<T>(url:string):Promise<T|null> {
  const response=await fetch(url,{cache:'no-store'});
  return response.ok?await response.json() as T:null;
}

// Facturación acumulada del mes, proyección y línea del punto de equilibrio.
function CashflowChart({daily,pace,breakEven,elapsed,totalDays,money,risk}:{daily:number[];pace:number;breakEven:number|null;elapsed:number;totalDays:number;money:(value:number)=>string;risk:boolean}) {
  const W=700,H=240,P={l:8,r:8,t:16,b:24};
  const actual=daily.slice(0,elapsed).reduce<number[]>((list,value)=>[...list,(list[list.length-1]||0)+value],[]);
  const last=actual[actual.length-1]||0;
  const projected=Array.from({length:totalDays-elapsed},(_,index)=>last+pace*(index+1));
  const max=Math.max(1,breakEven?breakEven*1.12:0,(projected[projected.length-1]||last)*1.05);
  const x=(day:number)=>P.l+(day/(totalDays-1||1))*(W-P.l-P.r);
  const y=(value:number)=>H-P.b-(value/max)*(H-P.t-P.b);
  const line=(values:number[],offset:number)=>values.map((value,index)=>`${index?'L':'M'}${x(index+offset).toFixed(1)},${y(value).toFixed(1)}`).join(' ');
  const area=actual.length?`${line(actual,0)} L${x(actual.length-1).toFixed(1)},${y(0)} L${x(0)},${y(0)} Z`:'';
  return <svg className="p-cashChart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Facturación acumulada del mes, proyección y punto de equilibrio">
    <defs><linearGradient id="cashArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#21d4c2" stopOpacity=".35"/><stop offset="1" stopColor="#21d4c2" stopOpacity="0"/></linearGradient></defs>
    {breakEven&&<><line x1={P.l} x2={W-P.r} y1={y(breakEven)} y2={y(breakEven)} stroke="#f5c451" strokeWidth="1.5" strokeDasharray="6 6"/><text x={W-P.r} y={y(breakEven)-8} textAnchor="end" fill="#f5c451" fontSize="12" fontWeight="700">Punto de equilibrio · {money(breakEven)}</text></>}
    {area&&<path d={area} fill="url(#cashArea)"/>}
    {actual.length>0&&<path d={line(actual,0)} fill="none" stroke="#21d4c2" strokeWidth="3" strokeLinejoin="round"/>}
    {projected.length>0&&<path d={`M${x(elapsed-1)},${y(last)} ${line(projected,elapsed).replace(/^M/,'L')}`} fill="none" stroke={risk?'#ff8c99':'#32d583'} strokeWidth="2.5" strokeDasharray="7 7"/>}
    <line x1={x(elapsed-1)} x2={x(elapsed-1)} y1={P.t} y2={H-P.b} stroke="#264560" strokeDasharray="3 5"/>
    <text x={x(elapsed-1)} y={H-6} textAnchor="middle" fill="#9bb0c1" fontSize="11">Hoy</text>
    <text x={P.l} y={H-6} fill="#7890a5" fontSize="11">1</text><text x={W-P.r} y={H-6} textAnchor="end" fill="#7890a5" fontSize="11">{totalDays}</text>
  </svg>;
}

export default function Cashflow({rules,money,onNavigate}:{rules:CashflowRule[];money:(value:number)=>string;onNavigate:(section:string)=>void}) {
  const today=todayAr(),month=today.slice(0,7);
  const [data,setData]=useState<{month:MonthDashboard;recent:MonthDashboard|null}|null>(null);
  const [error,setError]=useState(false);
  useEffect(()=>{
    let cancelled=false;
    const recentStart=iso(Date.parse(`${today}T00:00:00Z`)-14*DAY),yesterday=iso(Date.parse(`${today}T00:00:00Z`)-DAY);
    Promise.all([getJson<MonthDashboard>(`/api/dashboard?start=${month}-01&end=${today}`),getJson<MonthDashboard>(`/api/dashboard?start=${recentStart}&end=${yesterday}`)])
      .then(([current,recent])=>{if(cancelled)return;if(!current){setError(true);return;}setData({month:current,recent});})
      .catch(()=>{if(!cancelled)setError(true);});
    return ()=>{cancelled=true;};
  },[today,month]);

  const view=useMemo(()=>{
    if(!data)return null;
    // Últimos 14 días completos, con cero en los días sin ventas.
    const recentByDate=new Map((data.recent?.timeline||[]).map(point=>[point.date.slice(0,10),point.storeRevenue]));
    const recentDaily=Array.from({length:14},(_,index)=>recentByDate.get(iso(Date.parse(`${today}T00:00:00Z`)-(14-index)*DAY))||0);
    const result=cashflow({month,today,metrics:data.month.metrics,rules,recentDaily});
    const byDate=new Map(data.month.timeline.map(point=>[point.date.slice(0,10),point.storeRevenue]));
    const daily=Array.from({length:result.totalDays},(_,index)=>byDate.get(`${month}-${String(index+1).padStart(2,'0')}`)||0);
    const incomplete=data.month.quality.totalOrders>data.month.quality.completeOrders;
    return {result,daily,incomplete,revenue:data.month.metrics.revenue};
  },[data,rules,month,today]);

  const name=monthLabel.format(new Date(`${month}-01T00:00:00Z`));
  const monthName=name.split(' ')[0];
  return <>
    <div className="p-head"><div><div className="p-eyebrow">CASHFLOW · {name.toUpperCase()}</div><h1>¿Cómo vas a <em>terminar el mes?</em></h1><p>Cuánto tenés que vender para cubrir tus gastos fijos y cómo cerrarías {monthName} si seguís al ritmo de los últimos 14 días.</p></div></div>
    {error?<div className="p-empty" role="alert">No pudimos cargar el mes. Probá de nuevo en unos minutos.</div>
    :!view?<div className="p-empty" role="status">Calculando tu mes…</div>
    :(()=>{const r=view.result;const progress=r.breakEven?Math.min(100,view.revenue/r.breakEven*100):0;return <>
      {r.fixed<=0&&<div className="p-notice p-warning" role="status"><div><b>Cargá tus gastos fijos</b><p>Alquiler, sueldos, herramientas, contador: con ellos calculamos cuánto necesitás vender para no perder plata.</p></div><button type="button" className="p-btn p-small p-primary" onClick={()=>onNavigate('configuracion')}>Cargar gastos fijos</button></div>}
      {view.incomplete&&<div className="p-note">Cálculo provisorio: hay órdenes de este mes con costos sin cargar. <button type="button" className="p-linkBtn" onClick={()=>onNavigate('calidad')}>Ver qué falta</button></div>}
      {r.breakEven!==null&&<div className={`p-card p-reveal p-cashHero p-${r.status}`}>
        <span className="p-eyebrowS">PUNTO DE EQUILIBRIO</span>
        <h2>{r.status==='cubierto'?`¡Ya cubriste los gastos fijos de ${monthName}!`:r.status==='en-camino'?`Vas bien: los cubrís alrededor del ${r.breakEvenDay?dayLabel.format(new Date(`${r.breakEvenDay}T00:00:00Z`)):'fin de mes'}`:`A este ritmo te faltarían ${money(r.shortfall)}`}</h2>
        <p className="p-sub">{r.status==='cubierto'?'Desde acá, cada venta suma ganancia.':`Llevás ${money(view.revenue)} de ${money(r.breakEven)}. ${r.perDay!==null?`Necesitás ${money(r.perDay)} por día${r.ordersNeeded?` (unas ${r.ordersNeeded} órdenes más)`:''}.`:''}`}</p>
        <div className="p-cashBar" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}><i style={{width:`${progress}%`}}/></div>
        <div className="p-cashBarLabels"><span>{Math.round(progress)}% cubierto</span><span>Día {r.elapsed} de {r.totalDays}</span></div>
      </div>}
      <div className="p-grid p-g4" style={{marginBottom:16}}>
        <div className="p-card p-kpi p-reveal"><small><span className="p-kpiLabel">Punto de equilibrio</span></small><b className="p-mono">{r.breakEven!==null?money(r.breakEven):'—'}</b><span className="p-sub">Facturación necesaria en el mes</span></div>
        <div className={`p-card p-kpi p-reveal ${r.remaining?'p-tone-a':''}`} style={{'--i':1} as React.CSSProperties}><small><span className="p-kpiLabel">Te falta vender</span></small><b className="p-mono">{r.remaining!==null?money(r.remaining):'—'}</b><span className="p-sub">{r.perDay!==null&&r.remaining?`${money(r.perDay)} por día`:r.status==='cubierto'?'Ya lo superaste':'Sin datos suficientes'}</span></div>
        <div className="p-card p-kpi p-reveal" style={{'--i':2} as React.CSSProperties}><small><span className="p-kpiLabel">Facturación proyectada</span></small><b className="p-mono">{money(r.projectedRevenue)}</b><span className="p-sub">Al ritmo de {money(r.pace)} por día</span></div>
        <div className={`p-card p-kpi p-reveal ${r.projectedProfit!==null&&r.projectedProfit<0?'p-tone-r':'p-hero'}`} style={{'--i':3} as React.CSSProperties}><small><span className="p-kpiLabel">Ganancia proyectada</span></small><b className="p-mono">{r.projectedProfit!==null?money(r.projectedProfit):'—'}</b><span className="p-sub">Después de gastos fijos</span></div>
      </div>
      <div className="p-grid p-g2" style={{marginBottom:16}}>
        <div className="p-card p-reveal"><div className="p-cardHead"><div><span className="p-eyebrowS">EL MES DÍA POR DÍA</span><h3>Vendido y proyectado</h3><span className="p-sub">Línea llena: lo vendido. Punteada: la proyección.</span></div></div>
          <CashflowChart daily={view.daily} pace={r.pace} breakEven={r.breakEven} elapsed={r.elapsed} totalDays={r.totalDays} money={money} risk={r.status==='en-riesgo'}/></div>
        <div className="p-card p-reveal"><div className="p-cardHead"><div><span className="p-eyebrowS">CÓMO LO CALCULAMOS</span><h3>Tus números del mes</h3></div><button type="button" className="p-btn p-small" onClick={()=>onNavigate('configuracion')}>Editar gastos</button></div>
          <ul className="p-weekList">
            <li><span>Margen de contribución</span><b className="p-mono">{r.margin!==null?percent(r.margin):'—'}</b></li>
            <li><span className="p-sub" style={{whiteSpace:'normal'}}>{r.margin!==null&&r.margin>0?`De cada $100 que vendés, te quedan $${Math.round(r.margin*100)} para pagar gastos fijos.`:'Lo que queda de cada venta después de productos, envíos, comisiones, impuestos y publicidad.'}</span></li>
            {r.fixedItems.map(item=><li key={item.name}><span>{item.name}</span><b className="p-mono">{money(item.amount)}</b></li>)}
            <li><span><b>Gastos fijos del mes</b></span><b className="p-mono">{money(r.fixed)}</b></li>
            <li><span>Ganancia hasta hoy</span><b className={`p-mono ${(r.profitSoFar||0)<0?'p-neg':'p-pos'}`}>{r.profitSoFar!==null?money(r.profitSoFar):'—'}</b></li>
          </ul>
        </div>
      </div>
      <div className="p-note p-reveal">La proyección supone que seguís vendiendo como en los últimos 14 días. No incluye la facturación externa, porque no conocemos sus costos. Próximamente: plata por cobrar de Mercado Libre y Pago Nube, y gastos con fecha para ver el saldo semana a semana.</div>
    </>;})()}
  </>;
}
