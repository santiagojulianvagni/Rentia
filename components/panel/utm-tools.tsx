'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, Plus, RefreshCw, X } from 'lucide-react';
import { DEFAULT_META_TAGS, DEFAULT_NAMING_RULE, ISSUE_LABELS, SEPARATORS, buildName, buildTrackedUrl, metaUrlTags, type AdIssue, type MetaTagOptions, type NamingRule } from '../../lib/utm';

type AuditRow={id:string;name:string;campaignName:string;adsetName:string;link:string;issues:AdIssue[];params:Record<string,string>;missing:string[]};
type Audit={connected:boolean;account:{id:string;name:string}|null;rule:NamingRule|null;ads:AuditRow[];summary:{total:number;withUtm:number;withoutUtm:number;incomplete:number;fixed:number;badNames:number;clean:number}|null};

const CHANNELS:Array<{label:string;source:string;medium:string}>=[
  {label:'Bio de Instagram',source:'instagram',medium:'bio'},
  {label:'Historia de Instagram',source:'instagram',medium:'story'},
  {label:'WhatsApp',source:'whatsapp',medium:'mensaje'},
  {label:'Email',source:'newsletter',medium:'email'},
  {label:'TikTok',source:'tiktok',medium:'bio'},
  {label:'Influencer',source:'influencer',medium:'colaboracion'},
];
const issueTone:Record<AdIssue,string>={sin_utm:'p-r',sin_link:'p-n',utm_incompleta:'p-a',utm_fija:'p-a',nombre_campana:'p-a'};

function CopyButton({text,label='Copiar'}:{text:string;label?:string}) {
  const [copied,setCopied]=useState(false);
  async function copy() {
    try {await navigator.clipboard.writeText(text);} catch {
      const area=document.createElement('textarea');area.value=text;document.body.appendChild(area);area.select();document.execCommand('copy');area.remove();
    }
    setCopied(true);window.setTimeout(()=>setCopied(false),1800);
  }
  return <button type="button" className="p-btn p-small" onClick={()=>void copy()} disabled={!text}>{copied?<><Check className="p-i" aria-hidden="true"/>Copiado</>:<><Copy className="p-i" aria-hidden="true"/>{label}</>}</button>;
}

