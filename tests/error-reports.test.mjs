import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {createTestDatabase} from './helpers/postgres.mjs';

// Los errores se guardan agrupados y el endpoint del navegador solo acepta el propio sitio.
registerHooks({resolve(specifier,context,next){
  if(/\/lib\/session$/.test(specifier))return {url:'data:text/javascript,export async function getRentiaUser(){return null;}export function canManageRentia(){return false;}',shortCircuit:true};
  try{return next(specifier,context);}catch(error){
    if(error.code==='ERR_MODULE_NOT_FOUND'&&specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return next(`${specifier}.ts`,context);
    throw error;
  }
}});
const {setDatabase}=await import('../db/client.ts');
const database=await import('../db/database.ts');
const endpoint=await import('../app/api/errors/route.ts');
const report=(origin,body)=>endpoint.POST(new Request('https://rentia.example.invalid/api/errors',{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(body)}));

test('repeated errors are grouped with a count',async()=>{
  const {pg,driver}=await createTestDatabase();setDatabase(driver);
  await database.recordError({source:'server',path:'/api/dashboard',message:'boom'});
  await database.recordError({source:'server',path:'/api/dashboard',message:'boom'});
  await database.recordError({source:'server',path:'/api/orders',message:'boom'});
  const rows=(await pg.query('SELECT path,count FROM error_reports ORDER BY path')).rows;
  assert.deepEqual(rows.map(row=>[row.path,Number(row.count)]),[['/api/dashboard',2],['/api/orders',1]]);
});

test('browser reports are accepted only from the site itself',async()=>{
  const {pg,driver}=await createTestDatabase();setDatabase(driver);
  assert.equal((await report('https://evil.example',{message:'x'})).status,403);
  assert.equal((await report('https://rentia.example.invalid',{message:''})).status,400);
  assert.equal((await report('https://rentia.example.invalid',{message:'TypeError: x is undefined',path:'/panel'})).status,204);
  const row=(await pg.query("SELECT source,path,message FROM error_reports")).rows[0];
  assert.deepEqual(row,{source:'client',path:'/panel',message:'TypeError: x is undefined'});
});
