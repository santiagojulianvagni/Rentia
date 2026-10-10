import { env } from './env';
import { archiveProduct, claimWebhookEvent, countOrdersAwaitingSourceCommission, disconnectIntegrationByStore, finishReconciliationRun, getIntegrationCredentials, getIntegrationUser, getOrderForCommissionLookup, getOrdersAwaitingSourceCommission, getRetryableWebhookEvents, getSyncStatus, getVariantStoreCosts, markSyncCompleted, markSyncFailed, markSyncStarted, markWebhookEventFailed, markWebhookEventProcessed, markWebhookFailed, markWebhookProcessed, markWebhooksRegistered, registerWebhookEvent, resetSourceCommissionChecks, saveSourceCommission, saveTiendanubePlan, startReconciliationRun, SyncedOrder, SyncedProduct, upsertOrders, upsertProducts } from '../db/database';
import { decryptToken } from './token-crypto';
import { merchantShippingCost } from './tiendanube-shipping';
import { merchantCommissionCost } from './tiendanube-commissions';
import { tiendanubeFetch, tiendanubeRetryDelay } from './tiendanube-http';
import {claimImportJob,checkpointImportJob,releaseImportJob,markSyncPending} from '../db/database';
import {IMPORT_PAGE_SIZE,IMPORT_VERSION,advanceImportWindow,importOrdersPath,newImportProgress,parseImportProgress,splitImportWindow} from './ingestion-progress';

type UnknownRecord = Record<string,unknown>;
type TiendanubeRuntime = {TIENDANUBE_CLIENT_ID?:string;TIENDANUBE_CLIENT_SECRET?:string;TOKEN_ENCRYPTION_KEY?:string;RENTIA_PUBLIC_ORIGIN?:string};
export type TiendanubeWebhookPayload = {store_id:string|number;event:string;id?:string|number};

const automaticEvents=['order/created','order/updated','order/paid','order/cancelled','order/edited','product/created','product/updated','product/deleted','app/uninstalled'] as const;

function record(value:unknown):UnknownRecord { return value&&typeof value==='object'&&!Array.isArray(value)?value as UnknownRecord:{}; }
function list(value:unknown):unknown[] { return Array.isArray(value)?value:[]; }
function text(value:unknown) { return value===null||value===undefined?'':String(value); }
function number(value:unknown) { const parsed=Number(value); return Number.isFinite(parsed)?parsed:0; }
function nullableNumber(value:unknown) { if (value===null||value===undefined||value==='') return null; const parsed=Number(value); return Number.isFinite(parsed)?parsed:null; }
function translated(value:unknown) {
  if (typeof value==='string') return value;
  const values=record(value);
  return text(values.es||values.pt||values.en||Object.values(values)[0]);
}

function runtime() { return env as unknown as TiendanubeRuntime; }

function apiHeaders(token:string) {
  const config=runtime();
  return {authorization:`Bearer ${token}`,'user-agent':`Rentia (${config.TIENDANUBE_CLIENT_ID||'app'})`,'content-type':'application/json'};
}

async function apiRequest(storeId:string,token:string,path:string,init:RequestInit={},notFoundValue?:unknown,version='v1') {
  const response=await tiendanubeFetch(storeId,`https://api.tiendanube.com/${version}/${storeId}/${path}`,{...init,headers:{...apiHeaders(token),...(init.headers||{})}});
  if (response.status===404&&notFoundValue!==undefined) {await response.body?.cancel();return notFoundValue;}
  if (!response.ok) {await response.body?.cancel();throw new Error(`Tiendanube respondió ${response.status} al consultar ${path.split('?')[0]}`);}
  if (response.status===204) return null;
  const body=await response.text();
  return body?JSON.parse(body) as unknown:null;
}

async function fetchCollection(storeId:string,token:string,path:string) {
  const output:UnknownRecord[]=[];
  for (let page=1;;page++) {
    const separator=path.includes('?')?'&':'?';
    const rows=list(await apiRequest(storeId,token,`${path}${separator}page=${page}&per_page=200`,{},[])).map(record);
    output.push(...rows);
    if (rows.length<200) break;
  }
  return output;
}

