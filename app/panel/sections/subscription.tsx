'use client';

import { useEffect, useState } from 'react';
import { Mail, CalendarDays, Coins, CreditCard, ShieldCheck, Sparkles } from 'lucide-react';
import type { LiveRates } from '../../../lib/exchange-rates';
import { PlanConfigurator, ConfirmPlanDialog, CancelSubscriptionDialog, SubscriptionData } from '../shared';

export function SubscriptionSection() {
  const [data,setData]=useState<SubscriptionData|null>(null);
  const [annual,setAnnual]=useState(false);
  const [message,setMessage]=useState('');
  const [saving,setSaving]=useState<string|null>(null);
  const [pendingPlan,setPendingPlan]=useState<string|null>(null);
  const [cancelOpen,setCancelOpen]=useState(false);
  const [officialRate,setOfficialRate]=useState<{sell:number;updatedAt:string|null}|null>(null);
  useEffect(()=>{fetch('/api/finance/live-rates',{cache:'no-store'}).then(response=>response.ok?response.json() as Promise<LiveRates>:null).then(data=>{const quote=data?.quotes?.official;if(quote?.sell)setOfficialRate({sell:quote.sell,updatedAt:quote.updatedAt});}).catch(()=>undefined);},[]);

  async function loadSubscription() {
    try {
      const response=await fetch('/api/subscription');
      if (!response.ok) {setMessage('No pudimos cargar el plan de la cuenta.');return;}
      const next=await response.json() as SubscriptionData;
      setData(next);setAnnual(next.subscription.billingCycle==='annual');
    } catch {setMessage('No pudimos cargar el plan. Revisá tu conexión e intentá nuevamente.');}
  }
  useEffect(()=>{
    // Al volver de Mercado Pago se confirma el estado real del pago.
    const params=new URLSearchParams(window.location.search);
    if(params.get('mp')==='volver'){
      const preapprovalId=params.get('preapproval_id');
      window.history.replaceState(null,'','/panel?section=plan');
      queueMicrotask(()=>setMessage('Confirmando el pago con Mercado Pago…'));
      // Mercado Pago confirma la suscripción unos segundos después de volver: se reintenta un rato.
      let cancelled=false;
      const attempt=async(left:number)=>{
        try {
          const response=await fetch('/api/subscription',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'sync',preapprovalId})});
          const result=await response.json().catch(()=>({})) as SubscriptionData&{error?:string};
          if(cancelled)return;
          if(response.ok&&result.subscription?.status==='active'){setData(result);setMessage(result.message||'');return;}
          if(response.ok)setData(result);
          if(left>0){window.setTimeout(()=>void attempt(left-1),4000);return;}
          setMessage(response.ok?result.message||'':'No pudimos confirmar el pago todavía. Si lo completaste, el plan se activa solo en unos minutos.');
          if(!response.ok)void loadSubscription();
        } catch {if(!cancelled)void loadSubscription();}
      };
      void attempt(6);
      return ()=>{cancelled=true;};
    }
    void Promise.resolve().then(loadSubscription);
  },[]);

  async function goToCheckout(planId:string,payerEmail?:string) {
    setSaving(planId);setMessage('');
    try {
      const response=await fetch('/api/subscription',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'checkout',planId,billingCycle:annual?'annual':'monthly',acceptTerms:true,payerEmail})});
      const result=await response.json().catch(()=>({})) as {initPoint?:string;error?:string;detail?:string};
      if(response.ok&&result.initPoint){window.location.assign(result.initPoint);return;}
      setMessage(result.error==='exchange_rate_unavailable'?'No pudimos obtener el dólar oficial de hoy. Probá de nuevo en unos minutos.':result.error==='already_subscribed'?'Ya tenés una suscripción activa.':`No pudimos abrir Mercado Pago. Probá de nuevo en unos minutos.${result.detail?` (Mercado Pago: ${result.detail})`:''}`);setPendingPlan(null);
    } catch {setMessage('No pudimos abrir Mercado Pago. Revisá tu conexión e intentá nuevamente.');}
    setSaving(null);
  }

  async function choosePlan(planId:string,payerEmail?:string) {
    if (!data?.canManage) return;
    if (data.checkoutEnabled) {await goToCheckout(planId,payerEmail);return;}
    setSaving(planId);setMessage('');
    try {
      const response=await fetch('/api/subscription',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({planId,billingCycle:annual?'annual':'monthly',acceptTerms:true})});
      const result=await response.json().catch(()=>({})) as SubscriptionData&{error?:string};
      if (!response.ok) {setMessage(result.error==='forbidden'?'Solo el propietario o un administrador puede elegir el plan.':'No pudimos guardar tu elección.');return;}
      setData(result);setMessage(result.message||'Elección guardada.');setPendingPlan(null);
    } catch {setMessage('No pudimos guardar tu elección. Revisá tu conexión e intentá nuevamente.');}
    finally {setSaving(null);}
  }

  if (!data) return <div className="p-empty">{message||'Cargando plan y consumo…'}</div>;
  const trial=data.subscription.status==='trialing';
  const currentLabel=trial?'Prueba completa':data.currentPlan.name;
  const requested=data.subscription.requestedPlanId;
  const usageLimit=data.usage.limit;
  const number=(value:number)=>new Intl.NumberFormat('es-AR').format(value);

  return <section className="p-subscription">
    <div className="p-head"><div><div className="p-eyebrow">PLAN Y FACTURACIÓN</div>{data?.subscription.complimentary?<><h1>Tu plan, <em>sin cargo</em></h1><p>Esta tienda tiene un plan regalado por Rentia: todas las funciones, sin vencimiento y sin cobros.</p></>:<><h1>El próximo paso <em>de tu tienda</em></h1><p>Explorá los planes según tus órdenes mensuales. Vos elegís cuándo avanzar; mover la barra no cambia tu cuenta.</p></>}</div></div>
    <div className="p-grid p-g3" style={{marginBottom:16}}>
      <div className="p-card p-planCard p-reveal"><span className="p-eyebrowS"><Sparkles size={14} aria-hidden="true"/> {trial?'PRUEBA ACTIVA':'PLAN ACTUAL'}</span><h2 style={{margin:'6px 0 2px',fontSize:28}}>{currentLabel}</h2><span className="p-sub">{trial?`${data.subscription.trialDaysRemaining} días restantes con acceso completo`:'Tu información y tu historial siguen disponibles'}</span></div>
      <div className="p-card p-reveal" style={{'--i':1} as React.CSSProperties}><b>{number(data.usage.orders)} órdenes</b> <span className="p-sub">{usageLimit?`de ${number(usageLimit)} en los últimos 30 días`:'en los últimos 30 días'}</span><div className="p-meter" aria-label={`${data.usage.percent}% del límite utilizado`}><i style={{width:`${data.usage.percent}%`}}/></div><span className="p-sub">{data.subscription.complimentary?'Plan sin cargo: sin límite de órdenes':<>Por tu volumen, te corresponde <b style={{color:'var(--text)'}}>{data.recommendation.name}</b></>}</span></div>
      <div className="p-card p-reveal" style={{'--i':2} as React.CSSProperties}><span className="p-eyebrowS"><CreditCard size={14} aria-hidden="true"/> FACTURACIÓN</span><h3 style={{margin:'6px 0 2px'}}>{data.subscription.complimentary?'Sin cargo':data.subscription.providerStatus==='authorized'?'Mercado Pago':data.checkoutEnabled?'Pagá con Mercado Pago':'Sin medio de pago'}</h3><span className="p-sub">{data.subscription.complimentary?'Plan regalado por Rentia: no se cobra nada.':data.subscription.providerStatus==='authorized'?`Débito automático${data.subscription.providerAmount?` de ARS ${new Intl.NumberFormat('es-AR').format(data.subscription.providerAmount)}`:''} ${data.subscription.billingCycle==='annual'?'por año':'por mes'}. Se ajusta al dólar oficial.`:data.checkoutEnabled?'Elegí tu plan y cargás la tarjeta en Mercado Pago.':'Podés elegir ahora: todavía no se realizará ningún cobro.'}</span></div>
    </div>
    {message&&<div className="p-note">{message}</div>}
    {data.testMode&&data.checkoutEnabled&&<div className="p-notice p-warning" style={{marginBottom:16}}><div><b>Cobros en modo prueba</b><p>Mercado Pago está conectado con claves de prueba: no se cobra plata real. Solo vos ves esta opción.</p></div></div>}
    {data.subscription.status==='past_due'&&<div className="p-notice p-warning" role="alert" style={{marginBottom:16}}><div><b>No pudimos cobrar tu plan</b><p>Mercado Pago rechazó el último cobro. Revisá la tarjeta en Mercado Pago: tu plan sigue activo unos días{data.subscription.pastDueSince?` (hasta el ${new Intl.DateTimeFormat('es-AR',{dateStyle:'long'}).format(new Date(new Date(data.subscription.pastDueSince).getTime()+7*86400000))})`:''} y después pasa a Gratis, sin perder datos.</p></div></div>}
    {(data.payments?.length||0)>0&&<div className="p-card p-reveal" style={{marginBottom:16}}><div className="p-cardHead"><div><span className="p-eyebrowS">PAGOS</span><h3>Historial de cobros</h3><span className="p-sub">Los cobros de tu suscripción en Mercado Pago.</span></div></div><ul className="p-weekList">{data.payments!.map(payment=><li key={payment.id}><span>{new Intl.DateTimeFormat('es-AR',{dateStyle:'long'}).format(new Date(payment.paidAt))}</span><span className={`p-chip ${payment.status==='approved'?'p-g':payment.status==='rejected'?'p-r':'p-n'}`}>{payment.status==='approved'?'Aprobado':payment.status==='rejected'?'Rechazado':'En proceso'}</span><b className="p-mono">ARS {new Intl.NumberFormat('es-AR').format(payment.amount)}</b></li>)}</ul></div>}
    {(data.emails?.length||0)>0&&<div className="p-card p-reveal" style={{marginBottom:16}}><div className="p-cardHead"><div><span className="p-eyebrowS"><Mail size={14} aria-hidden="true"/> AVISOS</span><h3>Mails que te mandamos</h3><span className="p-sub">Los avisos de tu cuenta, al email del propietario.</span></div></div><ul className="p-weekList">{data.emails!.slice(0,10).map(email=><li key={email.kind+email.sentAt}><span>{({welcome:'Bienvenida',trial_ending:'Tu prueba está por terminar',trial_ended:'Terminó tu prueba',subscription_active:'Plan activado',payment_failed:'Cobro rechazado',subscription_canceled:'Baja confirmada',plan_expired:'Pasaste al plan Gratis',price_increase:'Ajuste por el dólar',customer_data_request:'Pedido de datos de un comprador',weekly_summary:'Resumen semanal'} as Record<string,string>)[email.kind]||email.kind}</span><span className="p-sub">{new Intl.DateTimeFormat('es-AR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(email.sentAt))}</span></li>)}</ul></div>}
    {(()=>{const sub=data.subscription;const paid=sub.status==='active';const chosen=data.plans.find(plan=>plan.id===(paid?sub.planId:requested));if(!paid&&!chosen)return null;const until=sub.currentPeriodEnd?new Intl.DateTimeFormat('es-AR',{dateStyle:'long'}).format(new Date(sub.currentPeriodEnd)):null;return <div className="p-card p-reveal p-mySub" style={{marginBottom:16}}>
      <div className="p-cardHead"><div><span className="p-eyebrowS">TU SUSCRIPCIÓN</span><h3 style={{margin:'4px 0 2px'}}>{chosen?.name||data.currentPlan.name} · {sub.complimentary?'sin cargo':sub.billingCycle==='annual'?'anual':'mensual'}</h3><span className="p-sub">{sub.complimentary?'Plan sin cargo: no vence y no se cobra nada.':paid?(sub.cancelAtPeriodEnd?`Baja confirmada: no se te va a cobrar más. Tenés acceso hasta el ${until||'final del período pagado'}.`:`Se renueva automáticamente${until?` el ${until}`:''}. Podés darte de baja cuando quieras.`):'Elegiste este plan. Todavía no hay cobros activos: lo vas a confirmar antes del primer cobro.'}</span></div>
        {data.canManage&&!sub.complimentary&&!(paid&&sub.cancelAtPeriodEnd)&&<button type="button" className="p-btn p-dangerGhost" onClick={()=>setCancelOpen(true)}>{paid?'Dar de baja':'Quitar mi elección'}</button>}</div>
      {!sub.complimentary&&<p className="p-sub" style={{margin:0,fontSize:12.5}}>Darte de baja es inmediato y sin penalidades: lo hacés vos desde acá, sin llamar ni escribir a nadie. Los detalles están en los <a href="/terminos" target="_blank" rel="noopener noreferrer" style={{color:'var(--cyan)'}}>Términos y condiciones</a>.</p>}
    </div>;})()}
    {!data.subscription.complimentary&&<PlanConfigurator plans={data.plans} initialPlanId={requested||data.recommendation.id} recommendedPlanId={data.recommendation.id} usageOrders={data.usage.orders} annual={annual} onAnnualChange={setAnnual} onChoose={planId=>setPendingPlan(planId)} checkoutEnabled={Boolean(data.checkoutEnabled)} currentPlanId={trial?undefined:data.subscription.planId} requestedPlanId={requested} requestedBillingCycle={data.subscription.billingCycle} savingPlanId={saving} canManage={data.canManage&&!data.subscription.complimentary} officialRate={officialRate}/>}
    {!data.subscription.complimentary&&<div className="p-grid p-g3" style={{marginBottom:16}}>{([[ShieldCheck,'14 días de prueba','Acceso completo, sin tarjeta.'],[CalendarDays,'Renovación transparente','Vas a ver el monto antes de pagar.'],[Coins,'Sin costos escondidos','El precio depende del volumen.']] as const).map(([Icon,title,detail],index)=><div className="p-card p-reveal p-roleCard" style={{'--i':index} as React.CSSProperties} key={title}><Icon className="p-i" aria-hidden="true"/><div><b>{title}</b><p className="p-sub">{detail}</p></div></div>)}</div>}
    {!data.checkoutEnabled&&!data.subscription.complimentary&&<div className="p-card p-reveal" aria-labelledby="billing-roadmap-title"><div className="p-grid p-g2"><div><span className="p-eyebrowS">PRÓXIMO PASO</span><h3 id="billing-roadmap-title" style={{margin:'4px 0 6px'}}>Cobros simples dentro de Rentia</h3><p className="p-sub">La opción recomendada para comenzar en Argentina es integrar pagos recurrentes. Hasta que esté conectada, esta pantalla solo guarda tu preferencia y no solicita una tarjeta.</p><div className="p-note" style={{margin:0}}><CreditCard className="p-i" aria-hidden="true"/> <b>Integración de cobro pendiente</b> · Ningún plan genera cargos hoy</div></div><div>{([['Elegís el plan','Según el volumen real de tu tienda.'],['Confirmás el pago','En un checkout seguro y fuera de Rentia.'],['Rentia se actualiza','Plan, vencimiento y estado quedan sincronizados.']] as const).map(([title,detail],index)=><div className="p-stepRow" key={title}><span>{index+1}</span><div><b>{title}</b><small>{detail}</small></div></div>)}</div></div></div>}
    {pendingPlan&&(()=>{const plan=data.plans.find(item=>item.id===pendingPlan);return plan?<ConfirmPlanDialog plan={plan} annual={annual} saving={saving===plan.id} officialRate={officialRate} checkout={data.checkoutEnabled?{payerEmail:data.payerEmail||'',testMode:Boolean(data.testMode)}:null} onConfirm={payerEmail=>void choosePlan(plan.id,payerEmail)} onClose={()=>setPendingPlan(null)}/>:null;})()}
    {cancelOpen&&<CancelSubscriptionDialog planName={(data.plans.find(plan=>plan.id===(data.subscription.status==='active'?data.subscription.planId:requested))||data.currentPlan).name} paid={data.subscription.status==='active'} periodEnd={data.subscription.currentPeriodEnd??null} onClose={()=>setCancelOpen(false)} onDone={result=>{setCancelOpen(false);if(result.subscription)setData(result as SubscriptionData);setMessage(result.message||'Baja confirmada.');}}/>}
  </section>;
}

