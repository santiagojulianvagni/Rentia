import test from 'node:test';
import assert from 'node:assert/strict';
import {auditAd,auditSummary,buildName,buildTrackedUrl,metaUrlTags,nameMatches,utmParams,validNamingRule} from '../lib/utm.ts';

const rule={separator:'_',segments:['Objetivo','Producto','Público']};

test('the Meta URL parameters use dynamic names so duplicated ads stay correct',()=>{
  assert.equal(metaUrlTags(),'utm_source={{site_source_name}}&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}&utm_id={{campaign.id}}');
  assert.equal(metaUrlTags({source:'facebook',medium:'cpc',includeIds:false}),'utm_source=facebook&utm_medium=cpc&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}');
});

test('UTMs are read from both the URL parameters and the destination link',()=>{
  const params=utmParams('utm_campaign={{campaign.name}}&utm_content=Video%201','https://tienda.com/p?utm_source=facebook&utm_medium=paid#top');
  assert.equal(params.get('utm_source'),'facebook');
  assert.equal(params.get('utm_medium'),'paid');
  assert.equal(params.get('utm_content'),'Video 1');
});

test('the audit flags ads without UTMs, with missing ones, with a stale fixed campaign and with names off the rule',()=>{
  const base={id:'1',name:'Anuncio',adsetName:'Conjunto',link:'https://tienda.com'};
  assert.deepEqual(auditAd({...base,campaignName:'Ventas_Remeras_Frio',urlTags:''},rule).issues,['sin_utm']);
  assert.deepEqual(auditAd({...base,campaignName:'Ventas_Remeras_Frio',urlTags:'utm_source=fb'},rule).issues,['utm_incompleta']);
  assert.deepEqual(auditAd({...base,campaignName:'Ventas_Remeras_Frio',urlTags:'utm_source=fb&utm_medium=paid&utm_campaign=hot_sale_2025'},rule).issues,['utm_fija']);
  assert.deepEqual(auditAd({...base,campaignName:'Campaña nueva',urlTags:metaUrlTags()},rule).issues,['nombre_campana']);
  assert.deepEqual(auditAd({...base,campaignName:'Ventas_Remeras_Frio',urlTags:metaUrlTags()},rule).issues,[]);
  assert.deepEqual(auditAd({...base,link:'',campaignName:'Ventas_Remeras_Frio',urlTags:''},null).issues,['sin_link']);
  const summary=auditSummary([{issues:[]},{issues:['sin_utm']},{issues:['utm_incompleta','nombre_campana']}]);
  assert.deepEqual([summary.total,summary.withUtm,summary.withoutUtm,summary.incomplete,summary.badNames,summary.clean],[3,1,1,1,1,1]);
});

test('names follow the rule and tracked links are built safely',()=>{
  assert.ok(nameMatches('Ventas | Remeras | Frío',{separator:'|',segments:['A','B','C']}));
  assert.ok(!nameMatches('Ventas__Frio',rule));
  assert.equal(buildName(['Ventas','Remeras_lisas','Frío'],rule),'Ventas_Remeras lisas_Frío');
  assert.equal(buildName(['Ventas','Remeras'],{separator:'|',segments:['A','B']}),'Ventas | Remeras');
  assert.equal(buildTrackedUrl('mitienda.com.ar/productos',{utm_source:'instagram',utm_medium:'bio',utm_campaign:'Hot Sale'}),'https://mitienda.com.ar/productos?utm_source=instagram&utm_medium=bio&utm_campaign=hot_sale');
  assert.equal(buildTrackedUrl('no es un link',{}),null);
  assert.ok(validNamingRule(rule));
  assert.ok(!validNamingRule({separator:'#',segments:['A']}));
});
