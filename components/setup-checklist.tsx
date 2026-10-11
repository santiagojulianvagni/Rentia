'use client';

import { useState } from 'react';
import { Check, ChevronDown, PlugZap, PackageCheck, SlidersHorizontal, Megaphone } from 'lucide-react';

type Props={connected:boolean;productCount:number;missingProductCosts:number;costsConfigured:boolean;adsConnected:boolean;canManage:boolean;onNavigate:(section:string)=>void};

export default function SetupChecklist(props:Props) {
  const steps=[
    {id:'integraciones',title:'Conectá tu tienda',description:'Importá tus ventas y productos de Tiendanube.',done:props.connected,icon:PlugZap,action:'Ver conexión'},
    {id:'costos',title:'Revisá tus productos',description:props.productCount?`${props.missingProductCosts} de ${props.productCount} variantes sin costo identificado.`:'Primero sincronizá para traer tus productos.',done:props.productCount>0&&props.missingProductCosts===0,icon:PackageCheck,action:'Ver costos'},
    {id:'configuracion',title:'Definí tus costos',description:'Revisá envío, comisiones e impuestos y guardá la configuración.',done:props.costsConfigured,icon:SlidersHorizontal,action:'Revisar configuración'},
    {id:'publicidad',title:'Sumá tu publicidad',description:'Conectá Meta y elegí la cuenta que corresponde a esta tienda.',done:props.adsConnected,icon:Megaphone,action:'Ver publicidad',optional:true},
  ];
  const complete=steps.filter(step=>step.done).length;
  const [expanded,setExpanded]=useState<boolean|null>(null);
  const open=expanded??true;
  if(complete===steps.length)return null;
  return <section className="p-card p-reveal p-setup" aria-label="Configuración guiada">
    <div className="p-cardHead">
      <div><span className="p-eyebrowS">CONFIGURACIÓN GUIADA</span><h3>Completá la base de tu rentabilidad</h3>{!props.canManage&&<span className="p-sub">Podés revisar los pasos; para completar cambios, pedile ayuda al propietario o a un administrador.</span>}</div>
      <div className="p-actions"><b className="p-mono">{complete}<small className="p-sub">/4</small></b><button type="button" className="p-btn p-ghost p-small" onClick={()=>setExpanded(!open)} aria-expanded={open} aria-controls="setup-checklist-steps">{open?'Ocultar':'Ver pasos'}<ChevronDown className="p-i" style={{transform:open?'rotate(180deg)':undefined}} aria-hidden="true"/></button></div>
    </div>
    <div className="p-progressLine"><i style={{width:`${complete/steps.length*100}%`}}/></div>
    {open&&<div className="p-checklist" id="setup-checklist-steps">{steps.map((step,index)=><button type="button" className={`p-task ${step.done?'p-done':''}`} key={`${step.id}-${index}`} onClick={()=>props.onNavigate(step.id)}>
      <i>{step.done?<Check size={13}/>:<step.icon size={13}/>}</i>
      <span><b>{step.title}{step.optional&&<small className="p-chip p-n">Opcional</small>}</b><small>{step.description}</small><em className="p-taskCta">{step.done?'Listo':`${step.action} →`}</em></span>
    </button>)}</div>}
  </section>;
}
