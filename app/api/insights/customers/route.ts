import { analyticsWindow, getCustomerOrders } from '../../../../db/database';
import { analyticsRangeFromUrl } from '../../../../lib/analytics-range';
import { customerInsights } from '../../../../lib/customer-insights';
import { route } from '../../../../server/http/route';

// Perfil de clientes del período elegido en el panel.
export const GET=route({},async({user,url})=>{
  const {days,range}=analyticsRangeFromUrl(url);
  const {since,until}=analyticsWindow(days,0,range);
  const orders=await getCustomerOrders(user.id,since,until);
  return customerInsights(orders,since);
});
