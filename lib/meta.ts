import { env } from './env';
import {
  getIntegrationCredentials,
  getSelectedMetaAdAccount,
  markSyncCompleted,
  markSyncFailed,
  markSyncStarted,
  type MetaAdAccountInput,
  type MetaCampaignInput,
  type MetaInsightInput,
  replaceMetaCampaignsAndInsights,
  upsertMetaAdAccounts,
} from '../db/database';
import { decryptToken } from './token-crypto';
import {importHistoryStart} from './import-history';

type UnknownRecord=Record<string,unknown>;
type MetaPage={data?:unknown[];paging?:{next?:string}};

function record(value:unknown):UnknownRecord { return value&&typeof value==='object'&&!Array.isArray(value)?value as UnknownRecord:{}; }
function list(value:unknown):unknown[] { return Array.isArray(value)?value:[]; }
function text(value:unknown) { return value===null||value===undefined?'':String(value); }
function number(value:unknown) { const parsed=Number(value); return Number.isFinite(parsed)?parsed:0; }

export function metaRuntime() {
  const runtime=env as unknown as {META_APP_ID?:string;META_APP_SECRET?:string;META_LOGIN_CONFIG_ID?:string;META_GRAPH_VERSION?:string;TOKEN_ENCRYPTION_KEY?:string;RENTIA_PUBLIC_ORIGIN?:string};
  return {...runtime,version:runtime.META_GRAPH_VERSION||'v23.0'};
}

export function metaRedirectUri(requestUrl:string) {
  const runtime=metaRuntime();
  const origin=(runtime.RENTIA_PUBLIC_ORIGIN||new URL(requestUrl).origin).replace(/\/$/,'');
  return `${origin}/api/integrations/meta/callback`;
}

async function appSecretProof(token:string,secret:string) {
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(token));
  return Array.from(new Uint8Array(signature),byte=>byte.toString(16).padStart(2,'0')).join('');
}

async function metaFetch(path:string,token:string,params:Record<string,string>={}) {
  const runtime=metaRuntime();
  if (!runtime.META_APP_SECRET) throw new Error('Falta configurar META_APP_SECRET');
  const url=new URL(path.startsWith('https://')?path:`https://graph.facebook.com/${runtime.version}/${path.replace(/^\//,'')}`);
  url.searchParams.set('access_token',token);
  url.searchParams.set('appsecret_proof',await appSecretProof(token,runtime.META_APP_SECRET));
  for (const [key,value] of Object.entries(params)) url.searchParams.set(key,value);
  const response=await fetch(url,{headers:{accept:'application/json'}});
  const body=await response.json().catch(()=>({})) as UnknownRecord;
  if (!response.ok) {
    const apiError=record(body.error);
    throw new Error(text(apiError.message)||`Meta respondió ${response.status}`);
  }
  return body;
}

async function fetchAll(path:string,token:string,params:Record<string,string>,maxPages=20) {
  const rows:UnknownRecord[]=[];
  let next:string|null=path;
  let first=true;
  for (let page=0;next&&page<maxPages;page++) {
    const response=await metaFetch(next,token,first?params:{} ) as MetaPage;
    rows.push(...list(response.data).map(record));
    next=response.paging?.next||null;
    first=false;
  }
  return rows;
}

export async function fetchMetaAdAccounts(token:string) {
  const rows=await fetchAll('me/adaccounts',token,{fields:'id,name,account_status,currency,timezone_name',limit:'200'});
  return rows.map((row):MetaAdAccountInput=>({
    externalId:text(row.id),
    name:text(row.name)||text(row.id),
    currency:text(row.currency)||'ARS',
    timezoneName:text(row.timezone_name)||null,
    accountStatus:number(row.account_status),
  })).filter(account=>Boolean(account.externalId));
}

function actionValue(value:unknown) {
  const actions=list(value).map(record);
  const priority=['omni_purchase','offsite_conversion.fb_pixel_purchase','purchase'];
  for (const actionType of priority) {
    const match=actions.find(action=>text(action.action_type)===actionType);
    if (match) return number(match.value);
  }
  return 0;
}

export async function syncMetaAds(userId:string) {
  const runtime=metaRuntime();
  const integration=await getIntegrationCredentials(userId,'meta');
  if (!integration) throw new Error('Meta Ads no está conectado');
  if (!runtime.TOKEN_ENCRYPTION_KEY) throw new Error('Falta la clave de cifrado del servidor');
  await markSyncStarted(userId,'meta');
  try {
    const token=await decryptToken(integration.encrypted_access_token,integration.token_iv,runtime.TOKEN_ENCRYPTION_KEY);
    const accounts=await fetchMetaAdAccounts(token);
    await upsertMetaAdAccounts(userId,accounts);
    const selected=await getSelectedMetaAdAccount(userId);
    if (!selected) {
      await markSyncCompleted(userId,'meta',0,0,2);
      return {accounts:accounts.length,campaigns:0,insights:0,needsAccount:false};
    }
    const accountId=selected.external_account_id;
    const now=new Date();
    const fromDate=importHistoryStart(now).slice(0,10);
    const today=now.toISOString().slice(0,10);
    const [campaignRows,insightRows]=await Promise.all([
      fetchAll(`${accountId}/campaigns`,token,{fields:'id,name,status,effective_status,daily_budget,lifetime_budget',limit:'200'}),
      fetchAll(`${accountId}/insights`,token,{
        level:'campaign',
        fields:'campaign_id,campaign_name,date_start,date_stop,spend,impressions,clicks,actions,action_values',
        time_range:JSON.stringify({since:fromDate,until:today}),
        time_increment:'1',
        limit:'500',
      }),
    ]);
    const campaigns:MetaCampaignInput[]=campaignRows.map(row=>({
      externalId:text(row.id),name:text(row.name)||'Campaña sin nombre',status:text(row.status)||null,effectiveStatus:text(row.effective_status)||null,
      dailyBudget:number(row.daily_budget)/100,lifetimeBudget:number(row.lifetime_budget)/100,
    })).filter(campaign=>Boolean(campaign.externalId));
    const insights:MetaInsightInput[]=insightRows.map(row=>({
      campaignId:text(row.campaign_id),date:text(row.date_start),spend:number(row.spend),impressions:Math.round(number(row.impressions)),clicks:Math.round(number(row.clicks)),
      purchases:actionValue(row.actions),purchaseValue:actionValue(row.action_values),
    })).filter(insight=>Boolean(insight.campaignId&&insight.date));
    await replaceMetaCampaignsAndInsights(userId,accountId,campaigns,insights,fromDate);
    await markSyncCompleted(userId,'meta',campaigns.length,insights.length,2);
    return {accounts:accounts.length,campaigns:campaigns.length,insights:insights.length,account:accountId};
  } catch (error) {
    const message=error instanceof Error?error.message:'Error desconocido al sincronizar Meta';
    await markSyncFailed(userId,'meta',message);
    throw error;
  }
}
