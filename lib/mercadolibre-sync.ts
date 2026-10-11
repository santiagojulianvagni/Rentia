import {claimImportJob,checkpointImportJob,forgetSkippedOrder,getIntegrations,getSyncStatus,markSyncCompleted,markSyncFailed,markSyncPending,markSyncStarted,recoverableSkippedOrders,releaseImportJob} from '../db/database';
import {claimMeliEvent,completeMeliImport,finishMeliEvent,getMeliCredentials,getMeliProgress,meliCounts,meliOrdersMissingCosts,queueMeliShipmentOrders,replaceMeliCredentials,requireMeliReauthorization,saveMeliOrder,saveMeliProduct,type MeliCredentials,type MeliEvent} from '../db/mercadolibre';
import {mercadoLibreConfigured,mercadoLibreMissingConfig,mercadoLibreRuntime} from './mercadolibre';
import {IMPORT_HISTORY_MONTHS,importHistoryStart} from './import-history';
import {allocateMeliShipment,MELI_IMPORT_VERSION,MELI_PAGE_SIZE,MELI_WINDOW_SIZE,meliId,meliItemId,meliList,meliRecord,meliShipmentOrderIds,newMeliProgress,normalizeMeliOrder,normalizeMeliProduct,readMeliProgress,splitMeliWindow,type MeliProgress} from './mercadolibre-data';
import {decryptToken,encryptToken} from './token-crypto';
import {getMeliOrderPostSale} from '../db/mercadolibre';
import {meliPaymentFacts,normalizeMeliClaims,readMeliPostSale} from './meli-post-sale';