class CollectionWindowTooLarge extends Error {}

async function fetchImportPage(storeId:string,token:string,path:string) {
  const response=await tiendanubeFetch(storeId,`https://api.tiendanube.com/v1/${storeId}/${path}`,{headers:apiHeaders(token)});
  const total=Number(response.headers.get('x-total-count')||0);
  if(path.startsWith('orders?')&&total>10000){await response.body?.cancel();throw new CollectionWindowTooLarge();}
  if(response.status===404){await response.body?.cancel();return [];}
  if(!response.ok){
    const body=await response.text();
    if((response.status===400||response.status===422)&&/(?:10[.,]?000|too many|maximum.*(?:orders|results)|(?:query|result).*limit)/i.test(body))throw new CollectionWindowTooLarge();
    throw new Error(`Tiendanube respondió ${response.status}; el lote quedó pendiente para reintentar.`);
  }
  const rows=await response.json() as unknown;
  if(!Array.isArray(rows))throw new Error('Tiendanube no devolvió una lista válida. No se avanzó la importación.');
  return rows.map(record);
}

async function fetchResource(storeId:string,token:string,path:string,version='v1') {
  return record(await apiRequest(storeId,token,path,{},undefined,version));
}

function needsPaymentDetails(order:UnknownRecord) {
  if (text(order.payment_status)!=='paid'||!/(?:pago[-_ ]?nube|nuvem[-_ ]?pago)/i.test(text(order.gateway))) return false;
  const details=record(order.payment_details);
  const method=text(details.method)||text(details.type);
  return !method||method==='custom'&&!text(details.credit_card_company)||nullableNumber(details.installments)===null;
}

async function enrichPaymentDetails(storeId:string,token:string,orders:UnknownRecord[]) {
  // The list and webhook payloads can omit payment_details. Query both order
  // versions and the value history before declaring a Pago Nube commission
  // unavailable. Tiendanube documents gateway_method on the PAID history entry
  // even when payment_details.method is null on the order itself.
  const candidates=orders.filter(needsPaymentDetails).slice(0,5);
  for (let index=0;index<candidates.length;index+=5) {
    await Promise.all(candidates.slice(index,index+5).map(async order=>{
      try {
        const orderId=encodeURIComponent(text(order.id));
        const [legacy,detailed,history]=await Promise.all([
          fetchResource(storeId,token,`orders/${orderId}`).catch(()=>({})),
          fetchResource(storeId,token,`orders/${orderId}`,'2025-03').catch(()=>({})),
          apiRequest(storeId,token,`orders/${orderId}/history/values`,{},[],'2025-03').catch(()=>[]),
        ]);
        const existing=record(order.payment_details);
        const merged={...existing};
        for (const source of [record(record(legacy).payment_details),record(record(detailed).payment_details)]) {
          for (const field of ['method','type','credit_card_company','installments']) {
            if (source[field]!==null&&source[field]!==undefined&&source[field]!=='') merged[field]=source[field];
          }
        }
        const paidHistory=list(history).map(record)
          .filter(entry=>text(entry.status).toUpperCase()==='PAID'&&number(entry.total_paid_diff)>0)
          .sort((a,b)=>text(b.closed_at||b.happened_at).localeCompare(text(a.closed_at||a.happened_at)));
        const historyMethod=text(paidHistory[0]?.gateway_method);
        if (!text(merged.method)&&historyMethod) merged.method=historyMethod;
        order.payment_details=merged;
      } catch {
        // The original order and the real provider charge remain authoritative.
      }
    }));
  }
}

function normalizeProducts(rows:UnknownRecord[]):SyncedProduct[] {
  return rows.map(product=>({
    externalId:text(product.id),
    name:translated(product.name)||'Producto sin nombre',
    imageUrl:text(record(list(product.images)[0]).src)||null,
    published:product.published!==false,
    createdAt:text(product.created_at)||null,
    updatedAt:text(product.updated_at)||null,
    variants:list(product.variants).map(value=>{
      const variant=record(value);
      return {externalId:text(variant.id),sku:text(variant.sku)||null,price:number(variant.price),cost:number(variant.cost),stock:nullableNumber(variant.stock),stockManagement:Boolean(variant.stock_management)};
    }).filter(variant=>Boolean(variant.externalId)),
  })).filter(product=>Boolean(product.externalId));
}

