'use client';

import { useEffect, useMemo, useState } from 'react';
import { Image as ImageIcon, Lightbulb, Play } from 'lucide-react';
import { analyzeCreatives, type AnalyzedCreative, type CreativeRow, type CreativeVerdict } from '../../lib/creative-analysis';
import RpSelect from './rp-select';

type Response={connected:boolean;since:string;until:string;account:{id:string;name:string}|null;currency:string|null;ads:CreativeRow[]};
const VERDICTS:Record<CreativeVerdict,[string,string]>={escalar:['Escalar','p-g'],mantener:['Mantener','p-a'],apagar:['Apagar','p-r'],aprendiendo:['Aprendiendo','']};
const SORTS={profit:'Ganancia real',spend:'Gasto',roas:'ROAS',hook:'Hook rate'} as const;
type Sort=keyof typeof SORTS;
const percent=(value:number|null,digits=0)=>value===null?'—':`${(value*100).toLocaleString('es-AR',{maximumFractionDigits:digits})} %`;
const times=(value:number|null)=>value===null?'—':`${value.toLocaleString('es-AR',{maximumFractionDigits:1})}x`;

// Pestaña "Creativos" de Publicidad: qué anuncios de Meta escalar, mantener o apagar, con su
// ganancia real y, en los videos, cuánto enganchan en los primeros segundos.
export default function MetaCreatives({money,margin,averageTicket,onConnect}:{money:(value:number,currency?:string)=>string;margin:number|null;averageTicket:number|null;onConnect:()=>void}) {
  const [days,setDays]=useState(30);
  const [data,setData]=useState<Response|null>(null);
  const [failed,setFailed]=useState(false);
  const [kind,setKind]=useState<'todos'|'video'|'imagen'>('todos');
  const [sort,setSort]=useState<Sort>('profit');
  useEffect(()=>{
    const controller=new AbortController();
    queueMicrotask(()=>{if(!controller.signal.aborted){setData(null);setFailed(false);}});
    fetch(`/api/ads/creatives?days=${days}`,{cache:'no-store',signal:controller.signal}).then(response=>{if(!response.ok)throw new Error();return response.json() as Promise<Response>;}).then(result=>{if(!controller.signal.aborted)setData(result);}).catch(()=>{if(!controller.signal.aborted)setFailed(true);});
    return ()=>controller.abort();
  },[days]);

  const analysis=useMemo(()=>data?analyzeCreatives(data.ads,{margin,averageTicket}):null,[data,margin,averageTicket]);
  const currency=data?.currency||'ARS';
  const shown=useMemo(()=>{
    if(!analysis)return [];
    const value=(ad:AnalyzedCreative)=>sort==='spend'?ad.spend:sort==='roas'?ad.roas??-1:sort==='hook'?ad.hookRate??-1:ad.profit??-Infinity;
    return analysis.ads.filter(ad=>kind==='todos'||ad.kind===kind).sort((a,b)=>value(b)-value(a));
  },[analysis,kind,sort]);

  const head=<div className="p-cardHead p-crHead"><div><span className="p-eyebrowS">CREATIVOS DE META</span><h3>Qué anuncios escalar y cuáles apagar</h3>{data?.account&&<span className="p-sub">{data.account.name} · del {new Date(`${data.since}T12:00:00`).toLocaleDateString('es-AR')} al {new Date(`${data.until}T12:00:00`).toLocaleDateString('es-AR')}</span>}</div>
    <span className="p-input" style={{height:38}}><RpSelect value={String(days)} onChange={event=>setDays(Number(event.target.value))} aria-label="Período">{[7,14,30,90].map(value=><option key={value} value={value}>Últimos {value} días</option>)}</RpSelect></span></div>;

  if(failed)return <div className="p-card">{head}<div className="p-note p-warn">No pudimos consultar tus anuncios en Meta. Probá de nuevo en unos minutos.</div></div>;
  if(!data||!analysis)return <div className="p-card">{head}<div className="p-empty">Consultando tus anuncios en Meta…</div></div>;
  if(!data.connected)return <div className="p-card">{head}<div className="p-empty"><p>Conectá Meta Ads para ver qué creativos te dejan ganancia.</p><button type="button" className="p-btn p-primary p-small" onClick={onConnect}>Conectar Meta Ads</button></div></div>;
  if(!data.account)return <div className="p-card">{head}<div className="p-empty">Elegí tu cuenta publicitaria en la pestaña Meta Ads.</div></div>;
  if(!analysis.ads.length)return <div className="p-card">{head}<div className="p-empty">No hubo anuncios con inversión en este período.</div></div>;

  const {summary}=analysis;
  return <div className="p-card p-reveal p-creatives">
    {head}
    <div className="p-crStats">
      <div><small>Para escalar</small><b className="p-pos">{summary.escalar}</b></div>
      <div><small>Para apagar</small><b className="p-neg">{summary.apagar}</b></div>
      <div><small>Mantener</small><b>{summary.mantener}</b></div>
      <div><small>Aprendiendo</small><b>{summary.aprendiendo}</b></div>
      <div><small>Hook rate promedio</small><b>{percent(summary.hookRate)}</b></div>
    </div>
    {!analysis.breakEven&&<div className="p-note p-warn">Todavía no sabemos tu margen: cargá el costo de tus productos para calcular la ganancia real de cada anuncio.</div>}
    {analysis.insight&&<div className="p-crInsight"><Lightbulb className="p-i" aria-hidden="true"/><span>{analysis.insight}</span></div>}
    <div className="p-crTools">
      <div className="p-simChips" role="group" aria-label="Tipo de creativo">{(['todos','video','imagen'] as const).map(value=><button type="button" key={value} className={kind===value?'p-on':undefined} aria-pressed={kind===value} onClick={()=>setKind(value)}>{value==='todos'?'Todos':value==='video'?'Videos':'Imágenes'}</button>)}</div>
      <label className="p-crSort"><span className="p-sub">Ordenar por</span><span className="p-input" style={{height:34}}><RpSelect value={sort} onChange={event=>setSort(event.target.value as Sort)} aria-label="Ordenar por">{(Object.keys(SORTS) as Sort[]).map(key=><option key={key} value={key}>{SORTS[key]}</option>)}</RpSelect></span></label>
    </div>
    <div className="p-crGrid">{shown.map(ad=>{const [label,tone]=VERDICTS[ad.verdict];return <article className="p-crCard" key={ad.adId}>
      <div className="p-crThumb">{ad.thumbnail?<img src={ad.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer"/>:ad.kind==='video'?<Play aria-hidden="true"/>:<ImageIcon aria-hidden="true"/>}<span className={`p-chip ${tone}`}>{label}</span>{ad.kind==='video'&&ad.thumbnail&&<i className="p-crPlay"><Play aria-hidden="true"/></i>}</div>
      <div className="p-crBody">
        <b className="p-crName" title={ad.name}>{ad.name}</b>
        <small className="p-sub p-crCamp" title={`${ad.campaign} · ${ad.adset}`}>{ad.campaign}{ad.adset?` · ${ad.adset}`:''}</small>
        <dl>
          <dt>Gasto</dt><dd className="p-mono">{money(ad.spend,currency)}</dd>
          <dt>Ganancia real</dt><dd className={`p-mono ${ad.profit===null?'':ad.profit>=0?'p-pos':'p-neg'}`}>{ad.profit===null?'—':money(ad.profit,currency)}</dd>
          <dt>ROAS</dt><dd className="p-mono">{times(ad.roas)}{analysis.breakEven?<small className="p-sub"> / {times(analysis.breakEven)}</small>:null}</dd>
          {ad.kind==='video'?<><dt>Hook rate</dt><dd className="p-mono">{percent(ad.hookRate)}</dd><dt>Retención</dt><dd className="p-mono">{percent(ad.holdRate)}</dd></>
            :<><dt>CTR</dt><dd className="p-mono">{percent(ad.ctr,1)}</dd><dt>Costo por compra</dt><dd className="p-mono">{ad.cpa===null?'—':money(ad.cpa,currency)}</dd></>}
          <dt>Compras</dt><dd className="p-mono">{Math.round(ad.purchases).toLocaleString('es-AR')}</dd>
        </dl>
        <small className={`p-crReason ${ad.verdict==='apagar'?'p-neg':''}`}>{ad.reason}</small>
      </div>
    </article>;})}</div>
    <p className="p-sub p-crFoot">Ganancia real = ventas atribuidas por Meta × tu margen antes de publicidad − gasto. Hook rate: de cada 100 personas que vieron el video, cuántas se quedaron al menos 3 segundos. Retención: de esas, cuántas lo vieron casi completo.</p>
  </div>;
}
