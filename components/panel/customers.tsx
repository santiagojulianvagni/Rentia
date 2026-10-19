'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import type { customerInsights, Share } from '../../lib/customer-insights';

type Insights=ReturnType<typeof customerInsights>;
const pct=(value:number)=>`${Math.round(value*100)}%`;
const HOURS=Array.from({length:24},(_,hour)=>hour);

function BarList({rows,money,empty}:{rows:Share[];money:(value:number)=>string;empty:string}) {
  if(!rows.length)return <div className="p-empty">{empty}</div>;
  const max=Math.max(...rows.map(row=>row.orders));
  return <ul className="p-barList">{rows.map(row=><li key={row.name}>
    <div className="p-barLabel"><span title={row.name}>{row.name}</span><b className="p-mono">{pct(row.share)}</b></div>
    <div className="p-barTrack"><i style={{width:`${max?row.orders/max*100:0}%`}}/></div>
    <small className="p-sub">{row.orders.toLocaleString('es-AR')} {row.orders===1?'orden':'órdenes'} · {money(row.revenue)}</small>
  </li>)}</ul>;
}

function Heatmap({data}:{data:Insights}) {
  const max=Math.max(1,...data.heat.flat().map(cell=>cell.orders));
  return <div className="p-heatWrap"><div className="p-heat" role="table" aria-label="Órdenes por día y hora">
    <span/>{HOURS.map(hour=><span key={hour} className="p-heatHour">{hour%3===0?`${hour}h`:''}</span>)}
    {data.heat.map((hours,day)=><div className="p-heatRow" role="row" key={day}>
      <span className="p-heatDay" role="rowheader">{data.days[day].name.slice(0,3)}</span>
      {hours.map((cell,hour)=><i key={hour} role="cell" title={`${data.days[day].name} ${hour}:00 a ${hour}:59 · ${cell.orders} ${cell.orders===1?'orden':'órdenes'}`} style={{'--a':cell.orders?.12+cell.orders/max*.88:0} as CSSProperties}/>)}
    </div>)}
  </div></div>;
}

