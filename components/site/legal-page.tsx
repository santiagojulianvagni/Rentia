import Link from 'next/link';
import type { ReactNode } from 'react';
import SiteHeader from './site-header';
import SiteFooter from './site-footer';

export type LegalSection={id:string;title:string;body:ReactNode};

// Página legal con el estilo del sitio: índice a la izquierda y secciones numeradas.
export default function LegalPage({eyebrow,title,intro,updated,sections,highlight}:{eyebrow:string;title:string;intro:ReactNode;updated:string;sections:LegalSection[];highlight?:ReactNode}) {
  return <main className="rl">
    <SiteHeader/>
    <section className="shell legalHero">
      <span className="tag">{eyebrow}</span>
      <h1>{title}</h1>
      <p className="lede">{intro}</p>
      <small>Última actualización: {updated}</small>
    </section>
    {highlight&&<section className="shell legalHighlight">{highlight}</section>}
    <section className="shell legalBody">
      <nav className="legalToc" aria-label="Contenido">{sections.map((section,index)=><a key={section.id} href={`#${section.id}`}><b>{String(index+1).padStart(2,'0')}</b>{section.title}</a>)}<hr/><Link href="/terminos">Términos y condiciones</Link><Link href="/privacidad">Política de privacidad</Link><Link href="/baja">Baja del servicio</Link></nav>
      <div className="legalText">{sections.map((section,index)=><article key={section.id} id={section.id}><h2><span>{String(index+1).padStart(2,'0')}</span>{section.title}</h2>{section.body}</article>)}</div>
    </section>
    <SiteFooter/>
  </main>;
}
