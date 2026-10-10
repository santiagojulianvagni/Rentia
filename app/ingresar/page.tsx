'use client';

import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';
import SignedInRedirect from '../../components/signed-in-redirect';

const clerkAppearance={
  variables:{colorPrimary:'#21d4c2',colorPrimaryForeground:'#031513',colorBackground:'#0b1826',colorForeground:'#f4f8fb',colorMuted:'#102232',colorMutedForeground:'#9bb0c3',colorNeutral:'#f4f8fb',colorInput:'#08131f',colorInputForeground:'#f4f8fb',colorRing:'#21d4c2',borderRadius:'0.8rem'},
  elements:{cardBox:'shadow-none w-full',card:'shadow-none border border-solid border-[#233b4e]',socialButtonsBlockButton:'border-[#294357] bg-[#0a1724]',formFieldInput:'border-[#294357]',footerActionLink:'text-[#21d4c2]'},
};

export default function Ingresar() {
  return <main className="authPage clerkAuthPage">
    <SignedInRedirect/>
    <Link className="brand authBrand" href="/"><span className="brandMark"><img src="/favicon.svg" alt=""/></span>Rentia</Link>
    <section className="authSplit">
      <div className="authIntro"><span className="tag">BIENVENIDO DE NUEVO</span><h1>Tu rentabilidad,<br/><em>siempre actualizada.</em></h1><p>Ingresá con el mismo email o cuenta de Google que usaste al registrarte.</p><div className="authProof"><div><b>✓</b><span>Datos protegidos</span></div><div><b>✓</b><span>Acceso por tienda</span></div><div><b>✓</b><span>Equipo con permisos</span></div></div></div>
      <div className="clerkCardWrap"><SignIn routing="hash" signUpUrl="/registro" forceRedirectUrl="/onboarding" appearance={clerkAppearance}/></div>
    </section>
  </main>;
}