export class MeliError extends Error {
  constructor(public code:string,public retrySeconds=30){super(code);}
}
type StoredTokens={version:1;accessToken:string;refreshToken:string;expiresAt:number;sellerId:string};
async function readTokens(row:MeliCredentials):Promise<StoredTokens> {
  try {
    const value=JSON.parse(await decryptToken(row.encrypted_access_token,row.token_iv,mercadoLibreRuntime().TOKEN_ENCRYPTION_KEY!)) as StoredTokens;
    if(value.version!==1||!value.accessToken||!value.refreshToken||!Number.isFinite(value.expiresAt)||value.sellerId!==row.external_store_id)throw new Error();
    return value;
  }catch{await requireMeliReauthorization(row);throw new MeliError('mercadolibre_reauthorize');}
}
function safeError(error:unknown) {
  const code=error instanceof MeliError?error.code:error instanceof Error&&/^mercadolibre_[a-z_]+$/.test(error.message)?error.message:'mercadolibre_sync_failed';
  return {code,retrySeconds:error instanceof MeliError?error.retrySeconds:30};
}
function timeout(deadline:number) {
  const remaining=deadline-Date.now();
  if(remaining<1200)throw new MeliError('mercadolibre_batch_yield',0);
  return AbortSignal.timeout(Math.min(6000,remaining));
}
async function accessToken(userId:string,deadline:number,rejectedToken?:string) {
  let row=await getMeliCredentials(userId);
  if(!row)throw new MeliError('mercadolibre_reauthorize');
  let value=await readTokens(row);
  if(value.expiresAt>Date.now()+60_000&&(!rejectedToken||value.accessToken!==rejectedToken))return {row,value};
  // Refresh tokens are single-use. The dedicated database lease serializes renewal
  // across function instances; compare-and-swap prevents clobbering a fresh OAuth login.
  const lease=await claimImportJob(userId,'mercadolibre_token','{}');
  if(!lease)throw new MeliError('mercadolibre_refresh_busy',8);
  try {
    row=await getMeliCredentials(userId);
    if(!row)throw new MeliError('mercadolibre_reauthorize');
    value=await readTokens(row);
    if(value.expiresAt>Date.now()+60_000&&(!rejectedToken||value.accessToken!==rejectedToken))return {row,value};
    const runtime=mercadoLibreRuntime();
    // Check budget before transmitting the one-use token.
    const signal=timeout(deadline);
    let response:Response;
    try {response=await fetch('https://api.mercadolibre.com/oauth/token',{method:'POST',headers:{accept:'application/json','content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',client_id:runtime.MELI_APP_ID!,client_secret:runtime.MELI_APP_SECRET!,refresh_token:value.refreshToken}),signal,redirect:'manual'});}
    catch {
      // The server may have consumed it before a timeout. Never blindly reuse.
      await requireMeliReauthorization(row);throw new MeliError('mercadolibre_reauthorize');
    }
    if(response.status===429)throw new MeliError('mercadolibre_rate_limit',retryAfter(response));
    if(response.status>=500)throw new MeliError('mercadolibre_api_unavailable',60);
    const body=meliRecord(await response.json().catch(()=>null));
    if(!response.ok||typeof body.access_token!=='string'||!body.access_token||typeof body.refresh_token!=='string'||!body.refresh_token||!Number.isFinite(Number(body.expires_in))||Number(body.expires_in)<=0||String(body.user_id)!==row.external_store_id) {
      await requireMeliReauthorization(row);throw new MeliError('mercadolibre_reauthorize');
    }
    const next:StoredTokens={version:1,accessToken:body.access_token,refreshToken:body.refresh_token,expiresAt:Date.now()+Number(body.expires_in)*1000,sellerId:row.external_store_id};
    const encrypted=await encryptToken(JSON.stringify(next),runtime.TOKEN_ENCRYPTION_KEY!);
    if(!await replaceMeliCredentials(row,encrypted.encryptedToken,encrypted.iv))throw new MeliError('mercadolibre_connection_changed',8);
    return {row,value:next};
  }finally{await releaseImportJob(userId,'mercadolibre_token',lease.token);}
}
function retryAfter(response:Response) {
  const raw=response.headers.get('retry-after'),seconds=Number(raw);
  const time=raw?Date.parse(raw):NaN;
  return Math.max(5,Math.min(3600,Number.isFinite(seconds)&&seconds>0?seconds:Number.isFinite(time)?Math.ceil((time-Date.now())/1000):60));
}
export class MeliClient {
  constructor(public userId:string,public sellerId:string,public deadline:number){}
  async get(path:string,extra:Record<string,string>={}):Promise<unknown> {
    // Notification payloads never supply hosts, arbitrary URLs or credentials.
    const url=new URL(path,'https://api.mercadolibre.com');
    const allowed=/^\/orders\/(?:search|\d+)$/.test(url.pathname)||/^\/items\/[A-Z]{3}\d+$/.test(url.pathname)||/^\/shipments\/\d+(?:\/(?:costs|orders))?$/.test(url.pathname)||url.pathname===`/users/${this.sellerId}/items/search`||/^\/billing\/integration\/periods\/key\/\d{4}-\d{2}-01\/group\/(ML|MP)\/details$/.test(url.pathname)||/^\/post-purchase\/v1\/claims\/\d+$/.test(url.pathname)||(url.pathname==='/post-purchase/v1/claims/search'&&/^\d+$/.test(url.searchParams.get('order_id')||'')&&url.searchParams.get('players.user_id')===this.sellerId&&url.searchParams.get('players.role')==='respondent');
    const adsAllowed=(url.pathname==='/advertising/advertisers'&&url.searchParams.get('product_id')==='PADS')||/^\/advertising\/[A-Z]{3}\/advertisers\/\d+\/product_ads\/campaigns\/search$/.test(url.pathname)||/^\/advertising\/[A-Z]{3}\/product_ads\/campaigns\/\d+$/.test(url.pathname);
    if(url.origin!=='https://api.mercadolibre.com'||!path.startsWith('/')||path.startsWith('//')||url.username||url.password||url.hash||!(allowed||adsAllowed))throw new MeliError('mercadolibre_invalid_resource');
    let credentials=await accessToken(this.userId,this.deadline);
    if(credentials.row.external_store_id!==this.sellerId)throw new MeliError('mercadolibre_connection_changed');
    for(let attempt=0;attempt<2;attempt++) {
      let response:Response;
      const signal=timeout(this.deadline);
      // Workerd supports manual/follow, not error. Manual preserves the no-
      // redirect policy; !ok below rejects 3xx without sending tokens elsewhere.
      try {response=await fetch(url,{headers:{...extra,accept:'application/json',authorization:`Bearer ${credentials.value.accessToken}`},signal,redirect:'manual'});}
      catch{throw new MeliError(Date.now()>=this.deadline-100?'mercadolibre_batch_yield':'mercadolibre_api_unavailable',30);}
      if(response.status===401&&attempt===0) {credentials=await accessToken(this.userId,this.deadline,credentials.value.accessToken);continue;}
      if(response.status===429)throw new MeliError('mercadolibre_rate_limit',retryAfter(response));
      if(response.status===403)throw new MeliError('mercadolibre_permission_missing',300);
      if(response.status===404)throw new MeliError('mercadolibre_resource_unavailable',300);
      // Partial financial/post-sale responses cannot confirm missing facts.
      if(response.status===206&&(url.pathname.startsWith('/billing/')||url.pathname.startsWith('/post-purchase/')||adsAllowed))throw new MeliError('mercadolibre_partial_report',300);
      if(!response.ok)throw new MeliError(response.status===400?'mercadolibre_invalid_api_request':'mercadolibre_api_unavailable',60);
      try{return await response.json();}catch{throw new MeliError('mercadolibre_invalid_api_response');}
    }
    throw new MeliError('mercadolibre_reauthorize');
  }
}
type Shipping={allocations:Map<string,number>|null;status:string|null};
async function shipping(client:MeliClient,id:string):Promise<Shipping> {
  const shipment=meliRecord(await client.get(`/shipments/${id}`,{'x-format-new':'true'}));
  if(meliId(shipment.id)!==id)throw new MeliError('mercadolibre_invalid_api_response');
  // Ownership must be proven independently of the public notification.
  const costs=await client.get(`/shipments/${id}/costs`,{'x-format-new':'true'});
  const orders=await client.get(`/shipments/${id}/orders`,{'X-New-Domain':'true','x-format-new':'true'});
  const allocations=allocateMeliShipment(costs,orders,client.sellerId);
  if(String(shipment.sender_id)!==client.sellerId&&!meliShipmentOrderIds(orders,client.sellerId)?.size)throw new MeliError('mercadolibre_shipment_owner');
  return {allocations,status:typeof shipment.status==='string'?shipment.status:null};
}
async function importOrder(client:MeliClient,lease:string,id:string,shippingCache:Map<string,Shipping>,inspectClaims=false) {
  const value=meliRecord(await client.get(`/orders/${id}`));
  if(meliId(value.id)!==id||meliId(meliRecord(value.seller).id)!==client.sellerId)throw new MeliError('mercadolibre_order_owner');
  const shipmentId=meliRecord(value.shipping).id;
  let cost:number|null=null,status:string|null=null;
  if(shipmentId!==null&&shipmentId!==undefined) {
    const key=meliId(shipmentId);
    let result=shippingCache.get(key);
    if(!result) {
      try {result=await shipping(client,key);shippingCache.set(key,result);}
      catch(error) {
        const safe=safeError(error);
        // Missing permissions/details must not prevent saving the order, but
        // the seller cost remains NULL (never buyer cost or an invented zero).
        // The order itself has already passed its seller check. Unverifiable
        // shipping contributes neither status nor cost, but cannot block saving
        // that verified order. Foreign order/webhook data is still rejected.
        if(!['mercadolibre_resource_unavailable','mercadolibre_permission_missing','mercadolibre_shipment_owner'].includes(safe.code))throw error;
      }
    }
    if(result){cost=result.allocations?.get(id)??null;status=result.status;}
  }
  const previous=readMeliPostSale((await getMeliOrderPostSale(client.userId,id))?.meli_post_sale_json);
  const facts=meliPaymentFacts(value,client.sellerId);
  if(previous){facts.claims=previous.claims;facts.claimsChecked=previous.claimsChecked;facts.claimsError=previous.claimsError;}
  if(inspectClaims||meliList(value.mediations).length||previous?.claims.length) {
    try {
      const params=new URLSearchParams({order_id:id,'players.user_id':client.sellerId,'players.role':'respondent',limit:'100'});
      facts.claims=normalizeMeliClaims(await client.get(`/post-purchase/v1/claims/search?${params}`),id,client.sellerId);facts.claimsChecked=true;facts.claimsError=null;
    }catch(error){const safe=safeError(error);if(!['mercadolibre_permission_missing','mercadolibre_resource_unavailable'].includes(safe.code))throw error;facts.claimsChecked=false;facts.claimsError=safe.code;}
  }
  if(facts.refundStatus==='none'&&facts.claims.some(claim=>claim.status==='closed'&&claim.resolution==='payment_refunded'))facts.refundStatus='reported';
  const order=normalizeMeliOrder(value,client.sellerId,cost,status);order.postSale=facts;
  if(facts.refundStatus!=='none')order.paymentStatus=facts.refundStatus==='partial'?'partially_refunded':facts.refundStatus==='charged_back'?'charged_back':'refunded';
  await saveMeliOrder(client.userId,client.sellerId,lease,order);
}
async function consumeEvent(client:MeliClient,lease:string,event:MeliEvent,cache:Map<string,Shipping>) {
  if(event.external_store_id!==client.sellerId)throw new MeliError('mercadolibre_resource_owner');
  if(event.event_type==='orders_v2'&&/^\/orders\/\d+$/.test(event.resource_id))await importOrder(client,lease,event.resource_id.split('/')[2],cache);
  else if(event.event_type==='items'&&/^\/items\/[A-Z]{3}\d+$/.test(event.resource_id))await saveMeliProduct(client.userId,client.sellerId,lease,normalizeMeliProduct(await client.get(event.resource_id),client.sellerId));
  else if(event.event_type==='shipments'&&/^\/shipments\/\d+$/.test(event.resource_id)) {
    const id=event.resource_id.split('/')[2],result=await shipping(client,id);cache.set(id,result);
    if(!result.allocations)throw new MeliError('mercadolibre_shipping_pending',300);
    await queueMeliShipmentOrders(client.userId,client.sellerId,lease,event.id,[...result.allocations.keys()]);
  }else if(event.event_type==='claims'&&/^\/post-purchase\/v1\/claims\/\d+$/.test(event.resource_id)) {
    const claim=meliRecord(await client.get(event.resource_id));
    if(String(claim.id)!==event.resource_id.split('/').pop()||!meliList(claim.players).some(raw=>{const player=meliRecord(raw);return player.role==='respondent'&&String(player.user_id)===client.sellerId;}))throw new MeliError('mercadolibre_resource_owner');
    if(claim.resource!=='order')throw new MeliError('mercadolibre_invalid_resource');
    await importOrder(client,lease,meliId(claim.resource_id),cache,true);
  }else throw new MeliError('mercadolibre_invalid_resource');
}

