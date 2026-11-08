'use client';

// Panel de Rentia: tipos, preferencias, helpers y componentes chicos que usan varias secciones.
import type { MeliPostSale } from '../../lib/meli-post-sale';
import { type ProductAdsData } from '../../components/product-ads';
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Repeat, CalendarHeart, ShoppingBasket, Store, CalendarRange, Wallet, RefreshCw, ArrowLeftRight, BadgeDollarSign, Boxes, CreditCard, FileChartColumn, LayoutDashboard, Megaphone, PackageSearch, PlugZap, ShieldCheck, ShoppingCart, SlidersHorizontal, Sparkles, UsersRound, X, type LucideIcon } from 'lucide-react';
import type { ProductCostRow } from '../../components/product-costs';
import ThemedSelect from '../../components/themed-select';
import HelpPopover from '../../components/term-help';
import type { RentiaPlan } from '../../lib/plans';
import dynamic from 'next/dynamic';

export const sectionLoading=()=><div className="p-empty" role="status">Cargando…</div>;
export const PlanConfigurator=dynamic(()=>import('../../components/plan-configurator'),{loading:sectionLoading});
export const ConfirmPlanDialog=dynamic(()=>import('../../components/panel/subscription-dialogs').then(module=>module.ConfirmPlanDialog));
export const CancelSubscriptionDialog=dynamic(()=>import('../../components/panel/subscription-dialogs').then(module=>module.CancelSubscriptionDialog));
export const ProductCosts=dynamic(()=>import('../../components/product-costs'),{loading:sectionLoading});
export const PhysicalStores=dynamic(()=>import('../../components/panel/physical-stores'),{loading:sectionLoading});
export const MeliBilling=dynamic(()=>import('../../components/meli-billing'),{loading:sectionLoading});
export const ShippingCommissionSettings=dynamic(()=>import('../../components/shipping-commission-settings'),{loading:sectionLoading});
export const ExchangeRateSettings=dynamic(()=>import('../../components/exchange-rate-settings'),{loading:sectionLoading});
export const Cashflow=dynamic(()=>import('../../components/panel/cashflow'),{loading:sectionLoading});
export const WeeklySummary=dynamic(()=>import('../../components/panel/weekly-summary'),{loading:sectionLoading});
export const UtmTools=dynamic(()=>import('../../components/panel/utm-tools'),{loading:sectionLoading});
export const CategorySummary=dynamic(()=>import('../../components/panel/category-summary'));
export const AbandonedCarts=dynamic(()=>import('../../components/panel/abandoned-carts'),{loading:sectionLoading});
export const LifetimeValue=dynamic(()=>import('../../components/panel/lifetime'),{loading:sectionLoading});
export const Customers=dynamic(()=>import('../../components/panel/customers'),{loading:sectionLoading});
export const SalesEvents=dynamic(()=>import('../../components/panel/sales-events'),{loading:sectionLoading});
export const CampaignProfit=dynamic(()=>import('../../components/panel/campaign-profit'),{loading:sectionLoading});
export const AlertSettingsCard=dynamic(()=>import('../../components/panel/alert-settings'));
export const ShareDialog=dynamic(()=>import('../../components/panel/share-card'));

