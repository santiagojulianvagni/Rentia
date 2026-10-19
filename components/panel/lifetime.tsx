'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { acquisitionCheck, type lifetimeValue } from '../../lib/lifetime';

type Lifetime=ReturnType<typeof lifetimeValue>;
const pct=(value:number|null)=>value===null?'—':`${Math.round(value*100)}%`;
const monthName=(month:string)=>new Intl.DateTimeFormat('es-AR',{month:'short',year:'2-digit',timeZone:'UTC'}).format(new Date(`${month}-15T12:00:00Z`));
const longDate=(iso:string)=>new Intl.DateTimeFormat('es-AR',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(iso));

// Valor de vida (LTV): cuánto te deja cada cliente desde su primera compra, cuántos vuelven y
// cuánto podés invertir para conseguir uno nuevo.
export default function LifetimeValue({query,period,money,marginBeforeAds,adSpend}:{query:string;period:string;money:(value:number)=>string;marginBeforeAds:number|null;adSpend:number}) {
  const [data,setData]=useState<Lifetime|null>(null);
  const [error,setError]=useState(false);
  const [view,setView]=useState<'rate'|'value'>('rate');
  useEffect(()=>{
    let cancelled=false;
    void Promise.resolve().then(()=>{if(!cancelled){setData(null);setError(false);}});
    fetch(`/api/insights/lifetime?${query}`,{cache:'no-store'}).then(async response=>{
      if(!response.ok)throw new Error();
      const result=await response.json() as Lifetime;
      if(!cancelled)setData(result);
    }).catch(()=>{if(!cancelled)setError(true);});
    return ()=>{cancelled=true;};
  },[query]);

  const check=data?acquisitionCheck({averageValue:data.averageValue,marginBeforeAds,adSpend,newCustomers:data.newInPeriod}):null;
  const verdict=check?.ratio==null?null:check.ratio>=3?{tone:'p-tone-g',text:'Muy sano: cada cliente te deja bastante más de lo que cuesta conseguirlo. Hay margen para invertir más.'}
    :check.ratio>=1?{tone:'',text:'Recuperás lo que cuesta conseguir cada cliente, pero con poco margen. Ojo antes de subir la inversión.'}
    :{tone:'p-tone-r',text:'Conseguir un cliente te cuesta más de lo que te deja en toda su vida. Revisá campañas o trabajá la recompra.'};
  const maxCohort=data?Math.max(...data.cohorts.flatMap(cohort=>cohort.months.map(month=>view==='rate'?month.rate:month.valuePerCustomer)),0.0001):1;
  const maxMonths=data?Math.max(1,...data.cohorts.map(cohort=>cohort.months.length)):1;

  return <>
    <div className="p-head"><div><div className="p-eyebrow">CLIENTES · VALOR DE VIDA</div><h1>Lifetime Value</h1><p>Cuánto te compra cada cliente desde su primera compra, cuántos vuelven y cada cuánto, y cuánto podés invertir para conseguir uno nuevo.</p></div></div>
    {error&&<div className="p-notice p-warning" role="alert"><div><b>No pudimos calcular el valor de vida</b><p>Recargá la página para intentar de nuevo.</p></div></div>}
    {!data&&!error&&<div className="p-empty">Calculando el valor de tus clientes…</div>}
    {data&&!data.customers&&<div className="p-empty">Todavía no hay clientes identificados. Aparecen cuando termine la sincronización de Tiendanube con los datos de cliente.</div>}
    {data&&data.customers>0&&<>
      <div className="p-note" style={{marginBottom:16}}>Calculado con {data.customers.toLocaleString('es-AR')} clientes y {data.orders.toLocaleString('es-AR')} compras de Tiendanube{data.historySince?`, desde el ${longDate(data.historySince)}`:''}. La “primera compra” es la primera dentro de ese historial, así que el valor real de los clientes más viejos puede ser mayor.</div>
      <div className="p-grid p-g4" style={{marginBottom:16}}>
        <div className="p-card p-kpi p-hero p-reveal"><small>Valor de vida promedio</small><b className="p-mono">{money(data.averageValue)}</b><span className="p-sub">Lo que compra un cliente en total · mediana {money(data.medianValue)}</span></div>
        <div className="p-card p-kpi p-reveal" style={{'--i':1} as CSSProperties}><small>Clientes que vuelven</small><b className="p-mono">{pct(data.repeatRate)}</b><span className="p-sub">Dejan el {pct(data.repeatRevenueShare)} de tu facturación</span></div>
        <div className="p-card p-kpi p-reveal" style={{'--i':2} as CSSProperties}><small>Compras por cliente</small><b className="p-mono">{data.ordersPerCustomer.toFixed(2).replace('.',',')}</b><span className="p-sub">En promedio, en todo el historial</span></div>
        <div className="p-card p-kpi p-reveal" style={{'--i':3} as CSSProperties}><small>Tiempo entre compras</small><b className="p-mono">{data.daysBetween===null?'—':`${Math.round(data.daysBetween)} días`}</b><span className="p-sub">{data.daysBetween===null?'Todavía nadie volvió a comprar':'Lo habitual de quienes vuelven'}</span></div>
      </div>

      <div className={`p-card p-reveal ${verdict?.tone||''}`} style={{marginBottom:16}}>
        <div className="p-cardHead"><div><span className="p-eyebrowS">CUÁNTO INVERTIR · {period}</span><h3>¿Cuánto podés gastar para conseguir un cliente?</h3><span className="p-sub">Lo que te deja un cliente en toda su vida, contra lo que te costó en publicidad cada cliente nuevo del período.</span></div></div>
        <div className="p-ltvCheck">
          <div><small>Ganancia de vida por cliente</small><b className="p-mono">{check?.lifetimeProfit==null?'—':money(check.lifetimeProfit)}</b><span className="p-sub">{marginBeforeAds===null?'Falta el margen: completá tus costos':`Valor de vida × tu margen antes de publicidad (${pct(marginBeforeAds)})`}</span></div>
          <div><small>Costo por cliente nuevo</small><b className="p-mono">{check?.costPerCustomer==null?'—':money(check.costPerCustomer)}</b><span className="p-sub">{!adSpend?'Sin inversión publicitaria en el período':`${money(adSpend)} en publicidad ÷ ${data.newInPeriod??0} clientes nuevos`}</span></div>
          <div><small>Relación</small><b className="p-mono">{check?.ratio==null?'—':`${check.ratio.toFixed(1).replace('.',',')} a 1`}</b><span className="p-sub">Lo sano es 3 a 1 o más</span></div>
        </div>
        {verdict&&<p className="p-ltvVerdict">{verdict.text}</p>}
      </div>

      <div className="p-grid p-g2" style={{marginBottom:16}}>
        <div className="p-card p-reveal"><div className="p-cardHead"><div><span className="p-eyebrowS">RECOMPRA</span><h3>¿Cuántos vuelven a comprar?</h3><span className="p-sub">De los clientes que compraron por primera vez, cuántos volvieron dentro de cada plazo.</span></div></div>
          <ul className="p-barList">{data.repurchase.map(item=><li key={item.days}>
            <div className="p-barLabel"><span>Dentro de {item.days} días</span><b className="p-mono">{pct(item.rate)}</b></div>
            <div className="p-barTrack"><i style={{width:`${(item.rate||0)*100}%`}}/></div>
            <small className="p-sub">{item.eligible?`Sobre ${item.eligible.toLocaleString('es-AR')} clientes con al menos ${item.days} días desde su primera compra`:'Todavía no hay clientes con tanta antigüedad'}</small>
          </li>)}</ul>
        </div>
        <div className="p-card p-reveal"><div className="p-cardHead"><div><span className="p-eyebrowS">FRECUENCIA</span><h3>¿Cuántas veces compran?</h3><span className="p-sub">Cuántos clientes compraron una, dos, tres o más veces, y cuánto facturaron.</span></div></div>
          <ul className="p-barList">{data.frequency.map(item=><li key={item.label}>
            <div className="p-barLabel"><span>{item.label}</span><b className="p-mono">{pct(item.share)}</b></div>
            <div className="p-barTrack"><i style={{width:`${item.share*100}%`}}/></div>
            <small className="p-sub">{item.customers.toLocaleString('es-AR')} clientes · {money(item.revenue)}</small>
          </li>)}</ul>
        </div>
      </div>

      <div className="p-card p-reveal">
        <div className="p-cardHead"><div><span className="p-eyebrowS">COHORTES</span><h3>Clientes por mes de primera compra</h3><span className="p-sub">{view==='rate'?'Qué parte de cada grupo volvió a comprar en cada mes siguiente (mes 0 = el mismo mes).':'Cuánto lleva comprado, en promedio, cada cliente del grupo hasta ese mes.'}</span></div>
          <div className="p-tabs"><button type="button" className={view==='rate'?'p-on':undefined} onClick={()=>setView('rate')}>% que volvió</button><button type="button" className={view==='value'?'p-on':undefined} onClick={()=>setView('value')}>Valor acumulado</button></div></div>
        <div className="p-tableWrap"><table className="p-cohort">
          <thead><tr><th>Primera compra</th><th className="p-r">Clientes</th>{Array.from({length:maxMonths},(_,offset)=><th key={offset} className="p-r">Mes {offset}</th>)}</tr></thead>
          <tbody>{data.cohorts.map(cohort=><tr key={cohort.month}>
            <td><b>{monthName(cohort.month)}</b></td><td className="p-r p-mono">{cohort.customers}</td>
            {Array.from({length:maxMonths},(_,offset)=>{const month=cohort.months[offset];if(!month)return <td key={offset}/>;const value=view==='rate'?month.rate:month.valuePerCustomer;
              return <td key={offset} className="p-r p-mono p-cohortCell" style={{'--a':value?.12+value/maxCohort*.6:0} as CSSProperties}>{view==='rate'?(offset===0&&!month.returning?'—':pct(month.rate)):money(month.valuePerCustomer)}</td>;})}
          </tr>)}</tbody>
        </table></div>
      </div>
    </>}
  </>;
}
