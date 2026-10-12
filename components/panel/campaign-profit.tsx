'use client';

import { campaignTotals, type CampaignProfitRow } from '../../lib/campaign-profit';

const verdictChip:Record<CampaignProfitRow['verdict'],[string,string]>={gana:['Deja ganancia','p-g'],equilibrio:['En equilibrio','p-a'],pierde:['Pierde plata','p-r'],'sin-margen':['Falta margen','p-n']};
const ratio=(value:number|null)=>value===null?'—':`${value.toFixed(2).replace('.',',')}x`;
const percent=(value:number|null)=>value===null?'—':`${(value*100).toFixed(1).replace('.',',')}%`;

// Ganancia estimada por campaña de Meta Ads y Mercado Libre Product Ads.
export default function CampaignProfit({rows,money,metaMargin,meliMargin,metaComparable,meliComparable,metaConnected,meliConnected,period,onNavigate}:{rows:CampaignProfitRow[];money:(value:number)=>string;metaMargin:number|null;meliMargin:number|null;metaComparable:boolean;meliComparable:boolean;metaConnected:boolean;meliConnected:boolean;period:string;onNavigate:(section:string)=>void}) {
  const totals=campaignTotals(rows);
  const marginMissing=(metaConnected&&metaMargin===null)||(meliConnected&&meliMargin===null);
  return <>
    <div className="p-head"><div><div className="p-eyebrow">PUBLICIDAD · {period}</div><h1>Ganancia por campaña</h1><p>Cuánta plata deja o se lleva cada campaña después de pagar productos, envíos, comisiones, impuestos y la propia publicidad.</p></div></div>
    <div className="p-grid p-g4" style={{marginBottom:16}}>
      <div className={`p-card p-kpi p-reveal ${totals.profit<0?'p-tone-r':'p-hero'}`}><small>Ganancia estimada total</small><b className="p-mono">{rows.length?money(totals.profit):'—'}</b><span className="p-sub">Sumando todas las campañas con margen</span></div>
      <div className="p-card p-kpi p-reveal" style={{'--i':1} as React.CSSProperties}><small>Campañas que ganan</small><b className="p-mono">{totals.winners}</b><span className="p-sub">de {rows.length} con inversión</span></div>
      <div className={`p-card p-kpi p-reveal ${totals.losers?'p-tone-r':''}`} style={{'--i':2} as React.CSSProperties}><small>Campañas que pierden</small><b className="p-mono">{totals.losers}</b><span className="p-sub">{totals.losers?`${money(Math.abs(totals.lost))} estimados`:'Ninguna en el período'}</span></div>
      <div className="p-card p-kpi p-reveal" style={{'--i':3} as React.CSSProperties}><small>Margen aplicado</small><b className="p-mono" style={{fontSize:20}}>{metaConnected?`Meta ${percent(metaMargin)}`:''}{metaConnected&&meliConnected?' · ':''}{meliConnected?`ML ${percent(meliMargin)}`:''}{!metaConnected&&!meliConnected?'—':''}</b><span className="p-sub">Margen real del canal antes de publicidad</span></div>
    </div>
    {marginMissing&&<div className="p-notice p-warning" role="status"><div><b>Falta el margen de un canal</b><p>Para estimar la ganancia necesitamos al menos algunas órdenes con todos sus costos cargados en ese canal.</p></div><button type="button" className="p-btn p-small" onClick={()=>onNavigate('costos')}>Completar costos</button></div>}
    {(!metaComparable&&metaConnected)||(!meliComparable&&meliConnected)?<div className="p-note">Una cuenta publicitaria está en otra moneda que tu tienda: sus campañas se muestran pero sin comparar contra el margen.</div>:null}
    {!metaConnected&&!meliConnected?<div className="p-card p-soon"><div><h2>Conectá tu publicidad</h2><p className="p-sub">Con Meta Ads o Mercado Libre Product Ads vas a ver qué campañas dejan ganancia y cuáles la pierden.</p><button type="button" className="p-btn p-primary" onClick={()=>onNavigate('integraciones')}>Ir a integraciones</button></div></div>
    :!rows.length?<div className="p-empty">No hay campañas con inversión en este período.</div>
    :<div className="p-tableWrap p-reveal"><table>
      <thead><tr><th>Campaña</th><th className="p-r">Inversión</th><th className="p-r">Ventas atribuidas</th><th className="p-r">ROAS</th><th className="p-r">Equilibrio</th><th className="p-r">Ganancia estimada</th><th>Estado</th></tr></thead>
      <tbody>{rows.map(row=>{const [label,tone]=verdictChip[row.verdict];return <tr key={row.key}>
        <td><span className="p-chan"><img src={row.channel==='meta'?'/brands/meta.png':'/brands/mercado-libre-icon.png'} alt=""/><span className="p-campaignName" title={row.name}>{row.name}<br/><small className="p-sub">{row.channel==='meta'?'Meta Ads':'Mercado Libre Ads'}{row.active?'':' · pausada'}</small></span></span></td>
        <td className="p-r p-mono">{money(row.spend)}</td>
        <td className="p-r p-mono">{money(row.revenue)}</td>
        <td className="p-r p-mono">{ratio(row.spend?row.roas:null)}</td>
        <td className="p-r p-mono">{ratio(row.breakEvenRoas)}</td>
        <td className={`p-r p-mono ${row.profit===null?'':row.profit<0?'p-neg':'p-pos'}`}>{row.profit===null?'—':money(row.profit)}</td>
        <td><span className={`p-chip ${tone}`}>{label}</span></td>
      </tr>;})}</tbody>
    </table></div>}
    <div className="p-note p-reveal" style={{marginTop:16}}><b>Cómo se calcula:</b> ventas que la plataforma atribuye a la campaña × tu margen real del canal antes de publicidad − inversión. El <b>equilibrio</b> es el ROAS mínimo para no perder plata. Es una estimación: las órdenes todavía no traen la campaña que las generó.</div>
  </>;
}
