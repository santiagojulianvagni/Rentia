'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

// Panel interno de Rentia: tiendas, planes sin cargo y lugares de equipo. La API solo responde a los dueños.
type Row={user_id:string;email:string;owner_name:string|null;store_name:string|null;created_at:string;plan_id:string|null;status:string|null;provider:string|null;trial_ends_at:string|null;current_period_end:string|null;organization_id:string|null;channels:string|null;team_limit:number|null};
type Filter='all'|'trial'|'paying'|'complimentary'|'free'|'problem';
type Tone='teal'|'green'|'amber'|'red'|'gray';

const PLAN_NAMES:Record<string,string>={free:'Gratis',starter:'Starter',growth:'Growth',pro:'Pro',scale:'Scale',enterprise:'Enterprise'};
const GRANTABLE=['starter','growth','pro','scale','enterprise'] as const;
const CHANNELS:Record<string,[string,string]>={tiendanube:['Tiendanube','#4f8cff'],mercadolibre:['Mercado Libre','#ffd23f'],mercadolibre_ads:['Mercado Ads','#ffd23f'],meta:['Meta Ads','#ff6fae'],mercadopago:['Mercado Pago','#5fb7ff']};
const TEST_EMAILS=[['welcome','Bienvenida'],['trial_ending','Prueba por terminar'],['trial_ended','Prueba terminada'],['subscription_active','Plan activado'],['payment_failed','Cobro rechazado'],['subscription_canceled','Baja confirmada'],['plan_expired','Pasó a Gratis'],['price_increase','Aumento por dólar'],['weekly_summary','Resumen semanal'],['customer_data_request','Pedido de datos'],['withdrawal','Arrepentimiento']] as const;

const DAY=24*60*60*1000;
const planName=(id:string|null)=>PLAN_NAMES[id||'free']||(id||'free');
const date=(iso:string|null)=>iso?new Intl.DateTimeFormat('es-AR',{day:'numeric',month:'short',year:'numeric'}).format(new Date(iso)):'—';
const daysUntil=(iso:string|null)=>iso?Math.ceil((new Date(iso).getTime()-Date.now())/DAY):null;
function ago(iso:string) {
  const days=Math.floor((Date.now()-new Date(iso).getTime())/DAY);
  if (days<1) return 'hoy';
  if (days===1) return 'ayer';
  if (days<14) return `hace ${days} días`;
  if (days<60) return `hace ${Math.round(days/7)} semanas`;
  return `hace ${Math.round(days/30)} meses`;
}

function kind(row:Row):Filter {
  if (row.provider==='complimentary') return 'complimentary';
  if (row.status==='trialing') return 'trial';
  if (row.status==='active') return 'paying';
  if (row.status==='past_due') return 'problem';
  return 'free';
}

// Una sola etiqueta que resume en qué está la tienda.
function situation(row:Row):{label:string;detail:string;tone:Tone} {
  const plan=planName(row.plan_id);
  switch (kind(row)) {
    case 'complimentary': return {label:`${plan} · sin cargo`,detail:'No paga y no vence',tone:'teal'};
    case 'trial': {
      const left=daysUntil(row.trial_ends_at);
      if (left===null) return {label:'Prueba gratis',detail:'Sin fecha de fin',tone:'amber'};
      if (left<=0) return {label:'Prueba gratis · terminó',detail:`Terminó el ${date(row.trial_ends_at)}`,tone:'red'};
      return {label:`Prueba gratis · ${left===1?'vence mañana':`vence en ${left} días`}`,detail:`Hasta el ${date(row.trial_ends_at)}`,tone:left<=3?'amber':'gray'};
    }
    case 'paying': return {label:`${plan} · pagando`,detail:row.current_period_end?`Se renueva el ${date(row.current_period_end)}`:'Suscripción activa',tone:'green'};
    case 'problem': return {label:`${plan} · cobro rechazado`,detail:'Mercado Pago no pudo cobrar',tone:'red'};
    default: return {label:row.status==='canceled'?'Canceló · Gratis':'Gratis',detail:row.status==='canceled'?'Dio de baja su plan':'Sin plan pago',tone:'gray'};
  }
}

