'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { Check, Mail, MessageCircle, Phone, Undo2 } from 'lucide-react';
import { recoveryMessage, whatsappLink, type cartSummary, type CartContact } from '../../lib/abandoned-carts';
import RpChart from './rp-chart';

type RecentCart=ReturnType<typeof cartSummary>['recent'][number]&{contact:CartContact|null};
type Summary=Omit<ReturnType<typeof cartSummary>,'recent'>&{recent:RecentCart[];syncedAt:string|null;canSeeContacts:boolean;storeName:string};
type Via='whatsapp'|'email'|'telefono'|'otro';
const VIA_LABELS:Record<Via,string>={whatsapp:'WhatsApp',email:'email',telefono:'teléfono',otro:'otro medio'};
const dateTime=(value:string)=>new Intl.DateTimeFormat('es-AR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'America/Argentina/Buenos_Aires'}).format(new Date(value));
const dayLabel=(value:string)=>new Intl.DateTimeFormat('es-AR',{day:'2-digit',month:'short',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`));
function ago(value:string) {
  const minutes=Math.max(0,Math.round((Date.now()-Date.parse(value))/60000));
  if(minutes<60)return minutes<=1?'recién':`hace ${minutes} min`;
  const hours=Math.round(minutes/60);
  if(hours<24)return `hace ${hours} h`;
  const days=Math.round(hours/24);
  return `hace ${days} ${days===1?'día':'días'}`;
}

// Carritos abandonados: cuánta plata quedó en la mesa, qué productos se abandonan y a quién
// escribirle. Al tocar WhatsApp o email el carrito queda marcado como contactado para todo el
// equipo, así nadie le escribe dos veces al mismo comprador.
export default function AbandonedCarts({query,period,money,tiendanubeConnected,onConnect}:{query:string;period:string;money:(value:number)=>string;tiendanubeConnected:boolean;onConnect:()=>void}) {
  const [data,setData]=useState<Summary|null>(null);
  const [error,setError]=useState(false);
  const [tab,setTab]=useState<'pending'|'contacted'>('pending');
  const [notice,setNotice]=useState('');
  useEffect(()=>{
    let cancelled=false;
    void Promise.resolve().then(()=>{if(!cancelled){setData(null);setError(false);}});
    fetch(`/api/insights/carts?${query}`,{cache:'no-store'}).then(async response=>{
      if(!response.ok)throw new Error();
      const result=await response.json() as Summary;
      if(!cancelled)setData(result);
    }).catch(()=>{if(!cancelled)setError(true);});
    return ()=>{cancelled=true;};
  },[query]);

  // La marca se ve al instante; si el servidor no la guarda, se vuelve atrás y se avisa.
  async function mark(cart:RecentCart,via:Via|null) {
    const previous=data;
    setNotice('');
    setData(current=>current&&{...current,recent:current.recent.map(item=>item.externalId===cart.externalId?{...item,contactedAt:via?new Date().toISOString():null,contactedBy:via?'Vos':null,contactedVia:via}:item)});
    const response=await fetch('/api/insights/carts/contacted',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({externalId:cart.externalId,via})}).catch(()=>null);
    if(!response?.ok){setData(previous);setNotice('No pudimos guardar la marca de contactado. Intentá de nuevo.');}
  }

  const pending=data?.recent.filter(cart=>!cart.contactedAt)||[];
  const contacted=data?.recent.filter(cart=>cart.contactedAt)||[];
  const list=tab==='pending'?pending:contacted;

  return <>
    <div className="p-head"><div><div className="p-eyebrow">VENTAS QUE NO SE CERRARON · {period}</div><h1>Carritos abandonados</h1><p>Compras que llegaron hasta el checkout, con los datos de contacto cargados, y no se pagaron. Tiendanube los guarda 30 días; Rentia te arma el historial completo.</p></div></div>
    {!tiendanubeConnected?<div className="p-card p-soon"><div><h2>Conectá Tiendanube</h2><p className="p-sub">Los carritos abandonados vienen de tu tienda en Tiendanube.</p><button type="button" className="p-btn p-primary" onClick={onConnect}>Ir a integraciones</button></div></div>
    :error?<div className="p-notice p-warning" role="alert"><div><b>No pudimos cargar los carritos</b><p>Recargá la página para intentar de nuevo.</p></div></div>
    :!data?<div className="p-empty">Buscando carritos…</div>
    :!data.syncedAt?<div className="p-empty">Estamos trayendo tus carritos de los últimos 30 días. Aparecen después de la próxima sincronización con Tiendanube.</div>
    :<>
      <div className="p-grid p-g4" style={{marginBottom:16}}>
        <div className="p-card p-kpi p-reveal p-tone-r"><small>Plata en carritos abandonados</small><b className="p-mono">{money(data.value)}</b><span className="p-sub">{data.count.toLocaleString('es-AR')} {data.count===1?'carrito':'carritos'}</span></div>
        <div className="p-card p-kpi p-reveal" style={{'--i':1} as CSSProperties}><small>Tasa de abandono</small><b className="p-mono">{data.count?`${Math.round(data.rate*100)}%`:'—'}</b><span className="p-sub">De cada 100 compras que llegaron al checkout</span></div>
        <div className="p-card p-kpi p-reveal" style={{'--i':2} as CSSProperties}><small>Falta contactar</small><b className="p-mono">{data.pendingContact.toLocaleString('es-AR')}</b><span className="p-sub">{data.contacted?`${data.contacted} ya contactados`:'Ninguno contactado todavía'}</span></div>
        <div className={`p-card p-kpi p-reveal ${data.recoveredAfterContact?'p-tone-g':''}`} style={{'--i':3} as CSSProperties}><small>Recuperados después del mensaje</small><b className="p-mono">{data.recoveredAfterContact.toLocaleString('es-AR')}</b><span className="p-sub">{data.recoveredAfterContact?`${money(data.recoveredValue)} en ventas`:'Carritos que se pagaron después de escribirles'}</span></div>
      </div>
      {data.daily.length>1&&<div className="p-card p-reveal" style={{marginBottom:16}}><div className="p-cardHead"><div><span className="p-eyebrowS">POR DÍA</span><h3>Plata en carritos abandonados</h3></div></div>
        <RpChart data={data.daily.map(day=>({...day,label:dayLabel(day.date),detail:dayLabel(day.date),key:day.date}))} valueKey="value" type="bar" color="#ff6678" height={200} format={value=>money(value)} axisFormat={value=>money(value)} name="Abandonado"/>
      </div>}
      <div className="p-grid p-g2 p-cartGrid">
        <div className="p-card p-reveal"><div className="p-cardHead"><div><span className="p-eyebrowS">RECUPERÁ LAS VENTAS</span><h3>A quién escribirle</h3><span className="p-sub">{data.canSeeContacts?'Al tocar WhatsApp o email el carrito queda marcado como contactado para todo el equipo. Conviene escribir en las primeras 24 horas.':'Los datos de contacto los ven el propietario y los administradores.'}</span></div></div>
          <div className="p-tabs" role="tablist" aria-label="Carritos" style={{marginBottom:12,width:'fit-content'}}>
            <button type="button" role="tab" aria-selected={tab==='pending'} className={tab==='pending'?'p-on':undefined} onClick={()=>setTab('pending')}>Para contactar ({pending.length})</button>
            <button type="button" role="tab" aria-selected={tab==='contacted'} className={tab==='contacted'?'p-on':undefined} onClick={()=>setTab('contacted')}>Contactados ({contacted.length})</button>
          </div>
          {notice&&<p className="p-sub p-warnLine" role="alert">{notice}</p>}
          {list.length?<ul className="p-weekList p-cartList">{list.map(cart=>{
            const message=recoveryMessage(data.storeName,cart.contact?.name||null,cart.contact?.recoveryUrl||null);
            const whatsapp=whatsappLink(cart.contact?.phone||null,message);
            return <li key={cart.externalId}><span style={{whiteSpace:'normal',minWidth:0}}>
              {cart.contact?.name&&<><b>{cart.contact.name}</b><br/></>}
              {cart.items.slice(0,2).map(item=>item.name).join(', ')}{cart.items.length>2?` y ${cart.items.length-2} más`:''}<br/>
              <small className="p-sub">{dateTime(cart.createdAt)} · {cart.units} {cart.units===1?'unidad':'unidades'}</small>
              {cart.contactedAt&&<><br/><span className="p-chip p-g"><Check className="p-i" aria-hidden="true"/>Contactado por {cart.contactedBy} vía {VIA_LABELS[(cart.contactedVia||'otro') as Via]} · {ago(cart.contactedAt)}</span></>}
              {data.canSeeContacts&&<span className="p-cartActions">
                {whatsapp&&<a className="p-btn p-small" href={whatsapp} target="_blank" rel="noopener noreferrer" onClick={()=>void mark(cart,'whatsapp')}><MessageCircle className="p-i" aria-hidden="true"/>WhatsApp</a>}
                {cart.contact?.email&&<a className="p-btn p-small" href={`mailto:${cart.contact.email}?subject=${encodeURIComponent(`Tu carrito en ${data.storeName}`)}&body=${encodeURIComponent(message)}`} onClick={()=>void mark(cart,'email')}><Mail className="p-i" aria-hidden="true"/>Email</a>}
                {!cart.contactedAt&&<button type="button" className="p-btn p-small" onClick={()=>void mark(cart,cart.contact?.phone?'telefono':'otro')}><Phone className="p-i" aria-hidden="true"/>Ya lo contacté</button>}
                {cart.contactedAt&&<button type="button" className="p-btn p-small" onClick={()=>void mark(cart,null)}><Undo2 className="p-i" aria-hidden="true"/>Desmarcar</button>}
              </span>}
            </span><b className="p-mono">{money(cart.total)}</b></li>;
          })}</ul>
          :<div className="p-empty">{tab==='pending'?'No queda nadie por contactar en este período.':'Todavía no contactaste a nadie en este período.'}</div>}
        </div>
        <div className="p-card p-reveal"><div className="p-cardHead"><div><span className="p-eyebrowS">QUÉ SE ABANDONA</span><h3>Productos en más carritos</h3><span className="p-sub">Si un producto aparece mucho, revisá su precio, su envío o sus fotos.</span></div></div>
          {data.topProducts.length?<div className="p-tableWrap"><table><thead><tr><th>Producto</th><th className="p-r">Carritos</th><th className="p-r">Unidades</th><th className="p-r">Importe</th></tr></thead>
            <tbody>{data.topProducts.map(product=><tr key={product.name}><td>{product.name}</td><td className="p-r p-mono">{product.carts}</td><td className="p-r p-mono">{product.units}</td><td className="p-r p-mono">{money(product.value)}</td></tr>)}</tbody></table></div>
          :<div className="p-empty">No hay carritos abandonados en este período.</div>}
        </div>
      </div>
      <p className="p-sub" style={{marginTop:14}}>El contacto del comprador se guarda cifrado, lo ven solo el propietario y los administradores, y se borra a los 90 días. El resumen del carrito (fecha, importe y productos) queda en tu historial.</p>
    </>}
  </>;
}