// Perfil de clientes del período: nuevos y recurrentes, de dónde son, cómo pagan y reciben y cuándo compran.
export default function Customers({query,period,money}:{query:string;period:string;money:(value:number)=>string}) {
  const [data,setData]=useState<Insights|null>(null);
  const [error,setError]=useState(false);
  useEffect(()=>{
    let cancelled=false;
    void Promise.resolve().then(()=>{if(!cancelled){setData(null);setError(false);}});
    fetch(`/api/insights/customers?${query}`,{cache:'no-store'}).then(async response=>{
      if(!response.ok)throw new Error();
      const result=await response.json() as Insights;
      if(!cancelled)setData(result);
    }).catch(()=>{if(!cancelled)setError(true);});
    return ()=>{cancelled=true;};
  },[query]);

  const c=data?.customers;
  return <>
    <div className="p-head"><div><div className="p-eyebrow">CLIENTES · {period}</div><h1>Clientes</h1><p>Quiénes te compran, desde dónde, cómo pagan y reciben, y en qué días y horarios. Sirve para decidir envíos, promociones y cuándo publicar.</p></div></div>
    {error&&<div className="p-notice p-warning" role="alert"><div><b>No pudimos cargar tus clientes</b><p>Recargá la página para intentar de nuevo.</p></div></div>}
    {!data&&!error&&<div className="p-empty">Armando el perfil de tus clientes…</div>}
    {data&&!data.totals.orders&&<div className="p-empty">No hay ventas pagas en este período.</div>}
    {data&&data.totals.orders>0&&<>
      {data.totals.coverage<.95&&<div className="p-note" style={{marginBottom:16}}>{data.totals.identifiedOrders?`Tenemos los datos de cliente de ${pct(data.totals.coverage)} de las órdenes del período. `:''}Estamos completando los datos de cliente, provincia y envío de tus órdenes de Tiendanube anteriores: se actualizan solos con la próxima sincronización. Las ventas de Mercado Libre no traen datos del comprador, pero sí cuentan en pagos y horarios.</div>}
      <div className="p-grid p-g4" style={{marginBottom:16}}>
        <div className="p-card p-kpi p-hero p-reveal"><small>Clientes que compraron</small><b className="p-mono">{c!.total.toLocaleString('es-AR')}</b><span className="p-sub">{c!.repeatInPeriod?`${c!.repeatInPeriod} compraron más de una vez`:'Ninguno repitió en el período'}</span></div>
        <div className="p-card p-kpi p-reveal" style={{'--i':1} as CSSProperties}><small>Nuevos</small><b className="p-mono">{c!.newCount.toLocaleString('es-AR')}</b><span className="p-sub">{c!.total?pct(c!.newCount/c!.total):'—'} · {money(c!.newRevenue)}</span></div>
        <div className="p-card p-kpi p-reveal" style={{'--i':2} as CSSProperties}><small>Volvieron a comprar</small><b className="p-mono">{c!.returningCount.toLocaleString('es-AR')}</b><span className="p-sub">{c!.total?pct(c!.returningCount/c!.total):'—'} · {money(c!.returningRevenue)}</span></div>
        <div className="p-card p-kpi p-reveal" style={{'--i':3} as CSSProperties}><small>Gasto por cliente</small><b className="p-mono">{c!.total?money(c!.revenuePerCustomer):'—'}</b><span className="p-sub">{c!.ordersPerCustomer?`${c!.ordersPerCustomer.toFixed(2).replace('.',',')} compras por cliente`:'—'}</span></div>
      </div>

      <div className="p-card p-reveal" style={{marginBottom:16}}>
        <div className="p-cardHead"><div><span className="p-eyebrowS">CUÁNDO COMPRAN</span><h3>Días y horarios</h3><span className="p-sub">{data.best?`El momento con más ventas: ${data.best.day.toLowerCase()}s a las ${data.best.hour} h. Buen horario para publicar o lanzar una promo.`:''} Hora de Argentina.</span></div></div>
        <Heatmap data={data}/>
      </div>

      <div className="p-grid p-g2" style={{marginBottom:16}}>
        <div className="p-card p-reveal"><div className="p-cardHead"><div><span className="p-eyebrowS">DESDE DÓNDE</span><h3>Provincias</h3></div></div><BarList rows={data.provinces} money={money} empty="Todavía no hay datos de provincia."/></div>
        <div className="p-card p-reveal"><div className="p-cardHead"><div><span className="p-eyebrowS">DESDE DÓNDE</span><h3>Ciudades</h3></div></div><BarList rows={data.cities} money={money} empty="Todavía no hay datos de ciudad."/></div>
      </div>
      <div className="p-grid p-g2" style={{marginBottom:16}}>
        <div className="p-card p-reveal"><div className="p-cardHead"><div><span className="p-eyebrowS">CÓMO PAGAN</span><h3>Medios de pago</h3></div></div><BarList rows={data.payments} money={money} empty="Sin datos de pago."/></div>
        <div className="p-card p-reveal"><div className="p-cardHead"><div><span className="p-eyebrowS">CÓMO PAGAN</span><h3>Cuotas</h3></div></div><BarList rows={data.installments} money={money} empty="Sin datos de cuotas."/></div>
      </div>
      <div className="p-grid p-g2">
        <div className="p-card p-reveal"><div className="p-cardHead"><div><span className="p-eyebrowS">CÓMO RECIBEN</span><h3>Formas de envío</h3></div></div><BarList rows={data.shipping} money={money} empty="Todavía no hay datos de envío."/></div>
        <div className="p-card p-reveal"><div className="p-cardHead"><div><span className="p-eyebrowS">POR DÓNDE ENTRAN</span><h3>Canal de la tienda</h3></div></div><BarList rows={data.storefronts} money={money} empty="Todavía no hay datos de canal."/></div>
      </div>
      <p className="p-sub" style={{marginTop:14}}>“Nuevo” es quien compró por primera vez en este período, dentro del historial importado (hasta 12 meses). Del cliente guardamos solo un código anónimo: nunca su nombre ni su email.</p>
    </>}
  </>;
}
