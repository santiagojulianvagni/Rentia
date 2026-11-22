// Ventas directas: las que cierra la tienda fuera de sus canales conectados (WhatsApp, Instagram,
// en el local, por mayor, en una feria) y carga a mano en Rentia. Cada canal es un "provider"
// propio de las órdenes (directa_whatsapp, directa_instagram…), así entra en el resumen como uno más.

export const DIRECT_CHANNELS=['whatsapp','instagram','local','mayorista','feria','otro'] as const;
export type DirectChannel=typeof DIRECT_CHANNELS[number];
export const DIRECT_CHANNEL_LABELS:Record<DirectChannel,string>={whatsapp:'WhatsApp',instagram:'Instagram',local:'Venta en local',mayorista:'Mayorista',feria:'Feria o evento',otro:'Venta directa'};

export const DIRECT_PAYMENTS=['transferencia','efectivo','mercadopago','tarjeta'] as const;
export type DirectPayment=typeof DIRECT_PAYMENTS[number];
export const DIRECT_PAYMENT_LABELS:Record<DirectPayment,string>={transferencia:'Transferencia',efectivo:'Efectivo',mercadopago:'Mercado Pago',tarjeta:'Tarjeta'};
// Con transferencia o efectivo no hay comisión de cobro.
export const paymentHasFee=(payment:DirectPayment)=>payment==='mercadopago'||payment==='tarjeta';

export const directProvider=(channel:DirectChannel)=>`directa_${channel}`;
export const isDirectProvider=(provider:string)=>provider.startsWith('directa_');
export function directChannelOf(provider:string):DirectChannel|null {
  const channel=provider.slice(8);
  return isDirectProvider(provider)&&(DIRECT_CHANNELS as readonly string[]).includes(channel)?channel as DirectChannel:null;
}

// Ganancia de una venta antes de guardarla: lo cobrado menos productos, envío, comisión e impuestos.
export function directSaleProfit(input:{total:number;productCost:number;shipping:number;commission:number;taxPercent:number}) {
  const taxes=input.total*Math.max(0,input.taxPercent)/100;
  const profit=input.total-input.productCost-input.shipping-input.commission-taxes;
  return {taxes,profit,margin:input.total>0?profit/input.total*100:0};
}
