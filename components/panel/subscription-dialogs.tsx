'use client';

import { useState } from 'react';
import { useReverification } from '@clerk/nextjs';
import { isReverificationCancelledError } from '@clerk/nextjs/errors';
import { CalendarDays, ShieldCheck, X } from 'lucide-react';
import { SUBSCRIPTION_SUMMARY } from '../../lib/terms';
import { formatArs, rateDate, type OfficialRate } from '../plan-configurator';

type Plan={id:string;name:string;monthlyPrice:number|null};
const usd=(value:number)=>new Intl.NumberFormat('es-AR',{maximumFractionDigits:2}).format(value);
const longDate=(value:string|null|undefined)=>value?new Intl.DateTimeFormat('es-AR',{dateStyle:'long'}).format(new Date(value)):null;

// Paso previo a elegir un plan: resumen de cómo se cobra y aceptación de los términos.
export function ConfirmPlanDialog({plan,annual,saving,officialRate=null,onConfirm,onClose}:{plan:Plan;annual:boolean;saving:boolean;officialRate?:OfficialRate|null;onConfirm:()=>void;onClose:()=>void}) {
  const [accepted,setAccepted]=useState(false);
  const price=plan.monthlyPrice===null?null:annual?plan.monthlyPrice*10:plan.monthlyPrice;
  return <><button type="button" className="p-scrim p-open" onClick={onClose} aria-label="Cerrar"/>
    <div className="p-modal p-open" role="dialog" aria-modal="true" aria-labelledby="confirm-plan-title">
      <div className="p-drawerHead"><div><span className="p-eyebrowS">CONFIRMAR PLAN</span><h3 id="confirm-plan-title">{plan.name} · {annual?'anual':'mensual'}</h3><span className="p-sub">{price===null?'Precio a medida':`USD ${usd(price)} ${annual?'por año':'por mes'}, cobrado en pesos al dólar oficial del día`}</span></div><button type="button" className="p-iconBtn" onClick={onClose} aria-label="Cerrar"><X className="p-i" aria-hidden="true"/></button></div>
      <div className="p-drawerBody">
        {price!==null&&officialRate&&<div className="p-arsCalc"><span>Referencia de hoy</span><b className="p-mono">USD {usd(price)} × ${formatArs(officialRate.sell)} = ARS {formatArs(price*officialRate.sell)}</b><small>Dólar oficial, venta{rateDate(officialRate.updatedAt)?`, del ${rateDate(officialRate.updatedAt)}`:''}. Cada cobro usa la cotización de ese día, así que el monto en pesos puede variar.</small></div>}
        <b style={{display:'block',marginBottom:8}}>Antes de confirmar</b>
        <ul className="p-incl">{SUBSCRIPTION_SUMMARY.map(item=><li key={item}><ShieldCheck aria-hidden="true"/>{item}</li>)}</ul>
        <label className="p-check"><input type="checkbox" checked={accepted} onChange={event=>setAccepted(event.target.checked)}/> <span>Leí y acepto los <a href="/terminos" target="_blank" rel="noopener noreferrer" style={{color:'var(--cyan)'}}>Términos y condiciones</a> y la <a href="/privacidad" target="_blank" rel="noopener noreferrer" style={{color:'var(--cyan)'}}>Política de privacidad</a>.</span></label>
        <p className="p-note" style={{margin:'12px 0 0'}}>Todavía no hay cobros activos en Rentia: hoy se guarda tu elección y no se te cobra nada. Antes del primer cobro te vamos a pedir confirmarlo.</p>
      </div>
      <div className="p-drawerFoot"><button type="button" className="p-btn p-ghost" onClick={onClose}>Cancelar</button><button type="button" className="p-btn p-primary" disabled={!accepted||saving} onClick={onConfirm}>{saving?'Guardando…':`Elegir ${plan.name}`}</button></div>
    </div></>;
}

type CancelResult={error?:string;message?:string;subscription?:unknown};

