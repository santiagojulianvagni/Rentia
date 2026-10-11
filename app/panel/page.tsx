'use client';

import type {MeliPostSale} from '../../lib/meli-post-sale';
import {OrderItemCost,MeliOrderReview,RefundAdjustmentEditor} from '../../components/order-review';
import ProductAds,{useProductAds,type ProductAdsData} from '../../components/product-ads';
import ReportDetails,{reportDetailRows} from '../../components/report-details';
import '../report-details.css';
import {analyticsRangeFromUrl} from '../../lib/analytics-range';
import {orderDetailsHref} from '../../lib/order-review-links';
import '../order-review.css';
import './panel-v2.css';
import { useClerk, useUser } from '@clerk/nextjs';
import {MercadoLibreIntegration,useMercadoLibreSync} from '../../components/mercadolibre-integration';
import {ConnectionNotice,ConnectionStatus,ConnectionUpdatedAt} from '../../components/connection-status';
import {automaticSyncDue,connectionHealth} from '../../lib/connection-health';
import {salesChannelLabel,orderReturnNeedsReview} from '../../lib/sales-channels';
import { createContext, FormEvent, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, BadgeDollarSign, Boxes, CalendarDays, ChevronDown, ChevronLeft, Coins, CreditCard, Download, FileChartColumn, FilePlus2, GripVertical, Languages, LayoutDashboard, LayoutGrid, Menu, Megaphone, PackageSearch, Pencil, PlugZap, Plus, Settings2, ShieldCheck, ShoppingCart, SlidersHorizontal, Sparkles, TriangleAlert, UsersRound, X, type LucideIcon } from 'lucide-react';
import PlanConfigurator from '../../components/plan-configurator';
import SetupChecklist from '../../components/setup-checklist';
import ProductCosts,{type ProductCostRow} from '../../components/product-costs';
import ExternalRevenue from '../../components/external-revenue';
import MeliBilling from '../../components/meli-billing';
import OrderPagination, {orderPageWindow} from '../../components/order-pagination';
import ThemedSelect from '../../components/themed-select';
import type { TeamCapacity } from '../../lib/team-capacity';
import HelpPopover from '../../components/term-help';
import MetaAccountPicker from '../../components/meta-account-picker';
import ShippingCommissionSettings from '../../components/shipping-commission-settings';
import ExchangeRateSettings from '../../components/exchange-rate-settings';
import type { RentiaPlan } from '../../lib/plans';
import type { CostSettings } from '../../lib/cost-engine';
import { formatDisplayRange, rollingDisplayRange } from '../../lib/display-dates';
import type { LiveRates } from '../../lib/exchange-rates';
import { accountAppearance } from '../../lib/account-appearance';

type NavItem={id:string;label:string;icon:LucideIcon;badge?:string};
const overviewSections:NavItem[]=[
  {id:'resumen',label:'Dashboard',icon:LayoutDashboard},
  {id:'acciones',label:'Acciones',icon:Sparkles},
  {id:'calidad',label:'Calidad de datos',icon:ShieldCheck},
  {id:'informes',label:'Informes',icon:FileChartColumn},
];
const operationSections:NavItem[]=[
  {id:'ordenes',label:'Órdenes',icon:ShoppingCart},
  {id:'productos',label:'Productos',icon:PackageSearch},
  {id:'inventario',label:'Inventario',icon:Boxes},
  {id:'lifetime',label:'Lifetime Value',icon:UsersRound,badge:'PRÓX.'},
  {id:'publicidad',label:'Publicidad',icon:Megaphone},
];
const configurationSections:NavItem[]=[
  {id:'integraciones',label:'Integraciones',icon:PlugZap},
  {id:'cargos-meli',label:'Cargos de Mercado Libre',icon:FileChartColumn},
  {id:'equipo',label:'Equipo',icon:UsersRound},
  {id:'costos',label:'Costo de productos',icon:BadgeDollarSign},
  {id:'configuracion',label:'Envíos y comisiones',icon:SlidersHorizontal},
  {id:'facturacion',label:'Facturación externa',icon:FilePlus2},
  {id:'moneda',label:'Cotización dólar',icon:ArrowLeftRight},
  {id:'plan',label:'Plan y facturación',icon:CreditCard},
];
const sections=[...overviewSections,...operationSections,...configurationSections];
const periodOptions=[{label:'7 días',days:7},{label:'30 días',days:30},{label:'90 días',days:90},{label:'365 días',days:365}];
type Integration={provider:string;external_store_id:string;scopes:string;status:string;connected_at:string};
type OrderItem={external_product_id?:string;external_variant_id?:string;external_line_id:string;name:string;sku:string|null;quantity:number;unit_price:number;unit_cost:number;cost_source:'manual'|'tiendanube'|'orden'|'orden_manual'|'publicacion'|'sin_costo'};
type OrderRow={refund_adjustment?:import('../../lib/refund-adjustment').RefundAdjustment|null;refund_loss?:number|null;post_sale?:MeliPostSale|null;provider:string;external_order_id:string;order_number:string|null;currency:string;status:string;payment_status:string;payment_method:string|null;shipping_status:string|null;source_shipping_cost:number|null;source_commission_cost:number|null;manual_commission_cost:number|null;total:number;source_created_at:string;product_cost:number;shipping_cost:number;shipping_source:string;commission_cost:number;commission_source:string;commission_missing_reason:string|null;tax_cost:number;additional_cost:number;profit:number;margin:number;items:OrderItem[]};
type ProductRow={external_product_id:string;name:string;image_url:string|null;published:number;variants:number;stock:number;min_cost:number;min_price:number};
type ProductAnalyticsRow={product_id:number;rentia_archived:number;variant_id:number;provider:string;external_product_id:string;external_variant_id:string;sku:string|null;price:number;effective_cost:number;stock:number|null;product_name:string;image_url:string|null;cost_source:'manual'|'tiendanube'|'sin_costo';units_sold:number;orders:number;revenue:number;product_cost:number;shipping_cost:number;commission_cost:number;commission_pending:boolean;commission_estimated:boolean;tax_cost:number;additional_cost:number;total_costs:number;profit:number;margin:number;sales_per_day:number;days_stock:number|null;currency:string};
type TimelinePoint={date:string;orders:number;storeRevenue:number;externalRevenue:number;profit:number;adSpend:number;operatingCosts:number};
type ChannelRow={refundLoss?:number;refundPending?:number;refundOrders?:number;profitBeforeAds?:number|null;adSpend?:number;adsCoverage?:boolean;productCost?:number;shipping?:number;commissions?:number;taxes?:number;additional?:number;provider:string;label:string;orders:number;revenue:number;netRevenue:number;profit:number|null;aov:number;costCoverage:boolean;completeOrders:number;pendingOrders:number};
type ExchangeRate={rate_type:string;base_rate:number;adjustment_percent:number;effective_rate:number;updated_at:string|null};
type QualityDimension={complete:number;total:number;missing:number;percent:number};
type DataQuality={postSale?:{refundLoss?:number;refundPending?:number;claimsUnchecked?:number;openClaims:number;refundOrders:number;orders:Array<{provider:string;externalOrderId:string;date:string;total:number;currency:string;refundAmount:number|null;state:string}>};score:number;status:'empty'|'excellent'|'good'|'warning'|'critical';totalOrders:number;completeOrders:number;coveredRevenue:number;coveredProfit:number;configurationSaved:boolean;dimensions:{products:QualityDimension;shipping:QualityDimension;commissions:QualityDimension;taxes:QualityDimension};incompleteOrders:Array<{provider?:string;externalOrderId:string;orderNumber:string|null;date:string;total:number;currency:string;missing:string[]}>};
type SyncReliability={events:{total:number;processed:number;failed:number;pending:number;lastReceivedAt:string|null;lastProcessedAt:string|null};lastReconciliation:{trigger_source?:string;status?:string;started_at?:string;completed_at?:string;error?:string|null}|null};
type SyncState=null|{status:string;last_started_at:string|null;last_completed_at:string|null;last_error:string|null;orders_synced:number;products_synced:number;details_version:number;webhook_status:string;last_webhook_at:string|null;webhooks_registered_at:string|null;webhook_error:string|null;reliability?:SyncReliability};
type MetaAccount={external_account_id:string;name:string;currency:string;timezone_name:string|null;account_status:number;selected:number;synced_at:string};
type MetaCampaign={external_campaign_id:string;name:string;status:string|null;effective_status:string|null;daily_budget:number;lifetime_budget:number;spend:number;impressions:number;clicks:number;purchases:number;purchase_value:number;reported_roas:number;cpa:number};
type MetaAdsData={accounts:MetaAccount[];selected:MetaAccount|null;sync:SyncState;summary:{spend:number;impressions:number;clicks:number;purchases:number;purchaseValue:number;reportedRoas:number;cpa:number;ctr:number;cpc:number};campaigns:MetaCampaign[];daily:Array<{date:string;spend:number;impressions:number;clicks:number;purchases:number;purchase_value:number}>};
type Dashboard={meliAds?:ProductAdsData;metrics:{refundLoss?:number;meliAdSpend?:number;totalAdSpend?:number;meliAdsComparable?:boolean;revenue:number;externalRevenue:number;totalRevenue:number;profitBeforeAds:number;profit:number;margin:number;orders:number;externalOrders:number;totalOrders:number;aov:number;totalAov:number;netRevenue:number;productCost:number;shipping:number;commissions:number;taxes:number;additional:number;adSpend:number;metaReportedRevenue:number;metaPurchases:number;reportedRoas:number;blendedRoas:number;cpa:number;adSpendComparable:boolean;metaCurrency:string};ads:{connected:boolean;selected:MetaAccount|null;sync:SyncState};integrations?:{tiendanube?:{paymentAccess:boolean}};orders:OrderRow[];paymentMethods?:string[];products:ProductRow[];metaTimeline?:TimelinePoint[];timeline:TimelinePoint[];channelTimelines?:Record<string,TimelinePoint[]>;channels:ChannelRow[];exchangeRate:ExchangeRate|null;sync:SyncState;quality:DataQuality};
type CostRule={id:number;category:'commission'|'additional';name:string;match_value:string|null;calculation:'hybrid'|'fixed_monthly'|'percentage_revenue';amount:number;percentage:number;starts_at:string|null;ends_at:string|null;enabled:number};
type SubscriptionPlan=RentiaPlan;
type SubscriptionData={subscription:{planId:string;requestedPlanId:string|null;status:string;billingCycle:string;trialEndsAt:string;trialDaysRemaining:number};usage:{orders:number;limit:number|null;percent:number};currentPlan:SubscriptionPlan;recommendation:SubscriptionPlan;plans:SubscriptionPlan[];billingEnabled:boolean;canManage:boolean;message?:string};

type DisplayCurrency='ARS'|'USD'|'EUR';
type DisplayLanguage='es'|'pt'|'en';
type CustomDateRange={start:string;end:string};
type DashboardMetricKey='orders'|'totalRevenue'|'netRevenue'|'profit'|'margin'|'aov'|'adSpend'|'roas'|'cpa'|'productCost'|'shipping'|'commissions'|'externalRevenue'|'tnOrders'|'tnRevenue'|'tnNetRevenue'|'tnProfit'|'tnAov'|'metaSpend'|'metaRevenue'|'metaRoas'|'metaCpa'|'mlOrders'|'mlRevenue'|'mlNetRevenue'|'mlProfit'|'mlAov';
type DashboardChannel='combined'|'tiendanube'|'meta'|'mercadolibre'|'custom';
type DashboardChartType='area'|'line'|'bar';
type DashboardLayoutSection={id:string;title:string;metrics:DashboardMetricKey[];channel?:DashboardChannel};
type DashboardLayoutConfig={version:2;sections:DashboardLayoutSection[];chart:{type:DashboardChartType;metric:ChartMetric}};
const dashboardMetricKeys:DashboardMetricKey[]=['orders','totalRevenue','netRevenue','profit','margin','aov','adSpend','roas','cpa','productCost','shipping','commissions','externalRevenue','tnOrders','tnRevenue','tnNetRevenue','tnProfit','tnAov','metaSpend','metaRevenue','metaRoas','metaCpa','mlOrders','mlRevenue','mlNetRevenue','mlProfit','mlAov'];
const dashboardPresets:Record<'profitability'|'advertising'|'operation',DashboardLayoutConfig>={
  profitability:{version:2,sections:[{id:'profitability',title:'Rentabilidad 360',channel:'combined',metrics:['totalRevenue','netRevenue','profit','margin','productCost','shipping','commissions','adSpend']}],chart:{type:'area',metric:'profit'}},
  advertising:{version:2,sections:[{id:'advertising',title:'Publicidad y crecimiento',channel:'combined',metrics:['adSpend','roas','cpa','totalRevenue','profit','margin']},{id:'meta',title:'Meta Ads',channel:'meta',metrics:['metaSpend','metaRevenue','metaRoas','metaCpa']}],chart:{type:'area',metric:'adSpend'}},
  operation:{version:2,sections:[{id:'operation',title:'Operación',channel:'combined',metrics:['orders','totalRevenue','aov','netRevenue','shipping','externalRevenue']},{id:'tiendanube',title:'Tiendanube',channel:'tiendanube',metrics:['tnOrders','tnRevenue','tnNetRevenue','tnProfit','tnAov']},{id:'mercadolibre',title:'Mercado Libre',channel:'mercadolibre',metrics:['mlOrders','mlRevenue','mlNetRevenue','mlProfit','mlAov']}],chart:{type:'area',metric:'revenue'}},
};
const defaultDashboardLayout:DashboardLayoutConfig={version:2,sections:[
  {id:'main',title:'Rentia 360',channel:'combined',metrics:['orders','totalRevenue','netRevenue','profit','margin','aov','adSpend','roas']},
  {id:'tiendanube',title:'Tiendanube',channel:'tiendanube',metrics:['tnOrders','tnRevenue','tnNetRevenue','tnProfit','tnAov']},
  {id:'meta',title:'Meta Ads',channel:'meta',metrics:['metaSpend','metaRevenue','metaRoas','metaCpa']},
  {id:'mercadolibre',title:'Mercado Libre',channel:'mercadolibre',metrics:['mlOrders','mlRevenue','mlNetRevenue','mlProfit','mlAov']},
],chart:{type:'area',metric:'revenue'}};
type ExchangeRates={ARS:number;USD?:number;EUR?:number};
type Preferences={currency:DisplayCurrency;language:DisplayLanguage;rates:ExchangeRates;rateSource:string;setCurrency:(value:DisplayCurrency)=>void;setLanguage:(value:DisplayLanguage)=>void;refreshRates:()=>Promise<void>};
const PreferencesContext=createContext<Preferences>({currency:'ARS',language:'es',rates:{ARS:1},rateSource:'',setCurrency:()=>undefined,setLanguage:()=>undefined,refreshRates:async()=>undefined});
const locales:Record<DisplayLanguage,string>={es:'es-AR',pt:'pt-BR',en:'en-US'};
const translations:Record<DisplayLanguage,Record<string,string>>={
  es:{},
  pt:{
    'Comprobando conexiones…':'Verificando conexões…','Sin conexiones':'Sem conexões','Revisar conexiones':'Revisar conexões','Importación en pausa':'Importação pausada','Importando historial…':'Importando histórico…','Actualización pendiente':'Atualização pendente','Datos al día':'Dados atualizados','Ver conexiones':'Ver conexões',
    'Dashboard':'Painel','Acciones':'Ações','Calidad de datos':'Qualidade dos dados','Informes':'Relatórios','Órdenes':'Pedidos','Productos':'Produtos','Inventario':'Estoque','Integraciones':'Integrações','Costo de productos':'Custo dos produtos','Envíos y comisiones':'Envios e comissões','Facturación externa':'Faturamento externo','Cotización dólar':'Cotação do dólar','Configuración':'Configurações','RESUMEN':'VISÃO GERAL','OPERACIÓN':'OPERAÇÃO','PRÓX.':'EM BREVE','Sincronización automática':'Sincronização automática','Sincronización en revisión':'Sincronização em revisão','Cuenta Rentia':'Conta Rentia','Cerrar sesión':'Sair','Últimos':'Últimos','Trimestre':'Trimestre','Año':'Ano','7 días':'7 dias','30 días':'30 dias','90 días':'90 dias','365 días':'365 dias','Personalizado':'Personalizado','Rango personalizado':'Período personalizado','Desde':'De','Hasta':'Até','Cancelar':'Cancelar','Aplicar':'Aplicar','MÉTRICAS PRINCIPALES':'MÉTRICAS PRINCIPAIS','Tu operación, en un solo lugar':'Sua operação em um só lugar','La ganancia es provisoria cuando faltan costos. La facturación externa se muestra separada porque no conocemos su rentabilidad.':'O lucro é provisório quando faltam custos. O faturamento externo aparece separado porque não conhecemos sua rentabilidade.','＋ Cargar facturación externa':'＋ Adicionar faturamento externo','Órdenes totales':'Pedidos totais','Facturación total':'Faturamento total','Facturación neta tienda':'Faturamento líquido da loja','Ganancia conocida':'Lucro conhecido','Margen real':'Margem real','Ticket promedio':'Ticket médio','Inversión publicitaria':'Investimento em anúncios','ROAS global / Meta':'ROAS global / Meta','Cargando':'Carregando','Disponible al conectar Meta':'Disponível ao conectar a Meta','Sin datos inventados':'Sem dados estimados','Facturación vs. ganancia':'Faturamento vs. lucro','Comparación real del período':'Comparação real do período','Facturación':'Faturamento','Ganancia':'Lucro','Cuenta real':'Conta real','CUENTA REAL':'CONTA REAL','Desglose de rentabilidad':'Detalhamento da rentabilidade','Facturación tienda':'Faturamento da loja','Envíos':'Envios','Comisiones':'Comissões','Impuestos':'Impostos','Costos adicionales':'Custos adicionais','Ganancia después de Ads':'Lucro após anúncios','Analizar publicidad':'Analisar publicidade','Configurar costos':'Configurar custos','VOLUMEN DE VENTAS':'VOLUME DE VENDAS','de ticket promedio':'de ticket médio','Todavía no hay ventas en este período.':'Ainda não há vendas neste período.','Conectá Meta para completar este análisis':'Conecte a Meta para completar esta análise','La inversión aparecerá al sincronizar Meta Ads.':'O investimento aparecerá ao sincronizar a Meta Ads.','CANALES DE VENTA':'CANAIS DE VENDA','Rendimiento por origen':'Desempenho por origem','Administrar conexiones →':'Gerenciar conexões →','Canal':'Canal','Facturación neta':'Faturamento líquido','Costos aplicados':'Custos aplicados','Rentabilidad pendiente':'Rentabilidade pendente','ACTIVIDAD RECIENTE':'ATIVIDADE RECENTE','Últimas ventas':'Últimas vendas','Ver todas →':'Ver todas →','Todavía no hay órdenes importadas.':'Ainda não há pedidos importados.','Comparando períodos…':'Comparando períodos…','• Sin cambios':'• Sem alterações','— Sin historial anterior':'— Sem histórico anterior','vs. período anterior':'vs. período anterior','Publicidad':'Publicidade','Conectá tu tienda para empezar':'Conecte sua loja para começar','Conectar canal →':'Conectar canal →','Tiendanube conectada':'Tiendanube conectada','Actualizar ahora':'Atualizar agora','Sincronizando…':'Sincronizando…'},
  en:{
    'Comprobando conexiones…':'Checking connections…','Sin conexiones':'No connections','Revisar conexiones':'Review connections','Importación en pausa':'Import paused','Importando historial…':'Importing history…','Actualización pendiente':'Update pending','Datos al día':'Data up to date','Ver conexiones':'View connections',
    'Dashboard':'Dashboard','Acciones':'Actions','Calidad de datos':'Data quality','Informes':'Reports','Órdenes':'Orders','Productos':'Products','Inventario':'Inventory','Integraciones':'Integrations','Costo de productos':'Product costs','Envíos y comisiones':'Shipping and fees','Facturación externa':'External revenue','Cotización dólar':'Exchange rate','Configuración':'Settings','RESUMEN':'OVERVIEW','OPERACIÓN':'OPERATIONS','PRÓX.':'SOON','Sincronización automática':'Automatic sync','Sincronización en revisión':'Sync under review','Cuenta Rentia':'Rentia account','Cerrar sesión':'Sign out','Últimos':'Last','Trimestre':'Quarter','Año':'Year','7 días':'7 days','30 días':'30 days','90 días':'90 days','365 días':'365 days','Personalizado':'Custom','Rango personalizado':'Custom date range','Desde':'From','Hasta':'To','Cancelar':'Cancel','Aplicar':'Apply','MÉTRICAS PRINCIPALES':'KEY METRICS','Tu operación, en un solo lugar':'Your operation in one place','La ganancia es provisoria cuando faltan costos. La facturación externa se muestra separada porque no conocemos su rentabilidad.':'Profit is provisional when costs are missing. External revenue is shown separately because its profitability is unknown.','＋ Cargar facturación externa':'＋ Add external revenue','Órdenes totales':'Total orders','Facturación total':'Total revenue','Facturación neta tienda':'Net store revenue','Ganancia conocida':'Known profit','Margen real':'Real margin','Ticket promedio':'Average order value','Inversión publicitaria':'Ad spend','ROAS global / Meta':'Global / Meta ROAS','Cargando':'Loading','Disponible al conectar Meta':'Available after connecting Meta','Sin datos inventados':'No estimated data','Facturación vs. ganancia':'Revenue vs. profit','Comparación real del período':'Actual period comparison','Facturación':'Revenue','Ganancia':'Profit','Cuenta real':'Real account','CUENTA REAL':'REAL ACCOUNT','Desglose de rentabilidad':'Profitability breakdown','Facturación tienda':'Store revenue','Envíos':'Shipping','Comisiones':'Fees','Impuestos':'Taxes','Costos adicionales':'Additional costs','Ganancia después de Ads':'Profit after ads','Analizar publicidad':'Analyze advertising','Configurar costos':'Configure costs','VOLUMEN DE VENTAS':'SALES VOLUME','de ticket promedio':'average order value','Todavía no hay ventas en este período.':'There are no sales in this period yet.','Conectá Meta para completar este análisis':'Connect Meta to complete this analysis','La inversión aparecerá al sincronizar Meta Ads.':'Ad spend will appear after syncing Meta Ads.','CANALES DE VENTA':'SALES CHANNELS','Rendimiento por origen':'Performance by source','Administrar conexiones →':'Manage connections →','Canal':'Channel','Facturación neta':'Net revenue','Costos aplicados':'Costs applied','Rentabilidad pendiente':'Profitability pending','ACTIVIDAD RECIENTE':'RECENT ACTIVITY','Últimas ventas':'Latest sales','Ver todas →':'View all →','Todavía no hay órdenes importadas.':'There are no imported orders yet.','Comparando períodos…':'Comparing periods…','• Sin cambios':'• No change','— Sin historial anterior':'— No previous history','vs. período anterior':'vs. previous period','Publicidad':'Advertising','Conectá tu tienda para empezar':'Connect your store to get started','Conectar canal →':'Connect channel →','Tiendanube conectada':'Tiendanube connected','Actualizar ahora':'Update now','Sincronizando…':'Syncing…'}
};

