// Punto de equilibrio y proyección de cierre de mes.
// - Costos fijos del mes: los gastos "fijos mensuales" activos (alquiler, sueldos, etc.).
// - Margen de contribución: lo que queda de cada peso vendido después de los costos que
//   crecen con las ventas (productos, envíos, comisiones, impuestos, reembolsos, publicidad
//   y gastos porcentuales). Con ese margen se pagan los costos fijos.
// - Punto de equilibrio: facturación necesaria para que el margen cubra los costos fijos.
// Solo se usa la facturación de la tienda: la facturación externa no tiene costos conocidos.

export type CashflowRule={category:string;calculation:string;amount:number;percentage:number;starts_at:string|null;ends_at:string|null;enabled:number|boolean;name:string};
export type CashflowMetrics={revenue:number;productCost:number;shipping:number;commissions:number;taxes:number;refundLoss?:number;totalAdSpend?:number;adSpend?:number;orders:number};
export type CashflowInput={month:string;today:string;metrics:CashflowMetrics;rules:CashflowRule[];recentDaily:number[]};
export type CashflowStatus='cubierto'|'en-camino'|'en-riesgo'|'sin-datos';

const DAY=24*60*60*1000;
const time=(date:string)=>Date.parse(`${date}T00:00:00Z`);

export function daysInMonth(month:string) {
  const [year,index]=month.split('-').map(Number);
  return new Date(Date.UTC(year,index,0)).getUTCDate();
}

// Costos fijos del mes: un gasto que empieza o termina a mitad de mes cuenta por los días activos.
export function monthlyFixedCosts(rules:CashflowRule[],month:string) {
  const start=time(`${month}-01`),days=daysInMonth(month),end=start+days*DAY;
  return rules.filter(rule=>rule.category==='additional'&&rule.calculation==='fixed_monthly'&&Number(rule.enabled)).map(rule=>{
    const from=Math.max(start,rule.starts_at?Date.parse(rule.starts_at):start);
    const to=Math.min(end,rule.ends_at?Date.parse(rule.ends_at)+(rule.ends_at.length<=10?DAY:0):end);
    const share=to>from?(to-from)/(days*DAY):0;
    return {name:rule.name,amount:Number(rule.amount||0)*share};
  }).filter(item=>item.amount>0);
}

export function percentageCostRate(rules:CashflowRule[]) {
  return rules.filter(rule=>rule.category==='additional'&&rule.calculation==='percentage_revenue'&&Number(rule.enabled)).reduce((sum,rule)=>sum+Number(rule.percentage||0)/100,0);
}

export function cashflow(input:CashflowInput) {
  const {metrics,month}=input;
  const totalDays=daysInMonth(month);
  const elapsed=Math.min(totalDays,Math.max(1,Math.floor((time(input.today)-time(`${month}-01`))/DAY)+1));
  const daysLeft=totalDays-elapsed;
  const fixedItems=monthlyFixedCosts(input.rules,month);
  const fixed=fixedItems.reduce((sum,item)=>sum+item.amount,0);
  const ads=metrics.totalAdSpend??metrics.adSpend??0;
  const variable=metrics.productCost+metrics.shipping+metrics.commissions+metrics.taxes+(metrics.refundLoss||0)+ads;
  const margin=metrics.revenue>0?1-variable/metrics.revenue-percentageCostRate(input.rules):null;
  const breakEven=margin!==null&&margin>0&&fixed>0?fixed/margin:null;
  // Ritmo diario: promedio de los últimos días con datos (incluye días sin ventas como cero).
  const recent=input.recentDaily.length?input.recentDaily:[metrics.revenue/elapsed];
  const pace=recent.reduce((sum,value)=>sum+value,0)/recent.length;
  const projectedRevenue=metrics.revenue+pace*daysLeft;
  const profitSoFar=margin===null?null:metrics.revenue*margin-fixed*elapsed/totalDays;
  const projectedProfit=margin===null?null:projectedRevenue*margin-fixed;
  const remaining=breakEven===null?null:Math.max(0,breakEven-metrics.revenue);
  const perDay=remaining===null||daysLeft<=0?null:remaining/daysLeft;
  const averageOrder=metrics.orders>0?metrics.revenue/metrics.orders:null;
  const ordersNeeded=remaining!==null&&averageOrder?Math.ceil(remaining/averageOrder):null;
  // Día estimado en que se cubren los costos fijos, si se llega dentro del mes.
  let breakEvenDay:string|null=null;
  if(breakEven!==null&&remaining!==null&&remaining>0&&pace>0) {
    const extra=Math.ceil(remaining/pace);
    if(extra<=daysLeft)breakEvenDay=new Date(time(input.today)+extra*DAY).toISOString().slice(0,10);
  }
  const status:CashflowStatus=breakEven===null?'sin-datos':metrics.revenue>=breakEven?'cubierto':projectedRevenue>=breakEven?'en-camino':'en-riesgo';
  return {month,totalDays,elapsed,daysLeft,fixed,fixedItems,margin,breakEven,pace,projectedRevenue,profitSoFar,projectedProfit,remaining,perDay,averageOrder,ordersNeeded,breakEvenDay,status,shortfall:breakEven!==null&&projectedRevenue<breakEven?breakEven-projectedRevenue:0};
}
