'use client';

import { useEffect, useState } from 'react';
import { monthGoal } from '../../lib/month-goal';
import { goalSuggestions, nextGoal } from '../../lib/goal-suggestions';
import { todayInArgentina } from '../../lib/mascot';
import { useSalesHistory } from './mascot';

type CashflowResult={breakEven:number|null;elapsed:number;totalDays:number;projectedRevenue:number;month:string};

const STATUS={cumplida:['¡Meta cumplida!','p-g'],adelantado:['Vas adelantado','p-g'],llegas:['Vas un poco atrás, pero llegás','p-a'],atrasado:['Vas atrasado','p-r']} as const;
const monthName=(month:string)=>new Intl.DateTimeFormat('es-AR',{month:'long',timeZone:'UTC'}).format(new Date(`${month}-01T12:00:00Z`));
const short=(value:number)=>value>=1e6?`$ ${(value/1e6).toLocaleString('es-AR',{maximumFractionDigits:1})}M`:value>=1e3?`$ ${Math.round(value/1e3).toLocaleString('es-AR')}K`:`$ ${Math.round(value).toLocaleString('es-AR')}`;

// Tarjeta de la meta del mes en el dashboard. El dueño puede poner su propia meta para el mes.
export default function MonthGoal({result,revenue,money,canManage,onNavigate}:{result:CashflowResult|null;revenue:number;money:(value:number)=>string;canManage:boolean;onNavigate:(section:string)=>void}) {
  const [custom,setCustom]=useState<number|null|undefined>(undefined);
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState('');
  const [saving,setSaving]=useState(false);
  const history=useSalesHistory();
  useEffect(()=>{fetch('/api/account/goal',{cache:'no-store'}).then(response=>response.ok?response.json():null).then(data=>setCustom(typeof data?.amount==='number'?data.amount:null)).catch(()=>setCustom(null));},[]);
  if(!result||custom===undefined)return null;

  const goal=monthGoal({custom,breakEven:result.breakEven,revenue,elapsed:result.elapsed,totalDays:result.totalDays,projected:result.projectedRevenue});
  const name=monthName(result.month);
  async function save(amount:number|null) {
    setSaving(true);
    try{
      const response=await fetch('/api/account/goal',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({amount})});
      if(response.ok){setCustom(amount);setEditing(false);}
    }finally{setSaving(false);}
  }
  // Al poner una meta se sugieren tres, calculadas con la facturación real de la tienda.
  const suggestions=history?goalSuggestions(history,todayInArgentina(),result.projectedRevenue,money):[];
  const editor=editing&&<div className="p-goalEdit">
    {suggestions.length>0&&<div className="p-goalSuggest">{suggestions.map(item=><button type="button" key={item.key} className={`p-goalOption${item.recommended?' p-on':''}`} disabled={saving} onClick={()=>void save(item.amount)}>
      <small>{item.label}{item.recommended?' · recomendada':''}</small><b className="p-mono">{money(item.amount)}</b><span>{item.detail}</span>
    </button>)}</div>}
    <form className="p-goalOwn" onSubmit={event=>{event.preventDefault();const amount=Number(draft.replace(/[^\d]/g,''));if(amount>0)void save(amount);}}>
      <label><span>{suggestions.length?'O poné la tuya':`Meta de facturación de ${name}`}</span><span className="p-input p-goalInput"><b>$</b><input inputMode="numeric" value={draft} onChange={event=>setDraft(event.target.value.replace(/[^\d.]/g,''))} placeholder="50.000.000" autoFocus={!suggestions.length}/></span></label>
      <button type="submit" className="p-btn p-primary p-small" disabled={saving||!draft}>Guardar</button>
      <button type="button" className="p-btn p-small" onClick={()=>setEditing(false)}>Cancelar</button>
    </form>
  </div>;

  // Franja de una línea: un detalle arriba del dashboard, sin sacarle protagonismo al resto.
  if(!goal)return <div className="p-goalStrip p-reveal">
    <span className="p-goalTag">META DE {name.toUpperCase()}</span>
    <span className="p-sub">Poné una meta o cargá tus gastos fijos y te decimos cuánto vender por día.</span>
    {editor||<span className="p-goalLinks">{canManage&&<button type="button" className="p-linkBtn" onClick={()=>{setDraft('');setEditing(true);}}>Poner una meta</button>}<button type="button" className="p-linkBtn" onClick={()=>onNavigate('configuracion')}>Cargar gastos fijos</button></span>}
  </div>;

  const [label,tone]=STATUS[goal.status];
  const detail=goal.status==='cumplida'?'Desde acá, todo suma':`Faltan ${short(goal.remaining)} · ${goal.perDay?`${short(goal.perDay)} por día · `:''}${goal.daysLeft===1?'queda 1 día':`quedan ${goal.daysLeft} días`}`;
  return <div className="p-goalStrip p-reveal" title={goal.status==='cumplida'?undefined:`Lo ideal a hoy era ${money(goal.ideal)}. Con este ritmo cerrás en ${money(goal.projected)}.`}>
    <span className="p-goalTag">META DE {name.toUpperCase()}{goal.source==='propia'?'':' · CUBRIR COSTOS'}</span>
    <span className="p-goalAmount"><b className="p-mono">{short(goal.revenue)}</b> <span className="p-sub">de {short(goal.target)}</span></span>
    <span className="p-goalBar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(goal.progress*100)} aria-label={`Llevás ${money(goal.revenue)} de ${money(goal.target)}`}>
      <i style={{width:`${goal.progress*100}%`}}/>
      {goal.status!=='cumplida'&&<em style={{left:`${goal.idealProgress*100}%`}} title="Lo ideal a hoy"/>}
    </span>
    <span className={`p-chip ${tone}`}>{label}</span>
    <span className="p-sub p-goalDetail">{detail}</span>
    {!editor&&canManage&&goal.status==='cumplida'&&<button type="button" className="p-btn p-primary p-small" disabled={saving} onClick={()=>void save(nextGoal(goal.target,goal.revenue))}>¿La subimos a {short(nextGoal(goal.target,goal.revenue))}?</button>}
    {editor||(canManage&&<span className="p-goalLinks"><button type="button" className="p-linkBtn" onClick={()=>{setDraft(goal.source==='propia'?String(Math.round(goal.target)):'');setEditing(true);}}>{goal.source==='propia'?'Cambiar':'Poner mi meta'}</button>{goal.source==='propia'&&result.breakEven!==null&&<button type="button" className="p-linkBtn" onClick={()=>void save(null)} disabled={saving}>Usar equilibrio</button>}</span>)}
  </div>;
}
