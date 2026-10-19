import { z } from 'zod';
import { getNamingRule, saveNamingRule } from '../../../../db/database';
import { fetchActiveMetaAds } from '../../../../lib/meta';
import { auditAd, auditSummary, SEPARATORS } from '../../../../lib/utm';
import { HttpError, route } from '../../../../server/http/route';

const RuleBody=z.object({rule:z.object({separator:z.enum(SEPARATORS as [string,...string[]]),segments:z.array(z.string().trim().min(1).max(30)).min(1).max(8)}).nullable()});

// Revisa los anuncios activos de Meta: UTMs y nombre de campaña según la regla de la tienda.
export const GET=route({},async({user})=>{
  const rule=await getNamingRule(user.id);
  try {
    const {account,ads}=await fetchActiveMetaAds(user.id);
    const results=ads.map(ad=>({...ad,...auditAd(ad,rule)}));
    return {connected:true,account,rule,ads:results,summary:auditSummary(results)};
  } catch(error) {
    if(error instanceof Error&&error.message==='meta_not_connected') return {connected:false,account:null,rule,ads:[],summary:null};
    throw new HttpError(502,'meta_unavailable');
  }
});

export const PUT=route({access:'manager',origin:'same',body:RuleBody,invalidBody:'invalid_rule'},async({user,body})=>({rule:await saveNamingRule(user.id,body.rule)}));
