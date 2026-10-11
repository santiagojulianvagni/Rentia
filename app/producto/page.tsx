import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import SiteHeader from '../../components/site/site-header';
import SiteFooter from '../../components/site/site-footer';
import SiteEffects from '../../components/site/site-effects';
import ProductTour from '../../components/site/product-tour';
import Words from '../../components/site/words';
import { landingProducts } from '../../lib/landing-products';
import { productIcons } from '../../components/site/product-icons';
import '../landing-v2.css';

export const metadata: Metadata = { title: 'Producto — Rentia', description: 'Explorá ganancia y costos, productos, inventario y publicidad de tu tienda en Rentia.' };
const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;

export default function ProductOverviewPage() {
  return <main className="rl">
    <div id="progress"/>
    <SiteEffects/>
    <SiteHeader/>
    <section className="hero heroCenter">
      <div className="heroBg" aria-hidden="true"><div className="aurora a1"/><div className="aurora a2"/><div className="grid"/><div className="spot"/></div>
      <div className="shell heroCopy" style={{ position: 'relative', zIndex: 1 }}>
        <span className="pill fadeUp"><span className="dot"/>El producto</span>
        <h1><Words text="Una operación."/><br/><em><Words text="Tus números conectados." from={2}/></em></h1>
        <p className="fadeUp" style={delay(600)}>Explorá qué podés consultar en Rentia y cómo cada parte te ayuda a entender tu tienda.</p>
        <div className="heroActions fadeUp" style={delay(750)}><Link className="button" href="/registro" data-magnetic>Probar Rentia gratis <ArrowRight aria-hidden="true"/></Link><a className="ghost" href="#tour">Recorrer el producto <span>↓</span></a></div>
        <div className="trust fadeUp" style={delay(900)}>{['14 días gratis', 'Sin tarjeta', 'Configuración guiada'].map(item => <span key={item}><Check className="tick" aria-hidden="true"/>{item}</span>)}</div>
      </div>
    </section>
    <section className="shell related four" style={{ marginTop: -10 }}>{landingProducts.map((item, index) => {
      const Icon = productIcons[item.kind];
      return <Link className="relatedCard" href={`/producto/${item.slug}`} key={item.slug} data-reveal style={delay(index * 100)}><i><Icon aria-hidden="true"/></i><b>{item.label}</b><p>{item.menuDescription}</p><span>Ver en detalle <ArrowRight aria-hidden="true"/></span></Link>;
    })}</section>
    <ProductTour withHeading/>
    <section className="shell cta" data-reveal>
      <span className="tag" style={{ position: 'relative' }}>14 días gratis</span>
      <h2>Empezá por conocer<br/><em>qué te queda.</em></h2>
      <p>14 días de prueba, sin tarjeta.</p>
      <Link className="button" href="/registro" data-magnetic>Crear mi cuenta <ArrowRight aria-hidden="true"/></Link>
    </section>
    <SiteFooter/>
  </main>;
}
