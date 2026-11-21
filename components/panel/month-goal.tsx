'use client';

import { useEffect, useState } from 'react';
import { monthGoal } from '../../lib/month-goal';

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
  const editor=editing&&<form className="p-goalEdit" onSubmit={event=>{event.preventDefault();const amount=Number(draft.replace(/[^\d]/g,''));if(amount>0)void save(amount);}}>
    <label><span>Meta de facturación de {name}</span><span className="p-goalInput"><b>$</b><input inputMode="numeric" value={draft} onChange={event=>setDraft(event.target.value.replace(/[^\d.]/g,''))} placeholder="50.000.000" autoFocus/></span></label>
    <button type="submit" className="p-btn p-primary p-small" disabled={saving}>Guardar</button>
    <button type="button" className="p-btn p-small" onClick={()=>setEditing(false)}>Cancelar</button>
  </form>;

  if(!goal)return <div className="p-card p-goal p-reveal">
    <div><span className="p-eyebrowS">META DE {name.toUpperCase()}</span><h3 style={{margin:'6px 0 4px'}}>Poné una meta para el mes</h3><p className="p-sub" style={{margin:0}}>Si cargás tus gastos fijos, la calculamos sola: lo que necesitás vender para cubrir todos tus costos.</p></div>
    {editor||<div className="p-actions">{canManage&&<button type="button" className="p-btn p-primary p-small" onClick={()=>{setDraft('');setEditing(true);}}>Poner una meta</button>}<button type="button" className="p-btn p-small" onClick={()=>onNavigate('configuracion')}>Cargar gastos fijos</button></div>}
  </div>;

  const [label,tone]=STATUS[goal.status];
  return <div className="p-card p-goal p-reveal">
    <div className="p-goalMain">
      <span className="p-eyebrowS">META DE {name.toUpperCase()} · {goal.source==='propia'?'TU META':'CUBRIR TODOS TUS COSTOS'}</span>
      <div className="p-goalHead"><b className="p-mono">{short(goal.revenue)}</b><span className="p-sub">de {short(goal.target)}</span><span className={`p-chip ${tone}`}>{label}</span></div>
      <div className="p-goalBar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(goal.progress*100)} aria-label={`Llevás ${money(goal.revenue)} de ${money(goal.target)}`}>
        <i style={{width:`${goal.progress*100}%`}}/>
        {goal.status!=='cumplida'&&<em style={{left:`${goal.idealProgress*100}%`}}><span>Lo ideal hoy</span></em>}
      </div>
      <p className="p-sub" style={{margin:0}}>{goal.status==='cumplida'?`Ya facturaste ${money(goal.revenue)} en ${name}. Desde acá, todo suma.`:`A esta altura lo ideal era llevar ${money(goal.ideal)} y llevás ${money(goal.revenue)}. `}{goal.status!=='cumplida'&&<b style={{color:'var(--text)'}}>Con este ritmo cerrás en {money(goal.projected)}.</b>}</p>
      {editor||(canManage&&<div className="p-goalLinks"><button type="button" className="p-linkBtn" onClick={()=>{setDraft(goal.source==='propia'?String(Math.round(goal.target)):'');setEditing(true);}}>{goal.source==='propia'?'Cambiar mi meta':'Poner mi propia meta'}</button>{goal.source==='propia'&&result.breakEven!==null&&<button type="button" className="p-linkBtn" onClick={()=>void save(null)} disabled={saving}>Usar el punto de equilibrio</button>}</div>)}
    </div>
    <div className="p-goalMini">
      <div><small>Te faltan</small><b className="p-mono">{goal.remaining>0?short(goal.remaining):'—'}</b></div>
      <div><small>Quedan</small><b className="p-mono">{goal.daysLeft===1?'1 día':`${goal.daysLeft} días`}</b></div>
      <div><small>Vendé por día</small><b className="p-mono">{goal.perDay?short(goal.perDay):'—'}</b></div>
    </div>
  </div>;
}
