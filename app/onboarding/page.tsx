'use client';

import { useAuth, useClerk, useUser } from '@clerk/nextjs';
import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { onboardingRequest, OnboardingRequestError } from '../../lib/onboarding-request';
import SignedOutCard from '../../components/signed-out-card';

type Step='checking'|'store'|'channels'|'connections';
type Channel='tiendanube'|'mercadolibre';
type BootstrapResult={organizationId:string;needsChannels?:boolean;error?:string};

const tiendanubeLogo=<span className="integrationLogo brandLogo"><img src="/brands/tiendanube-icon.png" alt=""/></span>;
const mercadoLibreLogo=<span className="integrationLogo brandLogo"><img src="/brands/mercado-libre-icon.png" alt=""/></span>;

export default function Onboarding() {
  // A new account's session can be pending until it has an organization;
  // onboarding is where that organization is created, so it counts as signed in.
  const {isLoaded,isSignedIn}=useAuth({treatPendingAsSignedOut:false});
  const {setActive}=useClerk();
  const {user}=useUser();
  const [step,setStep]=useState<Step>('checking');
  const [name,setName]=useState('');
  const [store,setStore]=useState('');
  const [phone,setPhone]=useState('');
  const [channels,setChannels]=useState<Channel[]>(['tiendanube']);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [attempt,setAttempt]=useState(0);
  const [signedOut,setSignedOut]=useState(false);
  const bootstrap=useRef<{attempt:number;promise:Promise<BootstrapResult>}|null>(null);
  // Mercado Libre can be connected once its app credentials are configured.
  const [meliAvailable,setMeliAvailable]=useState(false);
  useEffect(()=>{
    if(step!=='connections'||!channels.includes('mercadolibre'))return;
    fetch('/api/sync/mercadolibre',{cache:'no-store'}).then(response=>response.ok?response.json() as Promise<{available?:boolean}>:null).then(data=>setMeliAvailable(Boolean(data?.available))).catch(()=>setMeliAvailable(false));
  },[step,channels]);

  async function activateStore(data:BootstrapResult) {
    if (!data.organizationId) throw new Error('missing_organization');
    await setActive({organization:data.organizationId});
  }

  useEffect(()=>{
    if (!isLoaded) return;
    // Después de volver de Google la sesión puede tardar un instante en activarse: esperamos
    // antes de dar por cerrada la sesión, y no redirigimos solos para no rebotar entre páginas.
    if (!isSignedIn) { const timer=window.setTimeout(()=>setSignedOut(true),3000); return ()=>window.clearTimeout(timer); }
    let cancelled=false;
    setError('');
    // Reuse the first request across effect replays instead of creating a
    // second organization during registration or legacy-account migration.
    if (!bootstrap.current||bootstrap.current.attempt!==attempt) bootstrap.current={attempt,promise:onboardingRequest<BootstrapResult>('/api/account/bootstrap',{})};
    bootstrap.current.promise.then(async data=>{
      if (cancelled) return;
      if (!data.organizationId) throw new Error('missing_organization');
      await setActive({organization:data.organizationId});
      if (cancelled) return;
      if (data.needsChannels) {setStep('channels');return;}
      window.location.assign('/panel?section=resumen');
    }).catch(reason=>{
      if (cancelled) return;
      if (reason instanceof OnboardingRequestError&&reason.status===409&&reason.code==='store_required') {setName(current=>current||user?.fullName||'');setStep('store');return;}
      if (reason instanceof OnboardingRequestError&&reason.status===401) {setError('Tu sesión todavía no está lista. Tocá Reintentar o volvé a ingresar.');return;}
      setError('No pudimos preparar tu cuenta. Podés reintentar sin volver a registrarte.');
    });
    return ()=>{cancelled=true;};
  },[isLoaded,isSignedIn,setActive,user?.fullName,attempt]);

  async function createStore(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if (saving) return;setSaving(true);setError('');
    const phoneDigits=phone.trim().replace(/^\+54/,'').replace(/\D/g,'');
    try {
      if (!name.trim()||!store.trim()) {setError('Completá tu nombre y el nombre de la tienda.');return;}
      if (phoneDigits&&(phoneDigits.length<6||phoneDigits.length>13)) {setError('Revisá el celular: ingresá entre 6 y 13 números, sin el código +54.');return;}
      const data=await onboardingRequest<BootstrapResult>('/api/account/bootstrap',{name:name.trim(),store:store.trim(),phone:phoneDigits});
      await activateStore(data);
      if (data.needsChannels) setStep('channels');
      else window.location.assign('/panel?section=resumen');
    } catch {setError('No pudimos crear o abrir la tienda. Revisá tu conexión y volvé a intentarlo.');}
    finally {setSaving(false);}
  }

  function toggleChannel(channel:Channel) {
    setChannels(current=>current.includes(channel)?current.filter(item=>item!==channel):[...current,channel]);
  }

  async function persistChannels(next:Step|'panel') {
    if (saving) return;setSaving(true);setError('');
    try {
      await onboardingRequest('/api/settings',{type:'channels',channels});
      if (next==='panel') window.location.assign('/panel?section=resumen');
      else setStep(next);
    } catch {setError('No pudimos guardar los canales. Revisá tu conexión y volvé a intentarlo.');}
    finally {setSaving(false);}
  }

  async function skipOnboarding() {
    if (saving) return;setSaving(true);setError('');
    try {
      await onboardingRequest('/api/settings',{type:'channels',channels:[]});
      window.location.assign('/panel?section=resumen');
    } catch {setError('No pudimos guardar tu elección. Revisá tu conexión y volvé a intentarlo.');}
    finally {setSaving(false);}
  }

  async function connect(provider:Channel) {
    if (saving) return;setSaving(true);setError('');
    try {
      await onboardingRequest('/api/settings',{type:'channels',channels});
      window.location.href=`/api/integrations/${provider}/start`;
    } catch {setError('No pudimos preparar la conexión. Revisá tu conexión y volvé a intentarlo.');}
    finally {setSaving(false);}
  }

  if (step==='checking'&&signedOut&&!isSignedIn) return <main className="onboardingPage"><header className="onboardingNav"><Link className="brand" href="/"><span className="brandMark"><img src="/favicon.svg" alt=""/></span>Rentia</Link><span>Primeros pasos</span></header><SignedOutCard/></main>;

  if (step==='checking') return <main className="onboardingPage"><header className="onboardingNav"><Link className="brand" href="/"><span className="brandMark"><img src="/favicon.svg" alt=""/></span>Rentia</Link><span>Preparando tu espacio de trabajo</span></header><section className="onboardingShell onboardingChecking">{!error&&<span className="onboardingSpinner"/>}<h2>{error?'No pudimos preparar tu cuenta':'Preparando tu cuenta…'}</h2>{error&&<><p className="formError" role="alert">{error}</p><button type="button" className="button" onClick={()=>setAttempt(current=>current+1)}>Reintentar</button><Link className="outline" href="/ingresar">Volver al ingreso</Link></>}</section></main>;

  const progress=step==='store'?1:step==='channels'?2:3;

  return <main className="onboardingPage">
    <header className="onboardingNav"><Link className="brand" href="/"><span className="brandMark"><img src="/favicon.svg" alt=""/></span>Rentia</Link><span>Primeros pasos</span>{step!=='store'&&<button disabled={saving} onClick={skipOnboarding}>Saltar por ahora</button>}</header>
    <section className="onboardingShell">
      <div className="onboardingSteps"><span className="done"><b>1</b>Cuenta</span><span className={progress>=2?'done':'active'} aria-current={step==='store'?'step':undefined}><b>2</b>Tu negocio</span><span className={progress>=3?'done':step==='channels'?'active':''} aria-current={step==='channels'?'step':undefined}><b>3</b>Canales</span></div>
      <div className="progress" aria-hidden="true"><i className="done"/><i className={progress>=2?'done':'active'}/><i className={progress>=3?'done':step==='channels'?'active':''}/></div>
      {step==='store'?<>
        <span className="tag">TU ESPACIO DE TRABAJO</span><h1>Contanos sobre tu tienda</h1><p className="onboardingLead">Esta tienda será tu organización en Rentia. Vos quedás como propietario y administrador principal.</p>
        <form className="storeSetupForm" onSubmit={createStore}><label>Tu nombre<input value={name} onChange={event=>setName(event.target.value)} placeholder="Ej. Martina García" required/></label><label>Nombre de la tienda<input value={store} onChange={event=>setStore(event.target.value)} placeholder="Ej. Casa Norte" required/></label><label>Celular de contacto <small>Opcional</small><div className="phoneField"><span>AR&nbsp;&nbsp;+54</span><input value={phone} inputMode="tel" onChange={event=>setPhone(event.target.value)} placeholder="11 5555 5555"/></div><em>No bloquea tu registro. La verificación por SMS se habilitará con un proveedor compatible en Argentina.</em></label>{error&&<p className="formError" role="alert">{error}</p>}<button className="button" disabled={saving}>{saving?'Creando tienda…':'Continuar →'}</button></form>
      </>:step==='channels'?<>
        <span className="tag">TUS CANALES</span><h1>¿Dónde vendés hoy?</h1><p className="onboardingLead">Elegí uno o ambos. Esto adapta Rentia a tu operación; conectar las cuentas sigue siendo opcional.</p>
        <div className="channelChoices"><button disabled={saving} aria-pressed={channels.includes('tiendanube')} className={channels.includes('tiendanube')?'selected':''} onClick={()=>toggleChannel('tiendanube')}>{tiendanubeLogo}<div><b>Tiendanube</b><small>Tienda, órdenes, productos y stock.</small></div><i>✓</i></button><button disabled={saving} aria-pressed={channels.includes('mercadolibre')} className={channels.includes('mercadolibre')?'selected':''} onClick={()=>toggleChannel('mercadolibre')}>{mercadoLibreLogo}<div><b>Mercado Libre</b><small>Marketplace, publicaciones y comisiones.</small></div><i>✓</i></button></div>
        {error&&<p className="formError" role="alert">{error}</p>}<div className="onboardingActions"><button className="outline" disabled={saving} onClick={skipOnboarding}>Configurar después</button><button className="button" disabled={saving||!channels.length} onClick={()=>persistChannels('connections')}>{saving?'Guardando…':'Continuar →'}</button></div>
      </>:<>
        <span className="tag">CONEXIONES OPCIONALES</span><h1>Conectá ahora o después</h1><p className="onboardingLead">Enlazar un canal sólo autoriza la lectura de datos. Envíos, impuestos y costos se revisan después desde Configuración.</p>
        <div className="onboardingIntegrations">{channels.includes('tiendanube')&&<article>{tiendanubeLogo}<div><b>Tiendanube</b><small>Órdenes, productos, costos y stock en tiempo real.</small></div><button className="button" disabled={saving} onClick={()=>connect('tiendanube')}>Conectar</button></article>}{channels.includes('mercadolibre')&&<article className={meliAvailable?undefined:'disabled'}>{mercadoLibreLogo}<div><b>Mercado Libre</b><small>{meliAvailable?'Ventas, publicaciones, comisiones y costos de envío.':'Ventas, publicaciones y comisiones. Disponible próximamente.'}</small></div>{meliAvailable?<button className="button" disabled={saving} onClick={()=>connect('mercadolibre')}>Conectar</button>:<button disabled>Próximamente</button>}</article>}</div>
        {error&&<p className="formError" role="alert">{error}</p>}<div className="onboardingActions"><button className="outline" disabled={saving} onClick={()=>setStep('channels')}>← Volver</button><button className="button" disabled={saving} onClick={()=>persistChannels('panel')}>Ir al panel sin conectar →</button></div>
      </>}
    </section>
  </main>;
}
