import {env} from './env';

// The app's public https origin (RENTIA_PUBLIC_ORIGIN). OAuth redirect URIs and
// browser Origin checks on sensitive mutations compare against it.
// The error codes keep their original Mercado Libre names; callers match on them.
export function publicOrigin() {
  const configured=(env as unknown as {RENTIA_PUBLIC_ORIGIN?:string}).RENTIA_PUBLIC_ORIGIN;
  if(!configured) throw new Error('mercadolibre_origin_missing');
  const url=new URL(configured);
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/') throw new Error('mercadolibre_origin_invalid');
  return url.origin;
}
