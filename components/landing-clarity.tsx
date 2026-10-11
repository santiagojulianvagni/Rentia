import { ArrowDownRight, ArrowRight, Check, KeyRound, LockKeyhole, ShieldCheck, UsersRound } from 'lucide-react';
import TermHelp from './term-help';

export function LandingComparison() {
  return <section className="section shell landingComparison" aria-labelledby="clarity-title" data-landing-scene>
    <div className="sectionHead centered" data-landing-reveal><div><span className="tag">LA VENTA ES SOLO EL PRINCIPIO</span><h2 id="clarity-title">De vender a entender<br/><em>qué ganás.</em></h2><p>El mismo pedido. Dos formas de mirarlo.</p></div></div>
    <div className="clarityCards" data-landing-reveal>
      <article className="claritySale"><span className="clarityLabel">SI SOLO MIRÁS LAS VENTAS</span><span className="clarityAmount">$100.000</span><p>Entró un pedido. Pero todavía no sabés cuánto te queda.</p><div className="claritySaleTrack" aria-hidden="true"/><div className="clarityUnknown"><span>Producto · envío · comisiones · publicidad · impuestos</span><b>¿Y los costos?</b></div></article>
      <span className="clarityArrow" aria-hidden="true"><ArrowRight/></span>
      <article className="clarityResult premiumBeam" data-landing-beam><span className="clarityLabel"><img src="/favicon.svg" alt=""/> CON LOS COSTOS IDENTIFICADOS</span><div className="clarityResultHead"><div><span>Ganancia del ejemplo</span><strong>$30.000</strong></div><span className="clarityMargin">30%<small>margen</small></span></div><div className="claritySplit" aria-label="Costos 70%, ganancia 30%"><span/><span/></div><div className="claritySplitLabels"><span>$70.000 en costos</span><b>$30.000 de ganancia</b></div><p><Check aria-hidden="true"/> Si un costo falta, Rentia lo señala como pendiente.</p></article>
    </div>
    <p className="clarityExample">Ejemplo ilustrativo en ARS: venta $100.000 − producto $35.000 − envío $5.000 − comisiones $7.000 − publicidad $18.000 − impuestos $5.000. No es una promesa de resultados.</p>
  </section>;
}

export function LandingConnections() {
  return <section className="section shell landingDataFlow" id="integraciones" aria-labelledby="flow-title" data-landing-scene>
    <div className="landingFlowCopy" data-landing-reveal><span className="tag">MENOS PESTAÑAS. MÁS CLARIDAD.</span><h2 id="flow-title">Tu operación,<br/><em>en la misma cuenta.</em></h2><p>Conectá tu tienda y tu publicidad. Rentia reúne la información disponible y te muestra qué falta completar.</p></div>
    <div className="flowDiagram" data-landing-reveal>
      <svg className="flowLines" viewBox="0 0 500 300" preserveAspectRatio="none" aria-hidden="true"><path className="flowBase" d="M185 43 H240 Q265 43 265 68 V125 Q265 150 290 150 H350 M185 150 H350 M185 257 H240 Q265 257 265 232 V175 Q265 150 290 150 H350"/><path className="flowPulse" d="M185 43 H240 Q265 43 265 68 V125 Q265 150 290 150 H350 M185 150 H350 M185 257 H240 Q265 257 265 232 V175 Q265 150 290 150 H350"/></svg>
      <div className="flowSources"><div className="flowNode"><img src="/brands/tiendanube-icon.png" alt=""/><span><b>Tiendanube</b><small>Ventas y productos</small></span></div><div className="flowNode"><img src="/brands/mercado-libre-icon.png" alt=""/><span><b>Mercado Libre</b><small>Ventas, cargos y Product Ads</small></span></div><div className="flowNode"><img src="/brands/meta.png" alt=""/><span><b>Meta Ads</b><small>Inversión y campañas</small></span></div></div>
      <div className="flowDestination premiumBeam" data-landing-beam><img src="/favicon.svg" alt=""/><b>Rentia</b><span>Ventas + costos<br/>+ publicidad</span><small><Check aria-hidden="true"/> Lecturas separadas,<br/>sin duplicar ventas</small></div>
      <span className="flowCaption">Conexiones disponibles hoy</span>
    </div>
  </section>;
}

