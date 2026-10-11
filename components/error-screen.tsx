'use client';

import { useEffect } from 'react';
import { reportClientError } from '../lib/report-client-error';

// Pantalla para un error inesperado: lo reporta y ofrece reintentar, en vez de dejar la página en blanco.
export default function ErrorScreen({error,reset}:{error:Error&{digest?:string};reset:()=>void}) {
  useEffect(()=>{reportClientError(error.message||'Error de pantalla',[error.digest?`digest ${error.digest}`:null,error.stack].filter(Boolean).join('\n'));},[error]);
  return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:24,background:'#07111f',color:'#f2f7fb',fontFamily:'var(--font-geist-sans),system-ui,sans-serif'}}>
    <div style={{maxWidth:420,textAlign:'center'}}>
      <img src="/favicon.svg" alt="" width={44} height={44} style={{marginBottom:16}}/>
      <h1 style={{fontSize:24,margin:'0 0 8px'}}>Algo salió mal</h1>
      <p style={{color:'#9bb0c1',lineHeight:1.5,margin:'0 0 20px'}}>Ya nos llegó el aviso. Tus datos están a salvo: probá de nuevo y, si se repite, volvé en unos minutos.</p>
      <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
        <button type="button" onClick={reset} style={{padding:'10px 18px',borderRadius:10,border:0,background:'#21d4c2',color:'#031513',fontWeight:600,cursor:'pointer'}}>Reintentar</button>
        <a href="/" style={{padding:'10px 18px',borderRadius:10,border:'1px solid #264560',color:'#f2f7fb',textDecoration:'none'}}>Ir al inicio</a>
      </div>
    </div>
  </main>;
}
