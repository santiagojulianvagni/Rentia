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
  return <section className="p-costs">
    <div className="p-head"><div><div className="p-eyebrow">COSTO DE PRODUCTOS</div><h1>Costos <em>por SKU</em></h1><p>Usá el costo informado por tu tienda o reemplazalo manualmente. Los cambios recalculan las ventas históricas.</p></div><div className="p-actions"><button type="button" className="p-btn p-primary" onClick={onSave} disabled={saving||!rows.length||!canManage}>{saving?'Guardando…':'Guardar y recalcular'}</button></div></div>
    <div className="p-grid p-g3" style={{marginBottom:16}}>{([['SKU activos',active.length,''],['Costos manuales',active.filter(row=>row.manual_cost!==null).length,''],['Sin costo cargado',active.filter(row=>row.effective_cost<=0).length,active.some(row=>row.effective_cost<=0)?'p-tone-a':'']] as const).map(([label,value,tone],index)=><div className={`p-card p-kpi p-reveal ${tone}`} style={{'--i':index} as React.CSSProperties} key={label}><small>{label}</small><b className="p-mono">{value.toLocaleString('es-AR')}</b></div>)}</div>
    {unsaved&&canManage?<div className="p-note p-warn" role="status">Tenés costos sin guardar. Tocá <b>Guardar y recalcular</b> para aplicarlos; hasta entonces no se pueden archivar productos.</div>:<div className="p-note">Archivar oculta los avisos del catálogo. No borra ventas ni modifica tu tienda.</div>}
    <div className="p-toolbar"><div className="p-tabs" aria-label="Visibilidad del catálogo">{(['active','archived'] as const).map(value=><button type="button" key={value} className={visibility===value?'p-on':''} aria-pressed={visibility===value} onClick={()=>setVisibility(value)}>{value==='active'?'Activos':'Archivados'} ({value==='active'?active.length:archived.length})</button>)}</div><label className="p-search"><Search className="p-i" aria-hidden="true"/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Producto o SKU" aria-label="Buscar producto o SKU"/></label>{canManage&&<><span className="p-input" style={{height:40,width:250}}><span>Asignación masiva</span><input value={bulk} onChange={event=>setBulk(event.target.value)} inputMode="decimal" placeholder="Costo ARS" style={{textAlign:'right'}} aria-label="Costo para asignar a los productos filtrados"/></span><button type="button" className="p-btn p-small" onClick={applyBulk} disabled={!filtered.length||bulk.trim()===''||!Number.isFinite(parse(bulk))||parse(bulk)<0}>Aplicar a {filtered.length} {filtered.length===1?'producto':'productos'}</button></>}</div>
    {message&&<div className="p-note" role="status">{message}</div>}
    <div className="p-tableWrap p-reveal"><table><thead><tr><th>Producto / SKU</th><th className="p-r">Precio</th><th className="p-r">Costo tienda</th><th className="p-r">Costo manual</th><th className="p-r">Costo usado</th><th/></tr></thead><tbody>{filtered.map(row=>{
      const value=draft[row.variant_id]??'',manual=value===''?null:parse(value),effective=manual??Number(row.store_cost||0),source=manual!==null?'manual':row.store_cost>0?'tiendanube':'sin_costo';
      const changed=(row.manual_cost===null?'':String(row.manual_cost))!==value.trim();
      return <tr key={row.variant_id} className={row.rentia_archived?'p-archived':''}><td><b>{row.product_name}</b><br/><small className="p-sub">{row.sku||`Variante ${row.external_variant_id}`}</small></td><td className="p-r p-mono">{money(row.price)}</td><td className="p-r p-mono">{row.store_cost?money(row.store_cost):'No informado'}</td><td className="p-r"><span className="p-costCell"><input className={`p-cellInput ${changed?'p-dirty':''}`} value={value} onChange={event=>onDraft({[row.variant_id]:event.target.value})} inputMode="decimal" placeholder="Usar tienda" disabled={!canManage||working} aria-label={`Costo manual de ${row.product_name}`}/>{canManage&&value!==''&&<button type="button" className="p-iconBtn p-sm" onClick={()=>onDraft({[row.variant_id]:''})} disabled={working} title="Usar costo de la tienda" aria-label={`Restaurar costo de ${row.product_name}`}><RotateCcw className="p-i" aria-hidden="true"/></button>}</span></td><td className="p-r">{Number.isFinite(effective)&&effective>0?<><b className="p-mono">{money(effective)}</b><br/><small className="p-sub">{changed?'Sin guardar':source==='manual'?'Manual':'Tiendanube'}</small></>:<span className="p-chip p-r">Sin costo</span>}</td><td className="p-r">{canManage&&<button type="button" className="p-btn p-small p-ghost" disabled={working||saving||unsaved} title={unsaved?'Guardá o deshacé los cambios de costos antes de archivar o restaurar un producto.':undefined} onClick={()=>row.rentia_archived?void changeArchive(row,false):openArchive(row)}>{row.rentia_archived?<ArchiveRestore className="p-i" aria-hidden="true"/>:<Archive className="p-i" aria-hidden="true"/>}{row.rentia_archived?'Restaurar':'Archivar'}</button>}</td></tr>;
    })}{!filtered.length&&<tr><td colSpan={6} className="p-empty">{query?'No encontramos productos con esa búsqueda.':visibility==='archived'?'Todavía no hay productos archivados.':'No hay productos activos. Sincronizá tu tienda o revisá los archivados.'}</td></tr>}</tbody></table></div>
    {unsaved&&canManage&&<div className="p-saveBar" style={{marginTop:16}}><div><b>Costos sin guardar</b><small>Al guardar se recalcula todo el historial.</small></div><div className="p-actions"><button type="button" className="p-btn p-primary" onClick={onSave} disabled={saving}>{saving?'Guardando…':'Guardar y recalcular'}</button></div></div>}
    <dialog ref={dialog} className="p-dialog" aria-labelledby="archive-title" onCancel={event=>{if(working)event.preventDefault();else setTarget(null);}}>
      <div className="p-drawerHead"><div><span className="p-eyebrowS" style={{color:'var(--amber)'}}>PASO {step} DE 2 · SOLO EN RENTIA</span><h3 id="archive-title">{step===1?'¿Archivar este producto?':'Confirmá el archivo'}</h3><span className="p-sub">{target?.product_name}</span></div><button type="button" className="p-iconBtn" aria-label="Cerrar" disabled={working} onClick={()=>setTarget(null)}><X className="p-i" aria-hidden="true"/></button></div>
      <div className="p-drawerBody"><p className="p-sub" style={{margin:'0 0 8px'}}>Se ocultarán sus variantes del catálogo activo y de los avisos de productos. Podés restaurarlo cuando quieras.</p><p className="p-sub" style={{margin:'0 0 14px'}}>Sus ventas históricas se conservan. Los costos faltantes de esas ventas seguirán pendientes. La publicación en Mercado Libre o Tiendanube no cambia.</p>
        {step===2&&<label className="p-field"><span className="p-fieldLabel">Escribí ARCHIVAR para confirmar</span><span className="p-input"><input autoFocus value={confirmation} onChange={event=>setConfirmation(event.target.value)} autoComplete="off" disabled={working}/></span></label>}
        {archiveError&&<p className="p-warnLine" role="alert">{archiveError}</p>}</div>
      <div className="p-drawerFoot"><button type="button" className="p-btn p-ghost" disabled={working} onClick={()=>setTarget(null)}>Cancelar</button><button type="button" className="p-btn p-primary" disabled={working||step===2&&confirmation!=='ARCHIVAR'} onClick={()=>step===1?setStep(2):target&&void changeArchive(target,true)}>{working?'Guardando…':step===1?'Continuar':'Confirmar archivo'}</button></div>
    </dialog>
  </section>;
}
