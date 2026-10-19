import Link from 'next/link';
import type { ReactNode } from 'react';

// Tarjeta de estado con la marca: el logo se arma con una animación y unas tarjetitas de
// métricas flotan alrededor. Se usa cuando no hay sesión, mientras se prepara la cuenta y
// si algo falla, para que ninguna de esas pantallas quede seca.
export function StatusCard({tag,title,text,actions,note,tone='default',busy=false}:{tag:string;title:string;text:ReactNode;actions?:ReactNode;note?:ReactNode;tone?:'default'|'error';busy?:boolean}) {
  return <section className={`signedOut ${tone==='error'?'signedOutError':''} ${busy?'signedOutBusy':''}`} aria-labelledby="status-card-title" aria-busy={busy}>
    <div className="signedOutArt" aria-hidden="true">
      <span className="signedOutGlow"/>
      <span className="signedOutLogo"><i/><i/><i/><i/></span>
      <span className="signedOutChip c1"><b>+32%</b> ventas</span>
      <span className="signedOutChip c2"><b>24%</b> margen real</span>
      <span className="signedOutChip c3"><b>3,1x</b> ROAS</span>
    </div>
    <span className="signedOutTag">{tag}</span>
    <h1 id="status-card-title">{title}</h1>
    <p role={tone==='error'?'alert':undefined}>{text}</p>
    {actions&&<div className="signedOutActions">{actions}</div>}
    {note&&<small>{note}</small>}
  </section>;
}

export default function SignedOutCard() {
  return <StatusCard tag="TU SESIÓN SE CERRÓ" title="Tus números te están esperando"
    text="Por seguridad cerramos la sesión en este navegador. Ingresá y seguí viendo cuánto ganás de verdad."
    actions={<><Link className="signedOutPrimary" href="/ingresar">Ingresar</Link><Link className="signedOutSecondary" href="/registro">Crear cuenta gratis</Link></>}
    note="¿Primera vez? Probalo 14 días gratis, sin tarjeta."/>;
}
