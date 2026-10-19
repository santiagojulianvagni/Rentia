'use client';

import { categorySummary, type CategoryInput } from '../../lib/categories';

// Resumen por categoría arriba de la tabla de productos; tocar una categoría filtra la tabla.
export default function CategorySummary({rows,money,selected,onSelect}:{rows:CategoryInput[];money:(value:number)=>string;selected:string|null;onSelect:(category:string|null)=>void}) {
  const {categories,hasCategories}=categorySummary(rows);
  if(!hasCategories)return <div className="p-note" style={{marginBottom:16}}>Las categorías de tus productos de Tiendanube aparecen después de la próxima sincronización.</div>;
  const max=Math.max(...categories.map(row=>row.revenue),1);
  return <div className="p-card p-reveal" style={{marginBottom:16}}>
    <div className="p-cardHead"><div><span className="p-eyebrowS">POR CATEGORÍA</span><h3>¿Qué categorías venden y cuáles dejan más?</h3><span className="p-sub">Tocá una categoría para ver sus productos. Un producto puede estar en varias.</span></div>
      {selected&&<button type="button" className="p-btn p-small" onClick={()=>onSelect(null)}>Ver todas</button>}</div>
    <div className="p-tableWrap"><table>
      <thead><tr><th>Categoría</th><th className="p-r">Productos</th><th className="p-r">Unidades</th><th className="p-r">Facturación</th><th className="p-r">Ganancia</th><th className="p-r">Margen</th></tr></thead>
      <tbody>{categories.slice(0,15).map(row=><tr key={row.name} className={selected===row.name?'p-rowOn':undefined}>
        <td><button type="button" className="p-linkBtn" aria-pressed={selected===row.name} onClick={()=>onSelect(selected===row.name?null:row.name)}>{row.name}</button><div className="p-barTrack" style={{maxWidth:180}}><i style={{width:`${row.revenue/max*100}%`}}/></div></td>
        <td className="p-r p-mono">{row.products}</td>
        <td className="p-r p-mono">{row.units.toLocaleString('es-AR')}</td>
        <td className="p-r p-mono">{money(row.revenue)}<br/><small className="p-sub">{Math.round(row.share*100)}% del total</small></td>
        <td className={`p-r p-mono ${row.profit<0?'p-neg':'p-pos'}`}>{money(row.profit)}</td>
        <td className="p-r p-mono">{row.revenue?`${row.margin.toFixed(1).replace('.',',')}%`:'—'}</td>
      </tr>)}</tbody>
    </table></div>
  </div>;
}
