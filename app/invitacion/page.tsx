'use client';

import { SignIn, SignUp, useClerk, useUser } from '@clerk/nextjs';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { UserOrganizationInvitationResource } from '@clerk/shared/types';

const appearance={variables:{colorPrimary:'#21d4c2',colorPrimaryForeground:'#031513',colorBackground:'#0b1826',colorForeground:'#f4f8fb',colorMuted:'#102232',colorMutedForeground:'#9bb0c3',colorNeutral:'#f4f8fb',colorInput:'#08131f',colorInputForeground:'#f4f8fb',borderRadius:'0.8rem'},elements:{rootBox:'w-full max-w-full min-w-0',cardBox:'shadow-none w-full',card:'shadow-none border border-solid border-[#233b4e]',footerActionLink:'text-[#21d4c2]'}};

export default function Invitacion() {
  const {isLoaded,isSignedIn,user}=useUser();
  const {setActive,signOut}=useClerk();
  const [params,setParams]=useState<URLSearchParams|null>(null);
  const [invitations,setInvitations]=useState<UserOrganizationInvitationResource[]>([]);
  const [checking,setChecking]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const opening=useRef(false);
  const organizationId=params?.get('organization_id')||'';
  useEffect(()=>{queueMicrotask(()=>setParams(new URLSearchParams(window.location.search)));},[]);

  const openOrganization=useCallback(async (id:string)=>{
    if (opening.current) return;
    opening.current=true;setBusy(true);
    try {
      await setActive({organization:id});
      // A full navigation sends the refreshed organization claims to the server.
      window.location.assign('/panel?section=resumen');
    } catch {
      opening.current=false;setBusy(false);setChecking(false);setError('No pudimos abrir la tienda. Volvé a intentarlo.');
    }
  },[setActive]);

  useEffect(()=>{
    if (!params||!isLoaded||!isSignedIn||!user) return;
    let cancelled=false;
    async function check() {
      setChecking(true);setError('');
      try {
        if (organizationId) {
          // This SDK method validates membership; the URL alone grants no access.
          for (let offset=0;;offset+=100) {
            const page=await user!.getOrganizationMemberships({pageSize:100,initialPage:offset/100+1});
            if (cancelled) return;
            if (page.data.some(item=>item.organization.id===organizationId)) {await openOrganization(organizationId);return;}
            if (offset+page.data.length>=page.total_count||!page.data.length) break;
          }
        }
        const pending:UserOrganizationInvitationResource[]=[];
        for (let offset=0;;offset+=100) {
          const page=await user!.getOrganizationInvitations({pageSize:100,initialPage:offset/100+1});
          if (cancelled) return;
          pending.push(...page.data.filter(item=>item.status==='pending'&&(!organizationId||item.publicOrganizationData.id===organizationId)));
          if (offset+page.data.length>=page.total_count||!page.data.length) break;
        }
        setInvitations(pending);setChecking(false);
      } catch {
        if (!cancelled) {setChecking(false);setError('No pudimos comprobar la invitación. Recargá esta página para intentarlo nuevamente.');}
      }
    }
    void check();
    return ()=>{cancelled=true;};
  },[params,isLoaded,isSignedIn,user,organizationId,openOrganization]);

  async function accept(invitation:UserOrganizationInvitationResource) {
    setBusy(true);setError('');
    try {await invitation.accept();await openOrganization(invitation.publicOrganizationData.id);}
    catch {setBusy(false);setError('No pudimos aceptar la invitación. Puede haber vencido o haberse cancelado. Pedí al administrador que la revise.');}
  }

  const signup=params?.get('mode')==='signup'||(!params?.get('mode')&&params?.get('__clerk_status')==='sign_up');
  const returnUrl=`/invitacion${organizationId?`?organization_id=${encodeURIComponent(organizationId)}`:''}`;
  const switchParams=new URLSearchParams(params||undefined);
  switchParams.set('mode',signup?'signin':'signup');
  const switchUrl=`/invitacion?${switchParams}`;

  return <main className="authPage clerkAuthPage invitationPage">
    <Link className="brand authBrand" href="/"><span className="brandMark"><img src="/favicon.svg" alt=""/></span>Rentia</Link>
    <section className="authSplit">
      <div className="authIntro"><span className="tag">TU EQUIPO, EN RENTIA</span><h1>Una invitación.<br/><em>La misma tienda.</em></h1><p>Entrá con el correo al que recibiste la invitación. Vas a colaborar en la tienda de tu equipo, sin crear ni conectar una nueva.</p><div className="authProof"><div><b>✓</b><span>Datos compartidos</span></div><div><b>✓</b><span>Permisos por persona</span></div><div><b>✓</b><span>Acceso seguro</span></div></div></div>
      <div className="clerkCardWrap">
        {!params||!isLoaded?<div className="invitationCard" role="status"><span className="onboardingSpinner"/><h2>Preparando tu invitación…</h2></div>:!isSignedIn?signup?<SignUp routing="hash" signInUrl={switchUrl} forceRedirectUrl={returnUrl} signInForceRedirectUrl={returnUrl} appearance={appearance}/>:<SignIn routing="hash" signUpUrl={switchUrl} forceRedirectUrl={returnUrl} signUpForceRedirectUrl={returnUrl} appearance={appearance}/>:<div className="invitationCard">
          {checking||busy?<><span className="onboardingSpinner"/><h2>{busy?'Abriendo tu tienda…':'Comprobando tu invitación…'}</h2></>:invitations.length?<><span className="tag">INVITACIÓN A COLABORAR</span><h2>Sumate a tu equipo</h2><p>Ingresaste como <strong>{user?.primaryEmailAddress?.emailAddress}</strong>.</p>{invitations.map(invitation=><article className="invitationStore" key={invitation.id}><div><b>{invitation.publicOrganizationData.name}</b><small>{invitation.role==='org:admin'?'Administrador':'Miembro del equipo'}</small></div><button className="button" disabled={busy} onClick={()=>accept(invitation)}>Aceptar invitación →</button></article>)}</>:<><h2>No encontramos una invitación pendiente</h2><p>Revisá que hayas entrado con el mismo correo al que llegó el mail. Si la invitación venció o se canceló, pedí una nueva al administrador.</p><p className="invitationEmail">{user?.primaryEmailAddress?.emailAddress}</p><button className="outline" onClick={()=>signOut({redirectUrl:returnUrl})}>Entrar con otra cuenta</button></>}
          {error&&<p className="formError" role="alert">{error}</p>}
          {!checking&&!busy&&invitations.length>0&&<button className="invitationSwitch" onClick={()=>signOut({redirectUrl:returnUrl})}>No es mi cuenta · cambiar correo</button>}
        </div>}
      </div>
    </section>
  </main>;
}
