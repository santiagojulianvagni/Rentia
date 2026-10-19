import { auth, clerkClient, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getAccount, getAccountByEmail, getSettings, getStoreIdentityByOrganization, getStoreIdentityByOwner, recordError, saveAccount, saveAccountContact, saveStoreIdentityLink } from '../../../../db/database';

async function bootstrap(request:Request) {
  // Pending sessions (no organization yet) are expected here: this creates it.
  const {userId,orgId}=await auth({treatPendingAsSignedOut:false});
  if (!userId) return NextResponse.json({error:'unauthorized'},{status:401});

  const clerkUser=await currentUser({treatPendingAsSignedOut:false});
  if (!clerkUser) return NextResponse.json({error:'unauthorized'},{status:401});
  const client=await clerkClient();
  // Resolve only organizations Clerk confirms this user belongs to. An invited
  // member must join the existing tenant, not accidentally create another one.
  if (orgId) {
    const activeLink=await getStoreIdentityByOrganization(orgId);
    if (activeLink) return NextResponse.json({ok:true,organizationId:orgId,account:await getAccount(activeLink.store_user_id),migrated:true,needsChannels:activeLink.owner_clerk_user_id===userId&&!await getSettings(activeLink.store_user_id)});
  }
  const existingLink=await getStoreIdentityByOwner(userId);
  if (existingLink) {
    const account=await getAccount(existingLink.store_user_id);
    const settings=await getSettings(existingLink.store_user_id);
    return NextResponse.json({ok:true,organizationId:existingLink.clerk_organization_id,account,migrated:true,needsChannels:!settings});
  }

  for (let offset=0;;offset+=100) {
    const memberships=await client.users.getOrganizationMembershipList({userId,limit:100,offset});
    for (const membership of memberships.data) {
      const link=await getStoreIdentityByOrganization(membership.organization.id);
      if (link) return NextResponse.json({ok:true,organizationId:link.clerk_organization_id,account:await getAccount(link.store_user_id),migrated:true,needsChannels:false});
    }
    if (offset+memberships.data.length>=memberships.totalCount||!memberships.data.length) break;
  }

  const body=await request.json().catch(()=>({})) as {store?:unknown;name?:unknown;phone?:unknown}|null;
  if (!body||typeof body!=='object'||Array.isArray(body)||[body.store,body.name,body.phone].some(value=>value!==undefined&&typeof value!=='string')) return NextResponse.json({error:'invalid_details'},{status:400});
  const primaryEmail=clerkUser.emailAddresses.find(email=>email.id===clerkUser.primaryEmailAddressId)?.emailAddress
    || clerkUser.emailAddresses[0]?.emailAddress;
  if (!primaryEmail) return NextResponse.json({error:'email_required'},{status:400});

  const legacyAccount=await getAccountByEmail(primaryEmail);
  const storeName=legacyAccount?.store_name || (body.store as string|undefined)?.trim();
  if (!storeName) return NextResponse.json({error:'store_required'},{status:409});
  const ownerName=(body.name as string|undefined)?.trim() || legacyAccount?.owner_name || [clerkUser.firstName,clerkUser.lastName].filter(Boolean).join(' ') || primaryEmail.split('@')[0];
  const phoneDigits=((body.phone as string|undefined)||'').trim().replace(/^\+54/,'').replace(/\D/g,'');
  // Validate before creating the organization or persisting an account.
  if (phoneDigits&&(phoneDigits.length<6||phoneDigits.length>13)) return NextResponse.json({error:'invalid_phone'},{status:400});
  if (storeName.length>200||ownerName.length>200) return NextResponse.json({error:'invalid_details'},{status:400});
  const storeUserId=legacyAccount?.user_id || `rentia:${crypto.randomUUID()}`;

  const organization=await client.organizations.createOrganization({
    name:storeName,
    createdBy:userId,
    maxAllowedMemberships:25,
    privateMetadata:{storeUserId},
  });

  try {
    await saveAccount({userId:storeUserId,email:primaryEmail.toLowerCase(),name:ownerName,store:storeName});
    if (phoneDigits) {
      await saveAccountContact({userId:storeUserId,phoneCountry:'AR',phoneNumber:phoneDigits,phoneE164:`+54${phoneDigits}`});
    }
    await saveStoreIdentityLink({storeUserId,organizationId:organization.id,ownerClerkUserId:userId});
  } catch (error) {
    await client.organizations.deleteOrganization(organization.id).catch(()=>undefined);
    throw error;
  }

  // Una tienda que ya existía (por ejemplo, al pasar el inicio de sesión a otra instancia de
  // Clerk) se reconecta por email con todos sus datos y no repite la elección de canales.
  const needsChannels=legacyAccount?!await getSettings(storeUserId):true;
  return NextResponse.json({ok:true,organizationId:organization.id,account:await getAccount(storeUserId),migrated:Boolean(legacyAccount),needsChannels});
}

// Clerk and database failures are logged with the provider's error code, so a
// failed onboarding can be diagnosed from the deployment logs.
export async function POST(request:Request) {
  try { return await bootstrap(request); }
  catch (error) {
    const clerk=(error as {errors?:Array<{code?:string;message?:string}>})?.errors?.[0];
    console.error(JSON.stringify({level:'error',route:'account/bootstrap',message:error instanceof Error?error.message:String(error),clerkCode:clerk?.code,clerkMessage:clerk?.message}));
    await recordError({source:'server',path:'/api/account/bootstrap',message:error instanceof Error?error.message:String(error),detail:clerk?`Clerk ${clerk.code||''}: ${clerk.message||''}`:null}).catch(()=>undefined);
    return NextResponse.json({error:'bootstrap_failed'},{status:500});
  }
}
