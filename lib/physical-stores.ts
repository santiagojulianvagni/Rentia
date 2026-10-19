import { emptySalesChannel, type SalesChannelTotals } from './sales-channels';

// Locales físicos: cada día cargado (a mano o desde un Excel) suma ventas y órdenes. El costo
// de mercadería es el del día si vino en el archivo, o el porcentaje configurado del local.
// Un día sin costo conocido no entra en la ganancia: queda como facturación sin costos.
export type StoreCosts={id:number;name:string;costPercent:number;feePercent:number;taxPercent:number};
export type StoreSaleRow={revenue_date?:unknown;order_count?:unknown;revenue?:unknown;store_id?:unknown;product_cost?:unknown};
export type StoreDay={date:string;storeId:number;orders:number;revenue:number;productCost:number;fees:number;taxes:number;profit:number};
export type UnpricedDay={date:string;storeId:number|null;orders:number;revenue:number};

export const localProvider=(id:number)=>`local:${id}`;
export const isLocalProvider=(provider:string)=>provider.startsWith('local:');

export function storeDay(row:StoreSaleRow,store:StoreCosts|undefined):StoreDay|null {
  if(!store)return null;
  const revenue=Number(row.revenue||0),orders=Number(row.order_count||0);
  const known=row.product_cost===null||row.product_cost===undefined||row.product_cost===''?null:Number(row.product_cost);
  const productCost=known!==null&&Number.isFinite(known)?known:store.costPercent>0?revenue*store.costPercent/100:null;
  if(productCost===null)return null;
  const fees=revenue*store.feePercent/100,taxes=revenue*store.taxPercent/100;
  return {date:String(row.revenue_date),storeId:store.id,orders,revenue,productCost,fees,taxes,profit:revenue-productCost-fees-taxes};
}

export function splitStoreSales(rows:StoreSaleRow[],stores:StoreCosts[]) {
  const byId=new Map(stores.map(store=>[store.id,store]));
  const priced:StoreDay[]=[],unpriced:UnpricedDay[]=[];
  const channels=new Map<number,SalesChannelTotals&{label:string}>();
  for(const row of rows) {
    const storeId=row.store_id===null||row.store_id===undefined?null:Number(row.store_id);
    const day=storeId===null?null:storeDay(row,byId.get(storeId));
    if(!day){unpriced.push({date:String(row.revenue_date),storeId,orders:Number(row.order_count||0),revenue:Number(row.revenue||0)});continue;}
    priced.push(day);
    const store=byId.get(day.storeId)!;
    const channel=channels.get(store.id)||{...emptySalesChannel(localProvider(store.id)),label:store.name};
    channel.orders+=day.orders;channel.revenue+=day.revenue;channel.productCost+=day.productCost;channel.commissions+=day.fees;channel.taxes+=day.taxes;
    channel.completeOrders+=day.orders;channel.coveredProfit+=day.profit;
    channels.set(store.id,channel);
  }
  const totals=priced.reduce((sum,day)=>({orders:sum.orders+day.orders,revenue:sum.revenue+day.revenue,productCost:sum.productCost+day.productCost,fees:sum.fees+day.fees,taxes:sum.taxes+day.taxes,profit:sum.profit+day.profit}),{orders:0,revenue:0,productCost:0,fees:0,taxes:0,profit:0});
  return {priced,unpriced,channels:[...channels.values()],totals};
}
