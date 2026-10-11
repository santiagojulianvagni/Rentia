'use client';

import { useEffect } from 'react';
import { reportClientError } from '../lib/report-client-error';

// Escucha los errores no atrapados del navegador en todo el sitio y los reporta.
export default function ErrorReporter() {
  useEffect(()=>{
    const onError=(event:ErrorEvent)=>reportClientError(event.message,[`${event.filename}:${event.lineno}:${event.colno}`,event.error instanceof Error?event.error.stack:null].filter(Boolean).join('\n'));
    const onRejection=(event:PromiseRejectionEvent)=>{const reason=event.reason;reportClientError(reason instanceof Error?reason.message:String(reason),reason instanceof Error?reason.stack:null);};
    window.addEventListener('error',onError);
    window.addEventListener('unhandledrejection',onRejection);
    return ()=>{window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onRejection);};
  },[]);
  return null;
}
