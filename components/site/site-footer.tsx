import Link from 'next/link';
import { LANG_PATH, landingCopy, type Lang } from '../../lib/landing-i18n';

export default function SiteFooter({ lang = 'es' }: { lang?: Lang }) {
  const t = landingCopy[lang].footer;
  const home = lang === 'es' ? '/' : LANG_PATH[lang];
  return <footer>
    <div className="shell footIn">
      <Link className="brand" href={`${home}#inicio`} style={{ fontSize: 17 }}><img src="/favicon.svg" alt="" style={{ width: 24, height: 24 }}/>Rentia</Link>
      <span>{t.rights}</span>
      <nav aria-label="Pie de página"><Link href={lang === 'es' ? '/producto' : `${home}#tour`}>{t.product}</Link><Link href="/blog">{t.blog}</Link><Link href={`${home}#privacidad`}>{t.privacyAccess}</Link><Link href={`${home}#faq`}>{t.faq}</Link><Link href="/terminos">{t.terms}</Link><Link href="/privacidad">{t.privacy}</Link><Link href="/baja">{t.cancel}</Link></nav>
    </div>
    <div className="footLegal"><Link href="/arrepentimiento">Botón de arrepentimiento</Link><Link href="/baja">Botón de baja</Link><a href="https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario" target="_blank" rel="noopener noreferrer">Defensa de las y los consumidores. Para reclamos ingrese aquí</a></div>
  </footer>;
}
