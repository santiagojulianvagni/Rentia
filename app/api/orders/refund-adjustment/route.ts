import {database} from '../../../../db/client';
import {z} from 'zod';
import {HttpError,route} from '../../../../server/http/route';
import {readRefundAdjustment} from '../../../../lib/refund-adjustment';

const RefundBody=z.object({
  orderId:z.string().regex(/^\d{1,20}$/),
  confirm:z.literal(true),
  adjustment:z.unknown().optional(),
});

export const POST=route({access:'manager',origin:'configured',body:RefundBody,invalidBody:'confirmation_required'},async({user,body})=>{
  const adjustment=body.adjustment===null?null:readRefundAdjustment({...body.adjustment as object,confirmedAt:new Date().toISOString(),confirmedBy:user.clerkUserId||user.id});
  if(body.adjustment!==null&&!adjustment) throw new HttpError(400,'invalid_adjustment');
  const result=await database().prepare("UPDATE orders SET meli_refund_adjustment_json=? WHERE user_id=? AND provider='mercadolibre' AND external_order_id=? AND payment_status IN ('refunded','charged_back')")
    .bind(adjustment?JSON.stringify(adjustment):null,user.id,body.orderId).run();
  if(!Number(result.meta.changes)) throw new HttpError(409,'full_refund_required');
  return Response.json({ok:true},{headers:{'cache-control':'no-store'}});
});