const AccessContext=createContext(false);
function usePreferences(){return useContext(PreferencesContext)}
function useT(){
  const {language}=usePreferences();
  return (value:string)=>translations[language][value]||value;
}
function useMoney(){
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
function analyticsQuery(days:number,range:CustomDateRange|null) { return range?`start=${range.start}&end=${range.end}`:`days=${days}`; }
function inclusiveRangeDays(range:CustomDateRange) { return Math.floor((new Date(`${range.end}T00:00:00Z`).getTime()-new Date(`${range.start}T00:00:00Z`).getTime())/(24*60*60*1000))+1; }
function previousDateRange(range:CustomDateRange) {
  const days=inclusiveRangeDays(range);
  const end=new Date(`${range.start}T00:00:00Z`);end.setUTCDate(end.getUTCDate()-1);
  const start=new Date(end);start.setUTCDate(start.getUTCDate()-days+1);
  return {start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)};
}
function defaultDateRange():CustomDateRange {
  const end=new Date();const start=new Date();start.setDate(start.getDate()-29);
  return {start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)};
}
function date(value:string) { return new Intl.DateTimeFormat('es-AR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(value)); }
function parseCost(value:string) { return Number(value.trim().replace(',','.')); }
function sourceLabel(source:ProductCostRow['cost_source']|OrderItem['cost_source']) { return source==='orden_manual'?'Manual de esta venta':source==='publicacion'?'Catálogo de esta publicación (variante histórica)':source==='manual'?'Manual':source==='tiendanube'?'Tiendanube':source==='orden'?'Orden':'Sin costo'; }
function csvCell(value:string|number) { const raw=String(value??'');const text=typeof value==='string'&&/^[=+@-]/.test(raw)?`'${raw}`:raw; return `"${text.replace(/"/g,'""')}"`; }
function downloadCsv(filename:string,headers:string[],rows:Array<Array<string|number>>) { const csv=[headers,...rows].map(row=>row.map(csvCell).join(',')).join('\n');const blob=new Blob([`\uFEFF${csv}`],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000); }
function automaticSyncLabel(sync:SyncState) {
  const recovery=sync?.reliability?.events;
  if (recovery?.failed) return `${recovery.failed} evento${recovery.failed===1?'':'s'} esperando reintento automático`;
  if (recovery?.pending) return `${recovery.pending} evento${recovery.pending===1?'':'s'} procesándose`;
  if (sync?.webhook_status==='active') return sync.last_webhook_at
    ? `Tiempo real activo · Último evento: ${new Date(sync.last_webhook_at).toLocaleString('es-AR')}`
    : 'Actualización en tiempo real activa';
  if (sync?.last_completed_at) return `Última revisión: ${new Date(sync.last_completed_at).toLocaleString('es-AR')} · avisos en tiempo real pendientes`;
  return 'Preparando la primera importación…';
}

const glossary={
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

type GlossaryTerm=keyof typeof glossary;

function TermHelp({term}:{term:GlossaryTerm}) {
  const help=glossary[term];
  return <HelpPopover term={term} meaning={help.meaning} example={help.example}/>;
}

function MetricChange({current,previous,mode='relative',neutral=false}:{current:number;previous:number|undefined;mode?:'relative'|'points';neutral?:boolean}) {
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

function SidebarNavItem({item,active,onSelect}:{item:NavItem;active:boolean;onSelect:(section:string)=>void}) {
  const t=useT();
  const Icon=item.icon;
  return <button type="button" className={`sidebarNavItem ${active?'active':''}`} onClick={()=>onSelect(item.id)} title={t(item.label)} aria-current={active?'page':undefined}>
    <Icon aria-hidden="true" strokeWidth={1.8}/><span>{t(item.label)}</span>{item.badge&&<em>{t(item.badge)}</em>}
  </button>;
}

type ChartMetric='revenue'|'profit'|'orders'|'adSpend';
type TimelineBucket=TimelinePoint&{key:string;label:string;detail:string};

function timelineGranularity(days:number) { return days>=180?'mes':days>31?'semana':'día'; }
function aggregateTimeline(points:TimelinePoint[],days:number):TimelineBucket[] {
  const granularity=timelineGranularity(days);
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

function InteractiveTimelineChart({points,days,metric='revenue',mode='single',adCurrency='ARS',visualization='area'}:{points:TimelinePoint[];days:number;metric?:ChartMetric;mode?:'single'|'comparison';adCurrency?:string;visualization?:DashboardChartType}) {
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

export default function Panel() {
  const [currency,setCurrencyState]=useState<DisplayCurrency>('ARS');
  const [language,setLanguageState]=useState<DisplayLanguage>('es');
  const [rates,setRates]=useState<ExchangeRates>({ARS:1});
  const [rateSource,setRateSource]=useState('Cotización en pesos argentinos');
  async function refreshRates() {
    const response=await fetch('/api/finance/live-rates',{cache:'no-store'});
    if(!response.ok)return;
    const data=await response.json() as LiveRates;if(!data?.rates)return;
    const next={...data.rates,ARS:1} as ExchangeRates;
    setRates(next);setRateSource(data.source||'Cotización automática');
    window.localStorage.setItem('rentia-exchange-rates',JSON.stringify(next));
  }
  useEffect(()=>{void Promise.resolve().then(()=>{
    const savedCurrency=window.localStorage.getItem('rentia-display-currency') as DisplayCurrency|null;
    const savedLanguage=window.localStorage.getItem('rentia-display-language') as DisplayLanguage|null;
    const savedRates=window.localStorage.getItem('rentia-exchange-rates');
    if(savedCurrency&&['ARS','USD','EUR'].includes(savedCurrency))setCurrencyState(savedCurrency);
    if(savedLanguage&&['es','pt','en'].includes(savedLanguage))setLanguageState(savedLanguage);
    if(savedRates){try{setRates(JSON.parse(savedRates) as ExchangeRates);}catch{window.localStorage.removeItem('rentia-exchange-rates')}}
    void refreshRates().catch(()=>undefined);
  });},[]);
  useEffect(()=>{document.documentElement.lang=language;},[language]);
  const setCurrency=(value:DisplayCurrency)=>{setCurrencyState(value);window.localStorage.setItem('rentia-display-currency',value)};
  const setLanguage=(value:DisplayLanguage)=>{setLanguageState(value);window.localStorage.setItem('rentia-display-language',value)};
  const preferences={currency,language,rates,rateSource,setCurrency,setLanguage,refreshRates};
  return <PreferencesContext.Provider value={preferences}><PanelApp/></PreferencesContext.Provider>;
}

function PanelApp() {
  const {signOut,openUserProfile}=useClerk();
  const {user:profileUser,isLoaded:profileLoaded}=useUser();
  const money=useMoney();
  const t=useT();
  const {currency,language,rates,rateSource,setCurrency,setLanguage}=usePreferences();
  const [store,setStore]=useState('Tu tienda');
  const [accessRole,setAccessRole]=useState<'owner'|'admin'|'member'|null>(null);
  const managementRef=useRef(false);
  const canManage=accessRole==='owner'||accessRole==='admin';
  const [active,setActive]=useState('resumen');
  const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
  const [mobileNavOpen,setMobileNavOpen]=useState(false);
  const [settingsOpen,setSettingsOpen]=useState(true);
  const [period,setPeriod]=useState('30 días');
  const [periodOpen,setPeriodOpen]=useState(false);
  const [customRangeOpen,setCustomRangeOpen]=useState(false);
  const [customRange,setCustomRange]=useState<CustomDateRange|null>(null);
  const [rangeDraft,setRangeDraft]=useState<CustomDateRange>(defaultDateRange);
  const [rangeError,setRangeError]=useState('');
  const [currencyOpen,setCurrencyOpen]=useState(false);
  const [languageOpen,setLanguageOpen]=useState(false);
  const [dashboardMenuOpen,setDashboardMenuOpen]=useState(false);
  const [dashboardEditorOpen,setDashboardEditorOpen]=useState(false);
  const [dashboardLayout,setDashboardLayout]=useState<DashboardLayoutConfig>(defaultDashboardLayout);
  const [savingDashboard,setSavingDashboard]=useState(false);
  const [dashboardPreferenceMessage,setDashboardPreferenceMessage]=useState('');
  const [profileOpen,setProfileOpen]=useState(false);
  const toolbarRef=useRef<HTMLElement>(null);
  const [notice,setNotice]=useState('');
  const [integrations,setIntegrations]=useState<Integration[]>([]);
  const [integrationsLoaded,setIntegrationsLoaded]=useState(false);
  const [dashboard,setDashboard]=useState<Dashboard|null>(null);
  const [previousDashboard,setPreviousDashboard]=useState<Dashboard|null>(null);
  const [productAnalytics,setProductAnalytics]=useState<ProductAnalyticsRow[]>([]);
  const [syncing,setSyncing]=useState(false);
  const [syncMessage,setSyncMessage]=useState('');
  const [shipping,setShipping]=useState('');
  const [shippingMode,setShippingMode]=useState<'average_only'|'actual'>('actual');
  const [fees,setFees]=useState('');
  const [taxes,setTaxes]=useState('');
  const [pagoNubePayoutDays,setPagoNubePayoutDays]=useState('');
  const [pagoNubePlan,setPagoNubePlan]=useState('');
  const [detectedPlan,setDetectedPlan]=useState<string|null>(null);
  const [settingsState,setSettingsState]=useState('');
  const [settingsLoaded,setSettingsLoaded]=useState(false);
  const [costsLoaded,setCostsLoaded]=useState(false);
  const [savingSettings,setSavingSettings]=useState(false);
  const [expandedOrder,setExpandedOrder]=useState<string|null>(null);
  const [costRows,setCostRows]=useState<ProductCostRow[]>([]);
  const [costDraft,setCostDraft]=useState<Record<number,string>>({});
  const [costState,setCostState]=useState('');
  const [savingCosts,setSavingCosts]=useState(false);
  const [costRules,setCostRules]=useState<CostRule[]>([]);
  const [adsData,setAdsData]=useState<MetaAdsData|null>(null);
  const [syncingMeta,setSyncingMeta]=useState(false);
  const [metaMessage,setMetaMessage]=useState('');
  const syncingRef=useRef(false);
  const syncingMetaRef=useRef(false);
  const latestDashboard=useRef<Dashboard|null>(null);
  const latestAds=useRef<MetaAdsData|null>(null);
  const periodDaysRef=useRef(30);
  const activeRangeRef=useRef<CustomDateRange|null>(null);
  const mercadoLibreState=useMercadoLibreSync(canManage,()=>Promise.all([loadDashboard(periodDaysRef.current),loadProductCosts(),loadProductAnalytics(periodDaysRef.current)]));
  const [advertisingTab,setAdvertisingTab]=useState('meta');
  const productAdsState=useProductAds(canManage,analyticsQuery(periodOptions.find(option=>option.label===period)?.days||30,customRange),()=>loadDashboard(periodDaysRef.current));
  useEffect(()=>{if(new URLSearchParams(window.location.search).get('ads')==='mercadolibre')setAdvertisingTab('mercadolibre');},[]);

  async function loadDashboard(days=30,range=activeRangeRef.current) {
    const currentQuery=analyticsQuery(days,range);
    const previousQuery=range?analyticsQuery(days,previousDateRange(range)):`days=${days}&offset=${days}`;
    const [response,previousResponse]=await Promise.all([fetch(`/api/dashboard?${currentQuery}`),fetch(`/api/dashboard?${previousQuery}`)]);
    if (response.status===401) { window.location.href='/onboarding'; return null; }
    if (!response.ok) return null;
    const data=await response.json() as Dashboard;
    const previous=previousResponse.ok?await previousResponse.json() as Dashboard:null;
    latestDashboard.current=data;setDashboard(data);setPreviousDashboard(previous);return data;
  }

  async function loadDashboardPreferences() {
    const response=await fetch('/api/dashboard/preferences');
    if (!response.ok) return;
    const data=await response.json() as {layout:DashboardLayoutConfig|null};
    if (data.layout?.sections?.length) setDashboardLayout(data.layout);
  }

  async function saveDashboardPreferences(layout:DashboardLayoutConfig,closeEditor=true) {
    if(!managementRef.current)return;
    setSavingDashboard(true);setDashboardPreferenceMessage('Guardando…');
    const response=await fetch('/api/dashboard/preferences',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({layout})});
    if (response.ok) {
      const data=await response.json() as {layout:DashboardLayoutConfig};
      setDashboardLayout(data.layout);setDashboardPreferenceMessage('Dashboard guardado.');if(closeEditor)setDashboardEditorOpen(false);
    } else setDashboardPreferenceMessage('No pudimos guardar la configuración.');
    setSavingDashboard(false);
  }

  async function loadProductCosts() {
    const response=await fetch('/api/costs/products');
    if (!response.ok) return;
    const data=await response.json() as {products:ProductCostRow[]};
    setCostRows(data.products);
    setCostsLoaded(true);
    setCostDraft(Object.fromEntries(data.products.map(row=>[row.variant_id,row.manual_cost===null?'':String(row.manual_cost)])));
  }

  async function loadProductAnalytics(days=30,range=activeRangeRef.current) {
    const response=await fetch(`/api/products/analytics?${analyticsQuery(days,range)}`);
    if (!response.ok) return;
    const data=await response.json() as {products:ProductAnalyticsRow[]};
    setProductAnalytics(data.products);
  }

  async function loadCostRules() {
    const response=await fetch('/api/costs/rules');
    if (!response.ok) return;
    const data=await response.json() as {rules:CostRule[]};
    setCostRules(data.rules);
  }

  async function loadMetaAds(days=30,range=activeRangeRef.current) {
    const response=await fetch(`/api/ads?${analyticsQuery(days,range)}`);
    if (!response.ok) return null;
    const data=await response.json() as MetaAdsData;
    latestAds.current=data;setAdsData(data);return data;
  }

  async function runSync(silent=false) {
    if(!managementRef.current)return;
    if (syncingRef.current) return;
    syncingRef.current=true;
    setSyncing(true); if (!silent) setSyncMessage('Sincronizando órdenes y productos…');
    try {
      const response=await fetch('/api/sync/tiendanube',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({automatic:silent}),signal:AbortSignal.timeout(120000)});
      type CommissionProgress={checked:number;imported:number;unavailable:number;retry:number;remaining:number;missing:number;checkedBefore:string;retryAfterMs:number};
      let result=await response.json() as {orders?:number;products?:number;pending?:boolean;error?:string;skipped?:boolean;automatic?:boolean;automaticError?:string|null;commissions?:CommissionProgress};
      if (response.ok) {
        let batches=0;
        while(result.pending){
          if(result.skipped)await new Promise(resolve=>setTimeout(resolve,2000));
          if(!silent)setSyncMessage(`Importando historial: ${result.orders||0} órdenes y ${result.products||0} productos procesados. El avance queda guardado…`);
          const continuation=await fetch('/api/sync/tiendanube',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({automatic:true}),signal:AbortSignal.timeout(120000)});
          if(!continuation.ok)throw new Error('import_pending');
          result=await continuation.json() as typeof result;
          if(++batches%10===0)await loadDashboard(periodDaysRef.current).catch(()=>undefined);
        }
        if (!silent&&!result.skipped) {
          setSyncMessage(`Órdenes y productos actualizados. Revisando comisiones: ${result.commissions?.imported||0} importadas, ${result.commissions?.remaining||0} pendientes…`);
        }
        const commissions=result.commissions?{...result.commissions}:null;
        let stoppedEarly=false;
        let stalledAttempts=0;
        while(commissions&&commissions.remaining>0){
          const previousRemaining=commissions.remaining;
          if(commissions.retryAfterMs){
            if(!silent)setSyncMessage(`Tiendanube pidió una pausa. Reintentando automáticamente; ${commissions.remaining} comisiones por revisar…`);
            await new Promise(resolve=>setTimeout(resolve,Math.min(20000,commissions.retryAfterMs)));
          }
          let batchResponse:Response;
          let batch:{commissions?:CommissionProgress};
          try {
            batchResponse=await fetch('/api/sync/tiendanube/commissions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({checkedBefore:commissions.checkedBefore}),signal:AbortSignal.timeout(45000)});
            if(!batchResponse.ok)throw new Error('batch_failed');
            batch=await batchResponse.json() as {commissions?:CommissionProgress};
          } catch {
            if(++stalledAttempts>=3){stoppedEarly=true;break;}
            commissions.retryAfterMs=2000*stalledAttempts;
            continue;
          }
          if(!batch.commissions||!Number.isFinite(batch.commissions.remaining)){stoppedEarly=true;break;}
          commissions.checked+=batch.commissions.checked;
          commissions.imported+=batch.commissions.imported;
          commissions.unavailable+=batch.commissions.unavailable;
          commissions.retry+=batch.commissions.retry;
          commissions.remaining=batch.commissions.remaining;
          commissions.missing=batch.commissions.missing;
          commissions.retryAfterMs=batch.commissions.retryAfterMs;
          if(!silent)setSyncMessage(`Revisando comisiones: ${commissions.imported} reales importadas, ${commissions.remaining} por consultar${commissions.unavailable?`; ${commissions.unavailable} consultadas sin cargo informado`:''}…`);
          await loadDashboard(periodDaysRef.current).catch(()=>undefined);
          if(commissions.remaining>=previousRemaining){
            if(++stalledAttempts>=3){stoppedEarly=true;break;}
            commissions.retryAfterMs=commissions.retryAfterMs||2000;
          }else stalledAttempts=0;
        }
        if(!silent&&!result.skipped){
          const imported=commissions?.imported||0;
          const missing=commissions?.missing||0;
          const remaining=commissions?.remaining||0;
          const commissionNotice=remaining
            ? ` Comisiones reales importadas en ${imported} órdenes; ${remaining} siguen pendientes${stoppedEarly?' por un problema temporal':''}. Podés volver a actualizar para reintentarlas.`
            :` Revisión terminada: ${imported} comisiones reales importadas.${missing?` Quedan ${missing} órdenes sin cargo informado por Tiendanube; se volverán a consultar automáticamente y la ganancia sigue provisoria.`:' Todas las órdenes pagadas tienen su comisión real.'}`;
          const automaticNotice=result.automatic===false?' La conexión en tiempo real quedó pendiente y volveremos a intentarlo.':'';
          setSyncMessage(`Listo: ${result.orders||0} órdenes y ${result.products||0} productos actualizados.${commissionNotice}${automaticNotice}`);
        }
        await Promise.all([loadDashboard(periodDaysRef.current),loadProductCosts(),loadProductAnalytics(periodDaysRef.current),fetch('/api/settings').then(r=>r.ok?r.json() as Promise<{settings?:CostSettings}>:null).then(data=>{setPagoNubePlan(String(data?.settings?.pago_nube_plan_override||''));setDetectedPlan(data?.settings?.tiendanube_plan_name||null);})]);
      } else setSyncMessage(result.error||'No pudimos sincronizar Tiendanube.');
    } catch {
      setSyncMessage('La importación quedó pendiente. El avance está guardado; volvé a actualizar para continuar sin empezar de cero.');
      await loadDashboard(periodDaysRef.current).catch(()=>undefined);
    } finally {
      syncingRef.current=false;
      setSyncing(false);
    }
  }

  async function runMetaSync(silent=false) {
    if(!managementRef.current)return;
    if (syncingMetaRef.current) return;
    syncingMetaRef.current=true;setSyncingMeta(true);if(!silent)setMetaMessage('Sincronizando campañas y resultados de Meta…');
    try {
      const response=await fetch('/api/sync/meta',{method:'POST'});
      const result=await response.json() as {campaigns?:number;insights?:number;error?:string};
      if(response.ok){if(!silent)setMetaMessage(`Listo: ${result.campaigns||0} campañas y ${result.insights||0} registros diarios actualizados.`);await Promise.all([loadMetaAds(periodDaysRef.current),loadDashboard(periodDaysRef.current)]);}
      else setMetaMessage(result.error||'No pudimos sincronizar Meta Ads.');
    } catch { setMetaMessage('No pudimos consultar Meta Ads. Revisá la conexión e intentá nuevamente.'); }
    finally {syncingMetaRef.current=false;setSyncingMeta(false);}
  }

  async function changeMetaAccount(accountId:string) {
    if(!managementRef.current)return;
    if(syncingMetaRef.current)return;
    syncingMetaRef.current=true;setMetaMessage('Cambiando cuenta publicitaria y sincronizando…');setSyncingMeta(true);
    try {
      const response=await fetch('/api/integrations/meta/accounts',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({accountId})});
      if(response.ok){setMetaMessage('Cuenta publicitaria actualizada.');await Promise.all([loadMetaAds(periodDaysRef.current),loadDashboard(periodDaysRef.current)]);}
      else {const result=await response.json().catch(()=>({})) as {error?:string};setMetaMessage(result.error||'No pudimos cambiar la cuenta publicitaria.');}
    } catch {setMetaMessage('No pudimos cambiar la cuenta publicitaria. Revisá la conexión e intentá nuevamente.');}
    finally {syncingMetaRef.current=false;setSyncingMeta(false);}
  }

  useEffect(()=>{
    let tiendanubeConnected=false;
    let metaConnected=false;
    const initialWindow=analyticsRangeFromUrl(new URL(window.location.href));
    periodDaysRef.current=initialWindow.days;
    activeRangeRef.current=initialWindow.range||null;
    const frame=requestAnimationFrame(()=>{
      const params=new URLSearchParams(window.location.search);
      setCustomRange(initialWindow.range||null);
      setPeriod(periodOptions.find(option=>option.days===initialWindow.days)?.label||'30 días');
      setSidebarCollapsed(window.localStorage.getItem('rentia-sidebar-collapsed')==='1');
      if (params.get('section')) setActive(params.get('section')!);
      if (params.get('connected')==='tiendanube') { setActive('integraciones'); setNotice('Tiendanube se conectó correctamente.'); }
      if (params.get('automation')==='pending') { setActive('integraciones'); setNotice('Tiendanube está conectada. La actualización en tiempo real se activará automáticamente en el próximo reintento.'); }
      if (params.get('connected')==='meta') { setActive('integraciones'); setNotice('Meta Ads se conectó. Revisá en la tarjeta de Meta que la cuenta publicitaria elegida sea la que querés medir.'); }
      if (params.get('setup')==='meta') { setActive('integraciones'); setNotice('La integración está lista. Falta cargar el App ID y el App Secret de Meta en el servidor.'); }
      if (params.get('setup')==='mercadolibre_import') { setActive('integraciones'); setNotice('Mercado Libre autorizó el acceso. Importamos el historial por lotes y conservamos el avance. Los costos pendientes quedan identificados.'); }
      if (params.has('error')) {
        const meliErrors:Record<string,string>={
          mercadolibre_browser:'La validación de Mercado Libre venció o no llegó al volver. Iniciá la conexión nuevamente desde este navegador.',
          mercadolibre_session:'Tu sesión de Rentia cambió durante la autorización. Volvé a ingresar e iniciá la conexión nuevamente.',
          mercadolibre_state:'No pudimos validar el retorno de Mercado Libre. Iniciá una nueva conexión desde Rentia.',
          mercadolibre_denied:'No se autorizó el acceso a Mercado Libre. Podés iniciar la conexión nuevamente cuando quieras.',
          mercadolibre_oauth:'Mercado Libre no envió un código válido. Iniciá una nueva conexión desde Rentia.',
          mercadolibre_connection:'No pudimos completar la conexión con Mercado Libre. Intentá nuevamente; si persiste, revisaremos la configuración.',
          mercadolibre_app_credentials:'Mercado Libre rechazó las credenciales de la aplicación Rentia. Debemos revisar su configuración; volver a autorizar no lo resuelve.',
          mercadolibre_grant:'Mercado Libre rechazó el código de autorización. Iniciá una conexión nueva; si se repite, debemos revisar la dirección de retorno y la configuración.',
          mercadolibre_permissions:'Mercado Libre no habilitó los permisos necesarios para esta aplicación. Debemos revisar sus accesos.',
          mercadolibre_app_blocked:'Mercado Libre informó que la aplicación está bloqueada. Debemos revisar su estado en Developers.',
          mercadolibre_operator:'Autorizá con la cuenta principal de Mercado Libre, no con un usuario colaborador u operador.',
          mercadolibre_access:'Mercado Libre rechazó el acceso desde el servidor. Debemos revisar sus restricciones; volver a autorizar no garantiza resolverlo.',
          mercadolibre_temporary:'No pudimos obtener la autorización por una pausa o problema de conexión con Mercado Libre. Esperá un momento e iniciá una conexión nueva.',
          mercadolibre_account_conflict:'Esta cuenta de Mercado Libre ya está vinculada a otra tienda de Rentia, o tu tienda tiene otro vendedor conectado.',
        };
        setActive('integraciones');
        setNotice(meliErrors[params.get('error')||'']||'No pudimos completar la conexión. Revisá los permisos e intentá nuevamente.');
      }
    });
    const accountReady=fetch('/api/account').then(async response=>{
      if (response.status===401) { window.location.href='/onboarding'; return; }
      if(!response.ok)throw new Error('account');
      const data=await response.json() as {user?:{role:string};account?:{email?:string;store_name?:string}};
      if (!data.account||data.account.email?.endsWith('@rentia.invalid')) { window.location.href='/onboarding'; return; }
      setStore(data.account.store_name||'Tu tienda');
      const role=data.user?.role;
      setAccessRole(role==='owner'||role==='admin'?role:'member');
      managementRef.current=role==='owner'||role==='admin';
    }).catch(()=>window.location.href='/onboarding');
    fetch('/api/settings').then(response=>{if(!response.ok)throw new Error('settings');return response.json() as Promise<{settings?:CostSettings}>;}).then(data=>{const settings=data?.settings;if(!settings)throw new Error('settings');setShipping(String(settings.shipping_cost_ars||''));setShippingMode(settings.shipping_mode==='average_only'?'average_only':'actual');setFees(String(settings.commission_percent||''));setTaxes(String(settings.tax_percent||''));setPagoNubePayoutDays(settings.pago_nube_payout_days?String(settings.pago_nube_payout_days):'');setPagoNubePlan(String(settings.pago_nube_plan_override||''));setDetectedPlan(settings.tiendanube_plan_name||null);setSettingsLoaded(true);}).catch(()=>setSettingsState('No pudimos cargar los valores guardados. Recargá la página antes de editarlos.'));
    fetch('/api/integrations').then(r=>r.ok?r.json() as Promise<{integrations?:Integration[]}>:null).then(async data=>{
      if(!data?.integrations)return;
      const connected:Integration[]=data.integrations; setIntegrations(connected);setIntegrationsLoaded(true);
      await accountReady;
      tiendanubeConnected=connected.some(item=>item.provider==='tiendanube'&&item.status==='connected');
      metaConnected=connected.some(item=>item.provider==='meta'&&item.status==='connected');
      const [current,,,,currentAds]=await Promise.all([loadDashboard(periodDaysRef.current),loadProductCosts(),loadProductAnalytics(periodDaysRef.current),loadCostRules(),loadMetaAds(periodDaysRef.current),loadDashboardPreferences()]);
      if (tiendanubeConnected&&(automaticSyncDue(current?.sync)||(current?.sync?.details_version||0)<7||current?.sync?.webhook_status!=='active'||current?.sync?.status==='error')) void runSync(true);
      if (metaConnected&&currentAds?.selected&&(automaticSyncDue(currentAds.sync)||(currentAds.sync?.details_version||0)<2)) void runMetaSync(true);
    });
    const refreshTimer=window.setInterval(()=>{if ((tiendanubeConnected||metaConnected)&&document.visibilityState==='visible') void loadDashboard(periodDaysRef.current);},30_000);
    const syncTimer=window.setInterval(()=>{if (tiendanubeConnected&&document.visibilityState==='visible') void runSync(true);},15*60_000);
    const syncWhenVisible=()=>{
      if(document.visibilityState!=='visible')return;
      if(tiendanubeConnected||metaConnected)void loadDashboard(periodDaysRef.current);
      if(tiendanubeConnected&&automaticSyncDue(latestDashboard.current?.sync))void runSync(true);
      if(metaConnected&&latestAds.current?.selected&&automaticSyncDue(latestAds.current.sync))void runMetaSync(true);
    };
    const metaTimer=window.setInterval(()=>{if(metaConnected&&document.visibilityState==='visible')void runMetaSync(true);},15*60_000);
    document.addEventListener('visibilitychange',syncWhenVisible);
    return ()=>{cancelAnimationFrame(frame);window.clearInterval(refreshTimer);window.clearInterval(syncTimer);window.clearInterval(metaTimer);document.removeEventListener('visibilitychange',syncWhenVisible);};
    // Initial account and sync bootstrap only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  function selectSection(section:string) { setActive(section);setMobileNavOpen(false);setProfileOpen(false);setPeriodOpen(false);setCustomRangeOpen(false);setCurrencyOpen(false);setLanguageOpen(false);setDashboardMenuOpen(false);history.replaceState(null,'',`/panel?section=${section}`); }

  function toggleSidebar() {
    setSidebarCollapsed(current=>{
      const next=!current;
      window.localStorage.setItem('rentia-sidebar-collapsed',next?'1':'0');
      return next;
    });
  }

  async function saveSettings(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(!managementRef.current||!settingsLoaded||savingSettings)return;
    const shippingValue=parseCost(shipping||'0'),feeValue=parseCost(fees||'0'),taxValue=parseCost(taxes||'0');
    if(!Number.isFinite(shippingValue)||shippingValue<0||!Number.isFinite(feeValue)||feeValue<0||feeValue>100||!Number.isFinite(taxValue)||taxValue<0||taxValue>100){setSettingsState('Revisá los montos. Los porcentajes deben estar entre 0 y 100.');return;}
    setSavingSettings(true);setSettingsState('Guardando…');
    try {
      const response=await fetch('/api/settings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'costs',shipping:shippingValue,shippingMode,fees:feeValue,taxes:taxValue,pagoNubePayoutDays,pagoNubePlan})});
      if(!response.ok){setSettingsState('No se guardaron los cambios. Revisá los valores y tus permisos.');return;}
      setSettingsState('Configuración guardada. La rentabilidad histórica fue recalculada.');
      await Promise.all([loadDashboard(periodDaysRef.current),loadProductAnalytics(periodDaysRef.current)]);
    } catch {setSettingsState('No pudimos confirmar el guardado. Revisá tu conexión y recargá para verificar los valores.');}
    finally {setSavingSettings(false);}
  }

  async function refreshCostConfiguration() {
    await Promise.all([loadCostRules(),loadDashboard(periodDaysRef.current),loadProductAnalytics(periodDaysRef.current)]);
  }

  async function saveProductCosts() {
    if(!managementRef.current)return;
    // Only the variants whose cost changed, so large catalogs stay small requests.
    const updates=costRows.filter(row=>(costDraft[row.variant_id]?.trim()||'')!==(row.manual_cost===null?'':String(row.manual_cost))).map(row=>{
      const value=costDraft[row.variant_id]?.trim()||'';
      return {variantId:row.variant_id,manualCost:value===''?null:parseCost(value)};
    });
    if (!updates.length) { setCostState('No hay cambios para guardar.'); return; }
    if (updates.some(update=>update.manualCost!==null&&(!Number.isFinite(update.manualCost)||update.manualCost<0))) { setCostState('Revisá los costos ingresados.'); return; }
    setSavingCosts(true);setCostState('Guardando y recalculando ventas anteriores…');
    const response=await fetch('/api/costs/products',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({updates})});
    if (response.ok) {
      await Promise.all([loadProductCosts(),loadDashboard(periodDaysRef.current),loadProductAnalytics(periodDaysRef.current)]);
      setCostState('Costos guardados. Todo el historial ya usa estos valores.');
    } else setCostState('No pudimos guardar los costos. Intentá nuevamente.');
    setSavingCosts(false);
  }

  async function logout() { await fetch('/api/auth/logout',{method:'POST'});await signOut({redirectUrl:'/'}); }

  function openAccountSettings() {
    setProfileOpen(false);setMobileNavOpen(false);
    if (!profileLoaded) return;
    if (!profileUser) {window.location.href='/ingresar';return;}
    openUserProfile({appearance:accountAppearance,apiKeysProps:{hide:true}});
  }

  function changePeriod(days:number) {
    const next=periodOptions.find(option=>option.days===days)||periodOptions[1];
    periodDaysRef.current=next.days;activeRangeRef.current=null;setCustomRange(null);setPeriod(next.label);setPeriodOpen(false);setCustomRangeOpen(false);
    void Promise.all([loadDashboard(next.days,null),loadProductAnalytics(next.days,null),loadMetaAds(next.days,null)]);
  }

  useEffect(()=>{
    if (!periodOpen&&!customRangeOpen&&!currencyOpen&&!languageOpen&&!dashboardMenuOpen&&!profileOpen) return;
    const close=()=>{setPeriodOpen(false);setCustomRangeOpen(false);setCurrencyOpen(false);setLanguageOpen(false);setDashboardMenuOpen(false);setProfileOpen(false);};
    const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!toolbarRef.current?.contains(event.target))close();};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){const trigger=toolbarRef.current?.querySelector<HTMLButtonElement>('button[aria-expanded="true"]');close();trigger?.focus();}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[periodOpen,customRangeOpen,currencyOpen,languageOpen,dashboardMenuOpen,profileOpen]);

  function applyCustomRange(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const days=inclusiveRangeDays(rangeDraft);
    if (!rangeDraft.start||!rangeDraft.end||days<1) {setRangeError('La fecha desde debe ser anterior a la fecha hasta.');return;}
    if (days>731) {setRangeError('Podés consultar hasta 2 años por vez.');return;}
    const next={...rangeDraft};
    periodDaysRef.current=days;activeRangeRef.current=next;setCustomRange(next);setPeriod(formatDisplayRange(next,locales[language]));setRangeError('');setPeriodOpen(false);setCustomRangeOpen(false);
    void Promise.all([loadDashboard(days,next),loadProductAnalytics(days,next),loadMetaAds(days,next)]);
  }

  function applyDashboardPreset(preset:keyof typeof dashboardPresets) {
    const next=structuredClone(dashboardPresets[preset]);
    setDashboardLayout(next);setDashboardMenuOpen(false);
    void saveDashboardPreferences(next);
  }

  const tiendanube=integrations.find(item=>item.provider==='tiendanube'&&item.status==='connected');
  const meta=integrations.find(item=>item.provider==='meta'&&item.status==='connected');
  const hasSalesConnection=Boolean(tiendanube||integrations.some(item=>item.provider==='mercadolibre'&&['authorized','connected'].includes(mercadoLibreState.view?.connection?.status||item.status)));
  const connections=connectionHealth({loaded:integrationsLoaded,integrations,tiendanube:dashboard?.sync||null,meta:dashboard?.ads?.sync||adsData?.sync||null,metaSelected:Boolean(dashboard?.ads?.selected||adsData?.selected),mercadolibre:mercadoLibreState.view,tiendanubeRunning:syncing,metaRunning:syncingMeta,meliRunning:mercadoLibreState.running,meliError:mercadoLibreState.error});
  const activeLabel=t(sections.find(item=>item.id===active)?.label||'Configuración');
  const settingsActive=configurationSections.some(item=>item.id===active);
  const storeInitials=store.split(/\s+/).filter(Boolean).map(word=>word[0]).join('').slice(0,2).toUpperCase()||'R';
  const selectedPeriodDays=customRange?inclusiveRangeDays(customRange):(periodOptions.find(option=>option.label===period)?.days||30);
  const displayRange=customRange||rollingDisplayRange(selectedPeriodDays);
  const displayPeriod=formatDisplayRange(displayRange,locales[language]);
  const dashboardModeLabel=dashboardLayout.sections.length===1&&['profitability','advertising','operation'].includes(dashboardLayout.sections[0].id)?dashboardLayout.sections[0].title:'Personalizado';

  return <AccessContext.Provider value={canManage}><main className={`appPage ${sidebarCollapsed?'sidebarCollapsed':''} ${mobileNavOpen?'mobileNavOpen':''}`}>
    <aside className="appSidebar">
      <a className="brand sidebarBrand" href="/panel?section=resumen" title="Rentia"><span className="brandMark"><img src="/favicon.svg" alt=""/></span><span>Rentia</span></a>
      <button type="button" className="mobileSidebarClose" onClick={()=>setMobileNavOpen(false)} aria-label="Cerrar navegación"><X aria-hidden="true"/></button>
      <button type="button" className="sidebarCollapse" onClick={toggleSidebar} aria-label={sidebarCollapsed?'Expandir menú':'Contraer menú'} title={sidebarCollapsed?'Expandir menú':'Contraer menú'}><ChevronLeft aria-hidden="true"/></button>
      <div className="sidebarScroll">
        <nav aria-label="Navegación principal">
          <div className="sidebarGroup"><small>{t('RESUMEN')}</small>{overviewSections.map(item=><SidebarNavItem key={item.id} item={item} active={active===item.id} onSelect={selectSection}/>)}</div>
          <div className="sidebarGroup"><small>{t('OPERACIÓN')}</small>{operationSections.map(item=><SidebarNavItem key={item.id} item={item} active={active===item.id} onSelect={selectSection}/>)}</div>
          <div className={`sidebarConfiguration ${settingsOpen?'open':''} ${settingsActive?'active':''}`}>
            <button type="button" className="sidebarGroupToggle" onClick={()=>{if(sidebarCollapsed){setSidebarCollapsed(false);window.localStorage.setItem('rentia-sidebar-collapsed','0');setSettingsOpen(true);}else setSettingsOpen(current=>!current);}} title={t('Configuración')} aria-expanded={settingsOpen}>
              <Settings2 aria-hidden="true" strokeWidth={1.8}/><span>{t('Configuración')}</span><ChevronDown className="sidebarChevron" aria-hidden="true"/>
            </button>
            {settingsOpen&&<div className="sidebarSubnav">{configurationSections.map(item=><SidebarNavItem key={item.id} item={item} active={active===item.id} onSelect={selectSection}/>)}</div>}
          </div>
        </nav>
      </div>
      <div className="sidebarFooter">
        <ConnectionStatus health={connections} onOpen={()=>selectSection('integraciones')} translate={t}/>
        <button type="button" className="sidebarAccount" onClick={openAccountSettings} disabled={!profileLoaded} title="Configuración de mi cuenta" aria-label="Configuración de mi cuenta">
          <b>{storeInitials}</b><span><strong>{store}</strong><small>{t('Cuenta Rentia')}</small></span><Settings2 aria-hidden="true"/>
        </button>
      </div>
    </aside>
    <button type="button" className="mobileNavBackdrop" onClick={()=>setMobileNavOpen(false)} aria-label="Cerrar navegación"/>
    <section className="appContent">
      <header className="panelToolbar" ref={toolbarRef}><button type="button" className="mobileMenuButton" onClick={()=>setMobileNavOpen(true)} aria-label="Abrir navegación"><Menu aria-hidden="true"/></button><div className="appHeaderTitle"><span className="muted">{activeLabel}</span><h1 title={store}>{store}</h1></div><div className="appHeaderActions">
        <div className="periodMenu headerControl"><button type="button" onClick={()=>{setPeriodOpen(current=>!current);setCustomRangeOpen(false);setCurrencyOpen(false);setLanguageOpen(false);setDashboardMenuOpen(false);setProfileOpen(false);}} aria-label={`${t('Período')}: ${displayPeriod}`} title={customRange?t('Rango personalizado'):`${t('Últimos')} ${t(period)}`} aria-expanded={periodOpen||customRangeOpen}><CalendarDays aria-hidden="true"/><span>{displayPeriod}</span><ChevronDown aria-hidden="true"/></button>{periodOpen&&<div className="controlMenu periodOptions">{periodOptions.map(option=><button type="button" key={option.days} className={!customRange&&selectedPeriodDays===option.days?'selected':''} onClick={()=>changePeriod(option.days)}><span>{t(option.days===90?'Trimestre':option.days===365?'Año':option.label)}<small>{formatDisplayRange(rollingDisplayRange(option.days),locales[language])}</small></span>{!customRange&&selectedPeriodDays===option.days&&<b>✓</b>}</button>)}<button type="button" className={customRange?'selected customOption':'customOption'} onClick={()=>{setRangeDraft(customRange||displayRange);setRangeError('');setPeriodOpen(false);setCustomRangeOpen(true);}}><span>{t('Personalizado')}</span>{customRange&&<b>✓</b>}</button></div>}{customRangeOpen&&<form className="dateRangeMenu" onSubmit={applyCustomRange}><strong>{t('Rango personalizado')}</strong><label>{t('Desde')}<input type="date" value={rangeDraft.start} max={rangeDraft.end} onChange={event=>setRangeDraft(current=>({...current,start:event.target.value}))} required/></label><label>{t('Hasta')}<input type="date" value={rangeDraft.end} min={rangeDraft.start} max={new Date().toISOString().slice(0,10)} onChange={event=>setRangeDraft(current=>({...current,end:event.target.value}))} required/></label>{rangeError&&<small>{rangeError}</small>}<div><button type="button" onClick={()=>{setCustomRangeOpen(false);setRangeError('');}}>{t('Cancelar')}</button><button type="submit">{t('Aplicar')}</button></div></form>}</div>
        <div className="preferenceMenu currencyMenu headerControl" title={`${rateSource}${rates[currency]?` · 1 ${currency} = ${new Intl.NumberFormat('es-AR',{maximumFractionDigits:2}).format(rates[currency]||1)} ARS`:''}`}><button type="button" onClick={()=>{setCurrencyOpen(current=>!current);setLanguageOpen(false);setPeriodOpen(false);setCustomRangeOpen(false);setDashboardMenuOpen(false);setProfileOpen(false);}} aria-label="Moneda de visualización" aria-expanded={currencyOpen}><Coins aria-hidden="true"/><span>{currency}</span><ChevronDown aria-hidden="true"/></button>{currencyOpen&&<div className="controlMenu">{(['ARS','USD','EUR'] as DisplayCurrency[]).map(value=><button type="button" key={value} className={currency===value?'selected':''} disabled={!rates[value]} onClick={()=>{setCurrency(value);setCurrencyOpen(false);}}><span>{value}</span>{currency===value&&<b>✓</b>}</button>)}</div>}</div>
        <div className="preferenceMenu languageMenu headerControl"><button type="button" onClick={()=>{setLanguageOpen(current=>!current);setCurrencyOpen(false);setPeriodOpen(false);setCustomRangeOpen(false);setDashboardMenuOpen(false);setProfileOpen(false);}} aria-label="Idioma" aria-expanded={languageOpen}><Languages aria-hidden="true"/><span>{language.toUpperCase()}</span><ChevronDown aria-hidden="true"/></button>{languageOpen&&<div className="controlMenu">{([['es','Español'],['pt','Português'],['en','English']] as const).map(([value,label])=><button type="button" key={value} className={language===value?'selected':''} onClick={()=>{setLanguage(value);setLanguageOpen(false);}}><span>{label}</span>{language===value&&<b>✓</b>}</button>)}</div>}</div>
        {active==='resumen'&&canManage&&<div className="preferenceMenu dashboardMenu headerControl"><button type="button" onClick={()=>{setDashboardMenuOpen(current=>!current);setLanguageOpen(false);setCurrencyOpen(false);setPeriodOpen(false);setCustomRangeOpen(false);setProfileOpen(false);}} aria-label="Vista del dashboard" aria-expanded={dashboardMenuOpen}><LayoutGrid aria-hidden="true"/><span>{dashboardModeLabel}</span><ChevronDown aria-hidden="true"/></button>{dashboardMenuOpen&&<div className="controlMenu dashboardViewMenu"><small>VISTAS RÁPIDAS</small><button type="button" onClick={()=>applyDashboardPreset('profitability')}><span>Rentabilidad</span></button><button type="button" onClick={()=>applyDashboardPreset('advertising')}><span>Publicidad</span></button><button type="button" onClick={()=>applyDashboardPreset('operation')}><span>Operación</span></button><button type="button" className="editDashboardOption" onClick={()=>{setDashboardMenuOpen(false);setDashboardEditorOpen(true);setDashboardPreferenceMessage('');}}><Pencil aria-hidden="true"/><span>Personalizar dashboard</span></button></div>}</div>}
        <div className="accountMenuAnchor"><button type="button" className="appAvatar" onClick={()=>{setProfileOpen(current=>!current);setPeriodOpen(false);setCustomRangeOpen(false);setCurrencyOpen(false);setLanguageOpen(false);setDashboardMenuOpen(false);}} aria-label="Abrir mi cuenta" aria-expanded={profileOpen}>{profileUser?.imageUrl?<img src={profileUser.imageUrl} alt=""/>:storeInitials}</button>{profileOpen&&<div className="profileMenu accountProfileMenu"><div className="accountProfileIdentity"><b>{profileUser?.fullName||'Mi cuenta'}</b><span>{profileUser?.primaryEmailAddress?.emailAddress||'Perfil personal de Rentia'}</span></div><button type="button" className="accountSettingsAction" onClick={openAccountSettings} disabled={!profileLoaded}><ShieldCheck aria-hidden="true"/><span><strong>Administrar mi cuenta</strong><small>Perfil, seguridad y dispositivos</small></span></button><div className="accountStoreContext"><small>TIENDA ACTUAL</small><span>{store}</span></div><button type="button" className="logoutButton" onClick={logout}>{t('Cerrar sesión')}</button></div>}</div>
      </div></header>

      {accessRole==='member'&&<div className="readOnlyNotice"><ShieldCheck size={18}/><span><b>Acceso de consulta</b> Podés ver datos y exportar informes. Los cambios los realiza el propietario o un administrador.</span></div>}
      <fieldset className="managementFields" disabled={!canManage&&['costos','configuracion','moneda','integraciones'].includes(active)}>
      {active==='equipo'?<TeamSection onPlans={()=>selectSection('plan')}/>:active==='resumen'?<>
        {integrationsLoaded&&!hasSalesConnection&&<div className="setupNotice"><span>1</span><div><b>{t('Conectá tu tienda para empezar')}</b><p>Enlazar el canal es independiente de cargar envío, comisiones e impuestos.</p></div><button onClick={()=>selectSection('integraciones')}>Ver conexiones</button></div>}
        <ConnectionNotice health={connections} onOpen={()=>selectSection('integraciones')}/>
        {settingsLoaded&&costsLoaded&&dashboard&&<SetupChecklist connected={hasSalesConnection} productCount={costRows.filter(row=>!row.rentia_archived).length} missingProductCosts={costRows.filter(row=>!row.rentia_archived&&row.cost_source==='sin_costo').length} costsConfigured={dashboard.quality.configurationSaved} adsConnected={Boolean(meta&&adsData?.selected)} canManage={canManage} onNavigate={selectSection}/>}
        <DashboardOverview dashboard={dashboard} previousDashboard={previousDashboard} syncing={syncing} days={selectedPeriodDays} layout={dashboardLayout} savingLayout={savingDashboard} onNavigate={selectSection} onEdit={()=>{setDashboardEditorOpen(true);setDashboardPreferenceMessage('');}} onLayoutReorder={next=>{setDashboardLayout(next);void saveDashboardPreferences(next,false);}} onChartChange={chart=>{const next={...dashboardLayout,chart};setDashboardLayout(next);void saveDashboardPreferences(next,false);}}/>
      </>:active==='acciones'?<DecisionCenter dashboard={dashboard} products={productAnalytics.filter(row=>!row.rentia_archived)} costs={costRows.filter(row=>!row.rentia_archived)} ads={adsData} onNavigate={selectSection}/>
      :active==='calidad'?<DataQualitySection dashboard={dashboard} onNavigate={selectSection}/>
      :active==='informes'?<ReportsSection dashboard={dashboard} products={productAnalytics} ads={adsData} period={displayPeriod} days={selectedPeriodDays} onPeriodChange={changePeriod}/>
      :active==='ordenes'?<OrdersSection orders={dashboard?.orders||[]} days={periodDaysRef.current} range={activeRangeRef.current} refreshKey={dashboard} period={displayPeriod} syncing={syncing} onSync={()=>void runSync()} onRefresh={()=>loadDashboard(periodDaysRef.current)} expandedOrder={expandedOrder} setExpandedOrder={setExpandedOrder}/>
      :active==='productos'?<ProductAnalyticsSection rows={productAnalytics.filter(row=>!row.rentia_archived)} period={displayPeriod} syncing={syncing} onSync={()=>void runSync()}/>
      :active==='inventario'?<InventorySection rows={productAnalytics.filter(row=>!row.rentia_archived)} period={displayPeriod} syncing={syncing} onSync={()=>void runSync()}/>
      :active==='lifetime'?<ComingSoonSection eyebrow="CLIENTES Y RECOMPRA" title="Lifetime Value" description="Acá vas a analizar cohortes, recompra y valor acumulado de cada cliente. Se habilitará después de consolidar el historial multicanal." action="Ver órdenes" onAction={()=>selectSection('ordenes')}/>
      :active==='publicidad'?<><div className="advertisingTabs" role="tablist" aria-label="Plataforma publicitaria"><button role="tab" aria-selected={advertisingTab==='meta'} className={advertisingTab==='meta'?'active':''} onClick={()=>setAdvertisingTab('meta')}>Meta Ads</button><button role="tab" aria-selected={advertisingTab==='mercadolibre'} className={advertisingTab==='mercadolibre'?'active':''} onClick={()=>setAdvertisingTab('mercadolibre')}>Mercado Libre · Product Ads</button></div>{advertisingTab==='mercadolibre'?<ProductAds state={productAdsState} canManage={canManage} money={money}/>:<AdvertisingSection connected={Boolean(meta)} data={adsData} dashboard={dashboard} period={displayPeriod} syncing={syncingMeta} message={metaMessage} onSync={()=>void runMetaSync()} onConnect={()=>selectSection('integraciones')} onAccountChange={accountId=>void changeMetaAccount(accountId)}/>}</>
      :active==='costos'?<ProductCosts rows={costRows} draft={costDraft} onDraft={updates=>setCostDraft(current=>({...current,...updates}))} onSave={()=>void saveProductCosts()} saving={savingCosts} message={costState} onMessage={setCostState} onChanged={()=>Promise.all([loadProductCosts(),loadProductAnalytics(periodDaysRef.current)])} canManage={canManage} money={money}/>
      :active==='facturacion'?<ExternalRevenueSection onChanged={()=>loadDashboard(periodDaysRef.current)}/>
      :active==='moneda'?<ExchangeRateSection onChanged={()=>loadDashboard(periodDaysRef.current)}/>
      :active==='integraciones'?<section className="integrationsPage">
        <div><span className="muted">CONEXIONES</span><h2>Integraciones</h2><p>Autorizá cada plataforma por separado. Rentia nunca pide ni guarda la contraseña de tus cuentas.</p></div>
        {notice&&<div className="integrationNotice">{notice}</div>}
        {syncMessage&&<div className={`integrationNotice ${dashboard?.sync?.status==='error'?'warning':''}`}>{syncMessage}</div>}
        {dashboard?.sync?.last_error&&<div className="integrationNotice warning">No pudimos completar la última actualización de Tiendanube. El historial guardado se conserva.</div>}
        {dashboard?.sync?.webhook_error&&<div className="integrationNotice">La tienda está conectada, pero la actualización en tiempo real sigue pendiente. Podés usar “Actualizar ahora” mientras Rentia vuelve a intentarlo automáticamente.</div>}
        {Boolean(dashboard?.sync?.reliability?.events.failed)&&<div className="integrationNotice warning"><b>Recuperación automática en curso</b><span>{dashboard?.sync?.reliability?.events.failed} evento{dashboard?.sync?.reliability?.events.failed===1?'':'s'} de Tiendanube no se pudo procesar todavía. Rentia conserva el evento y lo volverá a intentar durante la próxima conciliación.</span></div>}
        <div className="integrationCards">
          <article className={tiendanube?'integrationConnected':''}><span className="integrationLogo tn"><img src="/brands/tiendanube-icon.png" alt="" aria-hidden="true"/></span><div><h3>Tiendanube</h3><p>Órdenes, productos, costos por SKU, envíos y comisiones reales de cada transacción.</p><small>{tiendanube?`${automaticSyncLabel(dashboard?.sync||null)} · cargos de Pago Nube automáticos`:'OAuth 2 · conexión segura'}</small>{tiendanube&&<ConnectionUpdatedAt value={dashboard?.sync?.last_completed_at}/>}</div>{tiendanube?<div className="integrationActions"><span className="statusPill">✓ Conectada</span><button className="outline" onClick={()=>void runSync()} disabled={syncing}>{syncing?'Actualizando…':'Actualizar ahora'}</button></div>:<a className="button" href="/api/integrations/tiendanube/start">Conectar</a>}</article>
          <MercadoLibreIntegration state={mercadoLibreState} canManage={canManage} onBilling={()=>selectSection('cargos-meli')}/>
          <article className={meta?'integrationConnected':''}><span className="integrationLogo meta"><img className="platformMark" src="/brands/meta.png" alt=""/></span><div><h3>Meta Ads</h3><p>Inversión, compras atribuidas, ROAS, CPA y rendimiento por campaña.</p><small>{meta?`${adsData?.selected?.name||'Cuenta conectada'} · ${syncingMeta?'actualizando':'sincronización periódica mientras usás Rentia'}`:'OAuth 2 · permisos de solo lectura'}</small>{meta&&<ConnectionUpdatedAt value={dashboard?.ads?.sync?.last_completed_at||adsData?.sync?.last_completed_at}/>}{meta&&!!adsData?.accounts.length&&<div className="metaAccountChoice"><MetaAccountPicker accounts={adsData.accounts} value={adsData.selected?.external_account_id||''} onChange={accountId=>void changeMetaAccount(accountId)} disabled={syncingMeta||!canManage}/><small>{adsData.accounts.length>1?`Encontramos ${adsData.accounts.length} cuentas publicitarias. Elegí la que querés medir; podés cambiarla cuando quieras.`:'Es la única cuenta publicitaria de tu usuario de Meta.'}</small>{metaMessage&&<small aria-live="polite">{metaMessage}</small>}</div>}</div>{meta?<div className="integrationActions"><span className="statusPill">✓ Conectada</span><button className="outline" onClick={()=>void runMetaSync()} disabled={syncingMeta}>{syncingMeta?'Actualizando…':'Actualizar ahora'}</button></div>:<a className="button" href="/api/integrations/meta/start">Conectar</a>}</article>
        </div>
      </section>
      :active==='cargos-meli'?<MeliBilling canManage={canManage} onBack={()=>selectSection('integraciones')}/>
      :active==='plan'?<SubscriptionSection/>
      :active==='configuracion'?<section className="settingsPage deliveryPage">
        <header className="deliveryPageHeading"><span className="muted">CÁLCULO DE RENTABILIDAD</span><h2>Envíos y comisiones</h2><p>Todos tus costos, en un solo lugar. Elegí cómo calcularlos y separá los importados de los personalizados.</p></header>
        <ShippingCommissionSettings shipping={shipping} shippingMode={shippingMode} fees={fees} taxes={taxes} pagoNubePlan={pagoNubePlan} detectedPlan={detectedPlan} pagoNubePayoutDays={pagoNubePayoutDays} connected={integrations.some(item=>item.provider==='tiendanube'&&item.status==='connected')} loaded={settingsLoaded} saving={savingSettings} message={settingsState}
          onShipping={value=>{setShipping(value);setSettingsState('')}} onShippingMode={value=>{setShippingMode(value);setSettingsState('')}} onFees={value=>{setFees(value);setSettingsState('')}} onTaxes={value=>{setTaxes(value);setSettingsState('')}} onPlan={value=>{setPagoNubePlan(value);setSettingsState('')}} onPayout={value=>{setPagoNubePayoutDays(value);setSettingsState('')}} onSubmit={saveSettings}/>
        <AdvancedCostRules rules={costRules} paymentMethods={dashboard?.paymentMethods||[]} onChanged={refreshCostConfiguration}/>
      </section>
      :<ComingSoonSection eyebrow="PRÓXIMAMENTE" title="Esta sección está en desarrollo" description="Seguimos construyendo el análisis multicanal de Rentia." action="Volver al resumen" onAction={()=>selectSection('resumen')}/>}
      </fieldset>
    </section>
    {canManage&&dashboardEditorOpen&&<DashboardEditor layout={dashboardLayout} saving={savingDashboard} message={dashboardPreferenceMessage} onClose={()=>setDashboardEditorOpen(false)} onSave={layout=>void saveDashboardPreferences(layout)} onPreview={setDashboardLayout}/>}
  </main></AccessContext.Provider>;
}

function SubscriptionSection() {
  const [data,setData]=useState<SubscriptionData|null>(null);
  const [annual,setAnnual]=useState(false);
  const [message,setMessage]=useState('');
  const [saving,setSaving]=useState<string|null>(null);

  async function loadSubscription() {
    try {
      const response=await fetch('/api/subscription');
      if (!response.ok) {setMessage('No pudimos cargar el plan de la cuenta.');return;}
      const next=await response.json() as SubscriptionData;
      setData(next);setAnnual(next.subscription.billingCycle==='annual');
    } catch {setMessage('No pudimos cargar el plan. Revisá tu conexión e intentá nuevamente.');}
  }
  useEffect(()=>{void Promise.resolve().then(loadSubscription);},[]);

  async function choosePlan(planId:string) {
    if (!data?.canManage) return;
    setSaving(planId);setMessage('');
    try {
      const response=await fetch('/api/subscription',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({planId,billingCycle:annual?'annual':'monthly'})});
      const result=await response.json().catch(()=>({})) as SubscriptionData&{error?:string};
      if (!response.ok) {setMessage(result.error==='forbidden'?'Solo el propietario o un administrador puede elegir el plan.':'No pudimos guardar tu elección.');return;}
      setData(result);setMessage(result.message||'Elección guardada.');
    } catch {setMessage('No pudimos guardar tu elección. Revisá tu conexión e intentá nuevamente.');}
    finally {setSaving(null);}
  }

  if (!data) return <section className="subscriptionPage"><div className="subscriptionLoading">{message||'Cargando plan y consumo…'}</div></section>;
  const trial=data.subscription.status==='trialing';
  const currentLabel=trial?'Prueba completa':data.currentPlan.name;
  const requested=data.subscription.requestedPlanId;
  const usageLimit=data.usage.limit;
  const number=(value:number)=>new Intl.NumberFormat('es-AR').format(value);

  return <section className="subscriptionPage">
    <div className="subscriptionHeading"><div><span className="muted">PLAN Y FACTURACIÓN</span><h2>El próximo paso de tu tienda</h2><p>Explorá los planes según tus órdenes mensuales. Vos elegís cuándo avanzar; mover la barra no cambia tu cuenta.</p></div></div>

    <div className="subscriptionStatus">
      <div className="planStatusName"><span><Sparkles aria-hidden="true"/>{trial?'PRUEBA ACTIVA':'PLAN ACTUAL'}</span><strong>{currentLabel}</strong><small>{trial?`${data.subscription.trialDaysRemaining} días restantes con acceso completo`:'Tu información y tu historial siguen disponibles'}</small></div>
      <div className="usageMeter"><span><b>{number(data.usage.orders)} órdenes</b><small>{usageLimit?` de ${number(usageLimit)} en los últimos 30 días`:' en los últimos 30 días'}</small></span><div aria-label={`${data.usage.percent}% del límite utilizado`}><i style={{width:`${data.usage.percent}%`}}/></div><small>Por tu volumen, te corresponde <b>{data.recommendation.name}</b></small></div>
      <div className="billingState"><span><CreditCard aria-hidden="true"/> FACTURACIÓN</span><strong>{data.billingEnabled?'Cobro automático':'Sin medio de pago'}</strong><small>{data.billingEnabled?'Administrá la renovación desde Rentia.':'Podés elegir ahora: todavía no se realizará ningún cobro.'}</small></div>
    </div>

    {message&&<div className="subscriptionMessage">{message}</div>}
    {requested&&<div className="requestedPlanNotice"><ShieldCheck aria-hidden="true"/><span>Tu preferencia quedó guardada: <b>{data.plans.find(plan=>plan.id===requested)?.name||requested}</b> {data.subscription.billingCycle==='annual'?'anual':'mensual'}. La vas a confirmar antes de cualquier cobro.</span></div>}

    <PlanConfigurator plans={data.plans} initialPlanId={requested||data.recommendation.id} recommendedPlanId={data.recommendation.id} usageOrders={data.usage.orders} annual={annual} onAnnualChange={setAnnual} onChoose={planId=>void choosePlan(planId)} currentPlanId={trial?undefined:data.subscription.planId} requestedPlanId={requested} requestedBillingCycle={data.subscription.billingCycle} savingPlanId={saving} canManage={data.canManage}/>
    <div className="subscriptionFootnote"><span><ShieldCheck aria-hidden="true"/><b>14 días de prueba</b><small>Acceso completo, sin tarjeta.</small></span><span><CalendarDays aria-hidden="true"/><b>Renovación transparente</b><small>Vas a ver el monto antes de pagar.</small></span><span><Coins aria-hidden="true"/><b>Sin costos escondidos</b><small>El precio depende del volumen.</small></span></div>

    <section className="billingRoadmap" aria-labelledby="billing-roadmap-title"><div className="billingRoadmapIntro"><span>PRÓXIMO PASO</span><h3 id="billing-roadmap-title">Cobros simples dentro de Rentia</h3><p>La opción recomendada para comenzar en Argentina es integrar pagos recurrentes. Hasta que esté conectada, esta pantalla solo guarda tu preferencia y no solicita una tarjeta.</p><div><CreditCard aria-hidden="true"/><span><b>Integración de cobro pendiente</b><small>Ningún plan genera cargos hoy</small></span></div></div><ol><li><b>1</b><span><strong>Elegís el plan</strong><small>Según el volumen real de tu tienda.</small></span></li><li><b>2</b><span><strong>Confirmás el pago</strong><small>En un checkout seguro y fuera de Rentia.</small></span></li><li><b>3</b><span><strong>Rentia se actualiza</strong><small>Plan, vencimiento y estado quedan sincronizados.</small></span></li></ol></section>
  </section>;
}

type TeamMember={userId:string;name:string;email:string;imageUrl?:string;role:string;roleLabel:string;owner:boolean;createdAt:number|null};
type TeamInvitation={id:string;email:string;role:string;roleLabel:string;status:string;createdAt:number;expiresAt:number};
type TeamData={members:TeamMember[];invitations:TeamInvitation[];canManage:boolean;currentRole:'owner'|'admin'|'member';currentUserId?:string;transition?:boolean;capacity:TeamCapacity};
const teamRoles=[
  {value:'org:member',label:'Miembro · consulta',description:'Ve datos y exporta informes. No cambia la tienda.'},
  {value:'org:admin',label:'Administrador · gestión',description:'Edita costos, conexiones y equipo. No modifica al propietario.'},
];
const teamErrors:Record<string,string>={
  forbidden:'Tu acceso no permite gestionar el equipo.',
  team_limit_reached:'El cupo está completo. Cancelá una invitación pendiente o revisá los planes.',
  team_limit_unconfigured:'El cupo de Enterprise debe acordarse antes de invitar.',
  team_busy:'Hay otra invitación en proceso. Esperá y actualizá el equipo antes de reintentar.',
  already_invited:'Ese correo ya pertenece al equipo o tiene una invitación pendiente.',
  invalid_data:'Revisá el correo y el rol de la invitación.',
  invalid_email:'Ingresá un correo electrónico válido.',
  invitation_status_unknown:'No pudimos confirmar el envío. Revisá las invitaciones pendientes antes de volver a invitar; puede haberse enviado.',
  owner_is_protected:'El propietario principal no se puede modificar ni quitar.',
  self_role_is_protected:'Tu propio rol debe modificarlo otro administrador.',
  self_removal_is_protected:'No podés quitar tu propio acceso desde esta pantalla.',
};

function TeamSection({onPlans}:{onPlans:()=>void}) {
  const [data,setData]=useState<TeamData|null>(null);
  const [email,setEmail]=useState('');
  const [role,setRole]=useState('org:member');
  const [message,setMessage]=useState('');
  const [working,setWorking]=useState(false);
  const [loadError,setLoadError]=useState(false);
  async function loadTeam() {
    try {
      const response=await fetch('/api/team',{cache:'no-store',signal:AbortSignal.timeout(20000)});
      if(!response.ok)throw new Error('load');
      setData(await response.json());setLoadError(false);
    }catch{setLoadError(true);}
  }
  useEffect(()=>{void loadTeam();},[]);
  async function mutate(method:string,body:Record<string,string>,success:string) {
    setWorking(true);setMessage('Procesando…');
    try {
      const response=await fetch('/api/team',{method,headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
      const result=await response.json().catch(()=>({})) as {error?:string};
      if(response.ok){if(method==='POST')setEmail('');setMessage(success);}
      else setMessage(teamErrors[result.error||'']||'No pudimos confirmar el cambio. Actualizá el equipo antes de reintentar.');
      await loadTeam();
    }catch{setMessage('No pudimos confirmar la operación. Revisá el equipo antes de reintentar; una invitación puede haberse enviado.');await loadTeam();}
    finally{setWorking(false);}
  }
  function invite(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(!data?.capacity.remaining||working)return;
    void mutate('POST',{email,role},'Invitación enviada. Reservamos su lugar durante 14 días.');
  }
  const full=Boolean(data&&(data.capacity.limit===null||data.capacity.remaining===0));
  const myRole=data?.currentRole==='owner'?'Propietario':data?.currentRole==='admin'?'Administrador':'Consulta';
  return <section className="teamPage">
    <div className="teamHeading"><div><span className="muted">ORGANIZACIÓN</span><h2>Equipo y accesos</h2><p>Una tienda compartida, con accesos individuales. Tu rol: <b>{data?myRole:'Cargando…'}</b>.</p></div>{data?.canManage&&<button className="button" disabled={full||working||loadError||data.transition} onClick={()=>document.getElementById('team-email')?.focus()}>＋ Invitar persona</button>}</div>
    <div className="teamSummary"><article><span>Miembros activos</span><b>{data?.capacity.active??'—'}</b><small>Incluye al propietario</small></article><article><span>Invitaciones pendientes</span><b>{data?.capacity.pending??'—'}</b><small>Reservan un lugar por 14 días</small></article><article className="teamCapacity"><span>Cupo de {data?.capacity.planName||'tu plan'}</span><b>{data?`${data.capacity.used} / ${data.capacity.limit??'A medida'}`:'—'}</b><small>{data?data.capacity.remaining>0?`${data.capacity.remaining} lugar${data.capacity.remaining===1?'':'es'} disponible${data.capacity.remaining===1?'':'s'}`:'Sin lugares disponibles':'Consultando cupo…'}</small></article></div>
    {loadError&&<div className="teamMessage" role="alert">No pudimos actualizar el equipo. No envíes otra invitación sin verificar las pendientes. <button className="outline" onClick={()=>void loadTeam()}>Reintentar</button></div>}
    {data?.transition&&<div className="teamTransition">Ingresá con email o Google para vincular tu acceso y habilitar el equipo, sin perder los datos de esta tienda.</div>}
    {full&&<div className="teamLimitNotice"><div><b>{data?.capacity.overLimit?'Tu equipo actual supera el cupo':'Cupo de equipo completo'}</b><p>{data?.capacity.overLimit?'Nadie pierde su acceso. No se pueden sumar nuevas personas hasta liberar un lugar o activar otro plan.':'El propietario, los miembros y las invitaciones pendientes cuentan. Una preferencia de plan no amplía el cupo hasta que el plan esté activo.'}</p></div><button className="outline" onClick={onPlans}>Ver planes</button></div>}
    <div className="teamPermissionGuide"><article><ShieldCheck size={18}/><div><b>Propietario</b><p>Gestiona toda la tienda. Su rol y acceso están protegidos.</p></div></article><article><Settings2 size={18}/><div><b>Administrador</b><p>Edita costos, integraciones, configuración y equipo. No puede quitar al propietario.</p></div></article><article><UsersRound size={18}/><div><b>Miembro · consulta</b><p>Ve ventas, rentabilidad y campañas; exporta informes. No edita ni invita.</p></div></article></div>
    {data?.canManage&&!data.transition&&<form className="teamInvite" onSubmit={invite}><div><span className="muted">NUEVA INVITACIÓN</span><h3>Sumar una persona</h3><p>{full?'Liberá un lugar antes de invitar.':'Recibirá un email para entrar con su propia cuenta.'}</p></div><label>Email<input id="team-email" type="email" value={email} disabled={working||full||loadError} onChange={event=>setEmail(event.target.value)} placeholder="persona@mitienda.com" required/></label><ThemedSelect label="Rol de acceso" value={role} options={teamRoles} onChange={setRole} disabled={working||full||loadError}/><button className="button" disabled={working||full||loadError}>{working?'Procesando…':'Enviar invitación'}</button></form>}
    {message&&<div className="teamMessage" role="status">{message}</div>}
    <div className="teamCard"><div className="teamCardHead"><div><h3>Miembros</h3><span>{data?.members.length||0}</span></div><small>Los permisos se verifican en el servidor.</small></div>{!data?<div className="teamLoading">{loadError?'Equipo no disponible.':'Cargando equipo…'}</div>:<div className="teamTable">{data.members.map(member=><article key={member.userId}><span className={`teamAvatar ${member.imageUrl?'photo':''}`} style={member.imageUrl?{backgroundImage:`url(${member.imageUrl})`}:undefined}>{member.imageUrl?'':member.name.slice(0,1).toUpperCase()}</span><div className="teamIdentity"><b>{member.name}{member.userId===data.currentUserId&&<small>Vos</small>}</b><span>{member.email}</span></div><span className={`teamRole ${member.owner?'owner':''}`}>{member.owner?'Propietario':member.roleLabel}</span><span className="teamDate">{member.createdAt?new Date(member.createdAt).toLocaleDateString('es-AR'):'Cuenta original'}</span>{data.canManage&&!member.owner&&member.userId!==data.currentUserId?<div className="teamActions"><ThemedSelect label={`Cambiar rol de ${member.name}`} value={member.role} options={teamRoles} disabled={working||loadError} onChange={nextRole=>{if(window.confirm(`¿Cambiar el acceso de ${member.name} a ${nextRole==='org:admin'?'administración':'consulta'}?`))void mutate('PATCH',{userId:member.userId,role:nextRole},'Permisos actualizados.');}}/><button onClick={()=>{if(window.confirm(`¿Quitar el acceso de ${member.name} a esta tienda?`))void mutate('DELETE',{userId:member.userId},'Acceso quitado del equipo.');}} disabled={working||loadError}>Quitar</button></div>:<span className="teamProtected">{member.owner?'Acceso protegido':'—'}</span>}</article>)}</div>}</div>
    {!!data?.invitations.length&&<div className="teamCard invitations"><div className="teamCardHead"><div><h3>Invitaciones pendientes</h3><span>{data.invitations.length}</span></div></div><div className="teamTable">{data.invitations.map(invitation=><article key={invitation.id}><span className="teamAvatar pending">✉</span><div className="teamIdentity"><b>{invitation.email}</b><span>Enviada {new Date(invitation.createdAt).toLocaleDateString('es-AR')}</span></div><span className="teamRole">{invitation.roleLabel}</span><span className="teamDate">Vence {new Date(invitation.expiresAt).toLocaleDateString('es-AR')}</span>{data.canManage?<button className="teamCancel" onClick={()=>{if(window.confirm('¿Cancelar esta invitación y liberar su lugar?'))void mutate('DELETE',{invitationId:invitation.id},'Invitación cancelada. Su lugar está disponible.');}} disabled={working||loadError}>Cancelar</button>:<span/>}</article>)}</div></div>}
  </section>;
}

const dashboardMetricLabels:Record<DashboardMetricKey,string>={orders:'Órdenes totales',totalRevenue:'Facturación total',netRevenue:'Facturación neta',profit:'Ganancia conocida',margin:'Margen real',aov:'Ticket promedio',adSpend:'Inversión publicitaria',roas:'ROAS global / Meta',cpa:'CPA Meta',productCost:'Costo de productos',shipping:'Costos de envío',commissions:'Comisiones',externalRevenue:'Facturación externa',tnOrders:'Órdenes Tiendanube',tnRevenue:'Facturación Tiendanube',tnNetRevenue:'Facturación neta Tiendanube',tnProfit:'Ganancia Tiendanube',tnAov:'Ticket promedio Tiendanube',metaSpend:'Inversión Meta',metaRevenue:'Ventas atribuidas por Meta',metaRoas:'ROAS reportado por Meta',metaCpa:'CPA Meta',mlOrders:'Órdenes Mercado Libre',mlRevenue:'Facturación Mercado Libre',mlNetRevenue:'Facturación neta Mercado Libre',mlProfit:'Ganancia Mercado Libre',mlAov:'Ticket promedio Mercado Libre'};
const dashboardMetricHelp:Partial<Record<DashboardMetricKey,GlossaryTerm>>={netRevenue:'Facturación neta',profit:'Ganancia conocida',margin:'Margen real',aov:'Ticket promedio',roas:'ROAS',cpa:'CPA',commissions:'Comisiones',tnNetRevenue:'Facturación neta',tnProfit:'Ganancia conocida',tnAov:'Ticket promedio',metaRoas:'ROAS',metaCpa:'CPA',mlNetRevenue:'Facturación neta',mlProfit:'Ganancia conocida',mlAov:'Ticket promedio'};

function DashboardEditor({layout,saving,message,onClose,onSave,onPreview}:{layout:DashboardLayoutConfig;saving:boolean;message:string;onClose:()=>void;onSave:(layout:DashboardLayoutConfig)=>void;onPreview:(layout:DashboardLayoutConfig)=>void}) {
  const original=useRef<DashboardLayoutConfig>(structuredClone(layout));
  const [draft,setDraft]=useState<DashboardLayoutConfig>(structuredClone(layout));
  const [pickerSection,setPickerSection]=useState<string|null>(null);
  const [draggedMetric,setDraggedMetric]=useState<DashboardMetricKey|null>(null);
  const [draggedSection,setDraggedSection]=useState<string|null>(null);
  const used=new Set(draft.sections.flatMap(section=>section.metrics));
  const available=dashboardMetricKeys.filter(metric=>!used.has(metric));
  const update=(next:DashboardLayoutConfig)=>{setDraft(next);onPreview(next);};
  const close=()=>{onPreview(original.current);onClose();};
  const applyPreset=(preset:keyof typeof dashboardPresets)=>{const next=structuredClone(dashboardPresets[preset]);setPickerSection(null);update(next);};
  const updateSection=(sectionId:string,change:(section:DashboardLayoutSection)=>DashboardLayoutSection)=>update({...draft,sections:draft.sections.map(section=>section.id===sectionId?change(section):section)});
  const moveMetric=(metric:DashboardMetricKey,targetSectionId:string,targetIndex?:number)=>{
    const sections=draft.sections.map(section=>({...section,metrics:section.metrics.filter(value=>value!==metric)}));
    const target=sections.find(section=>section.id===targetSectionId);if(!target)return;
    target.metrics.splice(targetIndex===undefined?target.metrics.length:Math.max(0,Math.min(targetIndex,target.metrics.length)),0,metric);
    update({...draft,sections});
  };
  const moveWithin=(sectionId:string,index:number,direction:-1|1)=>updateSection(sectionId,section=>{const metrics=[...section.metrics];const target=index+direction;if(target<0||target>=metrics.length)return section;[metrics[index],metrics[target]]=[metrics[target],metrics[index]];return {...section,metrics};});
  const moveSection=(index:number,direction:-1|1)=>{const sections=[...draft.sections];const target=index+direction;if(target<0||target>=sections.length)return;[sections[index],sections[target]]=[sections[target],sections[index]];update({...draft,sections});};
  const moveSectionTo=(targetId:string)=>{if(!draggedSection||draggedSection===targetId)return;const sections=[...draft.sections];const from=sections.findIndex(section=>section.id===draggedSection);const to=sections.findIndex(section=>section.id===targetId);if(from<0||to<0)return;const [moved]=sections.splice(from,1);sections.splice(to,0,moved);update({...draft,sections});};
  const addSection=()=>{if(draft.sections.length>=8)return;const next={id:`section-${Date.now()}`,title:`Nueva sección ${draft.sections.length+1}`,channel:'custom' as DashboardChannel,metrics:[] as DashboardMetricKey[]};update({...draft,sections:[...draft.sections,next]});};
  const removeSection=(sectionId:string)=>{if(draft.sections.length===1)return;update({...draft,sections:draft.sections.filter(section=>section.id!==sectionId)});};
  return <div className="dashboardEditorBackdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close();}}><aside className="dashboardEditor" role="dialog" aria-modal="true" aria-label="Personalizar dashboard">
    <header><div><span className="muted">VISTA PERSONALIZADA</span><h2>Personalizá tu dashboard</h2><p>Arrastrá secciones y métricas. La vista queda guardada para toda tu tienda.</p></div><button type="button" onClick={close} aria-label="Cerrar"><X aria-hidden="true"/></button></header>
    <div className="dashboardPresetPicker"><button type="button" onClick={()=>applyPreset('profitability')}>Rentabilidad</button><button type="button" onClick={()=>applyPreset('advertising')}>Publicidad</button><button type="button" onClick={()=>applyPreset('operation')}>Operación</button></div>
    <div className="dashboardEditorSections">{draft.sections.map((section,sectionIndex)=><article className={`dashboardEditorSection channel-${section.channel||'custom'} ${draggedSection===section.id?'dragging':''}`} key={section.id} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();if(draggedSection)moveSectionTo(section.id);else if(draggedMetric)moveMetric(draggedMetric,section.id);setDraggedMetric(null);setDraggedSection(null);}}>
      <div className="dashboardEditorSectionHead"><span className="sectionDragHandle" draggable onDragStart={event=>{event.stopPropagation();setDraggedSection(section.id);setDraggedMetric(null);}} onDragEnd={()=>setDraggedSection(null)} title="Arrastrar sección"><GripVertical aria-hidden="true"/></span><input value={section.title} maxLength={45} aria-label="Nombre de la sección" onChange={event=>updateSection(section.id,current=>({...current,title:event.target.value}))}/><div><button type="button" onClick={()=>moveSection(sectionIndex,-1)} disabled={sectionIndex===0} aria-label="Subir sección">↑</button><button type="button" onClick={()=>moveSection(sectionIndex,1)} disabled={sectionIndex===draft.sections.length-1} aria-label="Bajar sección">↓</button><button type="button" onClick={()=>removeSection(section.id)} disabled={draft.sections.length===1} aria-label="Eliminar sección"><X aria-hidden="true"/></button></div></div>
      <div className="dashboardMetricEditorList">{section.metrics.map((metric,index)=><div className="dashboardMetricEditorRow" key={metric} draggable onDragStart={()=>{setDraggedMetric(metric);setDraggedSection(null);}} onDragEnd={()=>setDraggedMetric(null)} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.stopPropagation();if(draggedMetric)moveMetric(draggedMetric,section.id,index);setDraggedMetric(null);}}><GripVertical aria-hidden="true"/><span><b>{dashboardMetricLabels[metric]}</b><small>{metric.includes('meta')||metric==='roas'?'Dato publicitario de Meta':metric.startsWith('ml')?'Se completa al conectar Mercado Libre':metric.startsWith('tn')?'Dato exclusivo de Tiendanube':metric==='profit'?'Resultado luego de todos los costos conocidos':'Dato calculado para el período seleccionado'}</small></span><div><button type="button" onClick={()=>moveWithin(section.id,index,-1)} disabled={index===0} aria-label="Mover arriba">↑</button><button type="button" onClick={()=>moveWithin(section.id,index,1)} disabled={index===section.metrics.length-1} aria-label="Mover abajo">↓</button>{draft.sections.length>1&&<><button type="button" onClick={()=>moveMetric(metric,draft.sections[Math.max(0,sectionIndex-1)].id)} disabled={sectionIndex===0} aria-label="Mover a la sección anterior">←</button><button type="button" onClick={()=>moveMetric(metric,draft.sections[Math.min(draft.sections.length-1,sectionIndex+1)].id)} disabled={sectionIndex===draft.sections.length-1} aria-label="Mover a la sección siguiente">→</button></>}<button type="button" onClick={()=>updateSection(section.id,current=>({...current,metrics:current.metrics.filter(value=>value!==metric)}))} aria-label="Ocultar métrica"><X aria-hidden="true"/></button></div></div>)}{!section.metrics.length&&<div className="emptyDashboardSection">Arrastrá o agregá métricas a esta sección.</div>}</div>
      <button type="button" className="addDashboardMetric" onClick={()=>setPickerSection(pickerSection===section.id?null:section.id)}><Plus aria-hidden="true"/> Agregar métrica</button>{pickerSection===section.id&&<div className="dashboardMetricPicker">{available.length?available.map(metric=><button type="button" key={metric} onClick={()=>{updateSection(section.id,current=>({...current,metrics:[...current.metrics,metric]}));setPickerSection(null);}}><Plus aria-hidden="true"/>{dashboardMetricLabels[metric]}</button>):<span>Ya estás mostrando todas las métricas.</span>}</div>}
    </article>)}</div>
    <button type="button" className="addDashboardSection" onClick={addSection} disabled={draft.sections.length>=8}><Plus aria-hidden="true"/> Crear sección</button>
    <footer><span>{message||`${used.size} métricas · ${draft.sections.length} secciones`}</span><div><button type="button" onClick={close}>Cancelar</button><button type="button" className="button" onClick={()=>onSave(draft)} disabled={saving||!used.size||draft.sections.some(section=>!section.title.trim())}>{saving?'Guardando…':'Guardar dashboard'}</button></div></footer>
  </aside></div>;
}

