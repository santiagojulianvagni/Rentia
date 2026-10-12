'use client';

import { useMemo, useState } from 'react';
import { simulate, weeklySchedule, type ScheduleRule } from '../../lib/cashflow';
import { cashflowView, type CashflowData } from './use-cashflow';

const monthLabel=new Intl.DateTimeFormat('es-AR',{month:'long',year:'numeric',timeZone:'UTC'});
const dayLabel=new Intl.DateTimeFormat('es-AR',{day:'numeric',month:'long',timeZone:'UTC'});
const shortDate=new Intl.DateTimeFormat('es-AR',{day:'numeric',month:'numeric',timeZone:'UTC'});
const weekdayDate=new Intl.DateTimeFormat('es-AR',{weekday:'short',day:'numeric',month:'numeric',timeZone:'UTC'});
const percent=(value:number)=>`${(value*100).toFixed(1).replace('.',',')}%`;
const asDate=(date:string)=>new Date(`${date}T00:00:00Z`);
const BALANCE_KEY='rentia-cash-balance';
const ADS_STEPS=[-0.5,-0.25,0,0.25,0.5,1];
const PRICE_STEPS=[-0.1,-0.05,0,0.05,0.1,0.15];
const signedPercent=(value:number)=>value===0?'Igual':`${value>0?'+':''}${Math.round(value*100)}%`;

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

function readBalance() {
  try { return window.localStorage.getItem(BALANCE_KEY)||''; } catch { return ''; }
}

