import { z } from 'zod';
import { adoptExternalRevenue, physicalStoreExists } from '../../../../../db/database';
import { HttpError, route } from '../../../../../server/http/route';

const AdoptBody=z.object({storeId:z.number().int().positive()});

// Pasa la facturación externa cargada antes (sin local) a un local nuevo, sin perder nada.
export const POST=route({access:'manager',origin:'same',body:AdoptBody,invalidBody:'invalid_store'},async({user,body})=>{
  if(!await physicalStoreExists(user.id,body.storeId)) throw new HttpError(404,'store_not_found');
  if(!await adoptExternalRevenue(user.id,body.storeId)) throw new HttpError(409,'store_has_sales');
  return {ok:true};
});
