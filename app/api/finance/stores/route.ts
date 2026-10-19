import { z } from 'zod';
import { createPhysicalStore, deletePhysicalStore, externalRevenueCounts, listPhysicalStores, updatePhysicalStore } from '../../../../db/database';
import { HttpError, route } from '../../../../server/http/route';

const percent=z.number().min(0).max(100);
const StoreBody=z.object({name:z.string().trim().min(1).max(60),costPercent:percent,feePercent:percent,taxPercent:percent});
const UpdateBody=StoreBody.extend({id:z.number().int().positive()});
const DeleteBody=z.object({id:z.number().int().positive()});

export const GET=route({},async({user})=>{
  const [stores,counts]=await Promise.all([listPhysicalStores(user.id),externalRevenueCounts(user.id)]);
  return {stores,counts};
});

// Los locales son de toda la tienda: los administran propietarios y administradores.
export const POST=route({access:'manager',origin:'same',body:StoreBody,invalidBody:'invalid_store'},async({user,body})=>{
  if((await listPhysicalStores(user.id)).length>=20) throw new HttpError(409,'too_many_stores');
  const store=await createPhysicalStore(user.id,body);
  if(!store) throw new HttpError(409,'store_name_taken');
  return {store};
});

export const PATCH=route({access:'manager',origin:'same',body:UpdateBody,invalidBody:'invalid_store'},async({user,body})=>{
  const {id,...input}=body;
  try {
    const store=await updatePhysicalStore(user.id,id,input);
    if(!store) throw new HttpError(404,'store_not_found');
    return {store};
  } catch(error) {
    if(error instanceof HttpError) throw error;
    if(String((error as {code?:string})?.code)==='23505'||/unique|duplicate/i.test(String((error as Error)?.message))) throw new HttpError(409,'store_name_taken');
    throw error;
  }
});

export const DELETE=route({access:'manager',origin:'same',body:DeleteBody,invalidBody:'invalid_store'},async({user,body})=>{
  if(!await deletePhysicalStore(user.id,body.id)) throw new HttpError(404,'store_not_found');
  return {ok:true};
});
