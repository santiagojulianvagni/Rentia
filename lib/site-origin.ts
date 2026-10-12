import { publicOrigin } from './public-origin';

// Origen público para robots y sitemap; durante el build local no rompe si falta la variable.
export function siteOrigin() {
  try { return publicOrigin(); } catch { return 'https://rentia-ruby.vercel.app'; }
}
