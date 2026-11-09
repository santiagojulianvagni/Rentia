'use client';

import RpDate from '../../components/panel/rp-date';
import ProductAds, { useProductAds } from '../../components/product-ads';
import { analyticsRangeFromUrl } from '../../lib/analytics-range';
import { useClerk, useUser } from '@clerk/nextjs';
import { MercadoLibreIntegration, useMercadoLibreSync } from '../../components/mercadolibre-integration';
import { ConnectionNotice, ConnectionUpdatedAt } from '../../components/connection-status';
import { automaticSyncDue, connectionHealth } from '../../lib/connection-health';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Plus, RefreshCw, ArrowRight, LogOut, PanelLeft, Search, CalendarDays, ChevronDown, Coins, CreditCard, Languages, LifeBuoy, Menu, PlugZap, ShieldCheck, Sparkles, TriangleAlert, UsersRound, X } from 'lucide-react';
import SetupChecklist from '../../components/setup-checklist';
import { useUiTranslation } from '../../components/ui-language';
import { preferredLanguage } from '../../lib/ui-translate';
import type { ProductCostRow } from '../../components/product-costs';
import MetaAccountPicker from '../../components/meta-account-picker';
import type { CostSettings } from '../../lib/cost-engine';
import { formatDisplayRange, rollingDisplayRange } from '../../lib/display-dates';
import type { LiveRates } from '../../lib/exchange-rates';
import { accountAppearance } from '../../lib/account-appearance';
import AlertsBell, { type AlertReads } from '../../components/panel/alerts-bell';
import { cashflowView, useCashflowData } from '../../components/panel/use-cashflow';
import { alertKey, buildAlerts, defaultAlertSettings, urgentAlerts, type AlertSettings } from '../../lib/alerts';
import { campaignMargins, campaignProfits } from '../../lib/campaign-profit';
import dynamic from 'next/dynamic';
import { sectionLoading, RpRing, ProductCosts, MeliBilling, ShippingCommissionSettings, Cashflow, WeeklySummary, UtmTools, AbandonedCarts, LifetimeValue, Customers, SalesEvents, CampaignProfit, NavItem, overviewSections, operationSections, configurationSections, sections, periodOptions, Integration, ProductAnalyticsRow, MetaAdsData, Dashboard, CostRule, SubscriptionData, OrderQuota, DisplayCurrency, DisplayLanguage, CustomDateRange, DashboardLayoutConfig, defaultDashboardLayout, ExchangeRates, PreferencesContext, locales, AccessContext, usePreferences, useT, useMoney, analyticsQuery, inclusiveRangeDays, previousDateRange, defaultDateRange, parseCost, automaticSyncLabel, ComingSoonSection } from './shared';
import '../report-details.css';
import '../order-review.css';
import './panel-v2.css';
import './rp.css';
import './rp-extra.css';
import './rp-glass.css';

// Cada sección del panel se carga recién cuando se abre.
const SubscriptionSection=dynamic(()=>import('./sections/subscription').then(module=>module.SubscriptionSection),{loading:sectionLoading});
const TeamSection=dynamic(()=>import('./sections/team').then(module=>module.TeamSection),{loading:sectionLoading});
const DashboardEditor=dynamic(()=>import('./sections/dashboard').then(module=>module.DashboardEditor),{loading:sectionLoading});
const DashboardOverview=dynamic(()=>import('./sections/dashboard').then(module=>module.DashboardOverview),{loading:sectionLoading});
const DecisionCenter=dynamic(()=>import('./sections/dashboard').then(module=>module.DecisionCenter),{loading:sectionLoading});
const DataQualitySection=dynamic(()=>import('./sections/quality').then(module=>module.DataQualitySection),{loading:sectionLoading});
const ReportsSection=dynamic(()=>import('./sections/reports').then(module=>module.ReportsSection),{loading:sectionLoading});
const AdvertisingSection=dynamic(()=>import('./sections/advertising').then(module=>module.AdvertisingSection),{loading:sectionLoading});
const OrdersSection=dynamic(()=>import('./sections/orders').then(module=>module.OrdersSection),{loading:sectionLoading});
const ExternalRevenueSection=dynamic(()=>import('./sections/costs').then(module=>module.ExternalRevenueSection),{loading:sectionLoading});
const ExchangeRateSection=dynamic(()=>import('./sections/costs').then(module=>module.ExchangeRateSection),{loading:sectionLoading});
const AdvancedCostRules=dynamic(()=>import('./sections/costs').then(module=>module.AdvancedCostRules),{loading:sectionLoading});
const ProductAnalyticsSection=dynamic(()=>import('./sections/products').then(module=>module.ProductAnalyticsSection),{loading:sectionLoading});
const InventorySection=dynamic(()=>import('./sections/products').then(module=>module.InventorySection),{loading:sectionLoading});

