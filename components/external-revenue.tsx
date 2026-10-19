'use client';

import RpSelect from './panel/rp-select';
import {confirmDialog} from './panel/rp-confirm';
import {useEffect,useState} from 'react';

type Entry={revenue_date:string;order_count:number;revenue:number;product_cost?:number|null};
type Props={onChanged:()=>Promise<unknown>;canManage:boolean;money:(value:number,currency?:string)=>string;storeId?:number|null;embedded?:boolean};

// Ventas por día de un mes: de un local físico (storeId) o la facturación externa sin local.
export default function ExternalRevenue({onChanged,canManage,money,storeId=null,embedded=false}:Props) {
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const currentMonth=today.slice(0,7);
  const currentYear=Number(currentMonth.slice(0,4));
  const [month,setMonth]=useState(currentMonth);
  const [rows,setRows]=useState<Entry[]>([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [loadFailed,setLoadFailed]=useState(false);
  const [retry,setRetry]=useState(0);
  const [dirty,setDirty]=useState(false);
  const [state,setState]=useState('');
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setLoadFailed(false);setState('');
    fetch(`/api/finance/external-revenue?month=${month}${storeId?`&store=${storeId}`:''}`,{signal:controller.signal})
      .then(async response=>{if(!response.ok)throw new Error('load');return response.json() as Promise<{entries?:Entry[]}>;})
      .then(data=>{
        if(controller.signal.aborted)return;
        const values=new Map<string,Entry>((data.entries||[]).map((entry:Entry)=>[entry.revenue_date,entry]));
        const [year,number]=month.split('-').map(Number);
        const days=new Date(Date.UTC(year,number,0)).getUTCDate();
        setRows(Array.from({length:days},(_,index)=>{const revenueDate=`${month}-${String(index+1).padStart(2,'0')}`;return values.get(revenueDate)||{revenue_date:revenueDate,order_count:0,revenue:0,product_cost:null};}));
        setDirty(false);setLoading(false);
      }).catch(()=>{if(!controller.signal.aborted){setRows([]);setLoadFailed(true);setState('No pudimos cargar este mes. Reintentá para ver y editar sus valores.');setLoading(false);}});
    return()=>controller.abort();
  },[month,retry,storeId]);
  async function selectMonth(next:string) {
    if(saving||next===month)return;
    if(dirty&&!await confirmDialog({title:'Tenés cambios sin guardar en este mes',message:'¿Querés cambiar de mes y descartarlos?',confirmLabel:'Descartar y cambiar',cancelLabel:'Seguir editando',danger:true}))return;
    setLoading(true);setDirty(false);setMonth(next);
  }
  function update(index:number,field:'order_count'|'revenue',value:string) {
    if(!canManage)return;
    setDirty(true);setState('');
    setRows(current=>current.map((row,rowIndex)=>rowIndex===index?{...row,[field]:Math.max(0,Number(value||0))}:row));
  }
  const totalOrders=rows.reduce((sum,row)=>sum+Number(row.order_count||0),0);
  const totalRevenue=rows.reduce((sum,row)=>sum+Number(row.revenue||0),0);
  async function save() {
    if(!canManage||loading||saving||loadFailed)return;
    if(rows.some(row=>!Number.isFinite(row.revenue)||!Number.isInteger(row.order_count))){setState('Revisá los importes y las cantidades: las órdenes deben ser números enteros.');return;}
    setSaving(true);setState('Guardando…');
    try{
      const response=await fetch('/api/finance/external-revenue',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({month,storeId,entries:rows.map(row=>({revenueDate:row.revenue_date,orderCount:row.order_count,revenue:row.revenue,currency:'ARS',productCost:row.product_cost??null}))})});
      if(!response.ok)throw new Error('save');
      setDirty(false);setState('Facturación guardada.');
      await onChanged().catch(()=>{});
    }catch{setState('No pudimos guardar los cambios. Conservamos los valores para que puedas reintentar.');}
    finally{setSaving(false);}
  }
  const monthNumber=month.slice(5,7),selectedYear=month.slice(0,4);
  const monthOptions=Array.from({length:12},(_,index)=>({value:String(index+1).padStart(2,'0'),label:new Intl.DateTimeFormat('es-AR',{month:'long'}).format(new Date(2020,index,1))})).filter(option=>selectedYear!==String(currentYear)||option.value<=currentMonth.slice(5,7));
  const yearOptions=Array.from({length:Math.max(1,currentYear-2000+1)},(_,index)=>({value:String(currentYear-index),label:String(currentYear-index)}));
  return <section className="p-external">
    <div className="p-head">{embedded?<div><span className="p-eyebrowS">CARGA A MANO</span><h3 style={{margin:'4px 0 0'}}>Ventas por día</h3></div>:<div><div className="p-eyebrow">VENTAS FUERA DE TUS CANALES</div><h1>Facturación <em>externa</em></h1><p>Registrá ventas de locales, mayoristas u otros canales, incluso de meses anteriores. Se suman a la facturación total; la ganancia queda pendiente hasta asociar sus costos.</p></div>}
      <div className="p-actions"><span className="p-input" style={{height:40}}><RpSelect value={selectedYear} disabled={saving} onChange={event=>{const value=event.target.value;selectMonth(`${value}-${value===String(currentYear)&&monthNumber>currentMonth.slice(5,7)?currentMonth.slice(5,7):monthNumber}`);}} aria-label="Año">{yearOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</RpSelect></span><span className="p-input" style={{height:40}}><RpSelect value={monthNumber} disabled={saving} onChange={event=>selectMonth(`${selectedYear}-${event.target.value}`)} aria-label="Mes">{monthOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</RpSelect></span></div>
    </div>
    <div className="p-grid p-g3" style={{marginBottom:16}}>{([['Órdenes del mes',loading||loadFailed?'—':totalOrders.toLocaleString('es-AR')],[embedded?'Ventas del mes':'Facturación externa',loading||loadFailed?'—':money(totalRevenue)],['Ticket promedio',loading||loadFailed?'—':money(totalOrders?totalRevenue/totalOrders:0)]] as const).map(([label,value],index)=><div className="p-card p-kpi p-reveal" style={{'--i':index} as React.CSSProperties} key={label}><small>{label}</small><b className="p-mono">{value}</b></div>)}</div>
    {loading?<div className="p-empty">Cargando mes…</div>:loadFailed?<div className="p-note p-warn" role="alert">{state} <button type="button" className="p-btn p-small" onClick={()=>setRetry(value=>value+1)}>Reintentar</button></div>:<div className="p-tableWrap p-reveal"><table className="p-extTable"><thead><tr><th>Fecha</th><th>Día</th><th className="p-r">Órdenes</th><th className="p-r">Facturación · ARS</th></tr></thead><tbody>{rows.map((row,index)=>{
      const future=row.revenue_date>today;
      const dayName=new Intl.DateTimeFormat('es-AR',{weekday:'long'}).format(new Date(`${row.revenue_date}T12:00:00`));
      return <tr className={future?'p-fut':''} key={row.revenue_date}><td><b>{new Intl.DateTimeFormat('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(`${row.revenue_date}T12:00:00`))}</b></td><td className="p-sub">{dayName}</td><td className="p-r"><input className="p-cellInput" type="number" min="0" step="1" inputMode="numeric" aria-label={`Órdenes del ${row.revenue_date}`} value={row.order_count||''} onChange={event=>update(index,'order_count',event.target.value)} disabled={future||saving||!canManage} placeholder="0"/></td><td className="p-r"><input className="p-cellInput" style={{width:150}} type="number" min="0" step="0.01" inputMode="decimal" aria-label={`Facturación del ${row.revenue_date} en ARS`} value={row.revenue||''} onChange={event=>update(index,'revenue',event.target.value)} disabled={future||saving||!canManage} placeholder="0"/></td></tr>;
    })}</tbody></table></div>}
    <div className="p-saveBar" style={{marginTop:16}}><div><b>{loading||loadFailed?'Facturación del mes':`Total del mes: ${money(totalRevenue)}`}</b><small role="status">{loadFailed?'':state||(dirty?'Tenés cambios sin guardar.':'Podés completar o corregir cualquier mes anterior.')}</small></div><div className="p-actions"><button type="button" className="p-btn p-primary" onClick={()=>void save()} disabled={loading||saving||loadFailed||!canManage}>{saving?'Guardando…':'Guardar cambios'}</button></div></div>
  </section>;
}
