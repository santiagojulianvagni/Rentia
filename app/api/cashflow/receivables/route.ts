import { getReceivables } from '../../../../lib/receivables';
import { route } from '../../../../server/http/route';

// Fecha de hoy en Argentina, para no contar como pendiente lo que ya se liberó.
function todayAr() {
  const local=new Date(Date.now()-3*60*60*1000);
  return new Date(Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate())).toISOString().slice(0,10);
}

export const GET=route({},async({user})=>getReceivables(user.id,todayAr()));
