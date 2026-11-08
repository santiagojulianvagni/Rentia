import { currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getOrCreateSubscription, grantComplimentaryPlan, listAccountsForAdmin, revokeComplimentaryPlan } from '../../../../db/database';
import { isRentiaOwnerEmail } from '../../../../lib/billing-checkout';
import { RENTIA_PLANS } from '../../../../lib/plans';

// Administración de Rentia: ver cuentas y dar o quitar planes sin cargo. Solo los dueños,
// identificados por la huella de su email (el mismo control que el cobro de prueba).
async function owner() {
  const user=await currentUser();
  // Solo el email principal y verificado por Clerk cuenta como dueño.
  const primary=user?.emailAddresses.find(item=>item.id===user.primaryEmailAddressId);
  if (!primary||primary.verification?.status!=='verified') return null;
  return isRentiaOwnerEmail(primary.emailAddress)?primary.emailAddress:null;
}

export async function GET(request:Request) {
  if (!await owner()) return NextResponse.json({error:'forbidden'},{status:403});
  const search=new URL(request.url).searchParams.get('q')||'';
  return NextResponse.json({accounts:await listAccountsForAdmin(search.slice(0,100))},{headers:{'cache-control':'no-store'}});
}

const Body=z.object({userId:z.string().min(1).max(200),action:z.enum(['grant','revoke']),planId:z.string().optional()});

export async function POST(request:Request) {
  if (!await owner()) return NextResponse.json({error:'forbidden'},{status:403});
  if (request.headers.get('origin')!==new URL(request.url).origin) return NextResponse.json({error:'invalid_origin'},{status:403});
  const parsed=Body.safeParse(await request.json().catch(()=>null));
  if (!parsed.success) return NextResponse.json({error:'invalid_body'},{status:400});
  const {userId,action,planId}=parsed.data;
  if (!await getOrCreateSubscription(userId)) return NextResponse.json({error:'account_not_found'},{status:404});
  if (action==='grant') {
    if (!planId||!RENTIA_PLANS.some(plan=>plan.id===planId)||planId==='free') return NextResponse.json({error:'invalid_plan'},{status:400});
    return NextResponse.json({subscription:await grantComplimentaryPlan(userId,planId)});
  }
  return NextResponse.json({subscription:await revokeComplimentaryPlan(userId)});
}