export async function inspectMeliOrder(userId:string,id:string) {
  // Never turn an arbitrary client-supplied order id into an upstream lookup.
  if(!await getMeliOrderPostSale(userId,id))throw new MeliError('mercadolibre_order_not_found');
  const connection=await getMeliCredentials(userId);if(!connection)throw new MeliError('mercadolibre_reauthorize');
  const lease=await claimImportJob(userId,'mercadolibre',JSON.stringify(newMeliProgress(connection.external_store_id)),60_000);
  if(!lease)throw new MeliError('mercadolibre_import_busy',8);
  try {
    await importOrder(new MeliClient(userId,connection.external_store_id,Date.now()+18_000),lease.token,id,new Map(),true);
    const row=await getMeliOrderPostSale(userId,id);return {ok:true,postSale:readMeliPostSale(row?.meli_post_sale_json)};
  }finally{await releaseImportJob(userId,'mercadolibre',lease.token);}
}

export async function reconcileMercadoLibre(userId:string,force=false) {
  if(!mercadoLibreConfigured())throw new MeliError('mercadolibre_not_configured');
  const connection=await getMeliCredentials(userId);
  if(!connection)throw new MeliError('mercadolibre_reauthorize');
  // The batch's upstream budget is 18s. Renew a fenced 60s lease at every
  // checkpoint; an interrupted request must not block recovery for ten minutes.
  // Token-renewal and other providers retain their independent longer leases.
  const leaseMs=60_000;
  const claimed=await claimImportJob(userId,'mercadolibre',JSON.stringify(newMeliProgress(connection.external_store_id)),leaseMs);
  if(!claimed)return {busy:true,pending:true,...await meliCounts(userId)};
  const checkpoint=(state:MeliProgress)=>checkpointImportJob(userId,'mercadolibre',claimed.token,JSON.stringify(state),false,leaseMs);
  const client=new MeliClient(userId,connection.external_store_id,Date.now()+18_000),cache=new Map<string,Shipping>();
  let state:MeliProgress|null=null;
  try {
    state=readMeliProgress(claimed.stateJson,connection.external_store_id);
    if(state.retryAt>Date.now())return {busy:false,pending:true,retryAt:state.retryAt,...await meliCounts(userId)};
    await markSyncStarted(userId,'mercadolibre');
    // Bounded event work shares the same tenant lease as historical import.
    for(let count=0;count<3&&Date.now()<client.deadline-1500;count++) {
      const event=await claimMeliEvent(userId,client.sellerId);if(!event)break;
      try {await consumeEvent(client,claimed.token,event,cache);await finishMeliEvent(userId,event,'processed');}
      catch(error) {
        const safe=safeError(error),ignored=['mercadolibre_resource_owner','mercadolibre_order_owner','mercadolibre_shipment_owner','mercadolibre_invalid_resource'].includes(safe.code);
        await finishMeliEvent(userId,event,ignored?'ignored':'failed',safe.code,Math.max(safe.retrySeconds,Math.min(3600,30*2**Math.min(event.attempts,7))));
        if(!ignored)throw error;
      }
    }
    for(const id of await recoverableSkippedOrders(userId,'mercadolibre',5)) {
      if(Date.now()>=client.deadline-3000)break;
      try{await importOrder(client,claimed.token,id,cache);}
      catch(error){const safe=safeError(error);if(['mercadolibre_resource_unavailable','mercadolibre_order_owner','mercadolibre_invalid_resource'].includes(safe.code))await forgetSkippedOrder(userId,'mercadolibre',id);else throw error;}
    }
    if(state.phase==='done'&&(force||Date.now()-Date.parse(state.through)>20*60*1000)) {
      const now=new Date();
      const from=new Date(Math.max(Date.parse(importHistoryStart(now)),Date.parse(state.through)-10*60*1000)).toISOString();
      state=newMeliProgress(client.sellerId,from,now.toISOString());
      await checkpoint(state);
    }
    for(let units=0;units<20&&state.phase!=='done'&&Date.now()<client.deadline-1500;units++) {
      if(state.phase==='orders') {
        if(state.pendingOrders.length) {
          await importOrder(client,claimed.token,state.pendingOrders[0],cache);
          state.pendingOrders.shift();
          if(!state.pendingOrders.length) {
            const window=state.windows[0];window.offset+=state.pageCount;
            if(window.offset>=state.pageTotal)state.windows.shift();
          }
        }else if(!state.windows.length)state.phase='products';
        else {
          const window=state.windows[0],params=new URLSearchParams({seller:client.sellerId,limit:String(MELI_PAGE_SIZE),offset:String(window.offset),sort:'date_asc'});
          const field=state.mode==='history'?'order.date_created':'order.date_last_updated';
          params.set(`${field}.from`,window.from);params.set(`${field}.to`,window.to);
          if(window.cancelled)params.set('order.status','cancelled');
          const page=meliRecord(await client.get(`/orders/search?${params}`)),paging=meliRecord(page.paging),total=Number(paging.total);
          if(!Number.isSafeInteger(total)||total<0||!Array.isArray(page.results))throw new MeliError('mercadolibre_invalid_api_response');
          if(total>MELI_WINDOW_SIZE)splitMeliWindow(state);
          else {
            const ids=meliList(page.results).map(value=>meliId(meliRecord(value).id));
            if(!ids.length&&window.offset<total)throw new MeliError('mercadolibre_incomplete_page');
            if(ids.length>0&&window.offset+ids.length>=MELI_WINDOW_SIZE&&window.offset+ids.length<total)splitMeliWindow(state);
            else {state.pendingOrders=ids;state.pageCount=ids.length;state.pageTotal=total;if(!ids.length)state.windows.shift();}
          }
        }
      }else if(state.pendingItems.length) {
        const id=state.pendingItems[0],product=normalizeMeliProduct(await client.get(`/items/${id}`),client.sellerId);
        if(product.externalId!==id)throw new MeliError('mercadolibre_invalid_api_response');
        await saveMeliProduct(userId,client.sellerId,claimed.token,product);state.pendingItems.shift();
      }else {
        if(state.scanInFlight||state.scrollId&&state.scrollExpires<Date.now()){state.scrollId=null;state.scrollExpires=0;}
        const params=new URLSearchParams({search_type:'scan',limit:String(MELI_PAGE_SIZE)});
        if(state.scrollId)params.set('scroll_id',state.scrollId);
        // Provider scrolls are stateful. Persist intent before advancing it; if
        // a crash loses the response, restart the scan rather than skip a page.
        state.scanInFlight=true;
        await checkpoint(state);
        let value:unknown;
        try {value=await client.get(`/users/${client.sellerId}/items/search?${params}`);}
        catch(error) {
          if(state.scrollId&&safeError(error).code==='mercadolibre_invalid_api_request'){state.scrollId=null;state.scrollExpires=0;state.scanInFlight=false;await checkpoint(state);continue;}
          throw error;
        }
        const page=meliRecord(value);
        state.scanInFlight=false;
        if(value===null||page.results===null||Array.isArray(page.results)&&!page.results.length)state.phase='done';
        else {
          if(!Array.isArray(page.results)||typeof page.scroll_id!=='string'||!page.scroll_id)throw new MeliError('mercadolibre_invalid_api_response');
          state.pendingItems=page.results.map(meliItemId);state.scrollId=page.scroll_id;state.scrollExpires=Date.now()+4*60*1000;
        }
      }
      await checkpoint(state);
    }
    state.retryAt=0;
    await checkpoint(state);
    if(state.phase==='done')for(const id of await meliOrdersMissingCosts(userId)) {
      if(Date.now()>=client.deadline-1500)break;
      await importOrder(client,claimed.token,id,cache,true);
    }
    const counts=await meliCounts(userId);
    if(state.phase==='done') {await completeMeliImport(userId,client.sellerId,claimed.token);await markSyncCompleted(userId,'mercadolibre',counts.orders,counts.products,MELI_IMPORT_VERSION,state.through);}
    else await markSyncPending(userId,'mercadolibre',counts.orders,counts.products);
    return {busy:false,pending:state.phase!=='done'||counts.pendingEvents>0,...counts};
  }catch(error) {
    const safe=safeError(error);
    if(safe.code!=='mercadolibre_batch_yield')console.warn('[mercadolibre-sync] paused',{category:safe.code,phase:state?.phase??'uninitialized'});
    if(state) {
      state.retryAt=safe.code==='mercadolibre_batch_yield'?0:Date.now()+safe.retrySeconds*1000;
      await checkpoint(state);
    }
    const counts=await meliCounts(userId);
    if(safe.code==='mercadolibre_batch_yield')await markSyncPending(userId,'mercadolibre',counts.orders,counts.products);
    else await markSyncFailed(userId,'mercadolibre',safe.code);
    return {busy:false,pending:true,error:safe.code,retryAt:state?.retryAt||0,...counts};
  }finally {await releaseImportJob(userId,'mercadolibre',claimed.token);}
}

