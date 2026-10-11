'use client';

import RpSelect from './panel/rp-select';
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,CheckCircle2,ChevronDown,FileText,RefreshCw,Search,TriangleAlert} from 'lucide-react';
import {billingCategories,billingCategory,billingErrorMessage,type BillingEntry,type BillingGroup} from '../lib/meli-billing-data';

type Report={connected:boolean;group:BillingGroup;period:string;progress:{pending:boolean;error:string|null;retryAt:number;completedAt:string|null;startedAt:string}|null;leaseExpiresAt:number;totals:{currency:string;direction:string;count:number;amountCents:number}[];entries:BillingEntry[];pagination:{page:number;total:number;pageSize:number}};
function amount(cents:number,currency:string){return new Intl.NumberFormat('es-AR',{style:'currency',currency,minimumFractionDigits:2}).format(cents/100);}
function displayDate(value:string|null){return value?new Date(value).toLocaleString('es-AR'):'No informado';}
function BillingPagination({page,total,onChange}:{page:number;total:number;onChange:(page:number)=>void}) {
  const pages=Math.max(1,Math.ceil(total/100));
  if(!total)return null;
  return <nav className="p-pager" aria-label="Páginas de cargos"><span>{((page-1)*100+1).toLocaleString('es-AR')}–{Math.min(page*100,total).toLocaleString('es-AR')} de {total.toLocaleString('es-AR')} conceptos</span><div className="p-pages"><button type="button" disabled={page===1} onClick={()=>onChange(page-1)}>Anterior</button><span className="p-ellipsis">{page} / {pages}</span><button type="button" disabled={page===pages} onClick={()=>onChange(page+1)}>Siguiente</button></div></nav>;
}
function Entry({entry}:{entry:BillingEntry}) {
  const [open,setOpen]=useState(false);
  const category=billingCategories[billingCategory(entry.name)];
  const tone=entry.direction==='charge'?'p-r':entry.direction==='credit'?'p-g':'p-n';
  return <>
    <tr className={`p-click ${open?'p-openRow':''}`} onClick={()=>setOpen(!open)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setOpen(!open);}}} tabIndex={0} aria-expanded={open}>
      <td><b>{entry.name}</b><br/><small className="p-sub">{entry.code} · {category}</small></td>
      <td><span className={`p-chip ${tone}`}>{entry.direction==='charge'?'Cargo':entry.direction==='credit'?'Bonificación':'Por clasificar'}</span></td>
      <td>{entry.orderIds.length?`Orden #${entry.orderIds[0]}${entry.orderIds.length>1?` + ${entry.orderIds.length-1}`:''}`:'Cargo del período'}<br/><small className="p-sub">{entry.createdAt?new Date(entry.createdAt).toLocaleDateString('es-AR'):'Fecha no informada'}</small></td>
      <td className={`p-r p-mono ${entry.direction==='credit'?'p-pos':''}`}>{entry.direction==='credit'?'− ':''}{amount(entry.amountCents,entry.currency)}</td>
      <td className="p-r"><ChevronDown size={17} aria-hidden="true" style={{transform:open?'rotate(180deg)':undefined,transition:'transform .2s'}}/></td>
    </tr>
    {open&&<tr className="p-billDetail"><td colSpan={5}><div className="p-grid p-g3" style={{gap:12}}>
      {([['Identificador del concepto',`${entry.id} · ${entry.type}`],['Documento',`${entry.documentNumber||entry.documentId||'Aún no informado'} · ${entry.documentType==='CREDIT_NOTE'?'Nota de crédito':'Factura'}`],['Estado del documento',entry.documentStatus||'No informado'],['Descontado de la operación',entry.debited||'No informado'],['Órdenes relacionadas',entry.orderIds.length?entry.orderIds.map(id=>`#${id}`).join(' · '):'Sin orden vinculada por Mercado Libre'],['Operaciones relacionadas',entry.operationIds.join(' · ')||'No informadas'],...(entry.status?[['Estado del cargo',entry.status]]:[]),...(entry.originalChargeId?[['Cargo que bonifica',entry.originalChargeId]]:[]),...(entry.discountCents!==null?[['Descuento informado · ya incluido',`${amount(entry.discountCents,entry.currency)}${entry.discountReason?` · ${entry.discountReason}`:''}`]]:[])] as Array<[string,string]>).map(([label,value])=><div key={label}><small className="p-sub">{label}</small><br/><b style={{fontSize:12.5,overflowWrap:'anywhere'}}>{value}</b></div>)}
    </div><p className="p-sub" style={{fontSize:12,margin:'10px 0 0'}}>Descripción e importe informados por Mercado Libre. La categoría es orientativa; el código original se conserva.</p></td></tr>}
  </>;
}
export default function MeliBilling({canManage,onBack}:{canManage:boolean;onBack:()=>void}) {
  const [group,setGroup]=useState<BillingGroup>('ML'),[period,setPeriod]=useState(()=>new Date().toISOString().slice(0,7)+'-01');
  const [query,setQuery]=useState(''),[page,setPage]=useState(1),[snapshot,setSnapshot]=useState<{key:string;value:Report}|null>(null),[running,setRunning]=useState(false),[error,setError]=useState(''),[refresh,setRefresh]=useState(0),[clock,setClock]=useState(Date.now);
  const [months]=useState(()=>Array.from({length:13},(_,index)=>{const now=new Date(),date=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-index,1));return {value:date.toISOString().slice(0,10),label:date.toLocaleDateString('es-AR',{month:'long',year:'numeric',timeZone:'UTC'})};}));
  const requestKey=JSON.stringify([group,period,page,query]);
  const report=snapshot?.key===requestKey?snapshot.value:null,loading=!report;
  const lastRefresh=useRef(0);
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search),initial=params.get('billing-period'),order=params.get('billing-order');
    const timer=window.setTimeout(()=>{
      if(initial&&months.some(month=>month.value===initial))setPeriod(initial);
      if(order&&/^\d+$/.test(order))setQuery(order);
    },0);
    // Deep links are consumed once; changing a filter never restores the URL.
    return()=>window.clearTimeout(timer);
  },[months]);
  useEffect(()=>{
    const controller=new AbortController();let busy=false,lastRead=0,current:Report|null=null;
    const params=new URLSearchParams({group,period,page:String(page),q:query});
    const read=async()=>{
      const response=await fetch(`/api/mercadolibre/billing?${params}`,{cache:'no-store',signal:controller.signal});
      if(!response.ok)throw new Error();
      current=await response.json() as Report;
      if(!controller.signal.aborted){setSnapshot({key:requestKey,value:current});setClock(Date.now());if(current.pagination.page!==page)setPage(current.pagination.page);}
      return current;
    };
    const poll=async(force=false)=>{
      if(busy||controller.signal.aborted||document.visibilityState!=='visible')return;
      if(!force&&!current?.progress?.pending&&Date.now()-lastRead<30_000)return;
      busy=true;lastRead=Date.now();
      try {
        const value=await read();
        const due=!value.progress||value.progress.pending||!value.progress.completedAt||Date.now()-Date.parse(value.progress.completedAt)>12*3600_000;
        if(canManage&&value.connected&&(force||due)&&(value.progress?.retryAt||0)<=Date.now()&&(value.leaseExpiresAt||0)<=Date.now()) {
          setRunning(true);
          const response=await fetch(`/api/mercadolibre/billing?${params}${force?'&force=1':''}`,{method:'POST',signal:controller.signal});
          if(!response.ok)throw new Error();
          await read();
        }
        if(!controller.signal.aborted)setError('');
      }catch{if(!controller.signal.aborted)setError('No pudimos consultar el desglose. Los importes guardados se conservan.');}
      finally{busy=false;if(!controller.signal.aborted)setRunning(false);}
    };
    const delay=window.setTimeout(()=>{const force=refresh>lastRefresh.current;lastRefresh.current=refresh;void poll(force);},250);
    const timer=window.setInterval(()=>void poll(),8000);
    return()=>{controller.abort();window.clearTimeout(delay);window.clearInterval(timer);};
  },[group,period,page,query,canManage,refresh,requestKey]);
  const pending=!report?.progress||report.progress.pending;
  const message=billingErrorMessage(report?.progress?.error||null);
  const currencies=[...new Set(report?.totals.map(total=>total.currency)||[])];
  const sum=(currency:string,direction:string)=>report?.totals.find(total=>total.currency===currency&&total.direction===direction)?.amountCents||0;
  const changePage=(value:number)=>setPage(value);
  const pagination=report&&<BillingPagination page={report.pagination.page} total={report.pagination.total} onChange={changePage}/>;
  return <>
    <button type="button" className="p-linkBtn" style={{marginBottom:12}} onClick={onBack}><ArrowLeft className="p-i" aria-hidden="true"/> Integraciones</button>
    <div className="p-head"><div><div className="p-eyebrow">DETALLE OFICIAL · SIN CARGOS ESTIMADOS</div><h1>Cargos de <em>Mercado Libre</em></h1><p>Cada concepto, su importe y sus referencias. También los que no pertenecen a una venta puntual.</p></div><div className="p-actions"><div className="p-input" style={{height:40}}><RpSelect value={period} onChange={event=>{setPeriod(event.target.value);setPage(1);setError('');}} aria-label="Período de facturación">{months.map(month=><option key={month.value} value={month.value}>{month.label}</option>)}</RpSelect></div><div className="p-tabs" aria-label="Cuenta de facturación">{([['ML','Mercado Libre'],['MP','Mercado Pago']] as const).map(([value,label])=><button type="button" key={value} className={group===value?'p-on':''} onClick={()=>{setGroup(value as BillingGroup);setPage(1);setError('');}}>{label}</button>)}</div><button type="button" className={`p-btn ${running?'p-spin':''}`} disabled={!canManage||Boolean(error)||loading||running||!report?.connected||(report.progress?.retryAt||0)>clock} aria-busy={running} onClick={()=>setRefresh(value=>value+1)}><RefreshCw className="p-i" aria-hidden="true"/>{running?'Importando detalle…':'Actualizar detalle'}</button></div></div>
    <div className={`p-notice ${message||error?'p-warning':''}`} role="status">{message||error?<TriangleAlert className="p-i" aria-hidden="true"/>:pending?<RefreshCw className="p-i" aria-hidden="true"/>:<CheckCircle2 className="p-i" aria-hidden="true"/>}<div><b>{error||message||(loading?'Consultando reporte…':!report?.connected?'Conectá Mercado Libre para consultar los cargos':!canManage&&!report.progress?'Un administrador debe importar el reporte':pending?'Importación por lotes · importes parciales':'Detalle importado')}</b><p>{loading?'Consultando el período seleccionado…':report?.progress?.completedAt?`Última consulta completa: ${displayDate(report.progress.completedAt)}`:report?.connected?'El avance se guarda automáticamente. No hace falta dejar esta sección abierta para terminar el lote en curso.':'La conexión se realiza desde Integraciones.'}</p></div></div>
    <div className="p-note"><b>No es el saldo a pagar ni la ganancia.</b> Este es el detalle de facturación. No lo descontamos nuevamente de las órdenes. Las retenciones y percepciones necesitan conciliación fiscal; la ausencia de un concepto no confirma un impuesto de $0.</div>
    {currencies.map(currency=><div className="p-grid p-g4" style={{marginBottom:16}} key={currency}><div className="p-card p-kpi p-reveal"><small>Cargos{pending?' · parcial':''} · {currency}</small><b className="p-mono" style={{fontSize:20}}>{amount(sum(currency,'charge'),currency)}</b></div><div className="p-card p-kpi p-reveal" style={{'--i':1} as React.CSSProperties}><small>Bonificaciones{pending?' · parcial':''} · {currency}</small><b className="p-mono p-pos" style={{fontSize:20}}>{amount(sum(currency,'credit'),currency)}</b></div><div className="p-card p-kpi p-hero p-reveal" style={{'--i':2} as React.CSSProperties}><small>Neto de conceptos conocidos{pending?' · parcial':''}</small><b className="p-mono" style={{fontSize:20}}>{amount(sum(currency,'charge')-sum(currency,'credit'),currency)}</b><span className="p-sub" style={{fontSize:11.5}}>No es el saldo a pagar ni la ganancia</span></div>{report?.totals.some(total=>total.currency===currency&&total.direction==='unknown')&&<div className="p-card p-kpi p-reveal" style={{'--i':3} as React.CSSProperties}><small>Por clasificar · no incluido en el neto</small><b className="p-mono" style={{fontSize:20}}>{amount(sum(currency,'unknown'),currency)}</b></div>}</div>)}
    <div className="p-toolbar"><label className="p-search"><Search className="p-i" aria-hidden="true"/><input aria-label="Buscar concepto, código u orden" value={query} onChange={event=>{setQuery(event.target.value);setPage(1);}} placeholder="Buscar concepto, código u orden"/></label><span className="p-sub">Los totales corresponden al período completo importado</span></div>
    {pagination}
    <div className="p-tableWrap p-reveal" style={{margin:'10px 0'}}><table><thead><tr><th>Concepto original</th><th>Movimiento</th><th>Referencia / fecha</th><th className="p-r">Importe</th><th/></tr></thead><tbody>{report?.entries.map(entry=><Entry key={`${group}:${period}:${entry.id}`} entry={entry}/>)}{!report?.entries.length&&<tr><td colSpan={5} className="p-empty"><FileText className="p-i" aria-hidden="true"/><br/><b>{loading?'Cargando conceptos…':query?'No hay coincidencias en el detalle importado':pending?'Todavía no hay conceptos importados':'Mercado Libre no informó conceptos para este período'}</b><br/>{pending?'Los importes no se consideran cero mientras falten páginas o permisos.':'Podés elegir otro mes o consultar la cuenta de Mercado Pago.'}</td></tr>}</tbody></table></div>
    {pagination}
    <p className="p-sub" style={{fontSize:12}}>Se incluyen facturas y notas de crédito, sin un catálogo cerrado de códigos. Una bonificación de cargo no equivale necesariamente al reembolso de una venta.</p>
  </>;
}