function normalizeOrders(rows:UnknownRecord[],costs:Map<string,number>):SyncedOrder[] {
  return rows.map(order=>{
    const payment=record(order.payment_details);
    const reportedPaymentType=text(payment.method)||text(payment.type);
    const paymentType=reportedPaymentType==='custom'&&text(payment.credit_card_company)
      ?'credit_card'
      :reportedPaymentType||(text(payment.credit_card_company)?'credit_card':null);
    return {
    externalId:text(order.id),number:text(order.number)||null,currency:text(order.currency)||'ARS',status:text(order.status)||'open',paymentStatus:text(order.payment_status)||'pending',paymentMethod:text(order.gateway)||reportedPaymentType||null,paymentType,paymentInstallments:nullableNumber(payment.installments),shippingStatus:text(order.shipping_status)||null,
    shippingCost:merchantShippingCost(order),total:number(order.total),subtotal:number(order.subtotal),discount:number(order.discount),createdAt:text(order.created_at)||new Date().toISOString(),updatedAt:text(order.updated_at)||null,
    items:list(order.products).map((value,index)=>{
      const item=record(value); const variantId=text(item.variant_id)||null;
      return {externalLineId:text(item.id)||`${text(order.id)}-${index}`,productId:text(item.product_id)||null,variantId,name:text(item.name)||'Producto',sku:text(item.sku)||null,quantity:Math.max(0,Math.round(number(item.quantity))),unitPrice:number(item.price),unitCost:variantId?costs.get(variantId)||0:0};
    }),
  }}).filter(order=>Boolean(order.externalId));
}

type CommissionSyncResult={outcome:'imported'|'unavailable'|'retry';retryAfterMs?:number};
type CommissionBatch={checked:number;imported:number;unavailable:number;retry:number;remaining:number;missing:number;checkedBefore:string;retryAfterMs:number};
type OrderTransactionsResult={transactions:unknown[]|null;source:'order_aggregate'|'transactions_endpoint'|null;httpStatus:number;retryAfterMs?:number};

async function fetchOrderTransactions(storeId:string,token:string,orderId:string):Promise<OrderTransactionsResult> {
  const encodedOrderId=encodeURIComponent(orderId);
  const aggregateResponse=await tiendanubeFetch(storeId,`https://api.tiendanube.com/2025-03/${storeId}/orders/${encodedOrderId}?aggregates=transactions`,{headers:apiHeaders(token)},0);
  if (aggregateResponse.ok) {
    const order=record(await aggregateResponse.json() as unknown);
    if (Array.isArray(order.transactions)) return {transactions:order.transactions,source:'order_aggregate',httpStatus:aggregateResponse.status};
  }
  // A temporary error is not evidence that the transaction endpoint is absent.
  if (aggregateResponse.status===429||aggregateResponse.status>=500) {
    const retryAfterMs=tiendanubeRetryDelay(aggregateResponse);
    await aggregateResponse.body?.cancel();
    return {transactions:null,source:null,httpStatus:aggregateResponse.status,retryAfterMs};
  }
  if (!aggregateResponse.ok) await aggregateResponse.body?.cancel();
  if (aggregateResponse.status===401) return {transactions:null,source:null,httpStatus:401};

  // Compatibility fallback for stores whose API version still exposes the
  // collection as a subresource. The order aggregate remains the main flow.
  const transactionsResponse=await tiendanubeFetch(storeId,`https://api.tiendanube.com/2025-03/${storeId}/orders/${encodedOrderId}/transactions`,{headers:apiHeaders(token)},0);
  if (transactionsResponse.ok) {
    const transactions=await transactionsResponse.json() as unknown;
    if (Array.isArray(transactions)) return {transactions,source:'transactions_endpoint',httpStatus:transactionsResponse.status};
  }
  const transient=transactionsResponse.status===429||transactionsResponse.status>=500;
  if (!transactionsResponse.ok) await transactionsResponse.body?.cancel();
  return {transactions:null,source:null,httpStatus:transient?transactionsResponse.status:aggregateResponse.ok?transactionsResponse.status:aggregateResponse.status,retryAfterMs:transient?tiendanubeRetryDelay(transactionsResponse):undefined};
}

