'use client';

import {useEffect,useRef,useState} from 'react';
import {Archive,ArchiveRestore,RotateCcw,Search,X} from 'lucide-react';

export type ProductCostRow={product_id:number;rentia_archived:number;variant_id:number;provider:string;external_variant_id:string;sku:string|null;price:number;store_cost:number;manual_cost:number|null;effective_cost:number;stock:number|null;product_name:string;image_url:string|null;cost_source:'manual'|'tiendanube'|'sin_costo'};
type Props={rows:ProductCostRow[];draft:Record<number,string>;onDraft:(updates:Record<number,string>)=>void;onSave:()=>void;saving:boolean;message:string;onMessage:(message:string)=>void;onChanged:()=>Promise<unknown>;canManage:boolean;money:(value:number)=>string};
const parse=(value:string)=>Number(value.replace(',','.'));

export default function ProductCosts({rows,draft,onDraft,onSave,saving,message,onMessage,onChanged,canManage,money}:Props) {
  const [query,setQuery]=useState(''),[visibility,setVisibility]=useState<'active'|'archived'>('active'),[bulk,setBulk]=useState('');
  const [target,setTarget]=useState<ProductCostRow|null>(null),[step,setStep]=useState(1),[confirmation,setConfirmation]=useState(''),[working,setWorking]=useState(false),[archiveError,setArchiveError]=useState('');
  const dialog=useRef<HTMLDialogElement>(null);
  const active=rows.filter(row=>!row.rentia_archived),archived=rows.filter(row=>row.rentia_archived);
  const filtered=(visibility==='active'?active:archived).filter(row=>`${row.product_name} ${row.sku||''}`.toLowerCase().includes(query.toLowerCase()));
  const unsaved=rows.some(row=>(draft[row.variant_id]?.trim()||'')!==(row.manual_cost===null?'':String(row.manual_cost)));
  useEffect(()=>{if(target)dialog.current?.showModal();else dialog.current?.close();},[target]);
  function openArchive(row:ProductCostRow){setTarget(row);setStep(1);setConfirmation('');setArchiveError('');}
  async function changeArchive(row:ProductCostRow,archive:boolean) {
    if(working||!canManage||unsaved)return;
    setWorking(true);setArchiveError('');
    try {
      const response=await fetch('/api/products/archive',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({productId:row.product_id,archived:archive,confirmation:archive?confirmation:'RESTAURAR'})});
      if(!response.ok)throw new Error();
      await onChanged();setTarget(null);
      onMessage(archive?'Producto archivado en Rentia. Sus ventas y costos históricos se conservan.':'Producto restaurado en el catálogo activo.');
    }catch{
      const text='No pudimos confirmar el cambio. Recargá la lista antes de reintentar.';
      setArchiveError(text);onMessage(text);
    }finally{setWorking(false);}
  }
  function applyBulk() {
    if(!canManage||!filtered.length||bulk.trim()===''||!Number.isFinite(parse(bulk))||parse(bulk)<0)return;
    onDraft(Object.fromEntries(filtered.map(row=>[row.variant_id,bulk])));
    onMessage(`Costo aplicado a ${filtered.length} productos. Guardá los cambios para confirmar.`);
  }
  return <section className="costsPage">
    <div className="costsHeading"><div><span className="muted">COSTO DE PRODUCTOS</span><h2>Costos por SKU</h2><p>Usá el costo informado por tu tienda o reemplazalo manualmente. Los cambios recalculan las ventas históricas.</p></div><button type="button" className="button" onClick={onSave} disabled={saving||!rows.length||!canManage}>{saving?'Guardando…':'Guardar y recalcular'}</button></div>
    <div className="costSummary"><article><span>SKU activos</span><b>{active.length}</b></article><article><span>Costos manuales</span><b>{active.filter(row=>row.manual_cost!==null).length}</b></article><article className={active.some(row=>row.effective_cost<=0)?'warning':''}><span>Sin costo cargado</span><b>{active.filter(row=>row.effective_cost<=0).length}</b></article></div>
    {unsaved&&canManage&&<p className="costsUnsaved" role="status">Tenés costos sin guardar. Tocá <b>Guardar y recalcular</b> para aplicarlos; hasta entonces no se pueden archivar productos.</p>}
    <div className="catalogVisibility" aria-label="Visibilidad del catálogo"><div>{(['active','archived'] as const).map(value=><button type="button" key={value} className={visibility===value?'active':''} aria-pressed={visibility===value} onClick={()=>setVisibility(value)}>{value==='active'?'Activos':'Archivados'} <span>{value==='active'?active.length:archived.length}</span></button>)}</div><small>Archivar oculta los avisos del catálogo. No borra ventas ni modifica tu tienda.</small></div>
    <div className="costToolbar"><label>Buscar<div className="catalogSearch"><Search size={16} aria-hidden="true"/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Producto o SKU"/></div></label><div><label>Asignación masiva<input value={bulk} onChange={event=>setBulk(event.target.value)} inputMode="decimal" placeholder="Costo ARS"/></label><button type="button" className="outline bulkApplyButton" onClick={applyBulk} disabled={!canManage||!filtered.length||bulk.trim()===''||!Number.isFinite(parse(bulk))||parse(bulk)<0}>Aplicar a {filtered.length} {filtered.length===1?'producto':'productos'}</button></div></div>
    {message&&<div className="costFeedback" role="status">{message}</div>}
    {unsaved&&<p className="catalogHint">Guardá o deshacé los cambios de costos antes de archivar o restaurar un producto.</p>}
    <div className="costTable"><div className="costRow costHead"><span>Producto / SKU</span><span>Precio</span><span>Costo tienda</span><span>Costo manual</span><span>Costo usado</span></div>{filtered.map(row=>{
      const value=draft[row.variant_id]??'',manual=value===''?null:parse(value),effective=manual??Number(row.store_cost||0),source=manual!==null?'manual':row.store_cost>0?'tiendanube':'sin_costo';
      return <div className={`costRow ${row.rentia_archived?'catalogArchived':''}`} key={row.variant_id}><div className="costProduct"><b>{row.product_name}</b><small>{row.sku||`Variante ${row.external_variant_id}`}</small>{canManage&&<button type="button" className="catalogArchiveAction" disabled={working||saving||unsaved} title={unsaved?'Guardá los costos antes de archivar':undefined} onClick={()=>row.rentia_archived?void changeArchive(row,false):openArchive(row)}>{row.rentia_archived?<ArchiveRestore size={13}/>:<Archive size={13}/>} {row.rentia_archived?'Restaurar':'Archivar en Rentia'}</button>}</div><span>{money(row.price)}</span><span>{row.store_cost?money(row.store_cost):'No informado'}</span><div className="costInput"><span>ARS</span><input value={value} onChange={event=>onDraft({[row.variant_id]:event.target.value})} inputMode="decimal" placeholder="Usar tienda" disabled={!canManage||working}/><button type="button" onClick={()=>onDraft({[row.variant_id]:''})} disabled={!canManage||working} title="Usar costo de la tienda" aria-label={`Restaurar costo de ${row.product_name}`}><RotateCcw size={16}/></button></div><div className="effectiveCost"><b>{money(Number.isFinite(effective)?effective:0)}</b><small className={`sourcePill ${source}`}>{source==='manual'?'Manual':source==='tiendanube'?'Tiendanube':'Sin costo'}</small></div></div>;
    })}{!filtered.length&&<div className="noResults">{query?'No encontramos productos con esa búsqueda.':visibility==='archived'?'Todavía no hay productos archivados.':'No hay productos activos. Sincronizá tu tienda o revisá los archivados.'}</div>}</div>
    <dialog ref={dialog} className="catalogArchiveDialog" aria-labelledby="archive-title" onCancel={event=>{if(working)event.preventDefault();else setTarget(null);}}>
      <button type="button" className="archiveDialogClose" aria-label="Cerrar" disabled={working} onClick={()=>setTarget(null)}><X size={18}/></button>
      <span className="archiveDialogIcon"><Archive size={23}/></span><small>PASO {step} DE 2 · SOLO EN RENTIA</small><h3 id="archive-title">{step===1?'¿Archivar este producto?':'Confirmá el archivo'}</h3><strong>{target?.product_name}</strong>
      <p>Se ocultarán sus variantes del catálogo activo y de los avisos de productos. Podés restaurarlo cuando quieras.</p><p>Sus ventas históricas se conservan. Los costos faltantes de esas ventas seguirán pendientes. La publicación en Mercado Libre o Tiendanube no cambia.</p>
      {step===2&&<label>Escribí ARCHIVAR para confirmar<input autoFocus value={confirmation} onChange={event=>setConfirmation(event.target.value)} autoComplete="off" disabled={working}/></label>}
      {archiveError&&<p className="archiveError" role="alert">{archiveError}</p>}
      <footer><button type="button" className="outline" disabled={working} onClick={()=>setTarget(null)}>Cancelar</button><button type="button" className="button" disabled={working||step===2&&confirmation!=='ARCHIVAR'} onClick={()=>step===1?setStep(2):target&&void changeArchive(target,true)}>{working?'Guardando…':step===1?'Continuar':'Confirmar archivo'}</button></footer>
    </dialog>
  </section>;
}