function ChannelChartFilter({value,onChange}:{value:string;onChange:(value:string)=>void}) {
  return <div className="channelChartFilter"><ThemedSelect label="Canal del análisis" value={value} onChange={onChange} options={[{value:'combined',label:'Todos los canales'},{value:'mercadolibre',label:'Mercado Libre'},{value:'tiendanube',label:'Tiendanube'}]}/><p>{value==='combined'?'Ventas de todos los canales, publicidad conocida y ajustes por reembolsos.':value==='mercadolibre'?'Ganancia conocida del canal, después de Product Ads consultados y pérdidas por reembolsos confirmadas. Revisá la cobertura publicitaria.':'Datos exclusivos de Tiendanube. Meta no se reparte al canal sin atribución; las devoluciones se revisan por separado.'}</p></div>;
}

function Sparkline({values,color}:{values:number[];color:string}) {
  const finite=values.filter(value=>Number.isFinite(value));
  const size=Math.max(1,Math.ceil(finite.length/32));
  const clean=size===1?finite:Array.from({length:Math.ceil(finite.length/size)},(_,index)=>finite.slice(index*size,index*size+size).reduce((sum,value)=>sum+value,0));
  if(clean.length<2||clean.every(value=>value===clean[0]))return null;
  const max=Math.max(...clean),min=Math.min(...clean),range=max-min||1;
  const path=clean.map((value,index)=>`${index?'L':'M'}${(index/(clean.length-1)*76).toFixed(1)} ${(27-(value-min)/range*24).toFixed(1)}`).join(' ');
  return <svg className="p2Spark" viewBox="0 0 76 30" aria-hidden="true"><path d={path} stroke={color} pathLength={1}/></svg>;
}