const FILTERS:[Filter,string][]=[['all','Todas'],['trial','En prueba'],['paying','Pagando'],['complimentary','Sin cargo'],['free','Gratis'],['problem','Cobro rechazado']];

const css=`
.ad{min-height:100vh;background:#07111c;color:#e8f0f6;font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:36px 16px 60px}
.ad *{box-sizing:border-box}
.ad-box{max-width:1100px;margin:0 auto}
.ad h1{margin:0;font-size:28px;letter-spacing:-.02em}
.ad-sub{margin:4px 0 24px;color:#9bb0c3}
.ad-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
.ad-stat{padding:16px 18px;border:1px solid #1b3346;border-radius:16px;background:#0b1826}
.ad-stat b{display:block;font-size:30px;line-height:1.1;letter-spacing:-.02em}
.ad-stat span{color:#9bb0c3;font-size:13px}
.ad-stat i{display:inline-block;width:8px;height:8px;border-radius:99px;margin-right:7px}
.ad-bar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:14px}
.ad-input{padding:10px 12px;border-radius:10px;border:1px solid #294357;background:#08131f;color:#f4f8fb;font:inherit}
.ad-input:focus{outline:2px solid #21d4c2;outline-offset:1px}
.ad-search{flex:1 1 280px;max-width:380px}
.ad-chips{display:flex;gap:6px;flex-wrap:wrap}
.ad-chip{padding:7px 12px;border-radius:99px;border:1px solid #294357;background:transparent;color:#c4d3df;font:inherit;font-size:13px;cursor:pointer}
.ad-chip:hover{border-color:#3d5d75}
.ad-chip.on{background:#e8f0f6;color:#07111c;border-color:#e8f0f6;font-weight:600}
.ad-chip small{opacity:.65;margin-left:5px}
.ad-table{border:1px solid #1b3346;border-radius:16px;overflow:hidden;background:#0a1622}
.ad-row{display:grid;grid-template-columns:minmax(0,2.2fr) minmax(0,1.6fr) minmax(0,.9fr) auto;gap:16px;align-items:center;padding:14px 18px;border-top:1px solid #1b3346}
.ad-row.head{border-top:0;padding:10px 18px;color:#8ea6b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;background:#0b1826}
.ad-row:not(.head){cursor:pointer}
.ad-row:not(.head):hover{background:#0e1d2c}
.ad-store b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ad-store small{display:block;color:#8ea6b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ad-tag{display:inline-flex;align-items:center;gap:7px;padding:4px 10px;border-radius:99px;font-size:13px;font-weight:600;white-space:nowrap}
.ad-tag::before{content:"";width:7px;height:7px;border-radius:99px;background:currentColor}
.ad-tag.teal{background:#0f3532;color:#5fe8d9}.ad-tag.green{background:#103222;color:#5be08f}.ad-tag.amber{background:#3a2e0c;color:#ffd23f}.ad-tag.red{background:#3a1616;color:#ff8f80}.ad-tag.gray{background:#15222f;color:#a9bccb}
.ad-sit small{display:block;color:#8ea6b8;font-size:12px;margin-top:3px;padding-left:4px}
.ad-when{color:#c4d3df;font-size:14px}
.ad-btn{padding:8px 14px;border-radius:10px;border:1px solid #294357;background:#0f2232;color:#e8f0f6;cursor:pointer;font:inherit;font-size:13px;font-weight:600}
.ad-btn:hover:not(:disabled){border-color:#3d5d75;background:#132a3d}
.ad-btn:disabled{opacity:.55;cursor:default}
.ad-btn.primary{background:#21d4c2;color:#031513;border-color:#21d4c2}
.ad-btn.primary:hover:not(:disabled){background:#3ce0cf}
.ad-btn.danger{color:#ff9d90;border-color:#5a2a2a;background:transparent}
.ad-empty{padding:28px 18px;color:#9bb0c3;text-align:center}
.ad-alert{margin:0 0 14px;padding:12px 14px;border-radius:12px;background:#3a1616;color:#ffc2b8}
.ad-tools{margin-top:36px}
.ad-tools h2{font-size:15px;margin:0 0 10px;color:#c4d3df}
.ad-card{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:16px 18px;border:1px solid #1b3346;border-radius:16px;background:#0b1826}
.ad-card p{margin:0 0 4px;flex:1 1 100%;color:#9bb0c3;font-size:13px}
.ad-shade{position:fixed;inset:0;background:rgba(2,8,14,.6);z-index:20;animation:adFade .15s ease}
.ad-drawer{position:fixed;top:0;right:0;bottom:0;width:min(440px,100vw);background:#0b1826;border-left:1px solid #1b3346;z-index:21;overflow-y:auto;padding:24px 24px 40px;animation:adSlide .2s ease;box-shadow:-20px 0 60px rgba(0,0,0,.4)}
.ad-dHead{display:flex;gap:12px;align-items:flex-start;margin-bottom:18px}
.ad-dHead h2{margin:0;font-size:22px;letter-spacing:-.01em}
.ad-dHead p{margin:2px 0 0;color:#9bb0c3;font-size:14px;word-break:break-all}
.ad-dHead a{color:#7fe9dd}
.ad-x{margin-left:auto;flex:none;width:34px;height:34px;border-radius:10px;border:1px solid #294357;background:transparent;color:#c4d3df;font-size:18px;cursor:pointer}
.ad-sec{padding:18px 0;border-top:1px solid #1b3346}
.ad-sec h3{margin:0 0 10px;font-size:12px;color:#8ea6b8;text-transform:uppercase;letter-spacing:.07em}
.ad-sec p{margin:0 0 12px;color:#c4d3df;font-size:14px}
.ad-sec p.note{color:#9bb0c3;font-size:13px}
.ad-sec p.warn{padding:10px 12px;border-radius:10px;background:#3a2e0c;color:#ffe08a;font-size:13px}
.ad-kv{display:grid;grid-template-columns:auto 1fr;gap:8px 16px;font-size:14px}
.ad-kv dt{color:#8ea6b8}.ad-kv dd{margin:0}
.ad-ch{display:inline-flex;align-items:center;gap:6px;margin:0 10px 4px 0}
.ad-ch i{width:8px;height:8px;border-radius:99px}
.ad-inline{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
@keyframes adFade{from{opacity:0}}
@keyframes adSlide{from{transform:translateX(30px);opacity:0}}
@media (max-width:760px){
  .ad-stats{grid-template-columns:repeat(2,1fr)}
  .ad-row{grid-template-columns:minmax(0,1fr) auto;gap:8px 12px}
  .ad-row.head{display:none}
  .ad-sit{grid-column:1/-1;order:3}
  .ad-when{display:none}
}
`;