// An explicit, owner-only check keeps the upstream status visible without
// exposing the access token or the customer's payment information.
export async function diagnoseTiendanubeCommission(userId:string,orderId:string) {
  const order=await getOrderForCommissionLookup(userId,'tiendanube',orderId);
  if (!order) return {outcome:'order_not_found' as const};
  if (order.payment_status!=='paid'||order.status==='cancelled') return {outcome:'not_paid' as const};
  const integration=await getIntegrationCredentials(userId,'tiendanube');
  if (!integration) return {outcome:'not_connected' as const};
  const config=runtime();
  if (!config.TOKEN_ENCRYPTION_KEY) throw new Error('Falta la clave de cifrado del servidor');
  const token=await decryptToken(integration.encrypted_access_token,integration.token_iv,config.TOKEN_ENCRYPTION_KEY);
  try {
    const result=await fetchOrderTransactions(integration.external_store_id,token,orderId);
    if (!result.transactions) return {outcome:'upstream_error' as const,httpStatus:result.httpStatus};
    const transactions=result.transactions;
    const commission=merchantCommissionCost(transactions,order.currency);
    const paid=transactions.map(record).filter(transaction=>String(transaction.status).toLowerCase()==='paid');
    const chargeTypes=[...new Set(paid.flatMap(transaction=>list(record(transaction.info).merchant_charges).map(charge=>text(record(charge).type))).filter(Boolean))];
    await saveSourceCommission(userId,'tiendanube',orderId,commission);
    if (commission===null) return {outcome:'no_charge' as const,httpStatus:result.httpStatus,source:result.source,transactionCount:transactions.length,paidTransactions:paid.length,chargeTypes};
    return {outcome:'imported' as const,httpStatus:result.httpStatus,source:result.source,commission,transactionCount:transactions.length,paidTransactions:paid.length,chargeTypes};
  } catch {
    return {outcome:'network_error' as const};
  }
}

async function syncOrderCommission(userId:string,storeId:string,token:string,orderId:string,currency:string):Promise<CommissionSyncResult> {
  try {
    const result=await fetchOrderTransactions(storeId,token,orderId);
    // Some payment providers do not expose merchant charges. Keep the
    // configured rule as fallback instead of treating missing data as $0.
    if (!result.transactions&&(result.httpStatus===403||result.httpStatus===404)) {
      await saveSourceCommission(userId,'tiendanube',orderId,null);
      return {outcome:'unavailable'};
    }
    if (!result.transactions) return {outcome:'retry',retryAfterMs:result.retryAfterMs||2000};
    const commission=merchantCommissionCost(result.transactions,currency);
    await saveSourceCommission(userId,'tiendanube',orderId,commission);
    return {outcome:commission===null?'unavailable':'imported'};
  } catch {
    // A transient payment API failure must not interrupt order synchronization.
    return {outcome:'retry',retryAfterMs:2000};
  }
}

async function syncCommissionBatch(userId:string,storeId:string,token:string,checkedBefore=new Date().toISOString(),limit=20):Promise<CommissionBatch> {
  const awaiting=await getOrdersAwaitingSourceCommission(userId,'tiendanube',limit,checkedBefore);
  const results:CommissionSyncResult[]=[];
  for (const order of awaiting) {
    const result=await syncOrderCommission(userId,storeId,token,order.external_order_id,order.currency);
    results.push(result);
    // Leave failed lookups eligible, pause and resume in the next HTTP batch.
    if (result.outcome==='retry') break;
  }
  const [remaining,missing]=await Promise.all([countOrdersAwaitingSourceCommission(userId,'tiendanube',checkedBefore),countOrdersAwaitingSourceCommission(userId,'tiendanube')]);
  return {checked:results.filter(result=>result.outcome!=='retry').length,imported:results.filter(result=>result.outcome==='imported').length,unavailable:results.filter(result=>result.outcome==='unavailable').length,retry:results.filter(result=>result.outcome==='retry').length,remaining,missing,checkedBefore,retryAfterMs:Math.max(0,...results.map(result=>result.retryAfterMs||0))};
}

