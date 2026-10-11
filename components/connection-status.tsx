'use client';

import {CircleCheck,CloudDownload,TriangleAlert} from 'lucide-react';
import type {ConnectionHealth} from '../lib/connection-health';

export function ConnectionStatus({health,onOpen,translate=(value:string)=>value}:{health:ConnectionHealth;onOpen:()=>void;translate?:(value:string)=>string}) {
  return <button type="button" className={`sidebarSync connectionStatus ${health.tone}`} onClick={onOpen} title={`${translate(health.label)}. ${health.detail}`} aria-label={`${translate(health.label)}. ${health.detail} ${translate('Ver conexiones')}`}><i aria-hidden="true"/><span>{translate(health.label)}</span></button>;
}

export function ConnectionNotice({health,onOpen}:{health:ConnectionHealth;onOpen:()=>void}) {
  if(!health.notice)return null;
  const {kind,title,message}=health.notice;
  const Icon=kind==='import'?CloudDownload:TriangleAlert;
  return <div className={`p-notice p-${kind}`} role={kind==='warning'?'alert':'status'}><Icon className="p-i" aria-hidden="true"/><div><b>{title}</b><p>{message}</p></div><button type="button" className="p-btn p-small" onClick={onOpen}>Ver conexiones</button></div>;
}

export function ConnectionUpdatedAt({value}:{value:string|null|undefined}) {
  if(!value||!Number.isFinite(Date.parse(value)))return null;
  return <small className="connectionUpdatedAt"><CircleCheck size={14} aria-hidden="true"/>Última actualización: {new Date(value).toLocaleString('es-AR')}</small>;
}
