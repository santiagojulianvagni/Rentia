import {database} from './client';
import type {MercadoLibreNotice} from '../lib/mercadolibre';
import type {MeliOrder} from '../lib/mercadolibre-data';
import type {SyncedProduct} from './database';
import {ITEM_COST_JOINS,ITEM_COST_MISSING_SQL} from '../lib/commerce-queries';


// Single-use consumption is one statement, including expiry and tenant checks.
export async function consumeMercadoLibreState(state:string,userId:string) {
  return database().prepare("DELETE FROM oauth_states WHERE state=? AND provider='mercadolibre' AND user_id=? AND expires_at>? RETURNING user_id")
    .bind(state,userId,new Date().toISOString()).first<{user_id:string}>();
}

export async function saveMercadoLibreConnection(input:{userId:string;sellerId:string;encryptedToken:string;iv:string;scopes:string}) {
  const now=new Date().toISOString();
  // A seller cannot silently move between tenants, and reconnecting a different
  // seller cannot mix that seller's history into an existing Rentia store.
  const saved=await database().prepare("INSERT INTO integrations (user_id,provider,external_store_id,encrypted_access_token,token_iv,scopes,status,connected_at,updated_at) SELECT ?,'mercadolibre',?,?,?,?, 'authorized',?,? WHERE NOT EXISTS (SELECT 1 FROM integrations WHERE provider='mercadolibre' AND status<>'disconnected' AND ((external_store_id=? AND user_id<>?) OR (user_id=? AND external_store_id<>?))) ON CONFLICT(user_id,provider,external_store_id) DO UPDATE SET encrypted_access_token=excluded.encrypted_access_token,token_iv=excluded.token_iv,scopes=excluded.scopes,status=CASE WHEN integrations.status='connected' THEN 'connected' ELSE 'authorized' END,updated_at=excluded.updated_at")
    .bind(input.userId,input.sellerId,input.encryptedToken,input.iv,input.scopes,now,now,input.sellerId,input.userId,input.userId,input.sellerId).run();
  return Number(saved.meta.changes||0)>0;
}

export async function enqueueMercadoLibreNotice(notice:MercadoLibreNotice) {
  const now=new Date().toISOString();
  const eventKey=`mercadolibre:${notice.sellerId}:${notice.topic}:${notice.id}`;
  // Public notifications are hints, not trusted financial data. Persist only
  // minimal metadata for already authorized sellers. The consumer must GET
  // the allowlisted resource with that seller's token and verify ownership.
  // No network fetch or business-data mutation runs on this public endpoint.
  const inserted=await database().prepare("INSERT INTO webhook_events (provider,event_key,user_id,external_store_id,event_type,resource_id,payload_json,status,received_at,updated_at) SELECT 'mercadolibre',?,i.user_id,i.external_store_id,?,?,?,'pending',?,? FROM integrations i WHERE i.provider='mercadolibre' AND i.external_store_id=? AND i.status IN ('authorized','connected') AND NOT EXISTS (SELECT 1 FROM webhook_events e WHERE e.provider=i.provider AND e.user_id=i.user_id AND e.resource_id=? AND e.status='pending') LIMIT 1 ON CONFLICT DO NOTHING RETURNING user_id")
    .bind(eventKey,notice.topic,notice.resource,JSON.stringify(notice),now,now,notice.sellerId,notice.resource).first<{user_id:string}>();
  return inserted?.user_id||null;
}

export type MeliCredentials={id:number;user_id:string;external_store_id:string;encrypted_access_token:string;token_iv:string;status:string};
export async function getMeliCredentials(userId:string) {
  return database().prepare("SELECT id,user_id,external_store_id,encrypted_access_token,token_iv,status FROM integrations WHERE user_id=? AND provider='mercadolibre' AND status IN ('authorized','connected') LIMIT 1").bind(userId).first<MeliCredentials>();
}
export async function replaceMeliCredentials(previous:MeliCredentials,encryptedToken:string,iv:string) {
  const result=await database().prepare("UPDATE integrations SET encrypted_access_token=?,token_iv=?,updated_at=? WHERE id=? AND user_id=? AND provider='mercadolibre' AND external_store_id=? AND encrypted_access_token=? AND token_iv=? AND status IN ('authorized','connected')")
    .bind(encryptedToken,iv,new Date().toISOString(),previous.id,previous.user_id,previous.external_store_id,previous.encrypted_access_token,previous.token_iv).run();
  return Number(result.meta.changes)>0;
}
export async function requireMeliReauthorization(previous:MeliCredentials) {
  await database().prepare("UPDATE integrations SET status='reauthorization_required',updated_at=? WHERE id=? AND user_id=? AND provider='mercadolibre' AND encrypted_access_token=? AND token_iv=? AND status IN ('authorized','connected')")
    .bind(new Date().toISOString(),previous.id,previous.user_id,previous.encrypted_access_token,previous.token_iv).run();
}

