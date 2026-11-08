'use client';

import RpClamp from '../../../components/panel/rp-clamp';
import { useContext, useState } from 'react';
import { RefreshCw, Search, Download } from 'lucide-react';
import MetaAccountPicker from '../../../components/meta-account-picker';
import { MetaAdsData, Dashboard, AccessContext, useMoney, downloadCsv, TermHelp, ComingSoonSection } from '../shared';

export function AdvertisingSection({connected,data,dashboard,period,syncing,message,onSync,onConnect,onAccountChange}:{connected:boolean;data:MetaAdsData|null;dashboard:Dashboard|null;period:string;syncing:boolean;message:string;onSync:()=>void;onConnect:()=>void;onAccountChange:(accountId:string)=>void}) {
  const canManage=useContext(AccessContext);
  const money=useMoney();
  const [query,setQuery]=useState('');
  if(!connected) return <ComingSoonSection eyebrow="META ADS" title="Conectá tu cuenta publicitaria" description="Rentia importará inversión, compras atribuidas, ROAS y CPA por campaña con permisos de solo lectura." action="Conectar Meta Ads" onAction={onConnect}/>;
  const currency=data?.selected?.currency||'ARS';
  const summary=data?.summary;
  const comparable=Boolean(dashboard?.metrics.adSpendComparable);
  const attributedRevenue=summary?.purchaseValue||0;
  const observedRevenue=comparable?dashboard?.metrics.revenue||0:0;
  const comparisonMax=Math.max(1,attributedRevenue,observedRevenue);
  const reportedRoas=summary?.reportedRoas||0;
  const globalRoas=comparable&&summary?.spend?observedRevenue/summary.spend:0;
  const roasDifference=reportedRoas?((globalRoas/reportedRoas)-1)*100:0;
  const insight=!summary?.spend
    ? {tone:'neutral',title:'Todavía no hay inversión en este período',detail:'Probá otro rango de fechas o actualizá Meta para traer los últimos resultados.'}
    : !comparable
      ? {tone:'warning',title:'Las monedas no coinciden',detail:'Podemos mostrar los datos de Meta, pero no compararlos con la facturación de la tienda hasta unificar la moneda.'}
      : roasDifference>=0
        ? {tone:'positive',title:`El ROAS total es ${Math.abs(roasDifference).toFixed(1)}% mayor que el atribuido por Meta`,detail:'Hay ventas cobradas en la tienda que Meta no se adjudica. Para rentabilidad mirá el ROAS total; para optimizar campañas, el atribuido.'}
        : {tone:'warning',title:`Meta atribuye un ROAS ${Math.abs(roasDifference).toFixed(1)}% mayor que el total`,detail:'Revisá la atribución antes de escalar: la plataforma adjudica más valor que el observado en la facturación completa.'};
  const campaigns=(data?.campaigns||[]).filter(campaign=>campaign.name.toLowerCase().includes(query.toLowerCase()));
  const statusLabel=(value:string|null)=>value==='ACTIVE'?'Activa':value==='PAUSED'?'Pausada':value==='ARCHIVED'?'Archivada':value||'Sin estado';
  const exportRows=()=>downloadCsv(`rentia-meta-${period.replace(' ','-')}.csv`,['Campaña','Estado','Inversión','Compras atribuidas','Valor atribuido','ROAS Meta','CPA','Impresiones','Clics'],campaigns.map(row=>[row.name,statusLabel(row.effective_status||row.status),row.spend,row.purchases,row.purchase_value,row.reported_roas.toFixed(2),row.cpa.toFixed(2),row.impressions,row.clicks]));
  return <>
    <div className="p-head"><div><div className="p-eyebrow"><img className="p-mini" src="/brands/meta.png" alt=""/> META ADS · DATOS REALES</div><h1>Publicidad y <em>campañas</em></h1><p>Comparamos lo que Meta se atribuye con la facturación completa de tu tienda. Son dos lecturas distintas y Rentia las mantiene claramente separadas.</p></div><div className="p-actions">{!!data?.accounts.length&&<MetaAccountPicker accounts={data.accounts} value={data.selected?.external_account_id||''} onChange={onAccountChange} disabled={syncing||!canManage}/>}<button type="button" className={`p-btn p-primary ${syncing?'p-spin':''}`} onClick={onSync} disabled={syncing||!canManage}><RefreshCw className="p-i" aria-hidden="true"/>{syncing?'Actualizando…':'Actualizar Meta'}</button></div></div>
    {message&&<div className="p-note">{message}</div>}
    {data?.sync?.last_error&&<div className="p-note p-warn">{data.sync.last_error}</div>}
    {!data?.selected?<div className="p-card p-soon p-reveal"><div><img src="/brands/meta.png" alt="" style={{width:44,height:44,marginBottom:12}}/><h2 style={{margin:'0 0 8px'}}>No encontramos cuentas publicitarias</h2><p className="p-sub" style={{margin:'0 auto 18px',maxWidth:460}}>Verificá que el usuario autorizado tenga acceso a una cuenta de anuncios dentro de Meta Business.</p><a className="p-btn p-primary" href="/api/integrations/meta/start">Reautorizar Meta</a></div></div>:<>
      <div className="p-grid p-g6" style={{marginBottom:16}}>
        <div className="p-card p-kpi p-reveal"><small>Inversión <TermHelp term="Inversión"/></small><b className="p-mono" style={{fontSize:20}}>{money(summary?.spend||0,currency)}</b><span className="p-sub" style={{fontSize:11.5}}>Gasto total en Meta Ads</span></div>
        <div className="p-card p-kpi p-reveal" style={{'--i':1} as React.CSSProperties}><small>ROAS atribuido <TermHelp term="ROAS"/></small><b className="p-mono" style={{fontSize:20}}>{reportedRoas.toFixed(2).replace('.',',')}x</b><span className="p-sub" style={{fontSize:11.5}}>{money(attributedRevenue,currency)} atribuidos por Meta</span></div>
        <div className="p-card p-kpi p-hero p-reveal" style={{'--i':2} as React.CSSProperties}><small>ROAS total tienda <TermHelp term="ROAS total tienda"/></small><b className="p-mono" style={{fontSize:20}}>{comparable?`${globalRoas.toFixed(2).replace('.',',')}x`:'—'}</b><span className="p-sub" style={{fontSize:11.5}}>{comparable?'Facturación completa / inversión':'Las monedas no coinciden'}</span></div>
        <div className="p-card p-kpi p-reveal" style={{'--i':3} as React.CSSProperties}><small>CPA atribuido <TermHelp term="CPA"/></small><b className="p-mono" style={{fontSize:20}}>{summary?.purchases?money(summary.cpa,currency):'—'}</b><span className="p-sub" style={{fontSize:11.5}}>{(summary?.purchases||0).toLocaleString('es-AR')} compras atribuidas</span></div>
        <div className="p-card p-kpi p-reveal" style={{'--i':4} as React.CSSProperties}><small>Impresiones</small><b className="p-mono" style={{fontSize:20}}>{(summary?.impressions||0).toLocaleString('es-AR')}</b><span className="p-sub" style={{fontSize:11.5}}>CTR {(summary?.ctr||0).toFixed(2).replace('.',',')}% <TermHelp term="CTR"/></span></div>
        <div className="p-card p-kpi p-reveal" style={{'--i':5} as React.CSSProperties}><small>Clics</small><b className="p-mono" style={{fontSize:20}}>{(summary?.clicks||0).toLocaleString('es-AR')}</b><span className="p-sub" style={{fontSize:11.5}}>CPC {summary?.clicks?money(summary.cpc,currency):'—'} <TermHelp term="CPC"/></span></div>
      </div>
      <div className="p-grid p-g2" style={{marginBottom:16}}>
        <div className="p-card p-reveal"><div className="p-cmpRow"><img src="/brands/meta.png" alt="Meta"/><div><small className="p-sub">Ventas atribuidas por Meta</small><b className="p-mono">{money(attributedRevenue,currency)}</b><div className="p-meter"><i style={{width:`${attributedRevenue/comparisonMax*100}%`}}/></div></div><b className="p-mono">{reportedRoas.toFixed(2).replace('.',',')}x ROAS</b></div><div className="p-cmpRow"><img src="/favicon.svg" alt="Rentia"/><div><small className="p-sub">Facturación total de la tienda</small><b className="p-mono">{comparable?money(observedRevenue,currency):'Moneda no comparable'}</b><div className="p-meter"><i style={{width:`${comparable?observedRevenue/comparisonMax*100:0}%`,background:'linear-gradient(90deg,var(--cyan),var(--green))'}}/></div></div><b className="p-mono" style={{color:'var(--cyan)'}}>{comparable?`${globalRoas.toFixed(2).replace('.',',')}x total`:'—'}</b></div></div>
        <div className={`p-card p-reveal p-insight ${insight.tone==='positive'?'p-pos':insight.tone==='warning'?'p-warnInsight':''}`} style={{'--i':1} as React.CSSProperties}><span className="p-eyebrowS">LECTURA RÁPIDA</span><h3 style={{margin:'6px 0'}}>{insight.title}</h3><p className="p-sub" style={{margin:0}}>{insight.detail}</p></div>
      </div>
      <div className="p-toolbar"><label className="p-search"><Search className="p-i" aria-hidden="true"/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar campaña" aria-label="Buscar campaña"/></label><span className="p-sub">{campaigns.length} campañas · {period}</span><button type="button" className="p-btn" style={{marginLeft:'auto'}} onClick={exportRows}><Download className="p-i" aria-hidden="true"/>Exportar CSV</button></div>
      <div className="p-tableWrap p-reveal" style={{marginBottom:16}}><table><thead><tr><th>Campaña</th><th>Estado</th><th className="p-r">Inversión</th><th className="p-r">Compras</th><th className="p-r">Ventas Meta</th><th className="p-r">ROAS Meta <TermHelp term="ROAS"/></th><th className="p-r">CPA <TermHelp term="CPA"/></th></tr></thead><tbody>{campaigns.map(campaign=>{const status=(campaign.effective_status||campaign.status||'').toUpperCase();return <tr key={campaign.external_campaign_id}><td><RpClamp text={campaign.name}/><br/><small className="p-sub">{campaign.daily_budget?`${money(campaign.daily_budget,currency)} / día`:campaign.lifetime_budget?`${money(campaign.lifetime_budget,currency)} total`:'Presupuesto en conjunto de anuncios'}</small></td><td><span className={`p-chip ${status==='ACTIVE'?'p-g':'p-n'}`}>{statusLabel(campaign.effective_status||campaign.status)}</span></td><td className="p-r p-mono">{money(campaign.spend,currency)}</td><td className="p-r p-mono">{campaign.purchases.toLocaleString('es-AR')}</td><td className="p-r p-mono">{money(campaign.purchase_value,currency)}</td><td className="p-r p-mono">{campaign.reported_roas.toFixed(2).replace('.',',')}x</td><td className="p-r p-mono">{campaign.purchases?money(campaign.cpa,currency):'—'}</td></tr>;})}{!campaigns.length&&<tr><td colSpan={7} className="p-empty">{syncing?'Importando campañas…':'No hay campañas para este período o búsqueda.'}</td></tr>}</tbody></table></div>
      <div className="p-note p-reveal"><b>Cómo leer estos números.</b> “ROAS Meta” usa compras y valores atribuidos por la plataforma. “ROAS global tienda” divide toda la facturación cobrada de la tienda por la inversión publicitaria. Para medir ganancia por campaña necesitaremos sumar atribución propia mediante Pixel/CAPI; no la estimamos.<br/><span className="p-sub">{data.sync?.last_completed_at?`Última sincronización: ${new Date(data.sync.last_completed_at).toLocaleString('es-AR')}`:'Esperando la primera sincronización'}</span></div>
    </>}
  </>;
}

