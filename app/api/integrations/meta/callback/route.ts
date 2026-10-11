import { NextResponse } from 'next/server';
import { consumeOAuthState, saveIntegration, upsertMetaAdAccounts } from '../../../../../db/database';
import { fetchMetaAdAccounts, metaRedirectUri, metaRuntime, syncMetaAds } from '../../../../../lib/meta';
import { encryptToken } from '../../../../../lib/token-crypto';

type TokenResponse={access_token?:string;token_type?:string;expires_in?:number;error?:{message?:string}};
type ProfileResponse={id?:string;name?:string;error?:{message?:string}};

async function exchange(url:URL) {
  const response=await fetch(url,{headers:{accept:'application/json'}});
  const body=await response.json().catch(()=>({})) as TokenResponse;
  if (!response.ok||!body.access_token) throw new Error(body.error?.message||'Meta no entregó un token de acceso');
  return body.access_token;
}

export async function GET(request:Request) {
  const url=new URL(request.url);
  const code=url.searchParams.get('code');
  const state=url.searchParams.get('state');
  const denied=url.searchParams.get('error');
  if (denied) return NextResponse.redirect(new URL('/panel?section=integraciones&error=meta_denied',request.url));
  if (!code||!state) return NextResponse.redirect(new URL('/panel?section=integraciones&error=meta_oauth',request.url));
  const userId=await consumeOAuthState(state,'meta');
  if (!userId) return NextResponse.redirect(new URL('/panel?section=integraciones&error=meta_state',request.url));
  const runtime=metaRuntime();
  if (!runtime.META_APP_ID||!runtime.META_APP_SECRET||!runtime.TOKEN_ENCRYPTION_KEY) return NextResponse.redirect(new URL('/panel?section=integraciones&error=meta_credentials',request.url));
  try {
    const tokenUrl=new URL(`https://graph.facebook.com/${runtime.version}/oauth/access_token`);
    tokenUrl.searchParams.set('client_id',runtime.META_APP_ID);
    tokenUrl.searchParams.set('client_secret',runtime.META_APP_SECRET);
    tokenUrl.searchParams.set('redirect_uri',metaRedirectUri(request.url));
    tokenUrl.searchParams.set('code',code);
    const shortToken=await exchange(tokenUrl);
    const longUrl=new URL(`https://graph.facebook.com/${runtime.version}/oauth/access_token`);
    longUrl.searchParams.set('grant_type','fb_exchange_token');
    longUrl.searchParams.set('client_id',runtime.META_APP_ID);
    longUrl.searchParams.set('client_secret',runtime.META_APP_SECRET);
    longUrl.searchParams.set('fb_exchange_token',shortToken);
    const accessToken=await exchange(longUrl).catch(()=>shortToken);
    const profileUrl=new URL(`https://graph.facebook.com/${runtime.version}/me`);
    profileUrl.searchParams.set('fields','id,name');
    profileUrl.searchParams.set('access_token',accessToken);
    const profileResponse=await fetch(profileUrl,{headers:{accept:'application/json'}});
    const profile=await profileResponse.json() as ProfileResponse;
    if (!profileResponse.ok||!profile.id) throw new Error(profile.error?.message||'No pudimos identificar la cuenta de Meta');
    const encrypted=await encryptToken(accessToken,runtime.TOKEN_ENCRYPTION_KEY);
    await saveIntegration({userId,provider:'meta',storeId:profile.id,encryptedToken:encrypted.encryptedToken,iv:encrypted.iv,scopes:'ads_read,business_management'});
    const accounts=await fetchMetaAdAccounts(accessToken);
    await upsertMetaAdAccounts(userId,accounts);
    await syncMetaAds(userId);
    return NextResponse.redirect(new URL('/panel?section=integraciones&connected=meta',request.url));
  } catch (error) {
    // Meta's own message (permissions, app mode, expired code) is the only way
    // to diagnose a failed connection; it never includes the token.
    console.error(JSON.stringify({level:'error',route:'integrations/meta/callback',message:error instanceof Error?error.message:String(error)}));
    return NextResponse.redirect(new URL('/panel?section=integraciones&error=meta_sync',request.url));
  }
}
