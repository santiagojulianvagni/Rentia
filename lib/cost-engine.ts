import { estimatePagoNubeFee } from './pago-nube-fees';

export type CostRule={id:number;category:'commission'|'additional';name:string;match_value:string|null;calculation:'hybrid'|'fixed_monthly'|'percentage_revenue';amount:number;percentage:number;starts_at:string|null;ends_at:string|null;enabled:number};
export type CostSettings={shipping_cost_ars:number;shipping_mode:string;commission_percent:number;tax_percent:number;tiendanube_plan_name?:string|null;pago_nube_plan_override?:string|null;pago_nube_payout_days?:number|null};
export type CostOrder={provider?:string;total:number;currency?:string|null;payment_method?:string|null;payment_type?:string|null;payment_installments?:number|null;source_shipping_cost?:number|null;source_commission_cost?:number|null;manual_commission_cost?:number|null;source_created_at:string};

function normalized(value:string|null|undefined) { return (value||'').trim().toLocaleLowerCase('es'); }
function dateValue(value:string|null,edge:'start'|'end') { if (!value) return edge==='start'?-Infinity:Infinity;const suffix=value.length===10?(edge==='start'?'T00:00:00.000Z':'T23:59:59.999Z'):'';const parsed=new Date(`${value}${suffix}`).getTime();return Number.isFinite(parsed)?parsed:(edge==='start'?-Infinity:Infinity); }

export function ruleIsActive(rule:CostRule,date:string|Date) {
  if (!Number(rule.enabled)) return false;
  const timestamp=new Date(date).getTime();
  return timestamp>=dateValue(rule.starts_at,'start')&&timestamp<=dateValue(rule.ends_at,'end');
}

export function calculateOrderCosts(order:CostOrder,settings:CostSettings,rules:CostRule[]) {
  const total=Number(order.total||0);
  const marketplace=order.provider==='mercadolibre';
  const actualShipping=order.source_shipping_cost===null||order.source_shipping_cost===undefined?null:Number(order.source_shipping_cost);
  const useActual=(marketplace||settings.shipping_mode!=='average_only')&&actualShipping!==null&&Number.isFinite(actualShipping)&&actualShipping>=0;
  const shipping=useActual?Math.max(0,actualShipping):marketplace?0:Math.max(0,Number(settings.shipping_cost_ars||0));
  const method=normalized(order.payment_method);
  const commissionRule=rules.find(rule=>rule.category==='commission'&&ruleIsActive(rule,order.source_created_at)&&method&&normalized(rule.match_value)&&method.includes(normalized(rule.match_value)));
  const actualCommission=order.source_commission_cost===null||order.source_commission_cost===undefined?null:Number(order.source_commission_cost);
  const hasActualCommission=actualCommission!==null&&Number.isFinite(actualCommission)&&actualCommission>=0;
  const manualCommission=order.manual_commission_cost===null||order.manual_commission_cost===undefined?null:Number(order.manual_commission_cost);
  const hasManualCommission=manualCommission!==null&&Number.isFinite(manualCommission)&&manualCommission>=0;
  const estimatedCommission=marketplace||hasActualCommission||hasManualCommission?null:estimatePagoNubeFee({total,currency:order.currency||'ARS',gateway:order.payment_method,paymentType:order.payment_type,installments:order.payment_installments,planName:settings.pago_nube_plan_override||settings.tiendanube_plan_name,payoutDays:settings.pago_nube_payout_days});
  const commissions=hasActualCommission?actualCommission:hasManualCommission?manualCommission:marketplace?0:estimatedCommission!==null?estimatedCommission:commissionRule?total*Number(commissionRule.percentage||0)/100+Number(commissionRule.amount||0):total*Number(settings.commission_percent||0)/100;
  const taxes=total*Number(settings.tax_percent||0)/100;
  const commissionSource=hasActualCommission?(marketplace?'Mercado Libre · tarifa de venta informada':'Tiendanube · cargo informado'):hasManualCommission?'Costo exacto · cargado por la tienda':marketplace?'Mercado Libre · cargo pendiente':estimatedCommission!==null?'Pago Nube · calculada con tarifa pública':commissionRule?.name|| (Number(settings.commission_percent||0)>0?'Promedio general':'Sin costo de pago informado');
  return {shipping,commissions,taxes,shippingSource:useActual?'real':marketplace?'pendiente':'promedio',commissionSource};
}

// Gastos adicionales del período. Los porcentuales acompañan a cada venta (variables); los
// fijos mensuales (alquiler, sueldos, suscripciones) son del negocio y no se cargan a ninguna
// orden ni producto: se restan una sola vez en la ganancia total.
export function calculateAdditionalCosts(revenue:number,days:number,rules:CostRule[],periodEnd=new Date()) {
  return additionalCosts(revenue,days,rules,periodEnd,'all');
}
export function calculateVariableAdditionalCosts(revenue:number,days:number,rules:CostRule[],periodEnd=new Date()) {
  return additionalCosts(revenue,days,rules,periodEnd,'variable');
}
export function calculateFixedAdditionalCosts(revenue:number,days:number,rules:CostRule[],periodEnd=new Date()) {
  return additionalCosts(revenue,days,rules,periodEnd,'fixed');
}

function additionalCosts(revenue:number,days:number,rules:CostRule[],periodEnd:Date,kind:'all'|'variable'|'fixed') {
  const dayMs=24*60*60*1000;
  const end=periodEnd.getTime();
  const start=end-days*dayMs;
  return rules.filter(rule=>rule.category==='additional'&&Number(rule.enabled)&&(kind==='all'||(rule.calculation==='fixed_monthly')===(kind==='fixed'))).reduce((sum,rule)=>{
    const activeStart=Math.max(start,dateValue(rule.starts_at,'start'));
    const activeEnd=Math.min(end,dateValue(rule.ends_at,'end'));
    if (activeEnd<=activeStart) return sum;
    const activeDays=(activeEnd-activeStart)/dayMs;
    if (rule.calculation==='fixed_monthly') return sum+Number(rule.amount||0)*activeDays/30;
    return sum+Number(revenue||0)*Number(rule.percentage||0)/100*(activeDays/days);
  },0);
}
