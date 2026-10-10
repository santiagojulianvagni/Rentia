// Offline integration checks: real SQL migrations + synthetic API fixtures.
// No live network, real credentials, customer stores, or persistent test data.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const ts=require('typescript');
const {createPostgres}=require('./lib/harness.cjs');
let sql;
const now=new Date().toISOString();
const env={MELI_APP_ID:'12345',MELI_APP_SECRET:'synthetic-secret',TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64'),RENTIA_PUBLIC_ORIGIN:'https://rentia.example.invalid'};
let user={id:'fixture-store',role:'owner'};
class NextResponse extends Response {static json(value,init={}){return new NextResponse(JSON.stringify(value),{...init,headers:{'content-type':'application/json',...init.headers}});}}
const loaded=new Map(),lifetimePromises=[];
function load(filename){
  const absolute=path.resolve(filename);if(loaded.has(absolute))return loaded.get(absolute).exports;
  const module={exports:{}};loaded.set(absolute,module);
  const requireLocal=specifier=>{
    if(specifier==='next/server')return {NextResponse,after:promise=>lifetimePromises.push(promise)};
    if(!specifier.startsWith('.'))return require(specifier);
    const resolved=path.resolve(path.dirname(absolute),specifier)+'.ts';
    if(resolved===path.resolve('lib/env.ts'))return {env};
    if(resolved===path.resolve('lib/session.ts'))return {getRentiaUser:async()=>user,canManageRentia:value=>['owner','admin'].includes(value.role)};
    return load(resolved);
  };
  const js=ts.transpileModule(fs.readFileSync(absolute,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInThisContext(`(function(require,module,exports){${js}\n})`,{filename:absolute})(requireLocal,module,module.exports);return module.exports;
}
const db=load('db/mercadolibre.ts'),database=load('db/database.ts'),data=load('lib/mercadolibre-data.ts'),sync=load('lib/mercadolibre-sync.ts'),cryptoHelper=load('lib/token-crypto.ts'),cost=load('lib/cost-engine.ts'),summary=load('lib/order-summary.ts'),route=load('app/api/sync/mercadolibre/route.ts'),presentation=load('lib/mercadolibre-status.ts');
let refreshes=0,access='fixture-access-0',refresh='fixture-refresh-0',rateLimit=false,productScanExpired=false,scanRestarts=0;
let shipmentFixture='modern';
const requests=[];
const claimFixtures=new Map();
let claimsPartialResponse=false;
const fixtureDate='2026-10-01T00:00:00.000Z';
const orders=Array.from({length:1205},(_,index)=>({id:10001+index,seller:{id:999},currency_id:'ARS',status:'paid',date_created:new Date(Date.parse(fixtureDate)+index*1000).toISOString(),date_last_updated:new Date(Date.parse(fixtureDate)+index*1000).toISOString(),total_amount:index===0?2000:1000,shipping:index<2?{id:1}:null,order_items:[{item:{id:'MLA100000',title:'Synthetic only',seller_sku:'FIXTURE-SKU'},quantity:index===0?2:1,unit_price:1000,sale_fee:100}],payments:[{status:'approved',payment_type:'credit_card',installments:1}]}));
const products=Array.from({length:1002},(_,index)=>({id:`MLA${100000+index}`,seller_id:999,title:`Fixture ${index}`,status:'active',price:1000,available_quantity:10,date_created:fixtureDate,last_updated:fixtureDate,attributes:[{id:'SELLER_SKU',value_name:`FIXTURE-${index}`}]}));
const originalFetch=global.fetch;
global.fetch=async(input,options)=>{
  const url=new URL(String(input));assert.equal(url.origin,'https://api.mercadolibre.com');assert.equal(options.redirect,'manual');requests.push(url.pathname+url.search);
  if(url.pathname==='/oauth/token'){
    assert.equal(options.method,'POST');assert.equal(options.body.get('grant_type'),'refresh_token');assert.equal(options.body.get('refresh_token'),refresh);refreshes++;
    access=`fixture-access-${refreshes}`;refresh=`fixture-refresh-${refreshes}`;
    return Response.json({access_token:access,refresh_token:refresh,user_id:999,expires_in:21600});
  }
  assert.equal(options.headers.authorization,`Bearer ${access}`);
  if(rateLimit&&/^\/orders\/\d+$/.test(url.pathname)){rateLimit=false;return Response.json({error:access},{status:429,headers:{'retry-after':'90'}});}
  if(url.pathname==='/post-purchase/v1/claims/search'){
    assert.equal(url.searchParams.get('players.user_id'),'999');assert.equal(url.searchParams.get('players.role'),'respondent');
    if(claimsPartialResponse)return Response.json({paging:{total:0},data:[]},{status:206});
    const rows=claimFixtures.get(url.searchParams.get('order_id'))||[];return Response.json({paging:{total:rows.length},data:rows});
  }
  if(url.pathname==='/post-purchase/v1/claims/55')return Response.json((claimFixtures.get('10003')||[])[0]);
  if(url.pathname==='/orders/search'){
    const offset=Number(url.searchParams.get('offset'));assert.ok(offset<900,'window splitting must prevent deep offsets');
    const field=url.searchParams.has('order.date_created.from')?'order.date_created':'order.date_last_updated';
    const from=Date.parse(url.searchParams.get(`${field}.from`)),to=Date.parse(url.searchParams.get(`${field}.to`));
    const source=orders.filter(order=>{const value=Date.parse(order[field==='order.date_created'?'date_created':'date_last_updated']);return value>=from&&value<=to&&(url.searchParams.get('order.status')==='cancelled'?order.status==='cancelled':true);});
    return Response.json({paging:{total:source.length,offset,limit:50},results:source.slice(offset,offset+50).map(order=>({id:order.id}))});
  }
  if(/^\/orders\/\d+$/.test(url.pathname)){
    const id=Number(url.pathname.split('/')[2]);return Response.json(orders.find(order=>order.id===id)||{...orders[0],id,seller:{id:555}});
  }
  // Modern associated-orders shape from the official docs. Deliberately no
  // sender_id shortcut: ownership must not depend on a usable cost allocation.
  if(url.pathname==='/shipments/1')return Response.json({id:1,status:'delivered'});
  if(url.pathname==='/shipments/1/costs'){assert.equal(options.headers['x-format-new'],'true');return Response.json({receiver:{cost:999999},senders:shipmentFixture==='cost_missing'?[]:[{user_id:shipmentFixture==='foreign'?555:999,cost:12.01}]});}
  if(url.pathname==='/shipments/1/orders'){
    assert.equal(options.headers['X-New-Domain'],'true');
    return Response.json([{order_id:'10001',seller_id:shipmentFixture==='foreign'?555:999,...(shipmentFixture==='quantity_missing'?{}:{requested_quantity:2})},{order_id:'10002',seller_id:shipmentFixture==='foreign'?555:999,...(shipmentFixture==='quantity_missing'?{}:{requested_quantity:1})}]);
  }
  if(url.pathname==='/users/999/items/search'){
    assert.equal(url.searchParams.get('search_type'),'scan');const cursor=url.searchParams.get('scroll_id');
    if(productScanExpired&&cursor){productScanExpired=false;return Response.json({error:'expired'},{status:400});}
    if(!cursor)scanRestarts++;
    const offset=cursor?Number(cursor.split('-')[1]):0;
    return Response.json({results:products.slice(offset,offset+50).map(item=>item.id),scroll_id:`fixture-${offset+50}`});
  }
  if(/^\/items\/[A-Z]{3}\d+$/.test(url.pathname))return Response.json(products.find(item=>item.id===url.pathname.split('/')[2]));
  throw new Error(`Unexpected fixture route ${url.pathname}`);
};
async function state(){return JSON.parse((await sql.get("SELECT state_json FROM sync_jobs WHERE user_id='fixture-store' AND provider='mercadolibre'")).state_json);}
async function replaceState(value){await sql.run("UPDATE sync_jobs SET state_json=? WHERE user_id='fixture-store' AND provider='mercadolibre'",JSON.stringify(value));}
async function drain(limit=400){for(let index=0;index<limit;index++){const result=await sync.reconcileMercadoLibre('fixture-store');assert.ok(!result.error,result.error);if(!result.pending)return;const progress=(await state());if(progress.phase==='products'&&progress.scrollId&&!productScanExpired&&scanRestarts===1)productScanExpired=true;}throw new Error('Fixture import did not finish');}
async function main(){
  sql=await createPostgres();load('db/client.ts').setDatabase(sql.driver);
  for(const id of ['fixture-store','other-store'])await sql.run('INSERT INTO accounts(user_id,email,owner_name,store_name,trial_started_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',id,`${id}@example.invalid`,'Fixture','Test only',now,now,now);
  const encrypted=await cryptoHelper.encryptToken(JSON.stringify({version:1,accessToken:access,refreshToken:refresh,expiresAt:Date.now()-1,sellerId:'999'}),env.TOKEN_ENCRYPTION_KEY);
  assert.equal(await db.saveMercadoLibreConnection({userId:'fixture-store',sellerId:'999',encryptedToken:encrypted.encryptedToken,iv:encrypted.iv,scopes:'read offline_access'}),true);
  const allocations=data.allocateMeliShipment({senders:[{user_id:999,cost:12.01}]},[{order_id:1,seller_id:999,quantity:2},{order_id:2,seller_id:999,quantity:1}],'999');
  assert.equal(allocations.get('1'),8.01);assert.equal(allocations.get('2'),4);assert.equal(data.normalizeMeliOrder(orders[0],'999',null,null).commissionCost,200);
  const modernRows=[{order_id:'1',seller_id:999,requested_quantity:2},{order_id:'2',seller_id:999,requested_quantity:1},{order_id:'3',seller_id:555,requested_quantity:5}];
  assert.deepEqual([...data.meliShipmentOrderIds(modernRows,'999')],['1','2']);
  assert.deepEqual([...data.allocateMeliShipment({senders:[{user_id:999,cost:12.01}]},modernRows,'999')],[['1',8.01],['2',4]]);
  for(const invalid of [undefined,null,0,-1,1.5,'bad'])assert.equal(data.allocateMeliShipment({senders:[{user_id:999,cost:12.01}]},[{order_id:'1',seller_id:999,requested_quantity:invalid}],'999'),null);
  assert.equal(data.allocateMeliShipment({senders:[{user_id:999,cost:12.01}]},[{order_id:'1',seller_id:999,requested_quantity:2,quantity:3}],'999'),null);
  assert.equal(data.allocateMeliShipment({receiver:{cost:999999},senders:[]},modernRows,'999'),null);
  assert.equal(data.meliShipmentOrderIds([{order_id:'1',requested_quantity:2}],'999'),null);
  assert.equal(data.meliShipmentOrderIds([{order_id:'1',seller_id:555,requested_quantity:2}],'999').size,0);
  assert.throws(()=>data.normalizeMeliOrder({...orders[0],seller:{id:555}},'999',null,null),/resource_owner/);
  assert.equal(data.normalizeMeliOrder({...orders[0],status:'partially_refunded'},'999',null,null).paymentStatus,'partially_refunded');
  const pair=await Promise.all([sync.reconcileMercadoLibre('fixture-store'),sync.reconcileMercadoLibre('fixture-store')]);
  assert.equal(pair.filter(result=>result.busy).length,1);assert.equal(refreshes,1);
  // A lost request keeps its checkpoint. An active lease prevents duplicate
  // work; expiry permits automatic recovery, while the old writer is fenced.
  const lostBatch=await database.claimImportJob('fixture-store','mercadolibre','{}',60_000);
  const beforeRecovery=(await state());
  await database.checkpointImportJob('fixture-store','mercadolibre',lostBatch.token,JSON.stringify(beforeRecovery),false,60_000);
  const held=await db.getMeliProgress('fixture-store');
  assert.ok(held.lease_expires_at>Date.now()+55_000&&held.lease_expires_at<=Date.now()+60_000);
  const heldView=await sync.getMeliSyncView('fixture-store');
  assert.equal(presentation.meliAutoSyncDue(heldView,true),false);
  assert.equal((await sync.reconcileMercadoLibre('fixture-store')).busy,true);
  assert.deepEqual((await state()),beforeRecovery);
  assert.equal(presentation.meliSyncAction(heldView,false,true).label,'Importando…');
  assert.deepEqual(presentation.meliSyncAction(heldView,false,true),presentation.meliSyncAction(heldView,true,true),'batch boundaries must not toggle the label, style state or disabled state');
  assert.match(presentation.meliSyncMessage({...heldView,orders:1} ),/1 orden guardada\./);
  const expiry=held.lease_expires_at;
  assert.equal(presentation.meliAutoSyncDue(heldView,true,expiry+1),true);
  assert.equal(presentation.meliAutoSyncDue(heldView,false,expiry+1),false);
  assert.equal(presentation.meliAutoSyncDue({...heldView,retryAt:expiry+60000},true,expiry+1),false);
  assert.equal(presentation.meliSyncAction({...heldView,retryAt:expiry+60000},false,true,expiry+1).badge,'En pausa');
  assert.match(presentation.meliSyncMessage({...heldView,batchUpdatedAt:new Date(Date.now()-120000).toISOString()}),/Esperando que se libere el lote anterior/);
  await sql.run("UPDATE sync_jobs SET lease_expires_at=? WHERE user_id='fixture-store' AND provider='mercadolibre'",Date.now()-1);
  const recovered=await sync.reconcileMercadoLibre('fixture-store');assert.ok(!recovered.busy&&!recovered.error);
  await assert.rejects(()=>database.checkpointImportJob('fixture-store','mercadolibre',lostBatch.token,JSON.stringify(beforeRecovery),false,60_000));
  assert.equal(await db.saveMeliOrder('fixture-store','999',lostBatch.token,data.normalizeMeliOrder({...orders[0],id:99997},'999',0,null)),false);
  const otherLease=await database.claimImportJob('fixture-store','tiendanube','{}');
  assert.ok((await sql.get("SELECT lease_expires_at FROM sync_jobs WHERE provider='tiendanube'")).lease_expires_at>Date.now()+590000,'other providers retain their lease budget');
  await database.releaseImportJob('fixture-store','tiendanube',otherLease.token);
  rateLimit=true;
  const failed=await sync.reconcileMercadoLibre('fixture-store');assert.equal(failed.error,'mercadolibre_rate_limit');assert.ok(failed.retryAt>=Date.now()+85000);assert.ok(!JSON.stringify(failed).includes(access));
  const retry=(await state()),pendingBefore=retry.pendingOrders.length;assert.ok(pendingBefore>0);
  const paused=await sync.reconcileMercadoLibre('fixture-store');assert.equal(paused.retryAt,failed.retryAt);assert.equal((await state()).pendingOrders.length,pendingBefore);
  retry.retryAt=0;await replaceState(retry);await drain();
  const counts=await db.meliCounts('fixture-store');assert.equal(counts.orders,1205);assert.equal(counts.products,1002);assert.ok(scanRestarts>=2);
  assert.equal((await sql.get("SELECT status FROM integrations WHERE user_id='fixture-store'")).status,'connected');
  const first=(await sql.get("SELECT * FROM orders WHERE external_order_id='10001'")),second=(await sql.get("SELECT * FROM orders WHERE external_order_id='10002'"));
  assert.equal(first.source_shipping_cost+second.source_shipping_cost,12.01);assert.equal(first.source_commission_cost,200);
  assert.equal((await sql.get("SELECT source_shipping_cost FROM orders WHERE external_order_id='10003'")).source_shipping_cost,null);
  const imported=(await sql.get("SELECT * FROM integrations WHERE user_id='fixture-store'"));
  const stored=JSON.parse(await cryptoHelper.decryptToken(imported.encrypted_access_token,imported.token_iv,env.TOKEN_ENCRYPTION_KEY));assert.equal(stored.refreshToken,refresh);assert.ok(!imported.encrypted_access_token.includes(refresh));
  assert.equal(await db.saveMercadoLibreConnection({userId:'other-store',sellerId:'999',encryptedToken:'fixture',iv:'fixture',scopes:'read'}),false);
  assert.equal((await db.meliCounts('other-store')).orders,0);
  const previous=await db.getMeliCredentials('fixture-store');
  const replacement=await cryptoHelper.encryptToken(JSON.stringify(stored),env.TOKEN_ENCRYPTION_KEY);
  assert.equal(await db.replaceMeliCredentials(previous,replacement.encryptedToken,replacement.iv),true);
  assert.equal(await db.replaceMeliCredentials(previous,'must-not-save','must-not-save'),false);
  await db.requireMeliReauthorization(previous);
  assert.equal((await db.getMeliCredentials('fixture-store')).status,'connected');
  // Simulate losing a scroll response after the provider advanced its cursor.
  const lost=(await state());lost.phase='products';lost.pendingItems=[];lost.scrollId='fixture-500';lost.scrollExpires=Date.now()+60000;lost.scanInFlight=true;await replaceState(lost);
  const starts=scanRestarts;await drain();assert.ok(scanRestarts>starts);assert.equal((await db.meliCounts('fixture-store')).products,1002);
  // Duplicate delivery, forged ownership, stale order versions, lost leases.
  const notice={id:'fixture-notice',topic:'orders_v2',resource:'/orders/10001',sellerId:'999',applicationId:'12345',sent:now};
  await db.enqueueMercadoLibreNotice(notice);await db.enqueueMercadoLibreNotice(notice);
  assert.equal((await db.meliCounts('fixture-store')).pendingEvents,1);
  orders[0]={...orders[0],status:'cancelled',date_last_updated:'2026-10-04T00:00:00.000Z'};
  await sync.reconcileMercadoLibre('fixture-store');
  assert.equal((await sql.get("SELECT payment_status FROM orders WHERE external_order_id='10001'")).payment_status,'cancelled');
  await db.enqueueMercadoLibreNotice({...notice,id:'shared-shipment',topic:'shipments',resource:'/shipments/1'});
  await sync.reconcileMercadoLibre('fixture-store');
  assert.equal((await sql.get("SELECT count(*) AS total FROM webhook_events WHERE event_key LIKE 'mercadolibre:shipment:%'")).total,2);
  assert.equal((await db.meliCounts('fixture-store')).pendingEvents,0);
  await db.enqueueMercadoLibreNotice({...notice,id:'forged',resource:'/orders/99999'});await sync.reconcileMercadoLibre('fixture-store');
  assert.equal((await sql.get("SELECT status FROM webhook_events WHERE resource_id='/orders/99999'")).status,'ignored');
  assert.equal((await sql.get("SELECT count(*) AS total FROM orders WHERE external_order_id='99999'")).total,0);
  for(const mode of ['quantity_missing','cost_missing','foreign']) {
    shipmentFixture=mode;
    await db.enqueueMercadoLibreNotice({...notice,id:`shipping-${mode}`});
    const result=await sync.reconcileMercadoLibre('fixture-store');assert.ok(!result.error,result.error);
    const row=(await sql.get("SELECT source_shipping_cost,shipping_status FROM orders WHERE external_order_id='10001'"));
    assert.equal(row.source_shipping_cost,null,'unverifiable costs must not become zero or buyer charges');
    assert.equal(row.shipping_status,mode==='foreign'?null:'delivered');
    assert.equal((await sql.get("SELECT status FROM webhook_events WHERE event_key=?",`mercadolibre:999:orders_v2:shipping-${mode}`)).status,'processed','a verified order must not stall on optional shipping');
  }
  await db.enqueueMercadoLibreNotice({...notice,id:'foreign-shipment',topic:'shipments',resource:'/shipments/1'});
  await sync.reconcileMercadoLibre('fixture-store');
  assert.equal((await sql.get("SELECT status FROM webhook_events WHERE event_key='mercadolibre:999:shipments:foreign-shipment'")).status,'ignored');
  shipmentFixture='modern';await db.enqueueMercadoLibreNotice({...notice,id:'shipping-restored'});await sync.reconcileMercadoLibre('fixture-store');
  assert.equal((await sql.get("SELECT source_shipping_cost FROM orders WHERE external_order_id='10001'")).source_shipping_cost,8.01);
  const lease=await database.claimImportJob('fixture-store','mercadolibre','{}');
  const staleOrder=data.normalizeMeliOrder({...orders[0],status:'paid',date_last_updated:fixtureDate},'999',0,null);
  await db.saveMeliOrder('fixture-store','999',lease.token,staleOrder);
  assert.equal((await sql.get("SELECT payment_status FROM orders WHERE external_order_id='10001'")).payment_status,'cancelled');
  await sql.run("UPDATE product_variants SET manual_cost=77 WHERE external_variant_id='MLA100000'");
  await db.saveMeliProduct('fixture-store','999',lease.token,data.normalizeMeliProduct(products[0],'999'));
  assert.equal((await sql.get("SELECT manual_cost FROM product_variants WHERE external_variant_id='MLA100000'")).manual_cost,77);
  await database.releaseImportJob('fixture-store','mercadolibre',lease.token);
  assert.equal(await db.saveMeliOrder('fixture-store','999',lease.token,data.normalizeMeliOrder({...orders[0],id:99998},'999',0,null)),false);
  assert.equal((await sql.get("SELECT count(*) AS total FROM order_items WHERE external_order_id='99998'")).total,0);
  const settings={shipping_mode:'average_only',shipping_cost_ars:999,commission_percent:20,tax_percent:0};
  const known=cost.calculateOrderCosts({provider:'mercadolibre',total:1000,source_shipping_cost:5,source_commission_cost:100,source_created_at:fixtureDate},settings,[]);assert.equal(known.shipping,5);assert.match(known.commissionSource,/Mercado Libre/);
  const unknown=cost.calculateOrderCosts({provider:'mercadolibre',total:1000,source_shipping_cost:null,source_commission_cost:null,source_created_at:fixtureDate},settings,[]);assert.equal(unknown.shippingSource,'pendiente');assert.equal(unknown.commissionSource,'Mercado Libre · cargo pendiente');
  async function* source(){yield {provider:'mercadolibre',external_order_id:'fixture',source_created_at:fixtureDate,payment_status:'paid',status:'paid',total:1000,product_cost:10,item_count:1,missing_product_costs:0,source_shipping_cost:null,source_commission_cost:null};}
  const quality=await summary.summarizeOrders(source(),settings,[],30,{orders:1,revenue:1000},true,new Date());assert.equal(quality.quality.completeOrders,0);assert.equal(quality.quality.coveredProfit,0);
  const sales=load('lib/sales-channels.ts');
  const mixed=[
    {provider:'tiendanube',external_order_id:'same-id',source_created_at:fixtureDate,payment_status:'paid',status:'open',total:1000,product_cost:200,item_count:1,missing_product_costs:0,source_shipping_cost:50,source_commission_cost:100},
    {provider:'mercadolibre',external_order_id:'same-id',source_created_at:fixtureDate,payment_status:'paid',status:'paid',total:2000,product_cost:400,item_count:1,missing_product_costs:0,source_shipping_cost:70,source_commission_cost:150},
    {provider:'mercadolibre',external_order_id:'refund',source_created_at:fixtureDate,payment_status:'refunded',status:'paid',total:500,product_cost:100,item_count:1,missing_product_costs:0,source_shipping_cost:20,source_commission_cost:30},
    {provider:'tiendanube',external_order_id:'cancel',source_created_at:fixtureDate,payment_status:'paid',status:'cancelled',total:900,item_count:1,missing_product_costs:0},
  ];
  async function* mixedSource(){yield* mixed;}
  const mixedSummary=await summary.summarizeOrders(mixedSource(),{...settings,shipping_mode:'actual'},[],30,{orders:2,revenue:3000},true,new Date());
  const mixedChannels=sales.salesChannels(mixedSummary.channels,[]),tn=mixedChannels.find(row=>row.provider==='tiendanube'),ml=mixedChannels.find(row=>row.provider==='mercadolibre');
  assert.equal(tn.orders,1);assert.equal(tn.revenue,1000);assert.equal(tn.netRevenue,850);assert.equal(tn.profit,650);
  assert.equal(ml.orders,1);assert.equal(ml.revenue,2000);assert.equal(ml.netRevenue,1780);assert.equal(ml.profit,1380);
  assert.equal(mixedSummary.totals.orders,2);assert.equal(mixedSummary.totals.revenue,tn.revenue+ml.revenue);
  async function* partialSource(){yield mixed[1];yield {...mixed[1],external_order_id:'missing-product-cost',product_cost:0,missing_product_costs:1};}
  const partial=await summary.summarizeOrders(partialSource(),settings,[],30,{orders:2,revenue:4000},true,new Date());
  const partialChannel=sales.salesChannels(partial.channels,[])[0];
  assert.equal(partialChannel.profit,1380,'confirmed profit survives an incomplete order, never includes its provisional margin');
  assert.equal(partialChannel.completeOrders,1);assert.equal(partialChannel.pendingOrders,1);assert.equal(partialChannel.costCoverage,false);
  assert.equal(sales.salesChannels(quality.channels,[])[0].profit,null,'unknown marketplace costs must not look complete');
  assert.equal(sales.salesChannels([],[{provider:'mercadolibre',status:'connected'}])[0].orders,0,'connected empty channels have zero metrics, not a connect placeholder');
  assert.equal(sales.salesChannels([],[{provider:'mercadolibre',status:'disconnected'}]).length,0);
  assert.equal(sales.salesChannelLabel('mercadolibre'),'Mercado Libre');assert.equal(sales.salesChannelLabel('unknown'),'Otro canal');
  assert.equal(sales.orderReturnNeedsReview(mixed[2]),true);assert.equal(sales.orderReturnNeedsReview(mixed[0]),false);
  const panelSource=fs.readFileSync('app/panel/page.tsx','utf8');
  assert.ok(panelSource.includes("if(!canManage||order.provider!=='tiendanube')return;"));
  assert.ok(!panelSource.includes('<b>Tiendanube</b><small>{date(order.source_created_at)}'));
  assert.ok(!panelSource.includes('<small>Tiendanube</small></span><b>{money(order.total'));
  const dashboardRoute=load('app/api/dashboard/route.ts');
  const dashboardBody=await (await dashboardRoute.GET(new Request(`${env.RENTIA_PUBLIC_ORIGIN}/api/dashboard?start=2026-10-01&end=2026-10-02`))).json();
  assert.ok(dashboardBody.channels.some(row=>row.provider==='mercadolibre'),'real dashboard route exposes imported marketplace sales');
  assert.ok(!dashboardBody.channels.some(row=>row.provider==='tiendanube'),'no fake Tiendanube channel for a marketplace-only store');
  assert.equal(dashboardBody.channels.find(row=>row.provider==='mercadolibre').revenue,dashboardBody.metrics.revenue);
  const archiveRoute=load('app/api/products/archive/route.ts');
  const product=(await sql.get("SELECT id FROM products WHERE user_id='fixture-store' LIMIT 1"));
  const archiveRequest=(body,origin=env.RENTIA_PUBLIC_ORIGIN)=>new Request(`${env.RENTIA_PUBLIC_ORIGIN}/api/products/archive`,{method:'PATCH',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
  const archiveBody={productId:product.id,archived:true,confirmation:'ARCHIVAR'};
  const beforeArchive=await (await dashboardRoute.GET(new Request(`${env.RENTIA_PUBLIC_ORIGIN}/api/dashboard?start=2026-10-01&end=2026-10-02`))).json();
  user.role='member';assert.equal((await archiveRoute.PATCH(archiveRequest(archiveBody))).status,403);
  user.role='owner';assert.equal((await archiveRoute.PATCH(archiveRequest(archiveBody,'https://evil.invalid'))).status,403);
  assert.equal((await archiveRoute.PATCH(archiveRequest({...archiveBody,confirmation:''}))).status,400);
  user.id='other-store';assert.equal((await archiveRoute.PATCH(archiveRequest(archiveBody))).status,404);user.id='fixture-store';
  assert.equal((await archiveRoute.PATCH(archiveRequest(archiveBody))).status,200);
  assert.equal((await database.getProductCostRows(user.id)).results.find(row=>row.product_id===product.id).rentia_archived,1);
  const afterArchive=await (await dashboardRoute.GET(new Request(`${env.RENTIA_PUBLIC_ORIGIN}/api/dashboard?start=2026-10-01&end=2026-10-02`))).json();
  assert.deepEqual(afterArchive.metrics,beforeArchive.metrics,'archive never removes sales or waives missing historical costs');
  assert.deepEqual(afterArchive.quality,beforeArchive.quality);
  await database.upsertProducts(user.id,'mercadolibre',[{externalId:'MLA100000',name:'Updated fixture',imageUrl:null,published:true,createdAt:null,updatedAt:null,variants:[]}]);
  assert.equal((await sql.get('SELECT rentia_archived FROM products WHERE id=?',product.id)).rentia_archived,1,'provider refresh cannot undo local archive');
  assert.equal((await archiveRoute.PATCH(archiveRequest({...archiveBody,archived:false,confirmation:'RESTAURAR'}))).status,200);
  assert.equal((await sql.get('SELECT rentia_archived FROM products WHERE id=?',product.id)).rentia_archived,0);
  user.role='member';assert.equal((await route.POST(new Request(`${env.RENTIA_PUBLIC_ORIGIN}/api/sync/mercadolibre`,{method:'POST',headers:{origin:env.RENTIA_PUBLIC_ORIGIN}}))).status,403);
  user.role='owner';assert.equal((await route.POST(new Request(`${env.RENTIA_PUBLIC_ORIGIN}/api/sync/mercadolibre`,{method:'POST',headers:{origin:'https://evil.invalid'}}))).status,403);
  assert.equal(lifetimePromises.length,0,'rejected requests must not schedule imports');
  const synced=await route.POST(new Request(`${env.RENTIA_PUBLIC_ORIGIN}/api/sync/mercadolibre`,{method:'POST',headers:{origin:env.RENTIA_PUBLIC_ORIGIN}}));
  assert.equal(synced.status,200);assert.equal(lifetimePromises.length,1);await lifetimePromises[0];
  const view=await (await route.GET(new Request(env.RENTIA_PUBLIC_ORIGIN+'/api/sync/mercadolibre'))).json();assert.equal(view.orders,1205);assert.ok(!JSON.stringify(view).includes(access));assert.ok(!JSON.stringify(view).includes(refresh));assert.ok(!JSON.stringify(view).includes('state_json'));
  assert.equal(view.leaseExpiresAt,0);assert.ok(!JSON.stringify(view).includes('lease_token'));
  await postSaleChecks(settings,mixedSummary,dashboardBody);
  const expiredTokens=await cryptoHelper.encryptToken(JSON.stringify({...stored,expiresAt:Date.now()-1}),env.TOKEN_ENCRYPTION_KEY);
  await db.replaceMeliCredentials(await db.getMeliCredentials('fixture-store'),expiredTokens.encryptedToken,expiredTokens.iv);
  await db.enqueueMercadoLibreNotice({...notice,id:'ambiguous-refresh'});
  const fixtureFetch=global.fetch;
  global.fetch=async(input,options)=>{if(new URL(String(input)).pathname==='/oauth/token')throw new Error('fixture ambiguous timeout');return fixtureFetch(input,options);};
  const ambiguous=await sync.reconcileMercadoLibre('fixture-store');assert.equal(ambiguous.error,'mercadolibre_reauthorize');
  assert.equal((await sql.get("SELECT status FROM integrations WHERE user_id='fixture-store'")).status,'reauthorization_required');
  assert.equal(await db.saveMercadoLibreConnection({userId:'other-store',sellerId:'999',encryptedToken:'fixture',iv:'fixture',scopes:'read'}),false);
  global.fetch=fixtureFetch;
  env.MELI_APP_SECRET='';assert.equal((await route.POST(new Request(`${env.RENTIA_PUBLIC_ORIGIN}/api/sync/mercadolibre`,{method:'POST'}))).status,503);
  console.log('PASS: 1,205 orders/day + 1,002 products, resumable windows/scan, serialized refresh, durable queue/deduplication, 429 recovery, modern/legacy shipment quantities, independent ownership, missing/foreign shipping stays NULL without blocking verified orders, shared-shipment cents, stale writes, lease fencing, manual costs, missing-cost quality, role/CSRF and secret isolation. Offline fixtures only.');
}
async function postSaleChecks(settings,mixedSummary,dashboardBody) {
  const post=load('lib/meli-post-sale.ts'),costRoute=load('app/api/orders/item-cost/route.ts'),reviewRoute=load('app/api/orders/mercadolibre-review/route.ts');
  const body=(pathname,value,origin=env.RENTIA_PUBLIC_ORIGIN)=>new Request(`${env.RENTIA_PUBLIC_ORIGIN}${pathname}`,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(value)});
  const payment={id:101,status:'approved',currency_id:'ARS',collector:{id:999},transaction_amount_refunded:100};
  const partial=post.meliPaymentFacts({...orders[2],payments:[payment,payment]},'999');assert.equal(partial.refundAmount,100);assert.equal(partial.refundStatus,'partial');
  assert.equal(post.meliPaymentFacts({...orders[2],payments:[{id:101,status:'refunded'}]},'999').refundAmount,null);
  assert.equal(post.meliPaymentFacts({...orders[2],payments:[{id:101,status:'refunded'},{id:102,status:'approved',transaction_amount_refunded:0}]},'999').refundAmount,null,'another known zero cannot complete a missing refund');
  assert.equal(post.meliPaymentFacts({...orders[2],payments:[payment,{...payment,transaction_amount_refunded:200}]},'999').refundAmount,null,'conflicting duplicate payment amounts stay unknown');
  assert.equal(post.readMeliPostSale({version:1,claims:[]}),null,'invalid stored shape is not a confirmed provider fact');
  assert.equal(post.meliPaymentFacts({...orders[2],payments:[{id:101,status:'approved',available_actions:['refund']}]},'999').refundStatus,'none');
  assert.throws(()=>post.meliPaymentFacts({...orders[2],payments:[{...payment,collector:{id:555}}]},'999'),/resource_owner/);
  assert.throws(()=>post.meliPaymentFacts({...orders[2],payments:[{...payment,currency_id:'USD'}]},'999'),/currency/);
  const openClaim={id:55,resource:'order',resource_id:10003,status:'opened',type:'mediations',stage:'claim',players:[{role:'respondent',user_id:999}],resolution:null};
  assert.equal(post.normalizeMeliClaims({paging:{total:1},data:[openClaim]},'10003','999')[0].status,'opened');
  assert.throws(()=>post.normalizeMeliClaims({paging:{total:2},data:[openClaim]},'10003','999'),/incomplete_claims/);
  assert.throws(()=>post.normalizeMeliClaims({paging:{total:1},data:[{...openClaim,players:[{role:'respondent',user_id:555}]}]},'10003','999'),/resource_owner/);
  assert.equal(post.normalizeMeliClaims({paging:{total:1},data:[{...openClaim,resource:'payment'}]},'10003','999').length,0);
  const row=(await sql.get("SELECT * FROM order_items WHERE external_order_id='10003' LIMIT 1"));
  const input={provider:'mercadolibre',orderId:'10003',lineId:row.external_line_id,cost:2500};
  user.role='member';assert.equal((await costRoute.POST(body('/api/orders/item-cost',input))).status,403);assert.equal((await reviewRoute.POST(body('/api/orders/mercadolibre-review',{orderId:'10003'}))).status,403);
  user.role='owner';assert.equal((await costRoute.POST(body('/api/orders/item-cost',input,'https://evil.invalid'))).status,403);assert.equal((await reviewRoute.POST(body('/api/orders/mercadolibre-review',{orderId:'10003'},'https://evil.invalid'))).status,403);
  user.id='other-store';assert.equal((await costRoute.POST(body('/api/orders/item-cost',input))).status,404);assert.equal((await reviewRoute.POST(body('/api/orders/mercadolibre-review',{orderId:'10003'}))).status,404);user.id='fixture-store';
  assert.equal((await costRoute.POST(body('/api/orders/item-cost',{...input,cost:-1}))).status,400);
  assert.equal((await costRoute.POST(body('/api/orders/item-cost',{...input,cost:''}))).status,400);
  assert.equal((await costRoute.POST(body('/api/orders/item-cost',input))).status,200);
  let page=await database.getOrdersPage(user.id,365,{start:'2026-10-01',end:'2026-10-02'},1,'10003');assert.equal(page.orders[0].product_cost,2500);assert.equal(page.orders[0].items[0].cost_source,'orden_manual');assert.equal(page.orders[0].missing_product_costs,0);
  claimFixtures.set('10003',[openClaim]);orders[2]={...orders[2],date_last_updated:'2026-10-06T00:00:00.000Z'};
  const reviewed=await reviewRoute.POST(body('/api/orders/mercadolibre-review',{orderId:'10003'}));assert.equal(reviewed.status,200);assert.equal((await reviewed.json()).postSale.claims[0].status,'opened');
  assert.equal((await sql.get("SELECT payment_status FROM orders WHERE external_order_id='10003'")).payment_status,'paid','an open claim must not manufacture a refund');
  page=await database.getOrdersPage(user.id,365,{start:'2026-10-01',end:'2026-10-02'},1,'10003');assert.equal(page.orders[0].product_cost,2500,'manual historical cost survives provider resync');
  async function* claimedSource(){yield {...page.orders[0],item_count:1,missing_product_costs:0,source_shipping_cost:0,meli_post_sale_json:JSON.stringify({...partial,refundStatus:'none',refundAmount:null,claims:[openClaim],claimsChecked:true})};}
  const claimed=await summary.summarizeOrders(claimedSource(),settings,[],30,{orders:1,revenue:1000},true,new Date());assert.equal(claimed.quality.postSale.openClaims,1);assert.equal(claimed.quality.completeOrders,0);assert.equal(claimed.channelTimelines.mercadolibre[0].profit,0,'open claims do not contribute confirmed profit');assert.equal(claimed.quality.dimensions.products.missing,0,'claim is not missing product cost');
  const beforePartial=(await sql.get("SELECT meli_post_sale_json FROM orders WHERE external_order_id='10003'")).meli_post_sale_json;
  claimsPartialResponse=true;assert.equal((await reviewRoute.POST(body('/api/orders/mercadolibre-review',{orderId:'10003'}))).status,502);claimsPartialResponse=false;
  assert.equal((await sql.get("SELECT meli_post_sale_json FROM orders WHERE external_order_id='10003'")).meli_post_sale_json,beforePartial,'206 cannot erase a known open claim');
  orders[2]={...orders[2],date_last_updated:'2026-10-06T01:00:00.000Z',payments:[{id:102,status:'refunded',currency_id:'ARS',collector:{id:999},transaction_amount_refunded:1000}]};claimFixtures.set('10003',[{...openClaim,status:'closed',resolution:{reason:'payment_refunded'}}]);
  const core=load('lib/mercadolibre.ts');assert.equal(core.parseMercadoLibreNotice({_id:'claims-fixture',topic:'claims',resource:'/post-purchase/v1/claims/55',user_id:999,application_id:12345,sent:now}).topic,'claims');
  await db.enqueueMercadoLibreNotice({id:'claims-fixture',topic:'claims',resource:'/post-purchase/v1/claims/55',sellerId:'999',applicationId:'12345',sent:now});
  const result=await sync.reconcileMercadoLibre(user.id);assert.ok(!result.error,result.error);
  const saved=(await sql.get("SELECT payment_status,meli_post_sale_json FROM orders WHERE external_order_id='10003'"));assert.equal(saved.payment_status,'refunded');assert.equal(JSON.parse(saved.meli_post_sale_json).refundAmount,1000);
  assert.equal((await costRoute.POST(body('/api/orders/item-cost',{...input,cost:0}))).status,200);page=await database.getOrdersPage(user.id,365,{start:'2026-10-01',end:'2026-10-02'},1,'10003');assert.equal(page.orders[0].product_cost,0);assert.equal(page.orders[0].missing_product_costs,0,'explicit zero is a known cost');
  assert.equal((await costRoute.POST(body('/api/orders/item-cost',{...input,cost:null}))).status,200);
  assert.equal(mixedSummary.channelTimelines.tiendanube[0].orders,1);assert.equal(mixedSummary.channelTimelines.mercadolibre[0].orders,1);assert.equal(mixedSummary.quality.postSale.refundOrders,1);
  assert.ok(dashboardBody.channelTimelines.mercadolibre.length);assert.equal(dashboardBody.channelTimelines.tiendanube,undefined);
  console.log('PASS: claim/refund separation, exact refund amount deduplication, verified seller/order links, historical per-line cost persistence and restoration, explicit zero, channel-only timelines, member/tenant/CSRF rejection. Synthetic fixtures.');
}
async function historicalCostChecks() {
  const tenant='historical-cost-store',provider='mercadolibre',productId='MLA800000',range={start:'2026-10-01',end:'2026-10-02'};
  await sql.run('INSERT INTO accounts(user_id,email,owner_name,store_name,trial_started_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',tenant,`${tenant}@example.invalid`,'Fixture','Test only',now,now,now);
  const product=(externalId,variants)=>({externalId,name:'Identical name is not a cost match',imageUrl:null,published:true,createdAt:fixtureDate,updatedAt:fixtureDate,variants:variants.map(externalId=>({externalId,sku:'SAME-SKU',price:10000,cost:0,stock:1,stockManagement:true}))});
  const makeOrder=(externalId,pid=productId,variantId=`${pid}:retired`)=>({...data.normalizeMeliOrder(orders[0],'999',0,null),externalId,number:externalId,status:'paid',paymentStatus:'paid',createdAt:fixtureDate,updatedAt:fixtureDate,total:20000,items:[{externalLineId:'historical-line',productId:pid,variantId,name:'Identical name is not a cost match',sku:'SAME-SKU',quantity:2,unitPrice:10000,unitCost:0}]});
  await database.upsertProducts(tenant,provider,[product(productId,[productId,`${productId}:live`,`${productId}:zero`,`${productId}:unknown`]),product('MLA800001',['MLA800001'])]);
  await database.upsertProducts('other-store',provider,[product(productId,[productId]),product('MLA800002',['MLA800002'])]);
  await database.upsertProducts(tenant,'tiendanube',[product(productId,[productId])]);
  async function saveCatalog(owner,channel,variant,costValue) {
    const row=(await sql.get('SELECT id FROM product_variants WHERE user_id=? AND provider=? AND external_variant_id=?',owner,channel,variant));
    await database.saveManualProductCosts(owner,[{variantId:row.id,manualCost:costValue}]);return row.id;
  }
  const baseId=await saveCatalog(tenant,provider,productId,7000);
  await saveCatalog(tenant,provider,`${productId}:live`,3000);await saveCatalog(tenant,provider,`${productId}:zero`,0);
  await saveCatalog('other-store',provider,productId,91000);await saveCatalog('other-store',provider,'MLA800002',99000);
  await saveCatalog(tenant,'tiendanube',productId,11000);
  const historic=makeOrder('19900001');
  await database.upsertOrders(tenant,provider,[historic]);
  await sql.run('UPDATE orders SET source_commission_cost=0,source_commission_checked_at=NULL WHERE user_id=?',tenant);
  assert.deepEqual(await db.meliOrdersMissingCosts(tenant),[],'the repair queue must not repeatedly fetch an order with its inherited catalog cost');
  await database.upsertOrders(tenant,provider,[makeOrder('19900002',productId,`${productId}:live`),makeOrder('19900003',productId,`${productId}:zero`),makeOrder('19900004',productId,`${productId}:unknown`),makeOrder('19900005','MLA800001'),makeOrder('19900006','MLA800002'),makeOrder('19900007','MLA800003')]);
  await database.upsertOrders(tenant,'tiendanube',[makeOrder('19900008')]);
  const page=async id=>(await database.getOrdersPage(tenant,365,range,1,id)).orders[0];
  let row=await page(historic.externalId);
  assert.equal(row.product_cost,14000);assert.equal(row.items[0].unit_cost,7000);assert.equal(row.items[0].cost_source,'publicacion');assert.equal(row.missing_product_costs,0);
  assert.equal((await page('19900002')).product_cost,6000,'exact current variation wins');
  assert.equal((await page('19900003')).product_cost,0);assert.equal((await page('19900003')).missing_product_costs,0,'explicit current zero remains known');
  for(const id of ['19900004','19900005','19900006','19900007','19900008']) {
    row=await page(id);assert.equal(row.product_cost,0,`${id}: no cross-variation, product, tenant, or provider match`);assert.equal(row.missing_product_costs,1);
  }
  const analytics=await database.getProductAnalyticsData(tenant,365,range);let sale;
  for await(const entry of analytics.sales)if(entry.external_order_id===historic.externalId)sale=entry;
  assert.equal(sale.variant_id,baseId,'historical sales aggregate under the same catalog publication');assert.equal(sale.unit_cost,7000);
  const query=load('lib/commerce-queries.ts');
  const aggregate=(await sql.get(query.ORDER_ANALYTICS_BATCH_SQL,tenant,fixtureDate,'2026-10-03T00:00:00.000Z',historic.externalId,'','',0,5000));
  assert.equal(aggregate.product_cost,14000);assert.equal(aggregate.missing_product_costs,0,'dashboard and export agree with order detail');
  await database.saveOrderItemCost(tenant,provider,historic.externalId,'historical-line',1250);row=await page(historic.externalId);assert.equal(row.product_cost,2500);assert.equal(row.items[0].cost_source,'orden_manual');
  await database.upsertOrders(tenant,provider,[historic]);assert.equal((await page(historic.externalId)).product_cost,2500,'resync retains per-sale precedence');
  await database.saveOrderItemCost(tenant,provider,historic.externalId,'historical-line',0);row=await page(historic.externalId);assert.equal(row.product_cost,0);assert.equal(row.missing_product_costs,0);
  await database.saveOrderItemCost(tenant,provider,historic.externalId,'historical-line',null);assert.equal((await page(historic.externalId)).product_cost,14000);
  await saveCatalog(tenant,provider,productId,0);row=await page(historic.externalId);assert.equal(row.product_cost,0);assert.equal(row.missing_product_costs,0,'explicit base zero is a known inherited cost');
  await saveCatalog(tenant,provider,productId,null);row=await page(historic.externalId);assert.equal(row.product_cost,0);assert.equal(row.missing_product_costs,1,'an unknown base cost does not silence the warning');
  console.log('PASS: retired Mercado Libre variation inherits only its exact publication, all readers agree, current variants and per-sale/zero costs win, resync preserves overrides, tenant/provider/product isolation. Offline fixtures only.');
}
main().then(historicalCostChecks).catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{global.fetch=originalFetch;await sql?.close();});
