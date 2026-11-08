'use client';

import RpClamp from '../../../components/panel/rp-clamp';
import { useState } from 'react';
import { Search, Download } from 'lucide-react';
import { inCategory } from '../../../lib/categories';
import { CategorySummary, ProductAnalyticsRow, useMoney, downloadCsv, TermHelp, InventoryStatus, inventoryStatus, inventoryStatusLabel, EmptyData } from '../shared';

export function ProductAnalyticsSection({rows,period,syncing,onSync}:{rows:ProductAnalyticsRow[];period:string;syncing:boolean;onSync:()=>void}) {
  const money=useMoney();
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState<'todos'|'ganancia'|'perdida'|'sin_ventas'>('todos');
  const [category,setCategory]=useState<string|null>(null);
  const filtered=rows.filter(row=>inCategory(row,category)&&`${row.product_name} ${row.sku||''}`.toLowerCase().includes(query.toLowerCase())&&(filter==='todos'||(filter==='ganancia'&&row.profit>0)||(filter==='perdida'&&row.profit<0)||(filter==='sin_ventas'&&row.units_sold===0)));
  const revenue=rows.reduce((sum,row)=>sum+Number(row.revenue||0),0);
  const profit=rows.reduce((sum,row)=>sum+Number(row.profit||0),0);
  const units=rows.reduce((sum,row)=>sum+Number(row.units_sold||0),0);
  const margin=revenue?profit/revenue*100:0;
  const exportRows=()=>downloadCsv(
    `rentia-productos-${period.replace(' ','-')}.csv`,
    ['Producto','SKU','Unidades','Órdenes','Facturación','Costo producto','Envíos','Comisiones','Estado comisión','Impuestos','Costos adicionales','Costos totales','Ganancia','Margen'],
    filtered.map(row=>[row.product_name,row.sku||'',row.units_sold,row.orders,row.revenue,row.product_cost,row.shipping_cost,row.commission_cost,row.commission_pending?'Pendiente':row.commission_estimated?'Estimada':'Exacta',row.tax_cost,row.additional_cost,row.total_costs,row.profit,row.margin.toFixed(2)]),
  );
  const barColor=(margin:number)=>margin>25?'var(--green)':margin>0?'var(--amber)':'var(--coral)';
  return <>
    <div className="p-head"><div><div className="p-eyebrow">DATOS REALES</div><h1>Rentabilidad <em>por producto</em></h1><p>Resultados reales del período {period}, calculados por variante y SKU.</p></div></div>
    {rows.length?<>
      <div className="p-grid p-g4" style={{marginBottom:16}}>{([['Facturación',money(revenue),''],['Ganancia neta',money(profit),profit<0?'p-neg':'p-pos'],['Margen',`${margin.toFixed(1).replace('.',',')}%`,''],['Unidades vendidas',units.toLocaleString('es-AR'),'']] as const).map(([label,value,tone],index)=><div className="p-card p-kpi p-reveal" style={{'--i':index} as React.CSSProperties} key={label}><small>{label}</small><b className={`p-mono ${tone}`}>{value}</b></div>)}</div>
      <CategorySummary rows={rows} money={value=>money(value)} selected={category} onSelect={setCategory}/>
      <div className="p-toolbar"><label className="p-search"><Search className="p-i" aria-hidden="true"/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar producto o SKU" aria-label="Buscar producto o SKU"/></label><div className="p-tabs">{([['todos','Todos'],['ganancia','Con ganancia'],['perdida','Con pérdida'],['sin_ventas','Sin ventas']] as const).map(([id,label])=><button type="button" key={id} className={filter===id?'p-on':''} onClick={()=>setFilter(id)}>{label}</button>)}</div><button type="button" className="p-btn" style={{marginLeft:'auto'}} onClick={exportRows}><Download className="p-i" aria-hidden="true"/>Exportar CSV</button></div>
      <div className="p-tableWrap p-reveal"><table><thead><tr><th>Producto / SKU <TermHelp term="SKU"/></th><th className="p-r">Unidades</th><th className="p-r">Órdenes</th><th className="p-r">Facturación</th><th className="p-r">Costo unit.</th><th className="p-r">Comisiones <TermHelp term="Comisiones"/></th><th className="p-r">Costos totales</th><th className="p-r">Ganancia</th><th>Margen</th></tr></thead>
        <tbody>{filtered.map(row=><tr key={row.variant_id}>
          <td><RpClamp text={row.product_name}/><br/><small className="p-sub">{row.sku||`Variante ${row.external_variant_id}`}</small></td>
          <td className="p-r p-mono">{row.units_sold.toLocaleString('es-AR')}</td><td className="p-r p-mono">{row.orders.toLocaleString('es-AR')}</td><td className="p-r p-mono">{money(row.revenue,row.currency)}</td>
          <td className="p-r p-mono">{row.effective_cost?money(row.effective_cost,row.currency):<span className="p-chip p-a">Sin costo</span>}</td>
          <td className="p-r p-mono">{row.commission_pending&&row.commission_cost===0?<span className="p-chip p-a">Pendiente</span>:money(row.commission_cost,row.currency)}{row.commission_pending&&row.commission_cost>0?<><br/><small className="p-sub">Parcial</small></>:row.commission_estimated?<><br/><small className="p-sub">Estimada</small></>:null}</td>
          <td className="p-r p-mono">{money(row.total_costs,row.currency)}</td>
          <td className={`p-r p-mono ${row.profit<0?'p-neg':'p-pos'}`}>{money(row.profit,row.currency)}</td>
          <td>{row.units_sold?<div className="p-mbar"><span><i style={{width:`${Math.max(0,Math.min(100,row.margin*2))}%`,background:barColor(row.margin)}}/></span>{row.margin.toFixed(1).replace('.',',')}%</div>:'—'}</td>
        </tr>)}{!filtered.length&&<tr><td colSpan={9} className="p-empty">No hay productos para este filtro.</td></tr>}</tbody>
      </table></div>
    </>:<EmptyData syncing={syncing} onSync={onSync}/>}
  </>;
}

