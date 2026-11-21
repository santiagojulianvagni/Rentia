import { z } from 'zod';
import { getMonthlyGoal, setMonthlyGoal } from '../../../../db/database';
import { argentinaMonth } from '../../../../lib/local-date';
import { route } from '../../../../server/http/route';

// Meta de facturación del mes en curso. Sin meta propia, el panel usa el punto de equilibrio.
const Body=z.object({amount:z.number().positive().max(1e13).nullable()});

export const GET=route({},async({user})=>{
  const month=argentinaMonth(new Date().toISOString());
  return {month,amount:await getMonthlyGoal(user.id,month)};
});

export const POST=route({access:'manager',body:Body,invalidBody:'invalid_data'},async({user,body})=>{
  const month=argentinaMonth(new Date().toISOString());
  await setMonthlyGoal(user.id,month,body.amount===null?null:Math.round(body.amount));
  return {month,amount:body.amount===null?null:Math.round(body.amount)};
});
