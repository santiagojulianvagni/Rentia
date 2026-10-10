// Isolated synthetic fixtures only. No live accounts, secrets, or network calls.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const ts=require('../node_modules/typescript');
const {createPostgres}=require('./lib/harness.cjs');
const now=new Date().toISOString();
let sql;
const env={MELI_APP_ID:'12345',MELI_APP_SECRET:'synthetic-not-a-real-secret',TOKEN_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64'),RENTIA_PUBLIC_ORIGIN:'https://rentia.example.invalid'};
let user={id:'test-store',clerkUserId:'test-actor',role:'owner'};
let exchanges=0;
let exchangeMode='success';
// Use Next.js's real cookie serialization/parsing. The old mock
// omitted percent-encoding and could not reproduce the production callback bug.
let NextResponse,NextRequest;
const loaded=new Map();
function load(filename){
  const absolute=path.resolve(filename);
  if(loaded.has(absolute)) return loaded.get(absolute).exports;
  const module={exports:{}};loaded.set(absolute,module);
  const customRequire=(specifier)=>{
    if(!specifier.startsWith('.')&&specifier!=='next/server') return require(specifier);
    if(specifier==='next/server') return {NextResponse,NextRequest,after:()=>{}};
    const resolved=path.resolve(path.dirname(absolute),specifier)+'.ts';
    if(resolved===path.resolve('lib/env.ts')) return {env};
    if(resolved===path.resolve('lib/session.ts')) return {getRentiaUser:async()=>user,canManageRentia:value=>value.role==='owner'||value.role==='admin'};
    if(resolved===path.resolve('db/database.ts')) return {createOAuthState:async(userId,provider,state)=>{await sql.run('INSERT INTO oauth_states(state,user_id,provider,expires_at,created_at) VALUES(?,?,?,?,?)',state,userId,provider,new Date(Date.now()+600000).toISOString(),now);}};
    return load(resolved);
  };
  const js=ts.transpileModule(fs.readFileSync(absolute,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const run=vm.runInThisContext(`(function(require,module,exports){${js}\n})`,{filename:absolute});
  run(customRequire,module,module.exports);return module.exports;
}
const originalFetch=global.fetch;
const originalWarn=console.warn;
const diagnostics=[];
console.warn=(...args)=>diagnostics.push(args);
global.fetch=async(url,options)=>{
  assert.equal(String(url),'https://api.mercadolibre.com/oauth/token');
  assert.equal(options.method,'POST');assert.equal(options.redirect,'manual');
  const params=options.body;assert.equal(params.get('grant_type'),'authorization_code');
  assert.equal(params.get('redirect_uri'),`${env.RENTIA_PUBLIC_ORIGIN}/api/integrations/mercadolibre/callback`);
  assert.equal(params.get('code_verifier').length,43);exchanges++;
  if(exchangeMode==='network')throw new Error('unsafe-fixture-secret-body');
  if(exchangeMode==='timeout')throw new DOMException('unsafe-fixture-secret-body','TimeoutError');
  if(exchangeMode==='malformed')return new Response('unsafe-fixture-secret-body',{status:502});
  if(exchangeMode==='incomplete')return Response.json({access_token:'unsafe-fixture-secret-body',user_id:999});
  if(exchangeMode!=='success')return Response.json({error:exchangeMode==='unknown'?'unsafe-fixture-secret-body':exchangeMode,error_description:'unsafe-fixture-secret-body',access_token:'unsafe-fixture-secret-body'},{status:exchangeMode==='forbidden'?403:exchangeMode==='local_rate_limited'?429:400});
  return Response.json({access_token:'synthetic-access',refresh_token:'synthetic-refresh',expires_in:21600,scope:'read offline_access',user_id:999});
};
const helper=load('lib/mercadolibre.ts'),db=load('db/mercadolibre.ts');
let start,callback,webhook;
const tokens=load('lib/token-crypto.ts');
async function attempt(){
  const response=await start.GET(new Request(`${env.RENTIA_PUBLIC_ORIGIN}/api/integrations/mercadolibre/start`));
  assert.equal(response.status,307);
  const authorization=new URL(response.headers.get('location'));
  assert.equal(authorization.origin,'https://auth.mercadolibre.com.ar');
  assert.equal(authorization.searchParams.get('code_challenge_method'),'S256');
  assert.equal(authorization.searchParams.get('code_challenge').length,43);
  assert.ok(!response.headers.get('location').includes(env.MELI_APP_SECRET));
  const rawCookie=response.headers.get('set-cookie');
  assert.ok(/HttpOnly/.test(rawCookie));assert.ok(/Secure/.test(rawCookie));assert.ok(/SameSite=Lax/i.test(rawCookie));
  const cookie=rawCookie.split(';')[0];
  return {cookie,url:`${env.RENTIA_PUBLIC_ORIGIN}/api/integrations/mercadolibre/callback?code=test-code&state=${authorization.searchParams.get('state')}`};
}
async function main(){
  sql=await createPostgres();load('db/client.ts').setDatabase(sql.driver);
  for(const [id,email] of [['test-store','fixture@example.invalid'],['other-store','other@example.invalid']])await sql.run('INSERT INTO accounts(user_id,email,owner_name,store_name,trial_started_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',id,email,'Fixture','Test only',now,now,now);
  ({NextResponse,NextRequest}=require('next/server'));
  start=load('app/api/integrations/mercadolibre/start/route.ts');
  const callbackRoute=load('app/api/integrations/mercadolibre/callback/route.ts');
  callback={GET:request=>callbackRoute.GET(new NextRequest(request))};
  webhook=load('app/api/webhooks/mercadolibre/route.ts');
  assert.equal(helper.mercadoLibreConfigured(),true);
  const savedId=env.MELI_APP_ID;env.MELI_APP_ID='';
  assert.equal((await start.GET(new Request(`${env.RENTIA_PUBLIC_ORIGIN}/api/integrations/mercadolibre/start`))).status,503);
  assert.equal((await callback.GET(new Request(`${env.RENTIA_PUBLIC_ORIGIN}/api/integrations/mercadolibre/callback`))).status,503);
  assert.equal((await webhook.POST(new Request(`${env.RENTIA_PUBLIC_ORIGIN}/api/webhooks/mercadolibre`,{method:'POST',body:'{}'}))).status,503);
  env.MELI_APP_ID=savedId;
  user=null;assert.equal((await start.GET(new Request(`${env.RENTIA_PUBLIC_ORIGIN}/api/integrations/mercadolibre/start`))).headers.get('location'),`${env.RENTIA_PUBLIC_ORIGIN}/ingresar`);
  user={id:'test-store',clerkUserId:'test-actor',role:'member'};
  assert.equal((await start.GET(new Request(`${env.RENTIA_PUBLIC_ORIGIN}/api/integrations/mercadolibre/start`))).status,403);
  user.role='owner';
  assert.equal((await start.GET(new Request('https://evil.example.invalid/api/integrations/mercadolibre/start'))).status,400);
  const expired=await helper.sealMercadoLibreAttempt({state:helper.mercadoLibreNonce(),verifier:helper.mercadoLibreNonce(),storeUserId:user.id,actorId:user.clerkUserId,expiresAt:Date.now()-1});
  assert.equal(await helper.readMercadoLibreAttempt(expired),null);
  const tamper=await attempt();
  const tamperedCookie=tamper.cookie.slice(0,-3)+'xyz';
  assert.match((await callback.GET(new Request(tamper.url,{headers:{cookie:tamperedCookie}}))).headers.get('location'),/mercadolibre_browser/);
  assert.match((await callback.GET(new Request(tamper.url))).headers.get('location'),/mercadolibre_browser/);
  assert.match((await callback.GET(new Request(tamper.url,{headers:{cookie:`${helper.MELI_OAUTH_COOKIE}=%E0%A4%A`}}))).headers.get('location'),/mercadolibre_browser/);
  const revoked=await attempt();user.role='member';
  assert.match((await callback.GET(new Request(revoked.url,{headers:{cookie:revoked.cookie}}))).headers.get('location'),/mercadolibre_state/);
  user.role='owner';
  const swapped=await attempt();user.clerkUserId='other-actor';
  assert.match((await callback.GET(new Request(swapped.url,{headers:{cookie:swapped.cookie}}))).headers.get('location'),/mercadolibre_state/);
  user.clerkUserId='test-actor';
  const differentStore=await attempt();user.id='other-store';
  assert.match((await callback.GET(new Request(differentStore.url,{headers:{cookie:differentStore.cookie}}))).headers.get('location'),/mercadolibre_state/);
  user.id='test-store';
  const signedOut=await attempt(),owner=user;user=null;
  assert.match((await callback.GET(new Request(signedOut.url,{headers:{cookie:signedOut.cookie}}))).headers.get('location'),/mercadolibre_session/);
  user=owner;
  const ready=await attempt();
  const wrongState=new URL(ready.url);wrongState.searchParams.set('state',helper.mercadoLibreNonce());
  assert.match((await callback.GET(new Request(wrongState,{headers:{cookie:ready.cookie}}))).headers.get('location'),/mercadolibre_state/);
  assert.equal(exchanges,0);
  // The browser returns the encoded Set-Cookie value unchanged. Real runtime
  // parsing must reconstruct the sealed attempt, including +, / and =.
  assert.ok(await helper.readMercadoLibreAttempt(new NextRequest(ready.url,{headers:{cookie:ready.cookie}}).cookies.get(helper.MELI_OAUTH_COOKIE).value));
  const connected=await callback.GET(new Request(ready.url,{headers:{cookie:ready.cookie}}));
  assert.match(connected.headers.get('location'),/setup=mercadolibre_import/);
  assert.ok(!connected.headers.get('location').includes('synthetic-access'));
  const row=(await sql.get("SELECT * FROM integrations WHERE provider='mercadolibre'"));
  assert.equal(row.status,'authorized');
  assert.ok(!row.encrypted_access_token.includes('synthetic-access'));
  const decrypted=JSON.parse(await tokens.decryptToken(row.encrypted_access_token,row.token_iv,env.TOKEN_ENCRYPTION_KEY));
  assert.equal(decrypted.refreshToken,'synthetic-refresh');assert.equal(decrypted.sellerId,'999');
  const count=exchanges;
  assert.match((await callback.GET(new Request(ready.url,{headers:{cookie:ready.cookie}}))).headers.get('location'),/mercadolibre_state/);
  assert.equal(exchanges,count);
  const failures=[
    ['invalid_client','mercadolibre_app_credentials','invalid_client',400],
    ['invalid_grant','mercadolibre_grant','invalid_grant',400],
    ['invalid_scope','mercadolibre_permissions','invalid_scope',400],
    ['unauthorized_client','mercadolibre_permissions','unauthorized_client',400],
    ['unauthorized_application','mercadolibre_app_blocked','unauthorized_application',400],
    ['invalid_operator_user_id','mercadolibre_operator','invalid_operator_user_id',400],
    ['forbidden','mercadolibre_access','forbidden',403],
    ['local_rate_limited','mercadolibre_temporary','local_rate_limited',429],
    ['network','mercadolibre_temporary','network',null],
    ['timeout','mercadolibre_temporary','timeout',null],
    ['unknown','mercadolibre_connection','unknown',400],
    ['malformed','mercadolibre_connection','invalid_response',502],
    ['incomplete','mercadolibre_connection','invalid_response',200],
  ];
  const originalStoredToken=row.encrypted_access_token;
  for(const [mode,message,category,status] of failures){
    const pending=await attempt();exchangeMode=mode;
    const failed=await callback.GET(new Request(pending.url,{headers:{cookie:pending.cookie}}));
    assert.equal(new URL(failed.headers.get('location')).searchParams.get('error'),message);
    assert.equal(failed.status,307);
    assert.deepEqual(diagnostics.at(-1),['[mercadolibre_oauth]',{reason:'connection_failed',stage:'token_exchange',category,status}]);
    assert.equal((await sql.get("SELECT encrypted_access_token FROM integrations WHERE provider='mercadolibre'")).encrypted_access_token,originalStoredToken);
  }
  exchangeMode='success';
  assert.equal(await db.saveMercadoLibreConnection({userId:'other-store',sellerId:'999',encryptedToken:'fixture',iv:'fixture',scopes:'read'}),false);
  assert.equal(await db.saveMercadoLibreConnection({userId:'test-store',sellerId:'1000',encryptedToken:'fixture',iv:'fixture',scopes:'read'}),false);
  const notice={_id:'test-event-1',topic:'orders_v2',resource:'/orders/123',user_id:999,application_id:12345,sent:now,untrustedRevenue:999999};
  const post=value=>webhook.POST(new Request(`${env.RENTIA_PUBLIC_ORIGIN}/api/webhooks/mercadolibre`,{method:'POST',body:JSON.stringify(value)}));
  assert.equal((await post({...notice,resource:'https://evil.example.invalid'})).status,400);
  assert.equal((await post({...notice,application_id:1})).status,401);
  assert.equal((await post({...notice,extra:'x'.repeat(9000)})).status,413);
  assert.equal((await post(notice)).status,200);assert.equal((await post(notice)).status,200);
  assert.equal((await post({...notice,_id:'unknown-seller',user_id:555})).status,200);
  const queued=(await sql.all("SELECT * FROM webhook_events WHERE provider='mercadolibre'"));
  assert.equal(queued.length,1);assert.equal(queued[0].user_id,'test-store');assert.equal(queued[0].status,'pending');
  assert.ok(!queued[0].payload_json.includes('untrustedRevenue'));
  assert.equal((await sql.get('SELECT count(*) as total FROM orders')).total,0);
  assert.equal((await webhook.GET()).status,200);
  assert.ok(diagnostics.length>0);
  for(const [label,detail] of diagnostics){assert.equal(label,'[mercadolibre_oauth]');assert.ok(Object.keys(detail).every(key=>['reason','stage','category','status'].includes(key)));}
  assert.ok(!JSON.stringify(diagnostics).includes('test-code'));
  assert.ok(!JSON.stringify(diagnostics).includes(env.MELI_APP_SECRET));
  assert.ok(!JSON.stringify(diagnostics).includes('unsafe-fixture-secret-body'));
  console.log('PASS: real Next.js cookie roundtrip, OAuth security, encrypted tokens, replay prevention, tenant isolation and webhooks; 13 token rejection/transport fixtures with sanitized diagnostics and unchanged saved credentials; no live network or store mutation.');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{global.fetch=originalFetch;console.warn=originalWarn;await sql?.close();});
