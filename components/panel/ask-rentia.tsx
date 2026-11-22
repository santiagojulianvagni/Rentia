'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUp, X } from 'lucide-react';
import { Mascot } from './mascot';

// "Preguntale a Renti": el chat con IA sobre los números de la tienda. Por ahora se muestra como
// "próximamente": la interfaz está lista, pero todavía no consulta a la IA ni a los datos.
const SUGGESTIONS=['¿Qué producto me deja más plata este mes?','¿Por qué bajó la ganancia?','¿Qué campaña debería pausar?','¿Llego a la meta del mes?'];
const SOON='Esta te la voy a poder responder muy pronto, con tus números reales. Estamos terminando de entrenarme.';

type Message={from:'you'|'rentia';text:string};

export default function AskRentia() {
  // Vista previa: por ahora solo lo ven los dueños de Rentia.
  const [enabled,setEnabled]=useState(false);
  const [open,setOpen]=useState(false);
  const [draft,setDraft]=useState('');
  const [messages,setMessages]=useState<Message[]>([]);
  const end=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(!open)return;
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false);};
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[open]);
  useEffect(()=>{end.current?.scrollIntoView({block:'end'});},[messages]);
  useEffect(()=>{fetch('/api/account/preview',{cache:'no-store'}).then(response=>response.ok?response.json():null).then(data=>setEnabled(data?.askRentia===true)).catch(()=>{});},[]);
  if(!enabled)return null;

  function ask(text:string) {
    const question=text.trim();
    if(!question)return;
    setMessages(current=>[...current,{from:'you',text:question},{from:'rentia',text:SOON}]);
    setDraft('');
  }

  return <>
    {!open&&<button type="button" className="p-askFab" onClick={()=>setOpen(true)} aria-label="Preguntale a Renti">
      <Mascot pose="saluda" size={40}/><span>Preguntale a Renti</span>
    </button>}
    {open&&<>
      <button type="button" className="p-askScrim" onClick={()=>setOpen(false)} aria-label="Cerrar el chat"/>
      <section className="p-ask" role="dialog" aria-label="Preguntale a Renti">
        <header className="p-askHead">
          <span className="p-askAvatar"><Mascot pose="saluda" size={30}/></span>
          <div><b>Preguntale a Renti</b><small>Responde con tus números reales</small></div>
          <span className="p-chip p-a">Próximamente</span>
          <button type="button" className="p-askClose" onClick={()=>setOpen(false)} aria-label="Cerrar"><X size={18} aria-hidden="true"/></button>
        </header>
        <div className="p-askBody">
          <div className="p-askMsg p-rentia"><span className="p-askAvatar p-sm"><Mascot pose="saluda" size={20}/></span><p>¡Hola! Soy Renti. Muy pronto vas a poder preguntarme lo que quieras sobre tu tienda: qué producto te deja más plata, por qué bajó la ganancia o qué campaña conviene pausar. Te respondo con tus ventas, costos y campañas, y te llevo a la sección donde verlo.</p></div>
          <div className="p-askExample" aria-label="Ejemplo de respuesta">
            <small>ASÍ VA A RESPONDER</small>
            <div className="p-askMsg p-you"><p>¿Qué producto me deja más plata este mes?</p></div>
            <div className="p-askMsg p-rentia"><span className="p-askAvatar p-sm"><Mascot pose="saluda" size={20}/></span><p>Tu producto más rentable es el que más ganancia te dejó después de costos, envíos, comisiones y publicidad. Te muestro los tres primeros, cuánto deja cada venta y si a alguno le falta cargar el costo.</p></div>
          </div>
          {messages.map((message,index)=><div key={index} className={`p-askMsg ${message.from==='you'?'p-you':'p-rentia'}`}>{message.from==='rentia'&&<span className="p-askAvatar p-sm"><Mascot pose="saluda" size={20}/></span>}<p>{message.text}</p></div>)}
          <div ref={end}/>
        </div>
        <div className="p-askChips">{SUGGESTIONS.map(text=><button type="button" key={text} onClick={()=>ask(text)}>{text}</button>)}</div>
        <form className="p-askForm" onSubmit={event=>{event.preventDefault();ask(draft);}}>
          <input value={draft} onChange={event=>setDraft(event.target.value)} placeholder="Preguntá sobre tus ventas, costos o campañas" aria-label="Tu pregunta" maxLength={300}/>
          <button type="submit" aria-label="Enviar"><ArrowUp size={18} aria-hidden="true"/></button>
        </form>
        <p className="p-askFoot">Disponible muy pronto en todos los planes.</p>
      </section>
    </>}
  </>;
}
