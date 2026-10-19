import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckList, GuideCta, GuideFaq, GuideMore, GuideSections, GuideShell, JsonLd } from '../../../components/site/guide-page';
import { comparisons, findComparison } from '../../../lib/guides';
import { siteOrigin } from '../../../lib/site-origin';
import '../../landing-v2.css';

type Params={params:Promise<{slug:string}>};
export const dynamicParams=false;
export function generateStaticParams() { return comparisons.map(item=>({slug:item.slug})); }

export async function generateMetadata({params}:Params):Promise<Metadata> {
  const item=findComparison((await params).slug);
  if(!item) notFound();
  const url=`${siteOrigin()}/comparar/${item.slug}`;
  return {title:`${item.title} — Rentia`,description:item.description,alternates:{canonical:url},openGraph:{title:item.title,description:item.description,url}};
}

export default async function ComparisonPage({params}:Params) {
  const item=findComparison((await params).slug);
  if(!item) notFound();
  return <GuideShell>
    {item.faqs.length>0&&<JsonLd data={{'@context':'https://schema.org','@type':'FAQPage',mainEntity:item.faqs.map(([question,answer])=>({'@type':'Question',name:question,acceptedAnswer:{'@type':'Answer',text:answer}}))}}/>}
    <section className="shell legalHero">
      <Link className="guideBack" href="/blog#comparaciones">← Comparaciones</Link>
      <span className="tag">Comparación</span>
      <h1>{item.title}</h1>
      <p className="lede">{item.intro}</p>
    </section>
    <section className="shell">
      <div className="compareTable" role="table" aria-label={item.title}>
        <div className="compareRow compareHead" role="row"><span role="columnheader">Qué necesitás</span><span role="columnheader">{item.otherName}</span><span role="columnheader" className="compareRentia"><img src="/favicon.svg" alt=""/>Rentia</span></div>
        {item.rows.map(([need,other,rentia])=><div className="compareRow" role="row" key={need}>
          <b role="rowheader">{need}</b><span role="cell" data-label={item.otherName}>{other}</span><span role="cell" className="compareRentia" data-label="Rentia">{rentia}</span>
        </div>)}
      </div>
    </section>
    <section className="shell compareChoose">
      <div><h2>{item.chooseOtherTitle}</h2><CheckList items={item.chooseOther}/></div>
      <div className="compareChooseRentia"><h2>Te conviene Rentia si…</h2><CheckList items={item.chooseRentia}/></div>
    </section>
    <section className="shell legalBody compareBody">
      <div className="legalText">
        <GuideSections sections={item.sections}/>
        {item.faqs.length>0&&<article id="preguntas"><h2><span>{String(item.sections.length+1).padStart(2,'0')}</span>Preguntas frecuentes</h2><GuideFaq faqs={item.faqs}/></article>}
        <GuideCta/>
      </div>
    </section>
    <GuideMore current={`/comparar/${item.slug}`}/>
  </GuideShell>;
}
