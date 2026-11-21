// Simulador de lanzamiento: cuánto deja un producto nuevo (o un combo) antes de subirlo.
// Las tasas salen de las ventas reales del canal en los últimos 60 días: comisiones (que ya
// incluyen las cuotas que la tienda suele ofrecer), impuestos, otros costos variables y el envío
// promedio por orden. Lo que la persona carga: precio, costo, descuento y recargo por cuotas.

export type ChannelRates={commissionRate:number;taxRate:number;otherRate:number;shippingPerOrder:number;marginBeforeAds:number|null;orders:number};
export type ChannelInput={orders:number;revenue:number;commissions?:number;taxes?:number;additional?:number;shipping?:number;profitBeforeAds?:number|null};
export type SimulationInput={price:number;unitCost:number;discount:number;freeShipping:boolean;installmentSurcharge:number};

const rate=(value:number|undefined,revenue:number)=>revenue>0?Math.max(0,Number(value||0))/revenue:0;

export function channelRates(row:ChannelInput|null|undefined):ChannelRates|null {
  if(!row||row.orders<=0||row.revenue<=0)return null;
  return {
    commissionRate:rate(row.commissions,row.revenue),taxRate:rate(row.taxes,row.revenue),otherRate:rate(row.additional,row.revenue),
    shippingPerOrder:Math.max(0,Number(row.shipping||0))/row.orders,
    marginBeforeAds:row.profitBeforeAds===null||row.profitBeforeAds===undefined?null:row.profitBeforeAds/row.revenue,orders:row.orders,
  };
}

export function simulateLaunch(input:SimulationInput,rates:ChannelRates) {
  const price=Math.max(0,input.price)*(1-Math.min(0.95,Math.max(0,input.discount)/100));
  const commission=price*rates.commissionRate,installments=price*Math.max(0,input.installmentSurcharge)/100;
  const taxes=price*rates.taxRate,other=price*rates.otherRate;
  const shipping=input.freeShipping?rates.shippingPerOrder:0;
  const product=Math.max(0,input.unitCost);
  const profit=price-product-commission-installments-taxes-other-shipping;
  const margin=price>0?profit/price:null;
  return {
    price,profit,margin,
    maxCpa:profit>0?profit:0,
    breakEvenRoas:profit>0?price/profit:null,
    vsAverage:margin!==null&&rates.marginBeforeAds!==null?margin-rates.marginBeforeAds:null,
    lines:[
      {key:'product',label:'Costo del producto',amount:-product},
      {key:'commission',label:'Comisiones de plataforma y de pago',amount:-commission},
      ...(installments?[{key:'installments',label:'Recargo por cuotas sin interés',amount:-installments}]:[]),
      {key:'taxes',label:'Impuestos',amount:-taxes},
      ...(other?[{key:'other',label:'Otros costos variables',amount:-other}]:[]),
      ...(shipping?[{key:'shipping',label:'Envío gratis (promedio)',amount:-shipping}]:[]),
    ],
  };
}

// Precio de lista que hace falta para ganar un margen dado, con el mismo descuento y costos.
export function priceForMargin(target:number,input:SimulationInput,rates:ChannelRates):number|null {
  const keep=1-rates.commissionRate-rates.taxRate-rates.otherRate-Math.max(0,input.installmentSurcharge)/100-target;
  const discount=1-Math.min(0.95,Math.max(0,input.discount)/100);
  const fixed=Math.max(0,input.unitCost)+(input.freeShipping?rates.shippingPerOrder:0);
  return keep>0&&discount>0?Math.ceil(fixed/(keep*discount)/100)*100:null;
}
