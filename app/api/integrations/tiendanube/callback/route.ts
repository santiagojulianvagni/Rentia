import { env } from '../../../../../lib/env';
import { NextResponse } from 'next/server';
import { consumeOAuthState, ensureTiendanubeAccount, getIntegrationUser, saveIntegration } from '../../../../../db/database';
import { encryptToken } from '../../../../../lib/token-crypto';
import { ensureTiendanubeWebhooks, tiendanubeStoreName, tiendanubeWebhookUrl } from '../../../../../lib/tiendanube';
import { holdTiendanubeInstall, installCookie } from '../../../../../lib/tiendanube-install';

type TokenResponse = {access_token:string;token_type:string;scope?:string;user_id:string|number};

export async function GET(request:Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code) return NextResponse.redirect(new URL('/panel?section=integraciones&error=invalid_oauth',request.url));
  // Sin estado (instalación desde la tienda de apps de Tiendanube) o con uno vencido, no sabemos
  // de qué cuenta de Rentia viene: la conexión queda en espera hasta que la persona ingresa.
  const stateUserId = state ? await consumeOAuthState(state,'tiendanube') : null;
  const runtime = env as unknown as {TIENDANUBE_CLIENT_ID?:string;TIENDANUBE_CLIENT_SECRET?:string;TOKEN_ENCRYPTION_KEY?:string};
  if (!runtime.TIENDANUBE_CLIENT_ID || !runtime.TIENDANUBE_CLIENT_SECRET || !runtime.TOKEN_ENCRYPTION_KEY) return NextResponse.redirect(new URL('/panel?section=integraciones&error=missing_credentials',request.url));
  const response = await fetch('https://www.tiendanube.com/apps/authorize/token',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({client_id:runtime.TIENDANUBE_CLIENT_ID,client_secret:runtime.TIENDANUBE_CLIENT_SECRET,grant_type:'authorization_code',code})});
  if (!response.ok) return NextResponse.redirect(new URL(stateUserId?'/panel?section=integraciones&error=token_exchange':'/ingresar?error=tiendanube_install',request.url));
  const token = await response.json().catch(()=>null) as TokenResponse|null;
  // Tiendanube puede responder 200 con un error adentro (código vencido o inválido).
  if (!token || typeof token.access_token!=='string' || !token.access_token || !/^\d+$/.test(String(token.user_id??''))) return NextResponse.redirect(new URL(stateUserId?'/panel?section=integraciones&error=token_exchange':'/ingresar?error=tiendanube_install',request.url));
  const storeId = String(token.user_id);
  const existingIntegration = await getIntegrationUser('tiendanube',storeId);
  const encrypted = await encryptToken(token.access_token,runtime.TOKEN_ENCRYPTION_KEY);
  const scopes = token.scope||'';

  if (!stateUserId) {
    if (existingIntegration) {
      // La tienda ya tiene cuenta en Rentia: se renueva su conexión y se la manda a ingresar.
      await saveIntegration({userId:existingIntegration.user_id,provider:'tiendanube',storeId,encryptedToken:encrypted.encryptedToken,iv:encrypted.iv,scopes});
      try { await ensureTiendanubeWebhooks(existingIntegration.user_id,storeId,token.access_token,tiendanubeWebhookUrl(request.url)); } catch { /* se reintenta en la próxima conciliación */ }
      return NextResponse.redirect(new URL('/panel?section=integraciones&connected=tiendanube',request.url));
    }
    const storeName = await tiendanubeStoreName(storeId,token.access_token);
    const hold = await holdTiendanubeInstall({storeId,storeName,encryptedToken:encrypted.encryptedToken,iv:encrypted.iv,scopes});
    const redirect = NextResponse.redirect(new URL('/registro?origen=tiendanube',request.url));
    redirect.headers.append('set-cookie',installCookie(hold));
    return redirect;
  }

  if (existingIntegration && existingIntegration.user_id!==stateUserId) {
    return NextResponse.redirect(new URL('/panel?section=integraciones&error=store_already_connected',request.url));
  }
  const userId = stateUserId;
  await ensureTiendanubeAccount(userId,storeId);
  await saveIntegration({userId,provider:'tiendanube',storeId,encryptedToken:encrypted.encryptedToken,iv:encrypted.iv,scopes});
  let automatic=true;
  try { await ensureTiendanubeWebhooks(userId,storeId,token.access_token,tiendanubeWebhookUrl(request.url)); }
  catch { automatic=false; }
  const destination=new URL('/panel?section=integraciones&connected=tiendanube',request.url);
  if (!automatic) destination.searchParams.set('automation','pending');
  return NextResponse.redirect(destination);
}
