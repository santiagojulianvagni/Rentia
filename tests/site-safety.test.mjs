import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {registerHooks} from 'node:module';

// Protecciones básicas del sitio que no deben perderse con un cambio futuro.
registerHooks({resolve(specifier,context,next){
  try{return next(specifier,context);}catch(error){
    if(error.code==='ERR_MODULE_NOT_FOUND'&&specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return next(`${specifier}.ts`,context);
    throw error;
  }
}});

test('every page sends the security headers',async()=>{
  const config=(await import('../next.config.ts')).default;
  const [rule]=await config.headers();
  assert.equal(rule.source,'/:path*');
  const headers=Object.fromEntries(rule.headers.map(header=>[header.key,header.value]));
  assert.equal(headers['X-Frame-Options'],'DENY');
  assert.match(headers['Content-Security-Policy'],/frame-ancestors 'none'/);
  assert.equal(headers['X-Content-Type-Options'],'nosniff');
});

test('search engines index the public site but never the panel or the API',async()=>{
  const robots=(await import('../app/robots.ts')).default();
  for(const path of ['/panel','/api/','/onboarding'])assert.ok(robots.rules.disallow.includes(path),path);
  const sitemap=(await import('../app/sitemap.ts')).default().map(entry=>new URL(entry.url).pathname);
  assert.ok(sitemap.includes('/terminos')&&sitemap.includes('/privacidad')&&sitemap.includes('/baja'));
  assert.ok(!sitemap.some(path=>path.startsWith('/panel')));
});

test('no third-party trackers, external fonts or session recording on the site',async()=>{
  const layout=await readFile(new URL('../app/layout.tsx',import.meta.url),'utf8');
  assert.match(layout,/next\/font\/google/,'fonts are self-hosted by next/font');
  assert.doesNotMatch(layout,/fonts\.googleapis|googletagmanager|gtag\(|hotjar|clarity\.ms|replay/i);
});
