// UTMs y reglas de nombres para los anuncios. Las UTMs permiten saber, en la tienda o en
// Google Analytics, de qué campaña y anuncio vino cada visita y cada venta.
export type NamingRule={separator:string;segments:string[]};
export const DEFAULT_NAMING_RULE:NamingRule={separator:'_',segments:['Objetivo','Producto','Público','Formato']};
export const SEPARATORS=['_','|','-','/'];
export const REQUIRED_UTMS=['utm_source','utm_medium','utm_campaign'] as const;

// Parámetros de URL para pegar en Meta (nivel anuncio → "Parámetros de URL"). Meta reemplaza
// lo que va entre llaves dobles por el nombre real de la campaña, el conjunto y el anuncio.
export type MetaTagOptions={source:'site'|'facebook'|'meta';medium:string;includeIds:boolean};
export const DEFAULT_META_TAGS:MetaTagOptions={source:'site',medium:'paid_social',includeIds:true};
export function metaUrlTags(options:MetaTagOptions=DEFAULT_META_TAGS) {
  const source=options.source==='site'?'{{site_source_name}}':options.source;
  const params=[
    ['utm_source',source],
    ['utm_medium',options.medium.trim()||'paid_social'],
    ['utm_campaign','{{campaign.name}}'],
    ['utm_term','{{adset.name}}'],
    ['utm_content','{{ad.name}}'],
    ...(options.includeIds?[['utm_id','{{campaign.id}}']]:[]),
  ];
  return params.map(([key,value])=>`${key}=${value}`).join('&');
}

// Une los parámetros de URL del anuncio con los que ya trae el link de destino.
export function utmParams(urlTags:string,link='') {
  const params=new Map<string,string>();
  const add=(query:string)=>{for(const part of query.replace(/^\?/,'').split('&')){if(!part)continue;const [key,...rest]=part.split('=');const name=decodeURIComponentSafe(key).trim().toLowerCase();if(name)params.set(name,decodeURIComponentSafe(rest.join('=')).trim());}};
  const query=link.includes('?')?link.slice(link.indexOf('?')+1).split('#')[0]:'';
  add(query);add(urlTags||'');
  return params;
}
function decodeURIComponentSafe(value:string) {try{return decodeURIComponent(value.replace(/\+/g,' '));}catch{return value;}}

export function nameMatches(name:string,rule:NamingRule) {
  if(!rule.segments.length)return true;
  const parts=name.split(rule.separator).map(part=>part.trim());
  return parts.length===rule.segments.length&&parts.every(Boolean);
}

export function buildName(values:string[],rule:NamingRule) {
  const separator=rule.separator==='|'?' | ':rule.separator;
  return values.map(value=>value.trim().replace(new RegExp(`\\s*${rule.separator.replace(/[|/\\-]/g,'\\$&')}\\s*`,'g'),' ')).join(separator);
}

export type AdIssue='sin_utm'|'utm_incompleta'|'utm_fija'|'sin_link'|'nombre_campana';
export const ISSUE_LABELS:Record<AdIssue,string>={
  sin_utm:'Sin UTMs',utm_incompleta:'Faltan UTMs',utm_fija:'UTM de campaña fija',sin_link:'Sin link a la tienda',
  nombre_campana:'Nombre fuera de la regla',
};

export type AuditAd={id:string;name:string;campaignName:string;adsetName:string;urlTags:string;link:string};
export function auditAd(ad:AuditAd,rule:NamingRule|null) {
  const issues:AdIssue[]=[];
  const params=utmParams(ad.urlTags,ad.link);
  const missing=REQUIRED_UTMS.filter(key=>!params.get(key));
  if(!ad.link&&!ad.urlTags) issues.push('sin_link');
  else if(missing.length===REQUIRED_UTMS.length) issues.push('sin_utm');
  else if(missing.length) issues.push('utm_incompleta');
  // Una utm_campaign escrita a mano que no coincide con la campaña suele quedar vieja al duplicar.
  const campaign=params.get('utm_campaign');
  if(campaign&&!campaign.includes('{{')&&campaign.toLowerCase()!==ad.campaignName.trim().toLowerCase()) issues.push('utm_fija');
  if(rule&&rule.segments.length) {
    if(!nameMatches(ad.campaignName,rule)) issues.push('nombre_campana');
  }
  return {issues,params:Object.fromEntries(params),missing};
}

export function auditSummary(results:Array<{issues:AdIssue[]}>) {
  const count=(issue:AdIssue)=>results.filter(result=>result.issues.includes(issue)).length;
  const withUtm=results.filter(result=>!result.issues.some(issue=>issue==='sin_utm'||issue==='utm_incompleta'||issue==='sin_link')).length;
  return {total:results.length,withUtm,withoutUtm:count('sin_utm')+count('sin_link'),incomplete:count('utm_incompleta'),fixed:count('utm_fija'),badNames:count('nombre_campana'),clean:results.filter(result=>!result.issues.length).length};
}

// Link con UTMs para canales sin parámetros automáticos (bio de Instagram, email, WhatsApp).
export function buildTrackedUrl(base:string,params:Record<string,string>) {
  let url:URL;
  try {url=new URL(/^https?:\/\//i.test(base.trim())?base.trim():`https://${base.trim()}`);} catch {return null;}
  if(!/\./.test(url.hostname))return null;
  for(const [key,value] of Object.entries(params)) if(value.trim()) url.searchParams.set(key,value.trim().toLowerCase().replace(/\s+/g,'_'));
  return url.toString();
}

export function validNamingRule(rule:unknown):rule is NamingRule {
  const value=rule as NamingRule;
  return Boolean(value&&SEPARATORS.includes(value.separator)&&Array.isArray(value.segments)&&value.segments.length<=8&&value.segments.every(segment=>typeof segment==='string'&&segment.trim().length>0&&segment.length<=30));
}
