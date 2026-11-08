'use client';

import { useCallback, useEffect, useState } from 'react';

// Panel interno de Rentia: cuentas y planes sin cargo. La API solo responde a los dueños.
type Row={user_id:string;email:string;owner_name:string|null;store_name:string|null;created_at:string;plan_id:string|null;status:string|null;provider:string|null;trial_ends_at:string|null;current_period_end:string|null};
const PLANS=[['starter','Starter'],['growth','Growth'],['pro','Pro'],['scale','Scale'],['enterprise','Enterprise']] as const;
const STATUS:Record<string,string>={trialing:'En prueba',active:'Activo',past_due:'Cobro rechazado',free:'Gratis',canceled:'Cancelado'};
const date=(iso:string|null)=>iso?new Intl.DateTimeFormat('es-AR',{dateStyle:'medium'}).format(new Date(iso)):'—';

const ui={page:{minHeight:'100vh',background:'#07111c',color:'#e8f0f6',fontFamily:'system-ui,-apple-system,Segoe UI,Roboto,sans-serif',padding:'32px 16px'},box:{maxWidth:1100,margin:'0 auto'},input:{padding:'10px 12px',borderRadius:10,border:'1px solid #294357',background:'#08131f',color:'#f4f8fb',font:'inherit'},btn:{padding:'7px 12px',borderRadius:8,border:'1px solid #294357',background:'#0f2232',color:'#e8f0f6',cursor:'pointer',font:'inherit',fontSize:13},primary:{background:'#21d4c2',color:'#031513',border:0,fontWeight:700}} as const;

export default function AdminPage() {
  const [rows,setRows]=useState<Row[]|null>(null);
  const [query,setQuery]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState<string|null>(null);
  const [choice,setChoice]=useState<Record<string,string>>({});
  const [testKind,setTestKind]=useState('trial_ending');
  const [testState,setTestState]=useState('');
  async function sendTest() {
    setTestState('Enviando…');
    const response=await fetch('/api/admin/test-email',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:testKind})});
    const data=await response.json().catch(()=>({})) as {sent?:boolean;reason?:string};
    setTestState(data.sent?'Listo: revisá tu bandeja de entrada.':`No se pudo mandar (${data.reason||response.status}).`);
  }

  const load=useCallback(async(q:string)=>{
    const response=await fetch(`/api/admin/accounts?q=${encodeURIComponent(q)}`,{cache:'no-store'});
    if (response.status===403) { setError('No tenés acceso a esta página. Entrá a Rentia con el email de un dueño y volvé a abrirla.'); setRows([]); return; }
    const data=await response.json().catch(()=>({})) as {accounts?:Row[]};
    setRows(data.accounts||[]);
  },[]);
  useEffect(()=>{ const timer=window.setTimeout(()=>void load(query),300); return ()=>window.clearTimeout(timer); },[query,load]);

  async function act(row:Row,action:'grant'|'revoke') {
    const planId=choice[row.user_id]||'enterprise';
    if (action==='grant'&&!window.confirm(`¿Dar ${planId} sin cargo a ${row.store_name||row.email}?`)) return;
    if (action==='revoke'&&!window.confirm(`¿Quitar el plan sin cargo a ${row.store_name||row.email}? Pasa a Gratis.`)) return;
    setBusy(row.user_id);
    const response=await fetch('/api/admin/accounts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({userId:row.user_id,action,planId})});
    setBusy(null);
    if (!response.ok) { setError('No se pudo guardar el cambio.'); return; }
    void load(query);
  }

  return <main style={ui.page}><div style={ui.box}>
    <h1 style={{margin:'0 0 4px',fontSize:26}}>Administración de Rentia</h1>
    <p style={{margin:'0 0 20px',color:'#9bb0c3'}}>Cuentas y planes sin cargo. Un plan sin cargo no pasa por Mercado Pago y no vence.</p>
    {!error&&<div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',margin:'0 0 20px',padding:14,border:'1px solid #1b3346',borderRadius:14,background:'#0b1826'}}><b style={{marginRight:6}}>Mail de prueba</b><select style={{...ui.input,padding:'7px 10px'}} value={testKind} onChange={event=>setTestKind(event.target.value)} aria-label="Plantilla">{[['welcome','Bienvenida'],['trial_ending','Prueba por terminar'],['trial_ended','Prueba terminada'],['subscription_active','Plan activado'],['payment_failed','Cobro rechazado'],['subscription_canceled','Baja confirmada'],['plan_expired','Pasó a Gratis'],['price_increase','Aumento por dólar'],['weekly_summary','Resumen semanal'],['customer_data_request','Pedido de datos'],['withdrawal','Arrepentimiento']].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select><button style={{...ui.btn,...ui.primary}} onClick={()=>void sendTest()}>Mandarme un mail de prueba</button><span style={{color:'#9bb0c3',fontSize:13}}>{testState}</span></div>}
    <input style={{...ui.input,width:'100%',maxWidth:420,marginBottom:16}} placeholder="Buscar por tienda, nombre o email" value={query} onChange={event=>setQuery(event.target.value)} aria-label="Buscar cuentas"/>
    {error&&<p role="alert" style={{color:'#ffb4a8'}}>{error}</p>}
    {error&&rows?.length===0?null:rows===null?<p style={{color:'#9bb0c3'}}>Cargando…</p>:rows.length===0?<p style={{color:'#9bb0c3'}}>No hay cuentas para mostrar.</p>:
    <div style={{overflowX:'auto',border:'1px solid #1b3346',borderRadius:14}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:14}}>
      <thead><tr style={{textAlign:'left',color:'#8ea6b8',background:'#0b1826'}}>{['Tienda','Email','Alta','Plan','Estado','Acción'].map(head=><th key={head} style={{padding:'10px 12px',fontWeight:600}}>{head}</th>)}</tr></thead>
      <tbody>{rows.map(row=>{const complimentary=row.provider==='complimentary';return <tr key={row.user_id} style={{borderTop:'1px solid #1b3346'}}>
        <td style={{padding:'10px 12px'}}><b>{row.store_name||'—'}</b><br/><small style={{color:'#8ea6b8'}}>{row.owner_name||''}</small></td>
        <td style={{padding:'10px 12px'}}>{row.email}</td>
        <td style={{padding:'10px 12px'}}>{date(row.created_at)}</td>
        <td style={{padding:'10px 12px'}}>{(row.plan_id||'free').replace(/^./,letter=>letter.toUpperCase())}{complimentary&&<span style={{marginLeft:6,padding:'2px 8px',borderRadius:99,background:'#123b36',color:'#5fe8d9',fontSize:12}}>sin cargo</span>}</td>
        <td style={{padding:'10px 12px'}}>{STATUS[row.status||'free']||row.status}{row.status==='trialing'&&<><br/><small style={{color:'#8ea6b8'}}>hasta {date(row.trial_ends_at)}</small></>}</td>
        <td style={{padding:'10px 12px',whiteSpace:'nowrap'}}>{complimentary?<button style={ui.btn} disabled={busy===row.user_id} onClick={()=>void act(row,'revoke')}>Quitar sin cargo</button>:<><select style={{...ui.input,padding:'6px 8px',marginRight:6}} value={choice[row.user_id]||'enterprise'} onChange={event=>setChoice(current=>({...current,[row.user_id]:event.target.value}))} aria-label="Plan">{PLANS.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select><button style={{...ui.btn,...ui.primary}} disabled={busy===row.user_id} onClick={()=>void act(row,'grant')}>Dar sin cargo</button></>}</td>
      </tr>;})}</tbody>
    </table></div>}
  </div></main>;
}