export async function getMeliSyncView(userId:string) {
  const [integrations,status,progress,counts]=await Promise.all([getIntegrations(userId),getSyncStatus(userId,'mercadolibre'),getMeliProgress(userId),meliCounts(userId)]);
  const connection=integrations.results.find(row=>row.provider==='mercadolibre'&&row.status!=='disconnected');
  let state:MeliProgress|null=null;
  try {if(progress&&connection)state=readMeliProgress(progress.state_json,String(connection.external_store_id));}catch{/* Surface a recoverable error, never the raw state or encrypted tokens. */}
  const missingConfig=mercadoLibreMissingConfig();
  return {available:missingConfig.length===0,missingConfig,connection:connection?{status:connection.status,sellerId:connection.external_store_id}:null,phase:state?.phase||null,pending:!!connection&&(state?.phase!=='done'||counts.pendingEvents>0),retryAt:state?.retryAt||0,leaseExpiresAt:progress?.lease_expires_at||0,batchUpdatedAt:progress?.updated_at||null,status,historyMonths:IMPORT_HISTORY_MONTHS,...counts};
}

// Request-lifetime background work only. A durable scheduled invocation of the
// existing authenticated reconciliation route is still needed when nobody is
// using the panel or when provider delivery/Worker execution fails.
export async function runMeliBackground(userId:string) {
  try {await reconcileMercadoLibre(userId);}catch{await markSyncFailed(userId,'mercadolibre','mercadolibre_background_pending');}
}
