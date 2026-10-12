import { z } from 'zod';
import { createCostRule, deleteCostRule, getCostRules } from '../../../../db/database';
import { HttpError, route } from '../../../../server/http/route';
import { field } from '../../../../server/http/fields';

const optionalDate=field(value=>value?String(value):null);
const label=field(value=>String(value||'').trim().slice(0,80));

const RuleBody=z.object({
  category:z.unknown().optional(),
  name:label.pipe(z.string().min(1)),
  matchValue:label,
  calculation:field(value=>value==='percentage_revenue'?'percentage_revenue' as const:'fixed_monthly' as const),
  amount:field(value=>Number(value||0)).pipe(z.number().min(0)),
  percentage:field(value=>Number(value||0)).pipe(z.number().min(0).max(100)),
  startsAt:optionalDate,
  endsAt:optionalDate,
  // Día del mes en que se paga un gasto fijo (opcional).
  dueDay:field(value=>value===undefined||value===null||value===''?null:Number(value)).pipe(z.number().int().min(1).max(31).nullable()),
});

export const GET=route({},async({user})=>{
  const rules=await getCostRules(user.id);
  return {rules:rules.results};
});

export const POST=route({access:'manager',body:RuleBody,invalidBody:'invalid_rule'},async({user,body})=>{
  const {name,matchValue,calculation,amount,percentage,startsAt,endsAt,dueDay}=body;
  if (startsAt&&endsAt&&startsAt>endsAt) throw new HttpError(400,'invalid_dates');
  if (body.category==='commission') {
    if (!matchValue||(amount===0&&percentage===0)) throw new HttpError(400,'invalid_commission');
    await createCostRule(user.id,{category:'commission',name,matchValue,calculation:'hybrid',amount,percentage,startsAt:null,endsAt:null});
  } else if (body.category==='additional') {
    if ((calculation==='fixed_monthly'&&amount===0)||(calculation==='percentage_revenue'&&percentage===0)) throw new HttpError(400,'invalid_additional');
    await createCostRule(user.id,{category:'additional',name,matchValue:null,calculation,amount:calculation==='fixed_monthly'?amount:0,percentage:calculation==='percentage_revenue'?percentage:0,startsAt,endsAt,dueDay:calculation==='fixed_monthly'?dueDay:null});
  } else throw new HttpError(400,'invalid_category');
  return {ok:true};
});

export const DELETE=route({access:'manager',body:z.object({id:z.coerce.number().int().positive()}),invalidBody:'invalid_id'},async({user,body})=>{
  await deleteCostRule(user.id,body.id);
  return {ok:true};
});
