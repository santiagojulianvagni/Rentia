import Link from 'next/link';
import { ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { productIcons, type ProductKind } from './product-icons';
import ProductScene, { sceneOrder } from './product-scenes';
import { landingCopy, type Lang } from '../../lib/landing-i18n';

const chapterKeys: Array<{ kind: ProductKind; slug: string }> = [
  { kind: 'profit', slug: 'ganancia-real' },
  { kind: 'products', slug: 'productos' },
  { kind: 'inventory', slug: 'inventario' },
  { kind: 'ads', slug: 'publicidad' },
];

// Scroll storytelling: chapters on the left, a sticky panel on the right that
// switches scene (SiteEffects). On small screens each chapter shows its scene inline.
// The product detail pages exist only in Spanish, so other languages skip those links.
export default function ProductTour({ withHeading = true, lang = 'es' }: { withHeading?: boolean; lang?: Lang }) {
  const t = landingCopy[lang].tour;
  return <section className="section" id="tour" style={{ paddingTop: 60 }}>
    <div className="shell">
      {withHeading && <div className="sectionHead center" data-reveal><span className="tag">{t.tag}</span><h2>{t.h2a}<br/><em>{t.h2b}</em></h2><p className="lede">{t.lede}</p></div>}
      <div className="tour">
        <div className="chapters">
          {chapterKeys.map(({ kind, slug }, index) => {
            const chapter = t.chapters[index];
            const Icon = productIcons[kind];
            return <article className={`chapter${index === 0 ? ' active' : ''}`} data-chapter={index} key={kind}>
              <span className="kicker"><i><Icon aria-hidden="true"/></i>{chapter.kicker}</span>
              <h3>{chapter.title[0]}<br/><em>{chapter.title[1]}</em></h3>
              <p>{chapter.body}</p>
              <ul className="benefits">{chapter.benefits.map(benefit => <li key={benefit}><Check aria-hidden="true"/>{benefit}</li>)}</ul>
              {index === 0 && <div className="insight"><ShieldCheck className="tick" aria-hidden="true" style={{ color: 'var(--cyan)' }}/><span>{t.insight}</span></div>}
              {chapter.note && <p className="note">{chapter.note}</p>}
              {lang === 'es' && <Link className="more" href={`/producto/${slug}`}>{chapter.link} <ArrowRight aria-hidden="true" style={{ width: 16, height: 16 }}/></Link>}
              <div className="tourScene" data-autoscene><ProductScene kind={kind} uid={`m${index}`} lang={lang}/></div>
            </article>;
          })}
        </div>
        <div className="stage" aria-hidden="true">
          <div className="stageInner" data-stage>
            <div className="stageBar"><i/><i/><i/><span>{t.example}</span><div className="stageTabs">{sceneOrder.map((kind, index) => <button type="button" tabIndex={-1} key={kind} className={index === 0 ? 'on' : undefined} data-go={index}>{t.tabs[index]}</button>)}</div></div>
            {sceneOrder.map((kind, index) => <ProductScene key={kind} kind={kind} uid={`s${index}`} index={index} on={index === 0} lang={lang}/>)}
          </div>
        </div>
      </div>
    </div>
  </section>;
}
