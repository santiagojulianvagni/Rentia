'use client';

import { salesChannelLabel } from '../../../lib/sales-channels';
import { useContext, useEffect, useRef, useState } from 'react';
import { Share2, Trophy, ArrowRight, GripVertical, Plus, SlidersHorizontal, X } from 'lucide-react';
import RpChart from '../../../components/panel/rp-chart';
import HeroChart from './hero-chart';
import type { ProductCostRow } from '../../../components/product-costs';
import type { ShareContent } from '../../../components/panel/share-card';
import { type AlertSettings, type BusinessAlert } from '../../../lib/alerts';
import { type CampaignProfitRow } from '../../../lib/campaign-profit';
import { AlertSettingsCard, ShareDialog, ProductAnalyticsRow, TimelinePoint, Dashboard, DashboardMetricKey, DashboardChannel, DashboardLayoutSection, DashboardLayoutConfig, dashboardMetricKeys, dashboardPresets, AccessContext, useT, useMoney, date, TermHelp, Granularity, timelineGranularity, aggregateTimeline, dashboardMetricLabels, dashboardMetricHelp, Sparkline, RpDelta, dailySeries } from '../shared';

export function DashboardEditor({layout,saving,message,onClose,onSave,onPreview}:{layout:DashboardLayoutConfig;saving:boolean;message:string;onClose:()=>void;onSave:(layout:DashboardLayoutConfig)=>void;onPreview:(layout:DashboardLayoutConfig)=>void}) {
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
  return <><button type="button" className="p-scrim p-open" onClick={close} aria-label="Cerrar"/><div className="p-modal p-wide p-open" role="dialog" aria-modal="true" aria-label="Personalizar dashboard">
    <div className="p-drawerHead"><div><span className="p-eyebrowS">VISTA PERSONALIZADA</span><h3>Personalizá tu dashboard</h3><span className="p-sub">Arrastrá u ordená secciones y métricas. La vista queda guardada para toda tu tienda.</span></div><button type="button" className="p-iconBtn" onClick={close} aria-label="Cerrar"><X className="p-i" aria-hidden="true"/></button></div>
    <div className="p-drawerBody">
      <div className="p-tabs" style={{display:'inline-flex',marginBottom:14}}><button type="button" onClick={()=>applyPreset('profitability')}>Rentabilidad</button><button type="button" onClick={()=>applyPreset('advertising')}>Publicidad</button><button type="button" onClick={()=>applyPreset('operation')}>Operación</button></div>
      {draft.sections.map((section,sectionIndex)=><div className={`p-edSec ${draggedSection===section.id?'p-dragging':''}`} key={section.id} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();if(draggedSection)moveSectionTo(section.id);else if(draggedMetric)moveMetric(draggedMetric,section.id);setDraggedMetric(null);setDraggedSection(null);}}>
        <div className="p-edHead"><span draggable onDragStart={event=>{event.stopPropagation();setDraggedSection(section.id);setDraggedMetric(null);}} onDragEnd={()=>setDraggedSection(null)} title="Arrastrar sección" style={{cursor:'grab',display:'grid'}}><GripVertical className="p-i" aria-hidden="true"/></span><input value={section.title} maxLength={45} aria-label="Nombre de la sección" onChange={event=>updateSection(section.id,current=>({...current,title:event.target.value}))}/><div><button type="button" onClick={()=>moveSection(sectionIndex,-1)} disabled={sectionIndex===0} aria-label="Subir sección">↑</button><button type="button" onClick={()=>moveSection(sectionIndex,1)} disabled={sectionIndex===draft.sections.length-1} aria-label="Bajar sección">↓</button><button type="button" onClick={()=>removeSection(section.id)} disabled={draft.sections.length===1} aria-label="Eliminar sección"><X aria-hidden="true"/></button></div></div>
        {section.metrics.map((metric,index)=><div className="p-edRow" key={metric} draggable onDragStart={()=>{setDraggedMetric(metric);setDraggedSection(null);}} onDragEnd={()=>setDraggedMetric(null)} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.stopPropagation();if(draggedMetric)moveMetric(draggedMetric,section.id,index);setDraggedMetric(null);}}><GripVertical className="p-i" aria-hidden="true"/><span><b>{dashboardMetricLabels[metric]}</b><small>{metric.includes('meta')||metric==='roas'?'Dato publicitario de Meta':metric.startsWith('ml')?'Se completa al conectar Mercado Libre':metric.startsWith('tn')?'Dato exclusivo de Tiendanube':metric==='profit'?'Resultado luego de todos los costos conocidos':'Dato calculado para el período seleccionado'}</small></span><div><button type="button" onClick={()=>moveWithin(section.id,index,-1)} disabled={index===0} aria-label="Mover arriba">↑</button><button type="button" onClick={()=>moveWithin(section.id,index,1)} disabled={index===section.metrics.length-1} aria-label="Mover abajo">↓</button><button type="button" onClick={()=>moveMetric(metric,draft.sections[Math.max(0,sectionIndex-1)].id)} disabled={sectionIndex===0} aria-label="Mover a la sección anterior">←</button><button type="button" onClick={()=>moveMetric(metric,draft.sections[Math.min(draft.sections.length-1,sectionIndex+1)].id)} disabled={sectionIndex===draft.sections.length-1} aria-label="Mover a la sección siguiente">→</button><button type="button" onClick={()=>updateSection(section.id,current=>({...current,metrics:current.metrics.filter(value=>value!==metric)}))} aria-label="Ocultar métrica"><X aria-hidden="true"/></button></div></div>)}
        {!section.metrics.length&&<div className="p-empty" style={{padding:14}}>Arrastrá o agregá métricas a esta sección.</div>}
        <button type="button" className="p-btn p-small p-ghost" onClick={()=>setPickerSection(pickerSection===section.id?null:section.id)}><Plus className="p-i" aria-hidden="true"/>Agregar métrica</button>
        {pickerSection===section.id&&<div className="p-picker">{available.length?available.map(metric=><button type="button" key={metric} onClick={()=>{updateSection(section.id,current=>({...current,metrics:[...current.metrics,metric]}));setPickerSection(null);}}><Plus className="p-i" aria-hidden="true"/>{dashboardMetricLabels[metric]}</button>):<span className="p-sub">Ya estás mostrando todas las métricas.</span>}</div>}
      </div>)}
      <button type="button" className="p-btn" onClick={addSection} disabled={draft.sections.length>=8}><Plus className="p-i" aria-hidden="true"/>Crear sección</button>
    </div>
    <div className="p-drawerFoot"><span className="p-sub" style={{marginRight:'auto'}}>{message||`${used.size} métricas · ${draft.sections.length} secciones`}</span><button type="button" className="p-btn p-ghost" onClick={close}>Cancelar</button><button type="button" className="p-btn p-primary" onClick={()=>onSave(draft)} disabled={saving||!used.size||draft.sections.some(section=>!section.title.trim())}>{saving?'Guardando…':'Guardar dashboard'}</button></div>
  </div></>;
}

