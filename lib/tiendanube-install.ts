import { createHash, randomBytes } from 'node:crypto';
import { getIntegrationUser, savePendingInstall, saveIntegration, takePendingInstall } from '../db/database';
import { decryptToken } from './token-crypto';

// Instalación desde la tienda de apps de Tiendanube: la tienda autoriza la app antes de tener
// cuenta en Rentia, así que la conexión queda en espera una hora, atada a una cookie de ese
// navegador. Cuando la persona crea su cuenta o ingresa, el onboarding la reclama.
export const INSTALL_COOKIE='__Host-rentia_tn_install';
export const INSTALL_SECONDS=60*60;

export const newInstallToken=()=>randomBytes(32).toString('base64url');
export const hashInstallToken=(token:string)=>createHash('sha256').update(`rentia-install:${token}`).digest('hex');
const validToken=(token:string|undefined|null):token is string=>Boolean(token&&/^[A-Za-z0-9_-]{43}$/.test(token));

export function readInstallCookie(request:Request) {
  const header=request.headers.get('cookie')||'';
  for (const part of header.split(';')) {
    const [name,...rest]=part.trim().split('=');
    if (name===INSTALL_COOKIE) { const value=rest.join('='); return validToken(value)?value:null; }
  }
  return null;
}

export function installCookie(value:string,maxAge=INSTALL_SECONDS) {
  return `${INSTALL_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

export async function holdTiendanubeInstall(input:{storeId:string;storeName:string|null;encryptedToken:string;iv:string;scopes:string},now=Date.now()) {
  const token=newInstallToken();
  await savePendingInstall({tokenHash:hashInstallToken(token),provider:'tiendanube',storeId:input.storeId,storeName:input.storeName,encryptedToken:input.encryptedToken,iv:input.iv,scopes:input.scopes,expiresAt:new Date(now+INSTALL_SECONDS*1000).toISOString()});
  return token;
}

export type ClaimResult={claimed:true;storeName:string|null;automatic:boolean}|{claimed:false;reason:'none'|'store_already_connected'};

// Conecta la tienda en espera a la cuenta de Rentia de quien tiene la cookie.
export async function claimTiendanubeInstall(userId:string,token:string|null,options:{encryptionKey?:string;registerWebhooks?:(userId:string,storeId:string,accessToken:string)=>Promise<unknown>}):Promise<ClaimResult> {
  if (!validToken(token)) return {claimed:false,reason:'none'};
  const pending=await takePendingInstall(hashInstallToken(token));
  if (!pending||pending.provider!=='tiendanube') return {claimed:false,reason:'none'};
  const owner=await getIntegrationUser('tiendanube',pending.store_id);
  if (owner&&owner.user_id!==userId) return {claimed:false,reason:'store_already_connected'};
  await saveIntegration({userId,provider:'tiendanube',storeId:pending.store_id,encryptedToken:pending.encrypted_access_token,iv:pending.token_iv,scopes:pending.scopes||''});
  let automatic=false;
  if (options.encryptionKey&&options.registerWebhooks) {
    try {
      const access=await decryptToken(pending.encrypted_access_token,pending.token_iv,options.encryptionKey);
      await options.registerWebhooks(userId,pending.store_id,access);
      automatic=true;
    } catch { automatic=false; }
  }
  return {claimed:true,storeName:pending.store_name,automatic};
}