// A separate batch lets the panel finish a large historical import with one
// click without repeating product, order and webhook synchronization.
export async function syncPendingTiendanubeCommissions(userId:string,checkedBefore?:string) {
  const integration=await getIntegrationCredentials(userId,'tiendanube');
  if (!integration) throw new Error('Tiendanube no está conectada');
  const encryptionKey=runtime().TOKEN_ENCRYPTION_KEY;
  if (!encryptionKey) throw new Error('Falta la clave de cifrado del servidor');
  const token=await decryptToken(integration.encrypted_access_token,integration.token_iv,encryptionKey);
  return syncCommissionBatch(userId,integration.external_store_id,token,checkedBefore);
}

export async function verifyTiendanubeWebhook(rawBody:string,signature:string|null) {
  const secret=runtime().TIENDANUBE_CLIENT_SECRET;
  if (!secret||!signature||!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signed=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(rawBody));
  const expected=Array.from(new Uint8Array(signed),byte=>byte.toString(16).padStart(2,'0')).join('');
  if (expected.length!==signature.length) return false;
  let difference=0;
  for (let index=0;index<expected.length;index++) difference|=expected.charCodeAt(index)^signature.toLowerCase().charCodeAt(index);
  return difference===0;
}

export function tiendanubeWebhookUrl(requestUrl:string) {
  const origin=(runtime().RENTIA_PUBLIC_ORIGIN||new URL(requestUrl).origin).replace(/\/$/,'');
  return `${origin}/api/webhooks/tiendanube`;
}

export async function ensureTiendanubeWebhooks(userId:string,storeId:string,token:string,callbackUrl:string) {
  try {
    const existing=await fetchCollection(storeId,token,`webhooks?url=${encodeURIComponent(callbackUrl)}`);
    const registered=new Set(existing.map(webhook=>`${text(webhook.event)}|${text(webhook.url)}`));
    let created=0;
    for (const event of automaticEvents) {
      if (registered.has(`${event}|${callbackUrl}`)) continue;
      await apiRequest(storeId,token,'webhooks',{method:'POST',body:JSON.stringify({event,url:callbackUrl})});
      created++;
    }
    await markWebhooksRegistered(userId,'tiendanube');
    return {active:true,created,total:automaticEvents.length};
  } catch (error) {
    const message=error instanceof Error?error.message:'No pudimos activar la actualización automática';
    await markWebhookFailed(userId,'tiendanube',message);
    throw error;
  }
}

export async function ensureTiendanubeWebhooksForUser(userId:string,requestUrl:string) {
  const config=runtime();
  const integration=await getIntegrationCredentials(userId,'tiendanube');
  if (!integration) throw new Error('Tiendanube no está conectada');
  if (!config.TOKEN_ENCRYPTION_KEY) throw new Error('Falta la clave de cifrado del servidor');
  const token=await decryptToken(integration.encrypted_access_token,integration.token_iv,config.TOKEN_ENCRYPTION_KEY);
  return ensureTiendanubeWebhooks(userId,integration.external_store_id,token,tiendanubeWebhookUrl(requestUrl));
}

