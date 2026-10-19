// Valor de vida de los clientes (LTV): cuánto te compra cada cliente desde su primera compra,
// cuántos vuelven, cada cuánto y en qué meses. Se calcula con las órdenes pagas que traen el
// código anónimo del cliente (hoy, Tiendanube). "Primera compra" es la primera dentro del
// historial importado.
export type LifetimeOrder={customerKey:string;createdAt:string;total:number};

const DAY=24*60*60*1000;
const monthKey=(iso:string)=>iso.slice(0,7);
const monthsBetween=(from:string,to:string)=>{const [a,b]=from.split('-').map(Number),[c,d]=to.split('-').map(Number);return (c-a)*12+(d-b);};
const median=(values:number[])=>{if(!values.length)return 0;const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;};

export function lifetimeValue(orders:LifetimeOrder[],options:{now:string;periodStart?:string;periodEnd?:string;cohortMonths?:number}) {
  const now=Date.parse(options.now);
  const byCustomer=new Map<string,Array<{time:number;iso:string;total:number}>>();
  for(const order of orders) {
    const time=Date.parse(order.createdAt);
    if(!order.customerKey||Number.isNaN(time))continue;
    const list=byCustomer.get(order.customerKey)||[];
    list.push({time,iso:new Date(time).toISOString(),total:order.total});
    byCustomer.set(order.customerKey,list);
  }
  const customers=[...byCustomer.values()].map(list=>{
    list.sort((a,b)=>a.time-b.time);
    const gaps=list.slice(1).map((order,index)=>(order.time-list[index].time)/DAY);
    return {first:list[0],orders:list,count:list.length,revenue:list.reduce((sum,order)=>sum+order.total,0),gaps};
  });
  const total=customers.length;
  const revenue=customers.reduce((sum,customer)=>sum+customer.revenue,0);
  const repeaters=customers.filter(customer=>customer.count>1);
  const gaps=repeaters.flatMap(customer=>customer.gaps);

  // Recompra a N días: entre los clientes que compraron por primera vez hace al menos N días.
  const repurchase=(days:number)=>{
    const eligible=customers.filter(customer=>now-customer.first.time>=days*DAY);
    const back=eligible.filter(customer=>customer.orders.some(order=>order.time>customer.first.time&&order.time-customer.first.time<=days*DAY));
    return {days,eligible:eligible.length,rate:eligible.length?back.length/eligible.length:null};
  };

  // Cohortes por mes de primera compra: qué parte volvió a comprar en cada mes siguiente
  // y cuánto acumuló cada cliente (ingresos por cliente) hasta ese mes.
  const currentMonth=monthKey(new Date(now).toISOString());
  const cohortMonths=options.cohortMonths??12;
  const cohortMap=new Map<string,typeof customers>();
  for(const customer of customers){const key=monthKey(customer.first.iso);const list=cohortMap.get(key)||[];list.push(customer);cohortMap.set(key,list);}
  const cohorts=[...cohortMap.entries()].sort(([a],[b])=>b.localeCompare(a)).slice(0,cohortMonths).map(([month,members])=>{
    const age=monthsBetween(month,currentMonth);
    const months=Array.from({length:age+1},(_,offset)=>{
      const active=members.filter(customer=>customer.orders.some(order=>monthsBetween(month,monthKey(order.iso))===offset&&(offset>0||order.time>customer.first.time))).length;
      const cumulative=members.reduce((sum,customer)=>sum+customer.orders.filter(order=>monthsBetween(month,monthKey(order.iso))<=offset).reduce((value,order)=>value+order.total,0),0);
      return {offset,returning:active,rate:members.length?active/members.length:0,valuePerCustomer:members.length?cumulative/members.length:0};
    });
    return {month,customers:members.length,months};
  });

  const frequency=[1,2,3,4].map(count=>{
    const list=count<4?customers.filter(customer=>customer.count===count):customers.filter(customer=>customer.count>=4);
    return {label:count<4?`${count} ${count===1?'compra':'compras'}`:'4 o más',customers:list.length,share:total?list.length/total:0,revenue:list.reduce((sum,customer)=>sum+customer.revenue,0)};
  });

  const newInPeriod=options.periodStart?customers.filter(customer=>customer.first.iso>=options.periodStart!&&(!options.periodEnd||customer.first.iso<options.periodEnd)).length:null;
  const firstOrder=customers.length?customers.reduce((min,customer)=>customer.first.time<min?customer.first.time:min,Infinity):null;
  return {
    customers:total,
    orders:customers.reduce((sum,customer)=>sum+customer.count,0),
    revenue,
    averageValue:total?revenue/total:0,
    medianValue:median(customers.map(customer=>customer.revenue)),
    ordersPerCustomer:total?customers.reduce((sum,customer)=>sum+customer.count,0)/total:0,
    repeatRate:total?repeaters.length/total:0,
    repeatRevenueShare:revenue?repeaters.reduce((sum,customer)=>sum+customer.revenue,0)/revenue:0,
    daysBetween:gaps.length?median(gaps):null,
    repurchase:[30,60,90,180].map(repurchase),
    cohorts,frequency,newInPeriod,
    historySince:firstOrder===null?null:new Date(firstOrder).toISOString(),
  };
}

// Cuánto se puede invertir para conseguir un cliente: el valor de vida en ganancia contra lo
// que costó traer cada cliente nuevo en el período.
export function acquisitionCheck(input:{averageValue:number;marginBeforeAds:number|null;adSpend:number;newCustomers:number|null}) {
  const lifetimeProfit=input.marginBeforeAds===null?null:input.averageValue*input.marginBeforeAds;
  const costPerCustomer=input.newCustomers&&input.adSpend>0?input.adSpend/input.newCustomers:null;
  return {lifetimeProfit,costPerCustomer,ratio:lifetimeProfit!==null&&costPerCustomer?lifetimeProfit/costPerCustomer:null};
}
