import { database as db } from '../db/client';
import { clerkClient } from '@clerk/nextjs/server';
import { getOrCreateSubscription } from '../db/database';
import { teamEntitlement } from './plans';
import type { RentiaUser } from './session';

export type TeamCapacity={limit:number|null;used:number;active:number;pending:number;remaining:number;planName:string;overLimit:boolean};
type Client=Awaited<ReturnType<typeof clerkClient>>;

export async function teamSnapshot(client:Client,user:RentiaUser) {
  const organizationId=user.organizationId!;
  // Pending first, members second: accepting an invite between these reads can
  // temporarily count twice, but cannot make an occupied seat disappear.
  const invitations=[] as Awaited<ReturnType<Client['organizations']['getOrganizationInvitationList']>>['data'];
  for(let offset=0;;offset+=100) {
    const page=await client.organizations.getOrganizationInvitationList({organizationId,status:['pending'],limit:100,offset});
    invitations.push(...page.data);
    if(offset+page.data.length>=page.totalCount||!page.data.length) break;
  }
  const memberships=[] as Awaited<ReturnType<Client['organizations']['getOrganizationMembershipList']>>['data'];
  for(let offset=0;;offset+=100) {
    const page=await client.organizations.getOrganizationMembershipList({organizationId,limit:100,offset});
    memberships.push(...page.data);
    if(offset+page.data.length>=page.totalCount||!page.data.length) break;
  }
  const pending=invitations.filter(item=>item.status==='pending'&&item.expiresAt>Date.now());
  const ownerPresent=memberships.some(item=>item.publicUserData?.userId===user.ownerClerkUserId);
  const active=memberships.length+(ownerPresent?0:1);
  const subscription=await getOrCreateSubscription(user.id);
  const entitlement=teamEntitlement(subscription);
  // Enterprise seats must be explicitly agreed, never inferred from a request.
  if(entitlement.limit===null) {
    const organization=await client.organizations.getOrganization({organizationId});
    const agreed=organization.privateMetadata.rentiaTeamLimit;
    if(typeof agreed==='number'&&Number.isInteger(agreed)&&agreed>0) entitlement.limit=agreed;
  }
  const used=active+pending.length;
  const capacity:TeamCapacity={...entitlement,used,active,pending:pending.length,remaining:entitlement.limit===null?0:Math.max(0,entitlement.limit-used),overLimit:entitlement.limit!==null&&used>entitlement.limit};
  return {memberships,invitations:pending,capacity};
}


export async function acquireTeamAdmission(userId:string) {
  const token=crypto.randomUUID();
  const now=Date.now();
  const result=await db().prepare('INSERT INTO team_admission_locks (user_id,lock_token,expires_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET lock_token=excluded.lock_token,expires_at=excluded.expires_at WHERE team_admission_locks.expires_at<=?').bind(userId,token,now+300000,now).run();
  return result.meta?.changes===1?token:null;
}

export async function releaseTeamAdmission(userId:string,token:string) {
  await db().prepare('DELETE FROM team_admission_locks WHERE user_id=? AND lock_token=?').bind(userId,token).run();
}

export async function renewTeamAdmission(userId:string,token:string) {
  const now=Date.now();
  const result=await db().prepare('UPDATE team_admission_locks SET expires_at=? WHERE user_id=? AND lock_token=? AND expires_at>?').bind(now+300000,userId,token,now).run();
  return result.meta?.changes===1;
}
