// Ganancia estimada por campaña. Las órdenes no traen la campaña que las generó, así que
// usamos las ventas que cada plataforma le atribuye y les aplicamos el margen real del
// canal (costos, envíos, comisiones e impuestos que Rentia ya conoce), menos la inversión.

export type ChannelMarginInput={revenue:number;orders:number;completeOrders:number;profit:number|null;profitBeforeAds?:number|null};
export type MetaCampaignInput={external_campaign_id:string;name:string;status:string|null;effective_status:string|null;spend:number;purchases:number;purchase_value:number;daily_budget?:number|null};
export type MeliCampaignInput={id:string;name:string;status:string;spend:number;attributedRevenue:number;units:number};
export type CampaignChannel='meta'|'mercadolibre';
// gana = rentable (ROAS 15 % o más arriba del equilibrio); limite = entre el equilibrio −5 % y +15 %.
export type CampaignVerdict='gana'|'limite'|'pierde'|'sin-margen';
export type CampaignProfitRow={key:string;channel:CampaignChannel;name:string;active:boolean;spend:number;revenue:number;roas:number;breakEvenRoas:number|null;margin:number|null;profit:number|null;verdict:CampaignVerdict;dailyBudget:number|null};

// Margen antes de publicidad sobre la facturación de las órdenes con costos completos.
// Sin órdenes completas no hay margen confiable y devolvemos null.
export function contributionRate(row:ChannelMarginInput|null|undefined):number|null {
  if(!row||!row.revenue||!row.orders||!row.completeOrders)return null;
  const before=row.profitBeforeAds??row.profit;
  if(before===null||before===undefined)return null;
  const coveredRevenue=row.revenue*Math.min(1,row.completeOrders/row.orders);
  return coveredRevenue>0?before/coveredRevenue:null;
}

// Estado de una campaña según cuánto se aleja su ROAS del ROAS de equilibrio.
export const LIMIT_ABOVE=1.15,LIMIT_BELOW=0.95;
function verdict(margin:number|null,spend:number,revenue:number):CampaignVerdict {
  if(margin===null||margin<=0)return margin===null?'sin-margen':'pierde';
  if(spend<=0)return 'gana';
  const ratio=(revenue/spend)*margin;
  return ratio>=LIMIT_ABOVE?'gana':ratio>=LIMIT_BELOW?'limite':'pierde';
}

function row(key:string,channel:CampaignChannel,name:string,active:boolean,spend:number,revenue:number,margin:number|null,dailyBudget:number|null=null):CampaignProfitRow {
  const profit=margin===null?null:revenue*margin-spend;
  return {key,channel,name,active,spend,revenue,roas:spend>0?revenue/spend:0,breakEvenRoas:margin&&margin>0?1/margin:null,margin,profit,verdict:verdict(margin,spend,revenue),dailyBudget:dailyBudget&&dailyBudget>0?dailyBudget:null};
}

export function campaignProfits(input:{meta?:MetaCampaignInput[];mercadolibre?:MeliCampaignInput[];metaMargin:number|null;meliMargin:number|null}):CampaignProfitRow[] {
  const rows:CampaignProfitRow[]=[];
  for(const campaign of input.meta||[]) {
    if(campaign.spend<=0&&campaign.purchase_value<=0)continue;
    rows.push(row(`meta:${campaign.external_campaign_id}`,'meta',campaign.name,(campaign.effective_status||campaign.status)==='ACTIVE',campaign.spend,campaign.purchase_value,input.metaMargin,campaign.daily_budget!=null?Number(campaign.daily_budget):null));
  }
  for(const campaign of input.mercadolibre||[]) {
    if(campaign.spend<=0&&campaign.attributedRevenue<=0)continue;
    rows.push(row(`mercadolibre:${campaign.id}`,'mercadolibre',campaign.name,/^active$/i.test(campaign.status),campaign.spend,campaign.attributedRevenue,input.meliMargin));
  }
  // Primero lo que más plata pierde, para que sea lo primero que se ve.
  return rows.sort((a,b)=>(a.profit??Number.POSITIVE_INFINITY)-(b.profit??Number.POSITIVE_INFINITY));
}

export function campaignTotals(rows:CampaignProfitRow[]) {
  const known=rows.filter(item=>item.profit!==null);
  return {
    spend:rows.reduce((sum,item)=>sum+item.spend,0),
    revenue:rows.reduce((sum,item)=>sum+item.revenue,0),
    profit:known.reduce((sum,item)=>sum+(item.profit||0),0),
    winners:rows.filter(item=>item.verdict==='gana').length,
    atLimit:rows.filter(item=>item.verdict==='limite').length,
    losers:rows.filter(item=>item.verdict==='pierde').length,
    lost:rows.filter(item=>item.verdict==='pierde').reduce((sum,item)=>sum+(item.profit||0),0),
    withoutMargin:rows.filter(item=>item.verdict==='sin-margen').length,
  };
}

// Márgenes para estimar campañas: Meta impulsa la tienda online (Tiendanube) y Product Ads
// a Mercado Libre. Si no hay datos del canal, Meta usa el margen general de la tienda.
type DashboardForMargins={metrics?:{revenue:number;profitBeforeAds:number}|null;channels?:Array<ChannelMarginInput&{provider:string}>;quality?:{completeOrders:number;totalOrders:number}|null};
export function campaignMargins(dashboard:DashboardForMargins|null|undefined) {
  const channel=(provider:string)=>dashboard?.channels?.find(row=>row.provider===provider);
  const overall=dashboard?.metrics&&dashboard.quality?contributionRate({revenue:dashboard.metrics.revenue,orders:dashboard.quality.totalOrders,completeOrders:dashboard.quality.completeOrders,profit:dashboard.metrics.profitBeforeAds}):null;
  return {meta:contributionRate(channel('tiendanube'))??overall,mercadolibre:contributionRate(channel('mercadolibre')),overall};
}

// ROAS de equilibrio de la marca (con el margen general antes de publicidad) contra el ROAS
// real: toda la facturación de la tienda dividida por toda la inversión publicitaria.
export function brandBreakEven(margin:number|null,revenue:number,adSpend:number) {
  return {breakEven:margin&&margin>0?1/margin:null,roas:adSpend>0?revenue/adSpend:null,margin};
}

// ROAS mínimo de cada producto: con su margen real antes de publicidad. Sirve para saber a qué
// productos conviene ponerles campaña. Se agrupan las variantes y se ordena por facturación.
type ProductMarginInput={provider:string;external_product_id:string;product_name:string;revenue:number;profit:number;units_sold:number;rentia_archived?:number;cost_source?:string};
export function productBreakEvens(rows:ProductMarginInput[],limit=6) {
  const products=new Map<string,{name:string;revenue:number;profit:number;units:number;complete:boolean}>();
  for(const row of rows){
    if(row.rentia_archived||row.units_sold<=0)continue;
    const key=`${row.provider}:${row.external_product_id}`,item=products.get(key)||{name:row.product_name,revenue:0,profit:0,units:0,complete:true};
    item.revenue+=Number(row.revenue||0);item.profit+=Number(row.profit||0);item.units+=Number(row.units_sold||0);
    if(row.cost_source==='sin_costo')item.complete=false;
    products.set(key,item);
  }
  return [...products.values()].filter(item=>item.revenue>0&&item.complete).sort((a,b)=>b.revenue-a.revenue).slice(0,limit)
    .map(item=>{const margin=item.profit/item.revenue;return {name:item.name,margin,breakEven:margin>0?1/margin:null,units:item.units};});
}
