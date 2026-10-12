import {NextResponse} from 'next/server';
import {analyticsWindow,getOrdersPage,getSettings,getCostRules,getPaidOrderTotals} from '../../../db/database';
import {analyticsRangeFromUrl} from '../../../lib/analytics-range';
import { route } from '../../../server/http/route';
import {allocateOrderCosts,costSettings,orderCosts} from '../../../lib/order-calculations';
import {calculateVariableAdditionalCosts,type CostRule} from '../../../lib/cost-engine';

export const GET=route({},async({user,request})=>{
  const url=new URL(request.url),{days,range}=analyticsRangeFromUrl(url);
  const requested=Number(url.searchParams.get('page')||1);
  if(!Number.isSafeInteger(requested)||requested<1)return NextResponse.json({error:'invalid_page'},{status:400});
  const query=(url.searchParams.get('q')||'').trim().slice(0,256);
  const [data,settings,rulesData,totals]=await Promise.all([getOrdersPage(user.id,days,range,requested,query),getSettings(user.id),getCostRules(user.id),getPaidOrderTotals(user.id,days,range)]);
  const rules=rulesData.results as unknown as CostRule[],config=costSettings(settings as Record<string,unknown>|null);
  const additional=calculateVariableAdditionalCosts(totals.revenue,days,rules,new Date(analyticsWindow(days,0,range).until));
  return NextResponse.json({orders:data.orders.map(order=>allocateOrderCosts(orderCosts(order,config,rules),totals.revenue,totals.orders,additional)),pagination:data.pagination});
});
