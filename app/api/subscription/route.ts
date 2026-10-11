import { z } from 'zod';
import { getOrderQuota, getOrderUsageLast30Days, getOrCreateSubscription, saveRequestedPlan } from '../../../db/database';
import { billingEnforced } from '../../../lib/billing';
import { getPlan, recommendedPlan, RENTIA_PLANS } from '../../../lib/plans';
import { canManageRentia } from '../../../lib/session';
import { HttpError, route } from '../../../server/http/route';

function serialize(userId:string,subscription:NonNullable<Awaited<ReturnType<typeof getOrCreateSubscription>>>,orders:number,canManage:boolean,quota:Awaited<ReturnType<typeof getOrderQuota>>) {
  const currentPlan=getPlan(subscription.plan_id);
  const recommendation=recommendedPlan(orders);
  const trialMs=new Date(subscription.trial_ends_at).getTime()-Date.now();
  const trialDaysRemaining=Math.max(0,Math.ceil(trialMs/(24*60*60*1000)));
  const limit=subscription.status==='trialing'?recommendation.orders:currentPlan.orders;
  return {
    userId,
    subscription:{
      planId:subscription.plan_id,
      requestedPlanId:subscription.requested_plan_id,
      status:subscription.status,
      billingCycle:subscription.billing_cycle,
      trialEndsAt:subscription.trial_ends_at,
      trialDaysRemaining,
    },
    usage:{orders,limit,percent:limit?Math.min(100,Math.round(orders/limit*100)):0},
    currentPlan,
    recommendation,
    plans:RENTIA_PLANS,
    billingEnabled:billingEnforced(),
    quota,
    canManage,
  };
}

const PlanBody=z.object({planId:z.unknown().optional(),billingCycle:z.unknown().optional()}).default({});

export const GET=route({},async({user})=>{
  const [subscription,orders]=await Promise.all([getOrCreateSubscription(user.id),getOrderUsageLast30Days(user.id)]);
  if (!subscription) throw new HttpError(404,'account_not_found');
  return serialize(user.id,subscription,orders,canManageRentia(user),await getOrderQuota(user.id));
});

export const POST=route({access:'manager',body:PlanBody,invalidBody:'invalid_plan'},async({user,body})=>{
  const plan=RENTIA_PLANS.find(item=>item.id===body.planId);
  const billingCycle=body.billingCycle==='annual'?'annual':'monthly';
  if (!plan||plan.id==='free') throw new HttpError(400,'invalid_plan');
  const subscription=await saveRequestedPlan(user.id,plan.id,billingCycle);
  if (!subscription) throw new HttpError(404,'account_not_found');
  const orders=await getOrderUsageLast30Days(user.id);
  return {...serialize(user.id,subscription,orders,true,await getOrderQuota(user.id)),message:'Plan guardado para el lanzamiento. Todavía no se realizó ningún cobro.'};
});
