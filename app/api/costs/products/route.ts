import { z } from 'zod';
import { getProductCostRows, saveManualProductCosts } from '../../../../db/database';
import { route, validate } from '../../../../server/http/route';

const CostUpdate=z.object({
  variantId:z.coerce.number().int().positive(),
  manualCost:z.union([z.null(),z.coerce.number().min(0)]),
});

export const GET=route({},async({user})=>{
  const rows=await getProductCostRows(user.id);
  return {products:rows.results};
});

export const PUT=route({access:'manager',body:z.object({updates:z.array(z.unknown()).max(20000)}),invalidBody:'invalid_updates'},async({user,body})=>{
  const updates=validate(z.array(CostUpdate),body.updates,'invalid_cost');
  await saveManualProductCosts(user.id,updates);
  return {ok:true,updated:updates.length};
});
