'use client';

import { OrderItemCost, MeliOrderReview, RefundAdjustmentEditor } from '../../../components/order-review';
import { salesChannelLabel, orderReturnNeedsReview } from '../../../lib/sales-channels';
import { FormEvent, useContext, useEffect, useRef, useState } from 'react';
import { Receipt, RefreshCw, Search, Download, X } from 'lucide-react';
import OrderPagination, { orderPageWindow } from '../../../components/order-pagination';
import { OrderRow, Dashboard, CustomDateRange, AccessContext, useMoney, analyticsQuery, date, parseCost, sourceLabel, EmptyData } from '../shared';

export function OrdersSection({orders:recentOrders,days,range,refreshKey,period,syncing,onSync,onRefresh,expandedOrder,setExpandedOrder}:{orders:OrderRow[];days:number;range:CustomDateRange|null;refreshKey:Dashboard|null;period:string;syncing:boolean;onSync:()=>void;onRefresh:()=>Promise<unknown>;expandedOrder:string|null;setExpandedOrder:(value:string|null)=>void}) {
  const canManage=useContext(AccessContext);
  const money=useMoney();
  const [query,setQuery]=useState('');
  const [page,setPage]=useState(1);
  const [orders,setOrders]=useState<OrderRow[]>([]);
  const scrolledToReview=useRef(false);
  useEffect(()=>{const params=new URLSearchParams(window.location.search),id=params.get('order'),provider=params.get('provider');if(id)queueMicrotask(()=>{setQuery(id);if(provider==='tiendanube'||provider==='mercadolibre')setExpandedOrder(`${provider}:${id}`);});},[setExpandedOrder]);
  const [total,setTotal]=useState(0);
  const [loading,setLoading]=useState(true);
  const [updating,setUpdating]=useState(false);
  const [loadError,setLoadError]=useState('');
  const [reload,setReload]=useState(0);
  const loadedRef=useRef(false);
  const requestKeyRef=useRef('');
  useEffect(()=>{
    if(loading||scrolledToReview.current||!window.location.hash.startsWith('#meli-review-'))return;
    const target=document.getElementById(window.location.hash.slice(1));
    if(!target)return;
    const frame=requestAnimationFrame(()=>{target.scrollIntoView({block:'start'});scrolledToReview.current=true;});
    return()=>cancelAnimationFrame(frame);
  },[loading,orders,expandedOrder]);
  // La actualización automática del panel (cada 30 s) recarga la lista en silencio: las
  // órdenes visibles no se borran. Buscar o cambiar de página atenúa la tabla mientras carga.
  useEffect(()=>{
    const requestKey=JSON.stringify([query,page,period,days,range,reload]);
    const background=loadedRef.current&&requestKeyRef.current===requestKey;
    requestKeyRef.current=requestKey;
    if(!background){setLoadError('');if(loadedRef.current)setUpdating(true);else setLoading(true);}
    const controller=new AbortController();
    const timer=window.setTimeout(async()=>{
      try {
        const params=new URLSearchParams(analyticsQuery(days,range));params.set('page',String(page));params.set('q',query);
        const response=await fetch(`/api/orders?${params}`,{signal:controller.signal});
        if(!response.ok)throw new Error('orders_unavailable');
        const data=await response.json() as {orders:OrderRow[];pagination:{total:number;page:number}};
        if(!controller.signal.aborted){loadedRef.current=true;setLoadError('');setOrders(data.orders);setTotal(data.pagination.total);if(data.pagination.page!==page)setPage(data.pagination.page);}
      }catch{if(!controller.signal.aborted&&!background)setLoadError('No pudimos cargar las órdenes. No se muestran resultados parciales.');}
      finally{if(!controller.signal.aborted){setLoading(false);setUpdating(false);}}
    },background?0:250);
    return()=>{controller.abort();window.clearTimeout(timer);};
  },[query,page,period,days,range,refreshKey,reload]);
  const refreshOrders=async()=>{setReload(value=>value+1);await onRefresh();};
  useEffect(()=>{
    if(!expandedOrder)return;
    const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setExpandedOrder(null);};
    window.addEventListener('keydown',close);
    return()=>window.removeEventListener('keydown',close);
  },[expandedOrder,setExpandedOrder]);
  const tableStart=useRef<HTMLDivElement>(null);
  // Al cambiar la búsqueda o el período se vuelve a la primera página (ajuste durante el render).
  const [pageFilter,setPageFilter]=useState(`${query}|${period}`);
  if(pageFilter!==`${query}|${period}`){setPageFilter(`${query}|${period}`);setPage(1);}
  const [checkingOrder,setCheckingOrder]=useState<string|null>(null);
  const [commissionCheck,setCommissionCheck]=useState<{orderId:string;message:string}|null>(null);
  async function checkCommission(order:OrderRow) {
    if(!canManage||order.provider!=='tiendanube')return;
    setCheckingOrder(`${order.provider}:${order.external_order_id}`);
    setCommissionCheck(null);
    try {
      const response=await fetch('/api/integrations/tiendanube/commission-diagnostic',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({orderId:order.external_order_id})});
      const result=await response.json() as {outcome?:string;httpStatus?:number;source?:'order_aggregate'|'transactions_endpoint';commission?:number;transactionCount?:number;paidTransactions?:number;chargeTypes?:string[]};
      let message='No pudimos comprobar el costo de esta orden. Intentá nuevamente.';
      if (response.ok) {
        if (result.outcome==='imported') { message=`Tiendanube informó un costo de procesamiento de ${money(result.commission||0,order.currency)}. Rentia ya lo descontó de la ganancia.`; await refreshOrders(); }
        else if (result.outcome==='upstream_error'&&result.httpStatus===403) message='Tiendanube rechazó temporalmente la consulta de cargos de esta orden (403). Rentia volverá a intentarlo automáticamente.';
        else if (result.outcome==='upstream_error'&&result.httpStatus===404) message='Tiendanube no encontró esta orden o todavía no publicó sus transacciones (404). Rentia volverá a comprobarla.';
        else if (result.outcome==='upstream_error') message=`Tiendanube respondió ${result.httpStatus||'con un error'} al consultar la orden con sus transacciones. El cargo no se importó todavía.`;
        else if (result.outcome==='no_charge') message=`Tiendanube respondió correctamente, pero no incluyó un cargo del comercio (${result.transactionCount||0} transacciones, ${result.paidTransactions||0} pagadas${result.chargeTypes?.length?`; tipos: ${result.chargeTypes.join(', ')}`:''}).`;
        else if (result.outcome==='invalid_response') message='Tiendanube respondió, pero no envió una lista válida de transacciones.';
        else if (result.outcome==='network_error') message='No se pudo completar la consulta. Probá nuevamente en unos minutos.';
        else if (result.outcome==='not_paid') message='La orden todavía no figura como pagada o fue cancelada.';
        else if (result.outcome==='not_connected') message='Primero conectá Tiendanube en Integraciones.';
        else if (result.outcome==='order_not_found') message='Esta orden no pertenece a la tienda conectada.';
      }
      setCommissionCheck({orderId:`${order.provider}:${order.external_order_id}`,message});
    } catch { setCommissionCheck({orderId:`${order.provider}:${order.external_order_id}`,message:'No pudimos completar la comprobación. Intentá nuevamente.'}); }
    finally { setCheckingOrder(null); }
  }
  const {current}=orderPageWindow(total,page);
  const visibleOrders=orders;
  function changePage(next:number,fromBottom=false) {
    setPage(next);setExpandedOrder(null);
    if(fromBottom)tableStart.current?.scrollIntoView({block:'start'});
  }
  const exportOrders=()=>{const params=new URLSearchParams(analyticsQuery(days,range));params.set('q',query);window.location.href=`/api/orders/export?${params}`;};
  const orderKey=(order:OrderRow)=>`${order.provider}:${order.external_order_id}`;
  const openOrder=expandedOrder?visibleOrders.find(order=>orderKey(order)===expandedOrder)||null:null;
  const orderState=(order:OrderRow)=>{
    const productsMissing=order.items.some(item=>item.cost_source==='sin_costo');
    const commissionMissing=order.commission_source==='Sin costo de pago informado'||order.commission_source==='Mercado Libre · cargo pendiente';
    const claimOpen=order.post_sale?.claims.some(claim=>claim.status==='opened')||false;
    const estimated=order.commission_source.startsWith('Pago Nube · calculada');
    return productsMissing?['Falta costo','p-a']:commissionMissing?['Falta comisión','p-a']:claimOpen?['Reclamo abierto','p-r']:orderReturnNeedsReview(order)?['Por conciliar','p-a']:estimated?['Estimada','p-b']:['Completa','p-g'];
  };
  const paymentTone=(order:OrderRow)=>orderReturnNeedsReview(order)||['refunded','charged_back'].includes(order.payment_status)?'p-r':order.payment_status==='paid'?'p-g':['pending','authorized','in_process'].includes(order.payment_status)?'p-a':'p-n';
  const costsOf=(order:OrderRow)=>order.product_cost+order.shipping_cost+order.commission_cost+order.tax_cost+order.additional_cost;
  return <>
    <div className="p-head"><div><div className="p-eyebrow">DATOS REALES</div><h1>Órdenes</h1><p>Buscá, exportá y abrí cualquier venta para ver exactamente cómo llega Rentia a la ganancia real.</p></div>{canManage&&<div className="p-actions"><button type="button" className={`p-btn ${syncing?'p-spin':''}`} onClick={onSync} disabled={syncing}><RefreshCw className="p-i" aria-hidden="true"/>{syncing?'Actualizando…':'Actualizar'}</button></div>}</div>
    {(total>0||query||recentOrders.length||loading||loadError)?<>
      <div className="p-toolbar"><label className="p-search"><Search className="p-i" aria-hidden="true"/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar por orden o medio de pago" aria-label="Buscar por orden o medio de pago"/></label><span className="p-sub">{total.toLocaleString('es-AR')} órdenes</span><button type="button" className="p-btn" style={{marginLeft:'auto'}} onClick={exportOrders} disabled={loading||Boolean(loadError)}><Download className="p-i" aria-hidden="true"/>Exportar CSV</button></div>
      <div ref={tableStart}><OrderPagination total={total} page={current} onChange={next=>changePage(next)} position="top"/></div>
      {loading?<div className="p-empty" role="status">Cargando órdenes…</div>:loadError?<div className="p-empty" role="alert">{loadError} <button type="button" className="p-btn p-small" onClick={()=>setReload(value=>value+1)}>Reintentar</button></div>:<div className={`p-tableWrap p-reveal ${updating?'p-updating':''}`} aria-busy={updating}><table>
        <thead><tr><th>Orden</th><th>Origen / fecha</th><th>Pago</th><th className="p-r">Venta</th><th className="p-r">Costos</th><th className="p-r">Ganancia</th><th>Datos</th></tr></thead>
        <tbody>{visibleOrders.map(order=>{const key=orderKey(order);const review=orderReturnNeedsReview(order);const [stateLabel,stateTone]=orderState(order);return <tr key={key} className={`p-click ${expandedOrder===key?'p-openRow':''}`} onClick={()=>setExpandedOrder(expandedOrder===key?null:key)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setExpandedOrder(expandedOrder===key?null:key);}}} tabIndex={0} aria-expanded={expandedOrder===key} aria-label={`Ver detalle de la orden ${order.order_number||order.external_order_id}`}>
          <td><b>#{order.order_number||order.external_order_id}</b>{order.items[0]&&<><br/><small className="p-sub">{order.items[0].name}{order.items.length>1?` +${order.items.length-1}`:''}</small></>}</td>
          <td><span className="p-chan"><img src={order.provider==='mercadolibre'?'/brands/mercado-libre-icon.png':'/brands/tiendanube-icon.png'} alt=""/><span>{salesChannelLabel(order.provider)}<br/><small className="p-sub">{date(order.source_created_at)}</small></span></span></td>
          <td><span className={`p-chip ${paymentTone(order)}`}>{review?'Reembolso':order.payment_status}</span>{order.payment_method&&<><br/><small className="p-sub">{order.payment_method}</small></>}</td>
          <td className="p-r p-mono">{money(order.total,order.currency)}</td>
          <td className="p-r p-mono">{review?(order.refund_loss==null?'Por conciliar':money(order.refund_loss,order.currency)):money(costsOf(order),order.currency)}</td>
          <td className={`p-r p-mono ${review&&order.refund_loss==null?'':order.profit<0?'p-neg':'p-pos'}`}>{review&&order.refund_loss==null?<span className="p-chip p-a">En revisión</span>:money(order.profit,order.currency)}</td>
          <td><span className={`p-chip ${stateTone}`}>{stateLabel}</span></td>
        </tr>;})}{!orders.length&&<tr><td colSpan={7} className="p-empty">No encontramos órdenes con esa búsqueda.</td></tr>}</tbody>
      </table></div>}
      <OrderPagination total={total} page={current} onChange={next=>changePage(next,true)} position="bottom"/>
    </>:<EmptyData syncing={syncing} onSync={onSync}/>}
    {openOrder&&(()=>{const review=orderReturnNeedsReview(openOrder);const [stateLabel]=orderState(openOrder);const provisional=stateLabel!=='Completa';return <>
      <button type="button" className="p-scrim p-open" onClick={()=>setExpandedOrder(null)} aria-label="Cerrar detalle"/>
      <aside className="p-drawer p-open" role="dialog" aria-modal="true" aria-label={`Detalle de la orden #${openOrder.order_number||openOrder.external_order_id}`}>
        <div className="p-drawerHead"><div><span className={`p-chip ${paymentTone(openOrder)}`}>{review?'Reembolso':openOrder.payment_status}</span><h3>Orden #{openOrder.order_number||openOrder.external_order_id}</h3><span className="p-sub">{new Intl.DateTimeFormat('es-AR',{dateStyle:'long'}).format(new Date(openOrder.source_created_at))} · {salesChannelLabel(openOrder.provider)}</span></div><button type="button" className="p-iconBtn" onClick={()=>setExpandedOrder(null)} aria-label="Cerrar detalle"><X className="p-i" aria-hidden="true"/></button></div>
        <div className="p-drawerBody">
          <div className="p-grid p-g3" style={{marginBottom:16}}><div className="p-card p-kpi"><small>{review?'Venta original':'Venta'}</small><b className="p-mono" style={{fontSize:18}}>{money(openOrder.total,openOrder.currency)}</b></div><div className="p-card p-kpi"><small>Costos</small><b className="p-mono" style={{fontSize:18}}>{review?(openOrder.refund_loss==null?'Por conciliar':money(openOrder.refund_loss,openOrder.currency)):money(costsOf(openOrder),openOrder.currency)}</b></div><div className="p-card p-kpi p-hero"><small>{review?'Resultado':provisional?'Ganancia provisoria':'Ganancia neta'}</small><b className="p-mono" style={{fontSize:18}}>{review&&openOrder.refund_loss==null?'En revisión':money(openOrder.profit,openOrder.currency)}</b></div></div>
          <OrderBreakdown order={openOrder} checking={checkingOrder===orderKey(openOrder)} checkMessage={commissionCheck?.orderId===orderKey(openOrder)?commissionCheck.message:null} onCheck={()=>void checkCommission(openOrder)} onRefresh={refreshOrders}/>
        </div>
      </aside>
    </>;})()}
  </>;
}

