import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {registerHooks} from 'node:module';
import {createTestDatabase} from './helpers/postgres.mjs';

// Registro completo de una cuenta nueva (por ejemplo con Google): la sesión queda pendiente
// hasta crear la tienda, y el onboarding la crea una sola vez aunque se repita el pedido.
globalThis.__clerk={userId:'user_new',orgId:null,created:[]};
const clerkStub=`
export async function auth(){return {userId:globalThis.__clerk.userId,orgId:globalThis.__clerk.orgId};}
export async function currentUser(){return {firstName:'Ana',lastName:'Pérez',primaryEmailAddressId:'e1',emailAddresses:[{id:'e1',emailAddress:'ana@example.invalid'}]};}
export async function clerkClient(){return {
  users:{getOrganizationMembershipList:async()=>({data:globalThis.__clerk.created.map(id=>({organization:{id}})),totalCount:globalThis.__clerk.created.length})},
  organizations:{createOrganization:async({name})=>{const id='org_'+(globalThis.__clerk.created.length+1);globalThis.__clerk.created.push(id);return {id,name};},deleteOrganization:async()=>undefined},
};}`;
registerHooks({resolve(specifier,context,next){
  if(specifier==='@clerk/nextjs/server')return {url:'data:text/javascript,'+encodeURIComponent(clerkStub),shortCircuit:true};
  if(specifier==='next/server')return next('next/server.js',context);
  try{return next(specifier,context);}catch(error){
    if(error.code==='ERR_MODULE_NOT_FOUND'&&specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return next(`${specifier}.ts`,context);
    throw error;
  }
}});
const {setDatabase}=await import('../db/client.ts');
const bootstrap=await import('../app/api/account/bootstrap/route.ts');
const post=body=>bootstrap.POST(new Request('https://rentia.example.invalid/api/account/bootstrap',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}));

test('a new account is asked for its store, then gets exactly one organization',async()=>{
  const {pg,driver}=await createTestDatabase();setDatabase(driver);
  globalThis.__clerk={userId:'user_new',orgId:null,created:[]};

  const first=await post({});
  assert.equal(first.status,409);
  assert.equal((await first.json()).error,'store_required');

  const created=await post({name:'Ana Pérez',store:'Casa Norte',phone:''});
  assert.equal(created.status,200);
  const body=await created.json();
  assert.equal(body.organizationId,'org_1');
  assert.equal(body.needsChannels,true);

  // Volver a entrar (otra pestaña, o recargar) abre la misma tienda: no crea otra.
  const again=await post({});
  assert.equal(again.status,200);
  assert.equal((await again.json()).organizationId,'org_1');
  assert.equal(globalThis.__clerk.created.length,1);
  assert.equal(Number((await pg.query('SELECT COUNT(*) AS n FROM accounts')).rows[0].n),1);
});

test('the sign-in setup sends pending sessions to onboarding and never shows an empty card',async()=>{
  const layout=await readFile(new URL('../app/layout.tsx',import.meta.url),'utf8');
  assert.match(layout,/taskUrls=\{\{'choose-organization':'\/onboarding'\}\}/);
  const redirect=await readFile(new URL('../components/signed-in-redirect.tsx',import.meta.url),'utf8');
  assert.match(redirect,/treatPendingAsSignedOut:false/);
  assert.match(redirect,/Continuar/);
  const onboarding=await readFile(new URL('../app/onboarding/page.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(onboarding,/router\.replace\('\/(registro|ingresar)'\)/,'onboarding must not bounce between pages');
});
