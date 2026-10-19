'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CalendarHeart, Trash2 } from 'lucide-react';
import RpDate from './rp-date';
import { confirmDialog } from './rp-confirm';
import { EVENT_MAX_DAYS, EVENT_NAME_SUGGESTIONS, compareEvent, eventWindows, rangeDays, validEventDates, type EventMetrics, type EventRow } from '../../lib/sales-events';

type SalesEvent={id:number;name:string;start:string;end:string};
type Loaded={event:EventMetrics;baseline:EventMetrics;after:EventMetrics|null};

const todayInArgentina=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const shortDate=new Intl.DateTimeFormat('es-AR',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const dateLabel=(value:string)=>shortDate.format(new Date(`${value}T12:00:00Z`));
const rangeLabel=(start:string,end:string)=>start===end?dateLabel(start):`${dateLabel(start)} al ${dateLabel(end)}`;

async function metricsFor(start:string,end:string):Promise<EventMetrics|null> {
  const response=await fetch(`/api/dashboard?start=${start}&end=${end}`,{cache:'no-store'});
  if(!response.ok)return null;
  const {metrics}=await response.json() as {metrics:EventMetrics};
  return metrics;
}

function value(row:EventRow,money:(value:number)=>string) {
  if(row.kind==='money')return money(row.event);
  if(row.kind==='count')return Math.round(row.event).toLocaleString('es-AR');
  if(row.kind==='percent')return `${row.event.toFixed(1).replace('.',',')}%`;
  return row.event?`${row.event.toFixed(2).replace('.',',')}x`:'—';
}
function normalValue(row:EventRow,money:(value:number)=>string) {
  return value({...row,event:row.normal},money);
}
function Change({row}:{row:EventRow}) {
  if(row.change===null)return <span className="p-sub">—</span>;
  const label=row.kind==='percent'?`${row.change>0?'+':''}${row.change.toFixed(1).replace('.',',')} pts`:`${row.change>0?'+':''}${Math.round(row.change)}%`;
  const tone=Math.abs(row.change)<1?'p-n':row.inverse?(row.change>0?'p-a':'p-g'):row.change>0?'p-g':'p-r';
  return <span className={`p-chip ${tone}`}>{label}</span>;
}

// Eventos comerciales: cada uno se compara contra días normales y contra la semana siguiente.
export default function SalesEvents({money,canManage}:{money:(value:number)=>string;canManage:boolean}) {
  const today=useMemo(todayInArgentina,[]);
  const [events,setEvents]=useState<SalesEvent[]|null>(null);
  const [listError,setListError]=useState(false);
  const [selected,setSelected]=useState<number|null>(null);
  const [loaded,setLoaded]=useState<Loaded|null>(null);
  const [loadError,setLoadError]=useState(false);
  const [creating,setCreating]=useState(false);
  const [name,setName]=useState('');
  const [start,setStart]=useState('');
  const [end,setEnd]=useState('');
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');

  useEffect(()=>{
    fetch('/api/events',{cache:'no-store'}).then(async response=>{
      if(!response.ok)throw new Error();
      const data=await response.json() as {events:SalesEvent[]};
      setEvents(data.events);setSelected(current=>current??data.events[0]?.id??null);
      if(!data.events.length)setCreating(true);
    }).catch(()=>setListError(true));
  },[]);

  const event=events?.find(item=>item.id===selected)||null;
  const windows=useMemo(()=>event?eventWindows(event.start,event.end,today):null,[event,today]);

  useEffect(()=>{
    if(!windows)return;
    let cancelled=false;
    void Promise.resolve().then(()=>{if(!cancelled){setLoaded(null);setLoadError(false);}});
    Promise.all([metricsFor(windows.event.start,windows.event.end),metricsFor(windows.baseline.start,windows.baseline.end),windows.after?metricsFor(windows.after.start,windows.after.end):Promise.resolve(null)])
      .then(([eventMetrics,baseline,after])=>{
        if(cancelled)return;
        if(!eventMetrics||!baseline){setLoadError(true);return;}
        setLoaded({event:eventMetrics,baseline,after});
      }).catch(()=>{if(!cancelled)setLoadError(true);});
    return ()=>{cancelled=true;};
  },[windows]);

  const result=useMemo(()=>loaded&&windows?compareEvent({event:loaded.event,baseline:loaded.baseline,after:loaded.after,eventDays:windows.event.days,money}):null,[loaded,windows,money]);

  async function create(submit:FormEvent) {
    submit.preventDefault();
    if(!canManage||saving)return;
    if(!name.trim()){setMessage('Poné un nombre para el evento.');return;}
    if(!validEventDates(start,end)){setMessage(`Elegí las fechas de inicio y fin (hasta ${EVENT_MAX_DAYS} días).`);return;}
    setSaving(true);setMessage('');
    try {
      const response=await fetch('/api/events',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:name.trim(),start,end})});
      const data=await response.json() as {event?:SalesEvent;error?:string};
      if(!response.ok||!data.event)throw new Error(data.error);
      const created=data.event;
      setEvents(current=>[created,...(current||[])].sort((a,b)=>b.start.localeCompare(a.start)));
      setSelected(created.id);setCreating(false);setName('');setStart('');setEnd('');
    } catch(error) {
      setMessage(error instanceof Error&&error.message==='too_many_events'?'Llegaste a 100 eventos: borrá alguno viejo para sumar otro.':'No pudimos guardar el evento. Intentá de nuevo.');
    } finally {setSaving(false);}
  }

  async function remove(item:SalesEvent) {
    if(!canManage)return;
    if(!await confirmDialog({title:`¿Borrar "${item.name}"?`,message:'Se borra solo el evento de esta lista. Tus ventas y costos no cambian.',confirmLabel:'Borrar evento',cancelLabel:'Cancelar',danger:true}))return;
    const response=await fetch('/api/events',{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({id:item.id})}).catch(()=>null);
    if(!response?.ok){setMessage('No pudimos borrar el evento. Intentá de nuevo.');return;}
    const rest=(events||[]).filter(entry=>entry.id!==item.id);
    setEvents(rest);setSelected(rest[0]?.id??null);if(!rest.length)setCreating(true);
  }

  const verdictTone=result?{good:'p-tone-g',warn:'p-warning',bad:'p-tone-r',neutral:''}[result.verdict.tone]:'';
  return <>
    <div className="p-head"><div><div className="p-eyebrow">VENTAS · FECHAS ESPECIALES</div><h1>Eventos</h1><p>Hot Sale, Cyber Monday, un lanzamiento o tu propia promo: mirá si de verdad ganaste más que en días normales.</p></div>
      {canManage&&!creating&&<div className="p-actions"><button type="button" className="p-btn p-primary" onClick={()=>{setCreating(true);setMessage('');}}>Nuevo evento</button></div>}</div>

    {listError&&<div className="p-notice p-warning" role="alert"><div><b>No pudimos cargar tus eventos</b><p>Recargá la página para intentar de nuevo.</p></div></div>}

    {creating&&canManage&&<form className="p-card p-reveal p-eventForm" onSubmit={create}>
      <div className="p-cardHead"><div><span className="p-eyebrowS">NUEVO EVENTO</span><h3>¿Qué fecha querés analizar?</h3><span className="p-sub">Elegí un nombre y los días que duró. Puede ser un evento que ya pasó.</span></div></div>
      <div className="p-simChips" style={{marginBottom:12}}>{EVENT_NAME_SUGGESTIONS.map(item=><button type="button" key={item} className={name===item?'p-on':undefined} onClick={()=>setName(item)}>{item}</button>)}</div>
      <div className="p-eventFields">
        <div className="p-field"><label htmlFor="event-name">Nombre</label><div className="p-input"><input id="event-name" value={name} maxLength={80} onChange={change=>setName(change.target.value)} placeholder="Hot Sale 2026"/></div></div>
        <div className="p-field"><label>Desde</label><RpDate value={start} max={end||undefined} onChange={change=>setStart(change.target.value)} aria-label="Fecha de inicio del evento"/></div>
        <div className="p-field"><label>Hasta</label><RpDate value={end} min={start||undefined} onChange={change=>setEnd(change.target.value)} aria-label="Fecha de fin del evento"/></div>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:12,marginTop:14,flexWrap:'wrap'}}>
        <button type="submit" className="p-btn p-primary" disabled={saving}>{saving?'Guardando…':'Guardar y comparar'}</button>
        {events&&events.length>0&&<button type="button" className="p-btn" onClick={()=>{setCreating(false);setMessage('');}}>Cancelar</button>}
        {start&&end&&validEventDates(start,end)&&<span className="p-sub">{rangeDays(start,end)} {rangeDays(start,end)===1?'día':'días'}</span>}
        {message&&<span className="p-sub" role="status">{message}</span>}
      </div>
    </form>}
    {!canManage&&events&&!events.length&&<div className="p-empty">Todavía no hay eventos cargados. Los crea el propietario o un administrador de la tienda.</div>}

    {events&&events.length>0&&<div className="p-eventLayout">
      <ul className="p-eventList" aria-label="Eventos guardados">{events.map(item=><li key={item.id}>
        <button type="button" className={item.id===selected?'p-on':undefined} aria-pressed={item.id===selected} onClick={()=>setSelected(item.id)}>
          <CalendarHeart aria-hidden="true"/><span><b>{item.name}</b><small>{rangeLabel(item.start,item.end)}</small></span>
        </button>
        {canManage&&<button type="button" className="p-iconBtn" aria-label={`Borrar ${item.name}`} onClick={()=>remove(item)}><Trash2 aria-hidden="true"/></button>}
      </li>)}</ul>

      <div className="p-eventDetail">
        {event&&windows&&<>
          {!windows.finished&&event.start<=today&&<div className="p-note" style={{marginBottom:12}}>El evento está en curso: los números se actualizan a medida que entran las ventas.</div>}
          {event.start>today&&<div className="p-note" style={{marginBottom:12}}>El evento todavía no empezó. Cuando arranque, vas a ver acá la comparación.</div>}
          {loadError&&<div className="p-notice p-warning" role="alert"><div><b>No pudimos calcular este evento</b><p>Recargá la página para intentar de nuevo.</p></div></div>}
          {!loadError&&!result&&<div className="p-card p-loading" aria-busy="true"><span className="p-sub">Calculando el evento…</span></div>}
          {result&&<>
            <div className={`p-card p-kpi p-reveal p-eventVerdict ${verdictTone}`}><small>{event.name} · {rangeLabel(event.start,event.end)}</small><b>{result.verdict.title}</b><span className="p-sub">{result.verdict.text}</span></div>
            <div className="p-tableWrap p-reveal" style={{marginTop:16}}><table>
              <thead><tr><th>Métrica</th><th className="p-r">Evento</th><th className="p-r">{windows.event.days} {windows.event.days===1?'día normal':'días normales'}</th><th className="p-r">Diferencia</th></tr></thead>
              <tbody>{result.rows.map(row=><tr key={row.key}><td>{row.label}</td><td className="p-r p-mono">{value(row,money)}</td><td className="p-r p-mono">{normalValue(row,money)}</td><td className="p-r"><Change row={row}/></td></tr>)}</tbody>
            </table></div>
            {(result.after||result.notes.length>0)&&<div className="p-card p-reveal" style={{marginTop:16}}>
              <div className="p-cardHead"><div><span className="p-eyebrowS">PARA EL PRÓXIMO</span><h3>Qué mirar</h3></div></div>
              <ul className="p-weekList">
                {result.after&&<li><span style={{whiteSpace:'normal'}}><b>Semana siguiente:</b> {result.after.text}</span></li>}
                {result.notes.map(note=><li key={note}><span style={{whiteSpace:'normal'}}>{note}</span></li>)}
              </ul>
            </div>}
            {!result.after&&windows.finished&&<p className="p-sub" style={{marginTop:12}}>La comparación con la semana siguiente aparece cuando pasen 7 días desde el final del evento.</p>}
          </>}
          <div className="p-note p-reveal" style={{marginTop:16}}><b>Cómo se calcula:</b> “días normales” es el promedio por día de las 4 semanas anteriores ({rangeLabel(windows.baseline.start,windows.baseline.end)}), salteando la semana previa al evento, cuando mucha gente espera las ofertas. La ganancia es antes de gastos fijos, porque esos se pagan igual haya evento o no. Incluye las ventas de los canales conectados.</div>
        </>}
      </div>
    </div>}
  </>;
}
