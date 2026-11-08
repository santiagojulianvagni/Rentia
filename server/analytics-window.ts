import { getOrCreateSubscription } from '../db/database';
import { analyticsRangeFromUrl, clampToHistory, type AnalyticsWindow } from '../lib/analytics-range';
import { billingEnforced } from '../lib/billing';
import { historyEntitlement, historyStartDate } from '../lib/plans';

// Rango de fechas pedido, recortado al historial visible del plan de la tienda. Como el límite
// de órdenes, se aplica recién cuando el cobro está activo (RENTIA_BILLING_ENFORCED=1).
export async function planAnalyticsRange(userId:string,url:URL):Promise<AnalyticsWindow> {
  const requested=analyticsRangeFromUrl(url);
  if (!billingEnforced()||!requested.range) return requested;
  const {months}=historyEntitlement(await getOrCreateSubscription(userId));
  return clampToHistory(requested,months===null?null:historyStartDate(months));
}