export function InventorySection({rows,period,syncing,onSync}:{rows:ProductAnalyticsRow[];period:string;syncing:boolean;onSync:()=>void}) {
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState<'todos'|'alertas'|'sin_stock'|'sin_movimiento'>('todos');
  const withStatus=rows.map(row=>({...row,inventory_status:inventoryStatus(row)}));
  const filtered=withStatus.filter(row=>`${row.product_name} ${row.sku||''}`.toLowerCase().includes(query.toLowerCase())&&(filter==='todos'||(filter==='alertas'&&['bajo','critico','sin_stock'].includes(row.inventory_status))||(filter==='sin_stock'&&row.inventory_status==='sin_stock')||(filter==='sin_movimiento'&&row.inventory_status==='sin_movimiento')));
  const tracked=withStatus.filter(row=>row.stock!==null);
  const totalStock=tracked.reduce((sum,row)=>sum+Math.max(0,Number(row.stock||0)),0);
  const alerts=withStatus.filter(row=>['bajo','critico','sin_stock'].includes(row.inventory_status)).length;
  const outOfStock=withStatus.filter(row=>row.inventory_status==='sin_stock').length;
  const exportRows=()=>downloadCsv(`rentia-inventario-${period.replace(' ','-')}.csv`,['Producto','SKU','Stock','Ventas período','Venta diaria','Días de stock','Estado'],filtered.map(row=>[row.product_name,row.sku||'',row.stock??'No controla',row.units_sold,row.sales_per_day.toFixed(2),row.days_stock===null?'':row.days_stock.toFixed(1),inventoryStatusLabel(row.inventory_status)]));
  const statusTone=(status:InventoryStatus)=>status==='saludable'?'p-g':status==='bajo'?'p-a':status==='critico'||status==='sin_stock'?'p-r':'p-n';
  const barColor=(status:InventoryStatus)=>status==='saludable'?'var(--green)':status==='bajo'?'var(--amber)':'var(--coral)';
  return <>
    <div className="p-head"><div><div className="p-eyebrow">DATOS REALES</div><h1>Inventario <em>multi-SKU</em></h1><p>Stock actual y velocidad calculada con las ventas del período {period}. Es una estimación: cambia si cambia la demanda.</p></div></div>
    {rows.length?<>
      <div className="p-grid p-g4" style={{marginBottom:16}}>{([['Unidades en stock',totalStock,''],[<>SKU controlados <TermHelp term="SKU"/></>,tracked.length,''],['Alertas de reposición',alerts,alerts?'p-tone-a':''],['Sin stock',outOfStock,outOfStock?'p-tone-r':'']] as const).map(([label,value,tone],index)=><div className={`p-card p-kpi p-reveal ${tone}`} style={{'--i':index} as React.CSSProperties} key={index}><small>{label}</small><b className="p-mono">{value.toLocaleString('es-AR')}</b></div>)}</div>
      <div className="p-toolbar"><label className="p-search"><Search className="p-i" aria-hidden="true"/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar producto o SKU" aria-label="Buscar producto o SKU"/></label><div className="p-tabs">{([['todos','Todos'],['alertas','Alertas'],['sin_stock','Sin stock'],['sin_movimiento','Sin movimiento']] as const).map(([id,label])=><button type="button" key={id} className={filter===id?'p-on':''} onClick={()=>setFilter(id)}>{label}</button>)}</div><button type="button" className="p-btn" style={{marginLeft:'auto'}} onClick={exportRows}><Download className="p-i" aria-hidden="true"/>Exportar CSV</button></div>
      <div className="p-tableWrap p-reveal"><table><thead><tr><th>Producto / SKU</th><th className="p-r">Stock</th><th className="p-r">Ventas</th><th className="p-r">Ritmo diario</th><th>Duración estimada</th><th>Estado</th></tr></thead>
        <tbody>{filtered.map(row=><tr key={row.variant_id}>
          <td><RpClamp text={row.product_name}/><br/><small className="p-sub">{row.sku||`Variante ${row.external_variant_id}`}</small></td>
          <td className="p-r p-mono">{row.stock===null?'—':row.stock.toLocaleString('es-AR')}</td>
          <td className="p-r p-mono">{row.units_sold.toLocaleString('es-AR')} u.</td>
          <td className="p-r p-mono">{row.sales_per_day.toFixed(2).replace('.',',')} u./día</td>
          <td><div className="p-mbar"><span style={{width:120}}><i style={{width:`${row.stock===null||row.sales_per_day<=0?0:Math.min(100,Math.max(0,(row.days_stock||0)/60*100))}%`,background:barColor(row.inventory_status)}}/></span>{row.stock===null?'No controla':row.sales_per_day<=0?'Sin ventas':`${Math.max(0,row.days_stock||0).toFixed(0)} días`}</div></td>
          <td><span className={`p-chip ${statusTone(row.inventory_status)}`}>{inventoryStatusLabel(row.inventory_status)}</span></td>
        </tr>)}{!filtered.length&&<tr><td colSpan={6} className="p-empty">No hay productos para este filtro.</td></tr>}</tbody>
      </table></div>
    </>:<EmptyData syncing={syncing} onSync={onSync}/>}
  </>;
}