// Every business write is fenced by the tenant's active import lease and seller
// connection. A late/timed-out worker cannot overwrite a newer worker's data.
const writeGuard="EXISTS (SELECT 1 FROM sync_jobs j JOIN integrations i ON i.user_id=j.user_id AND i.provider=j.provider WHERE j.user_id=? AND j.provider='mercadolibre' AND j.lease_token=? AND j.lease_expires_at>? AND i.external_store_id=? AND i.status IN ('authorized','connected'))";
function guardValues(userId:string,lease:string,sellerId:string) { return [userId,lease,Date.now(),sellerId]; }
export async function saveMeliOrder(userId:string,sellerId:string,lease:string,order:MeliOrder) {
  const now=new Date().toISOString(),guard=guardValues(userId,lease,sellerId);
  const accepted="EXISTS (SELECT 1 FROM orders o WHERE o.user_id=? AND o.provider='mercadolibre' AND o.external_order_id=? AND o.source_updated_at IS NOT DISTINCT FROM ? AND o.synced_at=?)";
  const statements=[database().prepare(`INSERT INTO orders (user_id,provider,external_order_id,order_number,currency,status,payment_status,payment_method,payment_type,payment_installments,shipping_status,source_shipping_cost,source_commission_cost,source_commission_checked_at,total,subtotal,discount,source_created_at,source_updated_at,synced_at) SELECT ?,'mercadolibre',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ${writeGuard} ON CONFLICT(user_id,provider,external_order_id) DO UPDATE SET order_number=excluded.order_number,currency=excluded.currency,status=excluded.status,payment_status=excluded.payment_status,payment_method=excluded.payment_method,payment_type=excluded.payment_type,payment_installments=excluded.payment_installments,shipping_status=excluded.shipping_status,source_shipping_cost=excluded.source_shipping_cost,source_commission_cost=excluded.source_commission_cost,source_commission_checked_at=excluded.source_commission_checked_at,total=excluded.total,subtotal=excluded.subtotal,discount=excluded.discount,source_updated_at=excluded.source_updated_at,synced_at=excluded.synced_at WHERE orders.source_updated_at IS NULL OR excluded.source_updated_at>=orders.source_updated_at`)
    .bind(userId,order.externalId,order.number,order.currency,order.status,order.paymentStatus,order.paymentMethod,order.paymentType,order.paymentInstallments,order.shippingStatus,order.shippingCost,order.commissionCost,now,order.total,order.subtotal,order.discount,order.createdAt,order.updatedAt,now,...guard),
    database().prepare(`DELETE FROM order_items WHERE user_id=? AND provider='mercadolibre' AND external_order_id=? AND ${writeGuard} AND ${accepted}`).bind(userId,order.externalId,...guard,userId,order.externalId,order.updatedAt,now)];
  for(const item of order.items)statements.push(database().prepare(`INSERT INTO order_items (user_id,provider,external_order_id,external_line_id,external_product_id,external_variant_id,name,sku,quantity,unit_price,unit_cost) SELECT ?,'mercadolibre',?,?,?,?,?,?,?,?,? WHERE ${writeGuard} AND ${accepted}`)
    .bind(userId,order.externalId,item.externalLineId,item.productId,item.variantId,item.name,item.sku,item.quantity,item.unitPrice,item.unitCost,...guard,userId,order.externalId,order.updatedAt,now));
  const result=await database().batch(statements);
  if(order.postSale)await database().prepare(`UPDATE orders SET meli_post_sale_json=?,meli_post_sale_checked_at=? WHERE user_id=? AND provider='mercadolibre' AND external_order_id=? AND ${writeGuard} AND ${accepted}`).bind(JSON.stringify(order.postSale),now,userId,order.externalId,...guard,userId,order.externalId,order.updatedAt,now).run();
  // Zero changes may mean a stale API version. Lease checks are performed by
  // the caller's subsequent checkpoint, and no partial lines/costs are written.
  return Number(result[0].meta.changes)>0;
}
export async function getMeliOrderPostSale(userId:string,id:string) {
  return database().prepare("SELECT meli_post_sale_json,meli_post_sale_checked_at FROM orders WHERE user_id=? AND provider='mercadolibre' AND external_order_id=?").bind(userId,id).first<{meli_post_sale_json:string|null;meli_post_sale_checked_at:string|null}>();
}
export async function saveMeliProduct(userId:string,sellerId:string,lease:string,product:SyncedProduct) {
  const now=new Date().toISOString(),guard=guardValues(userId,lease,sellerId);
  const statements=[database().prepare(`INSERT INTO products (user_id,provider,external_product_id,name,image_url,published,source_created_at,source_updated_at,synced_at) SELECT ?,'mercadolibre',?,?,?,?,?,?,? WHERE ${writeGuard} ON CONFLICT(user_id,provider,external_product_id) DO UPDATE SET name=excluded.name,image_url=excluded.image_url,published=excluded.published,source_updated_at=excluded.source_updated_at,synced_at=excluded.synced_at WHERE products.source_updated_at IS NULL OR excluded.source_updated_at>=products.source_updated_at`)
    .bind(userId,product.externalId,product.name,product.imageUrl,product.published?1:0,product.createdAt,product.updatedAt,now,...guard)];
  for(const variant of product.variants)statements.push(database().prepare(`INSERT INTO product_variants (user_id,provider,external_product_id,external_variant_id,sku,price,cost,stock,stock_management,synced_at) SELECT ?,'mercadolibre',?,?,?,?,0,?,?,? WHERE ${writeGuard} AND EXISTS (SELECT 1 FROM products p WHERE p.user_id=? AND p.provider='mercadolibre' AND p.external_product_id=? AND p.synced_at=?) ON CONFLICT(user_id,provider,external_variant_id) DO UPDATE SET sku=excluded.sku,price=excluded.price,stock=excluded.stock,stock_management=excluded.stock_management,synced_at=excluded.synced_at`)
    .bind(userId,product.externalId,variant.externalId,variant.sku,variant.price,variant.stock,variant.stockManagement?1:0,now,...guard,userId,product.externalId,now));
  await database().batch(statements);
}
export async function completeMeliImport(userId:string,sellerId:string,lease:string) {
  await database().prepare(`UPDATE integrations SET status='connected',updated_at=? WHERE user_id=? AND provider='mercadolibre' AND external_store_id=? AND status IN ('authorized','connected') AND ${writeGuard}`)
    .bind(new Date().toISOString(),userId,sellerId,...guardValues(userId,lease,sellerId)).run();
}
export async function meliCounts(userId:string) {
  const row=await database().prepare("SELECT (SELECT COUNT(*) FROM orders WHERE user_id=? AND provider='mercadolibre') AS orders,(SELECT COUNT(*) FROM products WHERE user_id=? AND provider='mercadolibre') AS products,(SELECT COUNT(*) FROM webhook_events WHERE user_id=? AND provider='mercadolibre' AND status IN ('pending','processing','failed')) AS \"pendingEvents\"")
    .bind(userId,userId,userId).first<{orders:number;products:number;pendingEvents:number}>();
  return row||{orders:0,products:0,pendingEvents:0};
}
export async function meliOrdersMissingCosts(userId:string) {
  const rows=await database().prepare(`SELECT external_order_id FROM orders o WHERE user_id=? AND provider='mercadolibre' AND ((payment_status='paid' AND status<>'cancelled' AND (source_shipping_cost IS NULL OR source_commission_cost IS NULL OR EXISTS (SELECT 1 FROM order_items oi ${ITEM_COST_JOINS} WHERE oi.user_id=o.user_id AND oi.provider=o.provider AND oi.external_order_id=o.external_order_id AND ${ITEM_COST_MISSING_SQL}))) OR (CASE WHEN jsonb_typeof(meli_post_sale_json::jsonb->'claims')='array' THEN jsonb_array_length(meli_post_sale_json::jsonb->'claims') ELSE 0 END)>0 OR payment_status IN ('refunded','partially_refunded','charged_back')) AND (source_commission_checked_at IS NULL OR source_commission_checked_at<?) ORDER BY source_commission_checked_at,source_created_at LIMIT 2`)
    .bind(userId,new Date(Date.now()-24*60*60*1000).toISOString()).all<{external_order_id:string}>();
  return rows.results.map(row=>row.external_order_id);
}
export async function queueMeliShipmentOrders(userId:string,sellerId:string,lease:string,eventId:number,ids:string[]) {
  // A shipment may have many orders. Durable fan-out, not one unbounded network
  // loop, lets each order finish under a separate request's execution budget.
  const now=new Date().toISOString();
  await database().prepare(`INSERT INTO webhook_events (provider,event_key,user_id,external_store_id,event_type,resource_id,payload_json,status,received_at,updated_at) SELECT 'mercadolibre',?||ids.value,?,?,'orders_v2','/orders/'||ids.value,'{}','pending',?,? FROM jsonb_array_elements_text(?::jsonb) AS ids(value) WHERE ${writeGuard} ON CONFLICT DO NOTHING`)
    .bind(`mercadolibre:shipment:${eventId}:`,userId,sellerId,now,now,JSON.stringify(ids),...guardValues(userId,lease,sellerId)).run();
}
export async function getMeliProgress(userId:string) {
  return database().prepare("SELECT state_json,updated_at,CASE WHEN lease_token IS NOT NULL THEN lease_expires_at ELSE 0 END AS lease_expires_at FROM sync_jobs WHERE user_id=? AND provider='mercadolibre'").bind(userId).first<{state_json:string;updated_at:string;lease_expires_at:number}>();
}
export async function meliUsersForReconciliation(staleBefore:string,limit=5) {
  const rows=await database().prepare("SELECT i.user_id FROM integrations i LEFT JOIN sync_status s ON s.user_id=i.user_id AND s.provider=i.provider LEFT JOIN sync_jobs j ON j.user_id=i.user_id AND j.provider=i.provider WHERE i.provider='mercadolibre' AND i.status IN ('authorized','connected') AND (s.last_completed_at IS NULL OR s.last_completed_at<? OR (j.state_json::jsonb->>'phase')<>'done' OR EXISTS (SELECT 1 FROM webhook_events e WHERE e.user_id=i.user_id AND e.provider=i.provider AND e.status IN ('pending','failed','processing') AND (e.next_retry_at IS NULL OR e.next_retry_at<=?))) GROUP BY i.user_id ORDER BY MIN(COALESCE(s.last_completed_at,'')) LIMIT ?")
    .bind(staleBefore,new Date().toISOString(),limit).all<{user_id:string}>();
  return rows.results.map(row=>row.user_id);
}
export type MeliEvent={id:number;event_type:string;resource_id:string;external_store_id:string;attempts:number;updated_at:string};
export async function claimMeliEvent(userId:string,sellerId:string) {
  const now=new Date().toISOString(),stale=new Date(Date.now()-10*60*1000).toISOString();
  return database().prepare("UPDATE webhook_events SET status='processing',attempts=attempts+1,updated_at=? WHERE id=(SELECT id FROM webhook_events WHERE user_id=? AND provider='mercadolibre' AND external_store_id=? AND ((status IN ('pending','failed') AND (next_retry_at IS NULL OR next_retry_at<=?)) OR (status='processing' AND updated_at<?)) ORDER BY received_at,id LIMIT 1) RETURNING id,event_type,resource_id,external_store_id,attempts,updated_at")
    .bind(now,userId,sellerId,now,stale).first<MeliEvent>();
}
export async function finishMeliEvent(userId:string,event:MeliEvent,status:'processed'|'failed'|'ignored',error:string|null=null,retrySeconds=30) {
  const now=new Date().toISOString();
  await database().prepare("UPDATE webhook_events SET status=?,last_error=?,next_retry_at=?,processed_at=?,updated_at=? WHERE id=? AND user_id=? AND provider='mercadolibre' AND status='processing' AND updated_at=?")
    .bind(status,error,status==='failed'?new Date(Date.now()+retrySeconds*1000).toISOString():null,status==='failed'?null:now,now,event.id,userId,event.updated_at).run();
  if(status==='processed')await database().prepare("UPDATE sync_status SET webhook_status='active',last_webhook_at=?,webhook_error=NULL WHERE user_id=? AND provider='mercadolibre'").bind(now,userId).run();
}