export async function processTiendanubeWebhook(payload:TiendanubeWebhookPayload) {
  const storeId=text(payload.store_id);
  const event=text(payload.event);
  const resourceId=text(payload.id);
  if (!storeId||!event) throw new Error('Webhook incompleto');
  const integrationUser=await getIntegrationUser('tiendanube',storeId);
  if (!integrationUser) return {ignored:true,reason:'store_not_connected'};
  if (event==='app/uninstalled') {
    await disconnectIntegrationByStore('tiendanube',storeId);
    return {processed:true,event};
  }
  if (!automaticEvents.includes(event as typeof automaticEvents[number])) return {ignored:true,reason:'event_not_used'};
  if (!resourceId) throw new Error('El webhook no incluye el recurso');
  const config=runtime();
  const integration=await getIntegrationCredentials(integrationUser.user_id,'tiendanube');
  if (!integration||!config.TOKEN_ENCRYPTION_KEY) throw new Error('La conexión de Tiendanube no está disponible');
  try {
    const token=await decryptToken(integration.encrypted_access_token,integration.token_iv,config.TOKEN_ENCRYPTION_KEY);
    if (event==='product/deleted') await archiveProduct(integrationUser.user_id,'tiendanube',resourceId);
    else if (event.startsWith('product/')) {
      const product=await fetchResource(storeId,token,`products/${encodeURIComponent(resourceId)}`);
      await upsertProducts(integrationUser.user_id,'tiendanube',normalizeProducts([product]));
    } else if (event.startsWith('order/')) {
      const [order,costs]=await Promise.all([
        fetchResource(storeId,token,`orders/${encodeURIComponent(resourceId)}?aggregates=fulfillment_orders`),
        getVariantStoreCosts(integrationUser.user_id,'tiendanube'),
      ]);
      await enrichPaymentDetails(storeId,token,[order]);
      await upsertOrders(integrationUser.user_id,'tiendanube',normalizeOrders([order],costs));
      if (order.payment_status==='paid'&&order.status!=='cancelled') await syncOrderCommission(integrationUser.user_id,storeId,token,resourceId,text(order.currency)||'ARS');
    }
    await markWebhookProcessed(integrationUser.user_id,'tiendanube');
    return {processed:true,event,resourceId};
  } catch (error) {
    await markWebhookFailed(integrationUser.user_id,'tiendanube',error instanceof Error?error.message:'Error procesando el webhook');
    throw error;
  }
}

export async function handleTiendanubeWebhook(rawBody:string,payload:TiendanubeWebhookPayload,deliveryId:string|null) {
  const storeId=text(payload.store_id);
  const event=text(payload.event);
  const resourceId=text(payload.id)||null;
  if (!storeId||!event) throw new Error('Webhook incompleto');
  const integrationUser=await getIntegrationUser('tiendanube',storeId);
  const eventKey=`tiendanube:${deliveryId||crypto.randomUUID()}`;
  const registration=await registerWebhookEvent({provider:'tiendanube',eventKey,userId:integrationUser?.user_id||null,storeId,eventType:event,resourceId,payloadJson:rawBody});
  if (!registration.claimed) return {duplicate:true,status:registration.event.status,event,resourceId};
  try {
    const result=await processTiendanubeWebhook(payload);
    await markWebhookEventProcessed(registration.event.id,integrationUser?.user_id||null);
    return {...result,deliveryRecorded:true};
  } catch (error) {
    const message=error instanceof Error?error.message:'Error procesando el webhook';
    await markWebhookEventFailed(registration.event.id,integrationUser?.user_id||null,message);
    throw error;
  }
}

export async function retryFailedTiendanubeWebhooks(userId:string,limit=20) {
  const queued=await getRetryableWebhookEvents('tiendanube',userId,limit);
  let recovered=0;
  let failed=0;
  for (const queuedEvent of queued.results) {
    const event=await claimWebhookEvent(queuedEvent.id);
    if (!event) continue;
    try {
      const payload=JSON.parse(event.payload_json) as TiendanubeWebhookPayload;
      await processTiendanubeWebhook(payload);
      await markWebhookEventProcessed(event.id,userId);
      recovered++;
    } catch (error) {
      failed++;
      await markWebhookEventFailed(event.id,userId,error instanceof Error?error.message:'Error procesando el webhook');
    }
  }
  return {queued:queued.results.length,recovered,failed};
}

export async function reconcileTiendanube(userId:string,requestUrl:string,triggerSource:'manual'|'panel'|'scheduled'='manual') {
  const runId=await startReconciliationRun(userId,'tiendanube',triggerSource);
  try {
    const retry=await retryFailedTiendanubeWebhooks(userId);
    let automatic=true;
    let automaticError:string|null=null;
    try { await ensureTiendanubeWebhooksForUser(userId,requestUrl); }
    catch (error) { automatic=false;automaticError=error instanceof Error?error.message:'No pudimos activar los webhooks'; }
    const sync=await syncTiendanube(userId,triggerSource!=='manual');
    const summary={...sync,retry,automatic,automaticError};
    await finishReconciliationRun(runId,sync.pending?'pending':'success',summary);
    return summary;
  } catch (error) {
    const message=error instanceof Error?error.message:'Error desconocido de conciliación';
    await finishReconciliationRun(runId,'failed',{},message);
    throw error;
  }
}