export type NavItem={id:string;label:string;icon:LucideIcon;badge?:string};
export const overviewSections:NavItem[]=[
  {id:'resumen',label:'Dashboard',icon:LayoutDashboard},
  {id:'semanal',label:'Resumen semanal',icon:CalendarRange},
  {id:'eventos',label:'Eventos',icon:CalendarHeart},
  {id:'cashflow',label:'Cashflow',icon:Wallet},
  {id:'acciones',label:'Acciones',icon:Sparkles},
  {id:'calidad',label:'Calidad de datos',icon:ShieldCheck},
  {id:'informes',label:'Informes',icon:FileChartColumn},
];
export const operationSections:NavItem[]=[
  {id:'ordenes',label:'Órdenes',icon:ShoppingCart},
  {id:'carritos',label:'Carritos abandonados',icon:ShoppingBasket},
  {id:'productos',label:'Productos',icon:PackageSearch},
  {id:'inventario',label:'Inventario',icon:Boxes},
  {id:'clientes',label:'Clientes',icon:UsersRound},
  {id:'lifetime',label:'Lifetime Value',icon:Repeat},
  {id:'publicidad',label:'Publicidad',icon:Megaphone},
];
export const configurationSections:NavItem[]=[
  {id:'integraciones',label:'Integraciones',icon:PlugZap},
  {id:'cargos-meli',label:'Cargos de Mercado Libre',icon:FileChartColumn},
  {id:'equipo',label:'Equipo',icon:UsersRound},
  {id:'costos',label:'Costo de productos',icon:BadgeDollarSign},
  {id:'configuracion',label:'Envíos y comisiones',icon:SlidersHorizontal},
  {id:'facturacion',label:'Otros canales',icon:Store},
  {id:'moneda',label:'Cotización dólar',icon:ArrowLeftRight},
  {id:'plan',label:'Plan y facturación',icon:CreditCard},
];
export const sections=[...overviewSections,...operationSections,...configurationSections];
export const periodOptions=[{label:'7 días',days:7},{label:'30 días',days:30},{label:'90 días',days:90},{label:'365 días',days:365}];
export type Integration={provider:string;external_store_id:string;scopes:string;status:string;connected_at:string};
export type OrderItem={external_product_id?:string;external_variant_id?:string;external_line_id:string;name:string;sku:string|null;quantity:number;unit_price:number;unit_cost:number;cost_source:'manual'|'tiendanube'|'orden'|'orden_manual'|'publicacion'|'sin_costo'};
export type OrderRow={refund_adjustment?:import('../../lib/refund-adjustment').RefundAdjustment|null;refund_loss?:number|null;post_sale?:MeliPostSale|null;provider:string;external_order_id:string;order_number:string|null;currency:string;status:string;payment_status:string;payment_method:string|null;shipping_status:string|null;source_shipping_cost:number|null;source_commission_cost:number|null;manual_commission_cost:number|null;total:number;source_created_at:string;product_cost:number;shipping_cost:number;shipping_source:string;commission_cost:number;commission_source:string;commission_missing_reason:string|null;tax_cost:number;additional_cost:number;profit:number;margin:number;items:OrderItem[]};
export type ProductRow={external_product_id:string;name:string;image_url:string|null;published:number;variants:number;stock:number;min_cost:number;min_price:number};
export type ProductAnalyticsRow={categories?:string|null;product_id:number;rentia_archived:number;variant_id:number;provider:string;external_product_id:string;external_variant_id:string;sku:string|null;price:number;effective_cost:number;stock:number|null;product_name:string;image_url:string|null;cost_source:'manual'|'tiendanube'|'sin_costo';units_sold:number;orders:number;revenue:number;product_cost:number;shipping_cost:number;commission_cost:number;commission_pending:boolean;commission_estimated:boolean;tax_cost:number;additional_cost:number;total_costs:number;profit:number;margin:number;sales_per_day:number;days_stock:number|null;currency:string};
export type TimelinePoint={date:string;orders:number;storeRevenue:number;externalRevenue:number;profit:number;adSpend:number;operatingCosts:number};
export type ChannelRow={refundLoss?:number;refundPending?:number;refundOrders?:number;profitBeforeAds?:number|null;adSpend?:number;adsCoverage?:boolean;productCost?:number;shipping?:number;commissions?:number;taxes?:number;additional?:number;provider:string;label:string;orders:number;revenue:number;netRevenue:number;profit:number|null;aov:number;costCoverage:boolean;completeOrders:number;pendingOrders:number};
export type ExchangeRate={rate_type:string;base_rate:number;adjustment_percent:number;effective_rate:number;updated_at:string|null};
export type QualityDimension={complete:number;total:number;missing:number;percent:number};
export type DataQuality={postSale?:{refundLoss?:number;refundPending?:number;claimsUnchecked?:number;openClaims:number;refundOrders:number;orders:Array<{provider:string;externalOrderId:string;date:string;total:number;currency:string;refundAmount:number|null;state:string}>};score:number;status:'empty'|'excellent'|'good'|'warning'|'critical';totalOrders:number;completeOrders:number;coveredRevenue:number;coveredProfit:number;configurationSaved:boolean;dimensions:{products:QualityDimension;shipping:QualityDimension;commissions:QualityDimension;taxes:QualityDimension};incompleteOrders:Array<{provider?:string;externalOrderId:string;orderNumber:string|null;date:string;total:number;currency:string;missing:string[]}>};
export type SyncReliability={events:{total:number;processed:number;failed:number;pending:number;lastReceivedAt:string|null;lastProcessedAt:string|null};lastReconciliation:{trigger_source?:string;status?:string;started_at?:string;completed_at?:string;error?:string|null}|null};
export type SyncState=null|{status:string;last_started_at:string|null;last_completed_at:string|null;last_error:string|null;orders_synced:number;products_synced:number;details_version:number;webhook_status:string;last_webhook_at:string|null;webhooks_registered_at:string|null;webhook_error:string|null;reliability?:SyncReliability};
export type MetaAccount={external_account_id:string;name:string;currency:string;timezone_name:string|null;account_status:number;selected:number;synced_at:string};
export type MetaCampaign={external_campaign_id:string;name:string;status:string|null;effective_status:string|null;daily_budget:number;lifetime_budget:number;spend:number;impressions:number;clicks:number;purchases:number;purchase_value:number;reported_roas:number;cpa:number};
export type MetaAdsData={accounts:MetaAccount[];selected:MetaAccount|null;sync:SyncState;summary:{spend:number;impressions:number;clicks:number;purchases:number;purchaseValue:number;reportedRoas:number;cpa:number;ctr:number;cpc:number};campaigns:MetaCampaign[];daily:Array<{date:string;spend:number;impressions:number;clicks:number;purchases:number;purchase_value:number}>};
export type Dashboard={historyFrom?:string|null;meliAds?:ProductAdsData;metrics:{refundLoss?:number;meliAdSpend?:number;totalAdSpend?:number;meliAdsComparable?:boolean;revenue:number;externalRevenue:number;totalRevenue:number;profitBeforeAds:number;profit:number;margin:number;orders:number;externalOrders:number;totalOrders:number;aov:number;totalAov:number;netRevenue:number;productCost:number;shipping:number;commissions:number;taxes:number;additional:number;fixedCosts?:number;marginBeforeFixed?:number;adSpend:number;metaReportedRevenue:number;metaPurchases:number;reportedRoas:number;blendedRoas:number;cpa:number;adSpendComparable:boolean;metaCurrency:string};ads:{connected:boolean;selected:MetaAccount|null;sync:SyncState};integrations?:{tiendanube?:{paymentAccess:boolean}};orders:OrderRow[];paymentMethods?:string[];products:ProductRow[];metaTimeline?:TimelinePoint[];timeline:TimelinePoint[];channelTimelines?:Record<string,TimelinePoint[]>;channels:ChannelRow[];exchangeRate:ExchangeRate|null;sync:SyncState;quality:DataQuality};
export type CostRule={due_day?:number|null;id:number;category:'commission'|'additional';name:string;match_value:string|null;calculation:'hybrid'|'fixed_monthly'|'percentage_revenue';amount:number;percentage:number;starts_at:string|null;ends_at:string|null;enabled:number};
export type SubscriptionPlan=RentiaPlan;
export type SubscriptionData={emails?:Array<{kind:string;sentAt:string}>;checkoutEnabled?:boolean;testMode?:boolean;payerEmail?:string;payments?:Array<{id:string;amount:number;currency:string;status:string;paidAt:string}>;subscription:{planId:string;requestedPlanId:string|null;status:string;billingCycle:string;trialEndsAt:string;trialDaysRemaining:number;currentPeriodEnd?:string|null;cancelAtPeriodEnd?:boolean;canceledAt?:string|null;termsAcceptedAt?:string|null;providerStatus?:string|null;pastDueSince?:string|null;providerAmount?:number|null;complimentary?:boolean};usage:{orders:number;limit:number|null;percent:number};currentPlan:SubscriptionPlan;recommendation:SubscriptionPlan;plans:SubscriptionPlan[];billingEnabled:boolean;canManage:boolean;message?:string;quota?:OrderQuota};
export type OrderQuota={enforced:boolean;month:string;limit:number|null;used:number;skippedThisMonth:number;skippedTotal:number};

