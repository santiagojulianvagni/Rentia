import { defaultAlertSettings, type AlertSettings } from '../lib/alerts';
import { database, type Statement } from './client';
import {ITEM_COST_JOINS,ITEM_UNIT_COST_SQL,ITEM_COST_SOURCE_SQL,ORDER_ANALYTICS_BATCH_SQL,ORDER_COUNT_SQL,ORDER_PAGE_SQL,PAID_TOTAL_SQL,PRODUCT_SALES_BATCH_SQL} from '../lib/commerce-queries';
import type {AnalyticsOrder} from '../lib/order-calculations';
import {atomicBatches} from '../lib/atomic-batches';
import {billingEnforced,monthKey,monthlyOrderLimit} from '../lib/billing';

export type Account = {
  user_id: string; email: string; owner_name: string; store_name: string;
  country: string; currency: string; trial_started_at: string;
  created_at: string; updated_at: string;
};

export type SubscriptionRecord = {
  user_id:string; plan_id:string; requested_plan_id:string|null; status:string; billing_cycle:string;
  trial_ends_at:string; provider:string|null; provider_customer_id:string|null; provider_subscription_id:string|null;
  current_period_start:string|null; current_period_end:string|null; created_at:string; updated_at:string;
  terms_version?:string|null; terms_accepted_at?:string|null; cancel_at_period_end?:boolean; canceled_at?:string|null; canceled_by?:string|null;
};

export type SyncedProduct = {
  externalId:string; name:string; imageUrl:string|null; published:boolean;
  createdAt:string|null; updatedAt:string|null;
  variants:Array<{externalId:string;sku:string|null;price:number;cost:number;stock:number|null;stockManagement:boolean}>;
};

export type SyncedOrder = {
  externalId:string; number:string|null; currency:string; status:string; paymentStatus:string;
  paymentMethod:string|null; paymentType:string|null; paymentInstallments:number|null; shippingStatus:string|null; shippingCost:number|null; total:number; subtotal:number; discount:number; createdAt:string; updatedAt:string|null;
  items:Array<{externalLineId:string;productId:string|null;variantId:string|null;name:string;sku:string|null;quantity:number;unitPrice:number;unitCost:number}>;
};

export type ExternalRevenueEntry = {
  revenueDate:string; orderCount:number; revenue:number; currency:string;
};

export type ExchangeRateSettings = {
  rate_type:string; base_rate:number; adjustment_percent:number; updated_at:string;
};

export type AnalyticsDateRange = { start:string; end:string };

export type MetaAdAccountInput = {
  externalId:string; name:string; currency:string; timezoneName:string|null; accountStatus:number;
};

export type MetaCampaignInput = {
  externalId:string; name:string; status:string|null; effectiveStatus:string|null; dailyBudget:number; lifetimeBudget:number;
};

export type MetaInsightInput = {
  campaignId:string; date:string; spend:number; impressions:number; clicks:number; purchases:number; purchaseValue:number;
};

export type WebhookEventRecord = {
  id:number; provider:string; event_key:string; user_id:string|null; external_store_id:string;
  event_type:string; resource_id:string|null; payload_json:string; status:string; attempts:number;
  last_error:string|null; next_retry_at:string|null; received_at:string; processed_at:string|null; updated_at:string;
};

async function runInChunks(statements:Statement[],size=50) {
  for (let index=0;index<statements.length;index+=size) await database().batch(statements.slice(index,index+size));
}

// Schema changes are applied by scripts/migrate.mjs on every deploy. Running
// DDL from request handlers could leave API requests waiting on locks, so the
// call sites stay lightweight and deployments own schema changes.
export async function ensureSchema() {
  return;
}

export async function getAccount(userId: string) {
  await ensureSchema();
  return database().prepare('SELECT * FROM accounts WHERE user_id = ?').bind(userId).first<Account>();
}

export async function getAccountByEmail(email:string) {
  await ensureSchema();
  return database().prepare('SELECT * FROM accounts WHERE lower(email) = lower(?) LIMIT 1').bind(email).first<Account>();
}

export type StoreIdentityLink = {
  store_user_id:string;
  clerk_organization_id:string;
  owner_clerk_user_id:string;
};

export async function getStoreIdentityByOrganization(organizationId:string) {
  await ensureSchema();
  return database().prepare('SELECT store_user_id,clerk_organization_id,owner_clerk_user_id FROM store_identity_links WHERE clerk_organization_id=?')
    .bind(organizationId).first<StoreIdentityLink>();
}

export async function getStoreIdentityByOwner(clerkUserId:string) {
  await ensureSchema();
  return database().prepare('SELECT store_user_id,clerk_organization_id,owner_clerk_user_id FROM store_identity_links WHERE owner_clerk_user_id=? ORDER BY created_at LIMIT 1')
    .bind(clerkUserId).first<StoreIdentityLink>();
}

export async function getStoreIdentityByAccount(storeUserId:string) {
  await ensureSchema();
  return database().prepare('SELECT store_user_id,clerk_organization_id,owner_clerk_user_id FROM store_identity_links WHERE store_user_id=?')
    .bind(storeUserId).first<StoreIdentityLink>();
}

export async function saveStoreIdentityLink(input:{storeUserId:string;organizationId:string;ownerClerkUserId:string}) {
  await ensureSchema();
  const now=new Date().toISOString();
  await database().prepare('INSERT INTO store_identity_links (store_user_id,clerk_organization_id,owner_clerk_user_id,created_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(store_user_id) DO UPDATE SET clerk_organization_id=excluded.clerk_organization_id,owner_clerk_user_id=excluded.owner_clerk_user_id,updated_at=excluded.updated_at')
    .bind(input.storeUserId,input.organizationId,input.ownerClerkUserId,now,now).run();
}

export async function saveAccount(input: {userId:string; email:string; name:string; store:string}) {
  await ensureSchema();
  const now = new Date().toISOString();
  await database().prepare("INSERT INTO accounts (user_id,email,owner_name,store_name,trial_started_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,owner_name=excluded.owner_name,store_name=excluded.store_name,updated_at=excluded.updated_at")
    .bind(input.userId,input.email,input.name,input.store,now,now,now).run();
}

export async function saveAccountContact(input:{userId:string;phoneCountry:string;phoneNumber:string;phoneE164:string}) {
  await ensureSchema();
  const now=new Date().toISOString();
  await database().prepare("INSERT INTO account_profiles (user_id,phone_country,phone_number,phone_e164,phone_verification_status,created_at,updated_at) VALUES (?,?,?,?,'pending_provider',?,?) ON CONFLICT(user_id) DO UPDATE SET phone_country=excluded.phone_country,phone_number=excluded.phone_number,phone_e164=excluded.phone_e164,phone_verification_status=CASE WHEN account_profiles.phone_e164=excluded.phone_e164 THEN account_profiles.phone_verification_status ELSE 'pending_provider' END,phone_verified_at=CASE WHEN account_profiles.phone_e164=excluded.phone_e164 THEN account_profiles.phone_verified_at ELSE NULL END,updated_at=excluded.updated_at")
    .bind(input.userId,input.phoneCountry,input.phoneNumber,input.phoneE164,now,now).run();
}

export async function getOrCreateSubscription(userId:string) {
  await ensureSchema();
  let subscription=await database().prepare('SELECT * FROM subscriptions WHERE user_id=?').bind(userId).first<SubscriptionRecord>();
  const now=new Date();
  if (!subscription) {
    const account=await getAccount(userId);
    if (!account) return null;
    const trialStart=new Date(account.trial_started_at);
    const validTrialStart=Number.isFinite(trialStart.getTime())?trialStart:now;
    const trialEndsAt=new Date(validTrialStart.getTime()+14*24*60*60*1000).toISOString();
    const status=new Date(trialEndsAt).getTime()>now.getTime()?'trialing':'free';
    const timestamp=now.toISOString();
    await database().prepare("INSERT INTO subscriptions (user_id,plan_id,status,billing_cycle,trial_ends_at,created_at,updated_at) VALUES (?,'free',?,'monthly',?,?,?)")
      .bind(userId,status,trialEndsAt,timestamp,timestamp).run();
    subscription=await database().prepare('SELECT * FROM subscriptions WHERE user_id=?').bind(userId).first<SubscriptionRecord>();
  } else if (subscription.status==='active'&&subscription.cancel_at_period_end&&subscription.current_period_end&&new Date(subscription.current_period_end).getTime()<=now.getTime()) {
    await database().prepare("UPDATE subscriptions SET plan_id='free',status='free',requested_plan_id=NULL,provider_subscription_id=NULL,updated_at=? WHERE user_id=?")
      .bind(now.toISOString(),userId).run();
    subscription={...subscription,plan_id:'free',status:'free',requested_plan_id:null,provider_subscription_id:null,updated_at:now.toISOString()};
  } else if (subscription.status==='trialing'&&new Date(subscription.trial_ends_at).getTime()<=now.getTime()) {
    await database().prepare("UPDATE subscriptions SET plan_id='free',status='free',updated_at=? WHERE user_id=?")
      .bind(now.toISOString(),userId).run();
    subscription={...subscription,plan_id:'free',status:'free',updated_at:now.toISOString()};
  }
  return subscription;
}