// Baja en tres pasos: qué pasa, confirmación escrita y verificación de identidad (Clerk).
export function CancelSubscriptionDialog({planName,paid,periodEnd,onDone,onClose}:{planName:string;paid:boolean;periodEnd:string|null;onDone:(result:CancelResult)=>void;onClose:()=>void}) {
  const [step,setStep]=useState<1|2>(1);
  const [typed,setTyped]=useState('');
  const [working,setWorking]=useState(false);
  const [error,setError]=useState('');
  const cancel=useReverification(()=>fetch('/api/subscription',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'cancel',confirmation:'DAR DE BAJA'})}).then(response=>response.json() as Promise<CancelResult>));
  async function confirm() {
    setWorking(true);setError('');
    try {
      const result=await cancel();
      if(result?.error){setError(result.error==='provider_cancel_failed'?'No pudimos confirmar la baja con Mercado Pago. No se canceló nada: probá de nuevo en unos minutos.':'No pudimos completar la baja. Probá de nuevo.');return;}
      onDone(result);
    } catch(problem) {
      setError(isReverificationCancelledError(problem)?'La baja no se completó porque no se confirmó tu identidad.':'No pudimos completar la baja. Revisá tu conexión y probá de nuevo.');
    } finally {setWorking(false);}
  }
  const until=longDate(periodEnd);
  return <><button type="button" className="p-scrim p-open" onClick={working?undefined:onClose} aria-label="Cerrar"/>
    <div className="p-modal p-open" role="dialog" aria-modal="true" aria-labelledby="cancel-title">
      <div className="p-drawerHead"><div><span className="p-eyebrowS" style={{color:'var(--coral)'}}>PASO {step} DE 2 · DAR DE BAJA</span><h3 id="cancel-title">{paid?`¿Dar de baja ${planName}?`:'¿Quitar el plan que elegiste?'}</h3></div><button type="button" className="p-iconBtn" onClick={onClose} disabled={working} aria-label="Cerrar"><X className="p-i" aria-hidden="true"/></button></div>
      <div className="p-drawerBody">
        {step===1?<>
          <ul className="p-incl">{(paid?[
            'No se te va a cobrar más. La baja corta las renovaciones automáticas.',
            until?`Seguís usando ${planName} hasta el ${until}, que es el final del período ya pagado.`:`Seguís usando ${planName} hasta el final del período ya pagado.`,
            'Después pasás al plan Gratis. Tus datos, costos e historial se conservan.',
            'Podés volver a suscribirte cuando quieras desde esta misma sección.',
          ]:[
            'Se quita el plan que habías elegido. No hubo ni habrá ningún cobro.',
            'Tus datos, costos e historial se conservan.',
            'Podés elegir un plan de nuevo cuando quieras.',
          ]).map(item=><li key={item}><CalendarDays aria-hidden="true"/>{item}</li>)}</ul>
        </>:<>
          <label className="p-field"><span className="p-fieldLabel">Para confirmar, escribí DAR DE BAJA</span><span className="p-input"><input autoFocus value={typed} onChange={event=>setTyped(event.target.value.toUpperCase())} autoComplete="off" disabled={working} aria-label="Escribí DAR DE BAJA"/></span></label>
          <p className="p-sub" style={{margin:'10px 0 0',fontSize:12.5}}>Por seguridad, después te vamos a pedir que confirmes tu identidad con tu contraseña o un código, así nadie puede dar de baja la suscripción sin querer o sin tu permiso.</p>
        </>}
        {error&&<p className="p-warnLine" role="alert">{error}</p>}
      </div>
      <div className="p-drawerFoot">{step===1?<><button type="button" className="p-btn p-primary" onClick={onClose}>{paid?`Seguir con ${planName}`:'Mantener mi elección'}</button><button type="button" className="p-btn p-ghost" onClick={()=>setStep(2)}>Continuar con la baja</button></>:<><button type="button" className="p-btn p-ghost" onClick={()=>setStep(1)} disabled={working}>Volver</button><button type="button" className="p-btn p-danger" disabled={typed.trim()!=='DAR DE BAJA'||working} onClick={()=>void confirm()}>{working?'Confirmando…':'Dar de baja'}</button></>}</div>
    </div></>;
}
