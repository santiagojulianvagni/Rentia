// Offline fixtures only. Tests real migrations on Postgres, queries and route auth.
const assert=require('node:assert/strict');
const {createPostgres,createLoader}=require('./lib/harness.cjs');
const env={MELI_APP_ID:'fixture',MELI_APP_SECRET:'fixture-secret',TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,1).toString('base64'),RENTIA_PUBLIC_ORIGIN:'https://fixture.example.invalid'};
let user={id:'fixture-store',role:'owner'};
const promises=[];
class NextResponse extends Response{static json(value,init={}){return Response.json(value,init);}}
const load=createLoader({env,session:{getRentiaUser:async()=>user,canManageRentia:value=>['owner','admin'].includes(value.role)},nextServer:{NextResponse,after:promise=>promises.push(promise)}});
const client=load('db/client.ts');
let sql;
const data=load('lib/meli-billing-data.ts'),db=load('db/meli-billing.ts'),sync=load('lib/meli-billing-sync.ts'),route=load('app/api/mercadolibre/billing/route.ts'),cryptoHelper=load('lib/token-crypto.ts');
const period=new Date().toISOString().slice(0,7)+'-01',job=data.billingJob('ML',period),now=new Date().toISOString();
const source=Array.from({length:1205},(_,i)=>({charge_info:{detail_id:i+1,transaction_detail:i===0?'Percepción IIBB':'Concepto original '+i,detail_sub_type:'CODE_'+i,detail_type:i===1?'NEW_TYPE':'CHARGE',detail_amount:1.01,creation_date_time:now,debited_from_operation:'YES',status:i===2?'BONUS_ON_CREDIT_NOTE':null},sales_info:[{order_id:1001,operation_id:5001,payer_nickname:'DO_NOT_STORE_PRIVATE_BUYER'}],currency_info:{currency_id:i===3?'USD':'ARS'},document_info:{document_id:2001},discount_info:{discount_amount:0}}));
const bonus={...source[0],charge_info:{...source[0].charge_info,detail_id:3000,detail_type:'BONUS',detail_amount:2.02,charge_bonified_id:3,transaction_detail:'Bonificación por devolución'}};
const originalFetch=global.fetch;let mode='partial',requests=0;
global.fetch=async(input,options)=>{
  const url=new URL(String(input));requests++;assert.equal(url.origin,'https://api.mercadolibre.com');assert.equal(options.redirect,'manual');assert.equal(options.headers.authorization,'Bearer fixture-access');
  assert.ok(/^\/billing\/integration\/periods\/key\/\d{4}-\d{2}-01\/group\/(ML|MP)\/details$/.test(url.pathname));
  if(url.pathname.includes('/MP/'))return Response.json({secret:'DO_NOT_EXPOSE'},{status:403});
  if(mode==='partial'){mode='rate';return Response.json({results:[]},{status:206});}
  const cursor=Number(url.searchParams.get('from_id'));assert.equal(url.searchParams.get('sort_by'),'ID');assert.equal(url.searchParams.get('limit'),'50');assert.equal(url.searchParams.get('group'),'ML');
  if(mode==='rate'&&cursor===50){mode='ok';return Response.json({secret:'DO_NOT_EXPOSE'},{status:429,headers:{'retry-after':'120'}});}
  const rows=(url.searchParams.get('document_type')==='BILL'?source:[bonus]).filter(row=>row.charge_info.detail_id>cursor).slice(0,50);
  return Response.json({results:rows,last_id:rows.at(-1)?.charge_info.detail_id||cursor,errors:[]});
};
async function progress(){return JSON.parse((await sql.get('SELECT state_json FROM sync_jobs WHERE user_id=? AND provider=?','fixture-store',job)).state_json);}
async function resume(){const p=await progress();p.retryAt=0;await sql.run('UPDATE sync_jobs SET state_json=? WHERE user_id=? AND provider=?',JSON.stringify(p),'fixture-store',job);}
async function main(){
  sql=await createPostgres();client.setDatabase(sql.driver);
  for(const id of ['fixture-store','other-store'])await sql.run('INSERT INTO accounts(user_id,email,owner_name,store_name,trial_started_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',id,id+'@example.invalid','Fixture','Test',now,now,now);
  const encrypted=await cryptoHelper.encryptToken(JSON.stringify({version:1,accessToken:'fixture-access',refreshToken:'fixture-refresh',expiresAt:Date.now()+3600000,sellerId:'999'}),env.TOKEN_ENCRYPTION_KEY);
  await sql.run("INSERT INTO integrations(user_id,provider,external_store_id,encrypted_access_token,token_iv,status,connected_at,updated_at) VALUES(?,'mercadolibre','999',?,?,'connected',?,?)",'fixture-store',encrypted.encryptedToken,encrypted.iv,now,now);
  assert.equal(data.billingCategory('Percepción IVA'),'taxes');assert.equal(data.billingCategory('Un cargo nuevo'),'other');
  assert.throws(()=>data.billingPeriod('2026-99-01'));assert.throws(()=>data.normalizeBillingEntry({...source[0],currency_info:{}},'BILL'));
  let result=await sync.reconcileMeliBilling('fixture-store','ML',period);
  assert.equal(result.error,'mercadolibre_partial_report');assert.equal((await progress()).cursor,'0');await resume();
  result=await sync.reconcileMeliBilling('fixture-store','ML',period);
  assert.equal(result.error,'mercadolibre_rate_limit');assert.equal((await progress()).cursor,'50');assert.ok(result.retryAt>Date.now()+100000);
  const pausedRequests=requests;await sync.reconcileMeliBilling('fixture-store','ML',period);assert.equal(requests,pausedRequests);await resume();
  for(let i=0;i<40&&(await progress()).document<2;i++)await sync.reconcileMeliBilling('fixture-store','ML',period);
  assert.equal((await progress()).document,2);assert.ok((await progress()).completedAt);
  let report=await db.billingReport('fixture-store','999','ML',period,1,'');
  assert.equal(report.pagination.total,1206);assert.equal(report.entries.length,100);assert.equal(report.progress.pending,false);
  assert.equal(report.totals.find(row=>row.currency==='ARS'&&row.direction==='charge').amountCents,1203*101);
  assert.equal(report.totals.find(row=>row.direction==='credit').amountCents,202);
  assert.equal(report.totals.find(row=>row.direction==='unknown').amountCents,101);
  assert.equal(report.totals.find(row=>row.currency==='USD').amountCents,101);
  assert.equal((await sql.get('SELECT COUNT(DISTINCT code) AS total FROM meli_billing_entries')).total,1205);
  assert.equal((await db.billingReport('fixture-store','999','ML',period,13,'')).entries.length,6);
  assert.equal((await db.billingReport('fixture-store','999','ML',period,1,'CODE_1120')).pagination.total,1);
  assert.equal((await db.billingReport('fixture-store','999','ML',period,1,'1001')).pagination.total,1206);
  assert.equal((await db.billingReport('other-store','999','ML',period,1,'')).pagination.total,0);
  assert.equal((await db.billingReport('fixture-store','888','ML',period,1,'')).pagination.total,0);
  assert.ok(!(await sql.get('SELECT entry_json FROM meli_billing_entries LIMIT 1')).entry_json.includes('DO_NOT_STORE'));
  const cached=requests;await sync.reconcileMeliBilling('fixture-store','ML',period,true);assert.equal(requests,cached);
  result=await sync.reconcileMeliBilling('fixture-store','MP',period);assert.equal(result.error,'mercadolibre_permission_missing');assert.ok(result.retryAt>Date.now()+11*3600000);
  const endpoint=`https://fixture.example.invalid/api/mercadolibre/billing?period=${period}`;
  assert.equal((await route.POST(new Request(endpoint,{method:'POST',headers:{origin:'https://evil.example.invalid'}}))).status,403);
  user.role='member';const before=requests;assert.equal((await route.POST(new Request(endpoint,{method:'POST',headers:{origin:env.RENTIA_PUBLIC_ORIGIN}}))).status,403);assert.equal(requests,before);
  assert.equal((await route.GET(new Request(endpoint))).status,200);
  user={id:'other-store',role:'owner'};assert.equal((await (await route.GET(new Request(endpoint))).json()).connected,false);
  user={id:'fixture-store',role:'owner'};assert.equal((await route.GET(new Request(endpoint+'&group=EVIL'))).status,400);
  assert.equal((await route.GET(new Request(endpoint+'&page=-1'))).status,400);
  assert.equal((await route.POST(new Request(endpoint,{method:'POST',headers:{origin:env.RENTIA_PUBLIC_ORIGIN}}))).status,200);assert.ok(promises.length);await Promise.all(promises);
  user=null;assert.equal((await route.GET(new Request(endpoint))).status,401);
  // A lost lease cannot silently advance a page or write provider data.
  await assert.rejects(()=>db.saveBillingPage('fixture-store','999','ML',period,'not-a-lease','bad-generation',[data.normalizeBillingEntry(source[0],'BILL')]));
  assert.equal((await db.billingReport('fixture-store','999','ML',period,1,'')).pagination.total,1206);
  const old=await progress();old.completedAt=new Date(Date.now()-600000).toISOString();await sql.run('UPDATE sync_jobs SET state_json=? WHERE user_id=? AND provider=?',JSON.stringify(old),'fixture-store',job);
  source.pop();source[0].charge_info.detail_amount=2.01;
  await sync.reconcileMeliBilling('fixture-store','ML',period,true);
  assert.equal((await db.billingReport('fixture-store','999','ML',period,1,'')).progress.pending,true);
  for(let i=0;i<40&&(await progress()).document<2;i++)await sync.reconcileMeliBilling('fixture-store','ML',period);
  report=await db.billingReport('fixture-store','999','ML',period,1,'');
  assert.equal(report.progress.pending,false);assert.equal(report.pagination.total,1205);
  assert.equal(report.totals.find(row=>row.currency==='ARS'&&row.direction==='charge').amountCents,1202*101+100);
  assert.equal((await sql.get('SELECT COUNT(*) AS total FROM meli_billing_entries')).total,1206,'old absent rows remain recoverable, not in current totals');
  console.log('Mercado Libre billing: 1206 details, 1205 dynamic codes, cursor resume, 206/429/403, credits, currencies, privacy, tenant isolation and role/origin checks passed.');
}
main().finally(async()=>{global.fetch=originalFetch;await sql?.close();}).catch(error=>{console.error(error);process.exitCode=1;});
