'use client';

import { campaignTotals, LIMIT_ABOVE, LIMIT_BELOW, type CampaignProfitRow } from '../../lib/campaign-profit';

const verdictChip:Record<CampaignProfitRow['verdict'],[string,string]>={gana:['Rentable','p-g'],limite:['Al límite','p-a'],pierde:['Pierde plata','p-r'],'sin-margen':['Falta margen','p-n']};
const ratio=(value:number|null)=>value===null?'—':`${value.toFixed(2).replace('.',',')}x`;
const percent=(value:number|null)=>value===null?'—':`${(value*100).toFixed(1).replace('.',',')} %`;

type Brand={breakEven:number|null;roas:number|null;margin:number|null};
type ProductBreakEven={name:string;margin:number;breakEven:number|null;units:number};

// ROAS de equilibrio de la marca: la barra va de 0 a un poco más que el mayor de los dos valores,
// pintada en rojo (pierde), amarillo (al límite) y verde (rentable).
function BrandBreakEven({brand}:{brand:Brand}) {
  const breakEven=brand.breakEven;
  if(breakEven===null)return <div className="p-card p-reveal"><span className="p-eyebrowS">ROAS DE EQUILIBRIO DE TU MARCA</span><div className="p-beBig p-mono">—</div><p className="p-sub">Para calcularlo necesitamos órdenes con todos sus costos cargados.</p></div>;
  const max=Math.max(breakEven*2,(brand.roas||0)*1.15),at=(value:number)=>`${Math.min(100,value/max*100)}%`;
  const red=breakEven*LIMIT_BELOW/max*100,amber=breakEven*LIMIT_ABOVE/max*100;
  const roas=brand.roas,state=roas===null?null:roas>=breakEven*LIMIT_ABOVE?'Rentable':roas>=breakEven*LIMIT_BELOW?'Al límite':'Pierde plata';
  return <div className="p-card p-reveal">
    <span className="p-eyebrowS">ROAS DE EQUILIBRIO DE TU MARCA</span>
    <div className="p-beBig p-mono">{ratio(breakEven)}</div>
    <p className="p-sub" style={{margin:'2px 0 0'}}>Cada $ 1 en publicidad tiene que traer {`$ ${breakEven.toFixed(2).replace('.',',')}`} en ventas para no perder plata. Sale de tu margen real antes de publicidad ({percent(brand.margin)}) y se recalcula solo cuando cambian tus costos.</p>
    <div className="p-beGauge" style={{background:`linear-gradient(90deg,#ff6678 0 ${red}%,#f5c451 ${red}% ${amber}%,#32d583 ${amber}% 100%)`}} role="img" aria-label={`ROAS de equilibrio ${ratio(breakEven)}${roas!==null?`, tu ROAS ${ratio(roas)}`:''}`}>
      <i style={{left:at(breakEven)}}/><span style={{left:at(breakEven)}}>Equilibrio {ratio(breakEven)}</span>
      {roas!==null&&<><i style={{left:at(roas)}}/><span className="p-beYou" style={{left:at(roas)}}>Vos {ratio(roas)}</span></>}
    </div>
    <div className="p-beLegend"><span>Pierde plata</span><span>Al límite</span><span>Rentable</span></div>
    {state&&<p className="p-sub" style={{margin:'10px 0 0'}}>Tu ROAS general (toda la facturación de la tienda sobre toda la inversión) está <b style={{color:'var(--text)'}}>{state==='Rentable'?'en zona rentable':state==='Al límite'?'al límite':'abajo del equilibrio'}</b>.</p>}
  </div>;
}

function ProductBreakEvens({products}:{products:ProductBreakEven[]}) {
  return <div className="p-card p-reveal" style={{'--i':1} as React.CSSProperties}>
    <span className="p-eyebrowS">ROAS MÍNIMO POR PRODUCTO</span>
    {products.length?<ul className="p-beList">{products.map(product=><li key={product.name}><span title={product.name}><span className="p-beName">{product.name}</span><small className="p-sub"> · margen {percent(product.margin)}</small></span><b className={`p-mono ${product.breakEven===null||product.breakEven>8?'p-neg':''}`}>{product.breakEven===null?'No deja margen':ratio(product.breakEven)}</b></li>)}</ul>
    :<p className="p-sub">Aparece cuando tus productos más vendidos tienen el costo cargado.</p>}
    <p className="p-sub" style={{fontSize:12,margin:'8px 0 0'}}>Cuanto más bajo, más fácil es que una campaña de ese producto deje plata.</p>
  </div>;
}

