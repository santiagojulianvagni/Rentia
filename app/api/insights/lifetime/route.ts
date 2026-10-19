import { analyticsWindow, getLifetimeOrders } from '../../../../db/database';
import { analyticsRangeFromUrl } from '../../../../lib/analytics-range';
import { lifetimeValue } from '../../../../lib/lifetime';
import { route } from '../../../../server/http/route';

// Valor de vida de los clientes con todo el historial; el período elegido solo define cuántos
// clientes nuevos hubo (para comparar con la inversión publicitaria).
export const GET=route({},async({user,url})=>{
  const {days,range}=analyticsRangeFromUrl(url);
  const {since,until}=analyticsWindow(days,0,range);
  return lifetimeValue(await getLifetimeOrders(user.id),{now:new Date().toISOString(),periodStart:since,periodEnd:until});
});
