import { NextResponse } from 'next/server';
import { getPendingInstall } from '../../../../../db/database';
import { env } from '../../../../../lib/env';
import { ensureTiendanubeWebhooks, tiendanubeWebhookUrl } from '../../../../../lib/tiendanube';
import { claimTiendanubeInstall, hashInstallToken, installCookie, readInstallCookie } from '../../../../../lib/tiendanube-install';
import { route } from '../../../../../server/http/route';

// GET: si este navegador tiene una instalación de Tiendanube en espera, el nombre de la tienda
// (para completar el registro). No requiere sesión: solo responde a quien tiene la cookie.
export async function GET(request:Request) {
  const token=readInstallCookie(request);
  const pending=token?await getPendingInstall(hashInstallToken(token)):null;
  return NextResponse.json(pending?{pending:true,storeName:pending.store_name}:{pending:false},{headers:{'cache-control':'no-store'}});
}

// POST: conecta la tienda en espera a la cuenta de Rentia con la que se ingresó.
export const POST=route({access:'manager',origin:'same'},async({user,request})=>{
  const runtime=env as unknown as {TOKEN_ENCRYPTION_KEY?:string};
  const result=await claimTiendanubeInstall(user.id,readInstallCookie(request),{encryptionKey:runtime.TOKEN_ENCRYPTION_KEY,registerWebhooks:(userId,storeId,accessToken)=>ensureTiendanubeWebhooks(userId,storeId,accessToken,tiendanubeWebhookUrl(request.url))});
  const response=NextResponse.json(result,{headers:{'cache-control':'no-store'}});
  // La espera se usa una sola vez: se borra la cookie salga como salga.
  if (readInstallCookie(request)) response.headers.append('set-cookie',installCookie('',0));
  return response;
});
