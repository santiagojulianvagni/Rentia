import { z } from 'zod';
import { createSalesEvent, deleteSalesEvent, listSalesEvents } from '../../../db/database';
import { HttpError, route } from '../../../server/http/route';
import { validEventDates } from '../../../lib/sales-events';

const EventBody=z.object({name:z.string().trim().min(1).max(80),start:z.string(),end:z.string()});
const DeleteBody=z.object({id:z.number().int().positive()});

export const GET=route({},async({user})=>({events:await listSalesEvents(user.id)}));

// Los eventos son de toda la tienda: los crean y borran propietarios y administradores.
export const POST=route({access:'manager',origin:'same',body:EventBody,invalidBody:'invalid_event'},async({user,body})=>{
  if(!validEventDates(body.start,body.end)) throw new HttpError(400,'invalid_event_dates');
  if((await listSalesEvents(user.id)).length>=100) throw new HttpError(409,'too_many_events');
  return {event:await createSalesEvent(user.id,body)};
});

export const DELETE=route({access:'manager',origin:'same',body:DeleteBody,invalidBody:'invalid_event'},async({user,body})=>{
  if(!await deleteSalesEvent(user.id,body.id)) throw new HttpError(404,'event_not_found');
  return {ok:true};
});
