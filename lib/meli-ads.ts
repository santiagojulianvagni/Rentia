import {database} from '../db/client';
import {analyticsWindow,claimImportJob,checkpointImportJob,releaseImportJob} from '../db/database';
import {getMeliCredentials} from '../db/mercadolibre';
import {MeliClient,MeliError} from './mercadolibre-sync';
import {adsAccounts,adsCampaignPage,adsCoverage,adsDays,type AdsAccount} from './meli-ads-data';
import type {AnalyticsDateRange} from '../db/database';
const db=database;
const provider='mercadolibre_ads';
type Account=AdsAccount&{selected:number;last_completed_at:string|null;last_error:string|null;retry_at:number};
type State={version:1;seller:string;account:AdsAccount|null;generation:string;from:string;to:string;offset:number;total:number|null;queue:Array<{id:string;name:string;status:string}>;done:boolean;error:string|null;retryAt:number};
const guard="EXISTS (SELECT 1 FROM sync_jobs j JOIN integrations i ON i.user_id=j.user_id AND i.provider='mercadolibre' WHERE j.user_id=? AND j.provider='mercadolibre_ads' AND j.lease_token=? AND j.lease_expires_at>? AND i.external_store_id=? AND i.status IN ('authorized','connected'))";
const values=(user:string,lease:string,seller:string)=>[user,lease,Date.now(),seller];
function fresh(seller:string):State {
  // Product Ads publishes metrics daily. Today is not a completed accounting day.
  const end=new Date(Date.now()-86400000),to=end.toISOString().slice(0,10);end.setUTCDate(end.getUTCDate()-88);
  return {version:1,seller,account:null,generation:crypto.randomUUID(),from:end.toISOString().slice(0,10),to,offset:0,total:null,queue:[],done:false,error:null,retryAt:0};
}
async function accounts(user:string,seller:string){return (await db().prepare("SELECT advertiser_id,site_id,name,currency,selected,last_completed_at,last_error,retry_at FROM meli_ads_accounts WHERE user_id=? AND seller_id=? AND discovered_at<>'stale' AND discovered_at=(SELECT MAX(discovered_at) FROM meli_ads_accounts WHERE user_id=? AND seller_id=?) ORDER BY name").bind(user,seller,user,seller).all<Account>()).results;}
export async function selectMeliAds(user:string,advertiser:string){
  const connection=await getMeliCredentials(user);if(!connection)throw new MeliError('mercadolibre_reauthorize');const rows=await accounts(user,connection.external_store_id);if(!rows.some(r=>r.advertiser_id===advertiser))throw new MeliError('mercadolibre_invalid_resource');
  const lease=await claimImportJob(user,provider,JSON.stringify(fresh(connection.external_store_id)),60_000);if(!lease)throw new MeliError('mercadolibre_ads_busy',10);
  try {await db().prepare(`UPDATE meli_ads_accounts SET selected=CASE WHEN advertiser_id=? THEN 1 ELSE 0 END WHERE user_id=? AND seller_id=? AND ${guard}`).bind(advertiser,user,connection.external_store_id,...values(user,lease.token,connection.external_store_id)).run();await checkpointImportJob(user,provider,lease.token,JSON.stringify(fresh(connection.external_store_id)));}finally{await releaseImportJob(user,provider,lease.token);}
}
export async function syncMeliAds(user:string,force=false){
  const connection=await getMeliCredentials(user);if(!connection)return {done:true,error:'mercadolibre_reauthorize'};
  const seller=connection.external_store_id,lease=await claimImportJob(user,provider,JSON.stringify(fresh(seller)),60_000);if(!lease)return {done:false,error:'mercadolibre_ads_busy',retryAfter:10};
  let state:State=fresh(seller);try{const parsed=JSON.parse(lease.stateJson) as State;if(parsed.version===1&&parsed.seller===seller)state=parsed;}catch{}
  try {
    if(state.retryAt>Date.now())return {done:state.done,error:state.error,retryAfter:Math.ceil((state.retryAt-Date.now())/1000)};
    if(state.done){const selected=(await accounts(user,seller)).find(r=>r.selected);if(!force&&selected?.last_completed_at&&Date.now()-Date.parse(selected.last_completed_at)<4*3600000)return {done:true};state=fresh(seller);}
    const deadline=Date.now()+18_000,client=new MeliClient(user,seller,deadline);
    if(!state.account){
      const discovered=adsAccounts(await client.get('/advertising/advertisers?product_id=PADS',{'api-version':'1'})),previous=(await accounts(user,seller)).find(r=>r.selected),now=new Date().toISOString();
      const choice=discovered.find(r=>r.advertiser_id===previous?.advertiser_id)||(discovered.length===1?discovered[0]:null);
      const writes=[db().prepare(`UPDATE meli_ads_accounts SET selected=0,discovered_at='stale' WHERE user_id=? AND seller_id=? AND ${guard}`).bind(user,seller,...values(user,lease.token,seller)),...discovered.map(a=>db().prepare(`INSERT INTO meli_ads_accounts (user_id,seller_id,advertiser_id,site_id,name,currency,selected,discovered_at) SELECT ?,?,?,?,?,?,?,? WHERE ${guard} ON CONFLICT(user_id,seller_id,advertiser_id) DO UPDATE SET site_id=excluded.site_id,name=excluded.name,currency=excluded.currency,selected=excluded.selected,discovered_at=excluded.discovered_at`).bind(user,seller,a.advertiser_id,a.site_id,a.name,a.currency,a.advertiser_id===choice?.advertiser_id?1:0,now,...values(user,lease.token,seller)))];
      for(let n=0;n<writes.length;n+=40)await db().batch(writes.slice(n,n+40));
      if(!choice){state.done=true;state.error=discovered.length?'mercadolibre_ads_select_account':'mercadolibre_ads_not_enabled';state.retryAt=Date.now()+4*3600000;await checkpointImportJob(user,provider,lease.token,JSON.stringify(state));return {done:true,error:state.error};}
      state.account=choice;await checkpointImportJob(user,provider,lease.token,JSON.stringify(state));
    }
    let calls=0;
    while(Date.now()<deadline-3500&&calls<4){
      const a=state.account;
      if(!state.queue.length){
        if(state.total!==null&&state.offset>=state.total){await publish(user,lease.token,state);state.done=true;state.error=null;state.retryAt=0;await checkpointImportJob(user,provider,lease.token,JSON.stringify(state));return {done:true};}
        const query=new URLSearchParams({limit:'50',offset:String(state.offset)}),page=adsCampaignPage(await client.get(`/advertising/${a.site_id}/advertisers/${a.advertiser_id}/product_ads/campaigns/search?${query}`,{'api-version':'2'}),state.offset);calls++;state.queue=page.campaigns;state.total=page.total;state.offset+=page.campaigns.length;await checkpointImportJob(user,provider,lease.token,JSON.stringify(state));continue;
      }
      const c=state.queue[0],query=new URLSearchParams({date_from:state.from,date_to:state.to,metrics:'clicks,prints,cost,total_amount,units_quantity',aggregation_type:'DAILY'});
      const days=adsDays(await client.get(`/advertising/${a.site_id}/product_ads/campaigns/${c.id}?${query}`,{'api-version':'2'}),state.from,state.to);calls++;
      const rows=days.length?days:[{date:state.to,cost_cents:0,attributed_cents:0,clicks:0,impressions:0,units:0}];
      // Incomplete generations never replace previously confirmed financial data.
      const statements=rows.map(d=>db().prepare(`INSERT INTO meli_ads_stage (user_id,seller_id,advertiser_id,generation,campaign_id,date,name,status,cost_cents,attributed_cents,clicks,impressions,units) SELECT ?,?,?,?,?,?,?,?,?::bigint,?::bigint,?::bigint,?::bigint,?::double precision WHERE ${guard} ON CONFLICT (user_id,seller_id,advertiser_id,generation,campaign_id,date) DO UPDATE SET name=excluded.name,status=excluded.status,cost_cents=excluded.cost_cents,attributed_cents=excluded.attributed_cents,clicks=excluded.clicks,impressions=excluded.impressions,units=excluded.units`).bind(user,seller,a.advertiser_id,state.generation,c.id,d.date,c.name,c.status,d.cost_cents,d.attributed_cents,d.clicks,d.impressions,d.units,...values(user,lease.token,seller)));
      for(let n=0;n<statements.length;n+=40)await db().batch(statements.slice(n,n+40));
      state.queue.shift();state.error=null;state.retryAt=0;await checkpointImportJob(user,provider,lease.token,JSON.stringify(state));
    }
    return {done:false,retryAfter:3};
  }catch(error){state.error=error instanceof MeliError?error.code:error instanceof Error&&/^mercadolibre_[a-z_]+$/.test(error.message)?error.message:'mercadolibre_ads_pending';const retry=error instanceof MeliError?Math.max(5,error.retrySeconds):60;state.retryAt=Date.now()+retry*1000;await checkpointImportJob(user,provider,lease.token,JSON.stringify(state));return {done:false,error:state.error,retryAfter:retry};}
  finally{await releaseImportJob(user,provider,lease.token);}
}
async function publish(user:string,lease:string,state:State){
  const a=state.account!,g=values(user,lease,state.seller),now=new Date().toISOString();
  const results=await db().batch([
    db().prepare(`DELETE FROM meli_ads_daily WHERE user_id=? AND seller_id=? AND advertiser_id=? AND date BETWEEN ? AND ? AND ${guard}`).bind(user,state.seller,a.advertiser_id,state.from,state.to,...g),
    db().prepare(`INSERT INTO meli_ads_daily (user_id,seller_id,advertiser_id,campaign_id,date,name,status,cost_cents,attributed_cents,clicks,impressions,units) SELECT user_id,seller_id,advertiser_id,campaign_id,date,name,status,cost_cents,attributed_cents,clicks,impressions,units FROM meli_ads_stage WHERE user_id=? AND seller_id=? AND advertiser_id=? AND generation=? AND ${guard}`).bind(user,state.seller,a.advertiser_id,state.generation,...g),
    db().prepare(`INSERT INTO meli_ads_coverage (user_id,seller_id,advertiser_id,date_from,date_to,completed_at) SELECT ?,?,?,?,?,? WHERE ${guard} ON CONFLICT (user_id,seller_id,advertiser_id,date_from,date_to) DO UPDATE SET completed_at=excluded.completed_at`).bind(user,state.seller,a.advertiser_id,state.from,state.to,now,...g),
    db().prepare(`UPDATE meli_ads_accounts SET last_completed_at=?,last_error=NULL,retry_at=0 WHERE user_id=? AND seller_id=? AND advertiser_id=? AND selected=1 AND ${guard}`).bind(now,user,state.seller,a.advertiser_id,...g),
    db().prepare(`DELETE FROM meli_ads_stage WHERE user_id=? AND seller_id=? AND generation<>? AND ${guard}`).bind(user,state.seller,state.generation,...g)
  ]);
  if(!Number(results[3].meta.changes))throw new MeliError('mercadolibre_connection_changed',30);
}
export async function getMeliAds(user:string,days:number,offset=0,range?:AnalyticsDateRange){
  const connection=await getMeliCredentials(user),window=analyticsWindow(days,offset,range),end=new Date(window.until);const to=end.toISOString().slice(0,10),from=window.sinceDate;
  const empty={connected:Boolean(connection),accounts:[] as Account[],selected:null as Account|null,summary:{spend:0,attributedRevenue:0,clicks:0,impressions:0,units:0,roas:0,cpc:0,ctr:0},daily:[] as Array<{date:string;spend:number}>,campaigns:[] as Array<{id:string;name:string;status:string;spend:number;attributedRevenue:number;clicks:number;impressions:number;units:number;roas:number}>,coverage:{complete:false,from:null as string|null,to:null as string|null,requestedFrom:from,requestedTo:to},sync:{done:true,error:null as string|null,retryAfter:0}};
  if(!connection)return empty;const seller=connection.external_store_id,rows=await accounts(user,seller),selected=rows.find(r=>r.selected)||null;
  const job=await db().prepare('SELECT state_json FROM sync_jobs WHERE user_id=? AND provider=?').bind(user,provider).first<{state_json:string}>();let state:State|null=null;try{const s=JSON.parse(job?.state_json||'null');if(s?.seller===seller)state=s;}catch{}
  const sync={done:state?.done??true,error:state?.error??null,retryAfter:state?Math.max(0,Math.ceil((state.retryAt-Date.now())/1000)):0};
  if(!selected)return {...empty,accounts:rows,sync};
  const bind=[user,seller,selected.advertiser_id,from,window.untilDate];
  const [daily,campaigns,intervals]=await Promise.all([
    db().prepare('SELECT date,SUM(cost_cents)/100.0 AS spend FROM meli_ads_daily WHERE user_id=? AND seller_id=? AND advertiser_id=? AND date>=? AND date<? GROUP BY date ORDER BY date').bind(...bind).all<{date:string;spend:number}>(),
    db().prepare('SELECT campaign_id AS id,MAX(name) AS name,MAX(status) AS status,SUM(cost_cents)/100.0 AS spend,SUM(attributed_cents)/100.0 AS "attributedRevenue",SUM(clicks) AS clicks,SUM(impressions) AS impressions,SUM(units) AS units FROM meli_ads_daily WHERE user_id=? AND seller_id=? AND advertiser_id=? AND date>=? AND date<? GROUP BY campaign_id ORDER BY spend DESC').bind(...bind).all<{id:string;name:string;status:string;spend:number;attributedRevenue:number;clicks:number;impressions:number;units:number}>(),
    db().prepare('SELECT date_from,date_to FROM meli_ads_coverage WHERE user_id=? AND seller_id=? AND advertiser_id=? ORDER BY date_from').bind(user,seller,selected.advertiser_id).all<{date_from:string;date_to:string}>()
  ]);
  const summary=campaigns.results.reduce((t,r)=>({spend:t.spend+r.spend,attributedRevenue:t.attributedRevenue+r.attributedRevenue,clicks:t.clicks+r.clicks,impressions:t.impressions+r.impressions,units:t.units+r.units}),{spend:0,attributedRevenue:0,clicks:0,impressions:0,units:0});
  summary.spend=Math.round(summary.spend*100)/100;summary.attributedRevenue=Math.round(summary.attributedRevenue*100)/100;
  const lastDate=range?new Date(new Date(window.until).getTime()-86400000).toISOString().slice(0,10):to;
  return {...empty,accounts:rows,selected,summary:{...summary,roas:summary.spend?summary.attributedRevenue/summary.spend:0,cpc:summary.clicks?summary.spend/summary.clicks:0,ctr:summary.impressions?summary.clicks/summary.impressions*100:0},daily:daily.results,campaigns:campaigns.results.map(r=>({...r,roas:r.spend?r.attributedRevenue/r.spend:0})),coverage:{complete:adsCoverage(intervals.results,from,lastDate),from:intervals.results[0]?.date_from||null,to:intervals.results.reduce<string|null>((v,r)=>!v||r.date_to>v?r.date_to:v,null),requestedFrom:from,requestedTo:lastDate},sync};
}
export async function meliAdsUsersForReconciliation(){
  const rows=await db().prepare("SELECT i.user_id FROM integrations i LEFT JOIN sync_jobs j ON j.user_id=i.user_id AND j.provider='mercadolibre_ads' LEFT JOIN meli_ads_accounts a ON a.user_id=i.user_id AND a.seller_id=i.external_store_id AND a.selected=1 WHERE i.provider='mercadolibre' AND i.status IN ('authorized','connected') AND COALESCE((j.state_json::jsonb->>'retryAt')::double precision,0)<=? AND (a.last_completed_at IS NULL OR a.last_completed_at<? OR (j.state_json::jsonb->>'done') IN ('false','0')) ORDER BY COALESCE(j.updated_at,'') LIMIT 2").bind(Date.now(),new Date(Date.now()-4*3600000).toISOString()).all<{user_id:string}>();return rows.results.map(r=>r.user_id);
}
