'use client';

import { Bell } from 'lucide-react';
import { urgentAlerts, type BusinessAlert } from '../../lib/alerts';

const tone:Record<BusinessAlert['kind'],string>={danger:'r',warning:'a',info:'b',success:'g'};

// Campana de la barra superior: muestra las alertas urgentes del período elegido.
export default function AlertsBell({alerts,open,onToggle,onNavigate}:{alerts:BusinessAlert[];open:boolean;onToggle:()=>void;onNavigate:(section:string)=>void}) {
  const urgent=urgentAlerts(alerts);
  return <div className="p-ctrl">
    <button type="button" className="p-ctrlBtn p-bellBtn" onClick={onToggle} aria-expanded={open} aria-label={urgent.length?`${urgent.length} alertas`:'Sin alertas'}>
      <Bell className="p-i" aria-hidden="true"/>{urgent.length>0&&<span className="p-bellCount">{urgent.length>9?'9+':urgent.length}</span>}
    </button>
    <div className={`p-menu p-wide p-alertsMenu ${open?'p-open':''}`}>
      <small className="p-menuCap">ALERTAS DEL PERÍODO</small>
      {urgent.length?urgent.slice(0,6).map(alert=><button type="button" key={alert.id} onClick={()=>onNavigate(alert.section)}>
        <span className={`p-aic p-tone-${tone[alert.kind]}`}>{alert.icon}</span><span><b>{alert.title}</b><small>{alert.detail}</small></span>
      </button>):<p className="p-sub" style={{padding:'6px 10px',margin:0}}>No hay alertas con los datos actuales.</p>}
      <hr/><button type="button" onClick={()=>onNavigate('acciones')}><span>Ver todas y configurar alertas</span></button>
    </div>
  </div>;
}
