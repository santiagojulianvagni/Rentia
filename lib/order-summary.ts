import {calculateFixedAdditionalCosts,calculateVariableAdditionalCosts,type CostRule,type CostSettings} from './cost-engine';
import {allocateOrderCosts,orderCosts,type AnalyticsOrder} from './order-calculations';
import {emptySalesChannel,type SalesChannelTotals} from './sales-channels';
import {orderReturnNeedsReview} from './sales-channels';

export async function summarizeOrders(source:AsyncIterable<AnalyticsOrder>,settings:CostSettings,rules:CostRule[],days:number,paidTotals:{orders:number;revenue:number},configurationSaved:boolean,periodEnd:Date) {
  // A cada orden solo se le cargan los gastos variables; los fijos van una vez al total.
  const additionalTotal=calculateVariableAdditionalCosts(paidTotals.revenue,days,rules,periodEnd);
  const fixedTotal=calculateFixedAdditionalCosts(paidTotals.revenue,days,rules,periodEnd);
  const totals={orders:0,revenue:0,productCost:0,shipping:0,commissions:0,taxes:0,additional:0,refundLoss:0,fixed:fixedTotal};
  const channels=new Map<string,SalesChannelTotals>();
  const timeline=new Map<string,{date:string;orders:number;storeRevenue:number;externalRevenue:number;profit:number;adSpend:number;operatingCosts:number}>();
  const channelTimelines=new Map<string,typeof timeline>();
  const postSaleOrders:Array<{provider:string;externalOrderId:string;date:string;total:number;currency:string;refundAmount:number|null;state:string}>=[];
  let openClaims=0,refundOrders=0,refundPending=0,claimsUnchecked=0;
  const dimensions={products:{complete:0},shipping:{complete:0},commissions:{complete:0},taxes:{complete:0}};
  let completeOrders=0,coveredRevenue=0,coveredProfit=0;
  const latest:Array<ReturnType<typeof allocateOrderCosts>>=[];
  const incompleteOrders:Array<{provider:string;externalOrderId:string;orderNumber:string|null;date:string;total:number;currency:string;missing:string[]}>=[];
  for await (const raw of source) {
    const order=allocateOrderCosts(orderCosts(raw,settings,rules),paidTotals.revenue,paidTotals.orders,additionalTotal);
    latest.push(order);if(latest.length>6)latest.shift();
    const claimOpen=order.post_sale?.claims.some(claim=>claim.status==='opened')||false;
    const refund=orderReturnNeedsReview({payment_status:String(order.payment_status)});
    if(order.provider==='mercadolibre'&&!order.post_sale?.claimsChecked)claimsUnchecked++;
    if(claimOpen)openClaims++;if(refund)refundOrders++;
    if(claimOpen||refund){postSaleOrders.push({provider:order.provider,externalOrderId:order.external_order_id,date:order.source_created_at,total:Number(order.total||0),currency:String(order.currency||'ARS'),refundAmount:order.post_sale?.refundAmount??null,state:refund?(order.refund_loss!==null?'Reembolso total · producto no recuperado':'Reembolso · por conciliar'):'Reclamo abierto'});if(postSaleOrders.length>12)postSaleOrders.shift();}
    if(refund) {
      const channel=channels.get(order.provider)||emptySalesChannel(order.provider);channel.refundOrders++;
      if(order.refund_loss===null){refundPending++;channel.refundPending++;}
      else {
        totals.refundLoss+=order.refund_loss;channel.refundLoss+=order.refund_loss;
        const date=order.source_created_at.slice(0,10),point=timeline.get(date)||{date,orders:0,storeRevenue:0,externalRevenue:0,profit:0,adSpend:0,operatingCosts:0};
        point.profit-=order.refund_loss;point.operatingCosts+=order.refund_loss;timeline.set(date,point);
        const series=channelTimelines.get(order.provider)||new Map(),cp=series.get(date)||{date,orders:0,storeRevenue:0,externalRevenue:0,profit:0,adSpend:0,operatingCosts:0};cp.profit-=order.refund_loss;cp.operatingCosts+=order.refund_loss;series.set(date,cp);channelTimelines.set(order.provider,series);
      }
      channels.set(order.provider,channel);
    }
    if (order.payment_status!=='paid'||order.status==='cancelled') continue;
    totals.orders++;totals.revenue+=Number(order.total||0);totals.productCost+=order.product_cost;totals.shipping+=order.shipping_cost;totals.commissions+=order.commission_cost;totals.taxes+=order.tax_cost;totals.additional+=order.additional_cost;
    const channel=channels.get(order.provider)||emptySalesChannel(order.provider);
    channel.orders++;channel.revenue+=Number(order.total||0);channel.productCost+=order.product_cost;channel.shipping+=order.shipping_cost;channel.commissions+=order.commission_cost;channel.taxes+=order.tax_cost;channel.additional+=order.additional_cost;
    channels.set(order.provider,channel);
    const productsKnown=Number(raw.item_count)>0&&Number(raw.missing_product_costs)===0;
    const shippingKnown=raw.source_shipping_cost!==null&&raw.source_shipping_cost!==undefined&&Number.isFinite(Number(raw.source_shipping_cost))||(raw.provider!=='mercadolibre'&&configurationSaved);
    const commissionKnown=order.commission_source!=='Sin costo de pago informado'&&order.commission_source!=='Mercado Libre · cargo pendiente'&&!order.commission_source.startsWith('Pago Nube · calculada')&&(configurationSaved||order.commission_source!=='Promedio general');
    const missing:string[]=[];
    for (const [key,known] of [['products',productsKnown],['shipping',shippingKnown],['commissions',commissionKnown],['taxes',configurationSaved]] as const) {
      if(known)dimensions[key].complete++;else missing.push(key);
    }
    if(claimOpen)missing.push('claim');
    if(!missing.length){completeOrders++;channel.completeOrders++;channel.coveredProfit+=order.profit;coveredRevenue+=Number(order.total||0);coveredProfit+=order.profit;}
    else {incompleteOrders.push({provider:order.provider,externalOrderId:order.external_order_id,orderNumber:order.order_number?String(order.order_number):null,date:order.source_created_at,total:Number(order.total||0),currency:String(order.currency||'ARS'),missing});if(incompleteOrders.length>12)incompleteOrders.shift();}
    const date=order.source_created_at.slice(0,10),point=timeline.get(date)||{date,orders:0,storeRevenue:0,externalRevenue:0,profit:0,adSpend:0,operatingCosts:0};
    point.orders++;point.storeRevenue+=Number(order.total||0);point.profit+=order.profit;point.operatingCosts+=order.product_cost+order.shipping_cost+order.commission_cost+order.tax_cost+order.additional_cost;timeline.set(date,point);
    const series=channelTimelines.get(order.provider)||new Map();
    const channelPoint=series.get(date)||{date,orders:0,storeRevenue:0,externalRevenue:0,profit:0,adSpend:0,operatingCosts:0};
    channelPoint.orders++;channelPoint.storeRevenue+=Number(order.total||0);channelPoint.profit+=missing.length?0:order.profit;channelPoint.operatingCosts+=order.product_cost+order.shipping_cost+order.commission_cost+order.tax_cost+order.additional_cost;series.set(date,channelPoint);channelTimelines.set(order.provider,series);
  }
  // Los gastos fijos se reparten parejo entre los días del período en la evolución diaria,
  // para que la suma del gráfico coincida con la ganancia total.
  if(fixedTotal>0&&days>0) {
    const dayMs=24*60*60*1000,start=periodEnd.getTime()-days*dayMs,perDay=fixedTotal/days;
    for(let index=0;index<days;index++){
      const date=new Date(start+index*dayMs).toISOString().slice(0,10);
      const point=timeline.get(date)||{date,orders:0,storeRevenue:0,externalRevenue:0,profit:0,adSpend:0,operatingCosts:0};
      point.profit-=perDay;point.operatingCosts+=perDay;timeline.set(date,point);
    }
  }
  const dimension=(key:keyof typeof dimensions)=>({complete:dimensions[key].complete,total:totals.orders,missing:totals.orders-dimensions[key].complete,percent:totals.orders?Math.round(dimensions[key].complete/totals.orders*100):0});
  const qualityDimensions={products:dimension('products'),shipping:dimension('shipping'),commissions:dimension('commissions'),taxes:dimension('taxes')};
  const weighted=totals.orders?Math.round(qualityDimensions.products.percent*.5+qualityDimensions.shipping.percent*.2+qualityDimensions.commissions.percent*.2+qualityDimensions.taxes.percent*.1):0;
  const score=completeOrders===totals.orders?weighted:Math.min(99,weighted);
  return {totals,channels:[...channels.values()],timeline,channelTimelines:Object.fromEntries([...channelTimelines].map(([provider,points])=>[provider,[...points.values()].sort((a,b)=>a.date.localeCompare(b.date))])),latest:latest.reverse().map(order=>({...order,items:[]})),quality:{score,status:totals.orders===0?'empty':score>=90?'excellent':score>=70?'good':score>=40?'warning':'critical',totalOrders:totals.orders,completeOrders,coveredRevenue,coveredProfit,configurationSaved,dimensions:qualityDimensions,incompleteOrders:incompleteOrders.reverse(),postSale:{openClaims,refundOrders,refundPending,claimsUnchecked,refundLoss:totals.refundLoss,orders:postSaleOrders.reverse()}}};
}
