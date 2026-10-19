import type { MetadataRoute } from 'next';
import { landingProducts } from '../lib/landing-products';
import { siteOrigin } from '../lib/site-origin';
import { comparisons, guides } from '../lib/guides';

const PAGES=['','/producto','/blog','/registro','/ingresar','/terminos','/privacidad','/baja'];

export default function sitemap():MetadataRoute.Sitemap {
  const origin=siteOrigin();
  return [...PAGES,...landingProducts.map(product=>`/producto/${product.slug}`),...guides.map(guide=>`/blog/${guide.slug}`),...comparisons.map(item=>`/comparar/${item.slug}`)]
    .map(path=>({url:`${origin}${path}`,changeFrequency:path?'monthly':'weekly',priority:path?0.6:1}));
}