function OrderBreakdown({order,checking,checkMessage,onCheck,onRefresh}:{order:OrderRow;checking:boolean;checkMessage:string|null;onCheck:()=>void;onRefresh:()=>Promise<unknown>}) {
  const canManage=useContext(AccessContext);
  const money=useMoney();
  const [feeDraft,setFeeDraft]=useState(order.manual_commission_cost===null?'':String(order.manual_commission_cost));
  const [savingFee,setSavingFee]=useState(false);
  const [feeMessage,setFeeMessage]=useState('');
  async function saveFee(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(order.provider!=='tiendanube')return;
    const cost=parseCost(feeDraft);
    if (!feeDraft.trim()||!Number.isFinite(cost)||cost<0||cost>order.total) {setFeeMessage('Ingresá el costo exacto de procesamiento, sin superar el total de la venta.');return;}
    setSavingFee(true);setFeeMessage('Guardando…');
    try {
      const response=await fetch('/api/orders/commission',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({orderId:order.external_order_id,cost})});
      if (!response.ok) {setFeeMessage('No pudimos guardar este costo.');return;}
      await onRefresh();setFeeMessage('Costo exacto guardado. Se recalculó la ganancia.');
    } catch {setFeeMessage('No pudimos guardar este costo.');}
    finally {setSavingFee(false);}
  }
  const totalCosts=order.product_cost+order.shipping_cost+order.commission_cost+order.tax_cost+order.additional_cost;
  const returnReview=orderReturnNeedsReview(order);
  const claimOpen=order.post_sale?.claims.some(claim=>claim.status==='opened')||false;
  const productsMissing=order.items.some(item=>item.cost_source==='sin_costo');
  const commissionMissing=order.commission_source==='Sin costo de pago informado'||order.commission_source==='Mercado Libre · cargo pendiente';
  const commissionEstimated=order.commission_source.startsWith('Pago Nube · calculada');
  return <div className="p-orderDetail">
    <span className="p-eyebrowS">PRODUCTOS DE LA ORDEN</span>
    {order.items.map(item=><div className="p-orderLine" key={item.external_line_id}><div className="p-kv"><span><b style={{color:'var(--text)'}}>{item.quantity}× {item.name}</b><small>{item.sku||'Sin SKU'} · {item.external_variant_id||item.external_product_id||'Identificador no informado'} · costo {sourceLabel(item.cost_source).toLowerCase()}</small></span><b className="p-mono">{money(Number(item.unit_cost)*Number(item.quantity),order.currency)}</b></div>{canManage&&<OrderItemCost provider={order.provider} orderId={order.external_order_id} lineId={item.external_line_id} currency={order.currency} cost={Number(item.unit_cost)} manual={item.cost_source==='orden_manual'} onRefresh={onRefresh}/>}</div>)}
    {!order.items.length&&<p className="p-sub">No hay líneas de producto disponibles para esta orden.</p>}
    {order.provider==='mercadolibre'&&<MeliOrderReview orderId={order.external_order_id} currency={order.currency} postSale={order.post_sale} canManage={canManage} onRefresh={onRefresh}/>}
    {order.provider==='mercadolibre'&&['refunded','charged_back'].includes(order.payment_status)&&<RefundAdjustmentEditor key={`${order.external_order_id}:${order.refund_adjustment?.confirmedAt||''}`} orderId={order.external_order_id} currency={order.currency} value={order.refund_adjustment} loss={order.refund_loss} canManage={canManage} onRefresh={onRefresh}/>}
    <div className="p-kv"><span>Medio de pago</span><b>{order.payment_method||'No informado'}</b></div>
    <div className="p-kv"><span>Origen de comisión</span><b style={{fontWeight:500,fontSize:12.5,textAlign:'right'}}>{order.commission_source}</b></div>
    {order.provider==='mercadolibre'&&<a className="p-linkBtn" href={`/panel?section=cargos-meli&billing-order=${encodeURIComponent(order.external_order_id)}&billing-period=${encodeURIComponent(order.source_created_at.slice(0,7)+'-01')}`}><Receipt className="p-i" aria-hidden="true"/>Ver cargos oficiales relacionados con esta orden</a>}
    <h4 style={{margin:'18px 0 4px'}}><span className="p-eyebrowS">CUENTA REAL</span></h4>
    {returnReview&&<p className="p-warnLine" role="status">{order.refund_adjustment?'Reembolso total confirmado manualmente: el cliente conservó el producto. La pérdida descuenta el costo del producto y los cargos retenidos que confirmaste, sin volver a descontar la venta.':'Reembolso detectado. Esta orden no se cuenta como venta cobrada. Falta conciliar los cargos retenidos y el estado del producto; su resultado no es necesariamente cero.'}</p>}
    <div className="p-kv"><span>{returnReview?'Venta original':'Facturación'}</span><b className="p-mono">{money(order.total,order.currency)}</b></div>
    <div className="p-kv"><span>Productos</span><b className="p-mono">− {money(order.product_cost,order.currency)}</b></div>
    <div className="p-kv"><span>Envío<small>{order.refund_adjustment?'retenido · ajuste manual':order.shipping_source}</small></span><b className="p-mono">{returnReview?(order.refund_adjustment?`− ${money(order.refund_adjustment.shipping,order.currency)}`:'Por conciliar'):`− ${money(order.shipping_cost,order.currency)}`}</b></div>
    <div className="p-kv"><span>Comisiones</span><b className="p-mono">{returnReview?(order.refund_adjustment?`− ${money(order.refund_adjustment.fees,order.currency)}`:'Por conciliar'):commissionMissing?'Pendiente':`− ${money(order.commission_cost,order.currency)}`}</b></div>
    <div className="p-kv"><span>Impuestos{order.provider==='mercadolibre'&&<small>{order.refund_adjustment?'retenidos · ajuste manual':'configurados, no conciliados'}</small>}</span><b className="p-mono">{returnReview?(order.refund_adjustment?`− ${money(order.refund_adjustment.taxes,order.currency)}`:'Por conciliar'):`− ${money(order.tax_cost,order.currency)}`}</b></div>
    <div className="p-kv"><span>Gastos adicionales</span><b className="p-mono">{returnReview?(order.refund_adjustment?`− ${money(order.refund_adjustment.extra,order.currency)}`:'Por conciliar'):`− ${money(order.additional_cost,order.currency)}`}</b></div>
    <div className="p-kv" style={{border:0,paddingTop:14}}><b>{returnReview?'Resultado de la devolución':commissionMissing||commissionEstimated||productsMissing||claimOpen?'Ganancia provisoria':'Ganancia neta'} {!returnReview&&<small className="p-sub">{order.margin.toFixed(1).replace('.',',')}% margen</small>}</b><b className={`p-mono ${returnReview&&order.refund_loss==null?'':order.profit<0?'p-neg':'p-pos'}`} style={{fontSize:18}}>{returnReview&&order.refund_loss==null?'En revisión':money(order.profit,order.currency)}</b></div>
    {claimOpen&&!returnReview&&<p className="p-warnLine">Hay un reclamo abierto. El pago todavía no confirma un reembolso y esta ganancia no se considera confirmada.</p>}
    {productsMissing&&!returnReview&&<p className="p-warnLine">Hay productos sin costo configurado. La ganancia es provisoria y todavía no descuenta esos costos.</p>}
    {order.provider==='mercadolibre'&&<p className="p-warnLine p-soft">Este resultado usa los costos de la orden y los impuestos configurados. Los cargos mensuales, percepciones, retenciones y bonificaciones del reporte oficial aún requieren conciliación; no se descuentan dos veces. El período de facturación puede ser distinto al mes de la venta.</p>}
    {commissionMissing&&<p className="p-warnLine">{order.commission_missing_reason||'Falta el costo de procesamiento del pago.'} Esta ganancia todavía no lo descuenta.</p>}
    {commissionEstimated&&<p className="p-warnLine p-soft">Comisión calculada automáticamente con la tarifa pública de Pago Nube; el proveedor no informó el cargo exacto de esta orden.</p>}
    {order.provider==='tiendanube'&&order.payment_status==='paid'&&<div className="p-subcard"><button className="p-btn p-small" type="button" onClick={onCheck} disabled={checking}><RefreshCw className="p-i" aria-hidden="true"/>{checking?'Consultando Tiendanube…':'Comprobar costo de pago'}</button>{checkMessage&&<p className="p-warnLine p-soft" role="status">{checkMessage}</p>}
      {order.source_commission_cost===null&&commissionMissing&&<form className="p-field" style={{marginTop:12}} onSubmit={saveFee}><span className="p-fieldLabel">Costo exacto, si Tiendanube no lo entrega por API</span><div className="p-actions"><span className="p-input" style={{flex:1}}><span>$</span><input value={feeDraft} onChange={event=>setFeeDraft(event.target.value)} inputMode="decimal" placeholder="Ej.: 4276,14" aria-label="Costo exacto de procesamiento"/></span><button className="p-btn p-small p-primary" type="submit" disabled={savingFee}>{savingFee?'Guardando…':'Guardar costo'}</button></div>{feeMessage&&<small className="p-sub" role="status">{feeMessage}</small>}</form>}
    </div>}
    <small className="p-sub" style={{display:'block',marginTop:10}}>{returnReview?(order.refund_loss==null?'Costos retenidos pendientes de conciliación':`Pérdida confirmada manualmente: ${money(order.refund_loss,order.currency)}`):`Costos totales: ${money(totalCosts,order.currency)}`}</small>
  </div>;
}

