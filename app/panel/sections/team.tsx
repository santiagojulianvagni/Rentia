'use client';

import RpSelect from '../../../components/panel/rp-select';
import { confirmDialog } from '../../../components/panel/rp-confirm';
import { FormEvent, useEffect, useState } from 'react';
import { Mail, Plus, Settings2, ShieldCheck, UsersRound } from 'lucide-react';
import type { TeamCapacity } from '../../../lib/team-capacity';

type TeamMember={userId:string;name:string;email:string;imageUrl?:string;role:string;roleLabel:string;owner:boolean;createdAt:number|null};
type TeamInvitation={id:string;email:string;role:string;roleLabel:string;status:string;createdAt:number;expiresAt:number};
type TeamData={members:TeamMember[];invitations:TeamInvitation[];canManage:boolean;currentRole:'owner'|'admin'|'member';currentUserId?:string;transition?:boolean;capacity:TeamCapacity};
const teamRoles=[
  {value:'org:member',label:'Miembro · consulta',description:'Ve datos y exporta informes. No cambia la tienda.'},
  {value:'org:admin',label:'Administrador · gestión',description:'Edita costos, conexiones y equipo. No modifica al propietario.'},
];
const teamErrors:Record<string,string>={
  forbidden:'Tu acceso no permite gestionar el equipo.',
  team_limit_reached:'El cupo está completo. Cancelá una invitación pendiente o revisá los planes.',
  team_provider_limit:'Por ahora cada tienda puede tener hasta 5 personas. Pronto ampliamos el cupo; mientras tanto, cancelá una invitación pendiente para sumar a alguien.',
  team_limit_unconfigured:'El cupo de Enterprise debe acordarse antes de invitar.',
  team_busy:'Hay otra invitación en proceso. Esperá y actualizá el equipo antes de reintentar.',
  already_invited:'Ese correo ya pertenece al equipo o tiene una invitación pendiente.',
  invalid_data:'Revisá el correo y el rol de la invitación.',
  invalid_email:'Ingresá un correo electrónico válido.',
  invitation_status_unknown:'No pudimos confirmar el envío. Revisá las invitaciones pendientes antes de volver a invitar; puede haberse enviado.',
  owner_is_protected:'El propietario principal no se puede modificar ni quitar.',
  self_role_is_protected:'Tu propio rol debe modificarlo otro administrador.',
  self_removal_is_protected:'No podés quitar tu propio acceso desde esta pantalla.',
};

