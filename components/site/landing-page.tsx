import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import { ArrowRight, Check, Info, KeyRound, LockKeyhole, ShieldCheck, UsersRound } from 'lucide-react';
import SiteHeader from './site-header';
import SiteFooter from './site-footer';
import SiteEffects from './site-effects';
import ProfitDemo from './profit-demo';
import PricingCalculator from './pricing-calculator';
import ProductTour from './product-tour';
import Words from './words';
import { LANG_HREFLANG, LANG_PATH, LANGS, landingCopy, type Lang } from '../../lib/landing-i18n';
import { siteOrigin } from '../../lib/site-origin';

const delay = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;
const marqueeLogos = ['/brands/tiendanube-icon.png', '/brands/mercado-libre-icon.png', '/brands/meta.png', '/brands/mercado-libre-icon.png', '/brands/tiendanube-icon.png'];

// Metadata with hreflang so Google relates the three versions of the home page.
export function landingMetadata(lang: Lang): Metadata {
  const origin = siteOrigin();
  const url = (item: Lang) => `${origin}${item === 'es' ? '' : LANG_PATH[item]}`;
  const { title, description } = landingCopy[lang].meta;
  return {
    title, description,
    alternates: { canonical: url(lang), languages: { ...Object.fromEntries(LANGS.map(item => [LANG_HREFLANG[item], url(item)])), 'x-default': url('es') } },
    openGraph: { title, description, url: url(lang), locale: LANG_HREFLANG[lang].replace('-', '_'), images: [{ url: '/og-rentia.png', width: 1800, height: 945, alt: title }] },
    twitter: { card: 'summary_large_image', title, description, images: ['/og-rentia.png'] },
  };
}

