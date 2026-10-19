import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { GuideCta, GuideShell } from '../../components/site/guide-page';
import { comparisons, formatGuideDate, guides } from '../../lib/guides';
import { siteOrigin } from '../../lib/site-origin';
import '../landing-v2.css';

export const metadata:Metadata={
  title:'Blog — Rentia',
  description:'Guías para entender la ganancia real de tu e-commerce: costos, comisiones, publicidad, Mercado Libre y fechas especiales.',
  alternates:{canonical:`${siteOrigin()}/blog`},
};

export default function BlogPage() {
  return <GuideShell>
    <section className="shell legalHero">
      <span className="tag">Blog de Rentia</span>
      <h1>Guías para vender<br/>y también ganar.</h1>
      <p className="lede">Costos, comisiones, publicidad y fechas especiales, explicados con ejemplos y sin siglas de más.</p>
    </section>
    <section className="shell guideList">
      <div className="guideGrid">{guides.map(guide=><Link className="guideCard" href={`/blog/${guide.slug}`} key={guide.slug}>
        <small>{guide.tag} · {guide.minutes} min</small><b>{guide.title}</b><p>{guide.description}</p>
        <span>{formatGuideDate(guide.published)} <ArrowRight aria-hidden="true"/></span>
      </Link>)}</div>
    </section>
    <section className="shell guideList" id="comparaciones">
      <span className="tag">Comparaciones</span>
      <h2 className="guideListTitle">¿Rentia o lo que usás hoy?</h2>
      <div className="guideGrid">{comparisons.map(item=><Link className="guideCard" href={`/comparar/${item.slug}`} key={item.slug}>
        <small>COMPARACIÓN</small><b>{item.title}</b><p>{item.description}</p><span>Ver la comparación <ArrowRight aria-hidden="true"/></span>
      </Link>)}</div>
    </section>
    <section className="shell guideList"><GuideCta/></section>
  </GuideShell>;
}
