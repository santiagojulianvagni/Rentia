import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { findLandingProduct, landingProducts } from '../../lib/landing-products';
import { productIcons } from './product-icons';
import ProductScene, { sceneOrder } from './product-scenes';
import { landingCopy } from '../../lib/landing-i18n';
import SiteHeader from './site-header';
import SiteFooter from './site-footer';
import SiteEffects from './site-effects';
import Words from './words';

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;

export default function ProductDetail({ slug }: { slug: string }) {
  const product = findLandingProduct(slug);
  if (!product) return null;
  const Icon = productIcons[product.kind];
  return <main className="rl">
    <div id="progress"/>
    <SiteEffects/>
    <SiteHeader/>
    <div className="shell pdTop">
      <Link className="back" href="/producto"><ArrowRight aria-hidden="true"/>Volver al producto</Link>
      <nav className="pills" aria-label="Funciones de Rentia">{landingProducts.map(item => {
        const ItemIcon = productIcons[item.kind];
        return <Link key={item.slug} href={`/producto/${item.slug}`} aria-current={item.slug === slug ? 'page' : undefined}><ItemIcon aria-hidden="true"/>{item.short}</Link>;
      })}</nav>
    </div>

    <section className="hero pdHero" aria-labelledby="detail-title">
      <div className="heroBg" aria-hidden="true"><div className="aurora a1"/><div className="aurora a2"/><div className="grid"/><div className="spot"/></div>
      <div className="shell heroGrid">
        <div className="heroCopy">
          <span className="pill fadeUp"><span className="dot"/><Icon aria-hidden="true" style={{ width: 15, height: 15, color: 'var(--cyan)' }}/>{product.tag}</span>
          <h1 id="detail-title"><Words text={product.heading[0]}/><br/><em><Words text={product.heading[1]} from={product.heading[0].split(' ').length}/></em></h1>
          <p className="fadeUp" style={delay(650)}>{product.description}</p>
          <div className="heroActions fadeUp" style={delay(800)}><Link className="button" href="/registro" data-magnetic>Probar Rentia gratis <ArrowRight aria-hidden="true"/></Link><a className="ghost" href="#como-funciona">Cómo funciona <span>↓</span></a></div>
          <div className="trust fadeUp" style={delay(950)}>{['14 días gratis', 'Sin tarjeta'].map(item => <span key={item}><Check className="tick" aria-hidden="true"/>{item}</span>)}</div>
        </div>
        <div className="fadeUp" style={delay(350)}>
          <div className="sceneCard" data-autoscene data-tilt>
            <div className="stageInner"><div className="stageBar"><i/><i/><i/><span>{landingCopy.es.tour.tabs[sceneOrder.indexOf(product.kind)]} · ejemplo</span></div><ProductScene kind={product.kind} uid="hero"/></div>
          </div>
          <p className="sceneNote">Vista ilustrativa. No son resultados de una tienda real.</p>
        </div>
      </div>
    </section>

    <section className="shell pdBenefits" aria-label="Qué podés consultar">{product.benefits.map((benefit, index) => <div className="benefit" key={benefit} data-reveal style={delay(index * 120)}><i><Check aria-hidden="true"/></i><p>{benefit}</p></div>)}</section>

    <section className="section" id="como-funciona">
      <div className="shell">
        <div className="sectionHead center" data-reveal><span className="tag">Cómo funciona</span><h2>{product.stepsTitle}</h2></div>
        <div className="steps" data-steps>
          <div className="stepsLine"><i/></div>
          {product.steps.map(([title, body], index) => <article className="step" key={title} data-reveal style={delay(index * 150)}><div className="stepNum">{index + 1}<b>0{index + 1}</b></div><h3>{title}</h3><p>{body}</p></article>)}
        </div>
        <div className="pdInsight" data-reveal><ShieldCheck aria-hidden="true"/><p>{product.insight}</p></div>
      </div>
    </section>

    <section className="section" style={{ paddingTop: 20 }}>
      <div className="shell faqGrid">
        <div className="sticky" data-reveal><span className="tag">Preguntas frecuentes</span><h2>Lo importante,<br/><em>bien explicado.</em></h2><p className="lede">Algunas dudas sobre {product.short.toLocaleLowerCase('es-AR')}, antes de empezar.</p></div>
        <div data-reveal style={delay(120)}>{product.questions.map(([question, answer], index) => <div className={`qa${index === 0 ? ' open' : ''}`} key={question}>
          <button type="button" aria-expanded={index === 0}>{question}<i aria-hidden="true"/></button>
          <div className="ans"><div><p>{answer}</p></div></div>
        </div>)}</div>
      </div>
    </section>

    <section className="section" style={{ paddingTop: 20 }}>
      <div className="shell">
        <div className="sectionHead center" data-reveal><span className="tag">Todo está conectado</span><h2>Seguí explorando <em>Rentia.</em></h2></div>
        <div className="related">{landingProducts.filter(item => item.slug !== slug).map((item, index) => {
          const ItemIcon = productIcons[item.kind];
          return <Link className="relatedCard" href={`/producto/${item.slug}`} key={item.slug} data-reveal style={delay(index * 120)}><i><ItemIcon aria-hidden="true"/></i><b>{item.label}</b><p>{item.menuDescription}</p><span>Explorar función <ArrowRight aria-hidden="true"/></span></Link>;
        })}</div>
      </div>
    </section>

    <section className="shell cta" data-reveal>
      <span className="tag" style={{ position: 'relative' }}>Tu tienda, con más claridad</span>
      <h2>Conocé tus números.<br/><em>Decidí con contexto.</em></h2>
      <p>Conectá Tiendanube o Mercado Libre y sumá Meta Ads. Paso a paso.</p>
      <Link className="button" href="/registro" data-magnetic>Crear mi cuenta <ArrowRight aria-hidden="true"/></Link>
    </section>
    <SiteFooter/>
  </main>;
}
