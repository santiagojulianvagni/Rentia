// Envía un error del navegador a /api/errors. Como mucho 5 por página y sin repetir el
// mismo mensaje; ignora ruido que no es de Rentia (extensiones, cancelaciones, scripts ajenos).
const sent=new Set<string>();
const IGNORED=[/ResizeObserver loop/i,/^Script error\.?$/i,/AbortError/i,/The user aborted a request/i,/Load failed/i,/NetworkError when attempting to fetch/i,/Failed to fetch/i];

export function reportClientError(message:string,detail?:string|null) {
  if(typeof window==='undefined')return;
  const text=(message||'Error').slice(0,500);
  if(sent.size>=5||sent.has(text)||IGNORED.some(pattern=>pattern.test(text)))return;
  if(detail&&/(chrome|moz|safari)-extension:\/\//.test(detail))return;
  sent.add(text);
  void fetch('/api/errors',{method:'POST',headers:{'content-type':'application/json'},keepalive:true,
    body:JSON.stringify({message:text,detail:detail?.slice(0,4000)||null,path:window.location.pathname})}).catch(()=>undefined);
}