export function LandingGlossary() {
  return <section className="section shell landingGlossary" aria-labelledby="glossary-title" data-landing-scene>
    <div className="glossaryShowcase premiumBeam" data-landing-beam data-landing-reveal>
      <div className="glossaryShowcaseHead"><img src="/favicon.svg" alt=""/><b>Una explicación, justo donde la necesitás.</b><small>Ejemplo ilustrativo</small></div>
      <div className="glossaryMetrics">
        <div><span>ROAS <TermHelp term="ROAS" meaning="Compara las ventas atribuidas a la publicidad con lo que invertiste en anuncios. No es lo mismo que ganancia." example="Si invertís $10.000 y se atribuyen $30.000 en ventas, el ROAS es 3x. Todavía faltan descontar los costos."/></span><strong>3,00x</strong><small>Ventas / inversión</small></div>
        <div><span>SKU <TermHelp term="SKU" meaning="Es el código que identifica un producto o una variante, como un talle o un color." example="REM-NEG-M puede identificar una remera negra talle M. Sirve para asociar sus ventas, costo y stock."/></span><strong>REM-NEG-M</strong><small>Producto identificado</small></div>
        <div><span>CPA <TermHelp term="CPA" meaning="Es el costo promedio de cada compra atribuida a los anuncios." example="Si invertís $20.000 y se atribuyen 10 compras, el CPA es $2.000. Te ayuda a comparar campañas."/></span><strong>$2.000</strong><small>Inversión / compras</small></div>
      </div>
      <div className="glossaryExplanation"><span aria-hidden="true">?</span><div><small>EN PALABRAS SIMPLES</small><b>Un ROAS de 3x no significa triplicar tu ganancia.</b><p>Significa $3 en ventas atribuidas por cada $1 invertido. Los costos también cuentan.</p></div></div>
      <p className="glossaryHint"><ArrowDownRight aria-hidden="true"/> Pasá el cursor, tocá o usá el teclado sobre un (?) para ver la ayuda.</p>
    </div>
    <div className="glossaryCopy" data-landing-reveal><span className="tag">NO NECESITÁS HABLAR EN SIGLAS</span><h2 id="glossary-title">Tus números,<br/><em>en tu idioma.</em></h2><p>¿SKU, ROAS, CPA? No necesitás conocer todos los términos para entender tu tienda.</p><p>Los (?) de Rentia te explican qué significan, para qué sirven y cómo interpretarlos, sin salir de lo que estás mirando.</p>{/* Public product pages use native navigation, like the other landing links. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a className="ghost" href="/producto/publicidad">Entendé mejor tu publicidad <ArrowRight aria-hidden="true"/></a></div>
  </section>;
}

export function LandingPrivacy() {
  return <section className="shell landingPrivacy" id="privacidad" aria-labelledby="privacy-title" data-landing-reveal>
    <div className="privacyIntro"><span className="privacyIcon"><ShieldCheck aria-hidden="true"/></span><div><span className="tag">ACCESO A TU INFORMACIÓN</span><h2 id="privacy-title">Tus números, dentro de tu cuenta.</h2><p>El acceso al panel requiere una sesión. Las ayudas y ejemplos de esta web usan datos ilustrativos, no los números de nuestros usuarios.</p></div></div>
    <div className="privacyFacts"><div><LockKeyhole aria-hidden="true"/><span><b>Panel con autenticación</b><small>Ingresás con tu cuenta.</small></span></div><div><UsersRound aria-hidden="true"/><span><b>Administración por roles</b><small>Propietarios y administradores gestionan la cuenta.</small></span></div><div><KeyRound aria-hidden="true"/><span><b>Credenciales de integración cifradas</b><small>Los tokens de conexión se guardan cifrados.</small></span></div></div>
  </section>;
}
