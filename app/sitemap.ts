import type { MetadataRoute } from 'next';
import { landingProducts } from '../lib/landing-products';
import { siteOrigin } from '../lib/site-origin';

const PAGES=['','/producto','/registro','/ingresar','/terminos','/privacidad','/baja'];

export default function sitemap():MetadataRoute.Sitemap {
  const origin=siteOrigin();
  return [...PAGES,...landingProducts.map(product=>`/producto/${product.slug}`)]
    .map(path=>({url:`${origin}${path}`,changeFrequency:path?'monthly':'weekly',priority:path?0.6:1}));
}
