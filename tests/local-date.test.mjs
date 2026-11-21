import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {createTestDatabase} from './helpers/postgres.mjs';

registerHooks({resolve(specifier,context,next){
  try{return next(specifier,context);}catch(error){
    if(error.code==='ERR_MODULE_NOT_FOUND'&&specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return next(`${specifier}.ts`,context);
    throw error;
  }
}});
const {argentinaDay,argentinaMonth,argentinaDayStart,ARGENTINA_DAY_SQL}=await import('../lib/local-date.ts');
const {setDatabase}=await import('../db/client.ts');
const database=await import('../db/database.ts');

// Una venta del viernes 20 a las 21:30 de Argentina llega de Tiendanube como sábado 00:30 UTC.
const FRIDAY_NIGHT='2026-11-21T00:30:00+0000';

test('sales are counted on the Argentine day, not the UTC one',()=>{
  assert.equal(argentinaDay(FRIDAY_NIGHT),'2026-11-20');
  assert.equal(argentinaDay('2026-11-21T03:00:00.000Z'),'2026-11-21');
  assert.equal(argentinaDay('2026-11-20'),'2026-11-20');
  assert.equal(argentinaMonth('2026-12-01T02:59:00Z'),'2026-11');
  assert.equal(argentinaDayStart('2026-11-20'),'2026-11-20T03:00:00.000Z');
});

test('the database groups sales by Argentine day and custom ranges start at Argentine midnight',async()=>{
  const {pg,driver}=await createTestDatabase();setDatabase(driver);
  const {rows}=await pg.query(`SELECT ${ARGENTINA_DAY_SQL("'2026-11-21T00:30:00+0000'::text")} AS a,${ARGENTINA_DAY_SQL("'2026-11-21T00:30:00.000Z'::text")} AS b,${ARGENTINA_DAY_SQL("'2026-11-20'::text")} AS c`);
  assert.deepEqual(rows[0],{a:'2026-11-20',b:'2026-11-20',c:'2026-11-20'});
  const window=database.analyticsWindow(1,0,{start:'2026-11-20',end:'2026-11-20'});
  assert.equal(window.since,'2026-11-20T03:00:00.000Z');
  assert.equal(window.until,'2026-11-21T03:00:00.000Z');
  assert.ok(FRIDAY_NIGHT>=window.since&&FRIDAY_NIGHT<window.until);
});
