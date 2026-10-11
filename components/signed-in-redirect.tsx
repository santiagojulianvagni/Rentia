'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect } from 'react';

// Clerk oculta <SignIn>/<SignUp> cuando ya hay una sesión, incluso una que todavía no
// tiene organización (justo después de registrarse con Google). En vez de dejar la
// tarjeta vacía, seguimos al onboarding, donde se crea la tienda, y mostramos un aviso
// con un botón por si la redirección automática no ocurre.
export default function SignedInRedirect({to='/onboarding'}:{to?:string}) {
  const {isLoaded,isSignedIn}=useAuth({treatPendingAsSignedOut:false});
  useEffect(()=>{ if(isLoaded&&isSignedIn) window.location.replace(to); },[isLoaded,isSignedIn,to]);
  if(!isLoaded||!isSignedIn)return null;
  return <div className="authContinue" role="status"><span className="onboardingSpinner"/><b>Abriendo tu cuenta…</b><a className="button" href={to}>Continuar →</a></div>;
}