export async function getOrderUsageLast30Days(userId:string) {
  await ensureSchema();
  const since=new Date(Date.now()-30*24*60*60*1000).toISOString();
  const row=await database().prepare("SELECT COUNT(*) AS orders FROM orders WHERE user_id=? AND source_created_at>=? AND total>0 AND lower(status) NOT IN ('cancelled','canceled','voided') AND lower(payment_status) NOT IN ('refunded','voided')")
    .bind(userId,since).first<{orders:number}>();
  return Number(row?.orders||0);
}

export async function saveRequestedPlan(userId:string,planId:string,billingCycle:string,termsVersion:string) {
  const subscription=await getOrCreateSubscription(userId);
  if (!subscription) return null;
  const now=new Date().toISOString();
  await database().prepare('UPDATE subscriptions SET requested_plan_id=?,billing_cycle=?,terms_version=?,terms_accepted_at=?,cancel_at_period_end=FALSE,canceled_at=NULL,canceled_by=NULL,updated_at=? WHERE user_id=?')
    .bind(planId,billingCycle,termsVersion,now,now,userId).run();
  return database().prepare('SELECT * FROM subscriptions WHERE user_id=?').bind(userId).first<SubscriptionRecord>();
}

export async function ensureTiendanubeAccount(userId:string, storeId:string) {
  await ensureSchema();
  const existing = await getAccount(userId);
  if (existing) return existing;
  const now = new Date().toISOString();
  await database().prepare("INSERT INTO accounts (user_id,email,owner_name,store_name,country,currency,trial_started_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .bind(userId,`pending+tiendanube-${storeId}@rentia.invalid`,'','Tienda Tiendanube','AR','ARS',now,now,now).run();
  return getAccount(userId);
}

export async function getSettings(userId:string) {
  await ensureSchema();
  return database().prepare("SELECT primary_channel, shipping_cost_ars, shipping_mode, commission_percent, tax_percent, tiendanube_plan_name, pago_nube_plan_override, pago_nube_payout_days, onboarding_complete FROM store_settings WHERE user_id = ?")
    .bind(userId).first<{primary_channel:string|null;shipping_cost_ars:number;shipping_mode:string;commission_percent:number;tax_percent:number;tiendanube_plan_name:string|null;pago_nube_plan_override:string|null;pago_nube_payout_days:number|null;onboarding_complete:number}>();
}

export async function saveTiendanubePlan(userId:string,planName:string|null) {
  await ensureSchema();
  const now=new Date().toISOString();
  await database().prepare("INSERT INTO store_settings (user_id,tiendanube_plan_name,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET tiendanube_plan_name=excluded.tiendanube_plan_name,updated_at=excluded.updated_at")
    .bind(userId,planName,now).run();
}

export async function saveChannels(userId:string, channels:string[]) {
  await ensureSchema();
  const now = new Date().toISOString();
  await database().prepare("INSERT INTO store_settings (user_id,primary_channel,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET primary_channel=excluded.primary_channel,updated_at=excluded.updated_at")
    .bind(userId,channels.join(','),now).run();
}

// One statement, so costs and Pago Nube options are saved together or not at all.
export async function saveCostSettings(userId:string,input:{shipping:number;shippingMode:'actual'|'average_only';fees:number;taxes:number;pagoNubePayoutDays:number|null;pagoNubePlan:string|null}) {
  await ensureSchema();
  const now = new Date().toISOString();
  await database().prepare("INSERT INTO store_settings (user_id,shipping_cost_ars,shipping_mode,commission_percent,tax_percent,pago_nube_payout_days,pago_nube_plan_override,onboarding_complete,updated_at) VALUES (?,?,?,?,?,?,?,1,?) ON CONFLICT(user_id) DO UPDATE SET shipping_cost_ars=excluded.shipping_cost_ars,shipping_mode=excluded.shipping_mode,commission_percent=excluded.commission_percent,tax_percent=excluded.tax_percent,pago_nube_payout_days=excluded.pago_nube_payout_days,pago_nube_plan_override=excluded.pago_nube_plan_override,onboarding_complete=1,updated_at=excluded.updated_at")
    .bind(userId,input.shipping,input.shippingMode,input.fees,input.taxes,input.pagoNubePayoutDays,input.pagoNubePlan,now).run();
}

export async function createOAuthState(userId:string, provider:string, state:string) {
  await ensureSchema();
  const created = new Date();
  const expires = new Date(created.getTime()+10*60*1000);
  await database().prepare("DELETE FROM oauth_states WHERE expires_at < ?").bind(created.toISOString()).run();
  await database().prepare("INSERT INTO oauth_states (state,user_id,provider,expires_at,created_at) VALUES (?,?,?,?,?)").bind(state,userId,provider,expires.toISOString(),created.toISOString()).run();
}

export async function consumeOAuthState(state:string, provider:string) {
  await ensureSchema();
  const record = await database().prepare("SELECT user_id, expires_at FROM oauth_states WHERE state = ? AND provider = ?").bind(state,provider).first<{user_id:string;expires_at:string}>();
  await database().prepare("DELETE FROM oauth_states WHERE state = ?").bind(state).run();
  if (!record || new Date(record.expires_at).getTime() < Date.now()) return null;
  return record.user_id;
}

export async function saveIntegration(input:{userId:string;provider:string;storeId:string;encryptedToken:string;iv:string;scopes:string}) {
  await ensureSchema();
  const now = new Date().toISOString();
  await database().prepare("INSERT INTO integrations (user_id,provider,external_store_id,encrypted_access_token,token_iv,scopes,connected_at,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(user_id,provider,external_store_id) DO UPDATE SET encrypted_access_token=excluded.encrypted_access_token,token_iv=excluded.token_iv,scopes=excluded.scopes,status='connected',updated_at=excluded.updated_at")
    .bind(input.userId,input.provider,input.storeId,input.encryptedToken,input.iv,input.scopes,now,now).run();
}

export async function getIntegrationUser(provider:string, storeId:string) {
  await ensureSchema();
  return database().prepare("SELECT user_id FROM integrations WHERE provider = ? AND external_store_id = ? AND status = 'connected' ORDER BY updated_at DESC LIMIT 1")
    .bind(provider,storeId).first<{user_id:string}>();
}

export async function getIntegrations(userId:string) {
  await ensureSchema();
  return database().prepare("SELECT provider, external_store_id, scopes, status, connected_at FROM integrations WHERE user_id = ? ORDER BY connected_at DESC")
    .bind(userId).all<{provider:string;external_store_id:string;scopes:string;status:string;connected_at:string}>();
}

export async function getIntegrationCredentials(userId:string,provider:string) {
  await ensureSchema();
  return database().prepare("SELECT external_store_id, encrypted_access_token, token_iv, scopes, status FROM integrations WHERE user_id = ? AND provider = ? AND status = 'connected' ORDER BY updated_at DESC LIMIT 1")
    .bind(userId,provider).first<{external_store_id:string;encrypted_access_token:string;token_iv:string;scopes:string;status:string}>();
}

export async function registerWebhookEvent(input:{provider:string;eventKey:string;userId:string|null;storeId:string;eventType:string;resourceId:string|null;payloadJson:string}) {
  await ensureSchema();
  const now=new Date().toISOString();
  await database().prepare("INSERT INTO webhook_events (provider,event_key,user_id,external_store_id,event_type,resource_id,payload_json,status,received_at,updated_at) VALUES (?,?,?,?,?,?,?,'pending',?,?) ON CONFLICT DO NOTHING")
    .bind(input.provider,input.eventKey,input.userId,input.storeId,input.eventType,input.resourceId,input.payloadJson,now,now).run();
  if (input.userId) await database().prepare('UPDATE webhook_events SET user_id=COALESCE(user_id,?) WHERE event_key=?').bind(input.userId,input.eventKey).run();
  const event=await database().prepare('SELECT * FROM webhook_events WHERE event_key=?').bind(input.eventKey).first<WebhookEventRecord>();
  if (!event) throw new Error('No pudimos registrar el webhook');
  if (event.status==='processed') return {event,claimed:false,duplicate:true};
  const staleBefore=new Date(Date.now()-5*60*1000).toISOString();
  const claim=await database().prepare("UPDATE webhook_events SET status='processing',attempts=attempts+1,last_error=NULL,next_retry_at=NULL,updated_at=? WHERE id=? AND (status IN ('pending','failed') OR (status='processing' AND updated_at<?))")
    .bind(now,event.id,staleBefore).run();
  const claimed=Number(claim.meta.changes||0)>0;
  const current=claimed?await database().prepare('SELECT * FROM webhook_events WHERE id=?').bind(event.id).first<WebhookEventRecord>():event;
  return {event:current||event,claimed,duplicate:!claimed};
}

export async function getRetryableWebhookEvents(provider:string,userId:string,limit=20) {
  await ensureSchema();
  const now=new Date().toISOString();
  const staleBefore=new Date(Date.now()-5*60*1000).toISOString();
  return database().prepare("SELECT * FROM webhook_events WHERE provider=? AND user_id=? AND ((status='failed' AND (next_retry_at IS NULL OR next_retry_at<=?)) OR (status='processing' AND updated_at<?)) ORDER BY received_at LIMIT ?")
    .bind(provider,userId,now,staleBefore,limit).all<WebhookEventRecord>();
}

export async function claimWebhookEvent(eventId:number) {
  await ensureSchema();
  const now=new Date().toISOString();
  const staleBefore=new Date(Date.now()-5*60*1000).toISOString();
  const result=await database().prepare("UPDATE webhook_events SET status='processing',attempts=attempts+1,last_error=NULL,next_retry_at=NULL,updated_at=? WHERE id=? AND ((status='failed' AND (next_retry_at IS NULL OR next_retry_at<=?)) OR (status='processing' AND updated_at<?))")
    .bind(now,eventId,now,staleBefore).run();
  if (!Number(result.meta.changes||0)) return null;
  return database().prepare('SELECT * FROM webhook_events WHERE id=?').bind(eventId).first<WebhookEventRecord>();
}

export async function markWebhookEventProcessed(eventId:number,userId:string|null) {
  await ensureSchema();
  const now=new Date().toISOString();
  await database().prepare("UPDATE webhook_events SET user_id=COALESCE(user_id,?),status='processed',processed_at=?,last_error=NULL,next_retry_at=NULL,updated_at=? WHERE id=?")
    .bind(userId,now,now,eventId).run();
}

export async function markWebhookEventFailed(eventId:number,userId:string|null,message:string) {
  await ensureSchema();
  const event=await database().prepare('SELECT attempts FROM webhook_events WHERE id=?').bind(eventId).first<{attempts:number}>();
  const attempts=Math.max(1,Number(event?.attempts||1));
  const delayMs=Math.min(6*60*60*1000,Math.pow(2,Math.min(attempts-1,8))*60*1000);
  const now=new Date();
  await database().prepare("UPDATE webhook_events SET user_id=COALESCE(user_id,?),status='failed',last_error=?,next_retry_at=?,updated_at=? WHERE id=?")
    .bind(userId,message.slice(0,500),new Date(now.getTime()+delayMs).toISOString(),now.toISOString(),eventId).run();
}

export async function getSyncReliability(userId:string,provider:string) {
  await ensureSchema();
  const [events,lastRun]=await Promise.all([
    database().prepare("SELECT COUNT(*) AS total,SUM(CASE WHEN status='processed' THEN 1 ELSE 0 END) AS processed,SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed,SUM(CASE WHEN status IN ('pending','processing') THEN 1 ELSE 0 END) AS pending,MAX(received_at) AS last_received_at,MAX(processed_at) AS last_processed_at FROM webhook_events WHERE user_id=? AND provider=?").bind(userId,provider).first<Record<string,unknown>>(),
    database().prepare('SELECT trigger_source,status,summary_json,error,started_at,completed_at FROM reconciliation_runs WHERE user_id=? AND provider=? ORDER BY started_at DESC LIMIT 1').bind(userId,provider).first<Record<string,unknown>>(),
  ]);
  return {
    events:{total:Number(events?.total||0),processed:Number(events?.processed||0),failed:Number(events?.failed||0),pending:Number(events?.pending||0),lastReceivedAt:events?.last_received_at||null,lastProcessedAt:events?.last_processed_at||null},
    lastReconciliation:lastRun||null,
  };
}

export async function startReconciliationRun(userId:string,provider:string,triggerSource:string) {
  await ensureSchema();
  const run=await database().prepare("INSERT INTO reconciliation_runs (user_id,provider,trigger_source,status,started_at) VALUES (?,?,?,'running',?) RETURNING id")
    .bind(userId,provider,triggerSource,new Date().toISOString()).first<{id:number}>();
  return Number(run?.id);
}

export async function finishReconciliationRun(runId:number,status:'success'|'failed'|'pending',summary:unknown,error:string|null=null) {
  await ensureSchema();
  await database().prepare('UPDATE reconciliation_runs SET status=?,summary_json=?,error=?,completed_at=? WHERE id=?')
    .bind(status,JSON.stringify(summary),error?.slice(0,500)||null,new Date().toISOString(),runId).run();
}

export async function getTiendanubeUsersForReconciliation(staleBefore:string,limit=25) {
  await ensureSchema();
  const rows=await database().prepare("SELECT i.user_id FROM integrations i LEFT JOIN sync_status s ON s.user_id=i.user_id AND s.provider=i.provider LEFT JOIN sync_jobs j ON j.user_id=i.user_id AND j.provider=i.provider WHERE i.provider='tiendanube' AND i.status='connected' AND (s.last_completed_at IS NULL OR s.last_completed_at<? OR s.status='error' OR s.webhook_status='error' OR (j.state_json::jsonb->>'done') IN ('false','0')) GROUP BY i.user_id ORDER BY MIN(COALESCE(s.last_completed_at,'')) LIMIT ?")
    .bind(staleBefore,limit).all<{user_id:string}>();
  return rows.results.map(row=>row.user_id);
}

export async function claimImportJob(userId:string,provider:string,initialState:string,leaseMs=10*60*1000) {
  const now=Date.now(),token=crypto.randomUUID();
  const duration=Math.max(30_000,Math.min(10*60*1000,leaseMs));
  await database().prepare('INSERT INTO sync_jobs (user_id,provider,state_json,updated_at) VALUES (?,?,?,?) ON CONFLICT DO NOTHING').bind(userId,provider,initialState,new Date(now).toISOString()).run();
  const row=await database().prepare('UPDATE sync_jobs SET lease_token=?,lease_expires_at=? WHERE user_id=? AND provider=? AND (lease_token IS NULL OR lease_expires_at<?) RETURNING state_json').bind(token,now+duration,userId,provider,now).first<{state_json:string}>();
  return row?{token,stateJson:row.state_json}:null;
}

export async function checkpointImportJob(userId:string,provider:string,token:string,state:string,release=false,leaseMs=10*60*1000) {
  const now=Date.now();
  const duration=Math.max(30_000,Math.min(10*60*1000,leaseMs));
  const result=await database().prepare('UPDATE sync_jobs SET state_json=?,updated_at=?,lease_expires_at=?,lease_token=? WHERE user_id=? AND provider=? AND lease_token=?').bind(state,new Date(now).toISOString(),release?0:now+duration,release?null:token,userId,provider,token).run();
  if(!Number(result.meta.changes))throw new Error('Otro proceso retomó esta importación. El lote se volverá a verificar sin duplicar órdenes.');
}

export async function releaseImportJob(userId:string,provider:string,token:string) {
  await database().prepare('UPDATE sync_jobs SET lease_token=NULL,lease_expires_at=0 WHERE user_id=? AND provider=? AND lease_token=?').bind(userId,provider,token).run();
}

export async function markSyncPending(userId:string,provider:string,orders:number,products:number) {
  await database().prepare("UPDATE sync_status SET status='pending',orders_synced=?,products_synced=?,last_error=NULL WHERE user_id=? AND provider=?").bind(orders,products,userId,provider).run();
}

export async function getSyncStatus(userId:string,provider:string) {
  await ensureSchema();
  return database().prepare('SELECT status,last_started_at,last_completed_at,last_error,orders_synced,products_synced,details_version,webhook_status,last_webhook_at,webhooks_registered_at,webhook_error FROM sync_status WHERE user_id=? AND provider=?')
    .bind(userId,provider).first<{status:string;last_started_at:string|null;last_completed_at:string|null;last_error:string|null;orders_synced:number;products_synced:number;details_version:number;webhook_status:string;last_webhook_at:string|null;webhooks_registered_at:string|null;webhook_error:string|null}>();
}

export async function markSyncStarted(userId:string,provider:string) {
  await ensureSchema();
  const now=new Date().toISOString();
  await database().prepare("INSERT INTO sync_status (user_id,provider,status,last_started_at) VALUES (?,?,'running',?) ON CONFLICT(user_id,provider) DO UPDATE SET status='running',last_started_at=excluded.last_started_at,last_error=NULL")
    .bind(userId,provider,now).run();
}

export async function markSyncCompleted(userId:string,provider:string,orders:number,products:number,detailsVersion=1,completedAt?:string) {
  await ensureSchema();
  const now=new Date().toISOString();
  await database().prepare("INSERT INTO sync_status (user_id,provider,status,last_started_at,last_completed_at,orders_synced,products_synced,details_version) VALUES (?,?,'success',?,?,?,?,?) ON CONFLICT(user_id,provider) DO UPDATE SET status='success',last_completed_at=excluded.last_completed_at,last_error=NULL,orders_synced=excluded.orders_synced,products_synced=excluded.products_synced,details_version=excluded.details_version")
    .bind(userId,provider,now,completedAt||now,orders,products,detailsVersion).run();
}

export async function markSyncFailed(userId:string,provider:string,message:string) {
  await ensureSchema();
  await database().prepare("INSERT INTO sync_status (user_id,provider,status,last_started_at,last_error) VALUES (?,?,'error',?,?) ON CONFLICT(user_id,provider) DO UPDATE SET status='error',last_error=excluded.last_error")
    .bind(userId,provider,new Date().toISOString(),message.slice(0,500)).run();
}

export async function markWebhooksRegistered(userId:string,provider:string) {
  await ensureSchema();
  const now=new Date().toISOString();
  await database().prepare("INSERT INTO sync_status (user_id,provider,status,webhook_status,webhooks_registered_at) VALUES (?,?,'idle','active',?) ON CONFLICT(user_id,provider) DO UPDATE SET webhook_status='active',webhooks_registered_at=excluded.webhooks_registered_at,webhook_error=NULL")
    .bind(userId,provider,now).run();
}

export async function markWebhookProcessed(userId:string,provider:string) {
  await ensureSchema();
  const now=new Date().toISOString();
  await database().prepare("INSERT INTO sync_status (user_id,provider,status,last_completed_at,webhook_status,last_webhook_at) VALUES (?,?,'success',?,'active',?) ON CONFLICT(user_id,provider) DO UPDATE SET status='success',last_completed_at=excluded.last_completed_at,last_webhook_at=excluded.last_webhook_at,webhook_status='active',last_error=NULL,webhook_error=NULL")
    .bind(userId,provider,now,now).run();
}

export async function markWebhookFailed(userId:string,provider:string,message:string) {
  await ensureSchema();
  await database().prepare("INSERT INTO sync_status (user_id,provider,status,webhook_status,webhook_error) VALUES (?,?,'idle','error',?) ON CONFLICT(user_id,provider) DO UPDATE SET webhook_status='error',webhook_error=excluded.webhook_error")
    .bind(userId,provider,message.slice(0,500)).run();
}

export async function getVariantStoreCosts(userId:string,provider:string) {
  await ensureSchema();
  const rows=await database().prepare("SELECT external_variant_id,cost FROM product_variants WHERE user_id=? AND provider=?")
    .bind(userId,provider).all<{external_variant_id:string;cost:number}>();
  return new Map(rows.results.map(row=>[row.external_variant_id,Number(row.cost||0)]));
}

export async function archiveProduct(userId:string,provider:string,externalProductId:string) {
  await ensureSchema();
  const now=new Date().toISOString();
  await database().batch([
    database().prepare("UPDATE products SET published=0,source_updated_at=?,synced_at=? WHERE user_id=? AND provider=? AND external_product_id=?").bind(now,now,userId,provider,externalProductId),
    database().prepare("UPDATE product_variants SET stock=0,synced_at=? WHERE user_id=? AND provider=? AND external_product_id=?").bind(now,userId,provider,externalProductId),
  ]);
}

export async function disconnectIntegrationByStore(provider:string,storeId:string) {
  await ensureSchema();
  const integration=await getIntegrationUser(provider,storeId);
  const now=new Date().toISOString();
  await database().prepare("UPDATE integrations SET status='disconnected',updated_at=? WHERE provider=? AND external_store_id=?")
    .bind(now,provider,storeId).run();
  if (integration) await database().prepare("UPDATE sync_status SET webhook_status='disconnected',webhook_error=NULL WHERE user_id=? AND provider=?")
    .bind(integration.user_id,provider).run();
  return integration;
}

export async function upsertProducts(userId:string,provider:string,products:SyncedProduct[]) {
  await ensureSchema();
  const now=new Date().toISOString();
  const statements:Statement[]=[];
  for (const product of products) {
    statements.push(database().prepare("INSERT INTO products (user_id,provider,external_product_id,name,image_url,published,source_created_at,source_updated_at,synced_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,provider,external_product_id) DO UPDATE SET name=excluded.name,image_url=excluded.image_url,published=excluded.published,source_updated_at=excluded.source_updated_at,synced_at=excluded.synced_at")
      .bind(userId,provider,product.externalId,product.name,product.imageUrl,product.published?1:0,product.createdAt,product.updatedAt,now));
    for (const variant of product.variants) statements.push(database().prepare("INSERT INTO product_variants (user_id,provider,external_product_id,external_variant_id,sku,price,cost,stock,stock_management,synced_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,provider,external_variant_id) DO UPDATE SET external_product_id=excluded.external_product_id,sku=excluded.sku,price=excluded.price,cost=CASE WHEN excluded.cost>0 THEN excluded.cost ELSE product_variants.cost END,stock=excluded.stock,stock_management=excluded.stock_management,synced_at=excluded.synced_at")
      .bind(userId,provider,product.externalId,variant.externalId,variant.sku,variant.price,variant.cost,variant.stock,variant.stockManagement?1:0,now));
  }
  await runInChunks(statements);
}

export async function upsertOrders(userId:string,provider:string,orders:SyncedOrder[]) {
  await ensureSchema();
  const allowed=await allowedOrderIds(userId,provider,orders.map(order=>({externalId:order.externalId,createdAt:order.createdAt})));
  orders=orders.filter(order=>allowed.has(order.externalId));
  const now=new Date().toISOString();
  const groups:Statement[][]=[];
  for (const order of orders) {
    const statements:Statement[]=[];
    statements.push(database().prepare("INSERT INTO orders (user_id,provider,external_order_id,order_number,currency,status,payment_status,payment_method,payment_type,payment_installments,shipping_status,source_shipping_cost,total,subtotal,discount,source_created_at,source_updated_at,synced_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,provider,external_order_id) DO UPDATE SET order_number=excluded.order_number,currency=excluded.currency,status=excluded.status,payment_status=excluded.payment_status,payment_method=excluded.payment_method,payment_type=COALESCE(excluded.payment_type,orders.payment_type),payment_installments=COALESCE(excluded.payment_installments,orders.payment_installments),shipping_status=excluded.shipping_status,source_shipping_cost=excluded.source_shipping_cost,source_commission_cost=CASE WHEN orders.source_updated_at IS DISTINCT FROM excluded.source_updated_at THEN NULL ELSE orders.source_commission_cost END,source_commission_checked_at=CASE WHEN orders.source_updated_at IS DISTINCT FROM excluded.source_updated_at THEN NULL ELSE orders.source_commission_checked_at END,total=excluded.total,subtotal=excluded.subtotal,discount=excluded.discount,source_updated_at=excluded.source_updated_at,synced_at=excluded.synced_at")
      .bind(userId,provider,order.externalId,order.number,order.currency,order.status,order.paymentStatus,order.paymentMethod,order.paymentType,order.paymentInstallments,order.shippingStatus,order.shippingCost,order.total,order.subtotal,order.discount,order.createdAt,order.updatedAt,now));
    statements.push(database().prepare("DELETE FROM order_items WHERE user_id=? AND provider=? AND external_order_id=?").bind(userId,provider,order.externalId));
    // Nine lines use 99 parameters per statement, which keeps each insert small.
    for(let index=0;index<order.items.length;index+=9) {
      const items=order.items.slice(index,index+9);
      statements.push(database().prepare(`INSERT INTO order_items (user_id,provider,external_order_id,external_line_id,external_product_id,external_variant_id,name,sku,quantity,unit_price,unit_cost) VALUES ${items.map(()=>'(?,?,?,?,?,?,?,?,?,?,?)').join(',')}`)
        .bind(...items.flatMap(item=>[userId,provider,order.externalId,item.externalLineId,item.productId,item.variantId,item.name,item.sku,item.quantity,item.unitPrice,item.unitCost])));
    }
    groups.push(statements);
  }
  for(const batch of atomicBatches(groups))await database().batch(batch);
}

export async function getOrdersAwaitingSourceCommission(userId:string,provider:string,limit=20,checkedBefore=new Date().toISOString()) {
  await ensureSchema();
  const rows=await database().prepare("SELECT external_order_id,currency FROM orders WHERE user_id=? AND provider=? AND payment_status='paid' AND status!='cancelled' AND source_commission_cost IS NULL AND (source_commission_checked_at IS NULL OR source_commission_checked_at<?) ORDER BY source_commission_checked_at ASC,source_created_at DESC LIMIT ?")
    .bind(userId,provider,checkedBefore,limit).all<{external_order_id:string;currency:string}>();
  return rows.results;
}

export async function countOrdersAwaitingSourceCommission(userId:string,provider:string,checkedBefore?:string) {
  await ensureSchema();
  const statement=database().prepare(`SELECT COUNT(*) AS total FROM orders WHERE user_id=? AND provider=? AND payment_status='paid' AND status!='cancelled' AND source_commission_cost IS NULL ${checkedBefore?'AND (source_commission_checked_at IS NULL OR source_commission_checked_at<?)':''}`);
  const row=await (checkedBefore?statement.bind(userId,provider,checkedBefore):statement.bind(userId,provider)).first<{total:number}>();
  return Number(row?.total||0);
}

export async function resetSourceCommissionChecks(userId:string,provider:string) {
  await ensureSchema();
  await database().prepare("UPDATE orders SET source_commission_checked_at=NULL WHERE user_id=? AND provider=? AND payment_status='paid' AND status!='cancelled'")
    .bind(userId,provider).run();
}

export async function getOrderForCommissionLookup(userId:string,provider:string,externalOrderId:string) {
  await ensureSchema();
  return database().prepare("SELECT external_order_id,currency,payment_status,status FROM orders WHERE user_id=? AND provider=? AND external_order_id=?")
    .bind(userId,provider,externalOrderId).first<{external_order_id:string;currency:string;payment_status:string;status:string}>();
}

export async function saveSourceCommission(userId:string,provider:string,externalOrderId:string,cost:number|null) {
  await ensureSchema();
  await database().prepare("UPDATE orders SET source_commission_cost=?,source_commission_checked_at=? WHERE user_id=? AND provider=? AND external_order_id=?")
    .bind(cost,new Date().toISOString(),userId,provider,externalOrderId).run();
}

export async function saveManualCommission(userId:string,provider:string,externalOrderId:string,cost:number|null) {
  await ensureSchema();
  const result=await database().prepare("UPDATE orders SET manual_commission_cost=? WHERE user_id=? AND provider=? AND external_order_id=? AND lower(payment_status)='paid' AND lower(status)!='cancelled' AND total>=?")
    .bind(cost,userId,provider,externalOrderId,cost??0).run();
  return Number(result.meta.changes||0)>0;
}

export function analyticsWindow(days:number,offsetDays=0,range?:AnalyticsDateRange) {
  if (range) {
    const since=`${range.start}T00:00:00.000Z`;
    const untilValue=new Date(`${range.end}T00:00:00.000Z`);
    untilValue.setUTCDate(untilValue.getUTCDate()+1);
    const until=untilValue.toISOString();
    return {since,until,sinceDate:range.start,untilDate:until.slice(0,10)};
  }
  const periodEnd=new Date(Date.now()-offsetDays*24*60*60*1000);
  const since=new Date(periodEnd.getTime()-days*24*60*60*1000).toISOString();
  const until=periodEnd.toISOString();
  return {since,until,sinceDate:since.slice(0,10),untilDate:offsetDays?until.slice(0,10):'9999-12-31'};
}

export async function getDashboardData(userId:string,days:number,offsetDays=0,range?:AnalyticsDateRange) {
  await ensureSchema();
  const {since,until,sinceDate,untilDate}=analyticsWindow(days,offsetDays,range);
  const [products,sync,reliability,settings,costRules,externalRevenue,exchangeRate,paidTotals,methods]=await Promise.all([
    database().prepare("SELECT p.external_product_id,p.name,p.image_url,p.published,COUNT(pv.id) AS variants,COALESCE(SUM(CASE WHEN pv.stock IS NULL THEN 0 ELSE pv.stock END),0) AS stock,COALESCE(MIN(CASE WHEN COALESCE(pv.manual_cost,pv.cost)>0 THEN COALESCE(pv.manual_cost,pv.cost) END),0) AS min_cost,COALESCE(MIN(pv.price),0) AS min_price FROM products p LEFT JOIN product_variants pv ON pv.user_id=p.user_id AND pv.provider=p.provider AND pv.external_product_id=p.external_product_id WHERE p.user_id=? GROUP BY p.id ORDER BY p.name").bind(userId).all<Record<string,unknown>>(),
    database().prepare("SELECT status,last_started_at,last_completed_at,last_error,orders_synced,products_synced,webhook_status,last_webhook_at,webhooks_registered_at,webhook_error FROM sync_status WHERE user_id=? AND provider='tiendanube'").bind(userId).first<Record<string,unknown>>(),
    getSyncReliability(userId,'tiendanube'),
    getSettings(userId),
    getCostRules(userId),
    database().prepare("SELECT revenue_date,order_count,revenue,currency FROM external_revenue WHERE user_id=? AND revenue_date>=? AND revenue_date<? ORDER BY revenue_date").bind(userId,sinceDate,untilDate).all<Record<string,unknown>>(),
    getExchangeRateSettings(userId),
    database().prepare(PAID_TOTAL_SQL).bind(userId,since,until).first<{orders:number;revenue:number}>(),
    database().prepare("SELECT DISTINCT payment_method FROM orders WHERE user_id=? AND source_created_at>=? AND source_created_at<? AND payment_method IS NOT NULL ORDER BY payment_method").bind(userId,since,until).all<{payment_method:string}>(),
  ]);
  return {orders:iterateAnalyticsOrders(userId,days,offsetDays,range),products:products.results,sync:sync?{...sync,reliability}:sync,settings,costRules:costRules.results,externalRevenue:externalRevenue.results,exchangeRate,paidTotals:{orders:Number(paidTotals?.orders||0),revenue:Number(paidTotals?.revenue||0)},paymentMethods:methods.results.map(row=>row.payment_method)};
}

export async function* iterateAnalyticsOrders(userId:string,days:number,offsetDays=0,range?:AnalyticsDateRange,query='') {
  const {since,until}=analyticsWindow(days,offsetDays,range);
  let cursorDate='',cursorId=0;
  for (;;) {
    const batch=await database().prepare(ORDER_ANALYTICS_BATCH_SQL).bind(userId,since,until,query,cursorDate,cursorDate,cursorId,5000).all<AnalyticsOrder>();
    if (!batch.results.length) return;
    for (const row of batch.results) yield row;
    const last=batch.results[batch.results.length-1];
    cursorDate=String(last.source_created_at);cursorId=Number(last.cursor_id);
    if (batch.results.length<5000) return;
  }
}

export async function getOrdersPage(userId:string,days:number,range:AnalyticsDateRange|undefined,page=1,query='') {
  const {since,until}=analyticsWindow(days,0,range);
  const count=await database().prepare(ORDER_COUNT_SQL).bind(userId,since,until,query).first<{total:number}>();
  const total=Number(count?.total||0),pages=Math.max(1,Math.ceil(total/100));
  const current=Math.min(pages,Math.max(1,Math.floor(page)));
  const rows=await database().prepare(ORDER_PAGE_SQL).bind(userId,since,until,query,100,(current-1)*100).all<AnalyticsOrder>();
  const orders=[];
  // At most 75 ids per statement keeps each query small.
  const itemsByOrder=new Map<string,Record<string,unknown>[]>();
  const byProvider=new Map<string,string[]>();
  for (const row of rows.results) byProvider.set(row.provider,[...(byProvider.get(row.provider)||[]),row.external_order_id]);
  for (const [provider,ids] of byProvider) for (let index=0;index<ids.length;index+=75) {
    const part=ids.slice(index,index+75);
    const items=await database().prepare(`SELECT oi.external_order_id,oi.external_line_id,oi.external_product_id,oi.external_variant_id,oi.name,oi.sku,oi.quantity,oi.unit_price,${ITEM_UNIT_COST_SQL} AS unit_cost,${ITEM_COST_SOURCE_SQL} AS cost_source FROM order_items oi ${ITEM_COST_JOINS} WHERE oi.user_id=? AND oi.provider=? AND oi.external_order_id IN (${part.map(()=>'?').join(',')}) ORDER BY oi.id`).bind(userId,provider,...part).all<Record<string,unknown>>();
    for (const item of items.results) {const key=`${provider}:${item.external_order_id}`;const list=itemsByOrder.get(key)||[];list.push(item);itemsByOrder.set(key,list);}
  }
  for (const row of rows.results) orders.push({...row,items:itemsByOrder.get(`${row.provider}:${row.external_order_id}`)||[]});
  return {orders,pagination:{total,page:current,pages,pageSize:100}};
}

export async function saveOrderItemCost(userId:string,provider:string,orderId:string,lineId:string,cost:number|null) {
  if(cost===null) {
    const result=await database().prepare('DELETE FROM order_item_cost_overrides WHERE user_id=? AND provider=? AND external_order_id=? AND external_line_id=?').bind(userId,provider,orderId,lineId).run();
    return Number(result.meta.changes)>0;
  }
  const result=await database().prepare('INSERT INTO order_item_cost_overrides (user_id,provider,external_order_id,external_line_id,unit_cost,updated_at) SELECT user_id,provider,external_order_id,external_line_id,?,? FROM order_items WHERE user_id=? AND provider=? AND external_order_id=? AND external_line_id=? ON CONFLICT(user_id,provider,external_order_id,external_line_id) DO UPDATE SET unit_cost=excluded.unit_cost,updated_at=excluded.updated_at').bind(cost,new Date().toISOString(),userId,provider,orderId,lineId).run();
  return Number(result.meta.changes)>0;
}

export async function getPaidOrderTotals(userId:string,days:number,range?:AnalyticsDateRange) {
  const {since,until}=analyticsWindow(days,0,range);
  const row=await database().prepare(PAID_TOTAL_SQL).bind(userId,since,until).first<{orders:number;revenue:number}>();
  return {orders:Number(row?.orders||0),revenue:Number(row?.revenue||0)};
}

export async function getExternalRevenue(userId:string,from:string,to:string) {
  await ensureSchema();
  return database().prepare("SELECT revenue_date,order_count,revenue,currency,updated_at FROM external_revenue WHERE user_id=? AND revenue_date>=? AND revenue_date<=? ORDER BY revenue_date")
    .bind(userId,from,to).all<Record<string,unknown>>();
}

export async function saveExternalRevenueMonth(userId:string,month:string,entries:ExternalRevenueEntry[]) {
  await ensureSchema();
  const now=new Date().toISOString();
  const statements:Statement[]=[database().prepare("DELETE FROM external_revenue WHERE user_id=? AND revenue_date LIKE ?").bind(userId,`${month}-%`)];
  for (const entry of entries) {
    if (entry.orderCount===0&&entry.revenue===0) continue;
    statements.push(database().prepare("INSERT INTO external_revenue (user_id,revenue_date,order_count,revenue,currency,updated_at) VALUES (?,?,?,?,?,?)")
      .bind(userId,entry.revenueDate,entry.orderCount,entry.revenue,entry.currency,now));
  }
  // Un mes completo en una sola transacción: el panel nunca ve el mes vacío a mitad del guardado.
  await database().batch(statements);
}

export async function getExchangeRateSettings(userId:string) {
  await ensureSchema();
  return database().prepare("SELECT rate_type,base_rate,adjustment_percent,updated_at FROM exchange_rate_settings WHERE user_id=?")
    .bind(userId).first<ExchangeRateSettings>();
}

export async function saveExchangeRateSettings(userId:string,input:{rateType:string;baseRate:number;adjustmentPercent:number}) {
  await ensureSchema();
  const now=new Date().toISOString();
  await database().prepare("INSERT INTO exchange_rate_settings (user_id,rate_type,base_rate,adjustment_percent,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET rate_type=excluded.rate_type,base_rate=excluded.base_rate,adjustment_percent=excluded.adjustment_percent,updated_at=excluded.updated_at")
    .bind(userId,input.rateType,input.baseRate,input.adjustmentPercent,now).run();
}

export async function getDashboardPreferences(userId:string) {
  await ensureSchema();
  return database().prepare("SELECT layout_json,updated_at FROM dashboard_preferences WHERE user_id=?")
    .bind(userId).first<{layout_json:string;updated_at:string}>();
}

export async function saveDashboardPreferences(userId:string,layoutJson:string) {
  await ensureSchema();
  const now=new Date().toISOString();
  await database().prepare("INSERT INTO dashboard_preferences (user_id,layout_json,updated_at) VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET layout_json=excluded.layout_json,updated_at=excluded.updated_at")
    .bind(userId,layoutJson,now).run();
  return now;
}

export async function upsertMetaAdAccounts(userId:string,accounts:MetaAdAccountInput[]) {
  await ensureSchema();
  const now=new Date().toISOString();
  const selected=await database().prepare("SELECT external_account_id FROM meta_ad_accounts WHERE user_id=? AND selected=1 LIMIT 1").bind(userId).first<{external_account_id:string}>();
  const defaultId=selected?.external_account_id||accounts[0]?.externalId||null;
  const statements=accounts.map(account=>database().prepare("INSERT INTO meta_ad_accounts (user_id,external_account_id,name,currency,timezone_name,account_status,selected,synced_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(user_id,external_account_id) DO UPDATE SET name=excluded.name,currency=excluded.currency,timezone_name=excluded.timezone_name,account_status=excluded.account_status,synced_at=excluded.synced_at")
    .bind(userId,account.externalId,account.name,account.currency,account.timezoneName,account.accountStatus,account.externalId===defaultId?1:0,now));
  await runInChunks(statements);
  if (defaultId) await selectMetaAdAccount(userId,defaultId);
}

export async function getMetaAdAccounts(userId:string) {
  await ensureSchema();
  return database().prepare("SELECT external_account_id,name,currency,timezone_name,account_status,selected,synced_at FROM meta_ad_accounts WHERE user_id=? ORDER BY selected DESC,name")
    .bind(userId).all<Record<string,unknown>>();
}

export async function getSelectedMetaAdAccount(userId:string) {
  await ensureSchema();
  return database().prepare("SELECT external_account_id,name,currency,timezone_name,account_status,selected,synced_at FROM meta_ad_accounts WHERE user_id=? AND selected=1 LIMIT 1")
    .bind(userId).first<{external_account_id:string;name:string;currency:string;timezone_name:string|null;account_status:number;selected:number;synced_at:string}>();
}

export async function selectMetaAdAccount(userId:string,externalAccountId:string) {
  await ensureSchema();
  const exists=await database().prepare("SELECT external_account_id FROM meta_ad_accounts WHERE user_id=? AND external_account_id=?").bind(userId,externalAccountId).first();
  if (!exists) return false;
  await database().batch([
    database().prepare("UPDATE meta_ad_accounts SET selected=0 WHERE user_id=?").bind(userId),
    database().prepare("UPDATE meta_ad_accounts SET selected=1 WHERE user_id=? AND external_account_id=?").bind(userId,externalAccountId),
  ]);
  return true;
}

export async function replaceMetaCampaignsAndInsights(userId:string,accountId:string,campaigns:MetaCampaignInput[],insights:MetaInsightInput[],fromDate:string) {
  await ensureSchema();
  const now=new Date().toISOString();
  // Se actualiza en el lugar y recién al final se borran los días que Meta ya no informa:
  // si el panel lee a mitad de la sincronización, nunca ve la inversión a medio cargar.
  const statements:Statement[]=[];
  for (const campaign of campaigns) statements.push(database().prepare("INSERT INTO meta_campaigns (user_id,external_account_id,external_campaign_id,name,status,effective_status,daily_budget,lifetime_budget,synced_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,external_campaign_id) DO UPDATE SET external_account_id=excluded.external_account_id,name=excluded.name,status=excluded.status,effective_status=excluded.effective_status,daily_budget=excluded.daily_budget,lifetime_budget=excluded.lifetime_budget,synced_at=excluded.synced_at")
    .bind(userId,accountId,campaign.externalId,campaign.name,campaign.status,campaign.effectiveStatus,campaign.dailyBudget,campaign.lifetimeBudget,now));
  for (const insight of insights) statements.push(database().prepare("INSERT INTO meta_insights_daily (user_id,external_account_id,external_campaign_id,insight_date,spend,impressions,clicks,purchases,purchase_value,synced_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,external_account_id,external_campaign_id,insight_date) DO UPDATE SET spend=excluded.spend,impressions=excluded.impressions,clicks=excluded.clicks,purchases=excluded.purchases,purchase_value=excluded.purchase_value,synced_at=excluded.synced_at")
    .bind(userId,accountId,insight.campaignId,insight.date,insight.spend,insight.impressions,insight.clicks,insight.purchases,insight.purchaseValue,now));
  await runInChunks(statements);
  await database().prepare("DELETE FROM meta_insights_daily WHERE user_id=? AND external_account_id=? AND insight_date>=? AND synced_at<>?").bind(userId,accountId,fromDate,now).run();
}

export async function getMetaAnalyticsData(userId:string,days:number,offsetDays=0,range?:AnalyticsDateRange) {
  await ensureSchema();
  const window=analyticsWindow(days,offsetDays,range);
  const since=window.sinceDate;
  const until=window.untilDate;
  const [accounts,selected,summary,campaigns,daily,sync]=await Promise.all([
    getMetaAdAccounts(userId),
    getSelectedMetaAdAccount(userId),
    database().prepare("SELECT COALESCE(SUM(i.spend),0) AS spend,COALESCE(SUM(i.impressions),0) AS impressions,COALESCE(SUM(i.clicks),0) AS clicks,COALESCE(SUM(i.purchases),0) AS purchases,COALESCE(SUM(i.purchase_value),0) AS purchase_value FROM meta_insights_daily i JOIN meta_ad_accounts a ON a.user_id=i.user_id AND a.external_account_id=i.external_account_id AND a.selected=1 WHERE i.user_id=? AND i.insight_date>=? AND i.insight_date<?").bind(userId,since,until).first<Record<string,unknown>>(),
    database().prepare("SELECT c.external_campaign_id,c.name,c.status,c.effective_status,c.daily_budget,c.lifetime_budget,COALESCE(SUM(i.spend),0) AS spend,COALESCE(SUM(i.impressions),0) AS impressions,COALESCE(SUM(i.clicks),0) AS clicks,COALESCE(SUM(i.purchases),0) AS purchases,COALESCE(SUM(i.purchase_value),0) AS purchase_value FROM meta_campaigns c JOIN meta_ad_accounts a ON a.user_id=c.user_id AND a.external_account_id=c.external_account_id AND a.selected=1 LEFT JOIN meta_insights_daily i ON i.user_id=c.user_id AND i.external_account_id=c.external_account_id AND i.external_campaign_id=c.external_campaign_id AND i.insight_date>=? AND i.insight_date<? WHERE c.user_id=? GROUP BY c.id ORDER BY spend DESC,c.name LIMIT 500").bind(since,until,userId).all<Record<string,unknown>>(),
    database().prepare("SELECT i.insight_date AS date,COALESCE(SUM(i.spend),0) AS spend,COALESCE(SUM(i.impressions),0) AS impressions,COALESCE(SUM(i.clicks),0) AS clicks,COALESCE(SUM(i.purchases),0) AS purchases,COALESCE(SUM(i.purchase_value),0) AS purchase_value FROM meta_insights_daily i JOIN meta_ad_accounts a ON a.user_id=i.user_id AND a.external_account_id=i.external_account_id AND a.selected=1 WHERE i.user_id=? AND i.insight_date>=? AND i.insight_date<? GROUP BY i.insight_date ORDER BY i.insight_date").bind(userId,since,until).all<Record<string,unknown>>(),
    getSyncStatus(userId,'meta'),
  ]);
  return {accounts:accounts.results,selected,summary:summary||{spend:0,impressions:0,clicks:0,purchases:0,purchase_value:0},campaigns:campaigns.results,daily:daily.results,sync};
}

export type ProductCostUpdate = {variantId:number;manualCost:number|null};

export async function getProductCostRows(userId:string) {
  await ensureSchema();
  return database().prepare("SELECT p.id AS product_id,p.rentia_archived,pv.id AS variant_id,pv.provider,pv.external_variant_id,pv.sku,pv.price,pv.cost AS store_cost,pv.manual_cost,COALESCE(pv.manual_cost,pv.cost,0) AS effective_cost,pv.stock,p.name AS product_name,p.image_url,CASE WHEN pv.manual_cost IS NOT NULL THEN 'manual' WHEN pv.cost>0 THEN 'tiendanube' ELSE 'sin_costo' END AS cost_source FROM product_variants pv JOIN products p ON p.user_id=pv.user_id AND p.provider=pv.provider AND p.external_product_id=pv.external_product_id WHERE pv.user_id=? ORDER BY p.name,pv.id")
    .bind(userId).all<Record<string,unknown>>();
}

// One statement per 1,000 variants (array parameters), all in one transaction.
export async function saveManualProductCosts(userId:string,updates:ProductCostUpdate[]) {
  await ensureSchema();
  const now=new Date().toISOString();
  const statements:Statement[]=[];
  for (let index=0;index<updates.length;index+=1000) {
    const chunk=updates.slice(index,index+1000);
    statements.push(database().prepare("UPDATE product_variants AS pv SET manual_cost=u.cost,manual_cost_updated_at=CASE WHEN u.cost IS NULL THEN NULL ELSE ? END FROM unnest(?::bigint[],?::double precision[]) AS u(id,cost) WHERE pv.id=u.id AND pv.user_id=?")
      .bind(now,chunk.map(update=>update.variantId),chunk.map(update=>update.manualCost),userId));
  }
  await database().batch(statements);
}

export async function setProductArchived(userId:string,productId:number,archived:boolean) {
  await ensureSchema();
  const result=await database().prepare('UPDATE products SET rentia_archived=? WHERE id=? AND user_id=? RETURNING id').bind(archived?1:0,productId,userId).first<{id:number}>();
  return Boolean(result);
}

export async function getProductAnalyticsData(userId:string,days:number,range?:AnalyticsDateRange) {
  await ensureSchema();
  const {since,until}=analyticsWindow(days,0,range);
  const [catalog,totals,settings,costRules]=await Promise.all([
    database().prepare("SELECT p.id AS product_id,p.rentia_archived,pv.id AS variant_id,pv.provider,pv.external_product_id,pv.external_variant_id,pv.sku,pv.price,COALESCE(pv.manual_cost,pv.cost,0) AS effective_cost,pv.stock,p.name AS product_name,p.image_url,CASE WHEN pv.manual_cost IS NOT NULL THEN 'manual' WHEN pv.cost>0 THEN 'tiendanube' ELSE 'sin_costo' END AS cost_source FROM product_variants pv JOIN products p ON p.user_id=pv.user_id AND p.provider=pv.provider AND p.external_product_id=pv.external_product_id WHERE pv.user_id=? ORDER BY p.name,pv.id").bind(userId).all<Record<string,unknown>>(),
    database().prepare(PAID_TOTAL_SQL).bind(userId,since,until).first<{orders:number;revenue:number}>(),
    getSettings(userId),
    getCostRules(userId),
  ]);
  return {catalog:catalog.results,sales:iterateProductSales(userId,since,until),totalRevenue:Number(totals?.revenue||0),settings,costRules:costRules.results};
}

async function* iterateProductSales(userId:string,since:string,until:string) {
  let orderCursor=0,lineCursor=0;
  for (;;) {
    const batch=await database().prepare(PRODUCT_SALES_BATCH_SQL).bind(userId,since,until,orderCursor,orderCursor,lineCursor,5000).all<Record<string,unknown>>();
    if (!batch.results.length) return;
    for (const row of batch.results) yield row;
    const last=batch.results[batch.results.length-1];orderCursor=Number(last.order_cursor);lineCursor=Number(last.line_cursor);
    if (batch.results.length<5000) return;
  }
}

export type CostRuleInput={category:'commission'|'additional';name:string;matchValue:string|null;calculation:'hybrid'|'fixed_monthly'|'percentage_revenue';amount:number;percentage:number;startsAt:string|null;endsAt:string|null};

export async function getCostRules(userId:string) {
  await ensureSchema();
  return database().prepare("SELECT id,category,name,match_value,calculation,amount,percentage,starts_at,ends_at,enabled,created_at,updated_at FROM cost_rules WHERE user_id=? ORDER BY category,name,id")
    .bind(userId).all<Record<string,unknown>>();
}

export async function createCostRule(userId:string,input:CostRuleInput) {
  await ensureSchema();
  const now=new Date().toISOString();
  await database().prepare("INSERT INTO cost_rules (user_id,category,name,match_value,calculation,amount,percentage,starts_at,ends_at,enabled,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,1,?,?)")
    .bind(userId,input.category,input.name,input.matchValue,input.calculation,input.amount,input.percentage,input.startsAt,input.endsAt,now,now).run();
}

export async function deleteCostRule(userId:string,id:number) {
  await ensureSchema();
  await database().prepare("DELETE FROM cost_rules WHERE user_id=? AND id=?").bind(userId,id).run();
}

export async function createAppSession(userId:string, tokenHash:string, expiresAt:string) {
  await ensureSchema();
  const now = new Date().toISOString();
  await database().prepare("DELETE FROM app_sessions WHERE expires_at < ?").bind(now).run();
  await database().prepare("INSERT INTO app_sessions (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)")
    .bind(tokenHash,userId,expiresAt,now).run();
}

export async function getSessionUser(tokenHash:string) {
  await ensureSchema();
  return database().prepare("SELECT user_id FROM app_sessions WHERE token_hash = ? AND expires_at > ?")
    .bind(tokenHash,new Date().toISOString()).first<{user_id:string}>();
}

export async function deleteAppSession(tokenHash:string) {
  await ensureSchema();
  await database().prepare("DELETE FROM app_sessions WHERE token_hash = ?").bind(tokenHash).run();
}

// Límite mensual de órdenes por plan. Devuelve las órdenes que se pueden guardar y
// anota las que se omiten para recuperarlas cuando la tienda pase a un plan mayor.
export async function allowedOrderIds(userId:string,provider:string,orders:Array<{externalId:string;createdAt:string|null}>) {
  const all=new Set(orders.map(order=>order.externalId));
  if(!orders.length||!billingEnforced())return all;
  const limit=monthlyOrderLimit(await getOrCreateSubscription(userId));
  if(limit===null)return all;
  const existing=await database().prepare('SELECT external_order_id FROM orders WHERE user_id=? AND provider=? AND external_order_id = ANY(?::text[])')
    .bind(userId,provider,[...all]).all<{external_order_id:string}>();
  const allowed=new Set(existing.results.map(row=>row.external_order_id));
  const fresh=orders.filter(order=>!allowed.has(order.externalId)).sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
  const byMonth=new Map<string,typeof fresh>();
  for(const order of fresh){const key=monthKey(order.createdAt);byMonth.set(key,[...(byMonth.get(key)||[]),order]);}
  const now=new Date().toISOString();
  for(const [month,list] of byMonth) {
    const row=await database().prepare('SELECT COUNT(*) AS total FROM orders WHERE user_id=? AND left(source_created_at,7)=?').bind(userId,month).first<{total:number}>();
    let remaining=Math.max(0,limit-Number(row?.total||0));
    for(const order of list) {
      if(remaining>0){allowed.add(order.externalId);remaining--;continue;}
      await database().prepare('INSERT INTO skipped_orders (user_id,provider,external_order_id,source_created_at,skipped_at) VALUES (?,?,?,?,?) ON CONFLICT (user_id,provider,external_order_id) DO NOTHING')
        .bind(userId,provider,order.externalId,order.createdAt,now).run();
    }
  }
  const recovered=[...allowed].filter(id=>!existing.results.some(row=>row.external_order_id===id));
  if(recovered.length)await database().prepare('DELETE FROM skipped_orders WHERE user_id=? AND provider=? AND external_order_id = ANY(?::text[])').bind(userId,provider,recovered).run();
  return allowed;
}

export async function getOrderQuota(userId:string,now=new Date()) {
  const subscription=await getOrCreateSubscription(userId);
  const limit=monthlyOrderLimit(subscription,now.getTime());
  const month=now.toISOString().slice(0,7);
  const [used,skipped,pending]=await Promise.all([
    database().prepare('SELECT COUNT(*) AS total FROM orders WHERE user_id=? AND left(source_created_at,7)=?').bind(userId,month).first<{total:number}>(),
    database().prepare('SELECT COUNT(*) AS total FROM skipped_orders WHERE user_id=? AND left(source_created_at,7)=?').bind(userId,month).first<{total:number}>(),
    database().prepare('SELECT COUNT(*) AS total FROM skipped_orders WHERE user_id=?').bind(userId).first<{total:number}>(),
  ]);
  return {enforced:billingEnforced(),month,limit,used:Number(used?.total||0),skippedThisMonth:Number(skipped?.total||0),skippedTotal:Number(pending?.total||0)};
}

export async function getSkippedOrders(userId:string,provider:string,limit=50) {
  const rows=await database().prepare('SELECT external_order_id FROM skipped_orders WHERE user_id=? AND provider=? ORDER BY source_created_at LIMIT ?').bind(userId,provider,limit).all<{external_order_id:string}>();
  return rows.results.map(row=>row.external_order_id);
}

// Omitidas que ya entran en el plan actual (su mes tiene lugar). Vacío si el cobro no está activo.
export async function recoverableSkippedOrders(userId:string,provider:string,max=30) {
  if(!billingEnforced())return [] as string[];
  const limit=monthlyOrderLimit(await getOrCreateSubscription(userId));
  const rows=limit===null
    ?await database().prepare('SELECT external_order_id FROM skipped_orders WHERE user_id=? AND provider=? ORDER BY source_created_at LIMIT ?').bind(userId,provider,max).all<{external_order_id:string}>()
    :await database().prepare('SELECT s.external_order_id FROM skipped_orders s WHERE s.user_id=? AND s.provider=? AND (SELECT COUNT(*) FROM orders o WHERE o.user_id=s.user_id AND left(o.source_created_at,7)=left(s.source_created_at,7))<? ORDER BY s.source_created_at LIMIT ?').bind(userId,provider,limit,max).all<{external_order_id:string}>();
  return rows.results.map(row=>row.external_order_id);
}

export async function forgetSkippedOrder(userId:string,provider:string,externalOrderId:string) {
  await database().prepare('DELETE FROM skipped_orders WHERE user_id=? AND provider=? AND external_order_id=?').bind(userId,provider,externalOrderId).run();
}

// Baja pedida por el cliente. Con un plan pago activo, deja de renovarse y sigue hasta el
// final del período ya pagado. Sin plan pago, se borra la preferencia guardada.
export async function cancelSubscription(userId:string,actorId:string) {
  const subscription=await getOrCreateSubscription(userId);
  if(!subscription)return null;
  const now=new Date().toISOString();
  if(subscription.status==='active') {
    await database().prepare('UPDATE subscriptions SET cancel_at_period_end=TRUE,canceled_at=?,canceled_by=?,updated_at=? WHERE user_id=?').bind(now,actorId,now,userId).run();
  } else {
    await database().prepare('UPDATE subscriptions SET requested_plan_id=NULL,canceled_at=?,canceled_by=?,updated_at=? WHERE user_id=?').bind(now,actorId,now,userId).run();
  }
  return database().prepare('SELECT * FROM subscriptions WHERE user_id=?').bind(userId).first<SubscriptionRecord>();
}

// Huella de todo lo que entra en el cálculo del resumen. El panel la consulta cada 30 s
// y solo vuelve a calcular la ganancia cuando cambia: una consulta liviana en lugar de
// recorrer todas las órdenes del período. Incluye la hora porque la ventana avanza sola.
const DASHBOARD_VERSION_SQL=`SELECT concat_ws('|',
  (SELECT COUNT(*)::text||':'||COALESCE(MAX(synced_at),'')||':'||COALESCE(MAX(source_commission_checked_at),'')||':'||COALESCE(MAX(meli_post_sale_checked_at),'') FROM orders WHERE user_id=?),
  (SELECT COUNT(*)::text||':'||COALESCE(MAX(synced_at),'')||':'||COALESCE(MAX(manual_cost_updated_at),'') FROM product_variants WHERE user_id=?),
  (SELECT COUNT(*)::text||':'||COALESCE(MAX(synced_at),'') FROM products WHERE user_id=?),
  (SELECT COALESCE(MAX(updated_at),'') FROM store_settings WHERE user_id=?),
  (SELECT COUNT(*)::text||':'||COALESCE(MAX(updated_at),'') FROM cost_rules WHERE user_id=?),
  (SELECT COUNT(*)::text||':'||COALESCE(MAX(updated_at),'') FROM external_revenue WHERE user_id=?),
  (SELECT COALESCE(MAX(updated_at),'') FROM exchange_rate_settings WHERE user_id=?),
  (SELECT COUNT(*)::text||':'||COALESCE(MAX(updated_at),'') FROM order_item_cost_overrides WHERE user_id=?),
  (SELECT COUNT(*)::text||':'||COALESCE(MAX(synced_at),'') FROM meta_insights_daily WHERE user_id=?),
  (SELECT COALESCE(string_agg(external_account_id||':'||selected::text||':'||COALESCE(synced_at,''),',' ORDER BY external_account_id),'') FROM meta_ad_accounts WHERE user_id=?),
  (SELECT COUNT(*)::text||':'||COALESCE(MAX(imported_at),'') FROM meli_billing_entries WHERE user_id=?),
  (SELECT COALESCE(string_agg(advertiser_id||':'||selected::text||':'||COALESCE(last_completed_at,''),',' ORDER BY advertiser_id),'') FROM meli_ads_accounts WHERE user_id=?),
  (SELECT COUNT(*)::text FROM meli_ads_daily WHERE user_id=?),
  (SELECT COALESCE(string_agg(provider||':'||COALESCE(status,'')||':'||COALESCE(last_completed_at,'')||':'||COALESCE(last_error,'')||':'||COALESCE(webhook_status,''),',' ORDER BY provider),'') FROM sync_status WHERE user_id=?),
  (SELECT COUNT(*)::text||':'||COALESCE(MAX(updated_at),'') FROM integrations WHERE user_id=?)
) AS version`;

export async function getDashboardVersion(userId:string,now=new Date()) {
  const row=await database().prepare(DASHBOARD_VERSION_SQL).bind(...Array.from({length:15},()=>userId)).first<{version:string}>();
  return `${now.toISOString().slice(0,13)}|${row?.version||''}`;
}

// Errores inesperados agrupados por origen, ruta y mensaje. Nunca debe romper el pedido
// que lo reporta. Con 5000 tipos distintos guardados solo suma a los ya conocidos.
export type ErrorReportInput={source:'client'|'server';message:string;detail?:string|null;path?:string|null;userId?:string|null};
export async function recordError(input:ErrorReportInput) {
  const message=(input.message||'Error').slice(0,500),path=(input.path||'').slice(0,200),detail=input.detail?input.detail.slice(0,4000):null;
  const fingerprint=`${input.source}:${path}:${message}`,now=new Date().toISOString();
  const stored=await database().prepare('SELECT COUNT(*) AS total FROM error_reports').first<{total:number}>();
  if(Number(stored?.total||0)>=5000) {
    await database().prepare('UPDATE error_reports SET count=count+1,last_seen_at=? WHERE fingerprint=?').bind(now,fingerprint).run();
    return;
  }
  await database().prepare('INSERT INTO error_reports (fingerprint,source,path,message,detail,user_id,count,first_seen_at,last_seen_at) VALUES (?,?,?,?,?,?,1,?,?) ON CONFLICT(fingerprint) DO UPDATE SET count=error_reports.count+1,last_seen_at=excluded.last_seen_at,detail=COALESCE(excluded.detail,error_reports.detail),user_id=COALESCE(excluded.user_id,error_reports.user_id)')
    .bind(fingerprint,input.source,path,message,detail,input.userId??null,now,now).run();
}

export async function getRecentErrors(limit=50) {
  return database().prepare('SELECT source,path,message,detail,count,first_seen_at,last_seen_at FROM error_reports ORDER BY last_seen_at DESC LIMIT ?').bind(limit).all<Record<string,unknown>>();
}

// Umbrales de alertas de cada tienda; sin fila guardada se usan los valores por defecto.
export async function getAlertSettings(userId:string):Promise<AlertSettings> {
  const row=await database().prepare('SELECT margin_min,margin_drop,sales_drop,stock_days,campaign_min_spend,alert_email,weekly_email FROM alert_settings WHERE user_id=?').bind(userId).first<Record<string,unknown>>();
  if(!row)return {...defaultAlertSettings};
  return {marginMin:Number(row.margin_min),marginDrop:Number(row.margin_drop),salesDrop:Number(row.sales_drop),stockDays:Number(row.stock_days),campaignMinSpend:Number(row.campaign_min_spend),alertEmail:Boolean(row.alert_email),weeklyEmail:Boolean(row.weekly_email)};
}

export async function saveAlertSettings(userId:string,settings:AlertSettings) {
  await database().prepare('INSERT INTO alert_settings (user_id,margin_min,margin_drop,sales_drop,stock_days,campaign_min_spend,alert_email,weekly_email,updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET margin_min=excluded.margin_min,margin_drop=excluded.margin_drop,sales_drop=excluded.sales_drop,stock_days=excluded.stock_days,campaign_min_spend=excluded.campaign_min_spend,alert_email=excluded.alert_email,weekly_email=excluded.weekly_email,updated_at=excluded.updated_at')
    .bind(userId,settings.marginMin,settings.marginDrop,settings.salesDrop,settings.stockDays,settings.campaignMinSpend,settings.alertEmail,settings.weeklyEmail,new Date().toISOString()).run();
  return getAlertSettings(userId);
}

// Alertas vistas u ocultadas por persona. Se guardan 60 días: si la situación cambia, la
// alerta tiene otra clave y vuelve a aparecer como nueva.
export async function getAlertReads(userId:string,viewerId:string) {
  const rows=await database().prepare('SELECT alert_key,state FROM alert_reads WHERE user_id=? AND viewer_id=?').bind(userId,viewerId).all<{alert_key:string;state:'seen'|'dismissed'}>();
  return Object.fromEntries(rows.results.map(row=>[row.alert_key,row.state])) as Record<string,'seen'|'dismissed'>;
}

export async function saveAlertReads(userId:string,viewerId:string,keys:string[],state:'seen'|'dismissed') {
  const now=new Date().toISOString(),cutoff=new Date(Date.now()-60*24*60*60*1000).toISOString();
  // Una alerta ocultada no vuelve a "vista" si después se marcan todas como vistas.
  const statements=[database().prepare('DELETE FROM alert_reads WHERE user_id=? AND viewer_id=? AND updated_at<?').bind(userId,viewerId,cutoff),
    ...keys.map(key=>database().prepare(`INSERT INTO alert_reads (user_id,viewer_id,alert_key,state,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id,viewer_id,alert_key) DO UPDATE SET state=CASE WHEN alert_reads.state='dismissed' THEN 'dismissed' ELSE excluded.state END,updated_at=excluded.updated_at`).bind(userId,viewerId,key,state,now))];
  await database().batch(statements);
  return getAlertReads(userId,viewerId);
}
