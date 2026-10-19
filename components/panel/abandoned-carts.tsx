'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { Mail, MessageCircle } from 'lucide-react';
import { recoveryMessage, whatsappLink, type cartSummary, type CartContact } from '../../lib/abandoned-carts';
import RpChart from './rp-chart';

type Summary=Omit<ReturnType<typeof cartSummary>,'recent'>&{recent:Array<ReturnType<typeof cartSummary>['recent'][number]&{contact:CartContact|null}>;syncedAt:string|null;canSeeContacts:boolean;storeName:string};
const dateTime=(value:string)=>new Intl.DateTimeFormat('es-AR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'America/Argentina/Buenos_Aires'}).format(new Date(value));
const dayLabel=(value:string)=>new Intl.DateTimeFormat('es-AR',{day:'2-digit',month:'short',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`));

// Carritos abandonados: cuánta plata quedó en la mesa y qué productos se abandonan más.
// Historial propio: Tiendanube los muestra solo 30 días.
export default function AbandonedCarts({query,period,money,tiendanubeConnected,onConnect}:{query:string;period:string;money:(value:number)=>string;tiendanubeConnected:boolean;onConnect:()=>void}) {
  const [data,setData]=useState<Summary|null>(null);
  const [error,setError]=useState(false);
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
        <div className="p-card p-kpi p-reveal" style={{'--i':2} as CSSProperties}><small>Carrito promedio</small><b className="p-mono">{data.count?money(data.average):'—'}</b><span className="p-sub">Importe de cada carrito abandonado</span></div>
        <div className="p-card p-kpi p-reveal" style={{'--i':3} as CSSProperties}><small>Se terminaron comprando</small><b className="p-mono">{data.recovered.toLocaleString('es-AR')}</b><span className="p-sub">Carritos que después se pagaron</span></div>
      </div>
      {data.daily.length>1&&<div className="p-card p-reveal" style={{marginBottom:16}}><div className="p-cardHead"><div><span className="p-eyebrowS">POR DÍA</span><h3>Plata en carritos abandonados</h3></div></div>
        <RpChart data={data.daily.map(day=>({...day,label:dayLabel(day.date),detail:dayLabel(day.date),key:day.date}))} valueKey="value" type="bar" color="#ff6678" height={200} format={value=>money(value)} axisFormat={value=>money(value)} name="Abandonado"/>
      </div>}
      <div className="p-grid p-g2">
        <div className="p-card p-reveal"><div className="p-cardHead"><div><span className="p-eyebrowS">QUÉ SE ABANDONA</span><h3>Productos en más carritos</h3><span className="p-sub">Si un producto aparece mucho, revisá su precio, su envío o sus fotos.</span></div></div>
          {data.topProducts.length?<div className="p-tableWrap"><table><thead><tr><th>Producto</th><th className="p-r">Carritos</th><th className="p-r">Unidades</th><th className="p-r">Importe</th></tr></thead>
            <tbody>{data.topProducts.map(product=><tr key={product.name}><td>{product.name}</td><td className="p-r p-mono">{product.carts}</td><td className="p-r p-mono">{product.units}</td><td className="p-r p-mono">{money(product.value)}</td></tr>)}</tbody></table></div>
          :<div className="p-empty">No hay carritos abandonados en este período.</div>}
        </div>
        <div className="p-card p-reveal"><div className="p-cardHead"><div><span className="p-eyebrowS">LOS ÚLTIMOS</span><h3>Recuperá las ventas</h3><span className="p-sub">{data.canSeeContacts?'Escribile al comprador con un mensaje listo y el link para terminar la compra. Conviene hacerlo en las primeras 24 horas.':'Los datos de contacto los ven el propietario y los administradores.'}</span></div></div>
          {data.recent.length?<ul className="p-weekList p-cartList">{data.recent.map(cart=>{
            const message=recoveryMessage(data.storeName,cart.contact?.name||null,cart.contact?.recoveryUrl||null);
            const whatsapp=whatsappLink(cart.contact?.phone||null,message);
            return <li key={cart.externalId}><span style={{whiteSpace:'normal'}}>{cart.contact?.name&&<><b>{cart.contact.name}</b><br/></>}{cart.items.slice(0,2).map(item=>item.name).join(', ')}{cart.items.length>2?` y ${cart.items.length-2} más`:''}<br/><small className="p-sub">{dateTime(cart.createdAt)} · {cart.units} {cart.units===1?'unidad':'unidades'}</small>
              {cart.contact&&(whatsapp||cart.contact.email)&&<span className="p-cartActions">{whatsapp&&<a className="p-btn p-small" href={whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle className="p-i" aria-hidden="true"/>WhatsApp</a>}{cart.contact.email&&<a className="p-btn p-small" href={`mailto:${cart.contact.email}?subject=${encodeURIComponent(`Tu carrito en ${data.storeName}`)}&body=${encodeURIComponent(message)}`}><Mail className="p-i" aria-hidden="true"/>Email</a>}</span>}</span><b className="p-mono">{money(cart.total)}</b></li>;
          })}</ul>
          :<div className="p-empty">No hay carritos abandonados en este período.</div>}
        </div>
      </div>
      <p className="p-sub" style={{marginTop:14}}>El contacto del comprador se guarda cifrado, lo ven solo el propietario y los administradores, y se borra a los 90 días. El resumen del carrito (fecha, importe y productos) queda en tu historial.</p>
    </>}
  </>;
}
