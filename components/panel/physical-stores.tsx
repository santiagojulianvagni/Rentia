'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { CalendarDays, Handshake, Package, Shirt, Store, Tag, Trash2, type LucideIcon } from 'lucide-react';
import { CHANNEL_KINDS, CHANNEL_KIND_LABELS, type ChannelKind } from '../../lib/physical-stores';
import ExternalRevenue from '../external-revenue';
import StoreImport from './store-import';
import { confirmDialog } from './rp-confirm';

type PhysicalStore={id:number;name:string;kind:ChannelKind;costPercent:number;feePercent:number;taxPercent:number};
type Count={storeId:number|null;days:number;firstDate:string;lastDate:string};
type Draft={name:string;kind:ChannelKind;costPercent:string;feePercent:string;taxPercent:string};

const KIND_ICONS:Record<ChannelKind,LucideIcon>={local:Store,mayorista:Package,showroom:Shirt,feria:CalendarDays,revendedores:Handshake,otro:Tag};
const NAME_HINTS:Record<ChannelKind,string>={local:'Local Palermo',mayorista:'Mayorista',showroom:'Showroom',feria:'Feria de diseño',revendedores:'Revendedoras',otro:'Ventas por Instagram'};
const toDraft=(store?:PhysicalStore):Draft=>({name:store?.name||'',kind:store?.kind||'mayorista',costPercent:store?String(store.costPercent).replace('.',','):'',feePercent:store?String(store.feePercent).replace('.',','):'',taxPercent:store?String(store.taxPercent).replace('.',','):''});
const percent=(value:string)=>{const number=Number((value||'0').replace(',','.'));return Number.isFinite(number)&&number>=0&&number<=100?number:null;};
const ERRORS:Record<string,string>={store_name_taken:'Ya tenés un canal con ese nombre.',too_many_stores:'Podés tener hasta 20 canales.',store_has_sales:'Ese canal ya tiene ventas cargadas: elegí uno vacío.'};

function StoreFields({draft,setDraft,disabled}:{draft:Draft;setDraft:(draft:Draft)=>void;disabled:boolean}) {
  const field=(key:Exclude<keyof Draft,'kind'>)=>({value:draft[key],disabled,onChange:(event:React.ChangeEvent<HTMLInputElement>)=>setDraft({...draft,[key]:key==='name'?event.target.value:event.target.value.replace(/[^0-9.,]/g,'')})});
  return <>
  <div className="p-simChips" role="group" aria-label="Tipo de canal" style={{marginBottom:12}}>{CHANNEL_KINDS.map(kind=>{const Icon=KIND_ICONS[kind];return <button type="button" key={kind} disabled={disabled} className={draft.kind===kind?'p-on':undefined} aria-pressed={draft.kind===kind} onClick={()=>setDraft({...draft,kind})}><Icon className="p-i" aria-hidden="true"/> {CHANNEL_KIND_LABELS[kind]}</button>;})}</div>
  <div className="p-alertGrid p-storeFields">
    <label>Nombre<span><input {...field('name')} maxLength={60} placeholder={NAME_HINTS[draft.kind]} aria-label="Nombre del canal"/></span><small>Así aparece en el resumen, como un canal más.</small></label>
    <label>Costo de mercadería<span><input {...field('costPercent')} inputMode="decimal" aria-label="Costo de mercadería en porcentaje de la venta"/>%</span><small>De cada $100 que vendés, cuánto te costó lo vendido. Si el archivo trae el costo del día, se usa ese.</small></label>
    <label>Comisiones de cobro<span><input {...field('feePercent')} inputMode="decimal" aria-label="Comisiones de cobro en porcentaje"/>%</span><small>Promedio de lo que te cobran las tarjetas, el posnet, el QR o la plataforma. Si cobrás por transferencia, 0.</small></label>
    <label>Impuestos sobre la venta<span><input {...field('taxPercent')} inputMode="decimal" aria-label="Impuestos sobre la venta en porcentaje"/>%</span><small>Por ejemplo, Ingresos Brutos.</small></label>
  </div></>;
}

