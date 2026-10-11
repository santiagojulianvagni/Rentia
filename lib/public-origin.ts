import {env} from './env';

// The app's public https origin. OAuth redirect URIs and browser Origin checks
// on sensitive mutations compare against it. RENTIA_PUBLIC_ORIGIN wins (custom
// domain); otherwise Vercel's production domain, which Vercel sets on its own.
// The error codes keep their original Mercado Libre names; callers match on them.
export function publicOrigin() {
  const configured=env.RENTIA_PUBLIC_ORIGIN||(env.VERCEL_PROJECT_PRODUCTION_URL?`https://${env.VERCEL_PROJECT_PRODUCTION_URL}`:undefined);
  if(!configured) throw new Error('mercadolibre_origin_missing');
  const url=new URL(configured);
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/') throw new Error('mercadolibre_origin_invalid');
  return url.origin;
}
