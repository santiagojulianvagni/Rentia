'use client';

import ErrorScreen from '../components/error-screen';

// Último resguardo: si falla el layout raíz, Next.js reemplaza toda la página por esto.
export default function GlobalError(props:{error:Error&{digest?:string};reset:()=>void}) {
  return <html lang="es"><body style={{margin:0}}><ErrorScreen {...props}/></body></html>;
}
