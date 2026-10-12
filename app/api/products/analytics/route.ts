import { NextResponse } from 'next/server';
import { analyticsWindow, getProductAnalyticsData } from '../../../../db/database';
import { calculateVariableAdditionalCosts, calculateOrderCosts, type CostRule } from '../../../../lib/cost-engine';
import { analyticsRangeFromUrl } from '../../../../lib/analytics-range';
import { route } from '../../../../server/http/route';

type CatalogRow={product_id:number;rentia_archived:number;variant_id:number;provider:string;external_product_id:string;external_variant_id:string;sku:string|null;price:number;effective_cost:number;stock:number|null;product_name:string;image_url:string|null;cost_source:string};
type SaleRow={provider:string;order_cursor:number;order_gross:number;variant_id:number|null;external_order_id:string;quantity:number;unit_price:number;unit_cost:number;order_total:number;currency:string;payment_method:string|null;payment_type:string|null;payment_installments:number|null;source_shipping_cost:number|null;source_commission_cost:number|null;manual_commission_cost:number|null;source_created_at:string};

export const GET=route({},async({user,request})=>{
  const {days,range}=analyticsRangeFromUrl(new URL(request.url));
  const data=await getProductAnalyticsData(user.id,days,range);
  const catalog=data.catalog as unknown as CatalogRow[];
  const settings={shipping_cost_ars:Number(data.settings?.shipping_cost_ars||0),shipping_mode:data.settings?.shipping_mode||'average',commission_percent:Number(data.settings?.commission_percent||0),tax_percent:Number(data.settings?.tax_percent||0),tiendanube_plan_name:data.settings?.tiendanube_plan_name||null,pago_nube_plan_override:data.settings?.pago_nube_plan_override||null,pago_nube_payout_days:data.settings?.pago_nube_payout_days||null};
  const rules=data.costRules as unknown as CostRule[];
  const totalRevenue=data.totalRevenue;
  const additionalTotal=calculateVariableAdditionalCosts(totalRevenue,days,rules,new Date(analyticsWindow(days,0,range).until));
  const lastOrderByVariant=new Map<number,number>();
  let costOrder=-1;
  let orderCosts:ReturnType<typeof calculateOrderCosts>&{additional:number}={shipping:0,commissions:0,taxes:0,shippingSource:'',commissionSource:'',additional:0};
  const rows=catalog.map(item=>({...item,units_sold:0,orders:0,revenue:0,product_cost:0,shipping_cost:0,commission_cost:0,commission_pending:false,commission_estimated:false,tax_cost:0,additional_cost:0,total_costs:0,profit:0,margin:0,sales_per_day:0,days_stock:null as number|null,currency:'ARS'}));
  const byVariant=new Map(rows.map(row=>[Number(row.variant_id),row]));
  for await (const raw of data.sales) {
    const sale=raw as unknown as SaleRow;
    if (sale.variant_id===null) continue;
    const row=byVariant.get(Number(sale.variant_id));
    if (!row) continue;
    const quantity=Number(sale.quantity||0);
    const lineGross=quantity*Number(sale.unit_price||0);
    const gross=Number(sale.order_gross||0);
    const share=gross>0?lineGross/gross:0;
    const actualRevenue=Number(sale.order_total||0)*share;
    const productCost=quantity*Number(sale.unit_cost||0);
    if(costOrder!==sale.order_cursor){costOrder=sale.order_cursor;orderCosts={...calculateOrderCosts({provider:sale.provider,total:Number(sale.order_total||0),currency:sale.currency,payment_method:sale.payment_method,payment_type:sale.payment_type,payment_installments:sale.payment_installments,source_shipping_cost:sale.source_shipping_cost,source_commission_cost:sale.source_commission_cost,manual_commission_cost:sale.manual_commission_cost,source_created_at:sale.source_created_at},settings,rules),additional:totalRevenue?additionalTotal*Number(sale.order_total||0)/totalRevenue:0};}
    const shippingCost=Number(orderCosts?.shipping||0)*share;
    const commissionCost=Number(orderCosts?.commissions||0)*share;
    const taxCost=Number(orderCosts?.taxes||0)*share;
    const additionalCost=Number(orderCosts?.additional||0)*share;
    row.units_sold+=quantity;
    row.revenue+=actualRevenue;
    row.product_cost+=productCost;
    row.shipping_cost+=shippingCost;
    row.commission_cost+=commissionCost;
    if (orderCosts?.commissionSource==='Sin costo de pago informado'||orderCosts?.commissionSource==='Mercado Libre · cargo pendiente'||orderCosts?.shippingSource==='pendiente') row.commission_pending=true;
    if (orderCosts?.commissionSource.startsWith('Pago Nube · calculada')) row.commission_estimated=true;
    row.tax_cost+=taxCost;
    row.additional_cost+=additionalCost;
    row.currency=sale.currency||'ARS';
    if(lastOrderByVariant.get(row.variant_id)!==sale.order_cursor){row.orders++;lastOrderByVariant.set(row.variant_id,sale.order_cursor);}
  }
  for (const row of rows) {
    row.total_costs=row.product_cost+row.shipping_cost+row.commission_cost+row.tax_cost+row.additional_cost;
    row.profit=row.revenue-row.total_costs;
    row.margin=row.revenue?row.profit/row.revenue*100:0;
    row.sales_per_day=row.units_sold/days;
    row.days_stock=row.stock===null||row.sales_per_day<=0?null:Math.max(0,Number(row.stock))/row.sales_per_day;
  }
  return NextResponse.json({days,products:rows});
});
