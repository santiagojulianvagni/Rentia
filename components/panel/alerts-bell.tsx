'use client';

import { Bell, CheckCheck, X } from 'lucide-react';
import { alertKey, urgentAlerts, type BusinessAlert } from '../../lib/alerts';

const tone:Record<BusinessAlert['kind'],string>={danger:'r',warning:'a',info:'b',success:'g'};
export type AlertReads=Record<string,'seen'|'dismissed'>;

// Campana de la barra superior. El número cuenta solo las alertas nuevas; cada persona puede
// marcarlas como vistas u ocultarlas, y vuelven a aparecer si la situación cambia.
export default function AlertsBell({alerts,reads,open,onToggle,onClose,onMark,onNavigate}:{alerts:BusinessAlert[];reads:AlertReads;open:boolean;onToggle:()=>void;onClose:()=>void;onMark:(keys:string[],state:'seen'|'dismissed')=>void;onNavigate:(section:string)=>void}) {
  const visible=urgentAlerts(alerts).filter(alert=>reads[alertKey(alert)]!=='dismissed');
  const unseen=visible.filter(alert=>!reads[alertKey(alert)]);
  const hidden=urgentAlerts(alerts).length-visible.length;
  return <div className="p-ctrl">
    <button type="button" className="p-ctrlBtn p-bellBtn" onClick={onToggle} aria-expanded={open} aria-label={unseen.length?`${unseen.length} alertas nuevas`:'Alertas'}>
      <Bell className="p-i" aria-hidden="true"/>{unseen.length>0&&<span className="p-bellCount">{unseen.length>9?'9+':unseen.length}</span>}
    </button>
    <div className={`p-menu p-wide p-alertsMenu ${open?'p-open':''}`} role="dialog" aria-label="Alertas">
      <div className="p-alertsHead">
        <b>Alertas</b>
        {unseen.length>0&&<button type="button" className="p-alertsAll" onClick={()=>onMark(unseen.map(alertKey),'seen')}><CheckCheck className="p-i" aria-hidden="true"/>Marcar todas como vistas</button>}
        <button type="button" className="p-alertsClose" onClick={onClose} aria-label="Cerrar alertas"><X className="p-i" aria-hidden="true"/></button>
      </div>
      {visible.length?visible.slice(0,8).map(alert=>{const key=alertKey(alert),isNew=!reads[key];return <div key={key} className={`p-alertItem ${isNew?'p-new':''}`}>
        <button type="button" className="p-alertOpen" onClick={()=>{onMark([key],'seen');onNavigate(alert.section);}}>
          <span className={`p-aic p-tone-${tone[alert.kind]}`}>{alert.icon}</span><span><b>{alert.title}</b><small>{alert.detail}</small></span>
        </button>
        <button type="button" className="p-alertHide" onClick={()=>onMark([key],'dismissed')} aria-label={`Ocultar: ${alert.title}`} title="Ocultar"><X className="p-i" aria-hidden="true"/></button>
      </div>;}):<p className="p-sub" style={{padding:'8px 10px',margin:0}}>{hidden?'Ocultaste todas las alertas. Si algo cambia, te volvemos a avisar.':'No hay alertas con los datos actuales.'}</p>}
      <hr/><button type="button" onClick={()=>onNavigate('acciones')}><span>Ver todas y configurar alertas</span></button>
    </div>
  </div>;
}