function DashboardOverview({dashboard,previousDashboard,syncing,days,layout,savingLayout,onNavigate,onEdit,onLayoutReorder,onChartChange}:{dashboard:Dashboard|null;previousDashboard:Dashboard|null;syncing:boolean;days:number;layout:DashboardLayoutConfig;savingLayout:boolean;onNavigate:(section:string)=>void;onEdit:()=>void;onLayoutReorder:(layout:DashboardLayoutConfig)=>void;onChartChange:(chart:DashboardLayoutConfig['chart'])=>void}) {
  const canManage=useContext(AccessContext);
  const money=useMoney();
  const t=useT();
  const [arranging,setArranging]=useState(false);
  const [draggedCard,setDraggedCard]=useState<{metric:DashboardMetricKey;sectionId:string;index:number}|null>(null);
  const [dropTarget,setDropTarget]=useState<{sectionId:string;index:number}|null>(null);
  const [chartMetricOpen,setChartMetricOpen]=useState(false);
  const [chartChannel,setChartChannel]=useState('combined');
  const metrics=dashboard?.metrics;
  const previous=previousDashboard?.metrics;
  const allPoints=dashboard?.timeline||[];
  const selectedChannel=dashboard?.channels.find(row=>row.provider===chartChannel);
  const points=chartChannel==='combined'||layout.chart.metric==='adSpend'?allPoints:dashboard?.channelTimelines?.[chartChannel]||[];
  const channelFor=(source:Dashboard|null,provider:string)=>source?.channels.find(channel=>channel.provider===provider)||null;
  const tiendanube=channelFor(dashboard,'tiendanube');
  const previousTiendanube=channelFor(previousDashboard,'tiendanube');
  const mercadoLibre=channelFor(dashboard,'mercadolibre');
  const previousMercadoLibre=channelFor(previousDashboard,'mercadolibre');
  const moveDashboardCard=(targetSectionId:string,targetIndex:number)=>{
    if(!draggedCard)return;
    const sections=layout.sections.map(section=>({...section,metrics:[...section.metrics]}));
    const source=sections.find(section=>section.id===draggedCard.sectionId);
    const target=sections.find(section=>section.id===targetSectionId);
    if(!source||!target)return;
    const sourceIndex=source.metrics.indexOf(draggedCard.metric);
    if(sourceIndex<0)return;
    source.metrics.splice(sourceIndex,1);
    if(source.id===target.id&&sourceIndex===targetIndex)return;
    const insertAt=Math.max(0,Math.min(targetIndex,target.metrics.length));
    target.metrics.splice(insertAt,0,draggedCard.metric);
    onLayoutReorder({...layout,sections});
  };
  const channelLogo=(channel:DashboardChannel,compact=false)=>{
    const source=channel==='combined'?'/favicon.svg':channel==='tiendanube'?'/brands/tiendanube-icon.png':channel==='mercadolibre'?'/brands/mercado-libre-icon.png':channel==='meta'?'/brands/meta.png':'';
    return <span className={`channelIcon channelIcon-${channel} ${compact?'compact':''}`} aria-hidden="true">{source?<img src={source} alt=""/>:'◇'}</span>;
  };
  function sparkSeries(key:DashboardMetricKey) {
    const source=key.startsWith('tn')?dashboard?.channelTimelines?.tiendanube||[]:key.startsWith('ml')?dashboard?.channelTimelines?.mercadolibre||[]:/meta|roas|cpa/i.test(key)?(dashboard?.metaTimeline?.length?dashboard.metaTimeline:allPoints):allPoints;
    const pick=(point:TimelinePoint)=>/orders/i.test(key)?point.orders:/profit|margin/i.test(key)?point.profit:/meta|adSpend|roas|cpa/i.test(key)?point.adSpend:point.storeRevenue+(key==='totalRevenue'?point.externalRevenue:0);
    return source.map(pick);
  }
  function metricCard(key:DashboardMetricKey,sectionId:string,index:number,channel:DashboardChannel) {
    let value:React.ReactNode='—';let current=0;let previousValue:number|undefined;let mode:'relative'|'points'='relative';let neutral=false;let pending='';let section='informes';let valueClass='';
    if(metrics) {
      if(key==='orders'){current=metrics.totalOrders;previousValue=previous?.totalOrders;value=metrics.totalOrders;section='ordenes';}
      if(key==='totalRevenue'){current=metrics.totalRevenue;previousValue=previous?.totalRevenue;value=money(metrics.totalRevenue);}
      if(key==='netRevenue'){current=metrics.netRevenue;previousValue=previous?.netRevenue;value=money(metrics.netRevenue);}
      if(key==='profit'){current=metrics.profit;previousValue=previous?.profit;value=money(metrics.profit);valueClass=metrics.profit<0?'negativeProfit':'positiveProfit';}
      if(key==='margin'){current=metrics.margin;previousValue=previous?.margin;value=`${metrics.margin.toFixed(1)}%`;mode='points';}
      if(key==='aov'){current=metrics.totalAov;previousValue=previous?.totalAov;value=money(metrics.totalAov);}
      if(key==='adSpend'){section='publicidad';neutral=true;if(dashboard?.ads.connected||dashboard?.meliAds?.selected?.last_completed_at){current=metrics.totalAdSpend??metrics.adSpend;previousValue=previous?.totalAdSpend??previous?.adSpend;value=money(current);}else pending='Publicidad pendiente de consulta';}
      if(key==='roas'){section='publicidad';if(dashboard?.ads.connected){current=metrics.blendedRoas;previousValue=previous?.blendedRoas;value=`${metrics.blendedRoas.toFixed(2)}x / ${metrics.reportedRoas.toFixed(2)}x`;}else pending=t('Sin datos inventados');}
      if(key==='cpa'){section='publicidad';neutral=true;if(dashboard?.ads.connected){current=metrics.cpa;previousValue=previous?.cpa;value=money(metrics.cpa,metrics.metaCurrency);}else pending=t('Disponible al conectar Meta');}
      if(key==='productCost'){current=metrics.productCost;previousValue=previous?.productCost;value=money(metrics.productCost);neutral=true;section='costos';}
      if(key==='shipping'){current=metrics.shipping;previousValue=previous?.shipping;value=money(metrics.shipping);neutral=true;section='configuracion';}
      if(key==='commissions'){current=metrics.commissions;previousValue=previous?.commissions;value=money(metrics.commissions);neutral=true;section='configuracion';}
      if(key==='externalRevenue'){current=metrics.externalRevenue;previousValue=previous?.externalRevenue;value=money(metrics.externalRevenue);section='facturacion';}
      if(key==='tnOrders'){section='ordenes';if(tiendanube){current=tiendanube.orders;previousValue=previousTiendanube?.orders;value=tiendanube.orders;}else pending='Disponible al conectar Tiendanube';}
      if(key==='tnRevenue'){if(tiendanube){current=tiendanube.revenue;previousValue=previousTiendanube?.revenue;value=money(tiendanube.revenue);}else pending='Disponible al conectar Tiendanube';}
      if(key==='tnNetRevenue'){if(tiendanube){current=tiendanube.netRevenue;previousValue=previousTiendanube?.netRevenue;value=money(tiendanube.netRevenue);}else pending='Disponible al conectar Tiendanube';}
      if(key==='tnProfit'){if(tiendanube?.profit!==null&&tiendanube?.profit!==undefined){current=tiendanube.profit;previousValue=previousTiendanube?.profit??undefined;value=money(tiendanube.profit);valueClass=tiendanube.profit<0?'negativeProfit':'positiveProfit';}else pending=tiendanube?'Rentabilidad pendiente':'Disponible al conectar Tiendanube';}
      if(key==='tnAov'){if(tiendanube){current=tiendanube.aov;previousValue=previousTiendanube?.aov;value=money(tiendanube.aov);}else pending='Disponible al conectar Tiendanube';}
      if(key==='metaSpend'){section='publicidad';neutral=true;if(dashboard?.ads.connected){current=metrics.adSpend;previousValue=previous?.adSpend;value=money(metrics.adSpend,metrics.metaCurrency);}else pending='Disponible al conectar Meta';}
      if(key==='metaRevenue'){section='publicidad';if(dashboard?.ads.connected){current=metrics.metaReportedRevenue;previousValue=previous?.metaReportedRevenue;value=money(metrics.metaReportedRevenue,metrics.metaCurrency);}else pending='Disponible al conectar Meta';}
      if(key==='metaRoas'){section='publicidad';if(dashboard?.ads.connected){current=metrics.reportedRoas;previousValue=previous?.reportedRoas;value=`${metrics.reportedRoas.toFixed(2)}x`;}else pending='Disponible al conectar Meta';}
      if(key==='metaCpa'){section='publicidad';neutral=true;if(dashboard?.ads.connected){current=metrics.cpa;previousValue=previous?.cpa;value=money(metrics.cpa,metrics.metaCurrency);}else pending='Disponible al conectar Meta';}
      if(key==='mlOrders'){section='ordenes';if(mercadoLibre){current=mercadoLibre.orders;previousValue=previousMercadoLibre?.orders;value=mercadoLibre.orders;}else pending='Disponible al conectar Mercado Libre';}
      if(key==='mlRevenue'){if(mercadoLibre){current=mercadoLibre.revenue;previousValue=previousMercadoLibre?.revenue;value=money(mercadoLibre.revenue);}else pending='Disponible al conectar Mercado Libre';}
      if(key==='mlNetRevenue'){if(mercadoLibre){current=mercadoLibre.netRevenue;previousValue=previousMercadoLibre?.netRevenue;value=money(mercadoLibre.netRevenue);}else pending='Disponible al conectar Mercado Libre';}
      if(key==='mlProfit'){if(mercadoLibre?.profit!==null&&mercadoLibre?.profit!==undefined){current=mercadoLibre.profit;previousValue=previousMercadoLibre?.profit??undefined;value=money(mercadoLibre.profit);valueClass=mercadoLibre.profit<0?'negativeProfit':'positiveProfit';}else pending=mercadoLibre?'Rentabilidad pendiente':'Disponible al conectar Mercado Libre';}
      if(key==='mlAov'){if(mercadoLibre){current=mercadoLibre.aov;previousValue=previousMercadoLibre?.aov;value=money(mercadoLibre.aov);}else pending='Disponible al conectar Mercado Libre';}
    }
    const knownChannel=key==='mlProfit'?mercadoLibre:key==='tnProfit'?tiendanube:null;
    const partial=!!knownChannel&&!knownChannel.costCoverage;
    const targetActive=dropTarget?.sectionId===sectionId&&dropTarget.index===index;
    return <button type="button" className={`metricCard ${pending?'metricPending':''} ${arranging?'arrangeable':''} ${draggedCard?.metric===key?'dragging':''} ${targetActive?'dropTarget':''}`} key={key} draggable={arranging} aria-grabbed={arranging?draggedCard?.metric===key:undefined} onDragStart={event=>{if(!arranging)return;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',key);setDraggedCard({metric:key,sectionId,index});setDropTarget({sectionId,index});}} onDragOver={event=>{if(!arranging||!draggedCard)return;event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='move';setDropTarget({sectionId,index});}} onDrop={event=>{if(!arranging)return;event.preventDefault();event.stopPropagation();moveDashboardCard(sectionId,index);setDraggedCard(null);setDropTarget(null);}} onDragEnd={()=>{setDraggedCard(null);setDropTarget(null);}} onClick={()=>{if(arranging)return;onNavigate(partial||pending==='Rentabilidad pendiente'?'calidad':pending&&key.startsWith('ml')?'integraciones':pending&&key.startsWith('tn')?'integraciones':section);}}>{arranging&&<span className="metricDragHandle" aria-hidden="true"><GripVertical/></span>}{!pending&&key!=='roas'&&<Sparkline values={sparkSeries(key)} color={channel==='meta'?'#3b8cff':channel==='mercadolibre'?'#f5c451':/profit|margin/i.test(key)?'#21d4c2':'#3b8cff'}/>}<span className="metricCardLabel">{channel!=='custom'&&channelLogo(channel,true)}{t(partial?`Ganancia conocida ${knownChannel?.label}`:key==='profit'&&dashboard?.quality&&dashboard.quality.completeOrders<dashboard.quality.totalOrders?'Ganancia provisoria':dashboardMetricLabels[key])}{dashboardMetricHelp[key]&&<TermHelp term={dashboardMetricHelp[key]}/>}</span><strong className={valueClass}>{value}</strong>{partial&&knownChannel?<small className="knownProfitCoverage">{knownChannel.completeOrders} de {knownChannel.orders} órdenes · {knownChannel.pendingOrders} por revisar · {key==='mlProfit'?'Product Ads según cobertura':'antes de Meta Ads'}</small>:metrics&&!pending?<MetricChange current={current} previous={previousValue} mode={mode} neutral={neutral}/>:<small>{pending||t('Cargando')}</small>}<i>{arranging?'Arrastrar':pending?'Configurar →':'Ver detalle →'}</i></button>;
  }
  const stackParts=[0,metrics?.productCost,metrics?.shipping,metrics?.commissions,metrics?.taxes,metrics?.additional,dashboard?.ads.connected&&metrics?.adSpendComparable?metrics.adSpend:0,metrics?.meliAdsComparable?metrics.meliAdSpend||0:0,metrics?.refundLoss];
  const stackBar=(index:number,value:number|undefined):React.CSSProperties=>{
    const revenue=metrics?.revenue||0;if(!revenue)return {};
    const width=Math.min(100,Math.max(0,Math.abs(value||0)/revenue*100));
    if(index===0||index===-1)return {'--l':'0%','--w':`${width}%`,'--i':index===-1?9:0} as React.CSSProperties;
    const before=stackParts.slice(1,index).reduce<number>((sum,part)=>sum+Math.abs(part||0),0)/revenue*100;
    return {'--l':`${Math.max(0,100-before-width)}%`,'--w':`${width}%`,'--i':index} as React.CSSProperties;
  };
  const chartTitle:Record<ChartMetric,string>={revenue:'Facturación vs. ganancia',profit:'Evolución de la ganancia',orders:'Evolución de órdenes',adSpend:'Evolución de la inversión'};
  const chartMetricLabels:Record<ChartMetric,string>={revenue:'Facturación + ganancia',profit:'Ganancia',orders:'Órdenes',adSpend:'Inversión publicitaria'};
  const sectionMeta=(section:DashboardLayoutSection)=>{const channel=section.channel||'custom';if(channel==='combined')return {channel,detail:'Ventas de canales conectados + publicidad'};if(channel==='tiendanube')return {channel,detail:tiendanube?'Datos exclusivos del canal · ganancia antes de Ads':'Canal pendiente de conexión'};if(channel==='meta')return {channel,detail:dashboard?.ads.connected?'Datos publicitarios reales':'Cuenta pendiente de conexión'};if(channel==='mercadolibre')return {channel,detail:mercadoLibre?(mercadoLibre.adSpend===undefined?'Datos del canal · Product Ads sin consultar':`Ganancia después de Product Ads conocidos · ${mercadoLibre.adsCoverage?'período cubierto':'cobertura parcial'}`):'Canal pendiente de conexión'};return {channel,detail:'Vista personalizada'};};
  return <>
    <div className="dashboardIntro"><div><span className="muted">{t('MÉTRICAS PRINCIPALES')}</span><h2>{t('Tu operación, en un solo lugar')}</h2><p>{t('La ganancia es provisoria cuando faltan costos. La facturación externa se muestra separada porque no conocemos su rentabilidad.')}</p></div>{canManage&&<div className="dashboardIntroActions"><button className={`outline personalizeDashboard ${arranging?'active':''}`} onClick={()=>setArranging(value=>!value)}><SlidersHorizontal aria-hidden="true"/> {arranging?'Finalizar':'Personalizar'}</button><button className="outline" onClick={()=>onNavigate('facturacion')}>{t('＋ Cargar facturación externa')}</button></div>}</div>
    {arranging&&<div className="dashboardArrangeBar"><span><GripVertical aria-hidden="true"/><b>Ordená las tarjetas</b><small>Mantené presionada una caja y arrastrala a la posición que quieras.</small></span><div><em>{savingLayout?'Guardando…':'Los cambios se guardan automáticamente'}</em><button type="button" onClick={onEdit}>Editar secciones y métricas</button></div></div>}
    {dashboard?.quality&&dashboard.quality.status!=='empty'&&<button type="button" className={`dashboardQualityBanner ${dashboard.quality.completeOrders===dashboard.quality.totalOrders?'ready':'attention'}`} onClick={()=>onNavigate('calidad')}><span className="p2Ring" style={{'--v':dashboard.quality.score} as React.CSSProperties}><em>{dashboard.quality.score}%</em></span><div><b>{dashboard.quality.score}% de calidad de datos</b><small>{dashboard.quality.completeOrders} de {dashboard.quality.totalOrders} órdenes tienen todos sus costos identificados.</small></div><strong>{dashboard.quality.completeOrders===dashboard.quality.totalOrders?'Costos identificados':'Revisar pendientes'} →</strong></button>}
    <div className={`dashboardMetricSections ${arranging?'arranging':''}`}>{layout.sections.map(section=>{const meta=sectionMeta(section);const sectionDrop=dropTarget?.sectionId===section.id&&dropTarget.index===section.metrics.length;return <section className={`dashboardMetricSection channel-${meta.channel} ${sectionDrop?'sectionDropTarget':''}`} key={section.id} onDragOver={event=>{if(!arranging||!draggedCard)return;event.preventDefault();setDropTarget({sectionId:section.id,index:section.metrics.length});}} onDrop={event=>{if(!arranging)return;event.preventDefault();moveDashboardCard(section.id,section.metrics.length);setDraggedCard(null);setDropTarget(null);}}><div className="dashboardMetricSectionTitle"><div>{channelLogo(meta.channel)}<span><h3>{section.title}</h3><small>{meta.detail}</small></span></div><span>{section.metrics.length} métricas</span></div><div className="appMetrics expanded">{section.metrics.map((metric,index)=>metricCard(metric,section.id,index,meta.channel))}</div></section>})}</div>
    <div className="dashboardMainGrid">
      <article className="performanceChart proChart"><ChannelChartFilter value={layout.chart.metric==='adSpend'?'combined':chartChannel} onChange={value=>{setChartChannel(value);if(layout.chart.metric==='adSpend'&&value!=='combined')onChartChange({...layout.chart,metric:'revenue'});}}/>{chartChannel!=='combined'&&!!selectedChannel?.pendingOrders&&<p className="reportChannelNote">{selectedChannel.pendingOrders} órdenes con datos pendientes. La curva de ganancia incluye solo las {selectedChannel.completeOrders} órdenes completas; no representa el resultado final del canal.</p>}<div className="panelTitle"><div><span className="muted">EVOLUCIÓN POR {timelineGranularity(days).toUpperCase()}</span><h3>{t(chartTitle[layout.chart.metric])}</h3></div><div className="chartControls"><div className="chartMetricPicker" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setChartMetricOpen(false);}}><button type="button" aria-haspopup="listbox" aria-expanded={chartMetricOpen} onClick={()=>setChartMetricOpen(value=>!value)}><span>{chartMetricLabels[layout.chart.metric]}</span><ChevronDown aria-hidden="true"/></button>{chartMetricOpen&&<div role="listbox" aria-label="Métrica del gráfico">{(Object.entries(chartMetricLabels) as Array<[ChartMetric,string]>).filter(([value])=>chartChannel==='combined'||value!=='adSpend').map(([value,label])=><button type="button" role="option" aria-selected={layout.chart.metric===value} className={layout.chart.metric===value?'active':''} key={value} onClick={()=>{onChartChange({...layout.chart,metric:value});setChartMetricOpen(false);}}>{label}{layout.chart.metric===value&&<span>✓</span>}</button>)}</div>}</div><div className="chartTypeSwitch" aria-label="Tipo de gráfico">{([['area','Área'],['line','Línea'],['bar','Barras']] as const).map(([type,label])=><button type="button" key={type} className={layout.chart.type===type?'active':''} onClick={()=>onChartChange({...layout.chart,type})}>{label}</button>)}</div></div></div>{chartChannel!=='combined'&&layout.chart.metric==='profit'&&!selectedChannel?.completeOrders?<div className="emptyInline">La ganancia del canal está pendiente hasta completar sus costos.</div>:points.length?<><InteractiveTimelineChart points={points} days={days} metric={layout.chart.metric} mode={layout.chart.metric==='revenue'&&(chartChannel==='combined'||!!selectedChannel?.completeOrders)?'comparison':'single'} visualization={layout.chart.type} adCurrency={metrics?.metaCurrency||'ARS'}/><div className="chartLegend">{layout.chart.metric==='revenue'?<><span><i/> {t('Facturación')}</span>{(chartChannel==='combined'||!!selectedChannel?.completeOrders)&&<span><i className="profit"/> {chartChannel==='combined'?t('Ganancia'):chartChannel==='mercadolibre'?'Ganancia conocida · Product Ads según cobertura':'Ganancia conocida · antes de Meta Ads'}</span>}</>:<span><i/> {t(layout.chart.metric==='profit'?'Ganancia':layout.chart.metric==='orders'?'Órdenes':'Publicidad')}</span>}<small>{t('Comparación real del período')}</small></div></>:<div className="emptyChartBody compact"><i>↗</i><b>{syncing?'Importando datos…':'Todavía no hay actividad'}</b><p>El gráfico se completa con las ventas sincronizadas, los anuncios y la facturación externa.</p></div>}</article>
      <article className="profitStack"><span className="muted">{t('CUENTA REAL')}</span><h3>{t('Desglose de rentabilidad')}</h3><div className="profitStackRows"><div style={stackBar(0,metrics?.revenue)}><span>{t('Facturación tienda')}</span><b>{metrics?money(metrics.revenue):'—'}</b></div><div style={stackBar(1,metrics?.productCost)}><span>{t('Productos')}</span><b>− {metrics?money(metrics.productCost):'—'}</b></div><div style={stackBar(2,metrics?.shipping)}><span>{t('Envíos')}</span><b>− {metrics?money(metrics.shipping):'—'}</b></div><div style={stackBar(3,metrics?.commissions)}><span>{t('Comisiones')} <TermHelp term="Comisiones"/></span><b>− {metrics?money(metrics.commissions):'—'}</b></div><div style={stackBar(4,metrics?.taxes)}><span>{t('Impuestos')}</span><b>− {metrics?money(metrics.taxes):'—'}</b></div><div style={stackBar(5,metrics?.additional)}><span>{t('Costos adicionales')}</span><b>− {metrics?money(metrics.additional):'—'}</b></div><div style={stackBar(6,dashboard?.ads.connected&&metrics?.adSpendComparable?metrics.adSpend:0)}><span>Meta Ads</span><b>{dashboard?.ads.connected&&metrics?.adSpendComparable?`− ${money(metrics.adSpend)}`:dashboard?.ads.connected?'Moneda diferente':'—'}</b></div><div style={stackBar(7,metrics?.meliAdsComparable?metrics.meliAdSpend||0:0)}><span>Product Ads</span><b>{metrics?.meliAdsComparable?`− ${money(metrics.meliAdSpend||0)}`:'Pendiente de consulta / moneda'}</b></div><div style={stackBar(8,metrics?.refundLoss)}><span>Pérdidas por reembolsos confirmadas</span><b>− {money(metrics?.refundLoss||0)}</b></div><div className="profitStackTotal" style={stackBar(-1,metrics?.profit)}><span>Ganancia después de Ads conocidos</span><b className={metrics&&metrics.profit<0?'negativeProfit':'positiveProfit'}>{metrics?money(metrics.profit):'—'}</b></div></div><button className="outline" onClick={()=>onNavigate(dashboard?.ads.connected?'publicidad':'configuracion')}>{t(dashboard?.ads.connected?'Analizar publicidad':'Configurar costos')}</button></article>
    </div>
    <div className="dashboardInsightCharts">
      <article className="dashboardInsightChart"><div className="insightChartHead"><div><span className="muted">{t('VOLUMEN DE VENTAS')}</span><h3>{t('Órdenes')}</h3></div><strong>{chartChannel==='combined'?metrics?.totalOrders??'—':selectedChannel?.orders??0}</strong></div><p>{metrics?`${money(chartChannel==='combined'?metrics.totalAov:selectedChannel?.aov||0)} ${t('de ticket promedio')}`:'Cargando datos'}</p>{points.length?<InteractiveTimelineChart points={points} days={days} metric="orders" adCurrency={metrics?.metaCurrency||'ARS'}/>:<div className="emptyInline">{t('Todavía no hay ventas en este período.')}</div>}</article>
      <article className={`dashboardInsightChart ${!dashboard?.ads.connected?'pendingChart':''}`}><div className="insightChartHead"><div><span className="muted">META ADS</span><h3>{t('Inversión publicitaria')}</h3></div><strong>{dashboard?.ads.connected?money(metrics?.adSpend||0,metrics?.metaCurrency||'ARS'):'—'}</strong></div><p>{dashboard?.ads.connected&&metrics?`${metrics.reportedRoas.toFixed(2)}x ROAS reportado · ${metrics.blendedRoas.toFixed(2)}x global`:t('Conectá Meta para completar este análisis')}</p>{dashboard?.ads.connected&&!!dashboard?.metaTimeline?.length?<InteractiveTimelineChart points={dashboard?.metaTimeline||[]} days={days} metric="adSpend" adCurrency={metrics?.metaCurrency||'ARS'}/>:<div className="emptyInline">{t('La inversión aparecerá al sincronizar Meta Ads.')}</div>}</article>
    </div>
    <section className="channelSection"><div className="sectionLine"><div><span className="muted">{t('CANALES DE VENTA')}</span><h3>{t('Rendimiento por origen')}</h3></div><button onClick={()=>onNavigate('integraciones')}>{t('Administrar conexiones →')}</button></div><div className="channelTable"><div className="channelRow channelHead"><span>{t('Canal')}</span><span>{t('Órdenes')}</span><span>{t('Facturación')}</span><span>{t('Facturación neta')}</span><span>{t('Ganancia')}</span><span>{t('Ticket promedio')}</span></div>{(dashboard?.channels||[]).map(channel=><div className="channelRow" key={channel.provider}><div className="channelName"><i className={channel.provider}/><span><b>{channel.label}</b><small>{t(channel.costCoverage?'Costos aplicados · antes de Ads':`${channel.completeOrders}/${channel.orders} completas · ganancia conocida antes de Ads`)}</small></span></div><span>{channel.orders}</span><b>{money(channel.revenue)}</b><span>{money(channel.netRevenue)}</span><b className={channel.profit===null?'pendingValue':channel.profit<0?'negativeProfit':'positiveProfit'}>{channel.profit===null?'—':money(channel.profit)}</b><span>{money(channel.aov)}</span></div>)}</div></section>
    <section className="latestSales"><div className="sectionLine"><div><span className="muted">{t('ACTIVIDAD RECIENTE')}</span><h3>{t('Últimas ventas')}</h3></div><button onClick={()=>onNavigate('ordenes')}>{t('Ver todas →')}</button></div>{dashboard?.orders.length?<div className="compactOrders">{dashboard.orders.slice(0,6).map(order=><button key={`${order.provider}-${order.external_order_id}`} onClick={()=>onNavigate('ordenes')}><span>#{order.order_number||order.external_order_id}<small>{salesChannelLabel(order.provider)}</small></span><b>{money(order.total,order.currency)}</b><small>{date(order.source_created_at)}</small></button>)}</div>:<div className="emptyInline">{t('Todavía no hay órdenes importadas.')}</div>}</section>
  </>;
}

function DecisionCenter({dashboard,products,costs,ads,onNavigate}:{dashboard:Dashboard|null;products:ProductAnalyticsRow[];costs:ProductCostRow[];ads:MetaAdsData|null;onNavigate:(section:string)=>void}) {
  const money=useMoney();
  const metrics=dashboard?.metrics;
  const missingCosts=costs.filter(row=>row.effective_cost<=0);
  const losingProducts=products.filter(row=>row.units_sold>0&&row.profit<0).sort((a,b)=>a.profit-b.profit);
  const lowStock=products.filter(row=>row.stock!==null&&row.units_sold>0&&(row.days_stock===null||row.days_stock<=14)).sort((a,b)=>(a.days_stock??0)-(b.days_stock??0));
  const contribution=metrics?metrics.revenue-metrics.productCost-metrics.shipping-metrics.commissions-metrics.taxes-metrics.additional:0;
  const breakEvenRoas=metrics&&metrics.revenue>0&&contribution>0?metrics.revenue/contribution:0;
  const activeCampaigns=(ads?.campaigns||[]).filter(campaign=>campaign.spend>0&&(campaign.effective_status||campaign.status)==='ACTIVE');
  const riskyCampaigns=breakEvenRoas?activeCampaigns.filter(campaign=>campaign.reported_roas<breakEvenRoas).sort((a,b)=>a.reported_roas-b.reported_roas):[];
  const winningCampaigns=breakEvenRoas?activeCampaigns.filter(campaign=>campaign.reported_roas>=breakEvenRoas*1.2).sort((a,b)=>b.reported_roas-a.reported_roas):[];
  const topProduct=products.filter(row=>row.units_sold>0&&row.profit>0).sort((a,b)=>b.profit-a.profit)[0];
  const decisions:Array<{kind:'danger'|'warning'|'info'|'success';icon:string;title:string;detail:string;action:string;section:string}>=[];
  if(missingCosts.length) decisions.push({kind:'danger',icon:'$',title:`${missingCosts.length} SKU sin costo`,detail:'La ganancia de las órdenes que contienen estos productos puede estar sobreestimada.',action:'Completar costos',section:'costos'});
  if(losingProducts.length) decisions.push({kind:'danger',icon:'↓',title:`${losingProducts.length} producto${losingProducts.length===1?' pierde':'s pierden'} dinero`,detail:`El más urgente es ${losingProducts[0].product_name}: ${money(losingProducts[0].profit)} en el período.`,action:'Analizar productos',section:'productos'});
  if(lowStock.length) decisions.push({kind:'warning',icon:'◈',title:`${lowStock.length} SKU requieren reposición`,detail:`${lowStock[0].product_name} tiene ${lowStock[0].stock||0} unidades y ${Math.max(0,lowStock[0].days_stock||0).toFixed(0)} días estimados de stock.`,action:'Revisar inventario',section:'inventario'});
  if(riskyCampaigns.length) decisions.push({kind:'warning',icon:'↘',title:`${riskyCampaigns.length} campaña${riskyCampaigns.length===1?' está':'s están'} bajo el equilibrio`,detail:`${riskyCampaigns[0].name} reporta ${riskyCampaigns[0].reported_roas.toFixed(2)}x frente a un equilibrio estimado de ${breakEvenRoas.toFixed(2)}x.`,action:'Revisar campañas',section:'publicidad'});
  if(!dashboard?.ads.connected) decisions.push({kind:'info',icon:'∞',title:'Meta Ads todavía no está conectado',detail:'Conectalo para comparar inversión, atribución y facturación completa de la tienda.',action:'Conectar Meta',section:'integraciones'});
  if(!decisions.length) decisions.push({kind:'success',icon:'✓',title:'No detectamos urgencias con los datos actuales',detail:'Costos, margen, stock y publicidad están dentro de los umbrales configurados.',action:'Ver dashboard',section:'resumen'});
  return <section className="decisionPage">
    <div className="decisionHeading"><div><span className="muted">CENTRO DE DECISIONES</span><h2>Qué necesita tu atención hoy</h2><p>Rentia cruza ventas, costos, inventario y publicidad para convertir los números en acciones. Todas las conclusiones usan datos reales del período seleccionado.</p></div><div className="decisionScore"><b>{decisions.filter(item=>item.kind!=='success').length}</b><span>acciones detectadas</span></div></div>
    <div className="decisionSummary"><article><span>ROAS de equilibrio estimado</span><b>{breakEvenRoas?`${breakEvenRoas.toFixed(2)}x`:'—'}</b><small>Facturación / margen antes de publicidad</small></article><article><span>Campañas bajo equilibrio</span><b>{dashboard?.ads.connected?riskyCampaigns.length:'—'}</b><small>Lectura orientativa con atribución Meta</small></article><article><span>Productos con pérdida</span><b>{losingProducts.length}</b><small>Con ventas en el período</small></article><article><span>Alertas de stock</span><b>{lowStock.length}</b><small>Hasta 14 días de inventario</small></article></div>
    <div className="decisionGrid">{decisions.map((item,index)=><article className={`decisionCard ${item.kind}`} key={`${item.title}-${index}`}><span className="decisionIcon">{item.icon}</span><div><small>{item.kind==='danger'?'ALTA PRIORIDAD':item.kind==='warning'?'REVISAR':item.kind==='success'?'TODO EN ORDEN':'OPORTUNIDAD'}</small><h3>{item.title}</h3><p>{item.detail}</p><button onClick={()=>onNavigate(item.section)}>{item.action} →</button></div></article>)}</div>
    {(topProduct||winningCampaigns.length>0)&&<section className="decisionWins"><div><span className="muted">LO QUE ESTÁ FUNCIONANDO</span><h3>Ganadores del período</h3></div><div>{topProduct&&<article><span>Producto más rentable</span><b>{topProduct.product_name}</b><small>{money(topProduct.profit)} de ganancia · {topProduct.margin.toFixed(1)}% de margen</small></article>}{winningCampaigns[0]&&<article><span>Campaña con margen para escalar</span><b>{winningCampaigns[0].name}</b><small>{winningCampaigns[0].reported_roas.toFixed(2)}x ROAS Meta · equilibrio estimado {breakEvenRoas.toFixed(2)}x</small></article>}</div></section>}
    <div className="decisionNote"><b>Importante:</b> el ROAS por campaña sigue siendo el atribuido por Meta. La ganancia real por campaña se habilitará cuando sumemos atribución propia con Pixel/CAPI.</div>
  </section>;
}

type QualityKey=keyof DataQuality['dimensions'];
const qualityDimensionMeta:Array<{id:QualityKey;label:string;detail:string;section:string;action:string;mark:string}>=[
  {id:'products',label:'Costo de productos',detail:'Cada artículo vendido necesita un costo de Tiendanube o uno manual.',section:'costos',action:'Completar costos',mark:'SKU'},
  {id:'shipping',label:'Costos de envío',detail:'Usamos el costo real informado y el promedio guardado como respaldo.',section:'configuracion',action:'Configurar envíos',mark:'ENV'},
  {id:'commissions',label:'Comisiones',detail:'Validamos la regla del medio de pago o la comisión general.',section:'configuracion',action:'Revisar comisiones',mark:'COM'},
  {id:'taxes',label:'Impuestos',detail:'Confirmamos que la regla fiscal de la tienda ya fue revisada.',section:'configuracion',action:'Configurar impuestos',mark:'IMP'},
];
const missingCostLabel:Record<string,string>={claim:'Reclamo abierto',products:'Costo de producto',shipping:'Envío',commissions:'Comisión',taxes:'Impuesto'};

function DataQualitySection({dashboard,onNavigate}:{dashboard:Dashboard|null;onNavigate:(section:string)=>void}) {
  const money=useMoney();
  if (!dashboard?.quality) return <section className="qualityPage"><div className="qualityLoading">Analizando la calidad de tus datos…</div></section>;
  const quality=dashboard.quality;
  const statusLabel={empty:'Sin actividad',excellent:'Excelente',good:'Buena',warning:'Requiere atención',critical:'Incompleta'}[quality.status];
  const revenueCoverage=dashboard.metrics.revenue?Math.round(quality.coveredRevenue/dashboard.metrics.revenue*100):0;
  const issues=qualityDimensionMeta.filter(item=>quality.dimensions[item.id].missing>0);
  const firstIssue=issues[0];
  return <section className={`qualityPage quality-${quality.status}`}>
    <div className="qualityHeading"><div><span className="muted">CONFIABILIDAD DE RENTABILIDAD</span><h2>Calidad de datos</h2><p>Rentia revisa cada orden del período y separa lo confirmado de lo que todavía necesita información. Así nunca tomás decisiones con una ganancia incompleta.</p></div>{firstIssue&&<button className="button" onClick={()=>onNavigate(firstIssue.section)}>Corregir pendientes →</button>}</div>
    <div className="qualityHero">
      <div className="qualityScoreBlock"><div className="qualityRing" style={{background:`conic-gradient(#21d4c2 ${quality.score*3.6}deg,#152b3a 0deg)`}}><div><strong>{quality.score}%</strong><span>de calidad</span></div></div><div><span className="qualityStatus">{statusLabel}</span><h3>{quality.status==='empty'?'Esperando las primeras ventas':quality.completeOrders===quality.totalOrders?'Todos los costos están identificados':'Sabemos exactamente qué falta completar'}</h3><p>{quality.status==='empty'?'Cuando ingresen órdenes, este control se actualizará automáticamente.':`${quality.completeOrders} de ${quality.totalOrders} órdenes tienen todos sus costos identificados.`}</p></div></div>
      <div className="qualitySummary"><article><span>Órdenes completas</span><b>{quality.completeOrders} <small>/ {quality.totalOrders}</small></b><p>Con producto, envío, comisión e impuestos.</p></article><article><span>Facturación respaldada</span><b>{money(quality.coveredRevenue)}</b><p>{revenueCoverage}% de la facturación cobrada del período.</p></article><article><span>Ganancia confirmada</span><b className={quality.coveredProfit<0?'negativeProfit':'positiveProfit'}>{money(quality.coveredProfit)}</b><p>Solo órdenes completas, antes de descontar publicidad.</p></article></div>
    </div>
    <div className="qualitySectionTitle"><div><span className="muted">COBERTURA POR COSTO</span><h3>Qué tan completa está cada parte</h3></div><small>Se actualiza al cambiar el período</small></div>
    <div className="qualityDimensions">{qualityDimensionMeta.map(item=>{const dimension=quality.dimensions[item.id];return <article className={dimension.percent===100?'complete':dimension.missing?'pending':''} key={item.id}><div className="qualityDimensionTop"><span>{item.mark}</span><b>{dimension.percent}%</b></div><h4>{item.label}</h4><p>{item.detail}</p><div className="qualityProgress"><i style={{width:`${dimension.percent}%`}}/></div><footer><span>{dimension.complete} de {dimension.total||0} órdenes</span>{dimension.missing>0?<button onClick={()=>onNavigate(item.section)}>{item.action} →</button>:<b>✓ Completo</b>}</footer></article>})}</div>
    <div className="qualityLowerGrid">
      <article className="qualityIssues"><div className="qualityPanelHead"><div><span className="muted">PRÓXIMAS ACCIONES</span><h3>{issues.length?'Qué conviene corregir':'Todo está cubierto'}</h3></div><span className={issues.length?'attention':'ready'}>{issues.length||'✓'}</span></div>{issues.length?<div>{issues.map(item=>{const dimension=quality.dimensions[item.id];return <button key={item.id} onClick={()=>onNavigate(item.section)}><span><TriangleAlert aria-hidden="true"/></span><div><b>{dimension.missing} {dimension.missing===1?'orden necesita':'órdenes necesitan'} {item.label.toLowerCase()}</b><small>{item.detail}</small></div><strong>Corregir →</strong></button>})}</div>:<div className="qualityAllGood"><ShieldCheck aria-hidden="true"/><b>Rentabilidad lista para decidir</b><p>Todas las órdenes cobradas del período tienen los datos necesarios.</p></div>}</article>
      <article className="qualityMethod"><span className="muted">CÓMO LO CALCULAMOS</span><h3>Sin completar huecos con números inventados</h3><ol><li><b>1</b><span><strong>Primero, datos reales</strong><small>Producto y envío informados por el canal.</small></span></li><li><b>2</b><span><strong>Después, tus reglas</strong><small>Comisiones, impuestos y respaldos configurados.</small></span></li><li><b>3</b><span><strong>Por último, advertimos</strong><small>Si falta algo, la orden no cuenta como confirmada.</small></span></li></ol></article>
    </div>
    {!!quality.postSale?.orders.length&&<section className="postSaleQuality"><h3>Reclamos y reembolsos, por separado</h3><p>{quality.postSale.openClaims} reclamos abiertos informados · {quality.postSale.refundOrders} pedidos con reembolso o contracargo. {quality.postSale.refundPending??quality.postSale.refundOrders} por conciliar. Los ajustes confirmados se descuentan como pérdidas, no como ventas ni ganancia cero. {quality.postSale.claimsUnchecked?`${quality.postSale.claimsUnchecked} órdenes todavía sin consulta confirmada de reclamos.`:''}</p><p>Abrí «Revisar reclamo y reembolso» en el pedido para consultar Mercado Libre o registrar un reembolso total con producto no recuperado. El reclamo se gestiona en Mercado Libre; Rentia consulta su estado y los pagos, no realiza devoluciones de dinero.</p><ul>{quality.postSale.orders.map(order=><li key={`${order.provider}:${order.externalOrderId}`}><a href={orderDetailsHref(order)}>#{order.externalOrderId}</a><span>{order.state}</span><span>{order.refundAmount===null?'Importe de reembolso no informado':`Reembolsado: ${money(order.refundAmount,order.currency)}`}</span><a className="postSaleAction" href={orderDetailsHref(order,true)}>Revisar reclamo y reembolso</a></li>)}</ul></section>}
    {quality.incompleteOrders.length>0&&<div className="qualityOrders"><div className="qualityPanelHead"><div><span className="muted">ÓRDENES A REVISAR</span><h3>Ventas con información pendiente</h3></div><button onClick={()=>onNavigate('ordenes')}>Ver todas las órdenes →</button></div><div className="qualityOrderTable"><div className="qualityOrderRow qualityOrderHead"><span>Orden</span><span>Fecha</span><span>Venta</span><span>Datos pendientes</span></div>{quality.incompleteOrders.map(order=><div className="qualityOrderRow" key={`${order.provider}:${order.externalOrderId}`}><a href={orderDetailsHref(order)}>#{order.orderNumber||order.externalOrderId}</a><span>{date(order.date)}</span><strong>{money(order.total,order.currency)}</strong><div>{order.missing.map(item=><em key={item}>{missingCostLabel[item]||item}</em>)}</div></div>)}</div></div>}
  </section>;
}

function ReportsSection({dashboard,products,ads,period,days,onPeriodChange}:{dashboard:Dashboard|null;products:ProductAnalyticsRow[];ads:MetaAdsData|null;period:string;days:number;onPeriodChange:(days:number)=>void}) {
  const money=useMoney();
  const [channel,setChannel]=useState('combined');
  const scoped=dashboard?.channels.find(row=>row.provider===channel);
  const metrics=channel!=='combined'&&dashboard?{...dashboard.metrics,revenue:scoped?.revenue||0,totalRevenue:scoped?.revenue||0,orders:scoped?.orders||0,totalOrders:scoped?.orders||0,totalAov:scoped?.aov||0,profit:scoped?.profit||0,margin:scoped?.revenue?(scoped.profit||0)/scoped.revenue*100:0,productCost:scoped?.productCost||0,shipping:scoped?.shipping||0,commissions:scoped?.commissions||0,taxes:scoped?.taxes||0,additional:scoped?.additional||0,refundLoss:scoped?.refundLoss||0,totalAdSpend:scoped?.adSpend||0,adSpend:0,adSpendComparable:false}:dashboard?.metrics;
  const profitAvailable=channel==='combined'||Boolean(scoped&&scoped.profit!==null);
  const reportPoints=channel==='combined'?dashboard?.timeline||[]:dashboard?.channelTimelines?.[channel]||[];
  const title=days===365?'Informe anual':days===90?'Informe trimestral':days===30?'Informe mensual':'Informe semanal';
  const reportSeries=aggregateTimeline(reportPoints,days);
  const topProducts=[...products].filter(row=>row.units_sold>0&&(channel==='combined'||row.provider===channel)).sort((a,b)=>b.profit-a.profit).slice(0,5);
  const topCampaigns=[...(channel==='combined'?ads?.campaigns||[]:[])].filter(row=>row.spend>0).sort((a,b)=>b.reported_roas-a.reported_roas).slice(0,5);
  const knownCosts=(metrics?.productCost||0)+(metrics?.shipping||0)+(metrics?.commissions||0)+(metrics?.taxes||0)+(metrics?.additional||0)+(metrics?.totalAdSpend??(metrics?.adSpendComparable?metrics.adSpend:0))+(metrics?.refundLoss||0);
  const costParts=[['Productos',metrics?.productCost||0],['Envíos',metrics?.shipping||0],['Comisiones',metrics?.commissions||0],['Impuestos',metrics?.taxes||0],['Adicionales',metrics?.additional||0],['Publicidad confirmada',metrics?.totalAdSpend??(metrics?.adSpendComparable?metrics?.adSpend||0:0)],['Pérdidas por reembolsos',metrics?.refundLoss||0]] as const;
  const missingCosts=channel==='combined'?dashboard?.quality.incompleteOrders.length||0:scoped?.pendingOrders||0;
  const exportReport=()=>{
    const rows:Array<Array<string|number>>=[
      ['Resumen','Canal',channel==='combined'?'Todos los canales':salesChannelLabel(channel)],['Resumen','Período',period],['Resumen','Órdenes',metrics?.totalOrders||0],['Resumen','Facturación',metrics?.totalRevenue||0],['Resumen',channel==='combined'?'Ganancia provisoria':'Ganancia conocida del canal (revisar cobertura de Ads)',profitAvailable?metrics?.profit||0:'Pendiente'],['Resumen','Margen sobre facturación del canal',profitAvailable?`${(metrics?.margin||0).toFixed(2)}%`:'Pendiente'],['Resumen','Inversión publicitaria',metrics?.totalAdSpend||0],['Resumen','ROAS global',channel==='combined'&&!!metrics?.totalAdSpend?(metrics?.blendedRoas||0).toFixed(2):'No aplicable'],
      ['Resumen','Rentabilidad',channel==='combined'?'Provisoria si faltan costos':`${scoped?.completeOrders||0} órdenes completas; ${scoped?.pendingOrders||0} pendientes. Publicidad y devoluciones según cobertura consultada.`],
      ...costParts.map(([label,value])=>['Costos conocidos',label,value]),
      ...reportSeries.map(row=>['Evolución',row.detail,`Facturación ${(row.storeRevenue+row.externalRevenue).toFixed(2)} · Ganancia ${profitAvailable?row.profit.toFixed(2):'Pendiente'}${channel==='combined'?' (provisoria si faltan costos)':' (órdenes completas, ajustes y publicidad conocida)'} · Publicidad ${row.adSpend.toFixed(2)} · Órdenes ${row.orders}`]),
      ...topProducts.map(row=>['Productos',row.product_name,`Ganancia ${row.profit.toFixed(2)} · Margen ${row.margin.toFixed(2)}%`]),
      ...topCampaigns.map(row=>['Meta Ads',row.name,`ROAS ${row.reported_roas.toFixed(2)} · Inversión ${row.spend.toFixed(2)}`]),
      ...(dashboard?reportDetailRows(dashboard,products,channel):[]),
    ];
    downloadCsv(`rentia-informe-${channel}-${days}-dias.csv`,['Sección','Indicador','Valor'],rows);
  };
  return <section className="reportsPage">
    <div className="reportsHeading"><div><span className="muted">ANÁLISIS EJECUTIVO</span><h2>{title}</h2><p>Una lectura completa de ventas, rentabilidad, costos, productos y publicidad usando exclusivamente la información conectada a Rentia.</p></div><div className="reportActions"><button className="exportButton" onClick={exportReport}><Download size={17} aria-hidden="true"/> Exportar CSV</button><button className="button" onClick={()=>window.print()}>Imprimir / PDF</button></div></div>
    <ChannelChartFilter value={channel} onChange={setChannel}/>
    <div className="reportPeriods">{periodOptions.map(option=><button key={option.days} className={days===option.days?'active':''} onClick={()=>onPeriodChange(option.days)}>{option.days===7?'Semana':option.days===30?'Mes':option.days===90?'Trimestre':'Año'}</button>)}</div>
    <div className="reportHero"><div><span>Ganancia conocida</span><strong className={metrics&&metrics.profit<0?'negativeProfit':'positiveProfit'}>{metrics&&profitAvailable?money(metrics.profit):'—'}</strong><small>{channel!=='combined'?channel==='mercadolibre'?'Órdenes completas − ajustes y Product Ads conocidos':'Órdenes completas · antes de Meta Ads':metrics?`${metrics.margin.toFixed(1)}% de margen sobre ventas de tienda`:'Cargando información'}</small></div><div className="reportHeroStats"><article><span>Facturación total</span><b>{metrics?money(metrics.totalRevenue):'—'}</b></article><article><span>Órdenes</span><b>{metrics?.totalOrders??'—'}</b></article><article><span>Ticket promedio</span><b>{metrics?money(metrics.totalAov):'—'}</b></article><article><span>ROAS global</span><b>{(metrics?.totalAdSpend||0)>0&&channel==='combined'?`${(metrics?.blendedRoas||0).toFixed(2)}x`:'—'}</b></article></div></div>
    {missingCosts>0&&<div className="reportWarning"><b>Informe con rentabilidad incompleta</b><span>{channel==='combined'?'Hay ventas con datos pendientes.':'Hay órdenes incompletas en este canal.'} {channel==='combined'?'La ganancia combinada es provisoria mientras falten costos.':'La ganancia por canal incluye solo órdenes completas.'} Los reembolsos requieren conciliación aparte.</span></div>}
    <div className="reportGrid"><article className="reportEvolution"><div className="reportTitle"><div><span className="muted">EVOLUCIÓN POR {timelineGranularity(days).toUpperCase()}</span><h3>Facturación y ganancia</h3></div><small>Período {period}</small></div>{reportSeries.length?<InteractiveTimelineChart points={reportPoints} days={days} mode={channel==='combined'||!!scoped?.completeOrders?'comparison':'single'} adCurrency={metrics?.metaCurrency||'ARS'}/>:<div className="emptyInline">Todavía no hay actividad para este período.</div>}<div className="chartLegend"><span><i/> Facturación</span>{(channel==='combined'||!!scoped?.completeOrders)&&<span><i className="profit"/> Ganancia {channel!=='combined'&&'conocida · según cobertura'}</span>}</div></article><article className="reportCosts"><span className="muted">ESTRUCTURA</span><h3>A dónde fue el dinero</h3><div>{costParts.map(([label,value])=><div key={label}><span>{label}</span><i><b style={{width:`${knownCosts?value?Math.max(2,value/knownCosts*100):0:0}%`}}/></i><strong>{money(value)}</strong></div>)}</div><footer><span>Costos conocidos</span><b>{money(knownCosts)}</b></footer></article></div>
    <div className="reportTables"><article><div className="reportTitle"><div><span className="muted">PRODUCTOS</span><h3>Mayor aporte a la ganancia</h3></div></div>{topProducts.length?<div>{topProducts.map((row,index)=><div className="reportRank" key={row.variant_id}><span>{index+1}</span><div><b>{row.product_name}</b><small>{row.units_sold} unidades · {row.margin.toFixed(1)}% margen</small></div><strong className={row.profit<0?'negativeProfit':'positiveProfit'}>{money(row.profit,row.currency)}</strong></div>)}</div>:<div className="emptyInline">Sin ventas de productos en este período.</div>}</article><article><div className="reportTitle"><div><span className="muted">PUBLICIDAD</span><h3>Campañas por ROAS reportado</h3></div></div>{topCampaigns.length?<div>{topCampaigns.map((row,index)=><div className="reportRank" key={row.external_campaign_id}><span>{index+1}</span><div><b>{row.name}</b><small>{money(row.spend,ads?.selected?.currency||'ARS')} invertidos</small></div><strong>{row.reported_roas.toFixed(2)}x</strong></div>)}</div>:<div className="emptyInline">{channel==='combined'?'Conectá o sincronizá Meta para completar este bloque.':'La inversión de Meta no se atribuye a un canal sin datos de atribución.'}</div>}</article></div>
    <ReportDetails data={dashboard} products={products} channel={channel} money={money}/>
    <div className="reportFoot"><span>Rentia · {title}</span><span>Generado el {new Intl.DateTimeFormat('es-AR',{dateStyle:'long',timeStyle:'short'}).format(new Date())}</span></div>
  </section>;
}

function AdvertisingSection({connected,data,dashboard,period,syncing,message,onSync,onConnect,onAccountChange}:{connected:boolean;data:MetaAdsData|null;dashboard:Dashboard|null;period:string;syncing:boolean;message:string;onSync:()=>void;onConnect:()=>void;onAccountChange:(accountId:string)=>void}) {
  const canManage=useContext(AccessContext);
  const money=useMoney();
  const [query,setQuery]=useState('');
  if(!connected) return <ComingSoonSection eyebrow="META ADS" title="Conectá tu cuenta publicitaria" description="Rentia importará inversión, compras atribuidas, ROAS y CPA por campaña con permisos de solo lectura." action="Conectar Meta Ads" onAction={onConnect}/>;
  const currency=data?.selected?.currency||'ARS';
  const summary=data?.summary;
  const comparable=Boolean(dashboard?.metrics.adSpendComparable);
  const attributedRevenue=summary?.purchaseValue||0;
  const observedRevenue=comparable?dashboard?.metrics.revenue||0:0;
  const comparisonMax=Math.max(1,attributedRevenue,observedRevenue);
  const reportedRoas=summary?.reportedRoas||0;
  const globalRoas=comparable&&summary?.spend?observedRevenue/summary.spend:0;
  const roasDifference=reportedRoas?((globalRoas/reportedRoas)-1)*100:0;
  const insight=!summary?.spend
    ? {tone:'neutral',title:'Todavía no hay inversión en este período',detail:'Probá otro rango de fechas o actualizá Meta para traer los últimos resultados.'}
    : !comparable
      ? {tone:'warning',title:'Las monedas no coinciden',detail:'Podemos mostrar los datos de Meta, pero no compararlos con la facturación de la tienda hasta unificar la moneda.'}
      : roasDifference>=0
        ? {tone:'positive',title:`El ROAS total es ${Math.abs(roasDifference).toFixed(1)}% mayor que el atribuido por Meta`,detail:'Hay ventas cobradas en la tienda que Meta no se adjudica. Para rentabilidad mirá el ROAS total; para optimizar campañas, el atribuido.'}
        : {tone:'warning',title:`Meta atribuye un ROAS ${Math.abs(roasDifference).toFixed(1)}% mayor que el total`,detail:'Revisá la atribución antes de escalar: la plataforma adjudica más valor que el observado en la facturación completa.'};
  const campaigns=(data?.campaigns||[]).filter(campaign=>campaign.name.toLowerCase().includes(query.toLowerCase()));
  const statusLabel=(value:string|null)=>value==='ACTIVE'?'Activa':value==='PAUSED'?'Pausada':value==='ARCHIVED'?'Archivada':value||'Sin estado';
  const exportRows=()=>downloadCsv(`rentia-meta-${period.replace(' ','-')}.csv`,['Campaña','Estado','Inversión','Compras atribuidas','Valor atribuido','ROAS Meta','CPA','Impresiones','Clics'],campaigns.map(row=>[row.name,statusLabel(row.effective_status||row.status),row.spend,row.purchases,row.purchase_value,row.reported_roas.toFixed(2),row.cpa.toFixed(2),row.impressions,row.clicks]));
  return <section className="adsPage">
    <div className="adsHeading"><div><div className="metaHeadingBrand"><img className="platformMark" src="/brands/meta.png" alt=""/><b>Meta Ads</b><small>Datos reales</small></div><h2>Publicidad y campañas</h2><p>Comparamos lo que Meta se atribuye con la facturación completa de tu tienda. Son dos lecturas distintas y Rentia las mantiene claramente separadas.</p></div><div className="adsHeadingActions">{!!data?.accounts.length&&<MetaAccountPicker accounts={data.accounts} value={data.selected?.external_account_id||''} onChange={onAccountChange} disabled={syncing||!canManage}/>}<button className="button" onClick={onSync} disabled={syncing||!canManage}><img className="platformMark" src="/brands/meta.png" alt=""/> {syncing?'Actualizando…':'Actualizar Meta'}</button></div></div>
    {message&&<div className="costFeedback">{message}</div>}
    {data?.sync?.last_error&&<div className="syncMessage error">{data.sync.last_error}</div>}
    {!data?.selected?<div className="sectionEmpty embedded"><span className="emptyIcon metaEmptyIcon"><img className="platformMark" src="/brands/meta.png" alt=""/></span><h2>No encontramos cuentas publicitarias</h2><p>Verificá que el usuario autorizado tenga acceso a una cuenta de anuncios dentro de Meta Business.</p><a className="button" href="/api/integrations/meta/start">Reautorizar Meta</a></div>:<>
      <div className="adsSummary">
        <article className="keyMetric"><span>Inversión <TermHelp term="Inversión"/></span><b>{money(summary?.spend||0,currency)}</b><small>Gasto total en Meta Ads</small></article>
        <article className="keyMetric metaMetric"><span>ROAS atribuido <TermHelp term="ROAS"/></span><b>{reportedRoas.toFixed(2)}x</b><small>{money(attributedRevenue,currency)} atribuidos por Meta</small></article>
        <article className="keyMetric rentiaMetric"><span>ROAS total tienda <TermHelp term="ROAS total tienda"/></span><b>{comparable?`${globalRoas.toFixed(2)}x`:'—'}</b><small>{comparable?'Facturación completa / inversión':'Las monedas no coinciden'}</small></article>
        <article className="keyMetric"><span>CPA atribuido <TermHelp term="CPA"/></span><b>{summary?.purchases?money(summary.cpa,currency):'—'}</b><small>{summary?.purchases||0} compras atribuidas</small></article>
        <article className="supportMetric"><span>Impresiones</span><b>{new Intl.NumberFormat('es-AR').format(summary?.impressions||0)}</b><small className="metricDetail">CTR {(summary?.ctr||0).toFixed(2)}% <TermHelp term="CTR"/></small></article>
        <article className="supportMetric"><span>Clics</span><b>{new Intl.NumberFormat('es-AR').format(summary?.clicks||0)}</b><small className="metricDetail">CPC {summary?.clicks?money(summary.cpc,currency):'—'} <TermHelp term="CPC"/></small></article>
      </div>
      <div className="adsComparison"><article><span className="metaBadge"><img src="/brands/meta.png" alt="Meta"/></span><div><small>Ventas atribuidas por Meta</small><b>{money(attributedRevenue,currency)}</b><i><span style={{width:`${attributedRevenue/comparisonMax*100}%`}}/></i></div><strong>{reportedRoas.toFixed(2)}x ROAS</strong></article><article><span className="rentiaBadge"><img src="/favicon.svg" alt="Rentia"/></span><div><small>Facturación total de la tienda</small><b>{comparable?money(observedRevenue,currency):'Moneda no comparable'}</b><i><span style={{width:`${comparable?observedRevenue/comparisonMax*100:0}%`}}/></i></div><strong>{comparable?`${globalRoas.toFixed(2)}x total`:'—'}</strong></article></div>
      <div className={`adsInsight ${insight.tone}`}><span>LECTURA RÁPIDA</span><div><b>{insight.title}</b><p>{insight.detail}</p></div></div>
      <div className="analyticsToolbar"><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar campaña"/><span className="resultCount">{campaigns.length} campañas · {period}</span><button className="exportButton" onClick={exportRows}><Download size={17} aria-hidden="true"/> Exportar CSV</button></div>
      <div className="adsTable"><div className="adsRow adsHead"><span>Campaña</span><span>Estado</span><span>Inversión</span><span>Compras</span><span>Ventas Meta</span><span>ROAS Meta <TermHelp term="ROAS"/></span><span>CPA <TermHelp term="CPA"/></span></div>{campaigns.map(campaign=><div className="adsRow" key={campaign.external_campaign_id}><div className="campaignName"><b>{campaign.name}</b><small>{campaign.daily_budget?`${money(campaign.daily_budget,currency)} / día`:campaign.lifetime_budget?`${money(campaign.lifetime_budget,currency)} total`:'Presupuesto en conjunto de anuncios'}</small></div><span className={`campaignStatus ${(campaign.effective_status||campaign.status||'').toLowerCase()}`}>{statusLabel(campaign.effective_status||campaign.status)}</span><b>{money(campaign.spend,currency)}</b><span>{campaign.purchases}</span><span>{money(campaign.purchase_value,currency)}</span><b>{campaign.reported_roas.toFixed(2)}x</b><span>{campaign.purchases?money(campaign.cpa,currency):'—'}</span></div>)}{!campaigns.length&&<div className="noResults">{syncing?'Importando campañas…':'No hay campañas para este período o búsqueda.'}</div>}</div>
      <div className="adsFootnote"><b>Cómo leer estos números</b><p>“ROAS Meta” usa compras y valores atribuidos por la plataforma. “ROAS global tienda” divide toda la facturación cobrada de la tienda por la inversión publicitaria. Para medir ganancia por campaña necesitaremos sumar atribución propia mediante Pixel/CAPI; no la estimamos.</p><span>{data.sync?.last_completed_at?`Última sincronización: ${new Date(data.sync.last_completed_at).toLocaleString('es-AR')}`:'Esperando la primera sincronización'}</span></div>
    </>}
  </section>;
}

function OrdersSection({orders:recentOrders,days,range,refreshKey,period,syncing,onSync,onRefresh,expandedOrder,setExpandedOrder}:{orders:OrderRow[];days:number;range:CustomDateRange|null;refreshKey:Dashboard|null;period:string;syncing:boolean;onSync:()=>void;onRefresh:()=>Promise<unknown>;expandedOrder:string|null;setExpandedOrder:(value:string|null)=>void}) {
  const canManage=useContext(AccessContext);
  const money=useMoney();
  const [query,setQuery]=useState('');
  const [page,setPage]=useState(1);
  const [orders,setOrders]=useState<OrderRow[]>([]);
  const scrolledToReview=useRef(false);
  useEffect(()=>{const params=new URLSearchParams(window.location.search),id=params.get('order'),provider=params.get('provider');if(id){setQuery(id);if(provider==='tiendanube'||provider==='mercadolibre')setExpandedOrder(`${provider}:${id}`);}},[setExpandedOrder]);
  const [total,setTotal]=useState(0);
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState('');
  const [reload,setReload]=useState(0);
  useEffect(()=>{
    if(loading||scrolledToReview.current||!window.location.hash.startsWith('#meli-review-'))return;
    const target=document.getElementById(window.location.hash.slice(1));
    if(!target)return;
    const frame=requestAnimationFrame(()=>{target.scrollIntoView({block:'start'});scrolledToReview.current=true;});
    return()=>cancelAnimationFrame(frame);
  },[loading,orders,expandedOrder]);
  useEffect(()=>{
    setLoading(true);setLoadError('');
    const controller=new AbortController();
    const timer=window.setTimeout(async()=>{
      setLoading(true);setLoadError('');
      try {
        const params=new URLSearchParams(analyticsQuery(days,range));params.set('page',String(page));params.set('q',query);
        const response=await fetch(`/api/orders?${params}`,{signal:controller.signal});
        if(!response.ok)throw new Error('orders_unavailable');
        const data=await response.json() as {orders:OrderRow[];pagination:{total:number;page:number}};
        if(!controller.signal.aborted){setOrders(data.orders);setTotal(data.pagination.total);if(data.pagination.page!==page)setPage(data.pagination.page);}
      }catch{if(!controller.signal.aborted)setLoadError('No pudimos cargar las órdenes. No se muestran resultados parciales.');}
      finally{if(!controller.signal.aborted)setLoading(false);}
    },250);
    return()=>{controller.abort();window.clearTimeout(timer);};
  },[query,page,period,days,range,refreshKey,reload]);
  const refreshOrders=async()=>{setReload(value=>value+1);await onRefresh();};
  const tableStart=useRef<HTMLDivElement>(null);
  useEffect(()=>{setPage(1);},[query,period]);
  const [checkingOrder,setCheckingOrder]=useState<string|null>(null);
  const [commissionCheck,setCommissionCheck]=useState<{orderId:string;message:string}|null>(null);
  async function checkCommission(order:OrderRow) {
    if(!canManage||order.provider!=='tiendanube')return;
    setCheckingOrder(`${order.provider}:${order.external_order_id}`);
    setCommissionCheck(null);
    try {
      const response=await fetch('/api/integrations/tiendanube/commission-diagnostic',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({orderId:order.external_order_id})});
      const result=await response.json() as {outcome?:string;httpStatus?:number;source?:'order_aggregate'|'transactions_endpoint';commission?:number;transactionCount?:number;paidTransactions?:number;chargeTypes?:string[]};
      let message='No pudimos comprobar el costo de esta orden. Intentá nuevamente.';
      if (response.ok) {
        if (result.outcome==='imported') { message=`Tiendanube informó un costo de procesamiento de ${money(result.commission||0,order.currency)}. Rentia ya lo descontó de la ganancia.`; await refreshOrders(); }
        else if (result.outcome==='upstream_error'&&result.httpStatus===403) message='Tiendanube rechazó temporalmente la consulta de cargos de esta orden (403). Rentia volverá a intentarlo automáticamente.';
        else if (result.outcome==='upstream_error'&&result.httpStatus===404) message='Tiendanube no encontró esta orden o todavía no publicó sus transacciones (404). Rentia volverá a comprobarla.';
        else if (result.outcome==='upstream_error') message=`Tiendanube respondió ${result.httpStatus||'con un error'} al consultar la orden con sus transacciones. El cargo no se importó todavía.`;
        else if (result.outcome==='no_charge') message=`Tiendanube respondió correctamente, pero no incluyó un cargo del comercio (${result.transactionCount||0} transacciones, ${result.paidTransactions||0} pagadas${result.chargeTypes?.length?`; tipos: ${result.chargeTypes.join(', ')}`:''}).`;
        else if (result.outcome==='invalid_response') message='Tiendanube respondió, pero no envió una lista válida de transacciones.';
        else if (result.outcome==='network_error') message='No se pudo completar la consulta. Probá nuevamente en unos minutos.';
        else if (result.outcome==='not_paid') message='La orden todavía no figura como pagada o fue cancelada.';
        else if (result.outcome==='not_connected') message='Primero conectá Tiendanube en Integraciones.';
        else if (result.outcome==='order_not_found') message='Esta orden no pertenece a la tienda conectada.';
      }
      setCommissionCheck({orderId:`${order.provider}:${order.external_order_id}`,message});
    } catch { setCommissionCheck({orderId:`${order.provider}:${order.external_order_id}`,message:'No pudimos completar la comprobación. Intentá nuevamente.'}); }
    finally { setCheckingOrder(null); }
  }
  const {current}=orderPageWindow(total,page);
  const visibleOrders=orders;
  function changePage(next:number,fromBottom=false) {
    setLoading(true);setPage(next);setExpandedOrder(null);
    if(fromBottom)tableStart.current?.scrollIntoView({block:'start'});
  }
  const exportOrders=()=>{const params=new URLSearchParams(analyticsQuery(days,range));params.set('q',query);window.location.href=`/api/orders/export?${params}`;};
  return <DataSection title="Órdenes" subtitle="Buscá, exportá y abrí cualquier venta para ver exactamente cómo llega Rentia a la ganancia real.">{(total>0||query||recentOrders.length||loading||loadError)?<><div className="analyticsToolbar"><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar por orden o medio de pago"/><span className="resultCount">{total.toLocaleString('es-AR')} órdenes</span><button className="exportButton" onClick={exportOrders} disabled={loading||Boolean(loadError)}><Download size={17} aria-hidden="true"/> Exportar CSV</button></div><div ref={tableStart} className="orderPaginationAnchor"><OrderPagination total={total} page={current} onChange={next=>changePage(next)} position="top"/></div>{loading?<div className="noResults" role="status">Cargando órdenes…</div>:loadError?<div className="noResults" role="alert">{loadError} <button className="outline" onClick={()=>setReload(value=>value+1)}>Reintentar</button></div>:<div className="dataTable orderTable"><div className="dataRow orderRow dataHead"><span>Orden</span><span>Origen / fecha</span><span>Pago</span><span>Venta</span><span>Costos</span><span>Ganancia</span></div>{visibleOrders.map(order=><div className="orderGroup" key={`${order.provider}-${order.external_order_id}`}><button className="dataRow orderRow orderToggle" onClick={()=>setExpandedOrder(expandedOrder===`${order.provider}:${order.external_order_id}`?null:`${order.provider}:${order.external_order_id}`)} aria-expanded={expandedOrder===`${order.provider}:${order.external_order_id}`}><b>#{order.order_number||order.external_order_id}</b><span className="orderOrigin"><b>{salesChannelLabel(order.provider)}</b><small>{date(order.source_created_at)}</small></span><span className={`payment ${order.payment_status}`}>{orderReturnNeedsReview(order)?'Reembolso':order.payment_status}</span><b>{money(order.total,order.currency)}</b><span>{orderReturnNeedsReview(order)?(order.refund_loss==null?'Por conciliar':money(order.refund_loss,order.currency)):money(order.product_cost+order.shipping_cost+order.commission_cost+order.tax_cost+order.additional_cost,order.currency)}</span><b className={orderReturnNeedsReview(order)&&order.refund_loss==null?'pendingValue':order.profit<0?'negativeProfit':'positiveProfit'}>{orderReturnNeedsReview(order)&&order.refund_loss==null?'En revisión':money(order.profit,order.currency)} <ChevronDown className="orderExpandIcon" size={16} aria-hidden="true" style={{transform:expandedOrder===`${order.provider}:${order.external_order_id}`?'rotate(180deg)':undefined}}/></b></button>{expandedOrder===`${order.provider}:${order.external_order_id}`&&<OrderBreakdown order={order} checking={checkingOrder===`${order.provider}:${order.external_order_id}`} checkMessage={commissionCheck?.orderId===`${order.provider}:${order.external_order_id}`?commissionCheck.message:null} onCheck={()=>void checkCommission(order)} onRefresh={refreshOrders}/>}</div>)}{!orders.length&&<div className="noResults">No encontramos órdenes con esa búsqueda.</div>}</div>}<OrderPagination total={total} page={current} onChange={next=>changePage(next,true)} position="bottom"/></>:<EmptyData syncing={syncing} onSync={onSync}/>}</DataSection>;
}

function ExternalRevenueSection({onChanged}:{onChanged:()=>Promise<unknown>}) {
  return <ExternalRevenue onChanged={onChanged} money={useMoney()} canManage={useContext(AccessContext)}/>;
}

function ExchangeRateSection({onChanged}:{onChanged:()=>Promise<unknown>}) {
  const {refreshRates}=usePreferences();
  return <ExchangeRateSettings onChanged={onChanged} onRatesChanged={refreshRates}/>;
}

function ComingSoonSection({eyebrow,title,description,action,onAction}:{eyebrow:string;title:string;description:string;action:string;onAction:()=>void}) { return <section className="sectionEmpty"><span className="muted">{eyebrow}</span><span className="emptyIcon">↗</span><h2>{title}</h2><p>{description}</p><button className="button" onClick={onAction}>{action}</button></section>; }

function AdvancedCostRules({rules,paymentMethods,onChanged}:{rules:CostRule[];paymentMethods:string[];onChanged:()=>Promise<void>}) {
  const money=useMoney();
  const [method,setMethod]=useState('');
  const [commissionPercent,setCommissionPercent]=useState('');
  const [commissionFixed,setCommissionFixed]=useState('');
  const [expenseName,setExpenseName]=useState('');
  const [expenseType,setExpenseType]=useState<'fixed_monthly'|'percentage_revenue'>('fixed_monthly');
  const [expenseValue,setExpenseValue]=useState('');
  const [expenseStart,setExpenseStart]=useState('');
  const [expenseEnd,setExpenseEnd]=useState('');
  const [ruleState,setRuleState]=useState('');
  const [saving,setSaving]=useState(false);

  async function requestRule(body:Record<string,unknown>) {
    if(saving)return false;
    setSaving(true);setRuleState('Guardando y recalculando…');
    try {
      const response=await fetch('/api/costs/rules',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
      if(!response.ok){setRuleState('No se guardó la regla. Revisá los valores y tus permisos.');return false;}
      await onChanged();setRuleState('Regla guardada y aplicada al historial.');return true;
    } catch {setRuleState('No pudimos confirmar el guardado. Recargá para verificar antes de agregarla otra vez.');return false;}
    finally {setSaving(false);}
  }

  async function addCommission(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name=method.trim(),percentage=parseCost(commissionPercent||'0'),amount=parseCost(commissionFixed||'0');
    if(!name||!Number.isFinite(percentage)||percentage<0||percentage>100||!Number.isFinite(amount)||amount<0||(!percentage&&!amount)){setRuleState('Ingresá un medio de pago y una comisión mayor a cero. El porcentaje no puede superar 100.');return;}
    if(rules.some(rule=>rule.category==='commission'&&rule.match_value?.trim().toLocaleLowerCase('es')===name.toLocaleLowerCase('es'))){setRuleState('Ya existe una regla para este medio de pago. Revisá la lista antes de agregar otra.');return;}
    const ok=await requestRule({category:'commission',name,matchValue:name,percentage,amount});
    if (ok) {setMethod('');setCommissionPercent('');setCommissionFixed('');}
  }

  async function addExpense(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value=parseCost(expenseValue||'0');
    const ok=await requestRule({category:'additional',name:expenseName,calculation:expenseType,amount:expenseType==='fixed_monthly'?value:0,percentage:expenseType==='percentage_revenue'?value:0,startsAt:expenseStart||null,endsAt:expenseEnd||null});
    if (ok) {setExpenseName('');setExpenseValue('');setExpenseStart('');setExpenseEnd('');}
  }

  async function removeRule(id:number) {
    if(saving||!window.confirm('¿Eliminar esta regla? La rentabilidad histórica se recalculará sin ella.'))return;
    setSaving(true);
    setRuleState('Eliminando y recalculando…');
    try {
      const response=await fetch('/api/costs/rules',{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({id})});
      if(response.ok){await onChanged();setRuleState('Regla eliminada. El historial fue recalculado.');}
      else setRuleState('No pudimos eliminar la regla.');
    } catch {setRuleState('No pudimos confirmar la eliminación. Recargá para verificar la lista.');}
    finally {setSaving(false);}
  }

  const commissionRules=rules.filter(rule=>rule.category==='commission');
  const expenseRules=rules.filter(rule=>rule.category==='additional');
  const ruleList=(items:CostRule[],empty:string)=><div className="deliveryRulesList">{items.map(rule=><article key={rule.id}><div><b>{rule.name}</b><small>{rule.category==='commission'?`${rule.percentage||0}%${rule.amount?` + ${money(rule.amount)} por orden`:''}`:rule.calculation==='fixed_monthly'?`${money(rule.amount)} por mes`:`${rule.percentage}% de facturación`}{rule.starts_at||rule.ends_at?` · ${rule.starts_at||'Inicio'} → ${rule.ends_at||'Sin fin'}`:''}</small></div><button type="button" disabled={saving} onClick={()=>void removeRule(rule.id)}>Eliminar</button></article>)}{!items.length&&<p className="deliveryRulesEmpty">{empty}</p>}</div>;

  return <div className="deliveryCustomRules">
    <section className="deliveryBlock" aria-labelledby="custom-payment-title">
      <div className="deliveryBlockHeading"><div className="deliveryBlockTitle"><span className="deliverySymbol"><CreditCard size={23}/></span><div><span className="deliveryEyebrow">04 · PAGOS PERSONALIZADOS</span><h3 id="custom-payment-title">Una regla para cada medio</h3></div></div><span className="deliveryBadge">Se guarda al agregar</span></div>
      <p className="deliveryIntro">Para transferencias, pasarelas u otros medios sin cargo exacto ni estimación de Pago Nube. La regla reemplaza la comisión general; no se suma a ella.</p>
      <form className="deliveryRuleForm" onSubmit={addCommission}>
        <fieldset disabled={saving}>
          <label className="deliveryField">Medio de pago<input list="payment-methods" value={method} onChange={event=>{setMethod(event.target.value);setRuleState('')}} maxLength={80} placeholder="Escribí el nombre del medio" required/><datalist id="payment-methods">{paymentMethods.map(value=><option value={value} key={value}/>)}</datalist></label>
          {!!paymentMethods.length&&<div className="detectedPayments"><span>Detectados en el período seleccionado</span><div>{paymentMethods.map(value=><button key={value} type="button" aria-pressed={method===value} onClick={()=>{setMethod(value);setRuleState('')}}>{value}</button>)}</div></div>}
          <div className="deliveryCommissionInputs"><label className="deliveryField">Comisión porcentual<div className="deliveryNumber suffix"><input type="number" min="0" max="100" step="0.01" value={commissionPercent} onChange={event=>setCommissionPercent(event.target.value)} inputMode="decimal" placeholder="0"/><span>%</span></div></label><span className="deliveryPlus" aria-hidden="true">+</span><label className="deliveryField">Fijo por orden<div className="deliveryNumber"><span>ARS</span><input type="number" min="0" step="0.01" value={commissionFixed} onChange={event=>setCommissionFixed(event.target.value)} inputMode="decimal" placeholder="0"/></div></label><button className="outline" type="submit" disabled={saving}>Agregar comisión</button></div>
          <small className="deliveryFormHint">El nombre debe coincidir con el medio informado en la orden. Completá el porcentaje, el monto fijo o ambos según tu acuerdo.</small>
        </fieldset>
      </form>
      <div className="deliveryRulesHeading"><h4>Reglas por medio de pago</h4><span>{commissionRules.length}</span></div>
      {ruleList(commissionRules,'No hay reglas personalizadas. Se respeta el cargo importado o el respaldo disponible.')}
    </section>

    <section className="deliveryBlock" aria-labelledby="additional-title">
      <div className="deliveryBlockHeading"><div className="deliveryBlockTitle"><span className="deliverySymbol"><Coins size={23}/></span><div><span className="deliveryEyebrow">05 · OTROS COSTOS</span><h3 id="additional-title">Gastos de tu operación</h3></div></div><span className="deliveryBadge">Opcional</span></div>
      <p className="deliveryIntro">Agencia, software o depósito: se distribuyen proporcionalmente entre las ventas. No cargues acá un costo que ya descontaste en otra sección.</p>
      <details className="deliveryDetails expenseDetails">
        <summary><span>Agregar un gasto adicional</span><Plus size={18}/></summary>
        <form className="deliveryRuleForm deliveryDetailsBody" onSubmit={addExpense}><fieldset disabled={saving}>
          <label className="deliveryField">Nombre del gasto<input value={expenseName} onChange={event=>setExpenseName(event.target.value)} maxLength={80} placeholder="Ej.: agencia de marketing" required/></label>
          <div className="deliveryFieldPair"><label className="deliveryField">Forma de cálculo<select value={expenseType} onChange={event=>setExpenseType(event.target.value as 'fixed_monthly'|'percentage_revenue')}><option value="fixed_monthly">Importe mensual</option><option value="percentage_revenue">% de facturación</option></select></label><label className="deliveryField">Valor<div className={`deliveryNumber ${expenseType==='percentage_revenue'?'suffix':''}`}>{expenseType==='fixed_monthly'&&<span>ARS</span>}<input type="number" min="0.01" max={expenseType==='percentage_revenue'?100:undefined} step="0.01" value={expenseValue} onChange={event=>setExpenseValue(event.target.value)} inputMode="decimal" placeholder="0" required/>{expenseType==='percentage_revenue'&&<span>%</span>}</div></label></div>
          <div className="deliveryFieldPair"><label className="deliveryField">Desde · opcional<input type="date" value={expenseStart} max={expenseEnd||undefined} onChange={event=>setExpenseStart(event.target.value)}/></label><label className="deliveryField">Hasta · opcional<input type="date" value={expenseEnd} min={expenseStart||undefined} onChange={event=>setExpenseEnd(event.target.value)}/></label></div>
          <button className="outline" type="submit" disabled={saving}>Agregar gasto</button>
        </fieldset></form>
      </details>
      {!!expenseRules.length&&<><div className="deliveryRulesHeading"><h4>Gastos configurados</h4><span>{expenseRules.length}</span></div>{ruleList(expenseRules,'')}</>}
    </section>
    {ruleState&&<div className="costFeedback" role="status" aria-live="polite">{ruleState}</div>}
  </div>;
}

function ProductAnalyticsSection({rows,period,syncing,onSync}:{rows:ProductAnalyticsRow[];period:string;syncing:boolean;onSync:()=>void}) {
  const money=useMoney();
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState<'todos'|'ganancia'|'perdida'|'sin_ventas'>('todos');
  const filtered=rows.filter(row=>`${row.product_name} ${row.sku||''}`.toLowerCase().includes(query.toLowerCase())&&(filter==='todos'||(filter==='ganancia'&&row.profit>0)||(filter==='perdida'&&row.profit<0)||(filter==='sin_ventas'&&row.units_sold===0)));
  const revenue=rows.reduce((sum,row)=>sum+Number(row.revenue||0),0);
  const profit=rows.reduce((sum,row)=>sum+Number(row.profit||0),0);
  const units=rows.reduce((sum,row)=>sum+Number(row.units_sold||0),0);
  const margin=revenue?profit/revenue*100:0;
  const exportRows=()=>downloadCsv(
    `rentia-productos-${period.replace(' ','-')}.csv`,
    ['Producto','SKU','Unidades','Órdenes','Facturación','Costo producto','Envíos','Comisiones','Estado comisión','Impuestos','Costos adicionales','Costos totales','Ganancia','Margen'],
    filtered.map(row=>[row.product_name,row.sku||'',row.units_sold,row.orders,row.revenue,row.product_cost,row.shipping_cost,row.commission_cost,row.commission_pending?'Pendiente':row.commission_estimated?'Estimada':'Exacta',row.tax_cost,row.additional_cost,row.total_costs,row.profit,row.margin.toFixed(2)]),
  );
  return <DataSection title="Rentabilidad por producto" subtitle={`Resultados reales del período ${period}, calculados por variante y SKU.`}>
    {rows.length?<>
      <div className="analyticsSummary"><article><span>Facturación</span><b>{money(revenue)}</b></article><article><span>Ganancia neta</span><b className={profit<0?'negativeProfit':'positiveProfit'}>{money(profit)}</b></article><article><span>Margen</span><b>{margin.toFixed(1)}%</b></article><article><span>Unidades vendidas</span><b>{units}</b></article></div>
      <div className="analyticsToolbar"><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar producto o SKU"/><div className="filterTabs">{([['todos','Todos'],['ganancia','Con ganancia'],['perdida','Con pérdida'],['sin_ventas','Sin ventas']] as const).map(([id,label])=><button key={id} className={filter===id?'active':''} onClick={()=>setFilter(id)}>{label}</button>)}</div><button className="exportButton" onClick={exportRows}><Download size={17} aria-hidden="true"/> Exportar CSV</button></div>
      <div className="analyticsTable">
        <div className="analyticsRow analyticsHead"><span>Producto / SKU <TermHelp term="SKU"/></span><span>Unidades</span><span>Órdenes</span><span>Facturación</span><span>Costo unit.</span><span>Comisiones <TermHelp term="Comisiones"/></span><span>Costos totales</span><span>Ganancia</span><span>Margen</span></div>
        {filtered.map(row=><div className="analyticsRow" key={row.variant_id}>
          <div className="analyticsProduct"><b>{row.product_name}</b><small>{row.sku||`Variante ${row.external_variant_id}`}</small></div>
          <span>{row.units_sold}</span><span>{row.orders}</span><b>{money(row.revenue,row.currency)}</b>
          <span>{row.effective_cost?money(row.effective_cost,row.currency):<i className="missingValue">Sin costo</i>}</span>
          <span className="commissionCell">{row.commission_pending&&row.commission_cost===0?<i className="missingValue">Pendiente</i>:money(row.commission_cost,row.currency)}{row.commission_pending&&row.commission_cost>0?<small>Parcial</small>:row.commission_estimated?<small>Estimada</small>:null}</span>
          <span>{money(row.total_costs,row.currency)}</span><b className={row.profit<0?'negativeProfit':'positiveProfit'}>{money(row.profit,row.currency)}</b>
          <span className={`marginBadge ${row.margin<0?'negative':row.units_sold?'positive':''}`}>{row.units_sold?`${row.margin.toFixed(1)}%`:'—'}</span>
        </div>)}
        {!filtered.length&&<div className="noResults">No hay productos para este filtro.</div>}
      </div>
    </>:<EmptyData syncing={syncing} onSync={onSync}/>}
  </DataSection>;
}

type InventoryStatus='saludable'|'bajo'|'critico'|'sin_stock'|'sin_movimiento'|'no_controla';
function inventoryStatus(row:ProductAnalyticsRow):InventoryStatus { if(row.stock===null)return'no_controla';if(row.stock<=0)return'sin_stock';if(row.sales_per_day<=0)return'sin_movimiento';if((row.days_stock||0)<=7)return'critico';if((row.days_stock||0)<=14)return'bajo';return'saludable'; }
function inventoryStatusLabel(status:InventoryStatus) { return status==='saludable'?'Saludable':status==='bajo'?'Stock bajo':status==='critico'?'Crítico':status==='sin_stock'?'Sin stock':status==='sin_movimiento'?'Sin movimiento':'No controla'; }

function InventorySection({rows,period,syncing,onSync}:{rows:ProductAnalyticsRow[];period:string;syncing:boolean;onSync:()=>void}) {
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState<'todos'|'alertas'|'sin_stock'|'sin_movimiento'>('todos');
  const withStatus=rows.map(row=>({...row,inventory_status:inventoryStatus(row)}));
  const filtered=withStatus.filter(row=>`${row.product_name} ${row.sku||''}`.toLowerCase().includes(query.toLowerCase())&&(filter==='todos'||(filter==='alertas'&&['bajo','critico','sin_stock'].includes(row.inventory_status))||(filter==='sin_stock'&&row.inventory_status==='sin_stock')||(filter==='sin_movimiento'&&row.inventory_status==='sin_movimiento')));
  const tracked=withStatus.filter(row=>row.stock!==null);
  const totalStock=tracked.reduce((sum,row)=>sum+Math.max(0,Number(row.stock||0)),0);
  const alerts=withStatus.filter(row=>['bajo','critico','sin_stock'].includes(row.inventory_status)).length;
  const outOfStock=withStatus.filter(row=>row.inventory_status==='sin_stock').length;
  const exportRows=()=>downloadCsv(`rentia-inventario-${period.replace(' ','-')}.csv`,['Producto','SKU','Stock','Ventas período','Venta diaria','Días de stock','Estado'],filtered.map(row=>[row.product_name,row.sku||'',row.stock??'No controla',row.units_sold,row.sales_per_day.toFixed(2),row.days_stock===null?'':row.days_stock.toFixed(1),inventoryStatusLabel(row.inventory_status)]));
  return <DataSection title="Inventario multi-SKU" subtitle={`Stock actual y velocidad calculada con las ventas del período ${period}.`}>{rows.length?<><div className="analyticsSummary"><article><span>Unidades en stock</span><b>{totalStock}</b></article><article><span>SKU controlados <TermHelp term="SKU"/></span><b>{tracked.length}</b></article><article className={alerts?'warning':''}><span>Alertas de reposición</span><b>{alerts}</b></article><article className={outOfStock?'danger':''}><span>Sin stock</span><b>{outOfStock}</b></article></div><div className="analyticsToolbar"><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar producto o SKU"/><div className="filterTabs">{([['todos','Todos'],['alertas','Alertas'],['sin_stock','Sin stock'],['sin_movimiento','Sin movimiento']] as const).map(([id,label])=><button key={id} className={filter===id?'active':''} onClick={()=>setFilter(id)}>{label}</button>)}</div><button className="exportButton" onClick={exportRows}><Download size={17} aria-hidden="true"/> Exportar CSV</button></div><div className="inventoryTable"><div className="inventoryRow inventoryHead"><span>Producto / SKU <TermHelp term="SKU"/></span><span>Stock</span><span>Ventas</span><span>Ritmo diario</span><span>Duración estimada</span><span>Estado</span></div>{filtered.map(row=><div className="inventoryRow" key={row.variant_id}><div className="analyticsProduct"><b>{row.product_name}</b><small>{row.sku||`Variante ${row.external_variant_id}`}</small></div><b>{row.stock===null?'—':row.stock}</b><span>{row.units_sold} u.</span><span>{row.sales_per_day.toFixed(2)} u./día</span><span>{row.stock===null?'No controla':row.sales_per_day<=0?'Sin ventas':`${Math.max(0,row.days_stock||0).toFixed(0)} días`}</span><span className={`inventoryPill ${row.inventory_status}`}>{inventoryStatusLabel(row.inventory_status)}</span></div>)}{!filtered.length&&<div className="noResults">No hay productos para este filtro.</div>}</div></>:<EmptyData syncing={syncing} onSync={onSync}/>}</DataSection>;
}

function OrderBreakdown({order,checking,checkMessage,onCheck,onRefresh}:{order:OrderRow;checking:boolean;checkMessage:string|null;onCheck:()=>void;onRefresh:()=>Promise<unknown>}) {
  const canManage=useContext(AccessContext);
  const money=useMoney();
  const [feeDraft,setFeeDraft]=useState(order.manual_commission_cost===null?'':String(order.manual_commission_cost));
  const [savingFee,setSavingFee]=useState(false);
  const [feeMessage,setFeeMessage]=useState('');
  async function saveFee(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(order.provider!=='tiendanube')return;
    const cost=parseCost(feeDraft);
    if (!feeDraft.trim()||!Number.isFinite(cost)||cost<0||cost>order.total) {setFeeMessage('Ingresá el costo exacto de procesamiento, sin superar el total de la venta.');return;}
    setSavingFee(true);setFeeMessage('Guardando…');
    try {
      const response=await fetch('/api/orders/commission',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({orderId:order.external_order_id,cost})});
      if (!response.ok) {setFeeMessage('No pudimos guardar este costo.');return;}
      await onRefresh();setFeeMessage('Costo exacto guardado. Se recalculó la ganancia.');
    } catch {setFeeMessage('No pudimos guardar este costo.');}
    finally {setSavingFee(false);}
  }
  const totalCosts=order.product_cost+order.shipping_cost+order.commission_cost+order.tax_cost+order.additional_cost;
  const returnReview=orderReturnNeedsReview(order);
  const claimOpen=order.post_sale?.claims.some(claim=>claim.status==='opened')||false;
  const productsMissing=order.items.some(item=>item.cost_source==='sin_costo');
  const commissionMissing=order.commission_source==='Sin costo de pago informado'||order.commission_source==='Mercado Libre · cargo pendiente';
  const commissionEstimated=order.commission_source.startsWith('Pago Nube · calculada');
  return <div className="orderBreakdown">
    <div className="orderItems">
      <span className="muted">PRODUCTOS DE LA ORDEN</span>
      {order.items.map(item=><div className="orderProductLine" key={item.external_line_id}><span><b>{item.quantity}× {item.name}</b><small>{item.sku||'Sin SKU'} · {item.external_variant_id||item.external_product_id||'Identificador no informado'} · costo {sourceLabel(item.cost_source).toLowerCase()}</small></span><b>{money(Number(item.unit_cost)*Number(item.quantity),order.currency)}</b>{canManage&&<OrderItemCost provider={order.provider} orderId={order.external_order_id} lineId={item.external_line_id} currency={order.currency} cost={Number(item.unit_cost)} manual={item.cost_source==='orden_manual'} onRefresh={onRefresh}/>}</div>)}
      {!order.items.length&&<p>No hay líneas de producto disponibles para esta orden.</p>}
      {order.provider==='mercadolibre'&&<MeliOrderReview orderId={order.external_order_id} currency={order.currency} postSale={order.post_sale} canManage={canManage} onRefresh={onRefresh}/>}
      {order.provider==='mercadolibre'&&['refunded','charged_back'].includes(order.payment_status)&&<RefundAdjustmentEditor key={`${order.external_order_id}:${order.refund_adjustment?.confirmedAt||''}`} orderId={order.external_order_id} currency={order.currency} value={order.refund_adjustment} loss={order.refund_loss} canManage={canManage} onRefresh={onRefresh}/>}
      <div className="orderMeta"><span><b>Medio de pago</b><small>{order.payment_method||'No informado'}</small></span><span><b>Origen de comisión</b><small>{order.commission_source}</small></span></div>
      {order.provider==='mercadolibre'&&<a className="meliBillingLink" href={`/panel?section=cargos-meli&billing-order=${encodeURIComponent(order.external_order_id)}&billing-period=${encodeURIComponent(order.source_created_at.slice(0,7)+'-01')}`}>Ver cargos oficiales relacionados con esta orden</a>}
    </div>
    <div className="profitBreakdown">
      <span className="muted">CUENTA REAL</span>
      {returnReview&&<p className="commissionWarning" role="status">{order.refund_adjustment?'Reembolso total confirmado manualmente: el cliente conservó el producto. La pérdida descuenta el costo del producto y los cargos retenidos que confirmaste, sin volver a descontar la venta.':'Reembolso detectado. Esta orden no se cuenta como venta cobrada. Falta conciliar los cargos retenidos y el estado del producto; su resultado no es necesariamente cero.'}</p>}
      <div><span>{returnReview?'Venta original':'Facturación'}</span><b>{money(order.total,order.currency)}</b></div>
      <div><span>Productos</span><b>− {money(order.product_cost,order.currency)}</b></div>
      <div><span>Envío <small>({order.refund_adjustment?'retenido · ajuste manual':order.shipping_source})</small></span><b>{returnReview?(order.refund_adjustment?`− ${money(order.refund_adjustment.shipping,order.currency)}`:'Por conciliar'):`− ${money(order.shipping_cost,order.currency)}`}</b></div>
      <div><span>Comisiones</span><b>{returnReview?(order.refund_adjustment?`− ${money(order.refund_adjustment.fees,order.currency)}`:'Por conciliar'):commissionMissing?'Pendiente':`− ${money(order.commission_cost,order.currency)}`}</b></div>
      <div><span>Impuestos {order.provider==='mercadolibre'&&<small>({order.refund_adjustment?'retenidos · ajuste manual':'configurados, no conciliados'})</small>}</span><b>{returnReview?(order.refund_adjustment?`− ${money(order.refund_adjustment.taxes,order.currency)}`:'Por conciliar'):`− ${money(order.tax_cost,order.currency)}`}</b></div>
      <div><span>Gastos adicionales</span><b>{returnReview?(order.refund_adjustment?`− ${money(order.refund_adjustment.extra,order.currency)}`:'Por conciliar'):`− ${money(order.additional_cost,order.currency)}`}</b></div>
      <div className="profitTotal"><span>{returnReview?'Resultado de la devolución':commissionMissing||commissionEstimated||productsMissing||claimOpen?'Ganancia provisoria':'Ganancia neta'} {!returnReview&&<small>{order.margin.toFixed(1)}% margen</small>}</span><b className={returnReview&&order.refund_loss==null?'pendingValue':order.profit<0?'negativeProfit':'positiveProfit'}>{returnReview&&order.refund_loss==null?'En revisión':money(order.profit,order.currency)}</b></div>
      {claimOpen&&!returnReview&&<p className="commissionWarning">Hay un reclamo abierto. El pago todavía no confirma un reembolso y esta ganancia no se considera confirmada.</p>}
      {productsMissing&&!returnReview&&<p className="commissionWarning">Hay productos sin costo configurado. La ganancia es provisoria y todavía no descuenta esos costos.</p>}
      {order.provider==='mercadolibre'&&<p className="commissionWarning">Este resultado usa los costos de la orden y los impuestos configurados. Los cargos mensuales, percepciones, retenciones y bonificaciones del reporte oficial aún requieren conciliación; no se descuentan dos veces. El período de facturación puede ser distinto al mes de la venta.</p>}
      {commissionMissing&&<p className="commissionWarning">{order.commission_missing_reason||'Falta el costo de procesamiento del pago.'} Esta ganancia todavía no lo descuenta.</p>}
      {commissionEstimated&&<p className="commissionWarning">Comisión calculada automáticamente con la tarifa pública de Pago Nube; el proveedor no informó el cargo exacto de esta orden.</p>}
      {order.provider==='tiendanube'&&order.payment_status==='paid'&&<div className="commissionDiagnostic"><button className="outline" type="button" onClick={onCheck} disabled={checking}>{checking?'Consultando Tiendanube…':'Comprobar costo de pago'}</button>{checkMessage&&<p role="status">{checkMessage}</p>}</div>}
      {order.provider==='tiendanube'&&order.payment_status==='paid'&&order.source_commission_cost===null&&commissionMissing&&<form className="manualCommissionForm" onSubmit={saveFee}><label>Costo exacto, si Tiendanube no lo entrega por API<input value={feeDraft} onChange={event=>setFeeDraft(event.target.value)} inputMode="decimal" placeholder="Ej.: 4276,14"/></label><button className="outline" type="submit" disabled={savingFee}>{savingFee?'Guardando…':'Guardar costo'}</button>{feeMessage&&<small role="status">{feeMessage}</small>}</form>}
      <small className="totalCostNote">{returnReview?(order.refund_loss==null?'Costos retenidos pendientes de conciliación':`Pérdida confirmada manualmente: ${money(order.refund_loss,order.currency)}`):`Costos totales: ${money(totalCosts,order.currency)}`}</small>
    </div>
  </div>;
}

function DataSection({title,subtitle,children}:{title:string;subtitle:string;children:React.ReactNode}) { return <section className="dataSection"><div><span className="muted">DATOS REALES</span><h2>{title}</h2><p>{subtitle}</p></div>{children}</section>; }
function EmptyData({syncing,onSync}:{syncing:boolean;onSync:()=>void}) { return <div className="sectionEmpty embedded"><span className="emptyIcon">↻</span><h2>{syncing?'Sincronizando…':'Todavía no hay datos importados'}</h2><p>Consultaremos nuevamente la información autorizada de Tiendanube.</p><button className="button" onClick={onSync} disabled={syncing}>{syncing?'Actualizando…':'Actualizar datos'}</button></div>; }