export async function syncTiendanube(userId:string,automatic=false) {
  const checkedBefore=new Date(Date.now()-(automatic?6*60*60*1000:0)).toISOString();
  const config=runtime(),integration=await getIntegrationCredentials(userId,'tiendanube');
  if(!integration)throw new Error('Tiendanube no está conectada');
  if(!config.TOKEN_ENCRYPTION_KEY)throw new Error('Falta la clave de cifrado del servidor');
  const job=await claimImportJob(userId,'tiendanube',JSON.stringify(newImportProgress(null)));
  if(!job)return {orders:0,products:0,incremental:true,skipped:true,pending:true};
  try {
    let state=parseImportProgress(job.stateJson);
    if(state.done)state=newImportProgress(state);
    await checkpointImportJob(userId,'tiendanube',job.token,JSON.stringify(state));
    await markSyncStarted(userId,'tiendanube');
    const token=await decryptToken(integration.encrypted_access_token,integration.token_iv,config.TOKEN_ENCRYPTION_KEY);
    if(!state.productsDone) {
      const query=new URLSearchParams({page:String(state.productsPage),per_page:String(IMPORT_PAGE_SIZE)});
      if(state.since)query.set('updated_at_min',state.since);
      query.set('updated_at_max',state.until);
      const raw=await fetchImportPage(integration.external_store_id,token,`products?${query}`);
      await upsertProducts(userId,'tiendanube',normalizeProducts(raw));
      state.products+=raw.length;state.productsPage++;
      state.productsDone=raw.length<IMPORT_PAGE_SIZE;
      if(state.productsPage===2) {
        const store=await fetchResource(integration.external_store_id,token,'store').catch(()=>({}));
        if(text(record(store).plan_name))await saveTiendanubePlan(userId,text(record(store).plan_name));
      }
      await checkpointImportJob(userId,'tiendanube',job.token,JSON.stringify(state));
    }
    if(!state.productsDone) {
      await markSyncPending(userId,'tiendanube',state.orders,state.products);
      await checkpointImportJob(userId,'tiendanube',job.token,JSON.stringify(state),true);
      return {orders:state.orders,products:state.products,pending:true,incremental:Boolean(state.since),skipped:false};
    }
    const path=importOrdersPath(state);
    if(path) {
      try {
        const raw=await fetchImportPage(integration.external_store_id,token,path);
        const costs=await getVariantStoreCosts(userId,'tiendanube');
        await enrichPaymentDetails(integration.external_store_id,token,raw);
        await upsertOrders(userId,'tiendanube',normalizeOrders(raw,costs));
        advanceImportWindow(state,raw.length);
      } catch(error) {
        if(!(error instanceof CollectionWindowTooLarge))throw error;
        splitImportWindow(state);
      }
      await checkpointImportJob(userId,'tiendanube',job.token,JSON.stringify(state));
    }
    state.done=state.productsDone&&state.windows.length===0;
    if(!state.done) {
      await markSyncPending(userId,'tiendanube',state.orders,state.products);
      await checkpointImportJob(userId,'tiendanube',job.token,JSON.stringify(state),true);
      return {orders:state.orders,products:state.products,pending:true,incremental:Boolean(state.since),skipped:false};
    }
    if(!state.since)await resetSourceCommissionChecks(userId,'tiendanube');
    const commissions=await syncCommissionBatch(userId,integration.external_store_id,token,checkedBefore);
    await markSyncCompleted(userId,'tiendanube',state.orders,state.products,IMPORT_VERSION,state.until);
    await checkpointImportJob(userId,'tiendanube',job.token,JSON.stringify(state),true);
    return {orders:state.orders,products:state.products,commissions,pending:false,incremental:Boolean(state.since),skipped:false};
  } catch(error) {
    const message=error instanceof Error?error.message:'Error desconocido de sincronización';
    await markSyncFailed(userId,'tiendanube',message);
    throw error;
  } finally {
    await releaseImportJob(userId,'tiendanube',job.token);
  }
}
