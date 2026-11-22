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
import type {CreativeRow} from './creative-analysis';

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

// Anuncios activos con sus parámetros de URL, para revisar UTMs y nombres. Solo lectura
// (permiso ads_read): Rentia no cambia nada en la cuenta.
export type MetaAdForAudit={id:string;name:string;status:string;campaignId:string;campaignName:string;adsetName:string;urlTags:string;link:string};
export async function fetchActiveMetaAds(userId:string):Promise<{account:{id:string;name:string}|null;ads:MetaAdForAudit[]}> {
  const runtime=metaRuntime();
  const integration=await getIntegrationCredentials(userId,'meta');
  if (!integration) throw new Error('meta_not_connected');
  if (!runtime.TOKEN_ENCRYPTION_KEY) throw new Error('Falta la clave de cifrado del servidor');
  const selected=await getSelectedMetaAdAccount(userId);
  if (!selected) return {account:null,ads:[]};
  const token=await decryptToken(integration.encrypted_access_token,integration.token_iv,runtime.TOKEN_ENCRYPTION_KEY);
  const rows=await fetchAll(`${selected.external_account_id}/ads`,token,{
    fields:'id,name,effective_status,campaign{id,name},adset{name},creative{url_tags,object_story_spec{link_data{link},video_data{call_to_action{value{link}}},template_data{link}},asset_feed_spec{link_urls{website_url}}}',
    effective_status:JSON.stringify(['ACTIVE']),
    limit:'200',
  },5);
  const ads=rows.map(row=>{
    const creative=record(row.creative),story=record(creative.object_story_spec);
    const link=text(record(story.link_data).link)||text(record(record(record(story.video_data).call_to_action).value).link)||text(record(story.template_data).link)||text(record(list(record(creative.asset_feed_spec).link_urls)[0]).website_url);
    return {id:text(row.id),name:text(row.name),status:text(row.effective_status),campaignId:text(record(row.campaign).id),campaignName:text(record(row.campaign).name),adsetName:text(record(row.adset).name),urlTags:text(creative.url_tags),link};
  }).filter(ad=>ad.id);
  return {account:{id:selected.external_account_id,name:selected.name||selected.external_account_id},ads};
}

