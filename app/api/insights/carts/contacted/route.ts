import { z } from 'zod';
import { markCartContacted } from '../../../../../db/database';
import { HttpError, route } from '../../../../../server/http/route';

const Body=z.object({externalId:z.string().min(1).max(64),via:z.enum(['whatsapp','email','telefono','otro']).nullable()});

// Quien ve los contactos (propietario o administrador) marca el carrito como contactado, para
// que nadie del equipo le vuelva a escribir. Con via null se desmarca.
export const POST=route({access:'manager',origin:'same',body:Body,invalidBody:'invalid_data'},async({user,body})=>{
  if(!await markCartContacted(user.id,body.externalId,user.name||user.email||'Alguien del equipo',body.via)) throw new HttpError(404,'cart_not_found');
  return {ok:true};
});