// Fundido corto del contenido al cambiar idioma, moneda o período.
function flashContent() {
  if(typeof document==='undefined'||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
  document.querySelector('.p-content')?.animate([{opacity:.35,filter:'blur(4px)',transform:'translateY(6px)'},{opacity:1,filter:'blur(0)',transform:'none'}],{duration:480,easing:'cubic-bezier(.2,.8,.2,1)'});
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
    const savedLanguage=preferredLanguage() as DisplayLanguage;
    const savedRates=window.localStorage.getItem('rentia-exchange-rates');
    if(savedCurrency&&['ARS','USD','EUR'].includes(savedCurrency))setCurrencyState(savedCurrency);
    if(savedLanguage&&['es','pt','en'].includes(savedLanguage))setLanguageState(savedLanguage);
    if(savedRates){try{setRates(JSON.parse(savedRates) as ExchangeRates);}catch{window.localStorage.removeItem('rentia-exchange-rates')}}
    void refreshRates().catch(()=>undefined);
  });},[]);
  useUiTranslation(language);
  const setCurrency=(value:DisplayCurrency)=>{flashContent();setCurrencyState(value);window.localStorage.setItem('rentia-display-currency',value)};
  const setLanguage=(value:DisplayLanguage)=>{flashContent();setLanguageState(value);window.localStorage.setItem('rentia-display-language',value)};
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
  // La sección de la dirección (por ejemplo ?section=semanal) se aplica apenas carga el panel,
  // sin esperar al resto de la carga inicial.
  useEffect(()=>{const section=new URLSearchParams(window.location.search).get('section');if(section&&sections.some(item=>item.id===section))void Promise.resolve().then(()=>setActive(section));},[]);
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
  const [alertsOpen,setAlertsOpen]=useState(false);
  const [alertSettings,setAlertSettings]=useState<AlertSettings>(defaultAlertSettings);
  const [alertReads,setAlertReads]=useState<AlertReads>({});
  useEffect(()=>{fetch('/api/alerts/reads',{cache:'no-store'}).then(response=>response.ok?response.json() as Promise<{reads?:AlertReads}>:null).then(data=>{if(data?.reads)setAlertReads(data.reads);}).catch(()=>undefined);},[]);
  // Se marca al instante en pantalla y después se guarda; si falla, queda como estaba.
  const markAlerts=(keys:string[],state:'seen'|'dismissed')=>{
    const previous=alertReads;
    setAlertReads(current=>({...current,...Object.fromEntries(keys.filter(key=>current[key]!=='dismissed').map(key=>[key,state]))}));
    fetch('/api/alerts/reads',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({keys,state})}).then(response=>response.ok?response.json() as Promise<{reads?:AlertReads}>:Promise.reject()).then(data=>{if(data.reads)setAlertReads(data.reads);}).catch(()=>setAlertReads(previous));
  };
  useEffect(()=>{fetch('/api/alerts/settings',{cache:'no-store'}).then(response=>response.ok?response.json() as Promise<{settings?:AlertSettings}>:null).then(data=>{if(data?.settings)setAlertSettings(data.settings);}).catch(()=>undefined);},[]);
  const [paletteOpen,setPaletteOpen]=useState(false);
  const [paletteQuery,setPaletteQuery]=useState('');
  const [paletteIndex,setPaletteIndex]=useState(0);
  const [quota,setQuota]=useState<OrderQuota|null>(null);
  // Prueba gratis por terminar: se avisa arriba del panel en los últimos 3 días.
  const [trialEnding,setTrialEnding]=useState<{days:number;endsAt:string}|null>(null);
  const [planLabel,setPlanLabel]=useState('');
  // Una instalación de Tiendanube que quedó en espera (por ejemplo, si se cerró el onboarding) se conecta al entrar.
  useEffect(()=>{fetch('/api/integrations/tiendanube/claim',{cache:'no-store'}).then(response=>response.ok?response.json() as Promise<{pending?:boolean}>:null).then(async data=>{if(!data?.pending)return;const response=await fetch('/api/integrations/tiendanube/claim',{method:'POST'});const result=await response.json().catch(()=>({})) as {claimed?:boolean;automatic?:boolean;reason?:string};if(result.claimed)window.location.assign(`/panel?section=integraciones&connected=tiendanube${result.automatic?'':'&automation=pending'}`);else if(result.reason==='store_already_connected')window.location.assign('/panel?section=integraciones&error=store_already_connected');}).catch(()=>undefined);},[]);
  useEffect(()=>{let cancelled=false;fetch('/api/subscription',{cache:'no-store'}).then(response=>response.ok?response.json():null).then((data:SubscriptionData|null)=>{if(cancelled)return;if(data?.quota)setQuota(data.quota);const sub=data?.subscription;if(sub?.status==='trialing'&&sub.trialDaysRemaining<=3)setTrialEnding({days:Math.max(1,sub.trialDaysRemaining),endsAt:sub.trialEndsAt});if(sub)setPlanLabel(sub.status==='trialing'?'Prueba gratis':(({free:'Gratis',starter:'Starter',growth:'Growth',pro:'Pro',scale:'Scale',enterprise:'Enterprise'} as Record<string,string>)[['active','past_due'].includes(sub.status)?sub.planId:'free']||''));}).catch(()=>{});return()=>{cancelled=true;};},[active]);
  useEffect(()=>{
    const invalid=(event:Event)=>{
      const field=event.target as HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement;
      if(!field.closest?.('.p-root'))return;
      event.preventDefault();
      const wrapper=(field.closest('.p-input,.p-range label')||field) as HTMLElement;
      wrapper.classList.add('p-invalid');
      let note=wrapper.nextElementSibling as HTMLElement|null;
      if(!note?.classList.contains('p-invalidNote')){note=document.createElement('small');note.className='p-invalidNote';note.setAttribute('role','alert');wrapper.after(note);}
      note.textContent=field.validationMessage;
      const form=field.form;if(form&&form.querySelector(':invalid')===field)(field.classList.contains('p-dateRequired')?wrapper.querySelector<HTMLElement>('button'):field)?.focus();
      const clear=()=>{wrapper.classList.remove('p-invalid');note?.remove();field.removeEventListener('input',clear);};
      field.addEventListener('input',clear);
    };
    document.addEventListener('invalid',invalid,true);
    return()=>document.removeEventListener('invalid',invalid,true);
  },[]);
  useEffect(()=>{const open=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();setPaletteQuery('');setPaletteIndex(0);setPaletteOpen(true);}};window.addEventListener('keydown',open);return()=>window.removeEventListener('keydown',open);},[]);
  const toolbarRef=useRef<HTMLElement>(null);
  const [notice,setNotice]=useState('');
  const [integrations,setIntegrations]=useState<Integration[]>([]);
  const [integrationsLoaded,setIntegrationsLoaded]=useState(false);
  const [dashboard,setDashboard]=useState<Dashboard|null>(null);
  // Cashflow del mes: se recarga cuando cambian los datos del resumen.
  const cashflowState=useCashflowData(dashboard);
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
  // Versión de los datos del resumen: solo se recalcula cuando cambia (ver /api/dashboard/version).
  const dashboardVersion=useRef('');
  const latestAds=useRef<MetaAdsData|null>(null);
  const periodDaysRef=useRef(30);
  const activeRangeRef=useRef<CustomDateRange|null>(null);
  const mercadoLibreState=useMercadoLibreSync(canManage,()=>Promise.all([loadDashboard(periodDaysRef.current),loadProductCosts(),loadProductAnalytics(periodDaysRef.current)]));
  const [advertisingTab,setAdvertisingTab]=useState('ganancia');
  const productAdsState=useProductAds(canManage,analyticsQuery(periodOptions.find(option=>option.label===period)?.days||30,customRange),()=>loadDashboard(periodDaysRef.current));
  useEffect(()=>{const ads=new URLSearchParams(window.location.search).get('ads');if(ads==='mercadolibre'||ads==='utm')queueMicrotask(()=>setAdvertisingTab(ads));},[]);

  async function loadDashboard(days=30,range=activeRangeRef.current) {
    const currentQuery=analyticsQuery(days,range);
    const previousQuery=range?analyticsQuery(days,previousDateRange(range)):`days=${days}&offset=${days}`;
    const [version,response,previousResponse]=await Promise.all([currentDashboardVersion(),fetch(`/api/dashboard?${currentQuery}`),fetch(`/api/dashboard?${previousQuery}`)]);
    if (response.status===401) { window.location.href='/onboarding'; return null; }
    if (!response.ok) return null;
    const data=await response.json() as Dashboard;
    const previous=previousResponse.ok?await previousResponse.json() as Dashboard:null;
    // El plan muestra historial desde una fecha: se avisa si el rango pedido empezaba antes.
    latestDashboard.current=data;setDashboard(data);setPreviousDashboard(previous);if(version)dashboardVersion.current=version;return data;
  }

  async function currentDashboardVersion() {
    try { const response=await fetch('/api/dashboard/version',{cache:'no-store'}); return response.ok?(await response.json() as {version:string}).version:null; }
    catch { return null; }
  }

  async function refreshDashboardIfChanged() {
    const version=await currentDashboardVersion();
    if(version&&version!==dashboardVersion.current)await loadDashboard(periodDaysRef.current);
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
          store_already_connected:'Esa tienda de Tiendanube ya está conectada a otra cuenta de Rentia. Ingresá con esa cuenta o escribinos a hola@rentiaapp.com.',
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
    const refreshTimer=window.setInterval(()=>{if (document.visibilityState==='visible') void refreshDashboardIfChanged();},30_000);
    const syncTimer=window.setInterval(()=>{if (tiendanubeConnected&&document.visibilityState==='visible') void runSync(true);},15*60_000);
    const syncWhenVisible=()=>{
      if(document.visibilityState!=='visible')return;
      void refreshDashboardIfChanged();
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
    flashContent();
    const next=periodOptions.find(option=>option.days===days)||periodOptions[1];
    periodDaysRef.current=next.days;activeRangeRef.current=null;setCustomRange(null);setPeriod(next.label);setPeriodOpen(false);setCustomRangeOpen(false);
    void Promise.all([loadDashboard(next.days,null),loadProductAnalytics(next.days,null),loadMetaAds(next.days,null)]);
  }

  useEffect(()=>{
    if (!periodOpen&&!customRangeOpen&&!currencyOpen&&!languageOpen&&!dashboardMenuOpen&&!profileOpen) return;
    const close=()=>{setPeriodOpen(false);setCustomRangeOpen(false);setCurrencyOpen(false);setLanguageOpen(false);setDashboardMenuOpen(false);setProfileOpen(false);setAlertsOpen(false);};
    const outside=(event:PointerEvent)=>{if(event.target instanceof Element&&event.target.closest('.p-datePanel,.p-selectMenu'))return;if(event.target instanceof Node&&!toolbarRef.current?.contains(event.target))close();};
    const escape=(event:KeyboardEvent)=>{if(event.target instanceof Element&&event.target.closest('.p-datePanel,.p-selectMenu'))return;if(event.key==='Escape'){const trigger=toolbarRef.current?.querySelector<HTMLButtonElement>('button[aria-expanded="true"]');close();trigger?.focus();}};
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


  const tiendanube=integrations.find(item=>item.provider==='tiendanube'&&item.status==='connected');
  const meta=integrations.find(item=>item.provider==='meta'&&item.status==='connected');
  const hasSalesConnection=Boolean(tiendanube||integrations.some(item=>item.provider==='mercadolibre'&&['authorized','connected'].includes(mercadoLibreState.view?.connection?.status||item.status)));
  const connections=connectionHealth({loaded:integrationsLoaded,integrations,tiendanube:dashboard?.sync||null,meta:dashboard?.ads?.sync||adsData?.sync||null,metaSelected:Boolean(dashboard?.ads?.selected||adsData?.selected),mercadolibre:mercadoLibreState.view,tiendanubeRunning:syncing,metaRunning:syncingMeta,meliRunning:mercadoLibreState.running,meliError:mercadoLibreState.error});
  const campaignMarginsNow=campaignMargins(dashboard);
  const campaignRows=campaignProfits({meta:dashboard?.metrics.adSpendComparable?adsData?.campaigns||[]:[],mercadolibre:dashboard?.metrics.meliAdsComparable?productAdsState.data?.campaigns||[]:[],metaMargin:campaignMarginsNow.meta,meliMargin:campaignMarginsNow.mercadolibre});
  const cashflowNow=cashflowState.data?cashflowView(cashflowState.data,costRules).result:null;
  const cashflowAlert=cashflowNow?{status:cashflowNow.status,shortfall:cashflowNow.shortfall,perDay:cashflowNow.perDay,monthName:new Intl.DateTimeFormat('es-AR',{month:'long',timeZone:'UTC'}).format(new Date(`${cashflowNow.month}-01T00:00:00Z`)),elapsed:cashflowNow.elapsed}:null;
  // Las alertas de margen miran el margen antes de gastos fijos; la cobertura de los fijos la avisa Cashflow.
  const alertMetrics=(value:Dashboard|null)=>value?{revenue:value.metrics.totalRevenue,profit:value.metrics.profit,margin:value.metrics.marginBeforeFixed??value.metrics.margin,orders:value.metrics.totalOrders}:null;
  const businessAlerts=buildAlerts({metrics:alertMetrics(dashboard),previous:alertMetrics(previousDashboard),quality:dashboard?.quality?{completeOrders:dashboard.quality.completeOrders,totalOrders:dashboard.quality.totalOrders}:null,adsConnected:Boolean(dashboard?.ads.connected),syncError:dashboard?.sync?.status==='error',products:productAnalytics.filter(row=>!row.rentia_archived),missingCosts:costRows.filter(row=>!row.rentia_archived&&row.effective_cost<=0).length,campaigns:campaignRows,settings:alertSettings,money,cashflow:cashflowAlert});
  const navBadges={
    costs:costRows.filter(row=>!row.rentia_archived&&row.effective_cost<=0).length,
    inventory:productAnalytics.filter(row=>!row.rentia_archived&&row.stock!==null&&row.units_sold>0&&(row.stock<=0||(row.days_stock??0)<=14)).length,
    actions:urgentAlerts(businessAlerts).filter(alert=>alertReads[alertKey(alert)]!=='dismissed').length,
  };
  const activeLabel=t(sections.find(item=>item.id===active)?.label||'Configuración');
  const storeInitials=store.split(/\s+/).filter(Boolean).map(word=>word[0]).join('').slice(0,2).toUpperCase()||'R';
  const selectedPeriodDays=customRange?inclusiveRangeDays(customRange):(periodOptions.find(option=>option.label===period)?.days||30);
  const displayRange=customRange||rollingDisplayRange(selectedPeriodDays);
  const displayPeriod=formatDisplayRange(displayRange,locales[language]);

  const closeMenus=()=>{setPeriodOpen(false);setCustomRangeOpen(false);setCurrencyOpen(false);setLanguageOpen(false);setDashboardMenuOpen(false);setProfileOpen(false);setAlertsOpen(false);};
  const toggleMenu=(menu:'period'|'currency'|'language'|'dashboard'|'profile'|'alerts')=>{const open={period:periodOpen||customRangeOpen,currency:currencyOpen,language:languageOpen,dashboard:dashboardMenuOpen,profile:profileOpen,alerts:alertsOpen}[menu];closeMenus();if(open)return;({period:setPeriodOpen,currency:setCurrencyOpen,language:setLanguageOpen,dashboard:setDashboardMenuOpen,profile:setProfileOpen,alerts:setAlertsOpen})[menu](true);};
  const navGroups:Array<[string,NavItem[],boolean]>=[[t('RESUMEN'),overviewSections,false],[t('OPERACIÓN'),operationSections,false],[t('CONFIGURACIÓN'),configurationSections,true]];
  const navCount:Record<string,number>={acciones:navBadges.actions,inventario:navBadges.inventory,costos:navBadges.costs};
  const periodLabel=customRange?displayPeriod:selectedPeriodDays===90?t('Trimestre'):selectedPeriodDays===365?t('Año'):`${t('Últimos')} ${t(period)}`;
  const paletteItems=[...sections.map(item=>({label:t(item.label),hint:configurationSections.includes(item)?'configuración':operationSections.includes(item)?'operación':'resumen',run:()=>selectSection(item.id)})),
    ...(canManage?[{label:'Actualizar datos de Tiendanube',hint:'acción',run:()=>void runSync()},{label:'Personalizar dashboard',hint:'acción',run:()=>{selectSection('resumen');setDashboardEditorOpen(true);}}]:[])].filter(item=>item.label.toLowerCase().includes(paletteQuery.toLowerCase()));

  return <AccessContext.Provider value={canManage}><div className="p-root p-glass" onKeyDown={event=>{if(event.key==='Escape'){closeMenus();setPaletteOpen(false);}}}><div className={`p-app ${sidebarCollapsed?'p-collapsed':''} ${mobileNavOpen?'p-navOpen':''}`}>
    <aside className="p-side">
      <div className="p-sideTop"><a className="p-brand" href="/panel?section=resumen" title="Rentia"><img src="/favicon.svg" alt=""/><span className="p-brandName"><span>Rentia</span><small>{store}{planLabel?` · ${planLabel}`:''}</small></span></a><button type="button" className="p-iconBtn p-hideSm" onClick={toggleSidebar} aria-label={sidebarCollapsed?'Expandir menú':'Contraer menú'} title={sidebarCollapsed?'Expandir menú':'Contraer menú'}><PanelLeft className="p-i" aria-hidden="true"/></button><button type="button" className="p-iconBtn p-mobileClose" onClick={()=>setMobileNavOpen(false)} aria-label="Cerrar navegación"><X className="p-i" aria-hidden="true"/></button></div>
      <nav className="p-navScroll" aria-label="Navegación principal">{navGroups.map(([group,items,collapsible])=><div key={group}>{collapsible?<button type="button" className="p-navGroup p-navToggle" aria-expanded={settingsOpen} onClick={()=>{if(sidebarCollapsed){setSidebarCollapsed(false);window.localStorage.setItem('rentia-sidebar-collapsed','0');setSettingsOpen(true);}else setSettingsOpen(current=>!current);}}>{group}<ChevronDown aria-hidden="true"/></button>:<div className="p-navGroup">{group}</div>}<div className={`p-navList ${collapsible&&!settingsOpen?'p-closed':''}`}>{items.map(item=>{const Icon=item.icon;const count=navCount[item.id];return <button type="button" key={item.id} className={`p-navItem ${active===item.id?'p-on':''}`} onClick={()=>selectSection(item.id)} title={t(item.label)} aria-current={active===item.id?'page':undefined}><Icon className="p-i" aria-hidden="true" strokeWidth={1.9}/><span className="p-navLabel">{t(item.label)}</span>{item.badge?<span className="p-navBadge">{t(item.badge)}</span>:count?<span className="p-navCount">{count}</span>:null}</button>;})}</div></div>)}</nav>
      <div className="p-sideFoot">
        <button type="button" className={`p-status tone-${connections.tone}`} onClick={()=>selectSection('integraciones')} title={`${t(connections.label)}. ${connections.detail}`}><span className="p-pulse"/><span className="p-txt">{t(connections.label)}</span></button>
        {dashboard?.quality&&dashboard.quality.status!=='empty'&&(()=>{const quality=dashboard.quality;const ready=quality.completeOrders===quality.totalOrders;return <button type="button" className={`p-sideQuality ${ready?'p-ready':''}`} onClick={()=>selectSection('calidad')} title={`${quality.score}% de calidad de datos: ${quality.completeOrders} de ${quality.totalOrders} órdenes con todos sus costos.`}><RpRing value={quality.score} size={34} color={ready?'#32d583':'#f5c451'}/><span className="p-txt"><b>{quality.score}% calidad de datos</b><small>{ready?`${quality.totalOrders.toLocaleString('es-AR')} órdenes con costos completos`:`${(quality.totalOrders-quality.completeOrders).toLocaleString('es-AR')} órdenes por revisar`}</small></span></button>;})()}
      </div>
    </aside>
    <button type="button" className="p-navScrim" onClick={()=>setMobileNavOpen(false)} aria-label="Cerrar navegación"/>
    <div className="p-main">
      <header className="p-top" ref={toolbarRef}>
        <button type="button" className="p-iconBtn p-mobileMenu" onClick={()=>setMobileNavOpen(true)} aria-label="Abrir navegación"><Menu className="p-i" aria-hidden="true"/></button>
        <div className="p-crumbs"><small title={store}>{store}</small><small aria-hidden="true">›</small><b>{activeLabel}</b></div>
        <div className="p-topRight">
          <button type="button" className="p-ctrlBtn p-hideMd p-paletteBtn" onClick={()=>{closeMenus();setPaletteQuery('');setPaletteIndex(0);setPaletteOpen(true);}}><Search className="p-i" aria-hidden="true"/><span className="p-paletteText">{t('Buscar órdenes, productos o clientes…')}</span> <span className="p-kbd">Ctrl K</span></button>
          <button type="button" className={`p-liveChip p-hideSm tone-${connections.tone}`} onClick={()=>selectSection('integraciones')} title={`${t(connections.label)}. ${connections.detail}`} aria-label={t(connections.label)}><span className="p-pulse"/><span className="p-liveText">{t(connections.label)}</span></button>
          <div className="p-ctrl"><button type="button" className="p-ctrlBtn" onClick={()=>toggleMenu('period')} aria-expanded={periodOpen||customRangeOpen} aria-label={`${t('Período')}: ${displayPeriod}`}><CalendarDays className="p-i" aria-hidden="true"/><span>{periodLabel}</span><ChevronDown className="p-i" aria-hidden="true"/></button>
            <div className={`p-menu p-wide ${periodOpen||customRangeOpen?'p-open':''}`}>{periodOptions.map(option=><button type="button" key={option.days} className={!customRange&&selectedPeriodDays===option.days?'p-on':''} onClick={()=>{changePeriod(option.days);closeMenus();}}><span>{t(option.days===90?'Trimestre':option.days===365?'Año':`Últimos ${option.label}`)}<small>{formatDisplayRange(rollingDisplayRange(option.days),locales[language])}</small></span>{!customRange&&selectedPeriodDays===option.days&&'✓'}</button>)}<hr/><small className="p-menuCap">{t('PERSONALIZADO')}</small><form className="p-range" onSubmit={applyCustomRange}><label>{t('Desde')}<RpDate value={rangeDraft.start} max={rangeDraft.end} onChange={event=>setRangeDraft(current=>({...current,start:event.target.value}))} required/></label><label>{t('Hasta')}<RpDate value={rangeDraft.end} min={rangeDraft.start} max={new Date().toISOString().slice(0,10)} onChange={event=>setRangeDraft(current=>({...current,end:event.target.value}))} required/></label>{rangeError&&<small className="p-rangeError">{rangeError}</small>}<button className="p-btn p-small p-primary" type="submit" style={{gridColumn:'1/-1'}}>{t('Aplicar rango')}</button></form></div></div>
          <div className="p-ctrl p-hideSm" title={`${rateSource}${rates[currency]?` · 1 ${currency} = ${new Intl.NumberFormat('es-AR',{maximumFractionDigits:2}).format(rates[currency]||1)} ARS`:''}`}><button type="button" className="p-ctrlBtn" onClick={()=>toggleMenu('currency')} aria-expanded={currencyOpen} aria-label="Moneda de visualización"><Coins className="p-i" aria-hidden="true"/><span>{currency}</span><ChevronDown className="p-i" aria-hidden="true"/></button>
            <div className={`p-menu ${currencyOpen?'p-open':''}`}>{(['ARS','USD','EUR'] as DisplayCurrency[]).map(value=><button type="button" key={value} className={currency===value?'p-on':''} disabled={!rates[value]} onClick={()=>{setCurrency(value);setCurrencyOpen(false);}}><span>{value}<small>{value==='ARS'?'Pesos argentinos':rates[value]?`1 ${value} = $ ${new Intl.NumberFormat('es-AR',{maximumFractionDigits:2}).format(rates[value]||1)}`:'Sin cotización'}</small></span>{currency===value&&'✓'}</button>)}<hr/><button type="button" onClick={()=>{closeMenus();selectSection('moneda');}}>{t('Configurar cotización')}</button></div></div>
          <div className="p-ctrl p-hideSm"><button type="button" className="p-ctrlBtn" onClick={()=>toggleMenu('language')} aria-expanded={languageOpen} aria-label="Idioma"><Languages className="p-i" aria-hidden="true"/><span className="p-ctrlLabel">{language.toUpperCase()}</span></button>
            <div className={`p-menu ${languageOpen?'p-open':''}`}>{([['es','Español'],['pt','Português'],['en','English']] as const).map(([value,label])=><button type="button" key={value} className={language===value?'p-on':''} onClick={()=>{setLanguage(value);setLanguageOpen(false);}}><span>{label}</span>{language===value&&'✓'}</button>)}</div></div>
          {canManage&&<button type="button" className="p-btn p-primary p-small p-costBtn" onClick={()=>{closeMenus();selectSection('costos');}}><Plus className="p-i" aria-hidden="true"/><span className="p-hideSm">Cargar costo</span></button>}
          <AlertsBell alerts={businessAlerts} reads={alertReads} open={alertsOpen} onToggle={()=>toggleMenu('alerts')} onClose={closeMenus} onMark={markAlerts} onNavigate={section=>{closeMenus();selectSection(section);}}/>
          <div className="p-ctrl"><button type="button" className="p-avatar" onClick={()=>toggleMenu('profile')} aria-label="Abrir mi cuenta" aria-expanded={profileOpen}>{profileUser?.imageUrl?<img src={profileUser.imageUrl} alt=""/>:storeInitials}</button>
            <div className={`p-menu p-accountMenu ${profileOpen?'p-open':''}`}><div className="p-accHead"><span className="p-accAvatar">{profileUser?.imageUrl?<img src={profileUser.imageUrl} alt=""/>:storeInitials}</span><span><b>{profileUser?.fullName||'Mi cuenta'}</b><small>{profileUser?.primaryEmailAddress?.emailAddress||'Perfil personal de Rentia'}</small></span></div><button type="button" className="p-accStore" onClick={()=>{closeMenus();selectSection('plan');}}><span className="p-avatarSq">{storeInitials}</span><span><small className="p-menuCap">TIENDA ACTUAL</small><b>{store}</b></span>{planLabel&&<em className="p-planPill">{planLabel}</em>}</button><hr/><button type="button" onClick={openAccountSettings} disabled={!profileLoaded}><ShieldCheck className="p-i" aria-hidden="true"/><span>Administrar mi cuenta<small>Perfil, seguridad y dispositivos</small></span></button><button type="button" onClick={()=>{closeMenus();selectSection('plan');}}><CreditCard className="p-i" aria-hidden="true"/><span>{t('Plan y facturación')}<small>Tu plan, pagos y comprobantes</small></span></button>{canManage&&<button type="button" onClick={()=>{closeMenus();selectSection('equipo');}}><UsersRound className="p-i" aria-hidden="true"/><span>{t('Equipo')}<small>Invitá a quienes trabajan con vos</small></span></button>}<button type="button" onClick={()=>{closeMenus();selectSection('integraciones');}}><PlugZap className="p-i" aria-hidden="true"/><span>{t('Integraciones')}<small>{t(connections.label)}</small></span></button><a href="mailto:hola@rentiaapp.com" onClick={closeMenus}><LifeBuoy className="p-i" aria-hidden="true"/><span>Ayuda y soporte<small>hola@rentiaapp.com</small></span></a><hr/><div className="p-showSm"><small className="p-menuCap">MONEDA</small><div className="p-menuSeg">{(['ARS','USD','EUR'] as DisplayCurrency[]).map(value=><button type="button" key={value} className={currency===value?'p-on':''} disabled={!rates[value]} onClick={()=>setCurrency(value)}>{value}</button>)}</div><small className="p-menuCap">IDIOMA</small><div className="p-menuSeg">{([['es','ES'],['pt','PT'],['en','EN']] as const).map(([value,label])=><button type="button" key={value} className={language===value?'p-on':''} onClick={()=>setLanguage(value)}>{label}</button>)}</div><hr/></div><button type="button" onClick={logout}><LogOut className="p-i" aria-hidden="true"/>{t('Cerrar sesión')}</button></div></div>
        </div>
      </header>

      {accessRole==='member'&&<div className="p-readOnly"><ShieldCheck className="p-i" aria-hidden="true"/><span><b>Acceso de consulta</b> Podés ver datos y exportar informes. Los cambios los realiza el propietario o un administrador.</span></div>}
      <main className="p-content appPage">
      {quota?.enforced&&quota.limit!==null&&active!=='plan'&&(quota.skippedTotal>0||quota.used>=quota.limit)&&<div className="p-notice p-warning" role="status"><TriangleAlert className="p-i" aria-hidden="true"/><div><b>{quota.skippedTotal>0?`Hay ${quota.skippedTotal.toLocaleString('es-AR')} ${quota.skippedTotal===1?'orden':'órdenes'} sin importar por el límite de tu plan`:'Tu tienda llegó al límite de órdenes de su plan este mes'}</b><p>Tu plan importa hasta {quota.limit.toLocaleString('es-AR')} órdenes por mes. Tus datos no se pierden: al elegir un plan mayor, las recuperamos automáticamente.</p></div><button type="button" className="p-btn p-small p-primary" onClick={()=>selectSection('plan')}>Ver planes</button></div>}
      {trialEnding&&active!=='plan'&&<div className="p-notice p-warning" role="status"><Sparkles className="p-i" aria-hidden="true"/><div><b>{trialEnding.days<=1?'Tu prueba gratis termina mañana':`Tu prueba gratis termina en ${trialEnding.days} días`}</b><p>El {new Intl.DateTimeFormat('es-AR',{day:'numeric',month:'long'}).format(new Date(trialEnding.endsAt))} pasás al plan Gratis (50 órdenes por mes y 12 meses de historial) si no elegís un plan. No perdés ningún dato.</p></div><button type="button" className="p-btn p-small p-primary" onClick={()=>selectSection('plan')}>Elegir plan</button></div>}
      <fieldset className="managementFields" disabled={!canManage&&['costos','configuracion','moneda','integraciones'].includes(active)}>
      {dashboard?.historyFrom&&['resumen','ordenes','productos','clientes','publicidad'].includes(active)&&<div className="p-note" role="status" style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}><span>Tu plan muestra desde el <b>{new Date(`${dashboard.historyFrom}T12:00:00`).toLocaleDateString('es-AR')}</b>. Tus datos anteriores están guardados.</span><button type="button" className="p-btn p-small" onClick={()=>selectSection('plan')}>Ver más historial</button></div>}
      {active==='equipo'?<TeamSection onPlans={()=>selectSection('plan')}/>:active==='resumen'?<>
        {integrationsLoaded&&!hasSalesConnection&&<div className="p-notice p-import"><PlugZap className="p-i" aria-hidden="true"/><div><b>{t('Conectá tu tienda para empezar')}</b><p>Enlazar el canal es independiente de cargar envío, comisiones e impuestos.</p></div><button type="button" className="p-btn p-small p-primary" onClick={()=>selectSection('integraciones')}>Ver conexiones</button></div>}
        <ConnectionNotice health={connections} onOpen={()=>selectSection('integraciones')}/>
        {settingsLoaded&&costsLoaded&&dashboard&&<SetupChecklist connected={hasSalesConnection} productCount={costRows.filter(row=>!row.rentia_archived).length} missingProductCosts={costRows.filter(row=>!row.rentia_archived&&row.cost_source==='sin_costo').length} costsConfigured={dashboard.quality.configurationSaved} adsConnected={Boolean(meta&&adsData?.selected)} canManage={canManage} onNavigate={selectSection}/>}
        <DashboardOverview dashboard={dashboard} previousDashboard={previousDashboard} onPeriodChange={changePeriod} syncing={syncing} days={selectedPeriodDays} storeName={store} periodLabel={displayPeriod} layout={dashboardLayout} savingLayout={savingDashboard} onNavigate={selectSection} onEdit={()=>{setDashboardEditorOpen(true);setDashboardPreferenceMessage('');}} onLayoutReorder={next=>{setDashboardLayout(next);void saveDashboardPreferences(next,false);}} onChartChange={chart=>{const next={...dashboardLayout,chart};setDashboardLayout(next);void saveDashboardPreferences(next,false);}}/>
      </>:active==='acciones'?<DecisionCenter dashboard={dashboard} products={productAnalytics.filter(row=>!row.rentia_archived)} costs={costRows.filter(row=>!row.rentia_archived)} alerts={businessAlerts} campaigns={campaignRows} alertSettings={alertSettings} canManage={canManage} onAlertSettings={setAlertSettings} onNavigate={selectSection}/>
      :active==='cashflow'?<Cashflow data={cashflowState.data} error={cashflowState.error} rules={costRules} money={money} onNavigate={selectSection}/>
      :active==='eventos'?<SalesEvents money={money} canManage={canManage}/>
      :active==='semanal'?<WeeklySummary money={money} storeName={store} settings={alertSettings} onNavigate={selectSection}/>
      :active==='calidad'?<DataQualitySection dashboard={dashboard} onNavigate={selectSection}/>
      :active==='informes'?<ReportsSection dashboard={dashboard} products={productAnalytics} ads={adsData} period={displayPeriod} days={selectedPeriodDays} onPeriodChange={changePeriod}/>
      :active==='ordenes'?<OrdersSection orders={dashboard?.orders||[]} days={periodDaysRef.current} range={activeRangeRef.current} refreshKey={dashboard} period={displayPeriod} syncing={syncing} onSync={()=>void runSync()} onRefresh={()=>loadDashboard(periodDaysRef.current)} expandedOrder={expandedOrder} setExpandedOrder={setExpandedOrder}/>
      :active==='productos'?<ProductAnalyticsSection rows={productAnalytics.filter(row=>!row.rentia_archived)} period={displayPeriod} syncing={syncing} onSync={()=>void runSync()}/>
      :active==='inventario'?<InventorySection rows={productAnalytics.filter(row=>!row.rentia_archived)} period={displayPeriod} syncing={syncing} onSync={()=>void runSync()}/>
      :active==='carritos'?<AbandonedCarts query={analyticsQuery(periodOptions.find(option=>option.label===period)?.days||30,customRange)} period={displayPeriod} money={money} tiendanubeConnected={Boolean(tiendanube)} onConnect={()=>selectSection('integraciones')}/>
      :active==='lifetime'?<LifetimeValue query={analyticsQuery(periodOptions.find(option=>option.label===period)?.days||30,customRange)} period={displayPeriod} money={money} marginBeforeAds={dashboard?.metrics.revenue?dashboard.metrics.profitBeforeAds/dashboard.metrics.revenue:null} adSpend={dashboard?.metrics.totalAdSpend??dashboard?.metrics.adSpend??0}/>
      :active==='clientes'?<Customers query={analyticsQuery(periodOptions.find(option=>option.label===period)?.days||30,customRange)} period={displayPeriod} money={money}/>
      :active==='publicidad'?<><div style={{marginBottom:18}}><div className="p-tabs" role="tablist" aria-label="Plataforma publicitaria" style={{display:'inline-flex'}}><button type="button" role="tab" aria-selected={advertisingTab==='ganancia'} className={advertisingTab==='ganancia'?'p-on':''} onClick={()=>setAdvertisingTab('ganancia')}>Ganancia por campaña</button><button type="button" role="tab" aria-selected={advertisingTab==='meta'} className={advertisingTab==='meta'?'p-on':''} onClick={()=>setAdvertisingTab('meta')}>Meta Ads</button><button type="button" role="tab" aria-selected={advertisingTab==='mercadolibre'} className={advertisingTab==='mercadolibre'?'p-on':''} onClick={()=>setAdvertisingTab('mercadolibre')}>Mercado Libre · Product Ads</button><button type="button" role="tab" aria-selected={advertisingTab==='utm'} className={advertisingTab==='utm'?'p-on':''} onClick={()=>setAdvertisingTab('utm')}>UTMs y nombres</button></div></div>{advertisingTab==='utm'?<UtmTools canManage={canManage} onConnect={()=>selectSection('integraciones')}/>:advertisingTab==='ganancia'?<CampaignProfit rows={campaignRows} money={money} metaMargin={campaignMarginsNow.meta} meliMargin={campaignMarginsNow.mercadolibre} metaComparable={Boolean(dashboard?.metrics.adSpendComparable)} meliComparable={Boolean(dashboard?.metrics.meliAdsComparable)} metaConnected={Boolean(dashboard?.ads.connected)} meliConnected={Boolean(productAdsState.data?.connected)} period={displayPeriod} onNavigate={selectSection}/>:advertisingTab==='mercadolibre'?<ProductAds state={productAdsState} canManage={canManage} money={money}/>:<AdvertisingSection connected={Boolean(meta)} data={adsData} dashboard={dashboard} period={displayPeriod} syncing={syncingMeta} message={metaMessage} onSync={()=>void runMetaSync()} onConnect={()=>selectSection('integraciones')} onAccountChange={accountId=>void changeMetaAccount(accountId)}/>}</>
      :active==='costos'?<ProductCosts rows={costRows} draft={costDraft} onDraft={updates=>setCostDraft(current=>({...current,...updates}))} onSave={()=>void saveProductCosts()} saving={savingCosts} message={costState} onMessage={setCostState} onChanged={()=>Promise.all([loadProductCosts(),loadProductAnalytics(periodDaysRef.current)])} canManage={canManage} money={money}/>
      :active==='facturacion'?<ExternalRevenueSection onChanged={()=>loadDashboard(periodDaysRef.current)}/>
      :active==='moneda'?<ExchangeRateSection onChanged={()=>loadDashboard(periodDaysRef.current)}/>
      :active==='integraciones'?<section className="p-integrations">
        <div className="p-head"><div><div className="p-eyebrow">CONEXIONES</div><h1>Integraciones</h1><p>Autorizá cada plataforma por separado. Rentia nunca pide ni guarda la contraseña de tus cuentas.</p></div></div>
        {notice&&<div className="p-note">{notice}</div>}
        {syncMessage&&<div className={`p-note ${dashboard?.sync?.status==='error'?'p-warn':''}`}>{syncMessage}</div>}
        {dashboard?.sync?.last_error&&<div className="p-note p-warn">No pudimos completar la última actualización de Tiendanube. El historial guardado se conserva.</div>}
        {dashboard?.sync?.webhook_error&&<div className="p-note">La tienda está conectada, pero la actualización en tiempo real sigue pendiente. Podés usar “Actualizar ahora” mientras Rentia vuelve a intentarlo automáticamente.</div>}
        {Boolean(dashboard?.sync?.reliability?.events.failed)&&<div className="p-note p-warn"><b>Recuperación automática en curso.</b> {dashboard?.sync?.reliability?.events.failed} evento{dashboard?.sync?.reliability?.events.failed===1?'':'s'} de Tiendanube no se pudo procesar todavía. Rentia conserva el evento y lo volverá a intentar durante la próxima conciliación.</div>}
        <div className="p-grid" style={{gap:12}}>
          <div className="p-card p-reveal p-integCard"><div className="p-integ"><img className="p-logo32 p-lg" src="/brands/tiendanube-icon.png" alt=""/><div className="p-meta"><b>Tiendanube</b>{tiendanube&&<span className="p-chip p-g">✓ Conectada</span>}<p>Órdenes, productos, costos por SKU, envíos y comisiones reales de cada transacción.</p><small>{tiendanube?`${automaticSyncLabel(dashboard?.sync||null)} · cargos de Pago Nube automáticos`:'OAuth 2 · conexión segura'}</small>{tiendanube&&<ConnectionUpdatedAt value={dashboard?.sync?.last_completed_at}/>}</div><div className="p-actions">{tiendanube?<button type="button" className={`p-btn ${syncing?'p-spin':''}`} onClick={()=>void runSync()} disabled={syncing}><RefreshCw className="p-i" aria-hidden="true"/>{syncing?'Actualizando…':'Actualizar ahora'}</button>:<a className="p-btn p-primary" href="/api/integrations/tiendanube/start">Conectar</a>}</div></div></div>
          <MercadoLibreIntegration state={mercadoLibreState} canManage={canManage} onBilling={()=>selectSection('cargos-meli')}/>
          <div className="p-card p-reveal p-integCard" style={{'--i':2} as React.CSSProperties}><div className="p-integ"><img className="p-logo32 p-lg" src="/brands/meta.png" alt=""/><div className="p-meta"><b>Meta Ads</b>{meta&&<span className="p-chip p-g">✓ Conectada</span>}<p>Inversión, compras atribuidas, ROAS, CPA y rendimiento por campaña.</p><small>{meta?`${adsData?.selected?.name||'Cuenta conectada'} · ${syncingMeta?'actualizando':'sincronización periódica mientras usás Rentia'}`:'OAuth 2 · permisos de solo lectura'}</small>{meta&&<ConnectionUpdatedAt value={dashboard?.ads?.sync?.last_completed_at||adsData?.sync?.last_completed_at}/>}{meta&&!!adsData?.accounts.length&&<div className="p-metaPick"><span><b style={{color:'var(--text)'}}>Cuenta publicitaria que mide Rentia</b><br/>{adsData.accounts.length>1?`Encontramos ${adsData.accounts.length} cuentas publicitarias. Elegí la que querés medir; podés cambiarla cuando quieras.`:'Es la única cuenta publicitaria de tu usuario de Meta.'}</span><MetaAccountPicker accounts={adsData.accounts} value={adsData.selected?.external_account_id||''} onChange={accountId=>void changeMetaAccount(accountId)} disabled={syncingMeta||!canManage}/>{metaMessage&&<small aria-live="polite">{metaMessage}</small>}</div>}</div><div className="p-actions">{meta?<button type="button" className={`p-btn ${syncingMeta?'p-spin':''}`} onClick={()=>void runMetaSync()} disabled={syncingMeta}><RefreshCw className="p-i" aria-hidden="true"/>{syncingMeta?'Actualizando…':'Actualizar ahora'}</button>:<a className="p-btn p-primary" href="/api/integrations/meta/start">Conectar</a>}</div></div></div>
        </div>
      </section>
      :active==='cargos-meli'?<MeliBilling canManage={canManage} onBack={()=>selectSection('integraciones')}/>
      :active==='plan'?<SubscriptionSection/>
      :active==='configuracion'?<section className="p-delivery">
        <div className="p-head"><div><div className="p-eyebrow">CÁLCULO DE RENTABILIDAD</div><h1>Envíos y <em>comisiones</em></h1><p>Todos tus costos, en un solo lugar. Elegí cómo calcularlos y separá los importados de los personalizados.</p></div></div>
        <ShippingCommissionSettings shipping={shipping} shippingMode={shippingMode} fees={fees} taxes={taxes} pagoNubePlan={pagoNubePlan} detectedPlan={detectedPlan} pagoNubePayoutDays={pagoNubePayoutDays} connected={integrations.some(item=>item.provider==='tiendanube'&&item.status==='connected')} loaded={settingsLoaded} saving={savingSettings} message={settingsState}
          onShipping={value=>{setShipping(value);setSettingsState('')}} onShippingMode={value=>{setShippingMode(value);setSettingsState('')}} onFees={value=>{setFees(value);setSettingsState('')}} onTaxes={value=>{setTaxes(value);setSettingsState('')}} onPlan={value=>{setPagoNubePlan(value);setSettingsState('')}} onPayout={value=>{setPagoNubePayoutDays(value);setSettingsState('')}} onSubmit={saveSettings}/>
        <AdvancedCostRules rules={costRules} paymentMethods={dashboard?.paymentMethods||[]} onChanged={refreshCostConfiguration}/>
      </section>
      :<ComingSoonSection eyebrow="PRÓXIMAMENTE" title="Esta sección está en desarrollo" description="Seguimos construyendo el análisis multicanal de Rentia." action="Volver al resumen" onAction={()=>selectSection('resumen')}/>}
      </fieldset>
      </main>
    </div></div>
    {canManage&&dashboardEditorOpen&&<DashboardEditor layout={dashboardLayout} saving={savingDashboard} message={dashboardPreferenceMessage} onClose={()=>setDashboardEditorOpen(false)} onSave={layout=>void saveDashboardPreferences(layout)} onPreview={setDashboardLayout}/>}
    {paletteOpen&&<><button type="button" className="p-scrim p-open" onClick={()=>setPaletteOpen(false)} aria-label="Cerrar búsqueda"/><div className="p-palette p-open" role="dialog" aria-label="Buscar en Rentia"><label className="p-search"><Search className="p-i" aria-hidden="true"/><input autoFocus value={paletteQuery} onChange={event=>{setPaletteQuery(event.target.value);setPaletteIndex(0);}} onKeyDown={event=>{if(event.key==='ArrowDown'){event.preventDefault();setPaletteIndex(index=>Math.min(paletteItems.length-1,index+1));}if(event.key==='ArrowUp'){event.preventDefault();setPaletteIndex(index=>Math.max(0,index-1));}if(event.key==='Enter'&&paletteItems[paletteIndex]){setPaletteOpen(false);paletteItems[paletteIndex].run();}}} placeholder="Ir a una sección o acción…"/></label><div className="p-palList">{paletteItems.map((item,index)=><button type="button" key={item.label} className={index===paletteIndex?'p-sel':''} onMouseEnter={()=>setPaletteIndex(index)} onClick={()=>{setPaletteOpen(false);item.run();}}>{item.hint==='acción'?<Sparkles className="p-i" aria-hidden="true"/>:<ArrowRight className="p-i" aria-hidden="true"/>}{item.label}<small>{item.hint}</small></button>)}{!paletteItems.length&&<div className="p-empty">Sin resultados</div>}</div></div></>}
  </div></AccessContext.Provider>;
}

