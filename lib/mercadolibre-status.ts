// Browser-safe status only: no tokens, raw progress, seller resources or lease IDs.
export type MeliView={available:boolean;missingConfig?:string[];connection:{status:string;sellerId:string}|null;phase:'orders'|'products'|'done'|null;pending:boolean;retryAt:number;leaseExpiresAt?:number;batchUpdatedAt?:string|null;orders:number;products:number;pendingEvents:number;status:{last_completed_at:string|null;last_error:string|null;webhook_status:string}|null};

const reviewErrors=['mercadolibre_invalid_progress','mercadolibre_dense_window','mercadolibre_resource_owner','mercadolibre_order_owner','mercadolibre_shipment_owner'];
export function meliAutoSyncDue(view:MeliView|null,canManage:boolean,now=Date.now()) {
  return !!(canManage&&view?.available&&view.connection&&view.connection.status!=='reauthorization_required'&&!reviewErrors.includes(view.status?.last_error||'')&&view.retryAt<=now&&(view.leaseExpiresAt||0)<=now&&(view.pending||!view.status?.last_completed_at||now-Date.parse(view.status.last_completed_at)>20*60*1000));
}
export function meliSyncAction(view:MeliView|null,running:boolean,canManage:boolean,now=Date.now()) {
  const review=reviewErrors.includes(view?.status?.last_error||'');
  const paused=!!view&&view.retryAt>now;
  const activeLease=(view?.leaseExpiresAt||0)>now;
  const importing=!!view?.pending;
  // Logical import state, not the brief gap between individual HTTP batches.
  const label=review?'Revisión necesaria':paused?'Reintento automático':importing?'Importando…':running||activeLease?'Actualizando…':'Actualizar ahora';
  const badge=review?'Requiere revisión':paused?'En pausa':view?.connection?.status==='connected'?'Conectada':'Importando';
  return {label,badge,disabled:!canManage||!view?.available||review||paused||importing||running||activeLease,busy:!review&&!paused&&(importing||running||activeLease)};
}
export function meliSyncMessage(view:MeliView|null,now=Date.now()) {
  if(!view?.available)return view?.missingConfig?.length?`Falta configurar en el hosting: ${view.missingConfig.join(', ')}.`:'Estamos preparando la conexión segura con Mercado Libre.';
  if(view.connection?.status==='reauthorization_required')return 'Volvé a autorizar la cuenta para continuar. Conservamos el historial importado.';
  if(!view.connection)return 'Conexión de consulta · compatible con Tiendanube';
  if(view.status?.last_error==='mercadolibre_permission_missing')return 'Falta un permiso de Mercado Libre. Revisá los accesos de la aplicación.';
  if(view.status?.last_error==='mercadolibre_dense_window')return 'Este período requiere una revisión adicional. No omitimos las ventas que faltan.';
  if(view.status?.last_error==='mercadolibre_invalid_progress')return 'No pudimos retomar el historial. Contactá al soporte; conservamos los datos importados.';
  if(['mercadolibre_resource_owner','mercadolibre_order_owner','mercadolibre_shipment_owner'].includes(view.status?.last_error||''))return 'No pudimos verificar la pertenencia de una operación. Conservamos el avance; si se repite, contactá al soporte.';
  if(view.retryAt>now)return 'Mercado Libre no respondió o pidió una pausa. Retomaremos desde el último avance.';
  const orders=`${view.orders.toLocaleString('es-AR')} ${view.orders===1?'orden guardada':'órdenes guardadas'}`;
  if((view.leaseExpiresAt||0)>now&&view.batchUpdatedAt&&now-Date.parse(view.batchUpdatedAt)>60_000)return `Esperando que se libere el lote anterior · ${orders}. Retomaremos automáticamente.`;
  if(view.phase==='orders'||!view.phase)return `Importando ventas · ${orders}. Continuamos automáticamente por lotes.`;
  if(view.phase==='products')return `Importando publicaciones · ${view.products.toLocaleString('es-AR')} ${view.products===1?'producto guardado':'productos guardados'}. Continuamos automáticamente por lotes.`;
  return `${view.orders.toLocaleString('es-AR')} ${view.orders===1?'orden':'órdenes'} · ${view.products.toLocaleString('es-AR')} ${view.products===1?'publicación':'publicaciones'} · ${view.status?.webhook_status==='active'?'avisos recibidos':'esperando el primer aviso de Mercado Libre'}`;
}
