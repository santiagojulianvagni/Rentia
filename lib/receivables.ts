import { getCostRules, getSettings, iterateAnalyticsOrders } from '../db/database';
import type { CostRule } from './cost-engine';
import { costSettings, orderCosts } from './order-calculations';

// Plata por cobrar de ventas ya hechas, estimada con lo que Rentia sabe de cada orden:
// - Pago Nube: se libera a los días de acreditación configurados (1, 7 o 14) desde la venta,
//   descontada la comisión de Pago Nube.
// - Mercado Libre: se libera cuando se entrega; mientras el envío está en curso queda
//   pendiente, descontados el cargo por venta y el envío a cargo del vendedor.
// Otros medios (transferencia, efectivo, otros procesadores) no tienen fecha conocida.

export type ReceivableDay={date:string;amount:number;orders:number};
export type Receivables={pagoNube:ReceivableDay[];payoutDays:number|null;mercadolibre:{amount:number;orders:number};otherOrders:number};

const DAY=24*60*60*1000;
const PAGO_NUBE=/(?:pago[-_ ]?nube|nuvem[-_ ]?pago)/i;
const IN_TRANSIT=new Set(['pending','handling','ready_to_ship','shipped']);

export async function getReceivables(userId:string,today:string):Promise<Receivables> {
  const [settingsRow,rules]=await Promise.all([getSettings(userId),getCostRules(userId)]);
  const settings=costSettings(settingsRow as Record<string,unknown>|null);
  const payoutDays=settings.pago_nube_payout_days??null;
  const todayTime=Date.parse(`${today}T00:00:00Z`);
  const byDate=new Map<string,ReceivableDay>();
  const meli={amount:0,orders:0};
  let otherOrders=0;
  for await (const order of iterateAnalyticsOrders(userId,60)) {
    if(order.payment_status!=='paid'||order.status==='cancelled')continue;
    const calculated=orderCosts(order,settings,rules.results as unknown as CostRule[]);
    const total=Number(order.total||0);
    if(order.provider==='mercadolibre') {
      if(!IN_TRANSIT.has(String(order.shipping_status||'')))continue;
      meli.amount+=total-calculated.commission_cost-calculated.shipping_cost;meli.orders++;
      continue;
    }
    if(PAGO_NUBE.test(String(order.payment_method||''))&&payoutDays) {
      const release=Date.parse(`${order.source_created_at.slice(0,10)}T00:00:00Z`)+payoutDays*DAY;
      if(release<=todayTime)continue;
      const date=new Date(release).toISOString().slice(0,10);
      const entry=byDate.get(date)||{date,amount:0,orders:0};
      entry.amount+=total-calculated.commission_cost;entry.orders++;byDate.set(date,entry);
      continue;
    }
    if(Date.parse(order.source_created_at)>=todayTime-14*DAY)otherOrders++;
  }
  return {pagoNube:[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date)),payoutDays,mercadolibre:meli,otherOrders};
}