export type DisplayCurrency='ARS'|'USD'|'EUR';
export type DisplayLanguage='es'|'pt'|'en';
export type CustomDateRange={start:string;end:string};
export type DashboardMetricKey='orders'|'totalRevenue'|'netRevenue'|'profit'|'margin'|'aov'|'adSpend'|'roas'|'cpa'|'productCost'|'shipping'|'commissions'|'externalRevenue'|'tnOrders'|'tnRevenue'|'tnNetRevenue'|'tnProfit'|'tnAov'|'metaSpend'|'metaRevenue'|'metaRoas'|'metaCpa'|'mlOrders'|'mlRevenue'|'mlNetRevenue'|'mlProfit'|'mlAov';
export type DashboardChannel='combined'|'tiendanube'|'meta'|'mercadolibre'|'custom';
export type DashboardChartType='area'|'line'|'bar';
export type DashboardLayoutSection={id:string;title:string;metrics:DashboardMetricKey[];channel?:DashboardChannel};
export type DashboardLayoutConfig={version:2;sections:DashboardLayoutSection[];chart:{type:DashboardChartType;metric:ChartMetric}};
export const dashboardMetricKeys:DashboardMetricKey[]=['orders','totalRevenue','netRevenue','profit','margin','aov','adSpend','roas','cpa','productCost','shipping','commissions','externalRevenue','tnOrders','tnRevenue','tnNetRevenue','tnProfit','tnAov','metaSpend','metaRevenue','metaRoas','metaCpa','mlOrders','mlRevenue','mlNetRevenue','mlProfit','mlAov'];
export const dashboardPresets:Record<'profitability'|'advertising'|'operation',DashboardLayoutConfig>={
  profitability:{version:2,sections:[{id:'profitability',title:'Rentabilidad 360',channel:'combined',metrics:['totalRevenue','netRevenue','profit','margin','productCost','shipping','commissions','adSpend']}],chart:{type:'area',metric:'profit'}},
  advertising:{version:2,sections:[{id:'advertising',title:'Publicidad y crecimiento',channel:'combined',metrics:['adSpend','roas','cpa','totalRevenue','profit','margin']},{id:'meta',title:'Meta Ads',channel:'meta',metrics:['metaSpend','metaRevenue','metaRoas','metaCpa']}],chart:{type:'area',metric:'adSpend'}},
  operation:{version:2,sections:[{id:'operation',title:'Operación',channel:'combined',metrics:['orders','totalRevenue','aov','netRevenue','shipping','externalRevenue']},{id:'tiendanube',title:'Tiendanube',channel:'tiendanube',metrics:['tnOrders','tnRevenue','tnNetRevenue','tnProfit','tnAov']},{id:'mercadolibre',title:'Mercado Libre',channel:'mercadolibre',metrics:['mlOrders','mlRevenue','mlNetRevenue','mlProfit','mlAov']}],chart:{type:'area',metric:'revenue'}},
};
export const defaultDashboardLayout:DashboardLayoutConfig={version:2,sections:[
  {id:'main',title:'Rentia 360',channel:'combined',metrics:['orders','totalRevenue','netRevenue','profit','margin','aov','adSpend','roas']},
  {id:'tiendanube',title:'Tiendanube',channel:'tiendanube',metrics:['tnOrders','tnRevenue','tnNetRevenue','tnProfit','tnAov']},
  {id:'meta',title:'Meta Ads',channel:'meta',metrics:['metaSpend','metaRevenue','metaRoas','metaCpa']},
  {id:'mercadolibre',title:'Mercado Libre',channel:'mercadolibre',metrics:['mlOrders','mlRevenue','mlNetRevenue','mlProfit','mlAov']},
],chart:{type:'area',metric:'revenue'}};
export type ExchangeRates={ARS:number;USD?:number;EUR?:number};
export type Preferences={currency:DisplayCurrency;language:DisplayLanguage;rates:ExchangeRates;rateSource:string;setCurrency:(value:DisplayCurrency)=>void;setLanguage:(value:DisplayLanguage)=>void;refreshRates:()=>Promise<void>};
export const PreferencesContext=createContext<Preferences>({currency:'ARS',language:'es',rates:{ARS:1},rateSource:'',setCurrency:()=>undefined,setLanguage:()=>undefined,refreshRates:async()=>undefined});
export const locales:Record<DisplayLanguage,string>={es:'es-AR',pt:'pt-BR',en:'en-US'};
export const translations:Record<DisplayLanguage,Record<string,string>>={
  es:{},
  pt:{
    'Comprobando conexiones…':'Verificando conexões…','Sin conexiones':'Sem conexões','Revisar conexiones':'Revisar conexões','Importación en pausa':'Importação pausada','Importando historial…':'Importando histórico…','Actualización pendiente':'Atualização pendente','Datos al día':'Dados atualizados','Ver conexiones':'Ver conexões',
    'Dashboard':'Painel','Acciones':'Ações','Calidad de datos':'Qualidade dos dados','Informes':'Relatórios','Órdenes':'Pedidos','Productos':'Produtos','Inventario':'Estoque','Integraciones':'Integrações','Costo de productos':'Custo dos produtos','Envíos y comisiones':'Envios e comissões','Facturación externa':'Faturamento externo','Clientes':'Clientes','Carritos abandonados':'Carrinhos abandonados','Otros canales':'Outros canais','Eventos':'Eventos','Cotización dólar':'Cotação do dólar','Configuración':'Configurações','RESUMEN':'VISÃO GERAL','OPERACIÓN':'OPERAÇÃO','PRÓX.':'EM BREVE','Sincronización automática':'Sincronização automática','Sincronización en revisión':'Sincronização em revisão','Cuenta Rentia':'Conta Rentia','Cerrar sesión':'Sair','Últimos':'Últimos','Trimestre':'Trimestre','Año':'Ano','7 días':'7 dias','30 días':'30 dias','90 días':'90 dias','365 días':'365 dias','Personalizado':'Personalizado','Rango personalizado':'Período personalizado','Desde':'De','Hasta':'Até','Cancelar':'Cancelar','Aplicar':'Aplicar','MÉTRICAS PRINCIPALES':'MÉTRICAS PRINCIPAIS','Tu operación, en un solo lugar':'Sua operação em um só lugar','La ganancia es provisoria cuando faltan costos. La facturación externa se muestra separada porque no conocemos su rentabilidad.':'O lucro é provisório quando faltam custos. O faturamento externo aparece separado porque não conhecemos sua rentabilidade.','＋ Cargar facturación externa':'＋ Adicionar faturamento externo','Ventas de otros canales':'Vendas de outros canais','La ganancia es provisoria cuando faltan costos. Las ventas de otros canales sin costo cargado se muestran aparte.':'O lucro é provisório quando faltam custos. As vendas de outros canais sem custo cadastrado aparecem separadas.','Órdenes totales':'Pedidos totais','Facturación total':'Faturamento total','Facturación neta tienda':'Faturamento líquido da loja','Ganancia conocida':'Lucro conhecido','Margen real':'Margem real','Ticket promedio':'Ticket médio','Inversión publicitaria':'Investimento em anúncios','ROAS global / Meta':'ROAS global / Meta','Cargando':'Carregando','Disponible al conectar Meta':'Disponível ao conectar a Meta','Sin datos inventados':'Sem dados estimados','Facturación vs. ganancia':'Faturamento vs. lucro','Comparación real del período':'Comparação real do período','Facturación':'Faturamento','Ganancia':'Lucro','Cuenta real':'Conta real','CUENTA REAL':'CONTA REAL','Desglose de rentabilidad':'Detalhamento da rentabilidade','Facturación tienda':'Faturamento da loja','Envíos':'Envios','Comisiones':'Comissões','Impuestos':'Impostos','Costos adicionales':'Custos adicionais','Ganancia después de Ads':'Lucro após anúncios','Analizar publicidad':'Analisar publicidade','Configurar costos':'Configurar custos','VOLUMEN DE VENTAS':'VOLUME DE VENDAS','de ticket promedio':'de ticket médio','Todavía no hay ventas en este período.':'Ainda não há vendas neste período.','Conectá Meta para completar este análisis':'Conecte a Meta para completar esta análise','La inversión aparecerá al sincronizar Meta Ads.':'O investimento aparecerá ao sincronizar a Meta Ads.','CANALES DE VENTA':'CANAIS DE VENDA','Rendimiento por origen':'Desempenho por origem','Administrar conexiones →':'Gerenciar conexões →','Canal':'Canal','Facturación neta':'Faturamento líquido','Costos aplicados':'Custos aplicados','Rentabilidad pendiente':'Rentabilidade pendente','ACTIVIDAD RECIENTE':'ATIVIDADE RECENTE','Últimas ventas':'Últimas vendas','Ver todas →':'Ver todas →','Todavía no hay órdenes importadas.':'Ainda não há pedidos importados.','Comparando períodos…':'Comparando períodos…','• Sin cambios':'• Sem alterações','— Sin historial anterior':'— Sem histórico anterior','vs. período anterior':'vs. período anterior','Publicidad':'Publicidade','Conectá tu tienda para empezar':'Conecte sua loja para começar','Conectar canal →':'Conectar canal →','Tiendanube conectada':'Tiendanube conectada','Actualizar ahora':'Atualizar agora','Sincronizando…':'Sincronizando…'},
  en:{
    'Comprobando conexiones…':'Checking connections…','Sin conexiones':'No connections','Revisar conexiones':'Review connections','Importación en pausa':'Import paused','Importando historial…':'Importing history…','Actualización pendiente':'Update pending','Datos al día':'Data up to date','Ver conexiones':'View connections',
    'Dashboard':'Dashboard','Acciones':'Actions','Calidad de datos':'Data quality','Informes':'Reports','Órdenes':'Orders','Productos':'Products','Inventario':'Inventory','Integraciones':'Integrations','Costo de productos':'Product costs','Envíos y comisiones':'Shipping and fees','Facturación externa':'External revenue','Clientes':'Customers','Carritos abandonados':'Abandoned carts','Otros canales':'Other channels','Eventos':'Events','Cotización dólar':'Exchange rate','Configuración':'Settings','RESUMEN':'OVERVIEW','OPERACIÓN':'OPERATIONS','PRÓX.':'SOON','Sincronización automática':'Automatic sync','Sincronización en revisión':'Sync under review','Cuenta Rentia':'Rentia account','Cerrar sesión':'Sign out','Últimos':'Last','Trimestre':'Quarter','Año':'Year','7 días':'7 days','30 días':'30 days','90 días':'90 days','365 días':'365 days','Personalizado':'Custom','Rango personalizado':'Custom date range','Desde':'From','Hasta':'To','Cancelar':'Cancel','Aplicar':'Apply','MÉTRICAS PRINCIPALES':'KEY METRICS','Tu operación, en un solo lugar':'Your operation in one place','La ganancia es provisoria cuando faltan costos. La facturación externa se muestra separada porque no conocemos su rentabilidad.':'Profit is provisional when costs are missing. External revenue is shown separately because its profitability is unknown.','＋ Cargar facturación externa':'＋ Add external revenue','Ventas de otros canales':'Other channel sales','La ganancia es provisoria cuando faltan costos. Las ventas de otros canales sin costo cargado se muestran aparte.':'Profit is provisional when costs are missing. Sales from other channels without a cost are shown separately.','Órdenes totales':'Total orders','Facturación total':'Total revenue','Facturación neta tienda':'Net store revenue','Ganancia conocida':'Known profit','Margen real':'Real margin','Ticket promedio':'Average order value','Inversión publicitaria':'Ad spend','ROAS global / Meta':'Global / Meta ROAS','Cargando':'Loading','Disponible al conectar Meta':'Available after connecting Meta','Sin datos inventados':'No estimated data','Facturación vs. ganancia':'Revenue vs. profit','Comparación real del período':'Actual period comparison','Facturación':'Revenue','Ganancia':'Profit','Cuenta real':'Real account','CUENTA REAL':'REAL ACCOUNT','Desglose de rentabilidad':'Profitability breakdown','Facturación tienda':'Store revenue','Envíos':'Shipping','Comisiones':'Fees','Impuestos':'Taxes','Costos adicionales':'Additional costs','Ganancia después de Ads':'Profit after ads','Analizar publicidad':'Analyze advertising','Configurar costos':'Configure costs','VOLUMEN DE VENTAS':'SALES VOLUME','de ticket promedio':'average order value','Todavía no hay ventas en este período.':'There are no sales in this period yet.','Conectá Meta para completar este análisis':'Connect Meta to complete this analysis','La inversión aparecerá al sincronizar Meta Ads.':'Ad spend will appear after syncing Meta Ads.','CANALES DE VENTA':'SALES CHANNELS','Rendimiento por origen':'Performance by source','Administrar conexiones →':'Manage connections →','Canal':'Channel','Facturación neta':'Net revenue','Costos aplicados':'Costs applied','Rentabilidad pendiente':'Profitability pending','ACTIVIDAD RECIENTE':'RECENT ACTIVITY','Últimas ventas':'Latest sales','Ver todas →':'View all →','Todavía no hay órdenes importadas.':'There are no imported orders yet.','Comparando períodos…':'Comparing periods…','• Sin cambios':'• No change','— Sin historial anterior':'— No previous history','vs. período anterior':'vs. previous period','Publicidad':'Advertising','Conectá tu tienda para empezar':'Connect your store to get started','Conectar canal →':'Connect channel →','Tiendanube conectada':'Tiendanube connected','Actualizar ahora':'Update now','Sincronizando…':'Syncing…'}
};

