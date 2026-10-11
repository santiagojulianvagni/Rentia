import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ArrowRight, Check, KeyRound, LockKeyhole, ShieldCheck, UsersRound } from 'lucide-react';
import SiteHeader from '../components/site/site-header';
import SiteFooter from '../components/site/site-footer';
import SiteEffects from '../components/site/site-effects';
import ProfitDemo from '../components/site/profit-demo';
import PricingCalculator from '../components/site/pricing-calculator';
import ProductTour from '../components/site/product-tour';
import Words from '../components/site/words';
import './landing-v2.css';

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;
const marquee: Array<[string, string, string]> = [
  ['/brands/tiendanube-icon.png', 'Tiendanube', 'ventas y productos'],
  ['/brands/mercado-libre-icon.png', 'Mercado Libre', 'ventas y cargos'],
  ['/brands/meta.png', 'Meta Ads', 'inversión y campañas'],
  ['/brands/mercado-libre-icon.png', 'Product Ads', 'publicidad en Mercado Libre'],
  ['/brands/tiendanube-icon.png', 'Pago Nube', 'comisiones reales'],
];
const terms: Array<[string, string, string, string, string]> = [
  ['ROAS', '3,00x', 'Ventas / inversión', 'Compara las ventas atribuidas a la publicidad con lo que invertiste. No es lo mismo que ganancia.', 'Invertís $10.000 y se atribuyen $30.000: ROAS 3x. Todavía faltan los costos.'],
  ['SKU', 'REM-NEG-M', 'Producto identificado', 'El código que identifica un producto o una variante, como un talle o un color.', 'REM-NEG-M: remera negra talle M. Une sus ventas, costo y stock.'],
  ['CPA', '$2.000', 'Inversión / compras', 'El costo promedio de cada compra atribuida a los anuncios.', 'Invertís $20.000 y se atribuyen 10 compras: CPA $2.000.'],
];
const faqs: Array<[string, string]> = [
  ['¿Qué me muestra Rentia que no veo en las ventas?', 'Vender no es lo mismo que ganar. Rentia reúne la facturación, el costo del producto, el envío, las comisiones, los impuestos configurados y la publicidad para mostrar qué queda después de los costos identificados.'],
  ['¿Qué tiendas y plataformas puedo conectar hoy?', 'Hoy podés conectar Tiendanube, Mercado Libre (ventas, cargos y Product Ads) y Meta Ads.'],
  ['¿Las comisiones se cargan automáticamente?', 'Importamos los cargos reales que Tiendanube informa para Pago Nube. Si el cargo todavía no llegó, o el medio de pago no lo informa, Rentia lo deja pendiente o usa el respaldo que configuraste. También podés completar costos manualmente. No se inventa un cargo real.'],
  ['¿Qué pasa si me falta el costo de un producto?', 'Rentia señala el dato pendiente. Podés cargarlo por producto o por SKU, el código que identifica cada producto o variante. Hasta completar los costos, interpretá la ganancia como provisoria y revisá la sección Calidad de datos.'],
  ['Meta ya me muestra el ROAS. ¿Para qué compararlo?', 'El ROAS compara ventas atribuidas con inversión publicitaria; no descuenta el costo de los productos ni otros gastos. Rentia separa lo que Meta se atribuye de la facturación completa de tu tienda. Ninguna de esas relaciones, por sí sola, equivale a ganancia.'],
  ['¿Cómo se estima cuánto dura mi stock?', 'Se compara el stock disponible con las ventas diarias promedio del período elegido. Por ejemplo, 12 unidades a un ritmo de 2 por día equivalen a unos 6 días. Es una estimación para planificar, no una garantía de demanda futura.'],
  ['¿Necesito saber contabilidad para configurarlo?', 'No. Conectá tu tienda, cargá el costo de tus productos y elegí cómo registrar envíos, comisiones e impuestos. Las ayudas (?) explican los términos dentro del panel. Rentia es una herramienta de análisis y no reemplaza el asesoramiento de tu contador.'],
  ['¿Cómo se controla el acceso a mi información?', 'El panel requiere autenticación. Rentia distingue propietarios, administradores y miembros para controlar las funciones de gestión. Los tokens de las integraciones se guardan cifrados. Los ejemplos públicos son ilustrativos y no muestran los datos de tu tienda.'],
  ['¿Puedo probarlo antes de elegir un plan?', 'Sí. Tenés 14 días de prueba sin tarjeta y un plan gratuito para empezar. Todos los planes importan hasta 12 meses de historial por canal, según los datos disponibles.'],
];
const floaters = ['+ $30.000', '30% margen', 'ROAS real', 'Costos al día', '✓ Pago Nube', 'Stock: 46 días', '+ 12,4%', 'Ganancia por SKU'];

