'use client';

import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

type Options={title:string;message?:string;confirmLabel?:string;cancelLabel?:string;danger?:boolean};

function ConfirmDialog({title,message,confirmLabel='Confirmar',cancelLabel='Cancelar',danger=false,onClose}:Options&{onClose:(value:boolean)=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{dialog.current?.showModal();},[]);
  return <dialog ref={dialog} className="p-confirm" aria-labelledby="p-confirm-title" onCancel={event=>{event.preventDefault();onClose(false);}} onClick={event=>{if(event.target===dialog.current)onClose(false);}}>
    <div className="p-confirmBody"><h3 id="p-confirm-title">{title}</h3>{message&&<p>{message}</p>}</div>
    <div className="p-confirmFoot"><button type="button" className="p-confirmCancel" onClick={()=>onClose(false)}>{cancelLabel}</button><button type="button" className={`p-confirmOk ${danger?'p-danger':''}`} autoFocus onClick={()=>onClose(true)}>{confirmLabel}</button></div>
  </dialog>;
}

// Confirmación con el estilo del panel, en lugar del cuadro del navegador. Devuelve true si se confirma.
export function confirmDialog(options:Options):Promise<boolean> {
  return new Promise(resolve=>{
    const host=document.createElement('div');document.body.append(host);
    const root=createRoot(host);
    const close=(value:boolean)=>{root.unmount();host.remove();resolve(value);};
    root.render(<ConfirmDialog {...options} onClose={close}/>);
  });
}
