import Link from 'next/link';

// Pantalla para cuando no hay sesión (por ejemplo, venció): en vez de un aviso seco, el logo
// se arma con una animación y unas tarjetitas de métricas flotan alrededor.
export default function SignedOutCard() {
  return <section className="signedOut" aria-labelledby="signed-out-title">
    <div className="signedOutArt" aria-hidden="true">
      <span className="signedOutGlow"/>
      <span className="signedOutLogo"><i/><i/><i/><i/></span>
      <span className="signedOutChip c1"><b>+32%</b> ventas</span>
      <span className="signedOutChip c2"><b>24%</b> margen real</span>
      <span className="signedOutChip c3"><b>3,1x</b> ROAS</span>
    </div>
    <span className="signedOutTag">TU SESIÓN SE CERRÓ</span>
    <h1 id="signed-out-title">Tus números te están esperando</h1>
    <p>Por seguridad cerramos la sesión en este navegador. Ingresá y seguí viendo cuánto ganás de verdad.</p>
    <div className="signedOutActions">
      <Link className="signedOutPrimary" href="/ingresar">Ingresar</Link>
      <Link className="signedOutSecondary" href="/registro">Crear cuenta gratis</Link>
    </div>
    <small>¿Primera vez? Probalo 14 días gratis, sin tarjeta.</small>
  </section>;
}
