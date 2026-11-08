'use client';

import { useEffect, useState } from 'react';

// Aviso en el registro y el ingreso cuando la persona viene de instalar Rentia desde la
// tienda de apps de Tiendanube: su tienda queda en espera y se conecta al terminar.
export default function InstallNotice({signIn=false}:{signIn?:boolean}) {
  const [store,setStore]=useState<string|null>(null);
  useEffect(()=>{
    fetch('/api/integrations/tiendanube/claim',{cache:'no-store'}).then(response=>response.ok?response.json() as Promise<{pending?:boolean;storeName?:string|null}>:null)
      .then(data=>{ if(data?.pending) setStore(data.storeName||''); }).catch(()=>undefined);
  },[]);
  if(store===null)return null;
  const name=store?<b>{store}</b>:'tu tienda';
  return <div className="authInstall" role="status"><img src="/brands/tiendanube-icon.png" alt=""/><p>{signIn?<>Ingresá a tu cuenta de Rentia y conectamos {name} sola.</>:<>Instalaste Rentia en {name}. Creá tu cuenta (o ingresá si ya tenés una) y la conectamos sola.</>}</p></div>;
}
