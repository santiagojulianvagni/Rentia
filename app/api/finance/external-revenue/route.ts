import { z } from 'zod';
import { getExternalRevenue, physicalStoreExists, saveExternalRevenueMonth } from '../../../../db/database';
import { HttpError, route } from '../../../../server/http/route';
import { field } from '../../../../server/http/fields';

function monthRange(month:string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const [year,monthNumber]=month.split('-').map(Number);
  if (monthNumber<1||monthNumber>12) return null;
  const lastDay=new Date(Date.UTC(year,monthNumber,0)).getUTCDate();
  return {from:`${month}-01`,to:`${month}-${String(lastDay).padStart(2,'0')}`,lastDay};
}

const RevenueEntry=z.object({
  revenueDate:field(value=>String(value||'')),
  orderCount:field(value=>Math.trunc(Number(value||0))).pipe(z.number().min(0)),
  revenue:field(value=>Number(value||0)).pipe(z.number().min(0)),
  currency:field(value=>String(value||'ARS')),
  productCost:field(value=>value===null||value===undefined||value===''?null:Number(value)).pipe(z.number().min(0).nullable()),
});

const RevenueBody=z.object({month:z.string(),storeId:z.number().int().positive().nullable().optional(),entries:z.array(z.unknown()).max(31)});

// Sin local (null) es la facturación externa de antes; con local, sus ventas diarias.
async function storeFor(userId:string,value:unknown) {
  if(value===null||value===undefined||value==='')return null;
  const id=Number(value);
  if(!Number.isInteger(id)||id<=0||!await physicalStoreExists(userId,id)) throw new HttpError(404,'store_not_found');
  return id;
}

export const GET=route({},async({user,url})=>{
  const month=url.searchParams.get('month')||new Date().toISOString().slice(0,7);
  const range=monthRange(month);
  if (!range) throw new HttpError(400,'invalid_month');
  const storeId=await storeFor(user.id,url.searchParams.get('store'));
  const result=await getExternalRevenue(user.id,range.from,range.to,storeId);
  return {month,days:range.lastDay,entries:result.results};
});

export const PUT=route({access:'manager',body:RevenueBody,invalidBody:'invalid_data'},async({user,body})=>{
  if (!monthRange(body.month)) throw new HttpError(400,'invalid_data');
  const parsed=z.array(RevenueEntry).safeParse(body.entries);
  if (!parsed.success||parsed.data.some(entry=>!entry.revenueDate.startsWith(`${body.month}-`))) throw new HttpError(400,'invalid_entries');
  await saveExternalRevenueMonth(user.id,body.month,parsed.data,await storeFor(user.id,body.storeId));
  return {ok:true};
});
