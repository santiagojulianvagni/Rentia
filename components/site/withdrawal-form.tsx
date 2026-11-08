'use client';

import { useState, type FormEvent } from 'react';

// Formulario del botón de arrepentimiento: sin cuenta, con código de trámite en el momento.
export default function WithdrawalForm() {
  const [state,setState]=useState<{status:'idle'|'sending'|'done'|'error';code?:string;message?:string}>({status:'idle'});
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.status==='sending') return;
    const form=new FormData(event.currentTarget);
    setState({status:'sending'});
    try {
      const response=await fetch('/api/arrepentimiento',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.fromEntries(form.entries()))});
      const data=await response.json().catch(()=>({})) as {code?:string;error?:string};
      if (response.ok&&data.code) { setState({status:'done',code:data.code}); return; }
      setState({status:'error',message:data.error==='too_many_requests'?'Recibimos varios pedidos desde tu conexión. Probá de nuevo en una hora o escribinos a hola@rentiaapp.com.':'Revisá tu nombre y tu email e intentá de nuevo.'});
    } catch { setState({status:'error',message:'No pudimos enviar el pedido. Revisá tu conexión e intentá de nuevo.'}); }
  }
  if (state.status==='done') return <div className="legalCallout" role="status" aria-live="polite">
    <b>Recibimos tu pedido</b>
    <p>Tu código de trámite es <strong className="mono" style={{fontSize:20,color:'#fff'}}>{state.code}</strong>. Guardalo: también te lo mandamos por mail.</p>
    <p>Si contrataste hace 10 días corridos o menos, cancelamos la suscripción y te devolvemos el total cobrado por el mismo medio de pago.</p>
  </div>;
  return <form className="legalCallout withdrawalForm" onSubmit={submit} noValidate={false}>
    <b>Pedí la revocación de tu contratación</b>
    <p>No hace falta tener la sesión abierta ni una cuenta. Usá el email con el que contrataste.</p>
    <label><span>Nombre y apellido</span><input name="name" required minLength={2} maxLength={120} autoComplete="name"/></label>
    <label><span>Email</span><input name="email" type="email" required maxLength={200} autoComplete="email"/></label>
    <label><span>Nombre de la tienda <small>(opcional)</small></span><input name="store" maxLength={120}/></label>
    <label><span>Comentario <small>(opcional)</small></span><textarea name="reason" maxLength={1000} rows={3}/></label>
    <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{position:'absolute',left:'-9999px',width:1,height:1}}/>
    {state.status==='error'&&<p role="alert" style={{color:'#ffb4a8'}}>{state.message}</p>}
    <button className="button small" type="submit" disabled={state.status==='sending'}>{state.status==='sending'?'Enviando…':'Enviar pedido de arrepentimiento'}</button>
  </form>;
}
