import {NextResponse} from 'next/server';
import {analyticsWindow,getAccount,getDashboardData,getIntegrations,getMetaAnalyticsData,listPhysicalStores} from '../../../db/database';
import {splitStoreSales,localProvider} from '../../../lib/physical-stores';
import type {CostRule} from '../../../lib/cost-engine';
import {analyticsRangeFromUrl} from '../../../lib/analytics-range';
import { route } from '../../../server/http/route';
import {costSettings} from '../../../lib/order-calculations';
import {summarizeOrders} from '../../../lib/order-summary';
import {salesChannels} from '../../../lib/sales-channels';
import {getMeliAds} from '../../../lib/meli-ads';

export const GET=route({},async({user,request})=>{
  const url=new URL(request.url),{days,range}=analyticsRangeFromUrl(url);
  const requestedOffset=Number(url.searchParams.get('offset')||0);
  const offset=!range&&Number.isSafeInteger(requestedOffset)&&requestedOffset>=0?requestedOffset:0;
  const [data,meta,account,integrations,stores]=await Promise.all([getDashboardData(user.id,days,offset,range),getMetaAnalyticsData(user.id,days,offset,range),getAccount(user.id),getIntegrations(user.id),listPhysicalStores(user.id)]);
  const summary=await summarizeOrders(data.orders,costSettings(data.settings as Record<string,unknown>|null),data.costRules as unknown as CostRule[],days,data.paidTotals,Boolean(Number(data.settings?.onboarding_complete||0)),new Date(analyticsWindow(days,offset,range).until));
  const {shipping,additional,refundLoss,fixed}=summary.totals;
  // Los locales físicos con costo conocido suman como un canal más; el resto queda como facturación sin costos.
  const locals=splitStoreSales(data.externalRevenue,stores);
  const paidOrders=summary.totals.orders+locals.totals.orders,revenue=summary.totals.revenue+locals.totals.revenue,productCost=summary.totals.productCost+locals.totals.productCost;
  const commissions=summary.totals.commissions+locals.totals.fees,taxes=summary.totals.taxes+locals.totals.taxes;
  const meliAds=await getMeliAds(user.id,days,offset,range);
  const meliAdsComparable=Boolean(meliAds.selected?.last_completed_at)&&meliAds.selected?.currency===(account?.currency||'ARS');
  const meliAdSpend=meliAds.summary.spend;
  const profitBeforeAds=revenue-productCost-shipping-commissions-taxes-additional-refundLoss;
  const adSpend=Number(meta.summary.spend||0),metaReportedRevenue=Number(meta.summary.purchase_value||0),metaPurchases=Number(meta.summary.purchases||0);
  const metaCurrency=String(meta.selected?.currency||account?.currency||'ARS');
  const adSpendComparable=Boolean(meta.selected)&&metaCurrency===(account?.currency||'ARS');
  const totalAdSpend=(adSpendComparable?adSpend:0)+(meliAdsComparable?meliAdSpend:0);
  // Ganancia del negocio: contribución de las ventas menos publicidad y gastos fijos del período.
  const profit=profitBeforeAds-totalAdSpend-fixed;
  let externalRevenue=0,externalOrders=0;
  const timelineMap=summary.timeline;
  for(const row of locals.unpriced) {
    const date=row.date,entryRevenue=row.revenue,entryOrders=row.orders;
    externalRevenue+=entryRevenue;externalOrders+=entryOrders;
    const point=timelineMap.get(date)||{date,orders:0,storeRevenue:0,externalRevenue:0,profit:0,adSpend:0,operatingCosts:0};point.orders+=entryOrders;point.externalRevenue+=entryRevenue;timelineMap.set(date,point);
  }
  for(const day of locals.priced) {
    const point=timelineMap.get(day.date)||{date:day.date,orders:0,storeRevenue:0,externalRevenue:0,profit:0,adSpend:0,operatingCosts:0};
    point.orders+=day.orders;point.storeRevenue+=day.revenue;point.profit+=day.profit;point.operatingCosts+=day.productCost+day.fees+day.taxes;timelineMap.set(day.date,point);
    const series=summary.channelTimelines[localProvider(day.storeId)]||(summary.channelTimelines[localProvider(day.storeId)]=[]);
    series.push({date:day.date,orders:day.orders,storeRevenue:day.revenue,externalRevenue:0,profit:day.profit,adSpend:0,operatingCosts:day.productCost+day.fees+day.taxes});
  }
  for(const row of meta.daily) {
    const date=String(row.date),point=timelineMap.get(date)||{date,orders:0,storeRevenue:0,externalRevenue:0,profit:0,adSpend:0,operatingCosts:0};
    point.adSpend+=Number(row.spend||0);if(adSpendComparable)point.profit-=Number(row.spend||0);timelineMap.set(date,point);
  }
  const totalRevenue=revenue+externalRevenue,totalOrders=paidOrders+externalOrders,netRevenue=revenue-shipping-commissions-taxes;
  for(const row of meliAds.daily) {
    if(!meliAdsComparable)continue;
    const date=row.date,point=timelineMap.get(date)||{date,orders:0,storeRevenue:0,externalRevenue:0,profit:0,adSpend:0,operatingCosts:0};point.adSpend+=row.spend;point.profit-=row.spend;timelineMap.set(date,point);
    const series=summary.channelTimelines.mercadolibre||(summary.channelTimelines.mercadolibre=[]),channelPoint=series.find(p=>p.date===date);
    if(channelPoint){channelPoint.adSpend+=row.spend;channelPoint.profit-=row.spend;}else series.push({date,orders:0,storeRevenue:0,externalRevenue:0,profit:-row.spend,adSpend:row.spend,operatingCosts:0});
  }
  summary.channelTimelines.mercadolibre?.sort((a,b)=>a.date.localeCompare(b.date));
  const localLabels=new Map(locals.channels.map(channel=>[channel.provider,channel.label]));
  const channels=[...salesChannels([...summary.channels,...locals.channels],integrations.results).map(row=>localLabels.has(row.provider)?{...row,label:localLabels.get(row.provider)!}:row).map(row=>row.provider==='mercadolibre'?{...row,profitBeforeAds:row.profit,profit:row.profit===null?null:row.profit-(meliAdsComparable?meliAdSpend:0),adSpend:meliAdsComparable?meliAdSpend:undefined,adsCoverage:meliAdsComparable&&meliAds.coverage.complete}:row),{provider:'external',label:'Facturación externa',orders:externalOrders,revenue:externalRevenue,netRevenue:externalRevenue,profit:null,aov:externalOrders?externalRevenue/externalOrders:0,costCoverage:false}];
  const exchangeRate=data.exchangeRate?{...data.exchangeRate,effective_rate:Number(data.exchangeRate.base_rate||0)*(1+Number(data.exchangeRate.adjustment_percent||0)/100)}:null;
  return NextResponse.json({metrics:{refundLoss,meliAdSpend,totalAdSpend,meliAdsComparable,revenue,externalRevenue,totalRevenue,profitBeforeAds,profit,margin:revenue?profit/revenue*100:0,orders:paidOrders,externalOrders,totalOrders,aov:paidOrders?revenue/paidOrders:0,totalAov:totalOrders?totalRevenue/totalOrders:0,netRevenue,productCost,shipping,commissions,taxes,additional,fixedCosts:fixed,marginBeforeFixed:revenue?(profit+fixed)/revenue*100:0,adSpend,metaReportedRevenue,metaPurchases,reportedRoas:adSpend?metaReportedRevenue/adSpend:0,blendedRoas:totalAdSpend?revenue/totalAdSpend:0,cpa:metaPurchases?adSpend/metaPurchases:0,adSpendComparable,metaCurrency},meliAds,ads:{connected:Boolean(meta.selected),selected:meta.selected,sync:meta.sync},orders:summary.latest,paymentMethods:data.paymentMethods,products:data.products,sync:data.sync,metaTimeline:meta.daily.map(row=>({date:String(row.date),orders:0,storeRevenue:0,externalRevenue:0,profit:0,adSpend:Number(row.spend||0),operatingCosts:0})),timeline:[...timelineMap.values()].sort((a,b)=>a.date.localeCompare(b.date)),channelTimelines:summary.channelTimelines,channels,exchangeRate,quality:summary.quality});
});
