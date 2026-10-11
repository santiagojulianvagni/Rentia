'use client';
import {Receipt,RefreshCw} from 'lucide-react';

import {useEffect,useRef,useState} from 'react';
import {meliAutoSyncDue,meliSyncAction,meliSyncMessage,type MeliView} from '../lib/mercadolibre-status';
import {ConnectionUpdatedAt} from './connection-status';

// Mounted for the entire panel, not just the connections tab. Navigation does
// not stop a historical import; roles only govern POSTs, never token access.
export function useMercadoLibreSync(canManage:boolean,onChanged:()=>unknown) {
  const [view,setView]=useState<MeliView|null>(null),[running,setRunning]=useState(false),[error,setError]=useState('');
  const busy=useRef(false),latest=useRef<MeliView|null>(null),changed=useRef(onChanged),mounted=useRef(false),manage=useRef(canManage),lastChanged=useRef(0),nextRequest=useRef(0);
  const lastSignature=useRef('');
  useEffect(()=>{changed.current=onChanged;manage.current=canManage;},[onChanged,canManage]);
  async function refresh(signal?:AbortSignal) {
    const response=await fetch('/api/sync/mercadolibre',{cache:'no-store',signal});
    if(!response.ok)return null;
    const value=await response.json() as MeliView;
    if(mounted.current){
      const previous=latest.current;
      if(previous&&(value.orders>previous.orders||value.products>previous.products||previous.pending&&!value.pending))setError('');
      latest.current=value;setView(value);
    }return value;
  }
  async function notifyChange(current:MeliView|null,force=false) {
    if(!mounted.current||!current?.connection)return;
    const signature=`${current.orders}:${current.products}:${current.pending}`;
    if(force||signature!==lastSignature.current&&(Date.now()-lastChanged.current>30_000||!current.pending)){
      lastChanged.current=Date.now();lastSignature.current=signature;await changed.current();
    }
  }
  async function run(force=false) {
    if(busy.current||!manage.current||!latest.current?.available||!latest.current.connection||latest.current.connection.status==='reauthorization_required'||latest.current.retryAt>Date.now()||(latest.current.leaseExpiresAt||0)>Date.now()||(!force&&Date.now()<nextRequest.current))return;
    busy.current=true;setRunning(true);setError('');
    try {
      const response=await fetch(`/api/sync/mercadolibre${force?'?force=1':''}`,{method:'POST',signal:AbortSignal.timeout(30000)});
      if(!response.ok)throw new Error();
      await notifyChange(await refresh(),force);
    }catch{nextRequest.current=Date.now()+30_000;if(mounted.current)setError('No pudimos confirmar la actualización. Tu avance está guardado; reintentaremos automáticamente.');}
    finally{busy.current=false;if(mounted.current)setRunning(false);}
  }
  useEffect(()=>{
    mounted.current=true;
    const controller=new AbortController();
    let polling=false,lastPoll=0;
    const poll=async()=>{
      if(polling||busy.current||document.visibilityState!=='visible')return;
      if(!latest.current?.pending&&Date.now()-lastPoll<30_000)return;
      lastPoll=Date.now();
      polling=true;
      try {
        const current=await refresh(controller.signal);
        await notifyChange(current);
        if(meliAutoSyncDue(current,manage.current))await run();
      }catch{/* No mutation or success claim when the status cannot be loaded. */}
      finally{polling=false;}
    };
    void poll();const timer=window.setInterval(()=>void poll(),5000);
    return ()=>{mounted.current=false;controller.abort();window.clearInterval(timer);};
    // The permission/callback refs deliberately keep a single panel-wide timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  return {view,running,error,run};
}

export function MercadoLibreIntegration({state,canManage,onBilling}:{state:ReturnType<typeof useMercadoLibreSync>;canManage:boolean;onBilling?:()=>void}) {
  const {view,running,error,run}=state;
  const connected=view?.connection?.status==='connected',reauthorize=view?.connection?.status==='reauthorization_required';
  const action=meliSyncAction(view,running,canManage);
  return <div className="p-card p-reveal p-integCard" style={{'--i':1} as React.CSSProperties}><div className="p-integ">
    <img className="p-logo32 p-lg" src="/brands/mercado-libre-icon.png" alt=""/>
    <div className="p-meta"><b>Mercado Libre</b>{view?.connection&&!reauthorize&&<span className={`p-chip ${connected?'p-g':'p-a'}`}>{connected?'✓ ':''}{action.badge}</span>}<p>Ventas, publicaciones, tarifas de venta y costos de envío informados.</p><small aria-live="polite">{error||meliSyncMessage(view)}</small>{view?.connection&&<><ConnectionUpdatedAt value={view.status?.last_completed_at}/><small>Hasta 12 meses de historial inicial · costos por SKU · devoluciones en revisión.</small>{onBilling&&<button className="p-linkBtn" type="button" onClick={onBilling}><Receipt className="p-i" aria-hidden="true"/>Ver desglose de cargos</button>}</>}</div>
    <div className="p-actions">{view?.connection&&!reauthorize?<button type="button" className={`p-btn ${action.busy?'p-spin':''}`} onClick={()=>void run(true)} disabled={action.disabled} aria-busy={action.busy}><RefreshCw className="p-i" aria-hidden="true"/>{action.label}</button>:view?.available&&canManage?<a className="p-btn p-primary" href="/api/integrations/mercadolibre/start">{reauthorize?'Volver a autorizar':'Conectar'}</a>:<button type="button" className="p-btn" disabled>{canManage?'En preparación':'Acceso de consulta'}</button>}</div>
  </div></div>;
}
