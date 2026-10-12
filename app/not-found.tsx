import Link from 'next/link';

export const metadata={title:'Página no encontrada — Rentia'};

// 404 con la marca y en español, en lugar de la página genérica de Next.js.
export default function NotFound() {
  return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:24,background:'#07111f',color:'#f2f7fb'}}>
    <div style={{maxWidth:440,textAlign:'center'}}>
      <img src="/favicon.svg" alt="Rentia" width={44} height={44} style={{marginBottom:16}}/>
      <p style={{margin:'0 0 6px',color:'#21d4c2',fontWeight:700,letterSpacing:'.12em',fontSize:12}}>ERROR 404</p>
      <h1 style={{fontSize:26,margin:'0 0 10px'}}>No encontramos esta página</h1>
      <p style={{color:'#9bb0c1',lineHeight:1.5,margin:'0 0 22px'}}>Puede que el enlace esté mal escrito o que la página se haya movido.</p>
      <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
        <Link href="/" style={{padding:'10px 18px',borderRadius:10,background:'#21d4c2',color:'#031513',fontWeight:600,textDecoration:'none'}}>Ir al inicio</Link>
        <Link href="/panel" style={{padding:'10px 18px',borderRadius:10,border:'1px solid #264560',color:'#f2f7fb',textDecoration:'none'}}>Abrir mi panel</Link>
      </div>
    </div>
  </main>;
}
