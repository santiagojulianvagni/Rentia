'use client';

import { useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import RpSelect from './rp-select';
import { aggregateDays, columnLabel, findHeaderRow, guessMapping, parseCsv, type Cell, type Mapping } from '../../lib/sales-import';

const date=(value:string)=>new Intl.DateTimeFormat('es-AR',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`));
const MAX_BYTES=15*1024*1024;

async function readFile(file:File):Promise<Cell[][]> {
  const name=file.name.toLowerCase();
  if(name.endsWith('.xlsx')) {
    const {default:readXlsxFile}=await import('read-excel-file');
    return await readXlsxFile(file) as Cell[][];
  }
  if(name.endsWith('.xls')) throw new Error('xls');
  const buffer=await file.arrayBuffer();
  // Los sistemas de caja viejos exportan en Windows-1252: si UTF-8 trae caracteres rotos, se relee.
  let text=new TextDecoder('utf-8').decode(buffer);
  if(text.includes('�')) text=new TextDecoder('windows-1252').decode(buffer);
  return parseCsv(text);
}

// Importa las ventas de un local desde el Excel o CSV que exporta su sistema de caja.
export default function StoreImport({storeId,storeName,canManage,money,onImported}:{storeId:number;storeName:string;canManage:boolean;money:(value:number)=>string;onImported:()=>Promise<unknown>|void}) {
  const input=useRef<HTMLInputElement>(null);
  const [fileName,setFileName]=useState('');
  const [rows,setRows]=useState<Cell[][]|null>(null);
  const [mapping,setMapping]=useState<Mapping|null>(null);
  const [error,setError]=useState('');
  const [saving,setSaving]=useState(false);
  const [done,setDone]=useState('');

  async function choose(file:File|undefined) {
    if(!file)return;
    setError('');setDone('');setRows(null);setMapping(null);setFileName(file.name);
    if(file.size>MAX_BYTES){setError('El archivo pesa más de 15 MB. Exportá un rango de fechas más corto.');return;}
    try {
      const data=await readFile(file);
      if(!data.length){setError('El archivo está vacío.');return;}
      setRows(data);
      const guess=guessMapping(data);
      const headerRow=findHeaderRow(data);
      setMapping(guess||{date:0,revenue:Math.min(1,Math.max(0,(data[0]?.length||1)-1)),orders:null,cost:null,rowsAre:'days',headerRow});
      if(!guess)setError('No encontramos solos la columna de fecha y la de importe: elegilas abajo.');
    } catch(reason) {
      setError(reason instanceof Error&&reason.message==='xls'?'Los archivos .xls viejos no se pueden leer: abrilo en Excel y guardalo como .xlsx o CSV.':'No pudimos leer el archivo. Probá exportarlo como .xlsx o CSV.');
    }
  }

  const width=rows?Math.max(...rows.slice(0,50).map(row=>row.length)):0;
  const columns=useMemo(()=>rows&&mapping?Array.from({length:width},(_,column)=>({value:String(column),label:columnLabel(rows,mapping.headerRow,column)})):[],[rows,mapping,width]);
  const preview=useMemo(()=>rows&&mapping?aggregateDays(rows,mapping):null,[rows,mapping]);
  const set=(key:'date'|'revenue'|'orders'|'cost',value:string)=>setMapping(current=>current&&{...current,[key]:value===''?null:Number(value)});

  async function save() {
    if(!preview?.days.length||!canManage||saving)return;
    setSaving(true);setError('');
    try {
      const response=await fetch('/api/finance/stores/import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({storeId,days:preview.days})});
      if(!response.ok)throw new Error();
      setDone(`Listo: importamos ${preview.days.length} ${preview.days.length===1?'día':'días'} en ${storeName}.`);
      setRows(null);setMapping(null);setFileName('');if(input.current)input.current.value='';
      await onImported();
    } catch {setError('No pudimos guardar la importación. Intentá de nuevo.');}
    finally {setSaving(false);}
  }

  return <div className="p-card p-reveal p-storeImport">
    <div className="p-cardHead"><div><span className="p-eyebrowS">DESDE TU SISTEMA O TU PLANILLA</span><h3>Subir Excel o CSV</h3><span className="p-sub">Subí el Excel de tu sistema de caja o de facturación, o tu propia planilla de ventas (una fila por venta, por factura o por día). Reconocemos las columnas solas y podés corregirlas antes de guardar.</span></div></div>
    <label className={`p-dropzone${!canManage?' p-disabled':''}`} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();if(canManage)void choose(event.dataTransfer.files[0]);}}>
      <input ref={input} type="file" accept=".xlsx,.csv,.txt" disabled={!canManage} onChange={event=>void choose(event.target.files?.[0])}/>
      {fileName?<FileSpreadsheet aria-hidden="true"/>:<Upload aria-hidden="true"/>}
      <span><b>{fileName||'Elegí o arrastrá el archivo'}</b><small>Excel (.xlsx) o CSV, hasta 15 MB</small></span>
    </label>
    {error&&<p className="p-sub p-warnLine" role="alert">{error}</p>}
    {done&&<p className="p-sub" role="status" style={{color:'var(--green)'}}>{done}</p>}

    {rows&&mapping&&<>
      <div className="p-importMap">
        <div className="p-field"><label>Fecha</label><span className="p-input"><RpSelect value={String(mapping.date)} onChange={event=>set('date',event.target.value)} aria-label="Columna de fecha">{columns.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</RpSelect></span></div>
        <div className="p-field"><label>Importe de la venta</label><span className="p-input"><RpSelect value={String(mapping.revenue)} onChange={event=>set('revenue',event.target.value)} aria-label="Columna de importe">{columns.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</RpSelect></span></div>
        <div className="p-field"><label>Cantidad de ventas (opcional)</label><span className="p-input"><RpSelect value={mapping.orders===null?'':String(mapping.orders)} onChange={event=>set('orders',event.target.value)} aria-label="Columna de cantidad de ventas"><option value="">No tiene</option>{columns.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</RpSelect></span></div>
        <div className="p-field"><label>Costo de mercadería (opcional)</label><span className="p-input"><RpSelect value={mapping.cost===null?'':String(mapping.cost)} onChange={event=>set('cost',event.target.value)} aria-label="Columna de costo"><option value="">No tiene: usar el % del local</option>{columns.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</RpSelect></span></div>
      </div>
      {mapping.orders===null&&<div className="p-tabs" role="group" aria-label="Qué es cada fila" style={{marginTop:12,width:'fit-content'}}>
        <button type="button" className={mapping.rowsAre==='sales'?'p-on':undefined} onClick={()=>setMapping({...mapping,rowsAre:'sales'})}>Cada fila es una venta</button>
        <button type="button" className={mapping.rowsAre==='days'?'p-on':undefined} onClick={()=>setMapping({...mapping,rowsAre:'days'})}>Cada fila es el total de un día</button>
      </div>}

      {preview&&<div className="p-importPreview">
        {preview.days.length?<>
          <div className="p-grid p-g3" style={{margin:'14px 0'}}>
            <div className="p-card p-kpi"><small>Días</small><b className="p-mono">{preview.days.length}</b><span className="p-sub">{preview.range?`${date(preview.range.from)} al ${date(preview.range.to)}`:''}</span></div>
            <div className="p-card p-kpi"><small>Ventas</small><b className="p-mono">{money(preview.totals.revenue)}</b><span className="p-sub">{preview.totals.orders.toLocaleString('es-AR')} {mapping.orders===null&&mapping.rowsAre==='days'?'órdenes (sin dato)':'órdenes'}</span></div>
            <div className="p-card p-kpi"><small>Ticket promedio</small><b className="p-mono">{preview.totals.orders?money(preview.totals.revenue/preview.totals.orders):'—'}</b><span className="p-sub">Revisá que tenga sentido</span></div>
          </div>
          <div className="p-tableWrap"><table><thead><tr><th>Día</th><th className="p-r">Órdenes</th><th className="p-r">Ventas</th><th className="p-r">Costo</th></tr></thead>
            <tbody>{preview.days.slice(0,8).map(day=><tr key={day.date}><td>{date(day.date)}</td><td className="p-r p-mono">{day.orders}</td><td className="p-r p-mono">{money(day.revenue)}</td><td className="p-r p-mono">{day.productCost===null?<span className="p-sub">% del local</span>:money(day.productCost)}</td></tr>)}</tbody>
          </table></div>
          {preview.days.length>8&&<p className="p-sub" style={{margin:'8px 0 0'}}>Y {preview.days.length-8} días más.</p>}
        </>:<p className="p-sub p-warnLine">Con estas columnas no se entiende ninguna fila. Probá elegir otras.</p>}
        {preview.skipped.length>0&&<p className="p-sub p-warnLine">No tomamos {preview.skipped.length} {preview.skipped.length===1?'fila':'filas'} ({preview.skipped.slice(0,4).map(item=>`fila ${item.row}: ${item.reason}`).join(' · ')}{preview.skipped.length>4?' · …':''}). Si son totales o notas, está bien.</p>}
        {preview.negative.length>0&&<p className="p-sub p-warnLine">Dejamos afuera {preview.negative.length} {preview.negative.length===1?'día':'días'} con total negativo (devoluciones mayores a las ventas).</p>}
        <div style={{display:'flex',alignItems:'center',gap:12,marginTop:14,flexWrap:'wrap'}}>
          <button type="button" className="p-btn p-primary" disabled={!preview.days.length||saving||!canManage} onClick={()=>void save()}>{saving?'Importando…':`Importar ${preview.days.length} ${preview.days.length===1?'día':'días'}`}</button>
          <span className="p-sub">Si un día ya estaba cargado en {storeName}, se reemplaza por el del archivo. Los demás días no cambian.</span>
        </div>
      </div>}
    </>}
  </div>;
}
