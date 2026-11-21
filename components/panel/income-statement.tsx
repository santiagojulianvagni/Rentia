'use client';

import { useEffect, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { incomeStatement, monthRange, previousMonth, recentMonths, share, type StatementLine, type StatementMetrics } from '../../lib/income-statement';
import { argentinaDay } from '../../lib/local-date';
import RpSelect from './rp-select';

type ChannelRow={provider:string;label:string;orders:number;revenue:number;productCost?:number;shipping?:number;commissions?:number;taxes?:number;profitBeforeAds?:number|null};
type MonthData={metrics:StatementMetrics&{orders:number;externalRevenue:number};channels:ChannelRow[]};

const monthLabel=(month:string)=>{const text=new Intl.DateTimeFormat('es-AR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${month}-01T12:00:00Z`));return text.charAt(0).toUpperCase()+text.slice(1);};
const pct=(value:number|null)=>value===null?'—':`${(value*100).toFixed(1).replace('.',',')} %`;
const escapeHtml=(text:string)=>text.replace(/[&<>"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[char]!);
// Celda para Excel: números sin formato y textos entre comillas, separados por punto y coma.
const cell=(value:string|number)=>typeof value==='number'?String(Math.round(value)):`"${value.replace(/"/g,'""')}"`;

async function getMonth(month:string,today:string):Promise<MonthData|null> {
  const {start,end}=monthRange(month,today);
  if(start>today)return null;
  const response=await fetch(`/api/dashboard?start=${start}&end=${end}`,{cache:'no-store'});
  return response.ok?await response.json() as MonthData:null;
}

// Estado de resultados del mes elegido, comparado con el mes anterior, para el dueño o el contador.
export default function IncomeStatement({money,storeName}:{money:(value:number)=>string;storeName:string}) {
  const [today]=useState(()=>argentinaDay(new Date().toISOString()));
  const months=recentMonths(today.slice(0,7));
  const [month,setMonth]=useState(months[0]);
  const [state,setState]=useState<{month:string;current:MonthData|null;previous:MonthData|null;error:boolean}|null>(null);
  useEffect(()=>{
    let cancelled=false;
    Promise.all([getMonth(month,today),getMonth(previousMonth(month),today)])
      .then(([current,previous])=>{if(!cancelled)setState({month,current,previous,error:!current});})
      .catch(()=>{if(!cancelled)setState({month,current:null,previous:null,error:true});});
    return ()=>{cancelled=true;};
  },[month,today]);
  const loading=!state||state.month!==month;
  const lines=state?.current?incomeStatement(state.current.metrics):[];
  const previousLines=new Map((state?.previous?incomeStatement(state.previous.metrics):[]).map(line=>[line.key,line.amount]));
  const revenue=state?.current?.metrics.revenue||0;
  const partial=monthRange(month,today).end===today&&month===today.slice(0,7);
  const title=`Estado de resultados · ${monthLabel(month)}`;

  function downloadExcel() {
    if(!state?.current)return;
    const rows:Array<Array<string|number>>=[['Concepto','% de facturación',monthLabel(month),monthLabel(previousMonth(month))]];
    for(const line of lines)rows.push([line.label,pct(share(line.amount,revenue)),line.amount,previousLines.get(line.key)??'']);
    rows.push([],['Detalle por canal'],['Canal','Órdenes','Facturación','Costo de productos','Envíos','Comisiones','Impuestos','Margen antes de publicidad']);
    for(const channel of state.current.channels.filter(row=>row.orders>0))rows.push([channel.label,channel.orders,channel.revenue,channel.productCost??'',channel.shipping??'',channel.commissions??'',channel.taxes??'',channel.profitBeforeAds??'']);
    if(state.current.metrics.externalRevenue)rows.push([],['Ventas de otros canales sin costos cargados (no incluidas)','',state.current.metrics.externalRevenue]);
    const csv='﻿'+rows.map(row=>row.map(cell).join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');
    link.href=url;link.download=`rentia-estado-de-resultados-${month}.csv`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  // PDF: una página limpia para imprimir o guardar como PDF desde el navegador.
  function printPdf() {
    if(!state?.current)return;
    const view=window.open('','_blank','width=900,height=1000');
    if(!view)return;
    const row=(line:StatementLine)=>`<tr class="${line.kind}"><td>${escapeHtml(line.label)}</td><td>${pct(share(line.amount,revenue))}</td><td>${escapeHtml(money(line.amount))}</td><td>${previousLines.has(line.key)?escapeHtml(money(previousLines.get(line.key)!)):'—'}</td></tr>`;
    view.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
      body{font-family:system-ui,Segoe UI,sans-serif;color:#0b1826;margin:40px}h1{font-size:22px;margin:0 0 4px}p{color:#4a5d6e;margin:0 0 24px;font-size:13px}
      table{width:100%;border-collapse:collapse;font-size:14px}th{text-align:right;font-size:11px;letter-spacing:.08em;color:#4a5d6e;border-bottom:2px solid #0b1826;padding:8px}th:first-child,td:first-child{text-align:left}
      td{text-align:right;padding:8px;border-bottom:1px solid #e3e9ee}tr.subtotal td,tr.income td{font-weight:700}tr.total td{font-weight:800;border-top:2px solid #0b1826;font-size:15px}
      footer{margin-top:28px;color:#6b8398;font-size:11px}@media print{body{margin:16mm}}</style></head><body>
      <h1>${escapeHtml(title)}</h1><p>${escapeHtml(storeName)}${partial?` · hasta el ${escapeHtml(new Intl.DateTimeFormat('es-AR',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(`${today}T12:00:00Z`)))}`:''}</p>
      <table><thead><tr><th>CONCEPTO</th><th>% DE FACTURACIÓN</th><th>${escapeHtml(monthLabel(month).toUpperCase())}</th><th>${escapeHtml(monthLabel(previousMonth(month)).toUpperCase())}</th></tr></thead><tbody>${lines.map(row).join('')}</tbody></table>
      <footer>Generado con Rentia (rentiaapp.com). Montos calculados con las ventas, costos y gastos cargados en Rentia.</footer>
      <script>window.onload=()=>{window.print();}</script></body></html>`);
    view.document.close();
  }

  return <>
    <div className="p-head"><div><div className="p-eyebrow">FINANZAS</div><h1>Estado de <em>resultados</em></h1><p>Lo que facturaste, lo que costó y lo que te quedó, mes por mes. Listo para descargar y mandarle a tu contador.</p></div>
      <div className="p-actions">
        <span className="p-input p-stMonth"><RpSelect value={month} onChange={event=>setMonth(event.target.value)} aria-label="Mes">{months.map(value=><option key={value} value={value}>{monthLabel(value)}</option>)}</RpSelect></span>
        <button type="button" className="p-btn" onClick={downloadExcel} disabled={loading||!state?.current}><Download className="p-i" aria-hidden="true"/>Descargar Excel</button>
        <button type="button" className="p-btn p-primary" onClick={printPdf} disabled={loading||!state?.current}><Printer className="p-i" aria-hidden="true"/>Descargar PDF</button>
      </div>
    </div>
    {loading?<div className="p-card p-empty">Armando el estado de resultados…</div>
    :state?.error||!state?.current?<div className="p-card p-empty">No pudimos cargar ese mes. Probá de nuevo en unos minutos.</div>
    :<div className="p-card p-reveal">
      <div className="p-cardHead"><div><span className="p-eyebrowS">ESTADO DE RESULTADOS</span><h3>{monthLabel(month)}{partial?' · en curso':''}</h3></div><span className="p-sub">{state.current.metrics.orders.toLocaleString('es-AR')} órdenes</span></div>
      <div className="p-tableWrap"><table className="p-statement">
        <thead><tr><th>Concepto</th><th className="p-r">% de facturación</th><th className="p-r">{monthLabel(month)}</th><th className="p-r">{monthLabel(previousMonth(month))}</th></tr></thead>
        <tbody>{lines.map(line=><tr key={line.key} className={`p-st-${line.kind}`}>
          <td>{line.label}</td>
          <td className="p-r p-mono">{pct(share(line.amount,revenue))}</td>
          <td className={`p-r p-mono ${line.kind==='cost'&&line.amount<0?'p-neg':line.kind==='total'?(line.amount<0?'p-neg':'p-pos'):''}`}>{money(line.amount)}</td>
          <td className="p-r p-mono p-sub">{previousLines.has(line.key)?money(previousLines.get(line.key)!):'—'}</td>
        </tr>)}</tbody>
      </table></div>
      <p className="p-sub" style={{fontSize:12.5,margin:'12px 0 0'}}>{partial?'El mes todavía está en curso: los números cambian a medida que entran ventas. ':''}{state.current.metrics.externalRevenue?`No incluye ${money(state.current.metrics.externalRevenue)} de ventas de otros canales sin costos cargados. `:''}El Excel trae además el detalle por canal.</p>
    </div>}
  </>;
}
