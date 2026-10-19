import { abandonedCartsSyncedAt, analyticsWindow, getAbandonedCarts, getAccount } from '../../../../db/database';
import { analyticsRangeFromUrl } from '../../../../lib/analytics-range';
import { cartSummary, type AbandonedCart, type CartContact } from '../../../../lib/abandoned-carts';
import { canManageRentia } from '../../../../lib/session';
import { decryptToken } from '../../../../lib/token-crypto';
import { env } from '../../../../lib/env';
import { route } from '../../../../server/http/route';

type StoredCart=AbandonedCart&{contactEncrypted:string|null;contactIv:string|null};

// Carritos abandonados del período. El contacto del comprador se descifra solo para el
// propietario o un administrador, y solo de los carritos recientes que se muestran.
export const GET=route({},async({user,url})=>{
  const {days,range}=analyticsRangeFromUrl(url);
  const {since,until}=analyticsWindow(days,0,range);
  const [{carts,paidOrders},syncedAt,account]=await Promise.all([getAbandonedCarts(user.id,since,until),abandonedCartsSyncedAt(user.id),getAccount(user.id)]);
  const summary=cartSummary(carts as StoredCart[],paidOrders);
  const key=(env as unknown as {TOKEN_ENCRYPTION_KEY?:string}).TOKEN_ENCRYPTION_KEY;
  const canSeeContacts=canManageRentia(user)&&Boolean(key);
  const recent=await Promise.all((summary.recent as StoredCart[]).map(async ({contactEncrypted,contactIv,...cart})=>{
    let contact:CartContact|null=null;
    if(canSeeContacts&&contactEncrypted&&contactIv) {
      try {contact=JSON.parse(await decryptToken(contactEncrypted,contactIv,key!)) as CartContact;} catch {contact=null;}
    }
    return {...cart,contact};
  }));
  return {...summary,recent,syncedAt,canSeeContacts,storeName:String(account?.store_name||'nuestra tienda')};
});
