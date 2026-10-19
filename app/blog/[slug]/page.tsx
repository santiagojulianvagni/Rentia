import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GuideCta, GuideMore, GuideSections, GuideShell, JsonLd } from '../../../components/site/guide-page';
import { findGuide, formatGuideDate, guides } from '../../../lib/guides';
import { siteOrigin } from '../../../lib/site-origin';
import '../../landing-v2.css';

type Params={params:Promise<{slug:string}>};
export const dynamicParams=false;
export function generateStaticParams() { return guides.map(guide=>({slug:guide.slug})); }

export async function generateMetadata({params}:Params):Promise<Metadata> {
  const guide=findGuide((await params).slug);
  if(!guide) notFound();
  const url=`${siteOrigin()}/blog/${guide.slug}`;
  return {title:`${guide.title} — Rentia`,description:guide.description,alternates:{canonical:url},openGraph:{type:'article',title:guide.title,description:guide.description,url,publishedTime:guide.published}};
}

export default async function GuidePage({params}:Params) {
  const guide=findGuide((await params).slug);
  if(!guide) notFound();
  const origin=siteOrigin();
  return <GuideShell>
    <JsonLd data={{'@context':'https://schema.org','@type':'Article',headline:guide.title,description:guide.description,datePublished:guide.published,inLanguage:'es-AR',author:{'@type':'Organization',name:'Rentia',url:origin},publisher:{'@type':'Organization',name:'Rentia',logo:{'@type':'ImageObject',url:`${origin}/favicon.svg`}},mainEntityOfPage:`${origin}/blog/${guide.slug}`}}/>
    <section className="shell legalHero">
      <Link className="guideBack" href="/blog">← Blog</Link>
      <span className="tag">{guide.tag}</span>
      <h1>{guide.title}</h1>
      <p className="lede">{guide.description}</p>
      <small>{formatGuideDate(guide.published)} · {guide.minutes} min de lectura</small>
    </section>
    <section className="shell legalBody">
      <nav className="legalToc" aria-label="Contenido">{guide.sections.map((section,index)=><a key={section.id} href={`#${section.id}`}><b>{String(index+1).padStart(2,'0')}</b>{section.title}</a>)}</nav>
      <div className="legalText"><GuideSections sections={guide.sections}/><GuideCta/></div>
    </section>
    <GuideMore current={`/blog/${guide.slug}`}/>
  </GuideShell>;
}