// Creativos: métricas por anuncio del período (gasto, compras, videos vistos 3 s y completos) y
// la miniatura de cada uno. Solo lectura (ads_read); se consulta en el momento.
// Compras de una ventana de atribución ("7d_click" o "1d_view") cuando se piden desglosadas.
function actionWindow(value:unknown,window:string) {
  const actions=list(value).map(record);
  for (const actionType of ['omni_purchase','offsite_conversion.fb_pixel_purchase','purchase']) {
    const match=actions.find(action=>text(action.action_type)===actionType);
    if (match) return number(match[window]);
  }
  return 0;
}
function actionCount(value:unknown,type:string) {
  return list(value).map(record).filter(action=>text(action.action_type)===type).reduce((sum,action)=>sum+number(action.value),0);
}
export async function fetchMetaCreatives(userId:string,since:string,until:string) {
  const runtime=metaRuntime();
  const integration=await getIntegrationCredentials(userId,'meta');
  if (!integration) throw new Error('meta_not_connected');
  if (!runtime.TOKEN_ENCRYPTION_KEY) throw new Error('Falta la clave de cifrado del servidor');
  const selected=await getSelectedMetaAdAccount(userId);
  if (!selected) return {account:null,currency:null,ads:[] as CreativeRow[]};
  const token=await decryptToken(integration.encrypted_access_token,integration.token_iv,runtime.TOKEN_ENCRYPTION_KEY);
  const rows=await fetchAll(`${selected.external_account_id}/insights`,token,{
    level:'ad',
    fields:'ad_id,ad_name,adset_name,campaign_name,spend,impressions,inline_link_clicks,actions,action_values,video_thruplay_watched_actions',
    time_range:JSON.stringify({since,until}),
    // Desglosado: compras después de un clic (7 días) y por solo ver el anuncio (1 día).
    action_attribution_windows:JSON.stringify(['7d_click','1d_view']),
    limit:'500',
  },10);
  // Los de más gasto primero; miniatura y tipo solo de los primeros 100.
  const metrics=rows.map(row=>({adId:text(row.ad_id),name:text(row.ad_name)||'Anuncio sin nombre',campaign:text(row.campaign_name),adset:text(row.adset_name),spend:number(row.spend),impressions:Math.round(number(row.impressions)),linkClicks:Math.round(number(row.inline_link_clicks)),purchases:actionValue(row.actions),purchaseValue:actionValue(row.action_values),purchasesClick:actionWindow(row.actions,'7d_click'),purchaseValueClick:actionWindow(row.action_values,'7d_click'),videoViews3s:actionCount(row.actions,'video_view'),thruplays:actionCount(row.video_thruplay_watched_actions,'video_view')})).filter(row=>row.adId&&row.spend>0).sort((a,b)=>b.spend-a.spend).slice(0,100);
  const details=new Map<string,UnknownRecord>();
  for (let index=0;index<metrics.length;index+=50) {
    const ids=metrics.slice(index,index+50).map(row=>row.adId);
    // Mismo pedido que la revisión de UTMs (cuenta → anuncios), filtrado por los anuncios del período.
    const found=await fetchAll(`${selected.external_account_id}/ads`,token,{fields:'id,effective_status,creative.thumbnail_width(480).thumbnail_height(480){thumbnail_url,image_url,object_type,video_id}',filtering:JSON.stringify([{field:'ad.id',operator:'IN',value:ids}]),limit:'50'},2).catch(()=>[] as UnknownRecord[]);
    for (const row of found) details.set(text(row.id),row);
  }
  const ads=metrics.map((row):CreativeRow=>{
    const detail=details.get(row.adId)||{},creative=record(detail.creative);
    const video=row.videoViews3s>0||Boolean(text(creative.video_id))||text(creative.object_type).toUpperCase()==='VIDEO';
    // La imagen original si es un anuncio de imagen; si no, la miniatura grande del video.
    const thumbnail=text(creative.image_url)||text(creative.thumbnail_url);
    return {...row,status:text(detail.effective_status),kind:video?'video':'imagen',thumbnail:/^https:\/\//.test(thumbnail)?thumbnail:null};
  });
  return {account:{id:selected.external_account_id,name:selected.name||selected.external_account_id},currency:selected.currency||'ARS',ads};
}

// Vista previa de un anuncio tal como lo muestra Meta (un iframe de facebook.com). Solo de la cuenta
// publicitaria elegida por la tienda; devuelve la dirección del iframe, nunca HTML de Meta.
export const AD_PREVIEW_FORMATS=['INSTAGRAM_STANDARD','INSTAGRAM_REELS','MOBILE_FEED_STANDARD'] as const;
export async function fetchMetaAdPreview(userId:string,adId:string,format:typeof AD_PREVIEW_FORMATS[number]) {
  const runtime=metaRuntime();
  const integration=await getIntegrationCredentials(userId,'meta');
  if (!integration) throw new Error('meta_not_connected');
  if (!runtime.TOKEN_ENCRYPTION_KEY) throw new Error('Falta la clave de cifrado del servidor');
  const selected=await getSelectedMetaAdAccount(userId);
  if (!selected) return null;
  const token=await decryptToken(integration.encrypted_access_token,integration.token_iv,runtime.TOKEN_ENCRYPTION_KEY);
  const ad=await metaFetch(adId,token,{fields:'account_id'});
  const account=selected.external_account_id.replace(/^act_/,'');
  if (text(ad.account_id)!==account) return null;
  const body=await metaFetch(`${adId}/previews`,token,{ad_format:format});
  const html=text(record(list(body.data)[0]).body);
  const src=(html.match(/src="([^"]+)"/)?.[1]||'').replace(/&amp;/g,'&');
  // Meta arma cada vista previa con su propio tamaño (Instagram, Reels y Facebook son distintos).
  const size=(name:'width'|'height')=>{const value=Number((name==='width'?html.match(/\swidth="(\d+)"/):html.match(/\sheight="(\d+)"/))?.[1]);return Number.isFinite(value)&&value>=100&&value<=2000?value:null;};
  const width=size('width'),height=size('height');
  let url:URL;
  try { url=new URL(src); } catch { return {src:null,width:null,height:null,adsManager:`https://adsmanager.facebook.com/adsmanager/manage/ads?act=${account}&selected_ad_ids=${adId}`}; }
  const safe=url.protocol==='https:'&&/(^|\.)facebook\.com$/.test(url.hostname)&&url.pathname.startsWith('/ads/api/preview_iframe');
  return {src:safe?url.toString():null,width,height,adsManager:`https://adsmanager.facebook.com/adsmanager/manage/ads?act=${account}&selected_ad_ids=${adId}`};
}
