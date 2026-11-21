'use client';

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { channelRates, priceForMargin, simulateLaunch, type ChannelInput, type SimulationInput } from '../../lib/launch-simulator';
import { argentinaDay } from '../../lib/local-date';
import RpSelect from './rp-select';

type Channel=ChannelInput&{provider:string;label:string};
type Scenario={id:string;name:string;channel:string;input:SimulationInput};
type CatalogRow={provider:string;external_variant_id:string;product_name:string;sku:string|null;price:number;effective_cost:number;cost_source:string;rentia_archived:number;units_sold:number};

// Normaliza para buscar sin importar mayúsculas ni tildes.
const plain=(text:string)=>text.toLocaleLowerCase('es-AR').normalize('NFD').replace(/[̀-ͯ]/g,'');

const DAY=24*60*60*1000;
const iso=(value:number)=>new Date(value).toISOString().slice(0,10);
const pct=(value:number|null)=>value===null?'—':`${(value*100).toFixed(1).replace('.',',')} %`;
const ratio=(value:number|null)=>value===null?'—':`${value.toFixed(2).replace('.',',')}x`;
const number=(text:string)=>Number(text.replace(/\./g,'').replace(',','.'))||0;
const STORAGE='rentia-simulador';
// Los escenarios guardados quedan en este navegador; si no hay almacenamiento, no se guardan.
const loadScenarios=():Scenario[]=>{try{return JSON.parse(window.localStorage.getItem(STORAGE)||'[]');}catch{return [];}};
const storeScenarios=(list:Scenario[])=>{try{window.localStorage.setItem(STORAGE,JSON.stringify(list.slice(0,12)));}catch{/* sin almacenamiento */}};