// UTMs y nombres de campañas: generador para Meta, regla de nombres, revisión de los anuncios
// activos (solo lectura) y links con UTMs para otros canales.
export default function UtmTools({canManage,onConnect}:{canManage:boolean;onConnect:()=>void}) {
  const [options,setOptions]=useState<MetaTagOptions>(DEFAULT_META_TAGS);
  const tags=metaUrlTags(options);
  const [audit,setAudit]=useState<Audit|null>(null);
  const [auditError,setAuditError]=useState(false);
  const [loading,setLoading]=useState(true);
  const [rule,setRule]=useState<NamingRule>(DEFAULT_NAMING_RULE);
  const [ruleSaved,setRuleSaved]=useState(false);
  const [ruleMessage,setRuleMessage]=useState('');
  const [parts,setParts]=useState<string[]>([]);
  const [link,setLink]=useState({base:'',channel:0,campaign:''});
  const [filter,setFilter]=useState<'all'|'issues'>('issues');

  const load=useCallback(async()=>{
    setLoading(true);setAuditError(false);
    try {
      const response=await fetch('/api/ads/utm',{cache:'no-store'});
      if(!response.ok)throw new Error();
      const data=await response.json() as Audit;
      setAudit(data);
      if(data.rule){setRule(data.rule);setRuleSaved(true);}
    } catch {setAuditError(true);}
    finally {setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);

  async function saveRule(next:NamingRule|null) {
    if(!canManage)return;
    setRuleMessage('');
    const response=await fetch('/api/ads/utm',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({rule:next})}).catch(()=>null);
    if(!response?.ok){setRuleMessage('No pudimos guardar la regla. Revisá que cada parte tenga nombre.');return;}
    setRuleSaved(Boolean(next));if(!next)setRule(DEFAULT_NAMING_RULE);
    setRuleMessage(next?'Regla guardada. Revisamos tus anuncios con ella.':'Regla borrada.');
    void load();
  }

  const name=buildName(rule.segments.map((_,index)=>parts[index]||''),rule);
  const channel=CHANNELS[link.channel];
  const tracked=link.base?buildTrackedUrl(link.base,{utm_source:channel.source,utm_medium:channel.medium,utm_campaign:link.campaign||'general'}):null;
  const rows=useMemo(()=>(audit?.ads||[]).filter(ad=>filter==='all'||ad.issues.length),[audit,filter]);

  return <>
    <div className="p-head"><div><div className="p-eyebrow">PUBLICIDAD · SEGUIMIENTO</div><h1>UTMs y nombres</h1><p>Con UTMs en cada anuncio, tu tienda y Google Analytics saben de qué campaña vino cada venta. Con nombres ordenados, encontrás todo más rápido.</p></div></div>

    <div className="p-grid p-g2 p-utmGrid" style={{marginBottom:16}}>
      <div className="p-card p-reveal">
        <div className="p-cardHead"><div><span className="p-eyebrowS">PASO 1 · META ADS</span><h3>Parámetros de URL para tus anuncios</h3><span className="p-sub">Copiá esto y pegalo en cada anuncio, en <b>Seguimiento → Parámetros de URL</b>. Meta completa solo el nombre de la campaña, el conjunto y el anuncio, así que sirve también cuando duplicás.</span></div></div>
        <div className="p-simChips" style={{marginBottom:10}}>
          {([['site','Fuente automática (fb / ig)'],['facebook','Siempre "facebook"'],['meta','Siempre "meta"']] as const).map(([value,label])=><button type="button" key={value} className={options.source===value?'p-on':undefined} onClick={()=>setOptions({...options,source:value})}>{label}</button>)}
        </div>
        <label className="p-check" style={{marginBottom:10}}><input type="checkbox" checked={options.includeIds} onChange={event=>setOptions({...options,includeIds:event.target.checked})}/><span>Incluir el ID de la campaña (recomendado: no cambia si renombrás)</span></label>
        <pre className="p-codeBox">{tags}</pre>
        <div style={{marginTop:10}}><CopyButton text={tags} label="Copiar parámetros"/></div>
      </div>

      <div className="p-card p-reveal" style={{'--i':1} as React.CSSProperties}>
        <div className="p-cardHead"><div><span className="p-eyebrowS">PASO 2 · ORDEN</span><h3>Regla de nombres de campañas</h3><span className="p-sub">Elegí las partes del nombre. Rentia arma el nombre y avisa qué campañas no la siguen.</span></div></div>
        <div className="p-simChips" style={{marginBottom:10}} role="group" aria-label="Separador">{SEPARATORS.map(separator=><button type="button" key={separator} className={rule.separator===separator?'p-on':undefined} disabled={!canManage} onClick={()=>setRule({...rule,separator})}>Separar con {separator}</button>)}</div>
        <div className="p-namingParts">
          {rule.segments.map((segment,index)=><div className="p-namingPart" key={index}>
            <input className="p-cellInput" value={segment} maxLength={30} disabled={!canManage} aria-label={`Nombre de la parte ${index+1}`} onChange={event=>setRule({...rule,segments:rule.segments.map((item,position)=>position===index?event.target.value:item)})}/>
            <input className="p-cellInput" value={parts[index]||''} maxLength={40} placeholder={`Ej.: ${['Ventas','Remeras','Frío','Video','Hot Sale','Mujer','Retargeting','Oct'][index]||'Valor'}`} aria-label={`Valor de ${segment}`} onChange={event=>setParts(current=>{const next=[...current];next[index]=event.target.value;return next;})}/>
            {canManage&&rule.segments.length>1&&<button type="button" className="p-iconBtn" aria-label={`Quitar ${segment}`} onClick={()=>{setRule({...rule,segments:rule.segments.filter((_,position)=>position!==index)});setParts(current=>current.filter((_,position)=>position!==index));}}><X aria-hidden="true"/></button>}
          </div>)}
          {canManage&&rule.segments.length<8&&<button type="button" className="p-btn p-small" style={{width:'fit-content'}} onClick={()=>setRule({...rule,segments:[...rule.segments,'Parte nueva']})}><Plus className="p-i" aria-hidden="true"/>Agregar parte</button>}
        </div>
        <pre className="p-codeBox">{name||rule.segments.join(rule.separator==='|'?' | ':rule.separator)}</pre>
        <div style={{display:'flex',gap:10,marginTop:10,flexWrap:'wrap',alignItems:'center'}}>
          <CopyButton text={parts.some(Boolean)?name:''} label="Copiar nombre"/>
          {canManage&&<button type="button" className="p-btn p-small p-primary" onClick={()=>void saveRule(rule)}>{ruleSaved?'Guardar cambios':'Usar esta regla'}</button>}
          {canManage&&ruleSaved&&<button type="button" className="p-btn p-small" onClick={()=>void saveRule(null)}>No revisar nombres</button>}
          {ruleMessage&&<span className="p-sub" role="status">{ruleMessage}</span>}
        </div>
      </div>
    </div>

    <div className="p-card p-reveal" style={{marginBottom:16}}>
      <div className="p-cardHead"><div><span className="p-eyebrowS">PASO 3 · REVISIÓN</span><h3>Tus anuncios activos en Meta</h3><span className="p-sub">{audit?.account?`Cuenta ${audit.account.name}. `:''}Solo leemos: Rentia no cambia nada en tus anuncios.</span></div>
        <div className="p-actions"><div className="p-tabs"><button type="button" className={filter==='issues'?'p-on':undefined} onClick={()=>setFilter('issues')}>Con avisos</button><button type="button" className={filter==='all'?'p-on':undefined} onClick={()=>setFilter('all')}>Todos</button></div><button type="button" className="p-btn p-small" onClick={()=>void load()} disabled={loading}><RefreshCw className="p-i" aria-hidden="true"/>{loading?'Revisando…':'Revisar de nuevo'}</button></div></div>
      {auditError?<div className="p-notice p-warning" role="alert"><div><b>No pudimos leer tus anuncios de Meta</b><p>Puede ser un corte momentáneo de Meta o que haya que reconectar la cuenta. Probá de nuevo en unos minutos.</p></div></div>
      :loading&&!audit?<div className="p-empty">Revisando tus anuncios…</div>
      :audit&&!audit.connected?<div className="p-soon"><div><h2>Conectá Meta Ads</h2><p className="p-sub">Así revisamos las UTMs y los nombres de tus anuncios activos.</p><button type="button" className="p-btn p-primary" onClick={onConnect}>Ir a integraciones</button></div></div>
      :audit&&!audit.account?<div className="p-empty">Elegí una cuenta publicitaria de Meta en la pestaña Meta Ads para revisar sus anuncios.</div>
      :audit?.summary&&<>
        <div className="p-grid p-g4" style={{marginBottom:14}}>
          <div className="p-card p-kpi"><small>Anuncios activos</small><b className="p-mono">{audit.summary.total}</b></div>
          <div className={`p-card p-kpi ${audit.summary.total&&audit.summary.withUtm===audit.summary.total?'p-tone-g':''}`}><small>Con UTMs completas</small><b className="p-mono">{audit.summary.withUtm}</b><span className="p-sub">{audit.summary.total?`${Math.round(audit.summary.withUtm/audit.summary.total*100)}% de los activos`:'—'}</span></div>
          <div className={`p-card p-kpi ${audit.summary.withoutUtm+audit.summary.incomplete?'p-tone-r':''}`}><small>Sin UTMs o incompletas</small><b className="p-mono">{audit.summary.withoutUtm+audit.summary.incomplete}</b><span className="p-sub">Sus ventas no se pueden atribuir</span></div>
          <div className="p-card p-kpi"><small>Fuera de la regla</small><b className="p-mono">{ruleSaved?audit.summary.badNames:'—'}</b><span className="p-sub">{ruleSaved?'Campañas con otro formato':'Guardá una regla para revisarlo'}</span></div>
        </div>
        {!audit.summary.total?<div className="p-empty">No hay anuncios activos en esta cuenta.</div>
        :!rows.length?<div className="p-empty">Todo en orden: tus anuncios activos tienen UTMs{ruleSaved?' y siguen la regla':''}.</div>
        :<div className="p-tableWrap"><table>
          <thead><tr><th>Anuncio</th><th>Campaña</th><th>UTMs</th><th>Avisos</th></tr></thead>
          <tbody>{rows.slice(0,100).map(ad=><tr key={ad.id}>
            <td><b className="p-campaignName" title={ad.name}>{ad.name}</b><br/><small className="p-sub">{ad.adsetName}</small></td>
            <td><span className="p-campaignName" title={ad.campaignName}>{ad.campaignName}</span></td>
            <td><small className="p-mono p-sub">{['utm_source','utm_medium','utm_campaign'].map(key=>`${key.slice(4)}: ${ad.params[key]||'—'}`).join(' · ')}</small></td>
            <td>{ad.issues.length?<span className="p-chips">{ad.issues.map(issue=><span key={issue} className={`p-chip ${issueTone[issue]}`}>{ISSUE_LABELS[issue]}</span>)}</span>:<span className="p-chip p-g">En orden</span>}</td>
          </tr>)}</tbody>
        </table></div>}
        {audit.summary.fixed>0&&<p className="p-sub" style={{marginTop:10}}><b>UTM de campaña fija:</b> el anuncio tiene escrito a mano un nombre de campaña distinto al real (pasa al duplicar). Usá los parámetros del paso 1 para que se complete solo.</p>}
      </>}
    </div>

    <div className="p-card p-reveal">
      <div className="p-cardHead"><div><span className="p-eyebrowS">OTROS CANALES</span><h3>Links con UTMs</h3><span className="p-sub">Para la bio de Instagram, WhatsApp, emails o influencers: así sabés qué ventas trajo cada uno.</span></div></div>
      <div className="p-utmLink">
        <div className="p-field"><label htmlFor="utm-base">Link de tu tienda o producto</label><div className="p-input"><input id="utm-base" value={link.base} onChange={event=>setLink({...link,base:event.target.value})} placeholder="mitienda.com.ar/productos/remera"/></div></div>
        <div className="p-field"><label htmlFor="utm-campaign">Nombre de la acción</label><div className="p-input"><input id="utm-campaign" value={link.campaign} maxLength={60} onChange={event=>setLink({...link,campaign:event.target.value})} placeholder="hot sale"/></div></div>
      </div>
      <div className="p-simChips" style={{margin:'12px 0'}}>{CHANNELS.map((item,index)=><button type="button" key={item.label} className={link.channel===index?'p-on':undefined} onClick={()=>setLink({...link,channel:index})}>{item.label}</button>)}</div>
      {link.base&&!tracked?<p className="p-sub p-warnLine">Revisá el link: tiene que ser una dirección web, como mitienda.com.ar.</p>
      :tracked?<><pre className="p-codeBox">{tracked}</pre><div style={{marginTop:10}}><CopyButton text={tracked} label="Copiar link"/></div></>:null}
    </div>
  </>;
}
