import { z } from 'zod';
import { importStoreSales, physicalStoreExists } from '../../../../../db/database';
import { HttpError, route } from '../../../../../server/http/route';

const amount=z.number().finite().min(0).max(1e13);
const Day=z.object({date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),orders:z.number().int().min(0).max(1e7),revenue:amount,productCost:amount.nullable()});
// Hasta unos diez años de días: el archivo ya llega agrupado por día desde el navegador.
const ImportBody=z.object({storeId:z.number().int().positive(),days:z.array(Day).min(1).max(3700)});

export const POST=route({access:'manager',origin:'same',body:ImportBody,invalidBody:'invalid_import'},async({user,body})=>{
  if(!await physicalStoreExists(user.id,body.storeId)) throw new HttpError(404,'store_not_found');
  const dates=new Set(body.days.map(day=>day.date));
  if(dates.size!==body.days.length) throw new HttpError(400,'duplicate_days');
  if(body.days.some(day=>Number.isNaN(Date.parse(`${day.date}T00:00:00Z`)))) throw new HttpError(400,'invalid_import');
  await importStoreSales(user.id,body.storeId,body.days);
  return {ok:true,days:body.days.length};
});