// Ganancia estimada por campaña de Meta Ads y Mercado Libre Product Ads.
export default function CampaignProfit({rows,money,metaMargin,meliMargin,metaComparable,meliComparable,metaConnected,meliConnected,period,onNavigate,brand,products=[]}:{rows:CampaignProfitRow[];money:(value:number)=>string;metaMargin:number|null;meliMargin:number|null;metaComparable:boolean;meliComparable:boolean;metaConnected:boolean;meliConnected:boolean;period:string;onNavigate:(section:string)=>void;brand?:Brand;products?:ProductBreakEven[]}) {
  const totals=campaignTotals(rows);
  const marginMissing=(metaConnected&&metaMargin===null)||(meliConnected&&meliMargin===null);
  return <>
    <div className="p-head"><div><div className="p-eyebrow">PUBLICIDAD · {period}</div><h1>Ganancia por campaña</h1><p>Cuánta plata deja o se lleva cada campaña después de pagar productos, envíos, comisiones, impuestos y la propia publicidad.</p></div></div>
    {brand&&(metaConnected||meliConnected)&&<div className="p-beGrid"><BrandBreakEven brand={brand}/><ProductBreakEvens products={products}/></div>}
    <div className="p-grid p-g4" style={{marginBottom:16}}>
      <div className={`p-card p-kpi p-reveal ${totals.profit<0?'p-tone-r':'p-hero'}`}><small>Ganancia estimada total</small><b className="p-mono">{rows.length?money(totals.profit):'—'}</b><span className="p-sub">Sumando todas las campañas con margen</span></div>
      <div className="p-card p-kpi p-reveal" style={{'--i':1} as React.CSSProperties}><small>Rentables</small><b className="p-mono">{totals.winners}</b><span className="p-sub">{totals.atLimit?`${totals.atLimit} más al límite`:`de ${rows.length} con inversión`}</span></div>
      <div className={`p-card p-kpi p-reveal ${totals.losers?'p-tone-r':''}`} style={{'--i':2} as React.CSSProperties}><small>Pierden plata</small><b className="p-mono">{totals.losers}</b><span className="p-sub">{totals.losers?`${money(Math.abs(totals.lost))} estimados`:'Ninguna en el período'}</span></div>
      <div className="p-card p-kpi p-reveal" style={{'--i':3} as React.CSSProperties}><small>Margen aplicado</small><b className="p-mono" style={{fontSize:20}}>{metaConnected?`Meta ${percent(metaMargin)}`:''}{metaConnected&&meliConnected?' · ':''}{meliConnected?`ML ${percent(meliMargin)}`:''}{!metaConnected&&!meliConnected?'—':''}</b><span className="p-sub">Margen real del canal antes de publicidad</span></div>
    </div>
    {marginMissing&&<div className="p-notice p-warning" role="status"><div><b>Falta el margen de un canal</b><p>Para estimar la ganancia necesitamos al menos algunas órdenes con todos sus costos cargados en ese canal.</p></div><button type="button" className="p-btn p-small" onClick={()=>onNavigate('costos')}>Completar costos</button></div>}
    {(!metaComparable&&metaConnected)||(!meliComparable&&meliConnected)?<div className="p-note">Una cuenta publicitaria está en otra moneda que tu tienda: sus campañas se muestran pero sin comparar contra el margen.</div>:null}
    {!metaConnected&&!meliConnected?<div className="p-card p-soon"><div><h2>Conectá tu publicidad</h2><p className="p-sub">Con Meta Ads o Mercado Libre Product Ads vas a ver qué campañas dejan ganancia y cuáles la pierden.</p><button type="button" className="p-btn p-primary" onClick={()=>onNavigate('integraciones')}>Ir a integraciones</button></div></div>
    :!rows.length?<div className="p-empty">No hay campañas con inversión en este período.</div>
    :<div className="p-tableWrap p-reveal"><table>
      <thead><tr><th>Campaña</th><th className="p-r">Presupuesto</th><th className="p-r">Inversión</th><th className="p-r">Ventas atribuidas</th><th className="p-r">ROAS</th><th className="p-r">Equilibrio</th><th className="p-r">Ganancia estimada</th><th>Estado</th></tr></thead>
      <tbody>{rows.map(row=>{const [label,tone]=verdictChip[row.verdict];return <tr key={row.key}>
        <td><span className="p-chan"><img src={row.channel==='meta'?'/brands/meta.png':'/brands/mercado-libre-icon.png'} alt=""/><span className="p-campaignName" title={row.name}>{row.name}<br/><small className="p-sub">{row.channel==='meta'?'Meta Ads':'Mercado Libre Ads'}{row.active?'':' · pausada'}</small></span></span></td>
        <td className="p-r p-mono">{row.dailyBudget?<>{money(row.dailyBudget)}<small className="p-sub">/día</small></>:'—'}</td>
        <td className="p-r p-mono">{money(row.spend)}</td>
        <td className="p-r p-mono">{money(row.revenue)}</td>
        <td className="p-r p-mono"><b>{ratio(row.spend?row.roas:null)}</b></td>
        <td className="p-r p-mono">{ratio(row.breakEvenRoas)}</td>
        <td className={`p-r p-mono ${row.profit===null?'':row.profit<0?'p-neg':'p-pos'}`}>{row.profit===null?'—':money(row.profit)}</td>
        <td><span className={`p-chip ${tone}`}>{label}</span></td>
      </tr>;})}</tbody>
    </table></div>}
    <div className="p-note p-reveal" style={{marginTop:16}}><b>Cómo se calcula:</b> ventas que la plataforma atribuye a la campaña × tu margen real del canal antes de publicidad − inversión. El <b>equilibrio</b> es el ROAS mínimo para no perder plata. <b>Rentable</b>: ROAS al menos 15 % arriba del equilibrio. <b>Al límite</b>: entre un 5 % abajo y un 15 % arriba. Es una estimación: las órdenes todavía no traen la campaña que las generó.</div>
  </>;
}