export default function Home() {
  return <main className="rl">
    <div id="progress"/>
    <SiteEffects/>
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true"><defs>
      <linearGradient id="ringGrad" x1="0" x2="1"><stop offset="0" stopColor="#21d4c2"/><stop offset="1" stopColor="#32d583"/></linearGradient>
      <linearGradient id="lineGrad" x1="0" x2="1"><stop offset="0" stopColor="#3b8cff" stopOpacity=".2"/><stop offset="1" stopColor="#21d4c2"/></linearGradient>
    </defs></svg>
    <SiteHeader home/>

    <section className="hero" id="inicio">
      <div className="heroBg" aria-hidden="true"><div className="aurora a1"/><div className="aurora a2"/><div className="grid"/><div className="spot"/></div>
      <div className="shell heroGrid">
        <div className="heroCopy">
          <span className="pill fadeUp"><span className="dot"/>Rentabilidad real, sin planillas</span>
          <h1><Words text="Tu tienda vende."/><br/><em><Words text="Ahora sabé cuánto gana." from={3}/></em></h1>
          <p className="fadeUp" style={delay(700)}>Rentia conecta tus ventas, costos y publicidad para mostrarte la ganancia real de tu e-commerce, orden por orden.</p>
          <div className="heroActions fadeUp" style={delay(850)}><Link className="button" href="/registro" data-magnetic>Crear mi cuenta gratis <ArrowRight aria-hidden="true"/></Link><a className="ghost" href="#producto">Cómo funciona <span>↓</span></a></div>
          <div className="trust fadeUp" style={delay(1000)}>{['14 días gratis', 'Sin tarjeta', 'Configuración guiada'].map(item => <span key={item}><Check className="tick" aria-hidden="true"/>{item}</span>)}</div>
          <div className="connectsWith fadeUp" style={delay(1150)}><span>Se conecta con</span><div><img src="/brands/tiendanube-icon.png" alt="Tiendanube" title="Tiendanube"/><img src="/brands/mercado-libre-icon.png" alt="Mercado Libre" title="Mercado Libre"/><img src="/brands/meta.png" alt="Meta Ads" title="Meta Ads"/></div></div>
        </div>
        <div className="demoWrap fadeUp" style={delay(400)}>
          <div className="chip c1"><i>✓</i><span><b>Comisión real</b><br/>importada de Pago Nube</span></div>
          <div className="chip c2"><i>!</i><span><b>1 costo pendiente</b><br/>te avisamos qué falta</span></div>
          <ProfitDemo/>
        </div>
      </div>
    </section>

    <div className="marquee" aria-label="Plataformas e información que Rentia reúne">
      <div className="track">{[...marquee, ...marquee].map(([logo, name, detail], index) => <span key={index} aria-hidden={index >= marquee.length || undefined}><img src={logo} alt=""/>{name} <em>{detail}</em><i className="sep"/></span>)}</div>
    </div>

    <section className="section" id="producto">
      <div className="shell">
        <div className="sectionHead center" data-reveal><span className="tag">La venta es solo el principio</span><h2>De vender a entender<br/><em>qué ganás.</em></h2><p className="lede">El mismo pedido. Dos formas de mirarlo.</p></div>
        <div className="compare" data-reveal>
          <article className="card saleCard"><span className="question" aria-hidden="true">?</span><span className="label">SI SOLO MIRÁS LAS VENTAS</span><span className="bigAmount mono">$100.000</span><p>Entró un pedido. Pero todavía no sabés cuánto te queda.</p><div className="unknowns">{['Producto', 'Envío', 'Comisiones', 'Publicidad', 'Impuestos'].map((item, index) => <span key={item} style={{ '--i': index } as CSSProperties}>{item}</span>)}</div></article>
          <span className="arrow" aria-hidden="true"><ArrowRight/></span>
          <article className="card resultCard"><span className="label"><img src="/favicon.svg" alt=""/>CON LOS COSTOS IDENTIFICADOS</span><div className="resultTop"><div><small>Ganancia del ejemplo</small><strong className="mono" data-count="30000" data-prefix="$">$30.000</strong></div><span className="margin mono"><span data-count="30" data-suffix="%">30%</span><small>margen</small></span></div><div className="split"><i className="c"/><i className="g"/></div><div className="splitLabels"><span>$70.000 en costos</span><b>$30.000 de ganancia</b></div><p><Check className="tick" aria-hidden="true"/>Si un costo falta, Rentia lo señala como pendiente.</p></article>
        </div>
        <p className="footnote" data-reveal>Ejemplo ilustrativo en ARS: venta $100.000 − producto $35.000 − envío $5.000 − comisiones $7.000 − publicidad $18.000 − impuestos $5.000. No es una promesa de resultados.</p>
      </div>
    </section>

    <section className="section" id="integraciones" style={{ paddingTop: 40 }}>
      <div className="shell flow">
        <div className="flowCopy" data-reveal>
          <span className="tag">Menos pestañas. Más claridad.</span>
          <h2>Tu operación,<br/><em>en la misma cuenta.</em></h2>
          <p className="lede">Conectá tu tienda, tu marketplace y tu publicidad. Rentia reúne la información disponible y te muestra qué falta completar.</p>
          <ul className="flowList">{['Lecturas separadas por canal, sin duplicar ventas.', 'Conexiones de solo lectura: no cambiamos nada en tus cuentas.', 'Hasta 12 meses de historial al conectar.'].map(item => <li key={item}><Check className="tick" aria-hidden="true"/>{item}</li>)}</ul>
        </div>
        <div className="diagram" data-reveal style={delay(150)}>
          <svg className="lines" viewBox="0 0 600 440" preserveAspectRatio="none" aria-hidden="true">
            <path id="flow1" className="base" d="M252 58 C320 58 330 220 384 220"/>
            <path id="flow2" className="base" d="M252 210 C300 210 330 220 384 220"/>
            <path id="flow3" className="base" d="M252 362 C320 362 330 220 384 220"/>
            <path className="glow" d="M252 58 C320 58 330 220 384 220"/>
            <path className="glow" d="M252 210 C300 210 330 220 384 220" style={{ animationDelay: '-.5s' }}/>
            <path className="glow" d="M252 362 C320 362 330 220 384 220" style={{ animationDelay: '-1s' }}/>
            <circle r="4" fill="#21d4c2"><animateMotion dur="2.6s" repeatCount="indefinite"><mpath href="#flow1"/></animateMotion></circle>
            <circle r="4" fill="#21d4c2"><animateMotion dur="2.6s" begin="-0.9s" repeatCount="indefinite"><mpath href="#flow2"/></animateMotion></circle>
            <circle r="4" fill="#21d4c2"><animateMotion dur="2.6s" begin="-1.7s" repeatCount="indefinite"><mpath href="#flow3"/></animateMotion></circle>
          </svg>
          <div className="node n1"><img src="/brands/tiendanube-icon.png" alt=""/><span><b>Tiendanube</b><small>Ventas y productos</small></span></div>
          <div className="node n2"><img src="/brands/mercado-libre-icon.png" alt=""/><span><b>Mercado Libre</b><small>Ventas, cargos y Product Ads</small></span></div>
          <div className="node n3"><img src="/brands/meta.png" alt=""/><span><b>Meta Ads</b><small>Inversión y campañas</small></span></div>
          <div className="hub"><img src="/favicon.svg" alt=""/><b>Rentia</b><span>Ventas + costos<br/>+ publicidad</span><small>✓ Lecturas separadas,<br/>sin duplicar ventas</small></div>
        </div>
      </div>
    </section>

    <ProductTour/>

    <section className="section" style={{ paddingTop: 60 }}>
      <div className="shell glossary">
        <div className="terms" data-reveal>{terms.map(([term, value, label, meaning, example]) => <button className="term" type="button" key={term} aria-label={`${term}: ${meaning}`}>
          <div className="termIn"><div className="face"><small>{term}</small><strong className="mono">{value}</strong><span>{label}</span><span className="hint">Tocá para entender ↻</span></div><div className="face back"><small>{term}</small><p>{meaning}</p><span className="ex">{example}</span></div></div>
        </button>)}</div>
        <div className="glossaryCopy" data-reveal style={delay(150)}>
          <span className="tag">No necesitás hablar en siglas</span>
          <h2>Tus números,<br/><em>en tu idioma.</em></h2>
          <p className="lede">¿SKU, ROAS, CPA? No necesitás conocer todos los términos para entender tu tienda.</p>
          <p className="lede">Los (?) de Rentia te explican qué significan, para qué sirven y cómo interpretarlos, sin salir de lo que estás mirando.</p>
          <Link className="more" href="/producto/publicidad">Entendé mejor tu publicidad <ArrowRight aria-hidden="true" style={{ width: 16, height: 16 }}/></Link>
        </div>
      </div>
    </section>

    <section className="section" style={{ paddingTop: 60 }}>
      <div className="shell">
        <div className="sectionHead center" data-reveal><span className="tag">Empezá en minutos</span><h2>Conectás. Configurás.<br/><em>Rentia hace las cuentas.</em></h2></div>
        <div className="steps" data-steps>
          <div className="stepsLine"><i/></div>
          <article className="step" data-reveal><div className="stepNum">⌁<b>01</b></div><h3>Conectá tus canales</h3><p>Conectá Tiendanube o Mercado Libre y sumá Meta Ads para ver ventas y publicidad juntas.</p><div className="stepLogos"><img src="/brands/tiendanube-icon.png" alt="Tiendanube"/><img src="/brands/mercado-libre-icon.png" alt="Mercado Libre"/><img src="/brands/meta.png" alt="Meta Ads"/></div></article>
          <article className="step" data-reveal style={delay(150)}><div className="stepNum">≋<b>02</b></div><h3>Completá tus costos</h3><p>Importamos los datos disponibles. Completá el costo de tus productos, envíos e impuestos y revisá los pendientes.</p></article>
          <article className="step" data-reveal style={delay(300)}><div className="stepNum">✓<b>03</b></div><h3>Conocé tu ganancia</h3><p>Consultá las órdenes sincronizadas y compará períodos con todos tus números en el mismo lugar.</p></article>
        </div>
      </div>
    </section>

    <section className="section" id="precios" style={{ paddingTop: 60 }}>
      <div className="shell">
        <div className="sectionHead center" data-reveal><span className="tag">Planes simples</span><h2>Todo incluido.<br/><em>Pagás según tu volumen.</em></h2><p className="lede">14 días con acceso completo. Sin tarjeta y con un plan gratuito para empezar.</p></div>
        <PricingCalculator/>
      </div>
    </section>

    <section className="section" id="privacidad" style={{ paddingTop: 20 }}>
      <div className="shell">
        <div className="privacy" data-reveal>
          <div><div className="shield"><ShieldCheck aria-hidden="true"/></div><span className="tag">Acceso a tu información</span><h2>Tus números,<br/>dentro de tu cuenta.</h2><p className="lede" style={{ fontSize: 16 }}>El acceso al panel requiere una sesión. Las ayudas y ejemplos de esta web usan datos ilustrativos, no los números de nuestros usuarios.</p></div>
          <div className="facts">
            <div className="fact"><i><LockKeyhole aria-hidden="true"/></i><span><b>Panel con autenticación</b><small>Ingresás con tu cuenta.</small></span></div>
            <div className="fact"><i><UsersRound aria-hidden="true"/></i><span><b>Administración por roles</b><small>Propietarios y administradores gestionan la cuenta.</small></span></div>
            <div className="fact"><i><KeyRound aria-hidden="true"/></i><span><b>Credenciales de integración cifradas</b><small>Los tokens de conexión se guardan cifrados.</small></span></div>
          </div>
        </div>
      </div>
    </section>

    <section className="section" id="faq" style={{ paddingTop: 40 }}>
      <div className="shell faqGrid">
        <div className="sticky" data-reveal><span className="tag">Preguntas frecuentes</span><h2>Las dudas,<br/><em>sin vueltas.</em></h2><p className="lede">No necesitás ser experto en números. Empezá por lo importante y completá la información paso a paso.</p></div>
        <div data-reveal style={delay(120)}>{faqs.map(([question, answer], index) => <div className={`qa${index === 0 ? ' open' : ''}`} key={question}>
          <button type="button" aria-expanded={index === 0}>{question}<i aria-hidden="true"/></button>
          <div className="ans"><div><p>{answer}</p></div></div>
        </div>)}</div>
      </div>
    </section>

    <section className="shell cta" data-reveal>
      <div className="floaters" aria-hidden="true">{floaters.map((text, index) => <span key={text} style={{ left: `${6 + index * 11.5}%`, animationDuration: `${9 + (index % 3) * 2.5}s`, animationDelay: `${-index * 1.4}s` }}>{text}</span>)}</div>
      <span className="tag" style={{ position: 'relative' }}>14 días gratis</span>
      <h2>Dejá de mirar ventas.<br/><em>Empezá a mirar ganancias.</em></h2>
      <p>Conectá tu tienda y descubrí qué queda realmente en tu bolsillo.</p>
      <Link className="button" href="/registro" data-magnetic>Crear mi cuenta <ArrowRight aria-hidden="true"/></Link>
    </section>
    <SiteFooter/>
  </main>;
}
