'use client';

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Image as ImageIcon, Lightbulb, Play, RefreshCw, X } from 'lucide-react';
import { analyzeCreatives, type AnalyzedCreative, type CreativeRow, type CreativeVerdict } from '../../lib/creative-analysis';
import RpSelect from './rp-select';

type Response={connected:boolean;since:string;until:string;account:{id:string;name:string}|null;currency:string|null;ads:CreativeRow[]};
type Preview={ad:AnalyzedCreative;format:string;src:string|null;adsManager:string|null;loading:boolean;failed:boolean};
const VERDICTS:Record<CreativeVerdict,[string,string]>={escalar:['Escalar','p-g'],mantener:['Mantener','p-a'],apagar:['Apagar','p-r'],aprendiendo:['Aprendiendo','']};
const SORTS={profit:'Ganancia real',spend:'Gasto',roas:'ROAS',hook:'Hook rate'} as const;
const FORMATS=[['INSTAGRAM_STANDARD','Instagram'],['INSTAGRAM_REELS','Reels'],['MOBILE_FEED_STANDARD','Facebook']] as const;
type Sort=keyof typeof SORTS;
const percent=(value:number|null,digits=0)=>value===null?'—':`${(value*100).toLocaleString('es-AR',{maximumFractionDigits:digits})} %`;
const times=(value:number|null)=>value===null?'—':`${value.toLocaleString('es-AR',{maximumFractionDigits:1})}x`;
// Estado del anuncio en Meta: activo, pausado (él o su campaña/conjunto) o dado de baja.
function adState(status:string):['activo'|'pausado'|'baja',string] {
  const value=status.toUpperCase();
  if(value==='ACTIVE')return ['activo','Activo'];
  if(value.includes('PAUSED')||value==='IN_PROCESS'||value==='WITH_ISSUES'||value==='PENDING_REVIEW')return ['pausado','Pausado'];
  return ['baja','Dado de baja'];
}

