import { env } from '../../../../../lib/env';
import { NextResponse } from 'next/server';
import { consumeOAuthState, ensureTiendanubeAccount, getIntegrationUser, saveIntegration } from '../../../../../db/database';
import { encryptToken } from '../../../../../lib/token-crypto';
import { ensureTiendanubeWebhooks, tiendanubeWebhookUrl } from '../../../../../lib/tiendanube';

type TokenResponse = {access_token:string;token_type:string;scope?:string;user_id:string|number};

export async function GET(request:Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) return NextResponse.redirect(new URL('/panel?section=integraciones&error=invalid_oauth',request.url));
  const stateUserId = await consumeOAuthState(state,'tiendanube');
  if (!stateUserId) return NextResponse.redirect(new URL('/panel?section=integraciones&error=invalid_state',request.url));
  const runtime = env as unknown as {TIENDANUBE_CLIENT_ID?:string;TIENDANUBE_CLIENT_SECRET?:string;TOKEN_ENCRYPTION_KEY?:string};
  if (!runtime.TIENDANUBE_CLIENT_ID || !runtime.TIENDANUBE_CLIENT_SECRET || !runtime.TOKEN_ENCRYPTION_KEY) return NextResponse.redirect(new URL('/panel?section=integraciones&error=missing_credentials',request.url));
  const response = await fetch('https://www.tiendanube.com/apps/authorize/token',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({client_id:runtime.TIENDANUBE_CLIENT_ID,client_secret:runtime.TIENDANUBE_CLIENT_SECRET,grant_type:'authorization_code',code})});
  if (!response.ok) return NextResponse.redirect(new URL('/panel?section=integraciones&error=token_exchange',request.url));
  const token = await response.json() as TokenResponse;
  const storeId = String(token.user_id);
  const existingIntegration = await getIntegrationUser('tiendanube',storeId);
  if (existingIntegration && existingIntegration.user_id!==stateUserId) {
    return NextResponse.redirect(new URL('/panel?section=integraciones&error=store_already_connected',request.url));
  }
  const userId = stateUserId;
  await ensureTiendanubeAccount(userId,storeId);
  const encrypted = await encryptToken(token.access_token,runtime.TOKEN_ENCRYPTION_KEY);
  await saveIntegration({userId,provider:'tiendanube',storeId,encryptedToken:encrypted.encryptedToken,iv:encrypted.iv,scopes:token.scope||''});
  let automatic=true;
  try { await ensureTiendanubeWebhooks(userId,storeId,token.access_token,tiendanubeWebhookUrl(request.url)); }
  catch { automatic=false; }
  const destination=new URL('/panel?section=integraciones&connected=tiendanube',request.url);
  if (!automatic) destination.searchParams.set('automation','pending');
  return NextResponse.redirect(destination);
}
