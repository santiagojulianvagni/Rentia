'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { RefreshCw } from 'lucide-react';
import ExchangeRateHistory from './exchange-rate-history';
import { adjustedRate, asRateType, rateLabels, type LiveRates, type RateSettings, type RateType } from '../lib/exchange-rates';

export const pesoQuote=(value:number|null|undefined)=>value==null?'—':new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
const quoteTime=(value:string|null|undefined)=>value?new Date(value).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'Fecha no informada';
type QuoteResponse={settings:RateSettings;live:LiveRates};

export default function ExchangeRateSettings({onChanged,onRatesChanged}:{onChanged:()=>Promise<unknown>;onRatesChanged:()=>Promise<void>}) {
  const [saved,setSaved]=useState<RateSettings|null>(null);
  const [live,setLive]=useState<LiveRates|null>(null);
  const [rateType,setRateType]=useState<RateType>('official');
  const [manualBase,setManualBase]=useState('');
  const [adjustment,setAdjustment]=useState('0');
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [refreshing,setRefreshing]=useState(false);
  const [message,setMessage]=useState('');

  useEffect(()=>{
    let cancelled=false;
    fetch('/api/finance/exchange-rate',{cache:'no-store'}).then(async response=>{if(!response.ok)throw new Error('load');return response.json() as Promise<QuoteResponse>;}).then(data=>{
      if(cancelled)return;setSaved(data.settings);setLive(data.live);setRateType(asRateType(data.settings.rate_type));setManualBase(data.settings.base_rate>0?String(data.settings.base_rate):'');setAdjustment(String(data.settings.adjustment_percent||0));
    }).catch(()=>{if(!cancelled)setMessage('No pudimos cargar la cotización. Volvé a intentar.');}).finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[]);
  const base=rateType==='manual'?(Number(manualBase)>0?Number(manualBase):null):live?.quotes[rateType]?.sell??null;
  const draft=adjustedRate(base,Number(adjustment));
  const changed=Boolean(saved&&(rateType!==saved.rate_type||Number(adjustment)!==saved.adjustment_percent||(rateType==='manual'&&Number(manualBase)!==saved.base_rate)));
  const valid=base!==null&&Number.isFinite(Number(adjustment))&&Number(adjustment)>-100&&Number(adjustment)<=500&&draft!==null;

  async function refresh() {
    setRefreshing(true);setMessage('');
    try {
      const response=await fetch('/api/finance/exchange-rate',{cache:'no-store'});if(!response.ok)throw new Error('refresh');
      const data=await response.json() as QuoteResponse;setLive(data.live);
      if(!saved){setSaved(data.settings);setRateType(asRateType(data.settings.rate_type));setManualBase(data.settings.base_rate>0?String(data.settings.base_rate):'');setAdjustment(String(data.settings.adjustment_percent||0));}
      await onRatesChanged();
    }catch{setMessage('No pudimos actualizar la cotización. Tu configuración no cambió.');}
    finally{setRefreshing(false);}
  }
  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(!valid||!saved)return;
    setSaving(true);setMessage('');
    try {
      const response=await fetch('/api/finance/exchange-rate',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({rateType,baseRate:base,adjustmentPercent:Number(adjustment)})});
      if(!response.ok)throw new Error('save');
      const current=await fetch('/api/finance/exchange-rate',{cache:'no-store'});if(!current.ok)throw new Error('reload');
      const data=await current.json() as QuoteResponse;setSaved(data.settings);setLive(data.live);await Promise.all([onChanged(),onRatesChanged()]);setMessage('Cotización guardada. Los importes en USD ya usan este valor.');
    }catch{setMessage('No pudimos confirmar el guardado. Conservamos tus valores para que puedas reintentar.');}
    finally{setSaving(false);}
  }
  const stale=live?.updatedAt?Date.now()-Date.parse(live.updatedAt)>48*60*60*1000:false;
  return <section className="p-quote">
    <div className="p-head"><div><div className="p-eyebrow">CONVERSIÓN DE MONEDA</div><h1>Cotización <em>del dólar</em></h1><p>La referencia que usa Rentia para mostrar tus importes en USD.</p></div><div className="p-actions"><button type="button" className={`p-btn ${refreshing?'p-spin':''}`} onClick={refresh} disabled={refreshing||loading||saving}><RefreshCw className="p-i" aria-hidden="true"/>{refreshing?'Actualizando…':'Actualizar cotización'}</button></div></div>
    <div className="p-grid p-g3" style={{marginBottom:16}}>
      <form className="p-card p-span2 p-reveal" onSubmit={save}><div className="p-cardHead"><h3>Tu configuración</h3></div><fieldset disabled={loading||saving||!saved} className="p-cfgFields">
        <div className="p-rates" role="radiogroup" aria-label="Tipo de cotización" style={{marginBottom:16}}>{([['official','Oficial','Precio de venta'],['blue','Blue','Precio de venta'],['mep','MEP','Dólar bolsa'],['manual','Manual','Definís el valor']] as const).map(([value,label,detail])=><label key={value} className={`p-opt ${rateType===value?'p-on':''}`}><input type="radio" name="quote-type" value={value} checked={rateType===value} onChange={()=>setRateType(asRateType(value))}/><span className="p-radio" aria-hidden="true"/><span><b>{label}</b><small className="p-mono" style={{fontSize:15,color:'var(--text)'}}>{value==='manual'?(Number(manualBase)>0?pesoQuote(Number(manualBase)):detail):pesoQuote(live?.quotes[value]?.sell)}</small><small>{detail}{value!=='manual'?' · automática':''}</small></span></label>)}</div>
        <div className="p-grid p-g2"><label className="p-field" htmlFor="quote-base"><span className="p-fieldLabel">{rateType==='manual'?'Precio manual':'Precio base de la API'}</span><span className="p-input"><span>ARS</span><input id="quote-base" type="number" min="0.01" step="0.01" inputMode="decimal" readOnly={rateType!=='manual'} required={rateType==='manual'} value={rateType==='manual'?manualBase:base??''} placeholder={loading?'Cargando…':'No disponible'} onChange={event=>setManualBase(event.target.value)}/><span>por USD</span></span></label><label className="p-field" htmlFor="quote-adjustment"><span className="p-fieldLabel">Ajuste personalizado</span><span className="p-input"><input id="quote-adjustment" type="number" min="-99.99" max="500" step="0.01" inputMode="decimal" value={adjustment} onChange={event=>setAdjustment(event.target.value)}/><span>%</span></span></label></div>
        <div className="p-kv" style={{marginTop:12}}><span>{changed?'Al guardar se aplicará':'Cotización con tu ajuste'}</span><b className="p-mono" style={{color:'var(--cyan)'}}>{pesoQuote(draft)} <small className="p-sub">por USD</small></b></div>
        <div className="p-actions" style={{marginTop:14,justifyContent:'space-between',alignItems:'center'}}><small className="p-sub">{changed?'Tenés cambios sin guardar.':'La referencia automática se actualiza sin cambiar tu ajuste.'}</small><button type="submit" className="p-btn p-primary" disabled={!valid||saving}>{saving?'Guardando…':'Guardar cotización'}</button></div>
      </fieldset></form>
      <div className="p-card p-planCard p-reveal" style={{'--i':1} as React.CSSProperties}><span className="p-eyebrowS">RENTIA ESTÁ USANDO</span> <span className={`p-chip ${live?.status==='fallback'||live?.status==='cached'||stale?'p-a':'p-g'}`}>{loading?'Consultando…':!live||live.status==='unavailable'?'No disponible':live.status==='manual'?'Manual':live.status==='fallback'?'Respaldo guardado':live.status==='cached'?'Última consulta disponible':stale?'Cotización sin actualizar':'Automática'}</span>
        <b className="p-mono" style={{display:'block',fontSize:32,margin:'8px 0 2px'}}>{pesoQuote(live?.effectiveRate)}</b><span className="p-sub">Pesos argentinos por 1 USD</span>
        <div className="p-kv" style={{marginTop:12}}><span>Referencia</span><b>{live?rateLabels[live.rateType]:'—'}</b></div><div className="p-kv"><span>Base sin ajuste</span><b className="p-mono">{pesoQuote(live?.baseRate)}</b></div><div className="p-kv"><span>Ajuste guardado</span><b>{live?`${new Intl.NumberFormat('es-AR',{maximumFractionDigits:2}).format(live.adjustmentPercent)}%`:'—'}</b></div><div className="p-kv"><span>Fuente</span><b>{live?.source||'—'}</b></div><div className="p-kv" style={{border:0}}><span>Actualización de la fuente</span><b>{quoteTime(live?.updatedAt)}</b></div>
        {(live?.status==='fallback'||live?.status==='cached'||stale)&&<p className="p-warnLine">La fuente no tiene un valor más reciente. Revisá la fecha antes de usar esta referencia.</p>}
      </div>
    </div>
    {message&&<div className="p-note" role="status">{message}</div>}
    {!loading&&saved&&<ExchangeRateHistory rateType={rateType} quote={live?.quotes[rateType]} refreshKey={live?.fetchedAt||''}/>}
  </section>;
}
