import {database} from './client';
import {billingJob,readBillingProgress,type BillingEntry,type BillingGroup} from '../lib/meli-billing-data';

export async function billingState(userId:string,sellerId:string,group:BillingGroup,period:string) {
  const row=await database().prepare('SELECT state_json,lease_expires_at FROM sync_jobs WHERE user_id=? AND provider=?').bind(userId,billingJob(group,period)).first<{state_json:string;lease_expires_at:number}>();
  return {progress:readBillingProgress(row?.state_json||null,sellerId),leaseExpiresAt:row?.lease_expires_at||0};
}
function guard(){return "EXISTS (SELECT 1 FROM sync_jobs j JOIN integrations i ON i.user_id=j.user_id AND i.provider='mercadolibre' WHERE j.user_id=? AND j.provider=? AND j.lease_token=? AND j.lease_expires_at>? AND i.external_store_id=? AND i.status IN ('authorized','connected'))";}
export async function saveBillingPage(userId:string,sellerId:string,group:BillingGroup,period:string,token:string,generation:string,entries:BillingEntry[]) {
  if(!entries.length)return;
  const now=new Date().toISOString();
  const saved=await database().batch(entries.map(entry=>database().prepare(`INSERT INTO meli_billing_entries (user_id,seller_id,period,billing_group,detail_id,generation,name,code,direction,amount_cents,currency,created_at,order_ids,entry_json,imported_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ${guard()} ON CONFLICT(user_id,seller_id,period,billing_group,detail_id) DO UPDATE SET generation=excluded.generation,name=excluded.name,code=excluded.code,direction=excluded.direction,amount_cents=excluded.amount_cents,currency=excluded.currency,created_at=excluded.created_at,order_ids=excluded.order_ids,entry_json=excluded.entry_json,imported_at=excluded.imported_at`)
    .bind(userId,sellerId,period,group,entry.id,generation,entry.name,entry.code,entry.direction,entry.amountCents,entry.currency,entry.createdAt,JSON.stringify(entry.orderIds),JSON.stringify(entry),now,userId,billingJob(group,period),token,Date.now(),sellerId)));
  if(saved.some(result=>!Number(result.meta.changes)))throw new Error('mercadolibre_billing_lease_lost');
}
export async function finishBillingGeneration(userId:string,sellerId:string,group:BillingGroup,period:string,token:string,generation:string) {
  // The visible generation is published only after both document scans. Keep
  // older rows for recovery; generation filtering excludes them from totals.
  const valid=await database().prepare(`SELECT 1 AS valid WHERE ${guard()}`).bind(userId,billingJob(group,period),token,Date.now(),sellerId).first<{valid:number}>();
  if(!valid||!generation)throw new Error('mercadolibre_billing_lease_lost');
}
export async function billingReport(userId:string,sellerId:string,group:BillingGroup,period:string,page:number,query:string) {
  const {progress,leaseExpiresAt}=await billingState(userId,sellerId,group,period);
  const base='user_id=? AND seller_id=? AND period=? AND billing_group=? AND generation=?';
  const values=[userId,sellerId,period,group,progress?.generation||''];
  const totals=await database().prepare(`SELECT currency,direction,COUNT(*) AS count,SUM(amount_cents) AS "amountCents" FROM meli_billing_entries WHERE ${base} GROUP BY currency,direction`).bind(...values).all<{currency:string;direction:string;count:number;amountCents:number}>();
  const filter=query?" AND (strpos(lower(name),lower(?::text))>0 OR strpos(lower(code),lower(?::text))>0 OR detail_id=? OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(order_ids::jsonb) AS ids(value) WHERE ids.value=?))":'';
  const bindings=query?[...values,query,query,query,query]:values;
  const count=await database().prepare(`SELECT COUNT(*) AS total FROM meli_billing_entries WHERE ${base}${filter}`).bind(...bindings).first<{total:number}>();
  const total=count?.total||0,current=Math.max(1,Math.min(page,Math.ceil(total/100)||1));
  const entries=await database().prepare(`SELECT entry_json FROM meli_billing_entries WHERE ${base}${filter} ORDER BY created_at DESC,detail_id DESC LIMIT 100 OFFSET ?`).bind(...bindings,(current-1)*100).all<{entry_json:string}>();
  return {connected:true,group,period,progress:progress?{pending:progress.document<2,error:progress.error,retryAt:progress.retryAt,completedAt:progress.completedAt,startedAt:progress.startedAt}:null,leaseExpiresAt,totals:totals.results,entries:entries.results.map(row=>JSON.parse(row.entry_json) as BillingEntry),pagination:{page:current,total,pageSize:100}};
}
