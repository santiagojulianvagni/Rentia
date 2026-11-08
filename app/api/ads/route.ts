import { NextResponse } from 'next/server';
import { getMetaAnalyticsData } from '../../../db/database';
import {planAnalyticsRange} from '../../../server/analytics-window';
import { route } from '../../../server/http/route';

function normalized(data:Awaited<ReturnType<typeof getMetaAnalyticsData>>) {
  const summary={
    spend:Number(data.summary.spend||0),impressions:Number(data.summary.impressions||0),clicks:Number(data.summary.clicks||0),
    purchases:Number(data.summary.purchases||0),purchaseValue:Number(data.summary.purchase_value||0),
  };
  return {
    accounts:data.accounts,
    selected:data.selected,
    sync:data.sync,
    summary:{...summary,reportedRoas:summary.spend?summary.purchaseValue/summary.spend:0,cpa:summary.purchases?summary.spend/summary.purchases:0,ctr:summary.impressions?summary.clicks/summary.impressions*100:0,cpc:summary.clicks?summary.spend/summary.clicks:0},
    campaigns:data.campaigns.map(row=>{
      const spend=Number(row.spend||0);const purchases=Number(row.purchases||0);const purchaseValue=Number(row.purchase_value||0);
      return {...row,spend,purchases,purchase_value:purchaseValue,impressions:Number(row.impressions||0),clicks:Number(row.clicks||0),reported_roas:spend?purchaseValue/spend:0,cpa:purchases?spend/purchases:0};
    }),
    daily:data.daily,
  };
}

export const GET=route({},async({user,request})=>{
  const {days,range}=await planAnalyticsRange(user.id,new URL(request.url));
  return NextResponse.json(normalized(await getMetaAnalyticsData(user.id,days,0,range)));
});
