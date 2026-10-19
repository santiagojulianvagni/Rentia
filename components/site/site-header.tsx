import Link from 'next/link';
import { ArrowRight, ChevronDown, Globe } from 'lucide-react';
import { landingProducts } from '../../lib/landing-products';
import { LANG_NAME, LANG_PATH, LANGS, landingCopy, type Lang } from '../../lib/landing-i18n';
import { productIcons } from './product-icons';

// The product menu links to pages that exist only in Spanish; the English and
// Portuguese home pages point to their own product tour instead.
export default function SiteHeader({ home = false, lang = 'es' }: { home?: boolean; lang?: Lang }) {
  const t = landingCopy[lang].nav;
  const anchor = lang !== 'es' || home ? '' : '/';
  return <header className="nav" id="nav">
    <div className="shell navIn">
      <Link className="brand" href={lang === 'es' ? `${anchor}#inicio` : `${LANG_PATH[lang]}#inicio`} aria-label={t.home}><img src="/favicon.svg" alt=""/>Rentia</Link>
      <nav className="navLinks" aria-label="Principal">
        {lang === 'es' ? <div className="menuWrap">
          <button className="menuBtn" type="button" aria-haspopup="true">{t.product} <ChevronDown aria-hidden="true"/></button>
          <div className="mega">
            <div className="megaIntro"><span>{t.explore}</span><small>{t.exploreSub}</small></div>
            <div className="megaGrid">{landingProducts.map(product => {
              const Icon = productIcons[product.kind];
              return <Link href={`/producto/${product.slug}`} key={product.slug}><i><Icon aria-hidden="true"/></i><span><b>{product.label}</b><small>{product.menuDescription}</small></span></Link>;
            })}</div>
            <Link className="megaAll" href="/producto"><span><b>{t.seeAll}</b><small>{t.seeAllSub}</small></span><ArrowRight aria-hidden="true"/></Link>
          </div>
        </div> : <a href="#tour">{t.product}</a>}
        <a href={`${anchor}#integraciones`}>{t.integrations}</a>
        <a href={`${anchor}#precios`}>{t.pricing}</a>
        <a href={`${anchor}#faq`}>{t.faq}</a>
        {lang === 'es' && <Link href="/blog">{t.blog}</Link>}
      </nav>
      <div className="navActions">
        <details className="langPick">
          <summary aria-label={`${t.language}: ${LANG_NAME[lang]}`}><Globe aria-hidden="true"/>{lang.toUpperCase()}</summary>
          <div className="langMenu">{LANGS.map(item => <a key={item} href={LANG_PATH[item]} hrefLang={item} lang={item} aria-current={item === lang ? 'true' : undefined}>{LANG_NAME[item]}</a>)}</div>
        </details>
        <Link className="login" href="/ingresar">{t.login}</Link><Link className="button small" href="/registro">{t.signup}</Link>
      </div>
    </div>
  </header>;
}