// Pestaña "Creativos" de Publicidad: qué anuncios de Meta escalar, mantener o apagar, con su
// ganancia real y, en los videos, cuánto enganchan en los primeros segundos.
export default function MetaCreatives({money,margin,averageTicket,onConnect}:{money:(value:number,currency?:string)=>string;margin:number|null;averageTicket:number|null;onConnect:()=>void}) {
  const [days,setDays]=useState(30);
  const [reload,setReload]=useState(0);
  const [data,setData]=useState<Response|null>(null);
  const [failed,setFailed]=useState(false);
  const [kind,setKind]=useState<'todos'|'video'|'imagen'>('todos');
  const [sort,setSort]=useState<Sort>('profit');
  const [onlyActive,setOnlyActive]=useState(true);
  const [clickOnly,setClickOnly]=useState(true);
  const [preview,setPreview]=useState<Preview|null>(null);
  useEffect(()=>{
    const controller=new AbortController();
    queueMicrotask(()=>{if(!controller.signal.aborted){setData(null);setFailed(false);}});
    fetch(`/api/ads/creatives?days=${days}`,{cache:'no-store',signal:controller.signal}).then(response=>{if(!response.ok)throw new Error();return response.json() as Promise<Response>;}).then(result=>{if(!controller.signal.aborted)setData(result);}).catch(()=>{if(!controller.signal.aborted)setFailed(true);});
    return ()=>controller.abort();
  },[days,reload]);
  useEffect(()=>{
    if(!preview)return;
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')setPreview(null);};
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[preview]);

  const visibleRows=useMemo(()=>data?data.ads.filter(ad=>!onlyActive||adState(ad.status)[0]==='activo'):[],[data,onlyActive]);
  const analysis=useMemo(()=>data?analyzeCreatives(visibleRows,{margin,averageTicket,clickOnly}):null,[data,visibleRows,margin,averageTicket,clickOnly]);
  const hidden=data?data.ads.length-visibleRows.length:0;
  const currency=data?.currency||'ARS';
  const shown=useMemo(()=>{
    if(!analysis)return [];
    const value=(ad:AnalyzedCreative)=>sort==='spend'?ad.spend:sort==='roas'?ad.roas??-1:sort==='hook'?ad.hookRate??-1:ad.profit??-Infinity;
    return analysis.ads.filter(ad=>kind==='todos'||ad.kind===kind).sort((a,b)=>value(b)-value(a));
  },[analysis,kind,sort]);

  async function openPreview(ad:AnalyzedCreative,format:string=FORMATS[0][0]) {
    setPreview({ad,format,src:null,adsManager:null,loading:true,failed:false});
    try {
      const response=await fetch(`/api/ads/creatives/preview?ad=${encodeURIComponent(ad.adId)}&format=${format}`,{cache:'no-store'});
      if(!response.ok)throw new Error();
      const result=await response.json() as {src:string|null;adsManager:string|null};
      setPreview(current=>current&&current.ad.adId===ad.adId&&current.format===format?{...current,src:result.src,adsManager:result.adsManager,loading:false,failed:!result.src}:current);
    } catch {setPreview(current=>current&&current.ad.adId===ad.adId?{...current,loading:false,failed:true}:current);}
  }

  const head=<div className="p-cardHead p-crHead"><div><span className="p-eyebrowS">CREATIVOS DE META</span><h3>Qué anuncios escalar y cuáles apagar</h3>{data?.account&&<span className="p-sub">{data.account.name} · del {new Date(`${data.since}T12:00:00`).toLocaleDateString('es-AR')} al {new Date(`${data.until}T12:00:00`).toLocaleDateString('es-AR')}</span>}</div>
    <div className="p-crHeadTools">
      <button type="button" className="p-btn p-small" onClick={()=>setReload(value=>value+1)} disabled={!data&&!failed}><RefreshCw className="p-i" aria-hidden="true"/> Actualizar</button>
      <span className="p-input" style={{height:38}}><RpSelect value={String(days)} onChange={event=>setDays(Number(event.target.value))} aria-label="Período">{[7,14,30,90].map(value=><option key={value} value={value}>Últimos {value} días</option>)}</RpSelect></span>
    </div></div>;

  if(failed)return <div className="p-card">{head}<div className="p-note p-warn">No pudimos consultar tus anuncios en Meta. Probá de nuevo en unos minutos.</div></div>;
  if(!data||!analysis)return <div className="p-card">{head}<div className="p-empty">Consultando tus anuncios en Meta…</div></div>;
  if(!data.connected)return <div className="p-card">{head}<div className="p-empty"><p>Conectá Meta Ads para ver qué creativos te dejan ganancia.</p><button type="button" className="p-btn p-primary p-small" onClick={onConnect}>Conectar Meta Ads</button></div></div>;
  if(!data.account)return <div className="p-card">{head}<div className="p-empty">Elegí tu cuenta publicitaria en la pestaña Meta Ads.</div></div>;
  if(!data.ads.length)return <div className="p-card">{head}<div className="p-empty">No hubo anuncios con inversión en este período.</div></div>;

  const {summary}=analysis;
  return <div className="p-card p-reveal p-creatives">
    {head}
    <div className="p-crTotals">
      <div><small>Gasto del período</small><b className="p-mono">{money(summary.spend,currency)}</b></div>
      <div><small>Ganancia real</small><b className={`p-mono ${summary.profit===null?'':summary.profit>=0?'p-pos':'p-neg'}`}>{summary.profit===null?'—':money(summary.profit,currency)}</b></div>
      <div><small>En anuncios sin ventas</small><b className={`p-mono ${summary.spendWithoutSales>0?'p-neg':''}`}>{money(summary.spendWithoutSales,currency)}</b></div>
    </div>
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
      <label className="p-check p-crToggle"><input type="checkbox" checked={onlyActive} onChange={event=>setOnlyActive(event.target.checked)}/><span>Solo activos{hidden>0?` (${hidden} pausado${hidden===1?'':'s'} o dado${hidden===1?'':'s'} de baja)`:''}</span></label>
      <label className="p-check p-crToggle" title="Meta también cuenta compras de gente que solo vio el anuncio, sin hacer clic. Con esto prendido, no se cuentan."><input type="checkbox" checked={clickOnly} onChange={event=>setClickOnly(event.target.checked)}/><span>Contar solo compras con clic</span></label>
      <label className="p-crSort"><span className="p-sub">Ordenar por</span><span className="p-input" style={{height:34}}><RpSelect value={sort} onChange={event=>setSort(event.target.value as Sort)} aria-label="Ordenar por">{(Object.keys(SORTS) as Sort[]).map(key=><option key={key} value={key}>{SORTS[key]}</option>)}</RpSelect></span></label>
    </div>
    {!shown.length&&<div className="p-empty">No hay anuncios activos con inversión en este período. Destildá “Solo activos” para ver los pausados.</div>}
    <div className="p-crGrid">{shown.map(ad=>{const [label,tone]=VERDICTS[ad.verdict];const [state,stateLabel]=adState(ad.status);return <article className="p-crCard" key={ad.adId}>
      <button type="button" className="p-crThumb" onClick={()=>void openPreview(ad)} aria-label={`Ver la vista previa de ${ad.name}`}>{ad.thumbnail?<img src={ad.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer"/>:ad.kind==='video'?<Play aria-hidden="true"/>:<ImageIcon aria-hidden="true"/>}<span className={`p-chip ${tone}`}>{label}</span><span className={`p-crState p-${state}`}>{stateLabel}</span><i className="p-crPlay"><Play aria-hidden="true"/></i></button>
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
        {ad.viewPurchases>0&&<small className="p-sub p-crViews">{clickOnly?`+ ${Math.round(ad.viewPurchases)} que Meta cuenta solo por ver el anuncio (sin clic), no sumadas.`:`${Math.round(ad.viewPurchases)} de estas compras fueron solo por ver el anuncio, sin clic.`}</small>}
        <small className={`p-crReason ${ad.verdict==='apagar'?'p-neg':''}`}>{ad.reason}</small>
      </div>
    </article>;})}</div>
    <p className="p-sub p-crFoot">Ganancia real = ventas atribuidas por Meta{clickOnly?' después de un clic':''} × tu margen antes de publicidad − gasto. Hook rate: de cada 100 personas que vieron el video, cuántas se quedaron al menos 3 segundos. Retención: de esas, cuántas lo vieron casi completo.</p>

    {preview&&<>
      <button type="button" className="p-askScrim" onClick={()=>setPreview(null)} aria-label="Cerrar la vista previa"/>
      <div className="p-crPreview" role="dialog" aria-label={`Vista previa de ${preview.ad.name}`}>
        <div className="p-crPreviewHead"><b title={preview.ad.name}>{preview.ad.name}</b><button type="button" className="p-askClose" onClick={()=>setPreview(null)} aria-label="Cerrar"><X size={18} aria-hidden="true"/></button></div>
        <div className="p-simChips" role="group" aria-label="Dónde se ve">{FORMATS.map(([value,name])=><button type="button" key={value} className={preview.format===value?'p-on':undefined} aria-pressed={preview.format===value} onClick={()=>void openPreview(preview.ad,value)}>{name}</button>)}</div>
        <div className="p-crFrame">{preview.loading?<span className="p-sub">Cargando la vista previa…</span>:preview.src?<iframe src={preview.src} title={`Vista previa de ${preview.ad.name}`} loading="lazy" referrerPolicy="no-referrer"/>:<span className="p-sub">Meta no tiene vista previa de este anuncio en este formato.</span>}</div>
        {preview.adsManager&&<a className="p-btn p-small" href={preview.adsManager} target="_blank" rel="noopener noreferrer"><ExternalLink className="p-i" aria-hidden="true"/> Abrir en el Administrador de anuncios</a>}
      </div>
    </>}
  </div>;
}
