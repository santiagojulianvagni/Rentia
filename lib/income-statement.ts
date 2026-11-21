// Estado de resultados mensual. Usa los mismos números que el dashboard, así que el resultado
// neto coincide exactamente con la ganancia del panel para ese mes.

export type StatementMetrics={revenue:number;refundLoss?:number;productCost:number;shipping:number;commissions:number;taxes:number;additional:number;profitBeforeAds:number;totalAdSpend?:number;fixedCosts?:number;profit:number;externalRevenue?:number;orders?:number};
export type StatementLine={key:string;label:string;amount:number;kind:'income'|'cost'|'subtotal'|'total'};

export function incomeStatement(m:StatementMetrics):StatementLine[] {
  const refunds=m.refundLoss||0,ads=m.totalAdSpend||0,fixed=m.fixedCosts||0;
  const gross=m.revenue-refunds-m.productCost;
  const lines:StatementLine[]=[
    {key:'revenue',label:'Facturación',amount:m.revenue,kind:'income'},
    {key:'refunds',label:'Reembolsos y devoluciones',amount:-refunds,kind:'cost'},
    {key:'productCost',label:'Costo de productos',amount:-m.productCost,kind:'cost'},
    {key:'gross',label:'Margen bruto',amount:gross,kind:'subtotal'},
    {key:'shipping',label:'Envíos',amount:-m.shipping,kind:'cost'},
    {key:'commissions',label:'Comisiones de plataforma y de pago',amount:-m.commissions,kind:'cost'},
    {key:'taxes',label:'Impuestos',amount:-m.taxes,kind:'cost'},
    {key:'additional',label:'Otros costos variables',amount:-m.additional,kind:'cost'},
    {key:'beforeAds',label:'Margen antes de publicidad',amount:m.profitBeforeAds,kind:'subtotal'},
    {key:'ads',label:'Publicidad',amount:-ads,kind:'cost'},
    {key:'contribution',label:'Margen de contribución',amount:m.profitBeforeAds-ads,kind:'subtotal'},
    {key:'fixed',label:'Costos fijos',amount:-fixed,kind:'cost'},
    {key:'net',label:'Resultado neto',amount:m.profit,kind:'total'},
  ];
  // Las líneas en cero que no suelen aplicar (reembolsos, otros costos) no se muestran.
  return lines.filter(line=>line.amount!==0||!['refunds','additional'].includes(line.key));
}

export const share=(amount:number,revenue:number)=>revenue>0?Math.abs(amount)/revenue:null;

// Meses para elegir: el actual y los 11 anteriores (AAAA-MM), del más nuevo al más viejo.
export function recentMonths(current:string,count=12) {
  const [year,month]=current.split('-').map(Number);
  return Array.from({length:count},(_,index)=>{const date=new Date(Date.UTC(year,month-1-index,1));return date.toISOString().slice(0,7);});
}

// Rango de días de un mes, sin pasar de hoy.
export function monthRange(month:string,today:string) {
  const [year,index]=month.split('-').map(Number);
  const last=new Date(Date.UTC(year,index,0)).toISOString().slice(0,10);
  return {start:`${month}-01`,end:last>today?today:last};
}

export const previousMonth=(month:string)=>{const [year,index]=month.split('-').map(Number);return new Date(Date.UTC(year,index-2,1)).toISOString().slice(0,7);};