export default function AdminPage() {
  const [rows,setRows]=useState<Row[]|null>(null);
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState<Filter>('all');
  const [error,setError]=useState('');
  const [forbidden,setForbidden]=useState(false);
  const [busy,setBusy]=useState(false);
  const [openId,setOpenId]=useState<string|null>(null);
  const [grantPlan,setGrantPlan]=useState('enterprise');
  const [seatDraft,setSeatDraft]=useState('');
  const [saved,setSaved]=useState('');
  const [memberCap,setMemberCap]=useState(5);
  const [testKind,setTestKind]=useState('trial_ending');
  const [testState,setTestState]=useState('');

  const load=useCallback(async(q:string)=>{
    const response=await fetch(`/api/admin/accounts?q=${encodeURIComponent(q)}`,{cache:'no-store'});
    if (response.status===403) { setForbidden(true); setRows([]); return; }
    const data=await response.json().catch(()=>({})) as {accounts?:Row[];clerkMemberCap?:number};
    setRows(data.accounts||[]);
    if (data.clerkMemberCap) setMemberCap(data.clerkMemberCap);
  },[]);
  useEffect(()=>{ const timer=window.setTimeout(()=>void load(query),300); return ()=>window.clearTimeout(timer); },[query,load]);

  const counts=useMemo(()=>{
    const result:Record<Filter,number>={all:0,trial:0,paying:0,complimentary:0,free:0,problem:0};
    for (const row of rows||[]) { result.all++; result[kind(row)]++; }
    return result;
  },[rows]);
  const visible=useMemo(()=>(rows||[]).filter(row=>filter==='all'||kind(row)===filter),[rows,filter]);
  const open=rows?.find(row=>row.user_id===openId)||null;

  function openStore(row:Row) {
    setOpenId(row.user_id);setSaved('');setError('');
    setGrantPlan(row.plan_id&&row.plan_id!=='free'?row.plan_id:'enterprise');
    setSeatDraft(row.team_limit===null?'':String(row.team_limit));
  }
  useEffect(()=>{
    if (!openId) return;
    const onKey=(event:KeyboardEvent)=>{ if (event.key==='Escape') setOpenId(null); };
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[openId]);

  async function post(body:Record<string,unknown>) {
    setBusy(true);setError('');setSaved('');
    const response=await fetch('/api/admin/accounts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    setBusy(false);
    const data=await response.json().catch(()=>({})) as {error?:string};
    return {ok:response.ok,error:data.error};
  }

  async function grant(row:Row) {
    if (!window.confirm(`¿Darle ${planName(grantPlan)} sin cargo a ${row.store_name||row.email}?`)) return;
    const result=await post({userId:row.user_id,action:'grant',planId:grantPlan});
    if (!result.ok) { setError('No se pudo dar el plan. Probá de nuevo.'); return; }
    setSaved(`Listo: ${row.store_name||'la tienda'} tiene ${planName(grantPlan)} sin cargo.`);
    void load(query);
  }
  async function revoke(row:Row) {
    if (!window.confirm(`¿Quitarle el plan sin cargo a ${row.store_name||row.email}? Pasa a Gratis y conserva sus datos.`)) return;
    const result=await post({userId:row.user_id,action:'revoke'});
    if (!result.ok) { setError('No se pudo quitar el plan. Probá de nuevo.'); return; }
    setSaved('Listo: la tienda pasó a Gratis.');
    void load(query);
  }
  async function saveSeats(row:Row) {
    const raw=seatDraft.trim();
    const value=raw===''?null:Number(raw);
    if (value!==null&&(!Number.isInteger(value)||value<1||value>500)) { setError('Poné un número entero entre 1 y 500, o dejalo vacío.'); return; }
    const result=await post({userId:row.user_id,action:'seats',seats:value});
    if (!result.ok) { setError(result.error==='store_not_linked'?'Esa tienda todavía no tiene equipo: el dueño tiene que entrar una vez con email o Google.':'No se pudieron guardar los lugares.'); return; }
    setSaved(value===null?'Listo: quedó sin lugares definidos.':`Listo: ${value} ${value===1?'persona':'personas'} pueden entrar a la tienda.`);
    void load(query);
  }
  async function sendTest() {
    setTestState('Enviando…');
    const response=await fetch('/api/admin/test-email',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:testKind})});
    const data=await response.json().catch(()=>({})) as {sent?:boolean;reason?:string};
    setTestState(data.sent?'Listo: revisá tu bandeja de entrada.':`No se pudo mandar (${data.reason||response.status}).`);
  }

  if (forbidden) return <main className="ad"><style>{css}</style><div className="ad-box"><h1>Administración</h1><p className="ad-sub">No tenés acceso a esta página. Entrá a Rentia con el email de un dueño y volvé a abrirla.</p></div></main>;

  const stats:[string,number,string][]=[['Tiendas',counts.all,'#8ea6b8'],['En prueba',counts.trial,'#ffd23f'],['Pagando',counts.paying,'#5be08f'],['Sin cargo',counts.complimentary,'#5fe8d9']];

  return <main className="ad"><style>{css}</style><div className="ad-box">
    <h1>Administración</h1>
    <p className="ad-sub">Las tiendas que usan Rentia, en qué plan están y quién puede entrar.</p>

    <div className="ad-stats">{stats.map(([label,value,color])=><div className="ad-stat" key={label}><b>{rows===null?'…':value}</b><span><i style={{background:color}}/>{label}</span></div>)}</div>

    <div className="ad-bar">
      <input className="ad-input ad-search" placeholder="Buscar por tienda, dueño o email" value={query} onChange={event=>setQuery(event.target.value)} aria-label="Buscar tiendas"/>
      <div className="ad-chips" role="group" aria-label="Filtrar tiendas">{FILTERS.filter(([id])=>id==='all'||counts[id]>0||filter===id).map(([id,label])=><button type="button" key={id} className={`ad-chip ${filter===id?'on':''}`} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}<small>{counts[id]}</small></button>)}</div>
    </div>

    {error&&!open&&<p role="alert" className="ad-alert">{error}</p>}

    <div className="ad-table">
      <div className="ad-row head"><span>Tienda</span><span>Situación</span><span>Alta</span><span/></div>
      {rows===null?<div className="ad-empty">Cargando…</div>:visible.length===0?<div className="ad-empty">{query||filter!=='all'?'No hay tiendas con ese filtro.':'Todavía no hay tiendas.'}</div>:
      visible.map(row=>{const info=situation(row);return <div className="ad-row" key={row.user_id} onClick={()=>openStore(row)}>
        <div className="ad-store"><b>{row.store_name||'Sin nombre'}</b><small>{[row.owner_name,row.email].filter(Boolean).join(' · ')}</small></div>
        <div className="ad-sit"><span className={`ad-tag ${info.tone}`}>{info.label}</span><small>{info.detail}</small></div>
        <div className="ad-when" title={date(row.created_at)}>{ago(row.created_at)}</div>
        <button type="button" className="ad-btn" onClick={event=>{event.stopPropagation();openStore(row);}}>Gestionar</button>
      </div>;})}
    </div>

    <section className="ad-tools">
      <h2>Herramientas</h2>
      <div className="ad-card">
        <p>Mandate a vos mismo cualquiera de los mails que reciben las tiendas, para ver cómo llegan.</p>
        <select className="ad-input" value={testKind} onChange={event=>setTestKind(event.target.value)} aria-label="Mail de prueba">{TEST_EMAILS.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select>
        <button type="button" className="ad-btn" onClick={()=>void sendTest()}>Mandarme este mail</button>
        <span style={{color:'#9bb0c3',fontSize:13}}>{testState}</span>
      </div>
    </section>
  </div>

  {open&&<StoreDrawer row={open} busy={busy} error={error} saved={saved} memberCap={memberCap} grantPlan={grantPlan} setGrantPlan={setGrantPlan} seatDraft={seatDraft} setSeatDraft={setSeatDraft} onGrant={()=>void grant(open)} onRevoke={()=>void revoke(open)} onSeats={()=>void saveSeats(open)} onClose={()=>setOpenId(null)}/>}
  </main>;
}

