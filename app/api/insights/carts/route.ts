import { abandonedCartsSyncedAt, analyticsWindow, getAbandonedCarts } from '../../../../db/database';
import { analyticsRangeFromUrl } from '../../../../lib/analytics-range';
import { cartSummary, type AbandonedCart } from '../../../../lib/abandoned-carts';
import { route } from '../../../../server/http/route';

// Carritos abandonados del período elegido en el panel.
export const GET=route({},async({user,url})=>{
  const {days,range}=analyticsRangeFromUrl(url);
  const {since,until}=analyticsWindow(days,0,range);
  const [{carts,paidOrders},syncedAt]=await Promise.all([getAbandonedCarts(user.id,since,until),abandonedCartsSyncedAt(user.id)]);
  return {...cartSummary(carts as AbandonedCart[],paidOrders),syncedAt};
});