export function TeamSection({onPlans}:{onPlans:()=>void}) {
  const [data,setData]=useState<TeamData|null>(null);
  const [email,setEmail]=useState('');
  const [role,setRole]=useState('org:member');
  const [message,setMessage]=useState('');
  const [working,setWorking]=useState(false);
  const [loadError,setLoadError]=useState(false);
  async function loadTeam() {
    try {
      const response=await fetch('/api/team',{cache:'no-store',signal:AbortSignal.timeout(20000)});
      if(!response.ok)throw new Error('load');
      setData(await response.json());setLoadError(false);
    }catch{setLoadError(true);}
  }
  useEffect(()=>{queueMicrotask(()=>void loadTeam());},[]);
  async function mutate(method:string,body:Record<string,string>,success:string) {
    setWorking(true);setMessage('Procesando…');
    try {
      const response=await fetch('/api/team',{method,headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
      const result=await response.json().catch(()=>({})) as {error?:string};
      if(response.ok){if(method==='POST')setEmail('');setMessage(success);}
      else setMessage(teamErrors[result.error||'']||'No pudimos confirmar el cambio. Actualizá el equipo antes de reintentar.');
      await loadTeam();
    }catch{setMessage('No pudimos confirmar la operación. Revisá el equipo antes de reintentar; una invitación puede haberse enviado.');await loadTeam();}
    finally{setWorking(false);}
  }
  function invite(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(!data?.capacity.remaining||working)return;
    void mutate('POST',{email,role},'Invitación enviada. Reservamos su lugar durante 14 días.');
  }
  const full=Boolean(data&&(data.capacity.limit===null||data.capacity.remaining===0));
  const myRole=data?.currentRole==='owner'?'Propietario':data?.currentRole==='admin'?'Administrador':'Consulta';
  return <section className="p-team">
    <div className="p-head"><div><div className="p-eyebrow">ORGANIZACIÓN</div><h1>Equipo y <em>accesos</em></h1><p>Una tienda compartida, con accesos individuales. Tu rol: <b>{data?myRole:'Cargando…'}</b>.</p></div>{data?.canManage&&<div className="p-actions"><button type="button" className="p-btn p-primary" disabled={full||working||loadError||data.transition} onClick={()=>document.getElementById('team-email')?.focus()}><Plus className="p-i" aria-hidden="true"/>Invitar persona</button></div>}</div>
    <div className="p-grid p-g3" style={{marginBottom:16}}>{([['Miembros activos',data?.capacity.active??'—','Incluye al propietario'],['Invitaciones pendientes',data?.capacity.pending??'—','Reservan un lugar por 14 días'],[`Cupo de ${data?.capacity.planName||'tu plan'}`,data?`${data.capacity.used} / ${data.capacity.limit??'A medida'}`:'—',data?data.capacity.limit===null?'Se acuerda con Rentia':data.capacity.remaining>0?`${data.capacity.remaining} lugar${data.capacity.remaining===1?'':'es'} disponible${data.capacity.remaining===1?'':'s'}`:'Sin lugares disponibles':'Consultando cupo…']] as const).map(([label,value,detail],index)=><div className="p-card p-kpi p-reveal" style={{'--i':index} as React.CSSProperties} key={label}><small>{label}</small><b className="p-mono">{value}</b><span className="p-sub" style={{fontSize:11.5}}>{detail}</span></div>)}</div>
    {loadError&&<div className="p-note p-warn" role="alert">No pudimos actualizar el equipo. No envíes otra invitación sin verificar las pendientes. <button type="button" className="p-btn p-small" onClick={()=>void loadTeam()}>Reintentar</button></div>}
    {data?.transition&&<div className="p-note">Ingresá con email o Google para vincular tu acceso y habilitar el equipo, sin perder los datos de esta tienda.</div>}
    {data?.capacity.limit===null&&!data.transition&&<div className="p-note"><b>Cupo a medida.</b> En Enterprise la cantidad de personas se define con Rentia. Escribinos a <a href="mailto:hola@rentiaapp.com">hola@rentiaapp.com</a> y lo habilitamos.</div>}
    {full&&data?.capacity.limit!==null&&<div className="p-note p-warn"><b>{data?.capacity.overLimit?'Tu equipo actual supera el cupo.':'Cupo de equipo completo.'}</b> {data?.capacity.overLimit?'Nadie pierde su acceso. No se pueden sumar nuevas personas hasta liberar un lugar o activar otro plan.':'El propietario, los miembros y las invitaciones pendientes cuentan. Una preferencia de plan no amplía el cupo hasta que el plan esté activo.'} <button type="button" className="p-btn p-small" onClick={onPlans}>Ver planes</button></div>}
    <div className="p-grid p-g3" style={{marginBottom:16}}>{([[ShieldCheck,'Propietario','Gestiona toda la tienda. Su rol y acceso están protegidos.'],[Settings2,'Administrador','Edita costos, integraciones, configuración y equipo. No puede quitar al propietario.'],[UsersRound,'Miembro · consulta','Ve ventas, rentabilidad y campañas; exporta informes. No edita ni invita.']] as const).map(([Icon,title,detail],index)=><div className="p-card p-reveal p-roleCard" style={{'--i':index} as React.CSSProperties} key={title}><Icon className="p-i" aria-hidden="true"/><div><b>{title}</b><p className="p-sub">{detail}</p></div></div>)}</div>
    {data?.canManage&&!data.transition&&<form className="p-card p-reveal p-inviteForm" onSubmit={invite}><div><span className="p-eyebrowS">NUEVA INVITACIÓN</span><h3 style={{margin:'4px 0'}}>Sumar una persona</h3><p className="p-sub" style={{margin:0}}>{full?'Liberá un lugar antes de invitar.':'Recibirá un email para entrar con su propia cuenta.'}</p></div><label className="p-field"><span className="p-fieldLabel">Email</span><span className="p-input"><input id="team-email" type="email" value={email} disabled={working||full||loadError} onChange={event=>setEmail(event.target.value)} placeholder="persona@mitienda.com" required/></span></label><label className="p-field"><span className="p-fieldLabel">Rol de acceso</span><span className="p-input"><RpSelect value={role} onChange={event=>setRole(event.target.value)} disabled={working||full||loadError}>{teamRoles.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</RpSelect></span></label><button className="p-btn p-primary" disabled={working||full||loadError}>{working?'Procesando…':'Enviar invitación'}</button></form>}
    {message&&<div className="p-note" role="status" style={{marginTop:16}}>{message}</div>}
    <div className="p-card p-reveal" style={{margin:'16px 0'}}><div className="p-cardHead"><div><h3>Miembros <span className="p-chip p-n">{data?.members.length||0}</span></h3></div><span className="p-sub">Los permisos se verifican en el servidor.</span></div>
      {!data?<div className="p-empty">{loadError?'Equipo no disponible.':'Cargando equipo…'}</div>:data.members.map(member=><div className="p-memberRow" key={member.userId}><span className="p-avatarSq" style={member.imageUrl?{backgroundImage:`url(${member.imageUrl})`,backgroundSize:'cover'}:undefined}>{member.imageUrl?'':member.name.slice(0,1).toUpperCase()}</span><span className="p-who"><b>{member.name}{member.userId===data.currentUserId&&<small className="p-chip p-c" style={{marginLeft:6}}>Vos</small>}</b><small>{member.email}</small></span><span className={`p-chip ${member.owner?'p-c':'p-n'}`}>{member.owner?'Propietario':member.roleLabel}</span><span className="p-sub">{member.createdAt?new Date(member.createdAt).toLocaleDateString('es-AR'):'Cuenta original'}</span>{data.canManage&&!member.owner&&member.userId!==data.currentUserId?<span className="p-actions"><span className="p-input" style={{height:34,width:210}}><RpSelect aria-label={`Cambiar rol de ${member.name}`} value={member.role} disabled={working||loadError} onChange={event=>{const nextRole=event.target.value;void confirmDialog({title:`¿Cambiar el acceso de ${member.name}?`,message:`Pasará a ${nextRole==='org:admin'?'Administrador · gestión':'Miembro · consulta'}.`,confirmLabel:'Cambiar acceso'}).then(ok=>{if(ok)void mutate('PATCH',{userId:member.userId,role:nextRole},'Permisos actualizados.');});}}>{teamRoles.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</RpSelect></span><button type="button" className="p-btn p-small p-ghost" onClick={()=>{void confirmDialog({title:`¿Quitar el acceso de ${member.name}?`,message:'Dejará de ver esta tienda en Rentia. Podés volver a invitarlo cuando quieras.',confirmLabel:'Quitar acceso',danger:true}).then(ok=>{if(ok)void mutate('DELETE',{userId:member.userId},'Acceso quitado del equipo.');});}} disabled={working||loadError}>Quitar</button></span>:<span className="p-sub">{member.owner?'Acceso protegido':'—'}</span>}</div>)}
    </div>
    {!!data?.invitations.length&&<div className="p-card p-reveal"><div className="p-cardHead"><h3>Invitaciones pendientes <span className="p-chip p-n">{data.invitations.length}</span></h3></div>{data.invitations.map(invitation=><div className="p-memberRow" key={invitation.id}><span className="p-avatarSq p-pending"><Mail className="p-i" aria-hidden="true"/></span><span className="p-who"><b>{invitation.email}</b><small>Enviada {new Date(invitation.createdAt).toLocaleDateString('es-AR')}</small></span><span className="p-chip p-n">{invitation.roleLabel}</span><span className="p-sub">Vence {new Date(invitation.expiresAt).toLocaleDateString('es-AR')}</span>{data.canManage?<button type="button" className="p-btn p-small p-ghost" onClick={()=>{void confirmDialog({title:'¿Cancelar esta invitación?',message:'Se libera su lugar en el equipo.',confirmLabel:'Cancelar invitación',cancelLabel:'Volver',danger:true}).then(ok=>{if(ok)void mutate('DELETE',{invitationId:invitation.id},'Invitación cancelada. Su lugar está disponible.');});}} disabled={working||loadError}>Cancelar</button>:<span/>}</div>)}</div>}
  </section>;
}

