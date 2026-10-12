import { route } from '../../../../server/http/route';
import {analyticsRangeFromUrl} from '../../../../lib/analytics-range';
import {analyticsWindow,getSettings,getCostRules,getPaidOrderTotals,iterateAnalyticsOrders} from '../../../../db/database';
import {allocateOrderCosts,costSettings,orderCosts} from '../../../../lib/order-calculations';
import {calculateVariableAdditionalCosts,type CostRule} from '../../../../lib/cost-engine';

function csvCell(value:unknown) {
  let text=String(value??'');
  if(typeof value==='string'&&/^[=+\-@\t\r]/.test(text))text=`'${text}`;
  return `"${text.replaceAll('"','""')}"`;
}

export const GET=route({},async({user,request})=>{
  const url=new URL(request.url),{days,range}=analyticsRangeFromUrl(url),query=(url.searchParams.get('q')||'').trim().slice(0,256);
  const [settings,rulesData,totals]=await Promise.all([getSettings(user.id),getCostRules(user.id),getPaidOrderTotals(user.id,days,range)]);
  const config=costSettings(settings as Record<string,unknown>|null),rules=rulesData.results as unknown as CostRule[];
  const additional=calculateVariableAdditionalCosts(totals.revenue,days,rules,new Date(analyticsWindow(days,0,range).until));
  const iterator=iterateAnalyticsOrders(user.id,days,0,range,query)[Symbol.asyncIterator](),encoder=new TextEncoder();
  let header=true;
  const stream=new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        let output=header?'\uFEFFOrden,Origen,Fecha,Estado,Venta,Costos,Ganancia,Margen\r\n':'';header=false;
        for(let count=0;count<100;count++) {
          const next=await iterator.next();
          if(next.done){if(output)controller.enqueue(encoder.encode(output));controller.close();return;}
          const order=allocateOrderCosts(orderCosts(next.value,config,rules),totals.revenue,totals.orders,additional);
          output+=[order.order_number||order.external_order_id,order.provider,order.source_created_at,order.payment_status,order.total,order.product_cost+order.shipping_cost+order.commission_cost+order.tax_cost+order.additional_cost,order.profit,order.margin.toFixed(2)].map(csvCell).join(',')+'\r\n';
        }
        controller.enqueue(encoder.encode(output));
      }catch(error){controller.error(error);}
    },
    async cancel(){await iterator.return(undefined);},
  });
  return new Response(stream,{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="rentia-ordenes.csv"','cache-control':'private, no-store'}});
});
