import type { CampaignProfitRow } from './campaign-profit';

// Alertas del negocio: se calculan con los mismos datos que ve el panel, así que nunca
// contradicen al resumen. Los umbrales los configura cada tienda.

export type AlertSettings={marginMin:number;marginDrop:number;salesDrop:number;stockDays:number;campaignMinSpend:number;alertEmail:boolean;weeklyEmail:boolean};
export const defaultAlertSettings:AlertSettings={marginMin:10,marginDrop:5,salesDrop:30,stockDays:14,campaignMinSpend:0,alertEmail:false,weeklyEmail:false};

export type AlertKind='danger'|'warning'|'info'|'success';
export type BusinessAlert={id:string;kind:AlertKind;icon:string;title:string;detail:string;action:string;section:string};

type Metrics={revenue:number;profit:number;margin:number;orders:number};
type ProductInput={product_name:string;units_sold:number;profit:number;stock:number|null;days_stock:number|null};

export type AlertInput={
  metrics:Metrics|null;
  previous:Metrics|null;
  quality?:{completeOrders:number;totalOrders:number}|null;
  adsConnected:boolean;
  syncError?:boolean;
  products:ProductInput[];
  missingCosts:number;
  campaigns:CampaignProfitRow[];
  settings:AlertSettings;
  money:(value:number)=>string;
  // Proyección del mes: avisa si a este ritmo no se cubren los gastos fijos.
  cashflow?:{status:string;shortfall:number;perDay:number|null;monthName:string;elapsed:number}|null;
};

const pct=(value:number)=>`${value.toFixed(1).replace('.',',')}%`;
const order:Record<AlertKind,number>={danger:0,warning:1,info:2,success:3};

export function buildAlerts(input:AlertInput):BusinessAlert[] {
  const {metrics,previous,settings,money}=input;
  const alerts:BusinessAlert[]=[];
  const complete=!input.quality||input.quality.totalOrders===0||input.quality.completeOrders===input.quality.totalOrders;

  if(input.syncError)alerts.push({id:'sync',kind:'danger',icon:'!',title:'Una conexión necesita atención',detail:'La última sincronización falló. Los números pueden no incluir las ventas más recientes.',action:'Revisar integraciones',section:'integraciones'});
  if(input.missingCosts>0)alerts.push({id:'costs',kind:'danger',icon:'$',title:`${input.missingCosts} SKU sin costo`,detail:'La ganancia de las órdenes con estos productos puede estar sobreestimada.',action:'Completar costos',section:'costos'});

  const losingCampaigns=input.campaigns.filter(row=>row.verdict==='pierde'&&row.spend>=settings.campaignMinSpend);
  if(losingCampaigns.length) {
    const worst=losingCampaigns[0];
    const lost=losingCampaigns.reduce((sum,row)=>sum+(row.profit||0),0);
    alerts.push({id:'campaigns',kind:'danger',icon:'↘',title:`${losingCampaigns.length} campaña${losingCampaigns.length===1?' pierde':'s pierden'} plata`,detail:`En conjunto, ${money(Math.abs(lost))} estimados. La que más pierde es ${worst.name}: ${money(Math.abs(worst.profit||0))}.`,action:'Ver ganancia por campaña',section:'publicidad'});
  }

  const losingProducts=input.products.filter(row=>row.units_sold>0&&row.profit<0).sort((a,b)=>a.profit-b.profit);
  if(losingProducts.length)alerts.push({id:'products',kind:'danger',icon:'↓',title:`${losingProducts.length} producto${losingProducts.length===1?' pierde':'s pierden'} dinero`,detail:`El más urgente es ${losingProducts[0].product_name}: ${money(losingProducts[0].profit)} en el período.`,action:'Analizar productos',section:'productos'});

  if(metrics&&complete&&metrics.revenue>0&&metrics.margin<settings.marginMin)alerts.push({id:'margin-low',kind:'warning',icon:'%',title:`Margen de ${pct(metrics.margin)}`,detail:`Margen después de productos, envíos, comisiones y publicidad, antes de gastos fijos. Está por debajo del mínimo que configuraste (${pct(settings.marginMin)}).`,action:'Ver desglose',section:'resumen'});
  if(metrics&&previous&&complete&&previous.revenue>0&&metrics.revenue>0&&previous.margin-metrics.margin>=settings.marginDrop)alerts.push({id:'margin-drop',kind:'warning',icon:'%',title:`El margen bajó ${(previous.margin-metrics.margin).toFixed(1).replace('.',',')} puntos`,detail:`Pasó de ${pct(previous.margin)} a ${pct(metrics.margin)} respecto del período anterior.`,action:'Ver desglose',section:'resumen'});
  if(metrics&&previous&&previous.revenue>0) {
    const change=(metrics.revenue-previous.revenue)/previous.revenue*100;
    if(-change>=settings.salesDrop)alerts.push({id:'sales-drop',kind:'warning',icon:'↘',title:`Las ventas cayeron ${Math.abs(change).toFixed(0)}%`,detail:`Facturaste ${money(metrics.revenue)} contra ${money(previous.revenue)} del período anterior.`,action:'Ver órdenes',section:'ordenes'});
  }

  const lowStock=input.products.filter(row=>row.stock!==null&&row.units_sold>0&&(row.days_stock===null||row.days_stock<=settings.stockDays)).sort((a,b)=>(a.days_stock??0)-(b.days_stock??0));
  if(lowStock.length)alerts.push({id:'stock',kind:'warning',icon:'◈',title:`${lowStock.length} SKU requieren reposición`,detail:`${lowStock[0].product_name} tiene ${lowStock[0].stock||0} unidades y ${Math.max(0,lowStock[0].days_stock||0).toFixed(0)} días estimados de stock.`,action:'Revisar inventario',section:'inventario'});

  // Recién desde la segunda semana del mes, para no alarmar con pocos días de datos.
  if(input.cashflow&&input.cashflow.status==='en-riesgo'&&input.cashflow.elapsed>=7)alerts.push({id:'cashflow',kind:'warning',icon:'$',title:`A este ritmo no cubrís los gastos fijos de ${input.cashflow.monthName}`,detail:`Te faltarían ${money(input.cashflow.shortfall)}.${input.cashflow.perDay?` Necesitás vender ${money(input.cashflow.perDay)} por día.`:''}`,action:'Ver cashflow',section:'cashflow'});

  if(!input.adsConnected)alerts.push({id:'ads',kind:'info',icon:'∞',title:'Meta Ads todavía no está conectado',detail:'Conectalo para ver qué campañas dejan ganancia y cuáles la pierden.',action:'Conectar Meta',section:'integraciones'});

  return alerts.sort((a,b)=>order[a.kind]-order[b.kind]);
}

export function urgentAlerts(alerts:BusinessAlert[]) {
  return alerts.filter(alert=>alert.kind==='danger'||alert.kind==='warning');
}

// Clave de una alerta para marcarla como vista: incluye el título, que trae las cifras, así
// que si la situación cambia (por ejemplo, de 3 a 4 campañas) vuelve a aparecer como nueva.
export function alertKey(alert:BusinessAlert) {
  return `${alert.id}:${alert.title}`.slice(0,300);
}