function StoreDrawer({row,busy,error,saved,memberCap,grantPlan,setGrantPlan,seatDraft,setSeatDraft,onGrant,onRevoke,onSeats,onClose}:{row:Row;busy:boolean;error:string;saved:string;memberCap:number;grantPlan:string;setGrantPlan:(value:string)=>void;seatDraft:string;setSeatDraft:(value:string)=>void;onGrant:()=>void;onRevoke:()=>void;onSeats:()=>void;onClose:()=>void}) {
  const info=situation(row);
  const type=kind(row);
  const channels=(row.channels||'').split(',').filter(Boolean);
  const draftNumber=Number(seatDraft);
  return <>
    <div className="ad-shade" onClick={onClose}/>
    <aside className="ad-drawer" role="dialog" aria-modal="true" aria-label={`Tienda ${row.store_name||row.email}`}>
      <div className="ad-dHead"><div><h2>{row.store_name||'Sin nombre'}</h2><p>{row.owner_name?`${row.owner_name} · `:''}<a href={`mailto:${row.email}`}>{row.email}</a></p></div><button type="button" className="ad-x" onClick={onClose} aria-label="Cerrar">×</button></div>
      <span className={`ad-tag ${info.tone}`}>{info.label}</span>
      <p style={{margin:'8px 0 18px',color:'#9bb0c3',fontSize:14}}>{info.detail}</p>

      {error&&<p role="alert" className="ad-alert">{error}</p>}
      {saved&&<p role="status" className="ad-alert" style={{background:'#0f3532',color:'#9ff3e9'}}>{saved}</p>}

      <section className="ad-sec">
        <h3>Datos</h3>
        <dl className="ad-kv">
          <dt>Alta</dt><dd>{date(row.created_at)} <span style={{color:'#8ea6b8'}}>({ago(row.created_at)})</span></dd>
          <dt>Canales</dt><dd>{channels.length?channels.map(id=>{const [label,color]=CHANNELS[id]||[id,'#a78bfa'];return <span className="ad-ch" key={id}><i style={{background:color}}/>{label}</span>;}):<span style={{color:'#8ea6b8'}}>Todavía no conectó ninguno</span>}</dd>
        </dl>
      </section>

      <section className="ad-sec">
        <h3>Plan sin cargo</h3>
        {type==='complimentary'?<>
          <p>Tiene <b>{planName(row.plan_id)}</b> regalado: no pasa por Mercado Pago y no vence.</p>
          <button type="button" className="ad-btn danger" disabled={busy} onClick={onRevoke}>Quitar el plan sin cargo</button>
          <p className="note" style={{marginTop:10}}>Si lo quitás, pasa a Gratis. No se borra ningún dato.</p>
        </>:<>
          <p>Le das un plan completo sin cobrarle. No pasa por Mercado Pago y no vence hasta que lo quites.</p>
          {(type==='paying'||type==='problem')&&<p className="warn">Esta tienda tiene una suscripción en Mercado Pago. Darle un plan sin cargo no la cancela allá: cancelala primero para que no se le siga cobrando.</p>}
          <div className="ad-inline">
            <select className="ad-input" value={grantPlan} onChange={event=>setGrantPlan(event.target.value)} aria-label="Plan a regalar">{GRANTABLE.map(id=><option key={id} value={id}>{PLAN_NAMES[id]}</option>)}</select>
            <button type="button" className="ad-btn primary" disabled={busy} onClick={onGrant}>Dar sin cargo</button>
          </div>
        </>}
      </section>

      <section className="ad-sec">
        <h3>Equipo</h3>
        {row.plan_id!=='enterprise'?<p className="note">Los lugares vienen con el plan ({planName(row.plan_id)}). Solo en Enterprise los definís vos.</p>
        :!row.organization_id?<p className="note">Todavía no se puede: el dueño tiene que entrar una vez a Rentia con su email o con Google. Después aparece acá.</p>
        :<>
          <p>{row.team_limit===null?<>Todavía no tiene lugares definidos, así que <b>no puede invitar a nadie</b>.</>:<>Pueden entrar <b>{row.team_limit} {row.team_limit===1?'persona':'personas'}</b>, contando al dueño.</>}</p>
          <div className="ad-inline">
            <input className="ad-input" style={{width:90}} type="number" min={1} max={500} placeholder="—" value={seatDraft} onChange={event=>setSeatDraft(event.target.value)} aria-label="Cantidad de personas"/>
            <span style={{color:'#9bb0c3',fontSize:14}}>personas</span>
            <button type="button" className="ad-btn primary" disabled={busy||seatDraft.trim()===(row.team_limit===null?'':String(row.team_limit))} onClick={onSeats}>Guardar</button>
          </div>
          <p className="note" style={{marginTop:10}}>El dueño cuenta como una. Dejalo vacío para que no pueda invitar.</p>
          {draftNumber>memberCap&&<p className="warn">Con el plan actual de Clerk entran como máximo {memberCap} personas por tienda. Podés guardar {draftNumber}, pero no van a poder entrar más de {memberCap} hasta ampliarlo.</p>}
        </>}
      </section>
    </aside>
  </>;
}
