'use client';

import { FormEvent, useState } from 'react';
import type { AlertSettings } from '../../lib/alerts';

// Umbrales de alertas de la tienda. Los cambia el propietario o un administrador.
export default function AlertSettingsCard({settings,canManage,onSaved}:{settings:AlertSettings;canManage:boolean;onSaved:(settings:AlertSettings)=>void}) {
  const [draft,setDraft]=useState(settings);
  const numericKeys=['marginMin','marginDrop','salesDrop','stockDays','campaignMinSpend'] as const;
  const [texts,setTexts]=useState<Record<string,string>>(()=>Object.fromEntries(numericKeys.map(key=>[key,String(settings[key]).replace('.',',')])));
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');
  const number=(key:typeof numericKeys[number])=>({value:texts[key]??'',onChange:(event:React.ChangeEvent<HTMLInputElement>)=>setTexts(current=>({...current,[key]:event.target.value.replace(/[^0-9.,]/g,'')})),inputMode:'decimal' as const,disabled:!canManage});
  async function save(event:FormEvent) {
    event.preventDefault();if(!canManage||saving)return;setSaving(true);setMessage('');
    const parsed={...draft};
    for(const key of numericKeys){const value=Number((texts[key]||'0').replace(',','.'));if(!Number.isFinite(value)){setSaving(false);setMessage('Revisá los números: usá solo cifras.');return;}parsed[key]=key==='stockDays'?Math.round(value):value;}
    try {
      const response=await fetch('/api/alerts/settings',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(parsed)});
      const data=await response.json() as {settings?:AlertSettings};
      if(!response.ok||!data.settings)throw new Error();
      onSaved(data.settings);setDraft(data.settings);setTexts(Object.fromEntries(numericKeys.map(key=>[key,String(data.settings![key]).replace('.',',')])));setMessage('Alertas guardadas.');
    } catch {setMessage('No pudimos guardar las alertas. Revisá los valores e intentá de nuevo.');}
    finally {setSaving(false);}
  }
  return <form className="p-card p-reveal p-alertSettings" onSubmit={save}>
    <div className="p-cardHead"><div><span className="p-eyebrowS">CONFIGURACIÓN</span><h3>Cuándo avisarte</h3><span className="p-sub">Las alertas aparecen en la campana de arriba y en esta página.</span></div></div>
    <div className="p-alertGrid">
      <label>Margen mínimo<span><input {...number('marginMin')} aria-label="Margen mínimo en porcentaje"/>%</span><small>Avisar si el margen real queda por debajo.</small></label>
      <label>Caída de margen<span><input {...number('marginDrop')} aria-label="Caída de margen en puntos"/>pts</span><small>Frente al período anterior.</small></label>
      <label>Caída de ventas<span><input {...number('salesDrop')} aria-label="Caída de ventas en porcentaje"/>%</span><small>Frente al período anterior.</small></label>
      <label>Stock mínimo<span><input {...number('stockDays')} aria-label="Días de stock mínimo"/>días</span><small>Avisar cuando el stock alcance para menos días.</small></label>
      <label>Inversión mínima por campaña<span><input {...number('campaignMinSpend')} aria-label="Inversión mínima por campaña"/></span><small>Ignorar campañas que gastaron menos (en tu moneda).</small></label>
    </div>
    <div className="p-alertEmails">
      <label className="p-check"><input type="checkbox" checked={draft.alertEmail} disabled={!canManage} onChange={event=>setDraft(current=>({...current,alertEmail:event.target.checked}))}/><span><b>Recibir las alertas urgentes por email</b></span></label>
      <label className="p-check"><input type="checkbox" checked={draft.weeklyEmail} disabled={!canManage} onChange={event=>setDraft(current=>({...current,weeklyEmail:event.target.checked}))}/><span><b>Recibir el resumen semanal cada lunes</b></span></label>
      <p className="p-sub" style={{margin:0}}>Los envíos por email se activan próximamente: guardamos tu preferencia y podés desactivarlos cuando quieras desde acá o desde cada email.</p>
    </div>
    <div style={{display:'flex',alignItems:'center',gap:12,marginTop:12}}>{canManage&&<button type="submit" className="p-btn p-primary" disabled={saving}>{saving?'Guardando…':'Guardar alertas'}</button>}{message&&<span className="p-sub" role="status">{message}</span>}{!canManage&&<span className="p-sub">Solo el propietario o un administrador pueden cambiar las alertas.</span>}</div>
  </form>;
}
