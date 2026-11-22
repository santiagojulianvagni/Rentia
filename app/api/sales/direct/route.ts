import { z } from 'zod';
import { createDirectSale, deleteDirectSale, getSettings, listDirectSales } from '../../../../db/database';
import { HttpError, route } from '../../../../server/http/route';
import { DIRECT_CHANNELS, DIRECT_PAYMENTS, DIRECT_PAYMENT_LABELS, directProvider, paymentHasFee } from '../../../../lib/direct-sales';

const money=z.number().finite().min(0).max(1e10);
const SaleBody=z.object({
  date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  channel:z.enum(DIRECT_CHANNELS),
  payment:z.enum(DIRECT_PAYMENTS),
  commission:money.default(0),
  shipping:money.default(0),
  note:z.string().trim().max(120).nullable().default(null),
  items:z.array(z.object({variantId:z.number().int().positive(),quantity:z.number().int().min(1).max(100000),unitPrice:money})).max(50).default([]),
  amount:money.nullable().default(null),
  productCost:money.nullable().default(null),
});
const DeleteBody=z.object({id:z.string().regex(/^d-[0-9a-f-]{36}$/)});

// Últimas ventas directas, más los porcentajes que usa el formulario para mostrar la ganancia.
export const GET=route({},async({user})=>{
  const [sales,settings]=await Promise.all([listDirectSales(user.id),getSettings(user.id)]);
  return {sales,taxPercent:Number(settings?.tax_percent||0),commissionPercent:Number(settings?.commission_percent||0)};
});

export const POST=route({access:'manager',origin:'same',body:SaleBody,invalidBody:'invalid_sale'},async({user,body})=>{
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  if(body.date>today||body.date<'2015-01-01') throw new HttpError(400,'invalid_date');
  if(!body.items.length&&!(body.amount&&body.amount>0)) throw new HttpError(400,'empty_sale');
  const sale=await createDirectSale(user.id,{date:body.date,provider:directProvider(body.channel),paymentLabel:DIRECT_PAYMENT_LABELS[body.payment],commission:paymentHasFee(body.payment)?body.commission:0,shipping:body.shipping,note:body.note||null,items:body.items,amount:body.items.length?null:body.amount,productCost:body.items.length?null:body.productCost});
  if(!sale) throw new HttpError(400,'invalid_products');
  return {sale};
});

export const DELETE=route({access:'manager',origin:'same',body:DeleteBody,invalidBody:'invalid_sale'},async({user,body})=>{
  if(!await deleteDirectSale(user.id,body.id)) throw new HttpError(404,'sale_not_found');
  return {ok:true};
});