// Simulador de lanzamiento: margen real de un producto nuevo o combo antes de subirlo.
export default function LaunchSimulator({money}:{money:(value:number)=>string}) {
  const [channels,setChannels]=useState<Channel[]|null>(null);
  const [error,setError]=useState(false);
  const [name,setName]=useState('Producto nuevo');
  const [channel,setChannel]=useState('');
  const [price,setPrice]=useState('');
  const [cost,setCost]=useState('');
  const [discount,setDiscount]=useState('0');
  const [freeShipping,setFreeShipping]=useState(true);
  const [surcharge,setSurcharge]=useState('0');
  const [target,setTarget]=useState('40');
  const [scenarios,setScenarios]=useState<Scenario[]>([]);
  const [catalog,setCatalog]=useState<CatalogRow[]>([]);
  const [query,setQuery]=useState('');
  useEffect(()=>{
    queueMicrotask(()=>setScenarios(loadScenarios()));
    const today=argentinaDay(new Date().toISOString()),base=Date.parse(`${today}T00:00:00Z`),range=`start=${iso(base-60*DAY)}&end=${iso(base-DAY)}`;
    fetch(`/api/dashboard?${range}`,{cache:'no-store'}).then(response=>response.ok?response.json():Promise.reject(new Error('dashboard')))
      .then((data:{channels?:Channel[]})=>{const list=(data.channels||[]).filter(row=>row.orders>0&&row.revenue>0&&row.provider!=='external');setChannels(list);setChannel(current=>current||list[0]?.provider||'');})
      .catch(()=>setError(true));
    // Catálogo para partir de un producto existente (si falla, el simulador funciona igual).
    fetch(`/api/products/analytics?${range}`,{cache:'no-store'}).then(response=>response.ok?response.json():null)
      .then((data:{products?:CatalogRow[]}|null)=>setCatalog((data?.products||[]).filter(row=>!row.rentia_archived&&row.price>0)))
      .catch(()=>undefined);
  },[]);

  const head=<div className="p-head"><div><div className="p-eyebrow">ANTES DE LANZAR</div><h1>Simulador de <em>lanzamiento</em></h1><p>Cargá el precio y el costo de un producto nuevo o de un combo y mirá cuánto te deja de verdad, con las comisiones, impuestos y envíos reales de tu tienda.</p></div></div>;
  if(error)return <>{head}<div className="p-card p-empty">No pudimos cargar tus costos de los últimos 60 días. Probá de nuevo en unos minutos.</div></>;
  if(!channels)return <>{head}<div className="p-card p-empty">Buscando tus costos reales…</div></>;
  if(!channels.length)return <>{head}<div className="p-card p-empty">Necesitamos ventas de los últimos 60 días para conocer tus comisiones, impuestos y envíos.</div></>;

  const selected=channels.find(row=>row.provider===channel)||channels[0];
  const rates=channelRates(selected)!;
  const input:SimulationInput={price:number(price),unitCost:number(cost),discount:number(discount),freeShipping,installmentSurcharge:number(surcharge)};
  const ready=input.price>0;
  const result=ready?simulateLaunch(input,rates):null;
  const targetPrice=ready?priceForMargin(number(target)/100,input,rates):null;
  const save=()=>{const next=[{id:String(Math.max(0,...scenarios.map(item=>Number(item.id)||0))+1),name:name.trim()||'Escenario',channel:selected.provider,input},...scenarios];setScenarios(next);storeScenarios(next);};
  const remove=(id:string)=>{const next=scenarios.filter(item=>item.id!==id);setScenarios(next);storeScenarios(next);};
  const load=(item:Scenario)=>{setName(item.name);setChannel(item.channel);setPrice(String(item.input.price));setCost(String(item.input.unitCost));setDiscount(String(item.input.discount));setFreeShipping(item.input.freeShipping);setSurcharge(String(item.input.installmentSurcharge));};
  // Buscador de productos de la tienda: completa nombre, precio, costo y canal.
  const matches=query.trim().length<2?[]:catalog.filter(row=>plain(`${row.product_name} ${row.sku||''}`).includes(plain(query.trim()))).sort((a,b)=>b.units_sold-a.units_sold).slice(0,6);
  const pick=(row:CatalogRow)=>{setName(row.product_name);setPrice(String(Math.round(row.price)));setCost(row.cost_source==='sin_costo'?'':String(Math.round(row.effective_cost)));if(channels.some(item=>item.provider===row.provider))setChannel(row.provider);setQuery('');};
  // El mismo producto en cada canal con ventas, para ver dónde deja más.
  const comparison=ready&&channels.length>1?channels.map(row=>({row,sim:simulateLaunch(input,channelRates(row)!)})).sort((a,b)=>b.sim.profit-a.sim.profit):[];
  const field=(label:string,value:string,set:(value:string)=>void,prefix?:string,suffix?:string,hint?:string)=><label className="p-field"><span className="p-fieldLabel">{label}</span><span className="p-input">{prefix&&<b className="p-simAffix">{prefix}</b>}<input inputMode="decimal" value={value} onChange={event=>set(event.target.value.replace(/[^\d.,]/g,''))}/>{suffix&&<b className="p-simAffix">{suffix}</b>}</span>{hint&&<small className="p-sub">{hint}</small>}</label>;

  return <>
    {head}
    <div className="p-simGrid">
      <div className="p-card p-reveal">
        <span className="p-eyebrowS">PRODUCTO NUEVO O COMBO</span>
        {catalog.length>0&&<div className="p-simPick">
          <label className="p-field" style={{marginTop:10}}><span className="p-fieldLabel">Partir de un producto de tu tienda <small className="p-sub">(opcional)</small></span><span className="p-input"><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscá por nombre o SKU" aria-label="Buscar producto"/></span></label>
          {matches.length>0&&<ul className="p-simMatches">{matches.map(row=><li key={`${row.provider}:${row.external_variant_id}`}><button type="button" onClick={()=>pick(row)}><span>{row.product_name}{row.sku?<small className="p-sub"> · {row.sku}</small>:null}</span><b className="p-mono">{money(row.price)}</b></button></li>)}</ul>}
          {query.trim().length>=2&&!matches.length&&<small className="p-sub">No encontramos productos con esa búsqueda.</small>}
        </div>}
        <label className="p-field" style={{marginTop:10}}><span className="p-fieldLabel">Nombre</span><span className="p-input"><input value={name} maxLength={60} onChange={event=>setName(event.target.value)}/></span></label>
        <div className="p-simTwo">{field('Precio de venta',price,setPrice,'$')}{field('Costo por unidad',cost,setCost,'$',undefined,'En un combo, la suma de los costos.')}</div>
        <div className="p-simTwo">
          <label className="p-field"><span className="p-fieldLabel">Canal</span><span className="p-input"><RpSelect value={selected.provider} onChange={event=>setChannel(event.target.value)} aria-label="Canal">{channels.map(row=><option key={row.provider} value={row.provider}>{row.label}</option>)}</RpSelect></span></label>
          {field('Descuento de lanzamiento',discount,setDiscount,undefined,'%')}
        </div>
        <div className="p-simTwo">
          <label className="p-field"><span className="p-fieldLabel">Envío gratis</span><span className="p-simToggle"><button type="button" className={freeShipping?'p-on':''} onClick={()=>setFreeShipping(true)}>Sí</button><button type="button" className={freeShipping?'':'p-on'} onClick={()=>setFreeShipping(false)}>No</button></span><small className="p-sub">{freeShipping?`Envío promedio: ${money(rates.shippingPerOrder)}`:'Lo paga el cliente'}</small></label>
          {field('Recargo por cuotas sin interés',surcharge,setSurcharge,undefined,'%','Solo si vas a dar más cuotas que de costumbre.')}
        </div>
        <p className="p-sub" style={{fontSize:12.5,margin:'4px 0 0'}}>Tasas reales de {selected.label} en los últimos 60 días ({rates.orders.toLocaleString('es-AR')} órdenes): comisiones {pct(rates.commissionRate)}, impuestos {pct(rates.taxRate)}{rates.otherRate?`, otros costos ${pct(rates.otherRate)}`:''}.</p>
      </div>
      <div className="p-card p-reveal" style={{'--i':1} as React.CSSProperties}>
        <span className="p-eyebrowS">RESULTADO</span>
        {!result?<div className="p-simEmpty">
          <img src="/mascota/canguro-busca-lupa-oscuro.svg" alt="" width={96} height={120}/>
          <div><b>Cargá el precio y el costo</b><p className="p-sub">O elegí un producto de tu tienda para partir de sus números. Vas a ver:</p>
            <ul><li>Cuánto te queda por venta y tu margen real</li><li>Lo máximo que podés gastar en publicidad por venta</li><li>El precio que necesitás para ganar el margen que buscás</li>{channels.length>1&&<li>En qué canal te deja más</li>}</ul></div>
        </div>:<>
          <div className="p-simResults">
            <div><small>Ganancia por venta</small><b className={`p-mono ${result.profit<0?'p-neg':'p-pos'}`}>{money(result.profit)}</b></div>
            <div><small>Margen</small><b className="p-mono">{pct(result.margin)}</b>{result.vsAverage!==null&&<small className="p-sub">{result.vsAverage>=0?'+':'−'}{Math.abs(result.vsAverage*100).toFixed(1).replace('.',',')} pts vs tu promedio</small>}</div>
            <div><small>Máximo a gastar en publicidad por venta</small><b className="p-mono">{money(result.maxCpa)}</b></div>
            <div><small>ROAS de equilibrio</small><b className="p-mono">{result.profit>0?ratio(result.breakEvenRoas):'No deja margen'}</b></div>
          </div>
          <ul className="p-simLines"><li><span>Precio{input.discount?` con ${input.discount} % de descuento`:''}</span><span className="p-mono">{money(result.price)}</span></li>{result.lines.map(line=><li key={line.key}><span>{line.label}</span><span className="p-mono">{money(line.amount)}</span></li>)}<li className="p-simTotal"><span>Te queda</span><span className="p-mono">{money(result.profit)}</span></li></ul>
          <div className="p-simTarget"><span>¿Qué precio necesito para ganar</span><span className="p-input p-simPct"><input inputMode="decimal" value={target} onChange={event=>setTarget(event.target.value.replace(/[^\d.,]/g,''))} aria-label="Margen buscado"/><b className="p-simAffix">%</b></span><span>?</span><b className="p-mono">{targetPrice?money(targetPrice):'No se puede con estos costos'}</b></div>
          {comparison.length>1&&<div className="p-simCompare"><span className="p-eyebrowS">SI LO VENDÉS EN…</span><ul>{comparison.map(({row,sim},index)=><li key={row.provider} className={index===0?'p-on':undefined}><span>{row.label}{index===0?<small className="p-chip p-g">Te deja más</small>:null}</span><span className={`p-mono ${sim.profit<0?'p-neg':''}`}>{money(sim.profit)}</span><span className="p-mono p-sub">{pct(sim.margin)}</span></li>)}</ul></div>}
          {channels.length===1&&<p className="p-sub" style={{fontSize:12.5,margin:'12px 0 0'}}>Cuando tengas ventas en otro canal (por ejemplo, Mercado Libre), te mostramos en cuál te deja más.</p>}
          <button type="button" className="p-btn p-primary p-small" style={{marginTop:14}} onClick={save}>Guardar escenario</button>
        </>}
      </div>
    </div>
    {scenarios.length>0&&<div className="p-card p-reveal" style={{marginTop:16}}>
      <div className="p-cardHead"><div><span className="p-eyebrowS">ESCENARIOS GUARDADOS</span><h3>Para comparar antes de decidir</h3></div><span className="p-sub">Se guardan en este navegador</span></div>
      <div className="p-tableWrap"><table><thead><tr><th>Escenario</th><th>Canal</th><th className="p-r">Precio</th><th className="p-r">Ganancia por venta</th><th className="p-r">Margen</th><th className="p-r">ROAS de equilibrio</th><th/></tr></thead><tbody>
        {scenarios.map(item=>{const row=channels.find(entry=>entry.provider===item.channel);const itemRates=channelRates(row);const sim=itemRates?simulateLaunch(item.input,itemRates):null;return <tr key={item.id}>
          <td><button type="button" className="p-linkBtn" onClick={()=>load(item)}>{item.name}</button></td><td>{row?.label||'—'}</td>
          <td className="p-r p-mono">{sim?money(sim.price):'—'}</td><td className={`p-r p-mono ${sim&&sim.profit<0?'p-neg':''}`}>{sim?money(sim.profit):'—'}</td><td className="p-r p-mono">{sim?pct(sim.margin):'—'}</td><td className="p-r p-mono">{sim&&sim.profit>0?ratio(sim.breakEvenRoas):'—'}</td>
          <td className="p-r"><button type="button" className="p-iconBtn" onClick={()=>remove(item.id)} aria-label={`Borrar ${item.name}`}><Trash2 className="p-i" aria-hidden="true"/></button></td>
        </tr>;})}
      </tbody></table></div>
    </div>}
  </>;
}