export default function LandingPage({ lang }: { lang: Lang }) {
  const t = landingCopy[lang];
  const ml = lang === 'pt' ? 'Mercado Livre' : 'Mercado Libre';
  const tn = lang === 'pt' ? 'Tiendanube (Nuvemshop)' : 'Tiendanube';
  const marqueeNames = ['Tiendanube', ml, 'Meta Ads', 'Product Ads', 'Pago Nube'];
  const marquee = marqueeLogos.map((logo, index) => [logo, marqueeNames[index], t.marquee.details[index]]);
  return <main className="rl" lang={lang}>
    <div id="progress"/>
    <SiteEffects/>
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true"><defs>
      <linearGradient id="ringGrad" x1="0" x2="1"><stop offset="0" stopColor="#21d4c2"/><stop offset="1" stopColor="#32d583"/></linearGradient>
      <linearGradient id="lineGrad" x1="0" x2="1"><stop offset="0" stopColor="#3b8cff" stopOpacity=".2"/><stop offset="1" stopColor="#21d4c2"/></linearGradient>
    </defs></svg>
    <SiteHeader home lang={lang}/>

    <section className="hero" id="inicio">
      <div className="heroBg" aria-hidden="true"><div className="aurora a1"/><div className="aurora a2"/><div className="grid"/><div className="spot"/></div>
      <div className="shell heroGrid">
        <div className="heroCopy">
          <span className="pill fadeUp"><span className="dot"/>{t.hero.pill}</span>
          <h1><Words text={t.hero.h1a}/><br/><em><Words text={t.hero.h1b} from={t.hero.h1a.split(' ').length}/></em></h1>
          <p className="fadeUp" style={delay(700)}>{t.hero.text}</p>
          <div className="heroActions fadeUp" style={delay(850)}><Link className="button" href="/registro" data-magnetic>{t.hero.cta} <ArrowRight aria-hidden="true"/></Link><a className="ghost" href="#producto">{t.hero.how} <span>↓</span></a></div>
          <div className="trust fadeUp" style={delay(1000)}>{t.hero.trust.map(item => <span key={item}><Check className="tick" aria-hidden="true"/>{item}</span>)}</div>
          <div className="connectsWith fadeUp" style={delay(1150)}><span>{t.hero.connects}</span><div><img src="/brands/tiendanube-icon.png" alt={tn} title={tn}/><img src="/brands/mercado-libre-icon.png" alt={ml} title={ml}/><img src="/brands/meta.png" alt="Meta Ads" title="Meta Ads"/></div></div>
          {t.hero.availability && <p className="availability fadeUp" style={delay(1250)}><Info aria-hidden="true" style={{ flex: '0 0 16px', width: 16, height: 16, marginTop: 2 }}/>{t.hero.availability}</p>}
        </div>
        <div className="demoWrap fadeUp" style={delay(400)}>
          <div className="chip c1"><i>✓</i><span><b>{t.hero.chip1[0]}</b><br/>{t.hero.chip1[1]}</span></div>
          <div className="chip c2"><i>!</i><span><b>{t.hero.chip2[0]}</b><br/>{t.hero.chip2[1]}</span></div>
          <ProfitDemo lang={lang}/>
        </div>
      </div>
    </section>

    <div className="marquee" aria-label={t.marquee.label}>
      <div className="track">{[...marquee, ...marquee].map(([logo, name, detail], index) => <span key={index} aria-hidden={index >= marquee.length || undefined}><img src={logo} alt=""/>{name} <em>{detail}</em><i className="sep"/></span>)}</div>
    </div>

    <section className="section" id="producto">
      <div className="shell">
        <div className="sectionHead center" data-reveal><span className="tag">{t.compare.tag}</span><h2>{t.compare.h2a}<br/><em>{t.compare.h2b}</em></h2><p className="lede">{t.compare.lede}</p></div>
        <div className="compare" data-reveal>
          <article className="card saleCard"><span className="question" aria-hidden="true">?</span><span className="label">{t.compare.saleLabel}</span><span className="bigAmount mono">{lang === 'en' ? '$100,000' : '$100.000'}</span><p>{t.compare.saleText}</p><div className="unknowns">{t.compare.unknowns.map((item, index) => <span key={item} style={{ '--i': index } as CSSProperties}>{item}</span>)}</div></article>
          <span className="arrow" aria-hidden="true"><ArrowRight/></span>
          <article className="card resultCard"><span className="label"><img src="/favicon.svg" alt=""/>{t.compare.resultLabel}</span><div className="resultTop"><div><small>{t.compare.resultSmall}</small><strong className="mono" data-count="30000" data-prefix="$">{lang === 'en' ? '$30,000' : '$30.000'}</strong></div><span className="margin mono"><span data-count="30" data-suffix="%">30%</span><small>{t.compare.margin}</small></span></div><div className="split"><i className="c"/><i className="g"/></div><div className="splitLabels"><span>{t.compare.costs}</span><b>{t.compare.profit}</b></div><p><Check className="tick" aria-hidden="true"/>{t.compare.pending}</p></article>
        </div>
        <p className="footnote" data-reveal>{t.compare.footnote}</p>
      </div>
    </section>

    <section className="section" id="integraciones" style={{ paddingTop: 40 }}>
      <div className="shell flow">
        <div className="flowCopy" data-reveal>
          <span className="tag">{t.flow.tag}</span>
          <h2>{t.flow.h2a}<br/><em>{t.flow.h2b}</em></h2>
          <p className="lede">{t.flow.lede}</p>
          <ul className="flowList">{t.flow.list.map(item => <li key={item}><Check className="tick" aria-hidden="true"/>{item}</li>)}</ul>
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
          <div className="node n1"><img src="/brands/tiendanube-icon.png" alt=""/><span><b>Tiendanube</b><small>{t.flow.nodes[0]}</small></span></div>
          <div className="node n2"><img src="/brands/mercado-libre-icon.png" alt=""/><span><b>{ml}</b><small>{t.flow.nodes[1]}</small></span></div>
          <div className="node n3"><img src="/brands/meta.png" alt=""/><span><b>Meta Ads</b><small>{t.flow.nodes[2]}</small></span></div>
          <div className="hub"><img src="/favicon.svg" alt=""/><b>Rentia</b><span>{t.flow.hub[0]}<br/>{t.flow.hub[1]}</span><small>{t.flow.hubNote[0]}<br/>{t.flow.hubNote[1]}</small></div>
        </div>
      </div>
    </section>

    <ProductTour lang={lang}/>

    <section className="section" style={{ paddingTop: 60 }}>
      <div className="shell glossary">
        <div className="terms" data-reveal>{t.glossary.terms.map(([term, value, label, meaning, example]) => <button className="term" type="button" key={term} aria-label={`${term}: ${meaning}`}>
          <div className="termIn"><div className="face"><small>{term}</small><strong className="mono">{value}</strong><span>{label}</span><span className="hint">{t.glossary.hint}</span></div><div className="face back"><small>{term}</small><p>{meaning}</p><span className="ex">{example}</span></div></div>
        </button>)}</div>
        <div className="glossaryCopy" data-reveal style={delay(150)}>
          <span className="tag">{t.glossary.tag}</span>
          <h2>{t.glossary.h2a}<br/><em>{t.glossary.h2b}</em></h2>
          <p className="lede">{t.glossary.lede1}</p>
          <p className="lede">{t.glossary.lede2}</p>
          {lang === 'es' && <Link className="more" href="/producto/publicidad">{t.glossary.more} <ArrowRight aria-hidden="true" style={{ width: 16, height: 16 }}/></Link>}
        </div>
      </div>
    </section>

    <section className="section" style={{ paddingTop: 60 }}>
      <div className="shell">
        <div className="sectionHead center" data-reveal><span className="tag">{t.steps.tag}</span><h2>{t.steps.h2a}<br/><em>{t.steps.h2b}</em></h2></div>
        <div className="steps" data-steps>
          <div className="stepsLine"><i/></div>
          <article className="step" data-reveal><div className="stepNum">⌁<b>01</b></div><h3>{t.steps.items[0][0]}</h3><p>{t.steps.items[0][1]}</p><div className="stepLogos"><img src="/brands/tiendanube-icon.png" alt={tn}/><img src="/brands/mercado-libre-icon.png" alt={ml}/><img src="/brands/meta.png" alt="Meta Ads"/></div></article>
          <article className="step" data-reveal style={delay(150)}><div className="stepNum">≋<b>02</b></div><h3>{t.steps.items[1][0]}</h3><p>{t.steps.items[1][1]}</p></article>
          <article className="step" data-reveal style={delay(300)}><div className="stepNum">✓<b>03</b></div><h3>{t.steps.items[2][0]}</h3><p>{t.steps.items[2][1]}</p></article>
        </div>
      </div>
    </section>

    <section className="section" id="precios" style={{ paddingTop: 60 }}>
      <div className="shell">
        <div className="sectionHead center" data-reveal><span className="tag">{t.pricing.tag}</span><h2>{t.pricing.h2a}<br/><em>{t.pricing.h2b}</em></h2><p className="lede">{t.pricing.lede}</p></div>
        <PricingCalculator lang={lang}/>
      </div>
    </section>

    <section className="section" id="privacidad" style={{ paddingTop: 20 }}>
      <div className="shell">
        <div className="privacy" data-reveal>
          <div><div className="shield"><ShieldCheck aria-hidden="true"/></div><span className="tag">{t.privacy.tag}</span><h2>{t.privacy.h2a}<br/>{t.privacy.h2b}</h2><p className="lede" style={{ fontSize: 16 }}>{t.privacy.lede}</p></div>
          <div className="facts">
            {[LockKeyhole, UsersRound, KeyRound].map((Icon, index) => <div className="fact" key={index}><i><Icon aria-hidden="true"/></i><span><b>{t.privacy.facts[index][0]}</b><small>{t.privacy.facts[index][1]}</small></span></div>)}
          </div>
        </div>
      </div>
    </section>

    <section className="section" id="faq" style={{ paddingTop: 40 }}>
      <div className="shell faqGrid">
        <div className="sticky" data-reveal><span className="tag">{t.faq.tag}</span><h2>{t.faq.h2a}<br/><em>{t.faq.h2b}</em></h2><p className="lede">{t.faq.lede}</p></div>
        <div data-reveal style={delay(120)}>{t.faq.items.map(([question, answer], index) => <div className={`qa${index === 0 ? ' open' : ''}`} key={question}>
          <button type="button" aria-expanded={index === 0}>{question}<i aria-hidden="true"/></button>
          <div className="ans"><div><p>{answer}</p></div></div>
        </div>)}</div>
      </div>
    </section>

    <section className="shell cta" data-reveal>
      <div className="floaters" aria-hidden="true">{t.cta.floaters.map((text, index) => <span key={text} style={{ left: `${6 + index * 11.5}%`, animationDuration: `${9 + (index % 3) * 2.5}s`, animationDelay: `${-index * 1.4}s` }}>{text}</span>)}</div>
      <span className="tag" style={{ position: 'relative' }}>{t.cta.tag}</span>
      <h2>{t.cta.h2a}<br/><em>{t.cta.h2b}</em></h2>
      <p>{t.cta.text}</p>
      <Link className="button" href="/registro" data-magnetic>{t.cta.button} <ArrowRight aria-hidden="true"/></Link>
    </section>
    <SiteFooter lang={lang}/>
  </main>;
}