export default function Cashflow({data,error,rules,money,onNavigate}:{data:CashflowData|null;error:boolean;rules:ScheduleRule[];money:(value:number)=>string;onNavigate:(section:string)=>void}) {
  const [balanceText,setBalanceText]=useState(readBalance);
  const [adsChange,setAdsChange]=useState(0);
  const [priceChange,setPriceChange]=useState(0);
  const view=useMemo(()=>data?cashflowView(data,rules):null,[data,rules]);
  const balance=balanceText.trim()?Number(balanceText.replace(/\./g,'').replace(',','.')):null;
  const schedule=useMemo(()=>data&&view?weeklySchedule({today:data.today,receivables:data.receivables||{pagoNube:[],mercadolibre:{amount:0}},rules,dailySales:view.result.pace,marginBeforeAds:view.marginBeforeAds,dailyAds:view.recentAds,openingBalance:balance!==null&&Number.isFinite(balance)?balance:null}):[],[data,view,rules,balance]);
  const simulation=view?.simulation?simulate(view.simulation,adsChange,priceChange):null;
  const saveBalance=(value:string)=>{const clean=value.replace(/[^0-9.,-]/g,'');setBalanceText(clean);try{window.localStorage.setItem(BALANCE_KEY,clean);}catch{/* Solo es una comodidad de este navegador. */}};

  const month=data?.month||new Date().toISOString().slice(0,7);
  const name=monthLabel.format(asDate(`${month}-01`)),monthName=name.split(' ')[0];
  const receivables=data?.receivables;
  const pendingPagoNube=(receivables?.pagoNube||[]).reduce((sum,item)=>sum+item.amount,0);
  return <>
    <div className="p-head"><div><div className="p-eyebrow">CASHFLOW · {name.toUpperCase()}</div><h1>¿Cómo vas a <em>terminar el mes?</em></h1><p>Cuánto tenés que vender para cubrir tus gastos fijos, qué plata está por entrar y cómo cerrarías {monthName} si seguís al ritmo de los últimos 14 días.</p></div></div>
    {error?<div className="p-empty" role="alert">No pudimos cargar el mes. Probá de nuevo en unos minutos.</div>
    :!view||!data?<div className="p-empty" role="status">Calculando tu mes…</div>
    :(()=>{const r=view.result;const progress=r.breakEven?Math.min(100,view.revenue/r.breakEven*100):0;return <>
      {r.fixed<=0&&<div className="p-notice p-warning" role="status"><div><b>Cargá tus gastos fijos</b><p>Alquiler, sueldos, herramientas, contador: con ellos calculamos cuánto necesitás vender para no perder plata. Si les ponés el día de pago, aparecen en el calendario.</p></div><button type="button" className="p-btn p-small p-primary" onClick={()=>onNavigate('configuracion')}>Cargar gastos fijos</button></div>}
      {view.incomplete&&<div className="p-note">Cálculo provisorio: hay órdenes de este mes con costos sin cargar. <button type="button" className="p-linkBtn" onClick={()=>onNavigate('calidad')}>Ver qué falta</button></div>}
      {r.breakEven!==null&&<div className={`p-card p-reveal p-cashHero p-${r.status}`}>
        <span className="p-eyebrowS">PUNTO DE EQUILIBRIO</span>
        <h2>{r.status==='cubierto'?`¡Ya cubriste los gastos fijos de ${monthName}!`:r.status==='en-camino'?`Vas bien: los cubrís alrededor del ${r.breakEvenDay?dayLabel.format(asDate(r.breakEvenDay)):'fin de mes'}`:`A este ritmo te faltarían ${money(r.shortfall)}`}</h2>
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
        <div className="p-card p-reveal"><div className="p-cardHead"><div><span className="p-eyebrowS">PLATA POR COBRAR</span><h3>Lo que está por entrar</h3><span className="p-sub">De ventas que ya hiciste, sin comisiones.</span></div></div>
          <ul className="p-weekList">
            {(receivables?.pagoNube||[]).slice(0,5).map(item=><li key={item.date}><span>Pago Nube · {weekdayDate.format(asDate(item.date))}</span><small className="p-sub">{item.orders} {item.orders===1?'venta':'ventas'}</small><b className="p-mono">{money(item.amount)}</b></li>)}
            {(receivables?.pagoNube.length||0)>5&&<li><span className="p-sub">Y {receivables!.pagoNube.length-5} días más</span><b className="p-mono">{money(receivables!.pagoNube.slice(5).reduce((sum,item)=>sum+item.amount,0))}</b></li>}
            {receivables&&receivables.mercadolibre.orders>0&&<li><span>Mercado Libre · al entregar</span><small className="p-sub">{receivables.mercadolibre.orders} en camino</small><b className="p-mono">{money(receivables.mercadolibre.amount)}</b></li>}
            {receivables&&(pendingPagoNube>0||receivables.mercadolibre.amount>0)?<li><span><b>Total por cobrar</b></span><b className="p-mono">{money(pendingPagoNube+receivables.mercadolibre.amount)}</b></li>:<li><span className="p-sub" style={{whiteSpace:'normal'}}>No hay cobros pendientes de Pago Nube ni ventas de Mercado Libre en camino.</span></li>}
          </ul>
          {receivables&&!receivables.payoutDays&&<p className="p-sub" style={{margin:'10px 0 0'}}>Para estimar los cobros de Pago Nube, configurá el plazo de acreditación en <button type="button" className="p-linkBtn" onClick={()=>onNavigate('configuracion')}>Envíos y comisiones</button>.</p>}
          {receivables&&receivables.otherOrders>0&&<p className="p-sub" style={{margin:'10px 0 0'}}>{receivables.otherOrders} {receivables.otherOrders===1?'venta reciente se cobró':'ventas recientes se cobraron'} con otros medios (transferencia, efectivo u otros procesadores): no conocemos su fecha.</p>}
        </div>
      </div>
      <div className="p-card p-reveal" style={{marginBottom:16}}>
        <div className="p-cardHead"><div><span className="p-eyebrowS">PRÓXIMAS SEMANAS</span><h3>Calendario de plata</h3><span className="p-sub">Entradas y salidas estimadas, semana por semana.</span></div>
          <label className="p-balanceField"><span>Saldo de hoy · opcional</span><span className="p-input"><span>$</span><input value={balanceText} onChange={event=>saveBalance(event.target.value)} inputMode="decimal" placeholder="0" aria-label="Saldo disponible hoy"/></span></label></div>
        <div className="p-tableWrap"><table className="p-cashTable">
          <thead><tr><th>Semana</th><th className="p-r">Cobros</th><th className="p-r">Ventas nuevas</th><th className="p-r">Gastos fijos</th><th className="p-r">Publicidad</th><th className="p-r">Neto</th>{balance!==null&&<th className="p-r">Saldo</th>}</tr></thead>
          <tbody>{schedule.map(week=><tr key={week.start}>
            <td><b>{shortDate.format(asDate(week.start))} al {shortDate.format(asDate(week.end))}</b>{week.fixedItems.length>0&&<><br/><small className="p-sub">{week.fixedItems.map(item=>`${item.name} el ${shortDate.format(asDate(item.date))}`).join(' · ')}</small></>}</td>
            <td className="p-r p-mono">{money(week.collections)}</td>
            <td className="p-r p-mono">{money(week.newSales)}</td>
            <td className="p-r p-mono p-neg">−{money(week.fixed)}</td>
            <td className="p-r p-mono p-neg">−{money(week.ads)}</td>
            <td className={`p-r p-mono ${week.net<0?'p-neg':'p-pos'}`}>{money(week.net)}</td>
            {balance!==null&&<td className={`p-r p-mono ${(week.balance||0)<0?'p-neg':''}`}><b>{money(week.balance||0)}</b></td>}
          </tr>)}</tbody>
        </table></div>
        <p className="p-sub" style={{margin:'10px 0 0'}}>Ventas nuevas: el margen de lo que vendas al ritmo actual, suponiendo que reponés la mercadería que vendés. Los gastos sin día de pago se reparten parejo en el mes. El saldo de hoy queda guardado solo en este navegador.</p>
      </div>
      <div className="p-grid p-g2" style={{marginBottom:16}}>
        <div className="p-card p-reveal"><div className="p-cardHead"><div><span className="p-eyebrowS">SIMULADOR</span><h3>¿Qué pasa si…?</h3><span className="p-sub">Probá cambios y mirá cómo cerraría {monthName}.</span></div></div>
          {simulation?<>
            <div className="p-simRow"><span>Inversión en publicidad</span><div className="p-simChips" role="group" aria-label="Cambio en la inversión publicitaria">{ADS_STEPS.map(step=><button type="button" key={step} className={adsChange===step?'p-on':''} disabled={!view.simulation?.ads} onClick={()=>setAdsChange(step)}>{signedPercent(step)}</button>)}</div>{!view.simulation?.ads&&<small className="p-sub">Sin inversión publicitaria este mes.</small>}</div>
            <div className="p-simRow"><span>Precios</span><div className="p-simChips" role="group" aria-label="Cambio de precios">{PRICE_STEPS.map(step=><button type="button" key={step} className={priceChange===step?'p-on':''} onClick={()=>setPriceChange(step)}>{signedPercent(step)}</button>)}</div></div>
            <ul className="p-weekList" style={{marginTop:12}}>
              <li><span>Facturación del mes</span><small className="p-sub">{money(simulation.current.revenue)} →</small><b className="p-mono">{money(simulation.scenario.revenue)}</b></li>
              <li><span>Ganancia del mes</span><small className="p-sub">{money(simulation.current.profit)} →</small><b className={`p-mono ${simulation.scenario.profit<0?'p-neg':'p-pos'}`}>{money(simulation.scenario.profit)}</b></li>
              {simulation.scenario.breakEven!==null&&<li><span>Punto de equilibrio</span><small className="p-sub">{simulation.current.breakEven!==null?`${money(simulation.current.breakEven)} →`:''}</small><b className="p-mono">{money(simulation.scenario.breakEven)}</b></li>}
              <li><span><b>Diferencia de ganancia</b></span><b className={`p-mono ${simulation.deltaProfit<0?'p-neg':'p-pos'}`}>{simulation.deltaProfit>0?'+':''}{money(simulation.deltaProfit)}</b></li>
            </ul>
            <p className="p-sub" style={{margin:'10px 0 0'}}>Supone que la publicidad extra rinde como hoy (ROAS {view.simulation!.roas.toFixed(2).replace('.',',')}x; en la práctica suele rendir algo menos) y que con otro precio vendés las mismas unidades.</p>
          </>:<div className="p-empty">Cuando haya ventas este mes vas a poder simular escenarios.</div>}
        </div>
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
      <div className="p-note p-reveal">Las proyecciones suponen que seguís vendiendo como en los últimos 14 días. No incluyen la facturación externa, porque no conocemos sus costos. Los cobros son estimados con el plazo de Pago Nube y el estado de envío de Mercado Libre.</div>
    </>;})()}
  </>;
}
