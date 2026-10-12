import type { MetadataRoute } from 'next';
import { siteOrigin } from '../lib/site-origin';

// Los buscadores indexan solo el sitio público; el panel, las APIs y los pasos de cuenta quedan fuera.
export default function robots():MetadataRoute.Robots {
  return {rules:{userAgent:'*',allow:'/',disallow:['/panel','/api/','/onboarding','/invitacion']},sitemap:`${siteOrigin()}/sitemap.xml`};
}
