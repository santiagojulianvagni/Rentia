import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {createTestDatabase} from './helpers/postgres.mjs';

// Meta Ads end to end against an in-process Postgres: synthetic Graph API
// responses only, no network or real account.
registerHooks({resolve(specifier,context,next){
  if(/\/lib\/session$/.test(specifier))return {url:'data:text/javascript,export async function getRentiaUser(){return globalThis.__metaUser;}export function canManageRentia(user){return user.role!=="member";}',shortCircuit:true};
  if(specifier==='next/server')return next('next/server.js',context);
  try{return next(specifier,context);}catch(error){
    if(error.code==='ERR_MODULE_NOT_FOUND'&&specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return next(`${specifier}.ts`,context);
    throw error;
  }
}});
process.env.TOKEN_ENCRYPTION_KEY=Buffer.alloc(32,5).toString('base64');
process.env.META_APP_SECRET='synthetic-meta-secret';
const {setDatabase}=await import('../db/client.ts');
const database=await import('../db/database.ts');
const {syncMetaAds}=await import('../lib/meta.ts');
const {encryptToken}=await import('../lib/token-crypto.ts');
const adsEndpoint=await import('../app/api/ads/route.ts');

const day=new Date(Date.now()-86400000).toISOString().slice(0,10);
const graph={
  'me/adaccounts':{data:[{id:'act_1',name:'Cuenta principal',account_status:1,currency:'ARS',timezone_name:'America/Argentina/Buenos_Aires'},{id:'act_2',name:'Otra cuenta',account_status:1,currency:'USD'}]},
  'act_1/campaigns':{data:[{id:'c1',name:'Prospección',status:'ACTIVE',effective_status:'ACTIVE',daily_budget:'150000'},{id:'c2',name:'Retargeting',status:'PAUSED',effective_status:'PAUSED',lifetime_budget:'900000'}]},
  'act_1/insights':{data:[
    {campaign_id:'c1',campaign_name:'Prospección',date_start:day,date_stop:day,spend:'1500.50',impressions:'12000',clicks:'340',actions:[{action_type:'omni_purchase',value:'4'}],action_values:[{action_type:'omni_purchase',value:'60000'}]},
    {campaign_id:'c2',campaign_name:'Retargeting',date_start:day,date_stop:day,spend:'499.50',impressions:'3000',clicks:'90',actions:[{action_type:'purchase',value:'1'}],action_values:[{action_type:'purchase',value:'15000'}]},
  ]},
};
const requests=[];
globalThis.fetch=async input=>{
  const url=new URL(String(input));requests.push(url);
  assert.equal(url.origin,'https://graph.facebook.com');
  assert.ok(url.searchParams.get('appsecret_proof'),'every call is signed with appsecret_proof');
  const path=url.pathname.replace(/^\/v\d+\.\d+\//,'');
  if(!graph[path])return Response.json({error:{message:`unexpected ${path}`}},{status:400});
  return Response.json(graph[path]);
};

test('Meta sync stores accounts, campaigns and daily insights, and the ads endpoint reads them back',async()=>{
  const {pg,driver}=await createTestDatabase();setDatabase(driver);
  const now=new Date().toISOString();
  await pg.query('INSERT INTO accounts (user_id,email,owner_name,store_name,trial_started_at,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$5,$5)',['store-meta','meta@example.invalid','Owner','Store',now]);
  const token=await encryptToken('synthetic-meta-token',process.env.TOKEN_ENCRYPTION_KEY);
  await database.saveIntegration({userId:'store-meta',provider:'meta',storeId:'meta-user',encryptedToken:token.encryptedToken,iv:token.iv,scopes:'ads_read'});

  const result=await syncMetaAds('store-meta');
  assert.deepEqual(result,{accounts:2,campaigns:2,insights:2,account:'act_1'});
  assert.ok(requests.some(url=>url.pathname.endsWith('/act_1/insights')));

  // A second sync replaces the same days instead of duplicating them.
  await syncMetaAds('store-meta');
  const data=await database.getMetaAnalyticsData('store-meta',30);
  assert.equal(data.accounts.length,2);
  assert.equal(data.selected.external_account_id,'act_1');
  assert.equal(data.summary.spend,2000);
  assert.equal(data.summary.impressions,15000);
  assert.equal(data.summary.purchases,5);
  assert.equal(data.summary.purchase_value,75000);
  assert.equal(data.campaigns.length,2);
  assert.equal(data.daily.length,1);
  assert.equal(data.sync.status,'success');

  globalThis.__metaUser={id:'store-meta',role:'owner'};
  const response=await adsEndpoint.GET(new Request('https://rentia.example.invalid/api/ads?days=30'));
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.summary.spend,2000);
  assert.equal(body.summary.reportedRoas,37.5);
  assert.equal(body.campaigns.find(row=>row.external_campaign_id==='c1').reported_roas,60000/1500.5);

  // Switching the selected account only shows that account's data.
  assert.equal(await database.selectMetaAdAccount('store-meta','act_2'),true);
  assert.equal((await database.getMetaAnalyticsData('store-meta',30)).summary.spend,0);
  setDatabase(null);await pg.close();
});