// Otros canales de venta (local, mayorista, showroom, ferias…): cada uno con sus costos. Las ventas se cargan a mano por
// día o desde el Excel/CSV del sistema de caja.
export default function PhysicalStores({money,canManage,onChanged}:{money:(value:number)=>string;canManage:boolean;onChanged:()=>Promise<unknown>}) {
  const [stores,setStores]=useState<PhysicalStore[]|null>(null);
  const [counts,setCounts]=useState<Count[]>([]);
  const [failed,setFailed]=useState(false);
  const [selected,setSelected]=useState<number|'legacy'|'new'|null>(null);
  const [mode,setMode]=useState<'import'|'manual'>('import');
  const [draft,setDraft]=useState<Draft>(toDraft());
  const [adopt,setAdopt]=useState(true);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');

  const load=useCallback(async()=>{
    const response=await fetch('/api/finance/stores',{cache:'no-store'});
    if(!response.ok)throw new Error();
    const data=await response.json() as {stores:PhysicalStore[];counts:Count[]};
    setStores(data.stores);setCounts(data.counts);
    return data;
  },[]);
  useEffect(()=>{
    load().then(data=>setSelected(current=>current??(data.stores[0]?.id??'new'))).catch(()=>setFailed(true));
  },[load]);

  const legacy=counts.find(item=>item.storeId===null);
  const store=typeof selected==='number'?stores?.find(item=>item.id===selected)||null:null;
  const daysOf=(id:number)=>counts.find(item=>item.storeId===id)?.days||0;
  // El formulario se rellena al cambiar de local, no cada vez que se recargan los datos.
  const storeKey=selected==='new'?'new':store?`${store.id}`:'';
  useEffect(()=>{if(storeKey==='new')setDraft(toDraft());else if(storeKey)setDraft(toDraft(stores?.find(item=>String(item.id)===storeKey)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[storeKey]);
  const pick=(value:number|'legacy'|'new')=>{setSelected(value);setMessage('');};

  async function refresh(){await load().catch(()=>undefined);await onChanged().catch(()=>undefined);}

  async function submit(event:FormEvent) {
    event.preventDefault();
    if(!canManage||saving)return;
    const values={name:draft.name.trim(),kind:draft.kind,costPercent:percent(draft.costPercent),feePercent:percent(draft.feePercent),taxPercent:percent(draft.taxPercent)};
    if(!values.name){setMessage('Poné un nombre para el canal.');return;}
    if(values.costPercent===null||values.feePercent===null||values.taxPercent===null){setMessage('Los porcentajes van de 0 a 100.');return;}
    setSaving(true);setMessage('');
    try {
      const creating=selected==='new';
      const response=await fetch('/api/finance/stores',{method:creating?'POST':'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(creating?values:{...values,id:selected})});
      const data=await response.json() as {store?:PhysicalStore;error?:string};
      if(!response.ok||!data.store)throw new Error(data.error);
      if(creating&&legacy&&adopt) await fetch('/api/finance/stores/adopt',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({storeId:data.store.id})});
      await refresh();
      setSelected(data.store.id);
      setMessage(creating?'Canal creado. Ahora cargá sus ventas.':'Cambios guardados.');
    } catch(error) {setMessage(ERRORS[error instanceof Error?error.message:'']||'No pudimos guardar el canal. Intentá de nuevo.');}
    finally {setSaving(false);}
  }

  async function remove() {
    if(!store||!canManage)return;
    const days=daysOf(store.id);
    if(!await confirmDialog({title:`¿Borrar ${store.name}?`,message:days?`Se borran también sus ${days} días de ventas cargados. Esto no se puede deshacer.`:'El canal no tiene ventas cargadas.',confirmLabel:'Borrar canal',cancelLabel:'Cancelar',danger:true}))return;
    const response=await fetch('/api/finance/stores',{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({id:store.id})}).catch(()=>null);
    if(!response?.ok){setMessage('No pudimos borrar el canal.');return;}
    const data=await load().catch(()=>null);await onChanged().catch(()=>undefined);
    setSelected(data?.stores[0]?.id??'new');
  }

  async function adoptInto(id:number) {
    const response=await fetch('/api/finance/stores/adopt',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({storeId:id})}).catch(()=>null);
    const data=response?await response.json().catch(()=>({})) as {error?:string}:{};
    if(!response?.ok){setMessage(ERRORS[data.error||'']||'No pudimos mover la facturación.');return;}
    await refresh();setMessage('Listo: la facturación externa ahora es parte de este canal.');
  }

  return <>
    <div className="p-head"><div><div className="p-eyebrow">VENTAS FUERA DE TU TIENDA ONLINE</div><h1>Otros <em>canales</em></h1><p>Sumá lo que vendés por mayor, en un local, showroom, ferias o revendedores. No hace falta tener local: con su costo de mercadería, cada canal aparece en el resumen con su ganancia.</p></div></div>
    {failed&&<div className="p-notice p-warning" role="alert"><div><b>No pudimos cargar tus canales</b><p>Recargá la página para intentar de nuevo.</p></div></div>}
    {stores&&<div className="p-tabs p-storeTabs" role="tablist" aria-label="Canales">
      {stores.map(item=><button type="button" role="tab" key={item.id} aria-selected={selected===item.id} className={selected===item.id?'p-on':undefined} onClick={()=>pick(item.id)}>{(()=>{const Icon=KIND_ICONS[item.kind]||Store;return <Icon aria-hidden="true"/>;})()}{item.name}</button>)}
      {legacy&&<button type="button" role="tab" aria-selected={selected==='legacy'} className={selected==='legacy'?'p-on':undefined} onClick={()=>pick('legacy')}>Sin canal asignado</button>}
      {canManage&&<button type="button" role="tab" aria-selected={selected==='new'} className={selected==='new'?'p-on':undefined} onClick={()=>pick('new')}>＋ Nuevo canal</button>}
    </div>}

    {(selected==='new'||store)&&canManage&&<form className="p-card p-reveal" onSubmit={submit} style={{marginBottom:16}}>
      <div className="p-cardHead"><div><span className="p-eyebrowS">{selected==='new'?'NUEVO CANAL':`${CHANNEL_KIND_LABELS[store?.kind||'otro'].toUpperCase()} · COSTOS`}</span><h3>{selected==='new'?'¿Por dónde más vendés?':store?.name}</h3>{store&&!store.costPercent&&<span className="p-sub p-warnLine">Sin costo de mercadería, sus ventas se muestran aparte y no entran en la ganancia (salvo los días que traigan su costo en el archivo).</span>}</div>
        {store&&<button type="button" className="p-iconBtn" aria-label={`Borrar ${store.name}`} onClick={()=>void remove()}><Trash2 aria-hidden="true"/></button>}</div>
      <StoreFields draft={draft} setDraft={setDraft} disabled={saving}/>
      {selected==='new'&&legacy&&<label className="p-check" style={{marginTop:12}}><input type="checkbox" checked={adopt} onChange={event=>setAdopt(event.target.checked)}/><span><b>Pasar a este canal la facturación externa que ya cargaste</b> ({legacy.days} {legacy.days===1?'día':'días'})</span></label>}
      <div style={{display:'flex',alignItems:'center',gap:12,marginTop:14}}><button type="submit" className="p-btn p-primary" disabled={saving}>{saving?'Guardando…':selected==='new'?'Crear canal':'Guardar cambios'}</button>{message&&<span className="p-sub" role="status">{message}</span>}</div>
    </form>}
    {store&&!canManage&&<div className="p-note" style={{marginBottom:16}}>{store.name}: costo de mercadería {store.costPercent}% · comisiones {store.feePercent}% · impuestos {store.taxPercent}%. Los cambia el propietario o un administrador.</div>}

    {store&&<>
      <div className="p-tabs" role="group" aria-label="Cómo cargar las ventas" style={{marginBottom:16,width:'fit-content'}}>
        <button type="button" className={mode==='import'?'p-on':undefined} onClick={()=>setMode('import')}>Subir Excel o CSV</button>
        <button type="button" className={mode==='manual'?'p-on':undefined} onClick={()=>setMode('manual')}>Cargar a mano por día</button>
      </div>
      {mode==='import'?<StoreImport key={store.id} storeId={store.id} storeName={store.name} canManage={canManage} money={money} onImported={refresh}/>
        :<ExternalRevenue key={store.id} storeId={store.id} embedded money={money} canManage={canManage} onChanged={refresh}/>}
    </>}

    {selected==='legacy'&&legacy&&<>
      <div className="p-notice" style={{marginBottom:16}}><div><b>Facturación externa sin canal</b><p>Son {legacy.days} días que cargaste antes de que existieran los canales. Se suman a la facturación total, pero sin costos no entran en la ganancia.</p></div>
        {canManage&&stores&&stores.filter(item=>!daysOf(item.id)).map(item=><button key={item.id} type="button" className="p-btn p-small" onClick={()=>void adoptInto(item.id)}>Pasar a {item.name}</button>)}</div>
      {message&&<p className="p-sub" role="status">{message}</p>}
      <ExternalRevenue key="legacy" storeId={null} embedded money={money} canManage={canManage} onChanged={refresh}/>
    </>}
  </>;
}
