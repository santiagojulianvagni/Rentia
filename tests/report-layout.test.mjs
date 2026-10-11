import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import postcss from 'postcss';

const css=postcss.parse(readFileSync(new URL('../app/panel/rp.css',import.meta.url),'utf8')+readFileSync(new URL('../app/panel/rp-extra.css',import.meta.url),'utf8'));
const markup=readFileSync(new URL('../components/report-details.tsx',import.meta.url),'utf8');
function declaration(selector,property){
  let value;
  css.walkRules(rule=>{
    if(rule.parent.type!=='root'||!rule.selectors.includes(selector))return;
    rule.walkDecls(property,decl=>{value=decl.value;});
  });
  return value;
}
test('wide tables shrink their grid ancestors and scroll locally',()=>{
  assert.equal(declaration('.p-root .p-grid>*','min-width'),'0');
  assert.equal(declaration('.p-root .p-tableWrap','overflow'),'auto');
  assert.equal((markup.match(/className="p-tableWrap" role="region"/g)||[]).length,2);
  assert.equal((markup.match(/tabIndex=\{0\}/g)||[]).length,2);
});
test('pagination has a horizontal, wrapping button group',()=>{
  assert.equal(declaration('.p-root .p-pager','display'),'flex');
  assert.equal(declaration('.p-root .p-pager','flex-wrap'),'wrap');
  assert.equal(declaration('.p-root .p-pager .p-pages','display'),'flex');
  assert.equal(declaration('.p-root .p-pager .p-pages','flex-wrap'),'wrap');
  assert.ok(markup.includes('className="p-pager"'));
  assert.ok(markup.includes('className="p-pages"'));
});
