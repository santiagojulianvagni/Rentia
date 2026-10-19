import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {LANGS,landingCopy} from '../lib/landing-i18n.ts';
import {comparisons,guides} from '../lib/guides.ts';
registerHooks({resolve(specifier,context,next){
  try{return next(specifier,context);}catch(error){
    if(error.code==='ERR_MODULE_NOT_FOUND'&&specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return next(`${specifier}.ts`,context);
    throw error;
  }
}});
const {RENTIA_PLANS}=await import('../lib/plans.ts');

// Recorre el diccionario y devuelve la forma: misma cantidad de elementos en cada lista y
// ningún texto vacío. Así una traducción incompleta no deja huecos en la portada.
function shape(value,path,out) {
  if(typeof value==='string'){assert.ok(value.trim(),`texto vacío en ${path}`);out.push(`${path}:s`);return out;}
  if(typeof value==='function'){out.push(`${path}:f`);return out;}
  if(Array.isArray(value)){out.push(`${path}:${value.length}`);value.forEach((item,index)=>shape(item,`${path}[${index}]`,out));return out;}
  for(const key of Object.keys(value).sort()) shape(value[key],`${path}.${key}`,out);
  return out;
}

test('English and Portuguese have the same texts as Spanish',()=>{
  const base=shape(landingCopy.es,'es',[]).map(item=>item.slice(2)).filter(item=>!item.startsWith('.hero.availability'));
  for(const lang of LANGS.filter(item=>item!=='es')) {
    const other=shape(landingCopy[lang],lang,[]).map(item=>item.slice(2)).filter(item=>!item.startsWith('.hero.availability'));
    assert.deepEqual(other,base,`faltan o sobran textos en ${lang}`);
  }
});

test('every plan has a description and support level in every language',()=>{
  for(const lang of LANGS) for(const plan of RENTIA_PLANS) {
    assert.ok(landingCopy[lang].calc.planDescriptions[plan.id],`${lang}: falta la descripción de ${plan.id}`);
    assert.ok(landingCopy[lang].calc.supportLevels[plan.support],`${lang}: falta el soporte ${plan.support}`);
  }
});

test('blog and comparison slugs are unique and every comparison row has three cells',()=>{
  const slugs=[...guides.map(item=>item.slug),...comparisons.map(item=>item.slug)];
  assert.equal(new Set(slugs).size,slugs.length);
  for(const item of comparisons) for(const row of item.rows) assert.equal(row.length,3);
  for(const guide of guides) assert.match(guide.published,/^\d{4}-\d{2}-\d{2}$/);
});
