import PricingSelector from './pricing-selector';
import LandingProfitDemo from '../components/landing-profit-demo';
import LandingMotion from '../components/landing-motion';
import LandingProductTour from '../components/landing-product-tour';
import LandingHeader from '../components/landing-header';
import { LandingComparison, LandingConnections, LandingGlossary, LandingPrivacy } from '../components/landing-clarity';
import './landing.css';

export default function Home() {
  return (
    <main className="rentiaLanding">
      <LandingMotion/>
      <LandingHeader home/>

      <section className="hero shell landingHero" id="inicio">
        <div className="landingHeroCopy">
        <div className="eyebrow premiumBeam" data-landing-beam><span /> Rentabilidad real, sin planillas</div>
        <h1>Tu tienda vende.<br/><em>Ahora sabé cuánto gana.</em></h1>
        <p>Rentia conecta tus ventas, costos y publicidad para mostrarte la ganancia real de tu e-commerce, orden por orden.</p>
        <div className="heroActions"><a className="button" href="/registro">Crear mi cuenta gratis</a><a className="ghost" href="#producto">Cómo funciona</a></div>
        <div className="trust"><span>14 días gratis</span><span>Sin tarjeta</span><span>Configuración guiada</span></div>
        </div>
        <div className="landingHeroDemo" id="dashboard"><LandingProfitDemo/></div>
      </section>

      <LandingComparison/>
      <LandingConnections/>

      <LandingProductTour/>
      <LandingGlossary/>

      <section className="stepsWrap">
        <section className="section shell">
          <div className="sectionHead centered" data-landing-reveal><div><span className="tag">EMPEZÁ EN MINUTOS</span><h2>Conectás. Configurás.<br/><em>Rentia hace las cuentas.</em></h2></div></div>
          <div className="steps" data-landing-reveal>
            <article data-landing-reveal><b>01</b><span className="stepDot">⌁</span><h3>Conectá tu tienda</h3><p>Conectá Tiendanube y sumá tu cuenta de Meta Ads para ver ventas y publicidad juntas.</p></article>
            <article data-landing-reveal><b>02</b><span className="stepDot">≋</span><h3>Completá tus costos</h3><p>Importamos los datos disponibles. Completá el costo de tus productos, envíos e impuestos y revisá los pendientes.</p></article>
            <article data-landing-reveal><b>03</b><span className="stepDot">✓</span><h3>Conocé tu ganancia</h3><p>Consultá las órdenes sincronizadas y compará períodos con todos tus números en el mismo lugar.</p></article>
          </div>
        </section>
      </section>

      <section className="section shell" id="precios">
        <div className="sectionHead centered"><div><span className="tag">PLANES SIMPLES</span><h2>Todo incluido.<br/><em>Pagás según tu volumen.</em></h2><p>14 días con acceso completo. Sin tarjeta y con un plan gratuito para empezar.</p></div></div>
        <PricingSelector/>
      </section>
      <LandingPrivacy/>

      <section className="faq section shell landingFaq" id="faq" aria-labelledby="faq-title">
        <div data-landing-reveal><span className="tag">PREGUNTAS FRECUENTES</span><h2 id="faq-title">Las dudas,<br/><em>sin vueltas.</em></h2><p>No necesitás ser experto en números. Empezá por lo importante y completá la información paso a paso.</p><a className="ghost" href="#producto">Volver a explorar el producto</a></div>
        <div className="questions">
          <details open><summary>¿Qué me muestra Rentia que no veo en las ventas?</summary><p>Vender no es lo mismo que ganar. Rentia reúne la facturación, el costo del producto, el envío, las comisiones, los impuestos configurados y la publicidad para mostrar qué queda después de los costos identificados.</p></details>
          <details><summary>¿Qué tiendas y plataformas puedo conectar hoy?</summary><p>Hoy podés conectar Tiendanube, Mercado Libre (ventas, cargos y Product Ads) y Meta Ads.</p></details>
          <details><summary>¿Las comisiones se cargan automáticamente?</summary><p>Importamos los cargos reales que Tiendanube informa para Pago Nube. Si el cargo todavía no llegó, o el medio de pago no lo informa, Rentia lo deja pendiente o usa el respaldo que configuraste. También podés completar costos manualmente. No se inventa un cargo real.</p></details>
          <details><summary>¿Qué pasa si me falta el costo de un producto?</summary><p>Rentia señala el dato pendiente. Podés cargarlo por producto o por SKU, el código que identifica cada producto o variante. Hasta completar los costos, interpretá la ganancia como provisoria y revisá la sección Calidad de datos.</p></details>
          <details><summary>Meta ya me muestra el ROAS. ¿Para qué compararlo?</summary><p>El ROAS compara ventas atribuidas con inversión publicitaria; no descuenta el costo de los productos ni otros gastos. Rentia separa lo que Meta se atribuye de la facturación completa de tu tienda. Ninguna de esas relaciones, por sí sola, equivale a ganancia.</p></details>
          <details><summary>¿Cómo se estima cuánto dura mi stock?</summary><p>Se compara el stock disponible con las ventas diarias promedio del período elegido. Por ejemplo, 12 unidades a un ritmo de 2 por día equivalen a unos 6 días. Es una estimación para planificar, no una garantía de demanda futura.</p></details>
          <details><summary>¿Necesito saber contabilidad para configurarlo?</summary><p>No. Conectá tu tienda, cargá el costo de tus productos y elegí cómo registrar envíos, comisiones e impuestos. Las ayudas (?) explican los términos dentro del panel. Rentia es una herramienta de análisis y no reemplaza el asesoramiento de tu contador.</p></details>
          <details><summary>¿Cómo se controla el acceso a mi información?</summary><p>El panel requiere autenticación. Rentia distingue propietarios, administradores y miembros para controlar las funciones de gestión. Los tokens de las integraciones se guardan cifrados. Los ejemplos públicos son ilustrativos y no muestran los datos de tu tienda.</p></details>
          <details><summary>¿Puedo probarlo antes de elegir un plan?</summary><p>Sí. Tenés 14 días de prueba sin tarjeta y un plan gratuito para empezar. Todos los planes importan hasta 12 meses de historial por canal, según los datos disponibles. El historial guardado se conserva y sigue creciendo. El selector te permite comparar órdenes mensuales, usuarios y soporte.</p></details>
        </div>
      </section>

      <section className="cta shell" id="cta" data-landing-reveal><span className="tag">14 DÍAS GRATIS</span><h2>Dejá de mirar ventas.<br/><em>Empezá a mirar ganancias.</em></h2><p>Conectá tu tienda y descubrí qué queda realmente en tu bolsillo.</p><a className="button" href="/registro">Crear mi cuenta</a></section>
      <footer className="shell"><a className="brand" href="#inicio"><span className="brandMark"><img src="/favicon.svg" alt=""/></span>Rentia</a><span>© 2026 Rentia. Hecho para el e-commerce latinoamericano.</span><div><a href="#privacidad">Acceso y privacidad</a><a href="#faq">Preguntas frecuentes</a></div></footer>
    </main>
  );
}
