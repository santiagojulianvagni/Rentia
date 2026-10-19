import { clerkClient } from '@clerk/nextjs/server';
import { z } from 'zod';
import { canManageRentia } from '../../../lib/session';
import { HttpError, route } from '../../../server/http/route';
import { env } from '../../../lib/env';
import { rentiaInvitationUrl } from '../../../lib/invitation-url';
import { acquireTeamAdmission, releaseTeamAdmission, renewTeamAdmission, teamSnapshot } from '../../../lib/team-capacity';
import { getOrCreateSubscription } from '../../../db/database';
import { teamEntitlement } from '../../../lib/plans';
import { clerkMemberLimit } from '../../../lib/clerk-limits';

function roleLabel(role:string,owner:boolean) {
  return owner?'Propietario':role==='org:admin'?'Administrador':'Miembro · consulta';
}
function failure(error:string,status=400):never{throw new HttpError(status,error);}
const Role=z.enum(['org:admin','org:member']);
const InviteBody=z.object({email:z.string(),role:Role});
const RoleBody=z.object({userId:z.string(),role:Role});
const RemoveBody=z.record(z.string(),z.unknown());

export const GET=route({},async({user})=>{
  try {
    if(!user.organizationId) {
      const entitlement=teamEntitlement(await getOrCreateSubscription(user.id));
      return {members:[{userId:'legacy-owner',name:user.name,email:user.email,role:'owner',roleLabel:'Propietario',owner:true,createdAt:null}],invitations:[],canManage:true,transition:true,currentRole:'owner',capacity:{...entitlement,used:1,active:1,pending:0,remaining:Math.max(0,(entitlement.limit||1)-1),overLimit:false}};
    }
    const client=await clerkClient();
    const {memberships,invitations,capacity}=await teamSnapshot(client,user);
    return {
      members:memberships.map(membership=>{
        const profile=membership.publicUserData;
        const owner=profile?.userId===user.ownerClerkUserId;
        return {userId:profile?.userId||'',name:[profile?.firstName,profile?.lastName].filter(Boolean).join(' ')||profile?.identifier||'Usuario',email:profile?.identifier||'',imageUrl:profile?.imageUrl||'',role:owner?'owner':membership.role,roleLabel:roleLabel(membership.role,owner),owner,createdAt:membership.createdAt};
      }),
      invitations:invitations.map(invitation=>({id:invitation.id,email:invitation.emailAddress,role:invitation.role,roleLabel:roleLabel(invitation.role,false),status:invitation.status,createdAt:invitation.createdAt,expiresAt:invitation.expiresAt})),
      canManage:canManageRentia(user),currentRole:user.role,currentUserId:user.clerkUserId,capacity,
    };
  } catch {return failure('team_unavailable',503);}
});

export const POST=route({access:'manager',body:InviteBody,invalidBody:'invalid_data'},async({user,body,request})=>{
  if(!user.organizationId||!user.clerkUserId) return failure('forbidden',403);
  const email=body.email.trim().toLowerCase();
  if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return failure('invalid_email');
  let token:string|null=null;
  let invitationInFlight=false;
  try {
    token=await acquireTeamAdmission(user.id);
    if(!token) return failure('team_busy',409);
    const client=await clerkClient();
    const {memberships,invitations,capacity}=await teamSnapshot(client,user);
    if(memberships.some(item=>item.publicUserData?.identifier?.toLowerCase()===email)||invitations.some(item=>item.emailAddress.toLowerCase()===email)) return failure('already_invited',409);
    if(capacity.limit===null) return failure('team_limit_unconfigured',409);
    if(capacity.remaining===0) throw new HttpError(409,'team_limit_reached',{capacity});
    if(!await renewTeamAdmission(user.id,token)) return failure('team_busy',409);
    // Clerk no acepta un límite mayor al de su plan: se pide el menor entre el plan de Rentia y ese tope.
    const providerLimit=clerkMemberLimit(capacity.limit);
    if(capacity.used>=providerLimit) return failure('team_provider_limit',409);
    await client.organizations.updateOrganization(user.organizationId,{maxAllowedMemberships:providerLimit});
    const config=env as unknown as {RENTIA_PUBLIC_ORIGIN?:string};
    const redirectUrl=rentiaInvitationUrl(config.RENTIA_PUBLIC_ORIGIN||new URL(request.url).origin,user.organizationId);
    invitationInFlight=true;
    const invitation=await client.organizations.createOrganizationInvitation({organizationId:user.organizationId,emailAddress:email,role:body.role,inviterUserId:user.clerkUserId,expiresInDays:14,redirectUrl});
    invitationInFlight=false;
    return {ok:true,id:invitation.id};
  } catch(error) {
    if(error instanceof HttpError) throw error;
    return failure(invitationInFlight?'invitation_status_unknown':'team_unavailable',503);
  }
  finally {
    // A provider timeout can mean the email was sent: retain the lease and do
    // not retry automatically. The next attempt re-reads provider invitations.
    if(token&&!invitationInFlight) await releaseTeamAdmission(user.id,token).catch(()=>undefined);
  }
});

export const PATCH=route({access:'manager',body:RoleBody,invalidBody:'invalid_data'},async({user,body})=>{
  if(!user.organizationId) return failure('forbidden',403);
  if(body.userId===user.ownerClerkUserId) return failure('owner_is_protected',409);
  if(body.userId===user.clerkUserId) return failure('self_role_is_protected',409);
  try {
    const client=await clerkClient();
    await client.organizations.updateOrganizationMembership({organizationId:user.organizationId,userId:body.userId,role:body.role});
    return {ok:true};
  } catch {return failure('team_update_failed',503);}
});

export const DELETE=route({access:'manager',body:RemoveBody,invalidBody:'invalid_data'},async({user,body})=>{
  if(!user.organizationId) return failure('forbidden',403);
  if(typeof body.invitationId!=='string'||!body.invitationId) {
    if(typeof body.userId!=='string'||!body.userId) return failure('invalid_data');
    if(body.userId===user.ownerClerkUserId) return failure('owner_is_protected',409);
    if(body.userId===user.clerkUserId) return failure('self_removal_is_protected',409);
  }
  try {
    const client=await clerkClient();
    if(typeof body.invitationId==='string'&&body.invitationId) {
      await client.organizations.revokeOrganizationInvitation({organizationId:user.organizationId,invitationId:body.invitationId,requestingUserId:user.clerkUserId||undefined});
      return {ok:true};
    }
    await client.organizations.deleteOrganizationMembership({organizationId:user.organizationId,userId:String(body.userId)});
    return {ok:true};
  } catch {return failure('team_update_failed',503);}
});