export function DashboardOverview({dashboard,previousDashboard,days,storeName,periodLabel,layout,savingLayout,onNavigate,onEdit,onLayoutReorder,onPeriodChange}:{dashboard:Dashboard|null;previousDashboard:Dashboard|null;syncing:boolean;days:number;storeName:string;periodLabel:string;layout:DashboardLayoutConfig;savingLayout:boolean;onNavigate:(section:string)=>void;onEdit:()=>void;onLayoutReorder:(layout:DashboardLayoutConfig)=>void;onChartChange:(chart:DashboardLayoutConfig['chart'])=>void;onPeriodChange?:(days:number)=>void}) {
  const canManage=useContext(AccessContext);
  const money=useMoney();
  const t=useT();
  const [arranging,setArranging]=useState(false);
  // Saludo según la hora del navegador (zona horaria de quien mira).
  const [greeting,setGreeting]=useState({text:'Hola',date:''});
  useEffect(()=>{queueMicrotask(()=>{const now=new Date(),hour=now.getHours();setGreeting({text:hour>=5&&hour<12?'Buen día':hour>=12&&hour<20?'Buenas tardes':'Buenas noches',date:new Intl.DateTimeFormat('es-AR',{weekday:'long',day:'numeric',month:'long'}).format(now)});});},[]);
  const [draggedCard,setDraggedCard]=useState<{metric:DashboardMetricKey;sectionId:string;index:number}|null>(null);
  const [dropTarget,setDropTarget]=useState<{sectionId:string;index:number}|null>(null);
  const [chartChannel]=useState('combined');
  const metrics=dashboard?.metrics;
  const [share,setShare]=useState<ShareContent|null>(null);
  // Comparte los números del período elegido; sin montos salvo que la persona los active.
  const shareStats=()=>{
    if(!metrics)return;
    const prev=previousDashboard?.metrics;
    const growth=(current:number,previous?:number)=>previous?`${current>=previous?'+':''}${Math.round((current-previous)/Math.abs(previous)*100)}%`:'—';
    const margin=`${metrics.margin.toFixed(1).replace('.',',')}%`;
    setShare({eyebrow:'Mis números',title:'Así le fue a mi tienda',period:periodLabel,series:dailySeries(dashboard?.timeline||[]),stats:[
      {label:'Facturación',value:money(metrics.totalRevenue),privateValue:growth(metrics.totalRevenue,prev?.totalRevenue)},
      {label:'Ganancia',value:money(metrics.profit),privateValue:growth(metrics.profit,prev?.profit)},
      {label:'Margen real',value:margin,privateValue:margin},
      {label:'Órdenes',value:metrics.totalOrders.toLocaleString('es-AR'),privateValue:prev?.totalOrders?growth(metrics.totalOrders,prev.totalOrders):metrics.totalOrders.toLocaleString('es-AR')},
    ]});
  };
  const previous=previousDashboard?.metrics;
  const allPoints=dashboard?.timeline||[];
  const selectedChannel=dashboard?.channels.find(row=>row.provider===chartChannel);
  const points=chartChannel==='combined'||layout.chart.metric==='adSpend'?allPoints:dashboard?.channelTimelines?.[chartChannel]||[];
  const channelFor=(source:Dashboard|null,provider:string)=>source?.channels.find(channel=>channel.provider===provider)||null;
  const tiendanube=channelFor(dashboard,'tiendanube');
  const previousTiendanube=channelFor(previousDashboard,'tiendanube');
  const mercadoLibre=channelFor(dashboard,'mercadolibre');
  const previousMercadoLibre=channelFor(previousDashboard,'mercadolibre');
  const axisMoney=(value:number)=>{const text=money(value);const digits=Number(text.replace(/[^\d,-]/g,'').replace(',','.'));return Math.abs(value)>=1e6?text.replace(/[\d.,]+/,(Math.abs(digits)/1e6).toLocaleString('es-AR',{maximumFractionDigits:1})+' M'):Math.abs(value)>=1e4?text.replace(/[\d.,]+/,Math.round(Math.abs(digits)/1e3)+'k'):text;};
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
    target.metrics.splice(Math.max(0,Math.min(targetIndex,target.metrics.length)),0,draggedCard.metric);
    onLayoutReorder({...layout,sections});
  };
  const logoFor=(channel:DashboardChannel)=>String(channel).startsWith('local:')?'/brands/local.svg':channel==='combined'?'/favicon.svg':channel==='tiendanube'?'/brands/tiendanube-icon.png':channel==='mercadolibre'?'/brands/mercado-libre-icon.png':channel==='meta'?'/brands/meta.png':'';
  function sparkSeries(key:DashboardMetricKey) {
    const source=key.startsWith('tn')?dashboard?.channelTimelines?.tiendanube||[]:key.startsWith('ml')?dashboard?.channelTimelines?.mercadolibre||[]:/meta|roas|cpa/i.test(key)?(dashboard?.metaTimeline?.length?dashboard.metaTimeline:allPoints):allPoints;
    const pick=(point:TimelinePoint)=>/orders/i.test(key)?point.orders:/profit|margin/i.test(key)?point.profit:/meta|adSpend|roas|cpa/i.test(key)?point.adSpend:point.storeRevenue+(key==='totalRevenue'?point.externalRevenue:0);
    return source.map(pick);
  }
  function metricCard(key:DashboardMetricKey,sectionId:string,index:number,channel:DashboardChannel,order:number) {
    let value:React.ReactNode='—';let current=0;let previousValue:number|undefined;let mode:'relative'|'points'='relative';let neutral=false;let pending='';let section='informes';let valueClass='';
    if(metrics) {
      if(key==='orders'){current=metrics.totalOrders;previousValue=previous?.totalOrders;value=metrics.totalOrders.toLocaleString('es-AR');section='ordenes';}
      if(key==='totalRevenue'){current=metrics.totalRevenue;previousValue=previous?.totalRevenue;value=money(metrics.totalRevenue);}
      if(key==='netRevenue'){current=metrics.netRevenue;previousValue=previous?.netRevenue;value=money(metrics.netRevenue);}
      if(key==='profit'){current=metrics.profit;previousValue=previous?.profit;value=money(metrics.profit);valueClass=metrics.profit<0?'p-neg':'p-pos';}
      if(key==='margin'){current=metrics.margin;previousValue=previous?.margin;value=`${metrics.margin.toFixed(1).replace('.',',')}%`;mode='points';}
      if(key==='aov'){current=metrics.totalAov;previousValue=previous?.totalAov;value=money(metrics.totalAov);}
      if(key==='adSpend'){section='publicidad';neutral=true;if(dashboard?.ads.connected||dashboard?.meliAds?.selected?.last_completed_at){current=metrics.totalAdSpend??metrics.adSpend;previousValue=previous?.totalAdSpend??previous?.adSpend;value=money(current);}else pending='Publicidad pendiente de consulta';}
      if(key==='roas'){section='publicidad';if(dashboard?.ads.connected){current=metrics.blendedRoas;previousValue=previous?.blendedRoas;value=`${metrics.blendedRoas.toFixed(2).replace('.',',')}x / ${metrics.reportedRoas.toFixed(2).replace('.',',')}x`;}else pending=t('Sin datos inventados');}
      if(key==='cpa'){section='publicidad';neutral=true;if(dashboard?.ads.connected){current=metrics.cpa;previousValue=previous?.cpa;value=money(metrics.cpa,metrics.metaCurrency);}else pending=t('Disponible al conectar Meta');}
      if(key==='productCost'){current=metrics.productCost;previousValue=previous?.productCost;value=money(metrics.productCost);neutral=true;section='costos';}
      if(key==='shipping'){current=metrics.shipping;previousValue=previous?.shipping;value=money(metrics.shipping);neutral=true;section='configuracion';}
      if(key==='commissions'){current=metrics.commissions;previousValue=previous?.commissions;value=money(metrics.commissions);neutral=true;section='configuracion';}
      if(key==='externalRevenue'){current=metrics.externalRevenue;previousValue=previous?.externalRevenue;value=money(metrics.externalRevenue);section='facturacion';}
      if(key==='tnOrders'){section='ordenes';if(tiendanube){current=tiendanube.orders;previousValue=previousTiendanube?.orders;value=tiendanube.orders.toLocaleString('es-AR');}else pending='Disponible al conectar Tiendanube';}
      if(key==='tnRevenue'){if(tiendanube){current=tiendanube.revenue;previousValue=previousTiendanube?.revenue;value=money(tiendanube.revenue);}else pending='Disponible al conectar Tiendanube';}
      if(key==='tnNetRevenue'){if(tiendanube){current=tiendanube.netRevenue;previousValue=previousTiendanube?.netRevenue;value=money(tiendanube.netRevenue);}else pending='Disponible al conectar Tiendanube';}
      if(key==='tnProfit'){if(tiendanube?.profit!==null&&tiendanube?.profit!==undefined){current=tiendanube.profit;previousValue=previousTiendanube?.profit??undefined;value=money(tiendanube.profit);valueClass=tiendanube.profit<0?'p-neg':'p-pos';}else pending=tiendanube?'Rentabilidad pendiente':'Disponible al conectar Tiendanube';}
      if(key==='tnAov'){if(tiendanube){current=tiendanube.aov;previousValue=previousTiendanube?.aov;value=money(tiendanube.aov);}else pending='Disponible al conectar Tiendanube';}
      if(key==='metaSpend'){section='publicidad';neutral=true;if(dashboard?.ads.connected){current=metrics.adSpend;previousValue=previous?.adSpend;value=money(metrics.adSpend,metrics.metaCurrency);}else pending='Disponible al conectar Meta';}
      if(key==='metaRevenue'){section='publicidad';if(dashboard?.ads.connected){current=metrics.metaReportedRevenue;previousValue=previous?.metaReportedRevenue;value=money(metrics.metaReportedRevenue,metrics.metaCurrency);}else pending='Disponible al conectar Meta';}
      if(key==='metaRoas'){section='publicidad';if(dashboard?.ads.connected){current=metrics.reportedRoas;previousValue=previous?.reportedRoas;value=`${metrics.reportedRoas.toFixed(2).replace('.',',')}x`;}else pending='Disponible al conectar Meta';}
      if(key==='metaCpa'){section='publicidad';neutral=true;if(dashboard?.ads.connected){current=metrics.cpa;previousValue=previous?.cpa;value=money(metrics.cpa,metrics.metaCurrency);}else pending='Disponible al conectar Meta';}
      if(key==='mlOrders'){section='ordenes';if(mercadoLibre){current=mercadoLibre.orders;previousValue=previousMercadoLibre?.orders;value=mercadoLibre.orders.toLocaleString('es-AR');}else pending='Disponible al conectar Mercado Libre';}
      if(key==='mlRevenue'){if(mercadoLibre){current=mercadoLibre.revenue;previousValue=previousMercadoLibre?.revenue;value=money(mercadoLibre.revenue);}else pending='Disponible al conectar Mercado Libre';}
      if(key==='mlNetRevenue'){if(mercadoLibre){current=mercadoLibre.netRevenue;previousValue=previousMercadoLibre?.netRevenue;value=money(mercadoLibre.netRevenue);}else pending='Disponible al conectar Mercado Libre';}
      if(key==='mlProfit'){if(mercadoLibre?.profit!==null&&mercadoLibre?.profit!==undefined){current=mercadoLibre.profit;previousValue=previousMercadoLibre?.profit??undefined;value=money(mercadoLibre.profit);valueClass=mercadoLibre.profit<0?'p-neg':'p-pos';}else pending=mercadoLibre?'Rentabilidad pendiente':'Disponible al conectar Mercado Libre';}
      if(key==='mlAov'){if(mercadoLibre){current=mercadoLibre.aov;previousValue=previousMercadoLibre?.aov;value=money(mercadoLibre.aov);}else pending='Disponible al conectar Mercado Libre';}
    }
    const knownChannel=key==='mlProfit'?mercadoLibre:key==='tnProfit'?tiendanube:null;
    const partial=!!knownChannel&&!knownChannel.costCoverage;
    const target=partial||pending==='Rentabilidad pendiente'?'calidad':pending&&(key.startsWith('ml')||key.startsWith('tn'))?'integraciones':section;
    const label=t(partial?`Ganancia conocida ${knownChannel?.label}`:key==='profit'&&dashboard?.quality&&dashboard.quality.completeOrders<dashboard.quality.totalOrders?'Ganancia provisoria':dashboardMetricLabels[key]);
    const sparkColor=channel==='meta'?'#ff6fae':channel==='mercadolibre'?'#ffd23f':channel==='tiendanube'?'#4f8cff':/profit|margin/i.test(key)?'#21d4c2':'#4f8cff';
    const isTarget=dropTarget?.sectionId===sectionId&&dropTarget.index===index;
    return <button type="button" key={key} className={`p-card p-kpi p-metric p-reveal ${key==='profit'?'p-hero':''} ${pending?'p-pendingMetric':''} ${draggedCard?.metric===key?'p-dragging':''} ${isTarget?'p-dropT':''}`} style={{'--i':order} as React.CSSProperties} draggable={arranging}
      onDragStart={event=>{if(!arranging)return;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',key);setDraggedCard({metric:key,sectionId,index});setDropTarget({sectionId,index});}}
      onDragOver={event=>{if(!arranging||!draggedCard)return;event.preventDefault();event.stopPropagation();setDropTarget({sectionId,index});}}
      onDrop={event=>{if(!arranging)return;event.preventDefault();event.stopPropagation();moveDashboardCard(sectionId,index);setDraggedCard(null);setDropTarget(null);}}
      onDragEnd={()=>{setDraggedCard(null);setDropTarget(null);}}
      onClick={()=>{if(!arranging)onNavigate(target);}}>
      {arranging&&<span className="p-grip"><GripVertical className="p-i" aria-hidden="true"/></span>}
      <small>{channel!=='custom'&&logoFor(channel)&&<img className="p-mini" src={logoFor(channel)} alt=""/>}<span className="p-kpiLabel" title={label}>{channel==='tiendanube'||channel==='mercadolibre'?label.replace(/ (Tiendanube|Mercado Libre)$/,''):label}</span>{dashboardMetricHelp[key]&&<TermHelp term={dashboardMetricHelp[key]}/>}</small>
      <b className={`p-mono ${valueClass}`}>{value}</b>
      {partial&&knownChannel?<span className="p-sub p-partial">{knownChannel.completeOrders} de {knownChannel.orders} órdenes · {knownChannel.pendingOrders} por revisar · {key==='mlProfit'?'Product Ads según cobertura':'antes de Meta Ads'}</span>:metrics&&!pending?<RpDelta current={current} previous={previousValue} mode={mode} neutral={neutral}/>:<span className="p-sub p-partial">{pending||t('Cargando')}</span>}
      {!pending&&key!=='roas'&&<Sparkline values={sparkSeries(key)} color={sparkColor}/>}
      <i className="p-more">{arranging?'Arrastrar':pending?'Configurar →':'Ver detalle →'}</i>
    </button>;
  }
  const sectionDetail=(section:DashboardLayoutSection)=>{const channel=section.channel||'custom';if(channel==='combined')return 'Ventas de canales conectados + publicidad';if(channel==='tiendanube')return tiendanube?'Datos exclusivos del canal · ganancia antes de Ads':'Canal pendiente de conexión';if(channel==='meta')return dashboard?.ads.connected?'Datos publicitarios reales':'Cuenta pendiente de conexión';if(channel==='mercadolibre')return mercadoLibre?(mercadoLibre.adSpend===undefined?'Datos del canal · Product Ads sin consultar':`Ganancia después de Product Ads conocidos · ${mercadoLibre.adsCoverage?'período cubierto':'cobertura parcial'}`):'Canal pendiente de conexión';return 'Vista personalizada';};
  // Vista del gráfico: automática según el período, o la que elija la persona (día, semana o mes).
  const [granularityChoice]=useState<Granularity|null>(null);
  const granularity=granularityChoice||timelineGranularity(days);
  const buckets=aggregateTimeline(points,days,granularity).map(point=>({...point,revenue:point.storeRevenue+point.externalRevenue}));
  const metaBuckets=aggregateTimeline(dashboard?.metaTimeline||[],days);
  const revenue=metrics?.revenue||0;
  const stack:Array<{label:React.ReactNode;value:number;text:React.ReactNode;color?:string}>=metrics?[
    {label:t('Productos'),value:metrics.productCost,text:`− ${money(metrics.productCost)}`},
    {label:t('Envíos'),value:metrics.shipping,text:`− ${money(metrics.shipping)}`},
    {label:<>{t('Comisiones')} <TermHelp term="Comisiones"/></>,value:metrics.commissions,text:`− ${money(metrics.commissions)}`},
    {label:t('Impuestos'),value:metrics.taxes,text:`− ${money(metrics.taxes)}`},
    {label:t('Costos adicionales'),value:metrics.additional,text:`− ${money(metrics.additional)}`},
    {label:'Gastos fijos',value:metrics.fixedCosts||0,text:`− ${money(metrics.fixedCosts||0)}`},
    {label:'Meta Ads',value:dashboard?.ads.connected&&metrics.adSpendComparable?metrics.adSpend:0,text:dashboard?.ads.connected&&metrics.adSpendComparable?`− ${money(metrics.adSpend)}`:dashboard?.ads.connected?'Moneda diferente':'—',color:'#ff6fae'},
    {label:'Product Ads',value:metrics.meliAdsComparable?metrics.meliAdSpend||0:0,text:metrics.meliAdsComparable?`− ${money(metrics.meliAdSpend||0)}`:'Pendiente de consulta',color:'#f5c451'},
    {label:'Pérdidas por reembolsos confirmadas',value:metrics.refundLoss||0,text:`− ${money(metrics.refundLoss||0)}`},
  ]:[];
  let used=0;
  let cardOrder=0;
  return <>
    <div className="p-head"><div><div className="p-eyebrow">{greeting.date||t('MÉTRICAS PRINCIPALES')}</div><h1>{greeting.text}, <em>{storeName}</em></h1><p>{metrics?<>{periodLabel}: <b>{metrics.totalOrders} órdenes</b> y <b className="p-pos">{money(metrics.profit)}</b> de ganancia real. </>:null}{t('La ganancia es provisoria cuando faltan costos. Las ventas de otros canales sin costo cargado se muestran aparte.')}</p></div><div className="p-actions"><button type="button" className="p-btn" onClick={shareStats} disabled={!metrics}><Share2 className="p-i" aria-hidden="true"/>Compartir</button>{canManage&&<><button type="button" className={`p-btn ${arranging?'p-primary':''}`} onClick={()=>setArranging(value=>!value)}><SlidersHorizontal className="p-i" aria-hidden="true"/>{arranging?'Finalizar':'Personalizar'}</button><button type="button" className="p-btn" onClick={()=>onNavigate('facturacion')}><Plus className="p-i" aria-hidden="true"/>{t('Ventas de otros canales')}</button></>}</div></div>
     {share&&<ShareDialog content={share} storeName={storeName} onClose={()=>setShare(null)}/>}
    {arranging&&<div className="p-arrangeBar p-reveal"><span><GripVertical className="p-i" aria-hidden="true"/><b>Ordená las tarjetas</b><small>Arrastrá una caja a la posición o sección que quieras.</small></span><span><em>{savingLayout?'Guardando…':'Los cambios se guardan automáticamente'}</em><button type="button" className="p-btn p-small" onClick={onEdit}>Editar secciones y métricas</button></span></div>}
    <div className="p-grid p-g3" style={{margin:'0 0 16px'}}>
      <HeroChart dashboard={dashboard} previousDashboard={previousDashboard} days={days} periodLabel={periodLabel} onPeriodChange={onPeriodChange}/>
      <TodayLive dashboard={dashboard} onNavigate={onNavigate}/>
    </div>
    {layout.sections.map(section=>{const channel=section.channel||'custom';const logo=logoFor(channel);return <section className={`p-mSection ch-${channel} ${dropTarget?.sectionId===section.id&&dropTarget.index===section.metrics.length?'p-dropSection':''}`} key={section.id}
      onDragOver={event=>{if(!arranging||!draggedCard)return;event.preventDefault();setDropTarget({sectionId:section.id,index:section.metrics.length});}}
      onDrop={event=>{if(!arranging)return;event.preventDefault();moveDashboardCard(section.id,section.metrics.length);setDraggedCard(null);setDropTarget(null);}}>
      <div className="p-mHead"><div><span className="p-chIcon">{logo?<img src={logo} alt=""/>:'◇'}</span><span><h3>{section.title}</h3><small>{sectionDetail(section)}</small></span></div><span className="p-sub">{section.metrics.length} métricas</span></div>
      <div className={`p-grid p-g4 p-mGrid p-n${Math.min(section.metrics.length,9)}`}>{section.metrics.map((metricKey,index)=>metricCard(metricKey,section.id,index,channel,cardOrder++))}{!section.metrics.length&&<div className="p-empty" style={{gridColumn:'1/-1'}}>Arrastrá o agregá métricas a esta sección.</div>}</div>
    </section>;})}
    <div className="p-grid p-g2" style={{marginBottom:16}}>
      <div className="p-card p-reveal" style={{'--i':1} as React.CSSProperties}>
        <span className="p-eyebrowS">{t('CUENTA REAL')}</span><h3 style={{margin:'4px 0 14px'}}>{t('Desglose de rentabilidad')}</h3>
        <div className="p-fall">
          <div className="p-fallRow"><span>{t('Facturación tienda')}</span><div className="p-track"><i style={{'--i':0,left:0,width:revenue?'100%':0,background:'#3b8cff'} as React.CSSProperties}/></div><span className="p-v p-mono">{metrics?money(metrics.revenue):'—'}</span></div>
          {stack.map((row,index)=>{const width=revenue?Math.min(100,Math.max(0,row.value/revenue*100)):0;const left=Math.max(0,100-used-width);used+=width;return <div className="p-fallRow" key={index}><span>{row.label}</span><div className="p-track"><i style={{'--i':index+1,left:`${left}%`,width:`${width}%`,background:row.color||'#ff6678'} as React.CSSProperties}/></div><span className="p-v p-mono">{row.text}</span></div>;})}
          <div className="p-fallRow p-total"><b>Ganancia después de Ads conocidos</b><div className="p-track"><i style={{'--i':10,left:0,width:revenue&&metrics?`${Math.min(100,Math.max(0,metrics.profit/revenue*100))}%`:0,background:'linear-gradient(90deg,#21d4c2,#32d583)'} as React.CSSProperties}/></div><b className={`p-v p-mono ${metrics&&metrics.profit<0?'p-neg':'p-pos'}`}>{metrics?money(metrics.profit):'—'}</b></div>
        </div>
        <button type="button" className="p-btn p-small" style={{marginTop:14,width:'100%'}} onClick={()=>onNavigate(dashboard?.ads.connected?'publicidad':'configuracion')}>{t(dashboard?.ads.connected?'Analizar publicidad':'Configurar costos')}</button>
      </div>
      <div className="p-stackCol">
      <div className="p-card p-reveal"><div className="p-cardHead"><div><span className="p-eyebrowS">{t('VOLUMEN DE VENTAS')}</span><h3>{t('Órdenes')}</h3></div><b className="p-mono p-big">{chartChannel==='combined'?(metrics?.totalOrders??'—'):(selectedChannel?.orders??0)}</b></div><p className="p-sub" style={{margin:'-8px 0 8px'}}>{metrics?`${money(chartChannel==='combined'?metrics.totalAov:selectedChannel?.aov||0)} ${t('de ticket promedio')}`:'Cargando datos'}</p>{buckets.length?<RpChart data={buckets} valueKey="orders" type="bar" color="#a78bfa" height={180} format={value=>Math.round(value).toLocaleString('es-AR')} name="Órdenes"/>:<div className="p-empty">{t('Todavía no hay ventas en este período.')}</div>}</div>
      <div className="p-card p-reveal" style={{'--i':1} as React.CSSProperties}><div className="p-cardHead"><div><span className="p-eyebrowS">META ADS</span><h3>{t('Inversión publicitaria')}</h3></div><b className="p-mono p-big">{dashboard?.ads.connected?money(metrics?.adSpend||0,metrics?.metaCurrency||'ARS'):'—'}</b></div><p className="p-sub" style={{margin:'-8px 0 8px'}}>{dashboard?.ads.connected&&metrics?`${metrics.reportedRoas.toFixed(2).replace('.',',')}x ROAS reportado · ${metrics.blendedRoas.toFixed(2).replace('.',',')}x global`:t('Conectá Meta para completar este análisis')}</p>{dashboard?.ads.connected&&metaBuckets.length?<RpChart data={metaBuckets} valueKey="adSpend" color="#ff6fae" height={180} format={value=>money(value,metrics?.metaCurrency||'ARS')} axisFormat={axisMoney} name="Inversión"/>:<div className="p-empty">{t('La inversión aparecerá al sincronizar Meta Ads.')}</div>}</div>
      </div>
    </div>
    <div className="p-card p-reveal" style={{marginBottom:16}}><div className="p-cardHead"><div><span className="p-eyebrowS">{t('CANALES DE VENTA')}</span><h3>{t('Rendimiento por origen')}</h3></div><button type="button" className="p-btn p-small" onClick={()=>onNavigate('integraciones')}>{t('Administrar conexiones')} <ArrowRight className="p-i" aria-hidden="true"/></button></div>
      <div className="p-tableWrap"><table><thead><tr><th>{t('Canal')}</th><th className="p-r">{t('Órdenes')}</th><th className="p-r">{t('Facturación')}</th><th className="p-r">{t('Facturación neta')}</th><th className="p-r">{t('Ganancia')}</th><th className="p-r">{t('Ticket promedio')}</th></tr></thead><tbody>{(dashboard?.channels||[]).filter(channel=>channel.provider!=='external'||channel.orders>0).map(channel=><tr key={channel.provider}><td><span className="p-chan">{logoFor(channel.provider as DashboardChannel)&&<img src={logoFor(channel.provider as DashboardChannel)} alt=""/>}<span><b>{channel.label}</b><br/><small className="p-sub">{t(channel.provider==='external'?'Cargadas a mano · sin costos detallados':channel.costCoverage?'Costos aplicados · antes de Ads':`${channel.completeOrders}/${channel.orders} completas · ganancia conocida antes de Ads`)}</small></span></span></td><td className="p-r p-mono">{channel.orders.toLocaleString('es-AR')}</td><td className="p-r p-mono">{money(channel.revenue)}</td><td className="p-r p-mono">{money(channel.netRevenue)}</td><td className={`p-r p-mono ${channel.profit===null?'':channel.profit<0?'p-neg':'p-pos'}`}>{channel.profit===null?'—':money(channel.profit)}</td><td className="p-r p-mono">{money(channel.aov)}</td></tr>)}{!dashboard?.channels.length&&<tr><td colSpan={6} className="p-empty">{t('Todavía no hay canales con ventas.')}</td></tr>}</tbody></table></div>
    </div>
    <div className="p-card p-reveal"><div className="p-cardHead"><div><span className="p-eyebrowS">{t('ACTIVIDAD RECIENTE')}</span><h3>{t('Últimas ventas')}</h3></div><button type="button" className="p-btn p-small" onClick={()=>onNavigate('ordenes')}>{t('Ver todas')} <ArrowRight className="p-i" aria-hidden="true"/></button></div>
      {dashboard?.orders.length?<div className="p-recent">{dashboard.orders.slice(0,6).map(order=><button type="button" key={`${order.provider}-${order.external_order_id}`} onClick={()=>onNavigate('ordenes')}><span><b>#{order.order_number||order.external_order_id}</b><small>{salesChannelLabel(order.provider)}</small></span><b className="p-mono">{money(order.total,order.currency)}</b><small>{date(order.source_created_at)}</small></button>)}</div>:<div className="p-empty">{t('Todavía no hay órdenes importadas.')}</div>}
    </div>
  </>;
}

// "Hoy · En vivo": lo que entró hoy (hora local), con su ganancia, la curva del día, el reparto
// por canal y las últimas ventas. Se actualiza solo: el panel revisa cambios cada 30 segundos.
const CHANNEL_COLORS:Record<string,string>={tiendanube:'#4f8cff',mercadolibre:'#ffd23f'};
function TodayLive({dashboard,onNavigate}:{dashboard:Dashboard|null;onNavigate:(section:string)=>void}) {
  const money=useMoney();
  const [now,setNow]=useState<Date|null>(null);
  useEffect(()=>{queueMicrotask(()=>setNow(new Date()));const timer=window.setInterval(()=>setNow(new Date()),60000);return ()=>window.clearInterval(timer);},[]);
  const localDay=(value:Date)=>`${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;
  const valid=(dashboard?.orders||[]).filter(order=>!['cancelled','canceled','voided'].includes(String(order.status).toLowerCase())&&!['voided','refunded'].includes(String(order.payment_status).toLowerCase()));
  const today=now?valid.filter(order=>localDay(new Date(order.source_created_at))===localDay(now)):[];
  const revenue=today.reduce((sum,order)=>sum+Number(order.total||0),0);
  const profit=today.reduce((sum,order)=>sum+Number(order.profit||0),0);
  const hours=now?now.getHours()+1:24;
  const perHour=Array.from({length:hours},(_,hour)=>today.filter(order=>new Date(order.source_created_at).getHours()===hour).reduce((sum,order)=>sum+Number(order.total||0),0));
  let running=0;const cumulative=perHour.map(value=>(running+=value));
  const top=Math.max(1,...cumulative);
  const spark=cumulative.length>1?cumulative.map((value,index)=>`${index?'L':'M'}${(index/(cumulative.length-1)*96).toFixed(1)} ${(34-value/top*30).toFixed(1)}`).join(' '):'M0 34 L96 34';
  const byChannel=new Map<string,number>();
  for(const order of today)byChannel.set(order.provider,(byChannel.get(order.provider)||0)+Number(order.total||0));
  const mix=[...byChannel.entries()].sort((a,b)=>b[1]-a[1]).map(([provider,value])=>({provider,label:salesChannelLabel(provider),share:revenue?Math.round(value/revenue*100):0,color:CHANNEL_COLORS[provider]||'#8b6cff'}));
  const latest=(today.length?today:valid).slice().sort((a,b)=>b.source_created_at.localeCompare(a.source_created_at)).slice(0,4);
  const ago=(iso:string)=>{if(!now)return '';const minutes=Math.max(0,Math.round((now.getTime()-new Date(iso).getTime())/60000));return minutes<60?`hace ${minutes} min`:minutes<1440?`hace ${Math.round(minutes/60)} h`:new Intl.DateTimeFormat('es-AR',{day:'numeric',month:'short'}).format(new Date(iso));};
  return <div className="p-card p-reveal p-todayLive" style={{'--i':1} as React.CSSProperties}>
    <div className="p-cardHead"><div><h3 style={{margin:0}}>Hoy</h3><span className="p-sub">Se actualiza con cada venta</span></div><span className="p-liveChip tone-healthy" role="status"><span className="p-pulse"/>En vivo</span></div>
    <div className="p-todayTop"><div><b className="p-mono p-todayValue">{money(revenue)}</b><span className="p-sub">facturados · ganancia <b className={profit<0?'p-neg':'p-pos'}>{money(profit)}</b> · {today.length} {today.length===1?'orden':'órdenes'}</span></div>
      <svg width="96" height="38" viewBox="0 0 96 38" aria-hidden="true"><defs><linearGradient id="p-todayGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#21d4c2" stopOpacity=".45"/><stop offset="1" stopColor="#21d4c2" stopOpacity="0"/></linearGradient></defs><path d={`${spark} L96 38 L0 38 Z`} fill="url(#p-todayGrad)"/><path d={spark} fill="none" stroke="#3ee6d4" strokeWidth="2" strokeLinejoin="round"/></svg></div>
    <div className="p-todayMix">{mix.length?mix.map(row=><div key={row.provider} className="p-todayRow"><span>{row.label}</span><span className="p-todayBar"><i style={{width:`${row.share}%`,background:row.color}}/></span><b className="p-mono">{row.share} %</b></div>):<p className="p-sub" style={{margin:0}}>Todavía no hay ventas hoy. Apenas entre una, aparece acá.</p>}</div>
    <div className="p-todaySales"><span className="p-sub">{today.length?'Últimas ventas':'Últimas ventas del período'}</span>
      {latest.map(order=><button type="button" key={`${order.provider}-${order.external_order_id}`} className="p-todaySale" onClick={()=>onNavigate('ordenes')}><i style={{background:CHANNEL_COLORS[order.provider]||'#8b6cff'}}/><span><b>#{order.order_number||order.external_order_id}</b><small>{order.items?.[0]?.name?`${order.items[0].name}${order.items.length>1?` +${order.items.length-1}`:''} · `:''}{salesChannelLabel(order.provider)} · {ago(order.source_created_at)}</small></span><span className="p-r"><b className="p-mono">{money(order.total)}</b><small className={`p-mono ${order.profit<0?'p-neg':'p-pos'}`}>{order.profit<0?'−':'+'} {money(Math.abs(order.profit))}</small></span></button>)}
    </div>
  </div>;
}

export function DecisionCenter({dashboard,products,costs,alerts,campaigns,alertSettings,canManage,onAlertSettings,onNavigate}:{dashboard:Dashboard|null;products:ProductAnalyticsRow[];costs:ProductCostRow[];alerts:BusinessAlert[];campaigns:CampaignProfitRow[];alertSettings:AlertSettings;canManage:boolean;onAlertSettings:(settings:AlertSettings)=>void;onNavigate:(section:string)=>void}) {
  const money=useMoney();
  const metrics=dashboard?.metrics;
  const losingProducts=products.filter(row=>row.units_sold>0&&row.profit<0).sort((a,b)=>a.profit-b.profit);
  const lowStock=products.filter(row=>row.stock!==null&&row.units_sold>0&&(row.days_stock===null||row.days_stock<=14)).sort((a,b)=>(a.days_stock??0)-(b.days_stock??0));
  const contribution=metrics?metrics.revenue-metrics.productCost-metrics.shipping-metrics.commissions-metrics.taxes-metrics.additional:0;
  const breakEvenRoas=metrics&&metrics.revenue>0&&contribution>0?metrics.revenue/contribution:0;
  const topProduct=products.filter(row=>row.units_sold>0&&row.profit>0).sort((a,b)=>b.profit-a.profit)[0];
  const decisions:BusinessAlert[]=alerts.length?alerts:[{id:'ok',kind:'success',icon:'✓',title:'No detectamos urgencias con los datos actuales',detail:'Costos, margen, stock y publicidad están dentro de los umbrales que configuraste.',action:'Ver dashboard',section:'resumen'}];
  const losingCampaigns=campaigns.filter(row=>row.verdict==='pierde');
  const bestCampaign=campaigns.filter(row=>row.verdict==='gana').sort((a,b)=>(b.profit||0)-(a.profit||0))[0];
  const tones={danger:['ALTA PRIORIDAD','r'],warning:['REVISAR','a'],info:['OPORTUNIDAD','b'],success:['TODO EN ORDEN','g']} as const;
  const pending=decisions.filter(item=>item.kind!=='success').length;
  return <>
    <div className="p-head"><div><div className="p-eyebrow">CENTRO DE DECISIONES</div><h1>Qué necesita <em>tu atención hoy</em></h1><p>Rentia cruza ventas, costos, inventario y publicidad para convertir los números en acciones. Todas las conclusiones usan datos reales del período seleccionado.</p></div><div className="p-actions"><div className={`p-scorePill ${pending?'':'p-ok'}`}><b>{pending}</b><span>acciones detectadas</span></div></div></div>
    <div className="p-grid p-g4" style={{marginBottom:16}}>{([['ROAS de equilibrio estimado',breakEvenRoas?`${breakEvenRoas.toFixed(2).replace('.',',')}x`:'—','Facturación / margen antes de publicidad'],['Campañas que pierden',campaigns.length?String(losingCampaigns.length):'—','Ganancia estimada negativa'],['Productos con pérdida',String(losingProducts.length),'Con ventas en el período'],['Alertas de stock',String(lowStock.length),`Hasta ${alertSettings.stockDays} días de inventario`]] as const).map(([label,value,detail],index)=><div className="p-card p-kpi p-reveal" style={{'--i':index} as React.CSSProperties} key={label}><small>{label}</small><b className="p-mono">{value}</b><span className="p-sub" style={{fontSize:11.5}}>{detail}</span></div>)}</div>
    <div className="p-grid p-g2" style={{marginBottom:16}}>{decisions.map((item,index)=>{const [label,tone]=tones[item.kind];return <div className="p-action p-reveal" style={{'--i':index+4} as React.CSSProperties} key={`${item.title}-${index}`}><span className={`p-aic p-tone-${tone}`}>{item.icon}</span><div style={{flex:1}}><span className={`p-chip p-${tone}`} style={{marginBottom:8}}>{label}</span><b>{item.title}</b><p>{item.detail}</p><button type="button" className="p-btn p-small" onClick={()=>onNavigate(item.section)}>{item.action} <ArrowRight className="p-i" aria-hidden="true"/></button></div></div>;})}</div>
    {(topProduct||bestCampaign)&&<div className="p-card p-reveal" style={{marginBottom:16}}><div className="p-cardHead"><div><span className="p-eyebrowS">LO QUE ESTÁ FUNCIONANDO</span><h3>Ganadores del período</h3></div><Trophy className="p-i" aria-hidden="true"/></div><div className="p-grid p-g2">{topProduct&&<div className="p-win"><small>Producto más rentable</small><b>{topProduct.product_name}</b><span className="p-sub">{money(topProduct.profit)} de ganancia · {topProduct.margin.toFixed(1).replace('.',',')}% de margen</span></div>}{bestCampaign&&<div className="p-win"><small>Campaña que más ganancia deja</small><b>{bestCampaign.name}</b><span className="p-sub">{money(bestCampaign.profit||0)} estimados · ROAS {bestCampaign.roas.toFixed(2).replace('.',',')}x frente a un equilibrio de {(bestCampaign.breakEvenRoas||0).toFixed(2).replace('.',',')}x</span></div>}</div></div>}
    <AlertSettingsCard key={JSON.stringify(alertSettings)} settings={alertSettings} canManage={canManage} onSaved={onAlertSettings}/>
    <div className="p-note p-reveal" style={{marginTop:16}}><b>Sobre las campañas:</b> la ganancia por campaña es una estimación con las ventas que atribuye cada plataforma y tu margen real. La ves en detalle en <button type="button" className="p-linkBtn" onClick={()=>onNavigate('publicidad')}>Publicidad → Ganancia por campaña</button>.</div>
  </>;
}

