'use client';

import { useId, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { ArrowRight, BarChart3, Check, ChevronDown, HelpCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { planQuote, type RentiaPlan } from '../lib/plans';

type Props={
  plans:RentiaPlan[];
  initialPlanId?:string;
  recommendedPlanId?:string;
  usageOrders?:number;
  annual:boolean;
  onAnnualChange:(annual:boolean)=>void;
  onChoose?:(planId:string)=>void;
  currentPlanId?:string;
  requestedPlanId?:string|null;
  requestedBillingCycle?:string;
  savingPlanId?:string|null;
  canManage?:boolean;
  publicPricing?:boolean;
  officialRate?:OfficialRate|null;
};

export type OfficialRate={sell:number;updatedAt:string|null};
export const formatArs=(value:number)=>new Intl.NumberFormat('es-AR',{maximumFractionDigits:0}).format(Math.round(value));
export const rateDate=(value:string|null)=>value?new Intl.DateTimeFormat('es-AR',{day:'numeric',month:'numeric'}).format(new Date(value)):null;

const formatNumber=(value:number)=>new Intl.NumberFormat('es-AR',{minimumFractionDigits:Number.isInteger(value)?0:2,maximumFractionDigits:2}).format(value);
const capacity=(plan:RentiaPlan)=>plan.orders===null?'Más de 10.000':`Hasta ${formatNumber(plan.orders)}`;

export default function PlanConfigurator({plans,initialPlanId='growth',recommendedPlanId,usageOrders,annual,onAnnualChange,onChoose,currentPlanId,requestedPlanId,requestedBillingCycle,savingPlanId,canManage=true,publicPricing=false,officialRate=null}:Props) {
  const initialIndex=Math.max(0,plans.findIndex(plan=>plan.id===initialPlanId));
  const [sliderPosition,setSliderPosition]=useState(initialIndex);
  const [dragging,setDragging]=useState(false);
  const selectedIndex=Math.min(Math.round(sliderPosition),plans.length-1);
  const selectPlan=(index:number)=>setSliderPosition(Math.max(0,Math.min(index,plans.length-1)));
  const finishDrag=(event:PointerEvent<HTMLInputElement>)=>{
    setDragging(false);
    selectPlan(Math.round(Number(event.currentTarget.value)));
  };
  const handleSliderKey=(event:KeyboardEvent<HTMLInputElement>)=>{
    const next=event.key==='Home'?0:event.key==='End'?plans.length-1:
      ['ArrowRight','ArrowUp','PageUp'].includes(event.key)?selectedIndex+1:
      ['ArrowLeft','ArrowDown','PageDown'].includes(event.key)?selectedIndex-1:null;
    if(next===null)return;
    event.preventDefault();
    selectPlan(next);
  };
  const sliderId=useId(),detailsId=useId();
  const plan=plans[Math.min(selectedIndex,plans.length-1)];
  if (!plan) return null;
  const progress=plans.length>1?sliderPosition/(plans.length-1)*100:0;
  const quote=planQuote(plan,annual);
  const saved=requestedPlanId===plan.id&&requestedBillingCycle===(annual?'annual':'monthly');
  const current=currentPlanId===plan.id;
  const recommended=recommendedPlanId===plan.id;
  const locked=!canManage||Boolean(savingPlanId)||saved||current||plan.id==='free';
  const actionLabel=savingPlanId===plan.id?'Guardando…':saved?'Preferencia guardada':current?'Tu plan actual':plan.id==='free'?'Disponible sin cargo':plan.id==='enterprise'?'Registrar interés':`Reservar ${plan.name}`;

  return <div className="p-planBuilder">
    <div className="p-card p-reveal" style={{marginBottom:16}}>
      <div className="p-cardHead"><div><span className="p-eyebrowS"><Sparkles size={14} aria-hidden="true"/> UN PLAN A TU MEDIDA</span><h3 style={{fontSize:20,margin:'4px 0'}}>Tu tienda crece. Tu plan la acompaña.</h3><span className="p-sub">Mové la barra para explorar el precio y todo lo que incluye cada nivel.</span></div><div className="p-tabs" role="group" aria-label="Frecuencia de facturación"><button type="button" className={!annual?'p-on':''} aria-pressed={!annual} onClick={()=>onAnnualChange(false)}>Mensual</button><button type="button" className={annual?'p-on':''} aria-pressed={annual} onClick={()=>onAnnualChange(true)}>Anual <span className="p-chip p-g" style={{padding:'1px 6px'}}>2 meses gratis</span></button></div></div>
      <div className="p-planGrid">
        <div>
          <label htmlFor={sliderId}><b>¿Cuántas órdenes tiene tu tienda por mes?</b></label><p className="p-sub" style={{margin:'2px 0 14px'}}>Elegí el nivel que cubre tu volumen de ventas.</p>
          <output htmlFor={sliderId}><b key={plan.id} className="p-mono p-swapValue" style={{fontSize:30}}>{capacity(plan)}</b> <span className="p-sub">órdenes / mes</span></output>
          <input id={sliderId} aria-label="Volumen mensual de órdenes" aria-valuetext={`${capacity(plan)} órdenes por mes. Plan ${plan.name}. ${quote.monthlyEquivalent===null?'Precio a medida':`USD ${formatNumber(quote.monthlyEquivalent)} por mes`}.`} aria-describedby={detailsId} type="range" min={0} max={Math.max(0,plans.length-1)} step={0.01} value={sliderPosition} data-dragging={dragging} style={{'--fill':`${progress}%`,margin:'14px 0 8px'} as CSSProperties} onChange={event=>setSliderPosition(Number(event.target.value))} onKeyDown={handleSliderKey} onPointerDown={event=>{setDragging(true);event.currentTarget.setPointerCapture(event.pointerId);}} onPointerUp={finishDrag} onPointerCancel={finishDrag} onLostPointerCapture={finishDrag}/>
          <div className="p-ticks">{plans.map((item,index)=><button type="button" key={item.id} className={index===selectedIndex?'p-on':''} aria-label={`${item.name}: ${capacity(item)} órdenes por mes`} aria-pressed={index===selectedIndex} onClick={()=>selectPlan(index)}><b>{item.orders===null?'+10.000':formatNumber(item.orders)}</b><small>{item.name}</small></button>)}</div>
          {usageOrders!==undefined&&<><p className="p-sub" style={{margin:'14px 0 6px'}}><BarChart3 size={14} aria-hidden="true" style={{verticalAlign:-2}}/> Tu tienda tuvo <b style={{color:'var(--text)'}}>{formatNumber(usageOrders)} órdenes</b> en los últimos 30 días.</p><button type="button" className="p-btn p-small p-ghost" onClick={()=>selectPlan(Math.max(0,plans.findIndex(item=>item.id===recommendedPlanId)))}>Ver mi recomendado <ArrowRight size={13} aria-hidden="true"/></button></>}
        </div>
        <div className={`p-planPick ${recommended?'p-rec':''}`} id={detailsId}>
          <div className="p-cardHead" style={{margin:0}}><span className="p-eyebrowS">{plan.id==='enterprise'?'PARA GRANDES OPERACIONES':plan.id==='free'?'TU PRIMER PASO':'PLAN RENTIA'}</span>{recommended?<span className="p-chip p-c">Ideal para tu volumen</span>:current?<span className="p-chip p-g">Plan actual</span>:null}</div>
          <div key={plan.id} className="p-swap">
            <h3 style={{fontSize:24,margin:'8px 0 2px'}}>{plan.name}</h3><p className="p-sub" style={{margin:'0 0 10px'}}>{plan.description}</p>
            <div aria-live="polite" aria-atomic="true">{quote.monthlyEquivalent===null?<b className="p-mono" style={{fontSize:32}}>A medida</b>:<><b className="p-mono" style={{fontSize:32}}>USD {formatNumber(quote.monthlyEquivalent)}</b><span className="p-sub"> / mes{annual?' · equivalente anual':''}</span></>}</div>
            <p className="p-sub" style={{margin:'2px 0 0'}}>{quote.monthlyEquivalent===null?'Una propuesta pensada para tu operación.':quote.total===0?'Sin costo. Sin tarjeta.':annual?<>USD {formatNumber(quote.total!)} facturados al año · <b style={{color:'var(--green)'}}>Ahorrás USD {formatNumber(quote.savings)}</b></>:'Facturación mensual. Precio expresado en USD.'}</p>
            {officialRate&&quote.total?<p className="p-arsRef">Hoy serían <b>ARS {formatArs(quote.total*officialRate.sell)}</b> {annual?'por año':'por mes'} · dólar oficial ${formatArs(officialRate.sell)}{rateDate(officialRate.updatedAt)?` del ${rateDate(officialRate.updatedAt)}`:''}. Se cobra a la cotización del día de cada cobro.</p>:null}
            <div className="p-kv" style={{marginTop:12}}><span>Órdenes por mes</span><b>{plan.orders===null?'+10.000':formatNumber(plan.orders)}</b></div><div className="p-kv"><span>Usuarios</span><b>{plan.users===null?'A medida':plan.users}</b></div><div className="p-kv"><span>Historial inicial</span><b>{plan.history}</b></div>
          </div>
          <small className="p-sub" style={{display:'block',margin:'8px 0'}}>El cupo incluye al propietario. Cada invitación pendiente reserva un lugar hasta que se acepta, vence o se cancela.</small>
          <b style={{fontSize:13}}>Todo claro, desde el primer día.</b>
          <ul className="p-incl">{['Dashboard de ventas y rentabilidad','Costos de productos, envíos y comisiones','Órdenes, productos e inventario','Conexiones disponibles: Tiendanube, Mercado Libre y Meta Ads','Informes y comparación entre períodos'].map(item=><li key={item}><Check aria-hidden="true"/>{item}</li>)}<li><Check aria-hidden="true"/>Soporte {plan.support.toLowerCase()}</li></ul>
          {publicPricing?<a className="p-btn p-primary" style={{width:'100%'}} href={`/registro?plan=${plan.id}&billing=${annual?'annual':'monthly'}`}>{plan.id==='free'?'Empezar gratis':plan.id==='enterprise'?'Consultar por Enterprise':'Probar 14 días'}<ArrowRight size={17} aria-hidden="true"/></a>:<button type="button" className="p-btn p-primary" style={{width:'100%'}} disabled={locked} onClick={()=>onChoose?.(plan.id)}>{actionLabel}{!locked&&<ArrowRight size={17} aria-hidden="true"/>}</button>}
          <p className="p-sub" style={{fontSize:12,margin:'8px 0 0',display:'flex',gap:6,alignItems:'center'}}><ShieldCheck size={14} aria-hidden="true"/>{publicPricing?'14 días de prueba. No pedimos tarjeta.':!canManage?'Solo un administrador puede guardar el plan.':saved?'Esta preferencia no generó ningún cobro.':current?'La simulación no modifica tu suscripción.':'Solo guardamos tu preferencia. No se cobra todavía.'}</p>
        </div>
      </div>
      <p className="p-sub" style={{fontSize:12,margin:'14px 0 0',display:'flex',gap:6}}><HelpCircle size={15} aria-hidden="true"/>Todos los planes importan hasta 12 meses por canal, según los datos disponibles. El historial guardado se conserva y sigue creciendo. Cambian las órdenes, el equipo y el soporte.</p>
    </div>
    <details className="p-card p-reveal" style={{marginBottom:16}}><summary className="p-cardHead" style={{margin:0,cursor:'pointer'}}><div><span className="p-eyebrowS">COMPARAR TODOS LOS PLANES</span><h3>Capacidad y precio de cada plan</h3></div><ChevronDown size={17} aria-hidden="true"/></summary>
      <div className="p-tableWrap" style={{marginTop:14}} tabIndex={0} role="region" aria-label="Comparación de planes, desplazable horizontalmente"><table className="p-cmp"><thead><tr><th scope="col">Tu plan incluye</th>{plans.map(item=><th key={item.id} scope="col" className={item.id===plan.id?'p-sel':''}>{item.name}</th>)}</tr></thead><tbody>
        <tr><th scope="row">Precio mensual {annual&&<small>equivalente anual</small>}</th>{plans.map(item=>{const price=planQuote(item,annual).monthlyEquivalent;return <td key={item.id} className={item.id===plan.id?'p-sel':''}>{price===null?'A medida':`USD ${formatNumber(price)}`}</td>;})}</tr>
        <tr><th scope="row">Órdenes / mes</th>{plans.map(item=><td key={item.id} className={item.id===plan.id?'p-sel':''}>{item.orders===null?'+10.000':formatNumber(item.orders)}</td>)}</tr>
        <tr><th scope="row">Usuarios</th>{plans.map(item=><td key={item.id} className={item.id===plan.id?'p-sel':''}>{item.users??'A medida'}</td>)}</tr>
        <tr><th scope="row">Historial inicial</th>{plans.map(item=><td key={item.id} className={item.id===plan.id?'p-sel':''}>{item.history}</td>)}</tr>
        <tr><th scope="row">Soporte</th>{plans.map(item=><td key={item.id} className={item.id===plan.id?'p-sel':''}>{item.support}</td>)}</tr>
      </tbody></table></div>
      <p className="p-sub" style={{fontSize:12,margin:'10px 0 0'}}>El importe anual se muestra completo en la tarjeta del plan. La barra es una simulación: no cambia tu cuenta ni genera cargos.</p>
    </details>
  </div>;
}
