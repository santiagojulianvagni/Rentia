'use client';

import { SignUp } from '@clerk/nextjs';
import Link from 'next/link';
import SignedInRedirect from '../../components/signed-in-redirect';

const clerkAppearance={
  variables:{colorPrimary:'#21d4c2',colorPrimaryForeground:'#031513',colorBackground:'#0b1826',colorForeground:'#f4f8fb',colorMuted:'#102232',colorMutedForeground:'#9bb0c3',colorNeutral:'#f4f8fb',colorInput:'#08131f',colorInputForeground:'#f4f8fb',colorRing:'#21d4c2',borderRadius:'0.8rem'},
  elements:{rootBox:'w-full max-w-full min-w-0',cardBox:'shadow-none w-full max-w-full min-w-0',card:'shadow-none w-full max-w-full min-w-0 border border-solid border-[#233b4e]',socialButtonsBlockButton:'border-[#294357] bg-[#0a1724]',formFieldInput:'border-[#294357]',footerActionLink:'text-[#21d4c2]'},
};

export default function Registro() {
  return <main className="authPage clerkAuthPage">
    <SignedInRedirect/>
    <Link className="brand authBrand" href="/"><span className="brandMark"><img src="/favicon.svg" alt=""/></span>Rentia</Link>
    <section className="authSplit">
      <div className="authIntro"><span className="tag">14 DÍAS GRATIS</span><h1>Creá tu cuenta.<br/><em>Después conectás tu tienda.</em></h1><p>Registrate con Google o email. Confirmamos tu correo y recién después elegís qué canales querés integrar.</p><div className="authProof"><div><b>1</b><span>Email o Google</span></div><div><b>2</b><span>Correo verificado</span></div><div><b>3</b><span>Integraciones opcionales</span></div></div></div>
      <div className="clerkCardWrap">
        <SignUp routing="hash" signInUrl="/ingresar" forceRedirectUrl="/onboarding" appearance={clerkAppearance}/>
        <p className="authLegal">Al crear tu cuenta aceptás los <Link href="/terminos">Términos y condiciones</Link> y la <Link href="/privacidad">Política de privacidad</Link>. La prueba es gratis y no pide tarjeta.</p>
      </div>
    </section>
  </main>;
}