export const AccessContext=createContext(false);
export function usePreferences(){return useContext(PreferencesContext)}
export function useT(){
  const {language}=usePreferences();
  return (value:string)=>translations[language][value]||value;
}
export function useMoney(){
  const {currency:displayCurrency,language,rates}=usePreferences();
  return useMemo(()=>(value:number,sourceCurrency='ARS')=>{
    const normalizedSource=sourceCurrency.toUpperCase() as DisplayCurrency;
    const sourceRate=rates[normalizedSource];
    const targetRate=rates[displayCurrency];
    const canConvert=Boolean(sourceRate&&targetRate);
    const outputCurrency=canConvert?displayCurrency:normalizedSource;
    const converted=canConvert?(value||0)*(sourceRate||1)/(targetRate||1):(value||0);
    return new Intl.NumberFormat(locales[language],{style:'currency',currency:outputCurrency,maximumFractionDigits:displayCurrency==='ARS'?0:2}).format(converted);
  },[displayCurrency,language,rates]);
}
export function analyticsQuery(days:number,range:CustomDateRange|null) { return range?`start=${range.start}&end=${range.end}`:`days=${days}`; }
export function inclusiveRangeDays(range:CustomDateRange) { return Math.floor((new Date(`${range.end}T00:00:00Z`).getTime()-new Date(`${range.start}T00:00:00Z`).getTime())/(24*60*60*1000))+1; }
export function previousDateRange(range:CustomDateRange) {
  const days=inclusiveRangeDays(range);
  const end=new Date(`${range.start}T00:00:00Z`);end.setUTCDate(end.getUTCDate()-1);
  const start=new Date(end);start.setUTCDate(start.getUTCDate()-days+1);
  return {start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)};
}
export function defaultDateRange():CustomDateRange {
  const end=new Date();const start=new Date();start.setDate(start.getDate()-29);
  return {start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)};
}
export function date(value:string) { return new Intl.DateTimeFormat('es-AR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(value)); }
export function parseCost(value:string) { return Number(value.trim().replace(',','.')); }
export function sourceLabel(source:ProductCostRow['cost_source']|OrderItem['cost_source']) { return source==='orden_manual'?'Manual de esta venta':source==='publicacion'?'Catálogo de esta publicación (variante histórica)':source==='manual'?'Manual':source==='tiendanube'?'Tiendanube':source==='orden'?'Orden':'Sin costo'; }
export function csvCell(value:string|number) { const raw=String(value??'');const text=typeof value==='string'&&/^[=+@-]/.test(raw)?`'${raw}`:raw; return `"${text.replace(/"/g,'""')}"`; }
export function downloadCsv(filename:string,headers:string[],rows:Array<Array<string|number>>) { const csv=[headers,...rows].map(row=>row.map(csvCell).join(',')).join('\n');const blob=new Blob([`\uFEFF${csv}`],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000); }
export function automaticSyncLabel(sync:SyncState) {
  const recovery=sync?.reliability?.events;
  if (recovery?.failed) return `${recovery.failed} evento${recovery.failed===1?'':'s'} esperando reintento automático`;
  if (recovery?.pending) return `${recovery.pending} evento${recovery.pending===1?'':'s'} procesándose`;
  if (sync?.webhook_status==='active') return sync.last_webhook_at
    ? `Tiempo real activo · Último evento: ${new Date(sync.last_webhook_at).toLocaleString('es-AR')}`
    : 'Actualización en tiempo real activa';
  if (sync?.last_completed_at) return `Última revisión: ${new Date(sync.last_completed_at).toLocaleString('es-AR')} · avisos en tiempo real pendientes`;
  return 'Preparando la primera importación…';
}

export const glossary={
  SKU:{meaning:'Código que identifica un producto o una variante sin confundirla con otras.',example:'Te ayuda a vincular cada venta con su costo y su stock.'},
  ROAS:{meaning:'Ventas atribuidas a anuncios divididas por lo invertido en publicidad.',example:'Un ROAS de 3x significa $3 en ventas por cada $1 invertido; no es ganancia.'},
  CPA:{meaning:'Inversión publicitaria promedio necesaria para conseguir una compra atribuida.',example:'Si gastaste $30.000 y obtuviste 10 compras, el CPA es $3.000.'},
  'Facturación neta':{meaning:'Ventas cobradas luego de descontar importes que no quedan como ingreso de la tienda.',example:'Es la base para analizar la operación, antes de restar todos los costos.'},
  'Ganancia conocida':{meaning:'Facturación menos los costos que Rentia pudo identificar.',example:'Si falta una comisión u otro costo, la ganancia puede cambiar cuando llegue ese dato.'},
  'Margen real':{meaning:'Porcentaje de la facturación que queda después de los costos identificados.',example:'Un margen de 20% equivale a $20 de ganancia conocida cada $100 facturados.'},
  'Ticket promedio':{meaning:'Valor promedio de las órdenes cobradas en el período.',example:'Se calcula dividiendo la facturación por la cantidad de órdenes.'},
  Comisiones:{meaning:'Cargos de la plataforma y del medio de pago asociados a cada venta.',example:'Rentia consulta el cargo real de Pago Nube por orden cuando Tiendanube lo informa.'},
  CTR:{meaning:'Porcentaje de impresiones de tus anuncios que terminaron en un clic.',example:'100 clics sobre 10.000 impresiones equivalen a un CTR de 1%.'},
  CPC:{meaning:'Costo promedio de cada clic recibido por tus anuncios.',example:'$10.000 invertidos para 500 clics equivalen a $20 por clic.'},
  Inversión:{meaning:'Dinero gastado en anuncios de la cuenta publicitaria durante el período seleccionado.',example:'Se usa para calcular ROAS, CPA y CPC. No incluye el costo de los productos ni otras comisiones.'},
  'ROAS total tienda':{meaning:'Facturación cobrada de toda la tienda dividida por la inversión publicitaria.',example:'Incluye ventas que Meta no se atribuye. Un resultado de 3x son $3 facturados por cada $1 en anuncios, no $3 de ganancia.'},
} as const;

export type GlossaryTerm=keyof typeof glossary;

export function TermHelp({term}:{term:GlossaryTerm}) {
  const help=glossary[term];
  return <HelpPopover term={term} meaning={help.meaning} example={help.example}/>;
}

export function MetricChange({current,previous,mode='relative',neutral=false}:{current:number;previous:number|undefined;mode?:'relative'|'points';neutral?:boolean}) {
  const t=useT();
  if (previous===undefined) return <small className="metricChange loading">{t('Comparando períodos…')}</small>;
  const difference=current-previous;
  const threshold=mode==='points'?0.05:Math.max(0.01,Math.abs(previous)*0.001);
  if (Math.abs(difference)<threshold) return <small className="metricChange flat">{t('• Sin cambios')}</small>;
  if (previous===0) return <small className="metricChange neutral">{t('— Sin historial anterior')}</small>;
  const direction=difference>0?'up':'down';
  const value=mode==='points'?`${Math.abs(difference).toFixed(1)} pp`:`${Math.abs(difference/Math.abs(previous)*100).toFixed(0)}%`;
  return <small className={`metricChange ${neutral?'neutral':direction==='up'?'positive':'negative'}`}>{direction==='up'?'↑':'↓'} {value} {t('vs. período anterior')}</small>;
}

export function SidebarNavItem({item,active,onSelect}:{item:NavItem;active:boolean;onSelect:(section:string)=>void}) {
  const t=useT();
  const Icon=item.icon;
  return <button type="button" className={`sidebarNavItem ${active?'active':''}`} onClick={()=>onSelect(item.id)} title={t(item.label)} aria-current={active?'page':undefined}>
    <Icon aria-hidden="true" strokeWidth={1.8}/><span>{t(item.label)}</span>{item.badge&&<em>{t(item.badge)}</em>}
  </button>;
}

export type ChartMetric='revenue'|'profit'|'orders'|'adSpend';
export type TimelineBucket=TimelinePoint&{key:string;label:string;detail:string};

export type Granularity='día'|'semana'|'mes';
export function timelineGranularity(days:number):Granularity { return days>=180?'mes':days>31?'semana':'día'; }
export function aggregateTimeline(points:TimelinePoint[],days:number,forced?:Granularity|null):TimelineBucket[] {
  const granularity=forced||timelineGranularity(days);
  const buckets=new Map<string,TimelineBucket>();
  const formatDay=(value:Date,options:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat('es-AR',{...options,timeZone:'UTC'}).format(value);
  for(const point of [...points].sort((a,b)=>a.date.localeCompare(b.date))) {
    const current=new Date(`${point.date}T12:00:00Z`);
    let key=point.date;
    let label=formatDay(current,{day:'2-digit',month:'short'});
    let detail=formatDay(current,{day:'2-digit',month:'long',year:'numeric'});
    if(granularity==='mes') {
      key=point.date.slice(0,7);
      label=formatDay(current,{month:'short'});
      detail=formatDay(current,{month:'long',year:'numeric'});
    } else if(granularity==='semana') {
      const start=new Date(current);
      start.setUTCDate(start.getUTCDate()-((start.getUTCDay()+6)%7));
      const end=new Date(start);end.setUTCDate(end.getUTCDate()+6);
      key=start.toISOString().slice(0,10);
      label=formatDay(start,{day:'2-digit',month:'short'});
      detail=`${formatDay(start,{day:'2-digit',month:'short'})} – ${formatDay(end,{day:'2-digit',month:'short',year:'numeric'})}`;
    }
    const row=buckets.get(key)||{key,label,detail,date:key,orders:0,storeRevenue:0,externalRevenue:0,profit:0,adSpend:0,operatingCosts:0};
    row.orders+=point.orders;row.storeRevenue+=point.storeRevenue;row.externalRevenue+=point.externalRevenue;row.profit+=point.profit;row.adSpend+=point.adSpend;row.operatingCosts+=point.operatingCosts;
    buckets.set(key,row);
  }
  return [...buckets.values()];
}

export function InteractiveTimelineChart({points,days,metric='revenue',mode='single',adCurrency='ARS',visualization='area'}:{points:TimelinePoint[];days:number;metric?:ChartMetric;mode?:'single'|'comparison';adCurrency?:string;visualization?:DashboardChartType}) {
  const money=useMoney();
  const t=useT();
  const chartId=useId().replace(/:/g,'');
  const chartRef=useRef<HTMLDivElement>(null);
  const [chartSize,setChartSize]=useState({width:1000,height:310});
  const buckets=aggregateTimeline(points,days);
  const [activeKey,setActiveKey]=useState<string|null>(null);
  useEffect(()=>{
    const element=chartRef.current;if(!element)return;
    const measure=()=>{const rect=element.getBoundingClientRect();setChartSize({width:Math.max(320,Math.round(rect.width)),height:Math.max(240,Math.round(rect.height))});};
    measure();const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();
  },[]);
  const active=buckets.find(point=>point.key===activeKey)||null;
  const valueFor=(point:TimelineBucket,kind:ChartMetric)=>kind==='revenue'?point.storeRevenue+point.externalRevenue:kind==='profit'?point.profit:kind==='adSpend'?point.adSpend:point.orders;
  const series=buckets.flatMap(point=>mode==='comparison'?[valueFor(point,'revenue'),valueFor(point,'profit')]:[valueFor(point,metric)]);
  const maxValue=Math.max(1,...series);
  const minValue=Math.min(0,...series);
  const valueRange=Math.max(1,maxValue-minValue);
  const labelEvery=Math.max(1,Math.ceil(buckets.length/10));
  const formatMetric=(value:number,kind:ChartMetric)=>kind==='orders'?String(Math.round(value)):money(value,kind==='adSpend'?adCurrency:'ARS');
  const chartWidth=chartSize.width,chartHeight=chartSize.height,plotTop=86,plotBottom=Math.max(190,chartSize.height-38);
  const xFor=(index:number)=>buckets.length<=1?chartWidth/2:20+index*(chartWidth-40)/(buckets.length-1);
  const yFor=(value:number)=>plotTop+(maxValue-value)/valueRange*(plotBottom-plotTop);
  const primaryValues=buckets.map(point=>valueFor(point,mode==='comparison'?'revenue':metric));
  const secondaryValues=buckets.map(point=>valueFor(point,'profit'));
  const linePath=(values:number[])=>values.map((value,index)=>`${index?'L':'M'} ${xFor(index).toFixed(2)} ${yFor(value).toFixed(2)}`).join(' ');
  const areaPath=(values:number[])=>values.length?`${linePath(values)} L ${xFor(values.length-1).toFixed(2)} ${plotBottom} L ${xFor(0).toFixed(2)} ${plotBottom} Z`:'';
  return <div ref={chartRef} className={`interactiveChart ${mode} metric-${metric} visualization-${visualization}`} role="img" aria-label={`Evolución por ${timelineGranularity(days)}`} onMouseLeave={()=>setActiveKey(null)}>
    <div className={`chartInspector ${active?'active':''}`} aria-live="polite">
      {active?<>
        <strong>{active.detail}</strong>
        <span><small>{t('Facturación')}</small><b>{money(valueFor(active,'revenue'))}</b></span>
        <span><small>{t('Ganancia')}</small><b className={active.profit<0?'negativeProfit':'positiveProfit'}>{money(active.profit)}</b></span>
        <span><small>{t('Costos operativos')}</small><b>{money(active.operatingCosts)}</b></span>
        <span><small>{t('Publicidad')}{adCurrency!=='ARS'?` (${adCurrency})`:''}</small><b>{money(active.adSpend,adCurrency)}</b></span>
        <span><small>{t('Órdenes')}</small><b>{formatMetric(active.orders,'orders')}</b></span>
      </>:<span className="chartInspectorHint">{t('Mové el cursor sobre el gráfico para ver el detalle del período.')}</span>}
    </div>
    {visualization==='bar'?<><div className="chartGridLines"><i/><i/><i/><i/></div><div className="interactiveChartPlot" style={{gridTemplateColumns:`repeat(${Math.max(1,buckets.length)},minmax(0,1fr))`}}>
      {buckets.map((point,index)=>{const primary=primaryValues[index];const secondary=secondaryValues[index];const showLabel=buckets.length<=12||index%labelEvery===0||index===buckets.length-1;const accessible=`${point.detail}. Facturación ${money(valueFor(point,'revenue'))}. Ganancia ${money(point.profit)}. Costos operativos ${money(point.operatingCosts)}. Publicidad ${money(point.adSpend,adCurrency)}. ${point.orders} órdenes.`;return <button type="button" className={`interactiveChartColumn ${activeKey===point.key?'active':''}`} key={point.key} aria-label={accessible} onMouseEnter={()=>setActiveKey(point.key)} onFocus={()=>setActiveKey(point.key)} onBlur={()=>setActiveKey(null)} onClick={()=>setActiveKey(activeKey===point.key?null:point.key)}><span className="interactiveBarTrack"><i className={`interactiveBar primary ${primary<0?'loss':''}`} style={{height:`${Math.max(primary?4:1,Math.abs(primary)/Math.max(1,Math.max(...series.map(Math.abs)))*100)}%`}}/>{mode==='comparison'&&<i className={`interactiveBar secondary ${secondary<0?'loss':''}`} style={{height:`${Math.max(secondary?4:1,Math.abs(secondary)/Math.max(1,Math.max(...series.map(Math.abs)))*100)}%`}}/>}</span><span className={`chartAxisLabel ${showLabel?'visible':''}`}>{showLabel?point.label:''}</span></button>})}
    </div></>:<svg className="timelineSvg" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id={`${chartId}-primary`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#28d8c6" stopOpacity=".42"/><stop offset="1" stopColor="#28d8c6" stopOpacity="0"/></linearGradient><linearGradient id={`${chartId}-secondary`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#42e29d" stopOpacity=".28"/><stop offset="1" stopColor="#42e29d" stopOpacity="0"/></linearGradient></defs>
      {[0,1,2,3].map(row=><line key={row} className="timelineGrid" x1="0" x2={chartWidth} y1={plotTop+row*(plotBottom-plotTop)/3} y2={plotTop+row*(plotBottom-plotTop)/3}/>)}
      {visualization==='area'&&<path className="timelineArea primary" d={areaPath(primaryValues)} fill={`url(#${chartId}-primary)`}/>}<path className="timelineLine primary" d={linePath(primaryValues)}/>
      {mode==='comparison'&&<>{visualization==='area'&&<path className="timelineArea secondary" d={areaPath(secondaryValues)} fill={`url(#${chartId}-secondary)`}/>}<path className="timelineLine secondary" d={linePath(secondaryValues)}/></>}
      {buckets.map((point,index)=>{const showLabel=buckets.length<=12||index%labelEvery===0||index===buckets.length-1;const selected=activeKey===point.key;return <g className={`timelinePoint ${selected?'active':''}`} key={point.key} tabIndex={0} role="button" aria-label={`${point.detail}. Facturación ${money(valueFor(point,'revenue'))}. Ganancia ${money(point.profit)}. Costos operativos ${money(point.operatingCosts)}. Publicidad ${money(point.adSpend,adCurrency)}. ${point.orders} órdenes.`} onMouseEnter={()=>setActiveKey(point.key)} onFocus={()=>setActiveKey(point.key)} onBlur={()=>setActiveKey(null)} onClick={()=>setActiveKey(selected?null:point.key)}><rect x={Math.max(0,xFor(index)-(chartWidth/Math.max(1,buckets.length))/2)} y={plotTop} width={chartWidth/Math.max(1,buckets.length)} height={plotBottom-plotTop} fill="transparent"/><circle className="primary" cx={xFor(index)} cy={yFor(primaryValues[index])} r={selected?6:3}/>{mode==='comparison'&&<circle className="secondary" cx={xFor(index)} cy={yFor(secondaryValues[index])} r={selected?5:2.5}/>} {showLabel&&<text x={xFor(index)} y={chartHeight-10} textAnchor="middle">{point.label}</text>}</g>})}
    </svg>}
  </div>;
}

export const dashboardMetricLabels:Record<DashboardMetricKey,string>={orders:'Órdenes totales',totalRevenue:'Facturación total',netRevenue:'Facturación neta',profit:'Ganancia conocida',margin:'Margen real',aov:'Ticket promedio',adSpend:'Inversión publicitaria',roas:'ROAS global / Meta',cpa:'CPA Meta',productCost:'Costo de productos',shipping:'Costos de envío',commissions:'Comisiones',externalRevenue:'Facturación externa',tnOrders:'Órdenes Tiendanube',tnRevenue:'Facturación Tiendanube',tnNetRevenue:'Facturación neta Tiendanube',tnProfit:'Ganancia Tiendanube',tnAov:'Ticket promedio Tiendanube',metaSpend:'Inversión Meta',metaRevenue:'Ventas atribuidas por Meta',metaRoas:'ROAS reportado por Meta',metaCpa:'CPA Meta',mlOrders:'Órdenes Mercado Libre',mlRevenue:'Facturación Mercado Libre',mlNetRevenue:'Facturación neta Mercado Libre',mlProfit:'Ganancia Mercado Libre',mlAov:'Ticket promedio Mercado Libre'};
export const dashboardMetricHelp:Partial<Record<DashboardMetricKey,GlossaryTerm>>={netRevenue:'Facturación neta',profit:'Ganancia conocida',margin:'Margen real',aov:'Ticket promedio',roas:'ROAS',cpa:'CPA',commissions:'Comisiones',tnNetRevenue:'Facturación neta',tnProfit:'Ganancia conocida',tnAov:'Ticket promedio',metaRoas:'ROAS',metaCpa:'CPA',mlNetRevenue:'Facturación neta',mlProfit:'Ganancia conocida',mlAov:'Ticket promedio'};

export function ChannelChartFilter({value,onChange}:{value:string;onChange:(value:string)=>void}) {
  return <div className="channelChartFilter"><ThemedSelect label="Canal del análisis" value={value} onChange={onChange} options={[{value:'combined',label:'Todos los canales'},{value:'mercadolibre',label:'Mercado Libre'},{value:'tiendanube',label:'Tiendanube'}]}/><p>{value==='combined'?'Ventas de todos los canales, publicidad conocida y ajustes por reembolsos.':value==='mercadolibre'?'Ganancia conocida del canal, después de Product Ads consultados y pérdidas por reembolsos confirmadas. Revisá la cobertura publicitaria.':'Datos exclusivos de Tiendanube. Meta no se reparte al canal sin atribución; las devoluciones se revisan por separado.'}</p></div>;
}

export function Sparkline({values,color}:{values:number[];color:string}) {
  const finite=values.filter(value=>Number.isFinite(value));
  const size=Math.max(1,Math.ceil(finite.length/32));
  const clean=size===1?finite:Array.from({length:Math.ceil(finite.length/size)},(_,index)=>finite.slice(index*size,index*size+size).reduce((sum,value)=>sum+value,0));
  if(clean.length<2||clean.every(value=>value===clean[0]))return null;
  const max=Math.max(...clean),min=Math.min(...clean),range=max-min||1;
  const points=clean.map((value,index)=>`${(index/(clean.length-1)*76).toFixed(1)},${(28-(value-min)/range*24).toFixed(1)}`).join(' ');
  return <svg className="p-spark" viewBox="0 0 76 30" aria-hidden="true"><polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

export function RpDelta({current,previous,mode='relative',neutral=false}:{current:number;previous:number|undefined;mode?:'relative'|'points';neutral?:boolean}) {
  const t=useT();
  if(previous===undefined)return <span className="p-delta p-flat">{t('Comparando períodos…')}</span>;
  const difference=current-previous;
  const threshold=mode==='points'?0.05:Math.max(0.01,Math.abs(previous)*0.001);
  if(Math.abs(difference)<threshold)return <span className="p-delta p-flat">{t('Sin cambios')}</span>;
  if(previous===0)return <span className="p-delta p-flat">{t('Sin historial anterior')}</span>;
  const up=difference>0;
  const value=mode==='points'?`${Math.abs(difference).toFixed(1)} pp`:`${Math.abs(difference/Math.abs(previous)*100).toFixed(1).replace('.',',')}%`;
  return <><span className={`p-delta ${neutral?'p-flat':up?'p-up':'p-down'}`}>{up?'▲':'▼'} {value}</span> <span className="p-sub p-deltaNote">{t('vs. período anterior')}</span></>;
}

// Facturación por día sin huecos: los días sin ventas cuentan como cero, así la curva es fiel.
export function dailySeries(points:Array<{date:string;storeRevenue:number;externalRevenue:number}>) {
  if(!points.length)return [];
  const byDate=new Map<string,number>();for(const point of points)byDate.set(point.date.slice(0,10),(byDate.get(point.date.slice(0,10))||0)+point.storeRevenue+point.externalRevenue);
  const dates=[...byDate.keys()].sort(),start=Date.parse(`${dates[0]}T00:00:00Z`),end=Date.parse(`${dates[dates.length-1]}T00:00:00Z`);
  const series:number[]=[];for(let day=start;day<=end&&series.length<400;day+=24*60*60*1000)series.push(byDate.get(new Date(day).toISOString().slice(0,10))||0);
  return series;
}

export function RpRing({value,size=54,color='#21d4c2',label}:{value:number;size?:number;color?:string;label?:React.ReactNode}) {
  const radius=size/2-5,circumference=2*Math.PI*radius;
  const [offset,setOffset]=useState(circumference);
  useEffect(()=>{const frame=requestAnimationFrame(()=>setOffset(circumference*(1-Math.max(0,Math.min(100,value))/100)));return()=>cancelAnimationFrame(frame);},[value,circumference]);
  return <div className="p-ring" style={{width:size,height:size}}><svg viewBox={`0 0 ${size} ${size}`}><circle className="p-bgc" cx={size/2} cy={size/2} r={radius}/><circle className="p-fg" cx={size/2} cy={size/2} r={radius} stroke={color} strokeDasharray={circumference} strokeDashoffset={offset}/></svg><span>{label??`${Math.round(value)}%`}</span></div>;
}


export function ComingSoonSection({eyebrow,title,description,action,onAction}:{eyebrow:string;title:string;description:string;action:string;onAction:()=>void}) { return <><div className="p-head"><div><div className="p-eyebrow">{eyebrow}</div><h1>{title}</h1></div></div><div className="p-card p-soon p-reveal"><div><RpRing value={65} size={96} color="#a78bfa" label="PRÓX."/><h2 style={{margin:'0 0 8px',fontSize:24}}>{title}</h2><p className="p-sub" style={{maxWidth:470,margin:'0 auto 18px'}}>{description}</p><button type="button" className="p-btn p-primary" onClick={onAction}>{action}</button></div></div></>; }

export type InventoryStatus='saludable'|'bajo'|'critico'|'sin_stock'|'sin_movimiento'|'no_controla';
export function inventoryStatus(row:ProductAnalyticsRow):InventoryStatus { if(row.stock===null)return'no_controla';if(row.stock<=0)return'sin_stock';if(row.sales_per_day<=0)return'sin_movimiento';if((row.days_stock||0)<=7)return'critico';if((row.days_stock||0)<=14)return'bajo';return'saludable'; }
export function inventoryStatusLabel(status:InventoryStatus) { return status==='saludable'?'Saludable':status==='bajo'?'Stock bajo':status==='critico'?'Crítico':status==='sin_stock'?'Sin stock':status==='sin_movimiento'?'Sin movimiento':'No controla'; }

export function DataSection({title,subtitle,children}:{title:string;subtitle:string;children:React.ReactNode}) { return <section className="dataSection"><div><span className="muted">DATOS REALES</span><h2>{title}</h2><p>{subtitle}</p></div>{children}</section>; }
export function EmptyData({syncing,onSync}:{syncing:boolean;onSync:()=>void}) { return <div className="p-card p-soon p-reveal"><div><RefreshCw className="p-i p-soonIcon" aria-hidden="true"/><h2>{syncing?'Sincronizando…':'Todavía no hay datos importados'}</h2><p className="p-sub">Consultaremos nuevamente la información autorizada de Tiendanube.</p><button type="button" className="p-btn p-primary" onClick={onSync} disabled={syncing}>{syncing?'Actualizando…':'Actualizar datos'}</button></div></div>; }

