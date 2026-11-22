// Ventas directas cargadas a mano (provider directa_<canal>). Igual que DIRECT_CHANNEL_LABELS de direct-sales.
const DIRECT_LABELS:Record<string,string>={directa_whatsapp:'WhatsApp',directa_instagram:'Instagram',directa_local:'Venta en local',directa_mayorista:'Mayorista',directa_feria:'Feria o evento',directa_otro:'Venta directa'};
export function salesChannelLabel(provider:string) {
  if(DIRECT_LABELS[provider])return DIRECT_LABELS[provider];
  return provider==='tiendanube'?'Tiendanube':provider==='mercadolibre'?'Mercado Libre':provider==='external'?'Facturación externa':'Otro canal';
}

export type SalesChannelTotals={provider:string;orders:number;revenue:number;productCost:number;shipping:number;commissions:number;taxes:number;additional:number;completeOrders:number;coveredProfit:number;refundLoss:number;refundPending:number;refundOrders:number};
export function emptySalesChannel(provider:string):SalesChannelTotals {
  return {provider,orders:0,revenue:0,productCost:0,shipping:0,commissions:0,taxes:0,additional:0,completeOrders:0,coveredProfit:0,refundLoss:0,refundPending:0,refundOrders:0};
}

// Never attribute Meta's spend to a sales channel without attribution data.
// It is deducted only in the combined dashboard result.
export function salesChannels(totals:Iterable<SalesChannelTotals>,integrations:Array<{provider:string;status:string}>) {
  const channels=new Map(Array.from(totals,row=>[row.provider,row]));
  for(const integration of integrations) {
    if(['tiendanube','mercadolibre'].includes(integration.provider)&&['authorized','connected'].includes(integration.status)&&!channels.has(integration.provider))channels.set(integration.provider,emptySalesChannel(integration.provider));
  }
  return [...channels.values()].map(row=>{
    const costCoverage=row.completeOrders===row.orders;
    // Incomplete orders must not hide the confirmed contribution of the rest,
    // or inflate it by assuming that an unknown cost is zero.
    return {...row,provider:row.provider,label:salesChannelLabel(row.provider),orders:row.orders,revenue:row.revenue,netRevenue:row.revenue-row.shipping-row.commissions-row.taxes,profit:costCoverage||row.completeOrders>0?row.coveredProfit-(row.refundLoss||0):null,aov:row.orders?row.revenue/row.orders:0,costCoverage,completeOrders:row.completeOrders,pendingOrders:row.orders-row.completeOrders};
  });
}

export function orderReturnNeedsReview(order:{payment_status:string}) {
  return ['refunded','partially_refunded','charged_back'].includes(order.payment_status);
}
