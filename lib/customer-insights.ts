// Perfil de clientes del período: quiénes compran (nuevos o recurrentes), desde dónde, cómo
// pagan y reciben, y cuándo compran. Todo con órdenes pagas y no canceladas.
export type CustomerOrder={
  provider:string;customerKey:string|null;firstOrderAt:string|null;province:string|null;city:string|null;
  shippingMethod:string|null;paymentMethod:string|null;paymentType:string|null;installments:number|null;
  createdAt:string;total:number;storefront:string|null;
};
export type Share={name:string;orders:number;revenue:number;share:number};

const PAYMENT_LABELS:Record<string,string>={
  credit_card:'Tarjeta de crédito',debit_card:'Tarjeta de débito',prepaid_card:'Tarjeta prepaga',
  ticket:'Efectivo (Rapipago, Pago Fácil)',cash:'Efectivo',atm:'Efectivo',bank_transfer:'Transferencia',wire_transfer:'Transferencia',transfer:'Transferencia',
  account_money:'Dinero en cuenta',digital_currency:'Dinero en cuenta',digital_wallet:'Billetera virtual',consumer_credits:'Cuotas sin tarjeta',
};
const STOREFRONT_LABELS:Record<string,string>={store:'Tienda online',meli:'Mercado Libre (desde Tiendanube)',pos:'Punto de venta',api:'Otra app',form:'Formulario',mobile:'App móvil'};
const WEEKDAYS=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

export function paymentLabel(order:Pick<CustomerOrder,'paymentType'|'paymentMethod'>) {
  const type=(order.paymentType||'').toLowerCase();
  if(PAYMENT_LABELS[type])return PAYMENT_LABELS[type];
  const method=(order.paymentMethod||'').trim();
  if(!method)return 'Sin dato';
  if(/pago[-_ ]?nube|nuvem/i.test(method))return 'Pago Nube';
  if(/mercado ?pago/i.test(method))return 'Mercado Pago';
  if(/transfer|deposito|depósito/i.test(method))return 'Transferencia';
  if(/efectivo|cash|contra ?entrega/i.test(method))return 'Efectivo';
  return method.charAt(0).toUpperCase()+method.slice(1);
}

// Hora local de Argentina (UTC−3, sin horario de verano).
export function argentinaSlot(iso:string) {
  const time=Date.parse(iso);
  if(Number.isNaN(time))return null;
  const local=new Date(time-3*60*60*1000);
  return {weekday:(local.getUTCDay()+6)%7,hour:local.getUTCHours()};
}

function ranked(orders:CustomerOrder[],key:(order:CustomerOrder)=>string|null,limit:number):Share[] {
  const groups=new Map<string,{orders:number;revenue:number}>();
  let known=0;
  for(const order of orders) {
    const name=key(order);
    if(!name)continue;
    known++;
    const group=groups.get(name)||{orders:0,revenue:0};
    group.orders++;group.revenue+=order.total;groups.set(name,group);
  }
  const rows=[...groups.entries()].map(([name,group])=>({name,...group,share:known?group.orders/known:0})).sort((a,b)=>b.orders-a.orders||b.revenue-a.revenue);
  if(rows.length<=limit)return rows;
  const rest=rows.slice(limit-1);
  return [...rows.slice(0,limit-1),{name:'Otros',orders:rest.reduce((sum,row)=>sum+row.orders,0),revenue:rest.reduce((sum,row)=>sum+row.revenue,0),share:rest.reduce((sum,row)=>sum+row.share,0)}];
}

export function customerInsights(orders:CustomerOrder[],periodStart:string) {
  const identified=orders.filter(order=>order.customerKey);
  const byCustomer=new Map<string,{orders:number;revenue:number;isNew:boolean}>();
  for(const order of identified) {
    const entry=byCustomer.get(order.customerKey!)||{orders:0,revenue:0,isNew:Boolean(order.firstOrderAt&&order.firstOrderAt>=periodStart)};
    entry.orders++;entry.revenue+=order.total;byCustomer.set(order.customerKey!,entry);
  }
  const customers=[...byCustomer.values()];
  const newCustomers=customers.filter(customer=>customer.isNew),returning=customers.filter(customer=>!customer.isNew);
  const sum=(list:typeof customers,key:'orders'|'revenue')=>list.reduce((total,customer)=>total+customer[key],0);

  const heat=Array.from({length:7},()=>Array.from({length:24},()=>({orders:0,revenue:0})));
  for(const order of orders){const slot=argentinaSlot(order.createdAt);if(slot){heat[slot.weekday][slot.hour].orders++;heat[slot.weekday][slot.hour].revenue+=order.total;}}
  const days=heat.map((hours,index)=>({name:WEEKDAYS[index],orders:hours.reduce((total,hour)=>total+hour.orders,0),revenue:hours.reduce((total,hour)=>total+hour.revenue,0)}));
  const hours=Array.from({length:24},(_,hour)=>({hour,orders:heat.reduce((total,day)=>total+day[hour].orders,0)}));
  const bestDay=[...days].sort((a,b)=>b.orders-a.orders)[0];
  const bestHour=[...hours].sort((a,b)=>b.orders-a.orders)[0];

  const installments=ranked(orders.filter(order=>order.installments!==null&&order.installments>0),order=>order.installments===1?'1 pago':`${order.installments} cuotas`,8);
  return {
    totals:{orders:orders.length,revenue:orders.reduce((total,order)=>total+order.total,0),identifiedOrders:identified.length,coverage:orders.length?identified.length/orders.length:0},
    customers:{
      total:customers.length,newCount:newCustomers.length,returningCount:returning.length,
      newRevenue:sum(newCustomers,'revenue'),returningRevenue:sum(returning,'revenue'),
      repeatInPeriod:customers.filter(customer=>customer.orders>1).length,
      ordersPerCustomer:customers.length?identified.length/customers.length:0,
      revenuePerCustomer:customers.length?sum(customers,'revenue')/customers.length:0,
    },
    provinces:ranked(orders,order=>order.province,10),
    cities:ranked(orders,order=>order.city&&order.province?`${order.city} (${order.province})`:order.city,10),
    shipping:ranked(orders,order=>order.shippingMethod,8),
    payments:ranked(orders,order=>paymentLabel(order)==='Sin dato'?null:paymentLabel(order),8),
    installments,
    storefronts:ranked(orders.filter(order=>order.provider==='tiendanube'),order=>order.storefront?STOREFRONT_LABELS[order.storefront]||order.storefront:null,6),
    heat,days,hours,
    best:orders.length?{day:bestDay.name,hour:bestHour.hour}:null,
  };
}
