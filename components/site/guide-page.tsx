import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import SiteHeader from './site-header';
import SiteFooter from './site-footer';
import { comparisons, guides, type GuideBlock, type GuideSection } from '../../lib/guides';

function Block({block}:{block:GuideBlock}) {
  if(typeof block==='string') return <p>{block}</p>;
  if('list' in block) return <ul>{block.list.map(item=><li key={item}>{item}</li>)}</ul>;
  if('formula' in block) return <div className="guideFormula"><code>{block.formula}</code>{block.note&&<small>{block.note}</small>}</div>;
  return <aside className="guideTip"><b>Tip</b><p>{block.tip}</p></aside>;
}

export function GuideSections({sections}:{sections:GuideSection[]}) {
  return <>{sections.map((section,index)=><article key={section.id} id={section.id}>
    <h2><span>{String(index+1).padStart(2,'0')}</span>{section.title}</h2>
    {section.blocks.map((block,blockIndex)=><Block key={blockIndex} block={block}/>)}
  </article>)}</>;
}

export function GuideCta({title='Mirá la ganancia real de tu tienda',text='Conectá Tiendanube, Mercado Libre y Meta Ads. 14 días gratis, sin tarjeta.'}:{title?:string;text?:string}) {
  return <aside className="guideCta">
    <div><b>{title}</b><p>{text}</p></div>
    <Link className="button" href="/registro?ref=blog">Crear mi cuenta gratis <ArrowRight aria-hidden="true"/></Link>
  </aside>;
}

// Más lecturas al pie: artículos y comparaciones, sin repetir la página actual.
export function GuideMore({current}:{current:string}) {
  const items=[
    ...guides.map(guide=>({href:`/blog/${guide.slug}`,tag:guide.tag,title:guide.title})),
    ...comparisons.map(item=>({href:`/comparar/${item.slug}`,tag:'COMPARACIÓN',title:item.title})),
  ].filter(item=>item.href!==current).slice(0,3);
  return <section className="shell guideMore">
    <span className="tag">Seguí leyendo</span>
    <div className="guideGrid">{items.map(item=><Link className="guideCard" href={item.href} key={item.href}><small>{item.tag}</small><b>{item.title}</b><span>Leer <ArrowRight aria-hidden="true"/></span></Link>)}</div>
  </section>;
}

export function GuideFaq({faqs}:{faqs:Array<[string,string]>}) {
  return <div className="guideFaq">{faqs.map(([question,answer])=><details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>;
}

export function GuideShell({children}:{children:ReactNode}) {
  return <main className="rl guidePage"><SiteHeader/>{children}<SiteFooter/></main>;
}

export function JsonLd({data}:{data:unknown}) {
  // El "<" escapado evita que un texto cierre la etiqueta script.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(data).replace(/</g,'\\u003c')}}/>;
}

export function CheckList({items}:{items:string[]}) {
  return <ul className="guideChecks">{items.map(item=><li key={item}><Check aria-hidden="true"/>{item}</li>)}</ul>;
}
