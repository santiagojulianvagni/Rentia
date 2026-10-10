import { env } from '../../../../lib/env';
import { NextResponse } from 'next/server';
import { getTiendanubeUsersForReconciliation } from '../../../../db/database';
import { reconcileTiendanube } from '../../../../lib/tiendanube';
import {meliUsersForReconciliation} from '../../../../db/mercadolibre';
import {mercadoLibreConfigured} from '../../../../lib/mercadolibre';
import {reconcileMercadoLibre} from '../../../../lib/mercadolibre-sync';
import {meliAdsUsersForReconciliation,syncMeliAds} from '../../../../lib/meli-ads';

function secureEqual(left:string,right:string) {
  if (left.length!==right.length) return false;
  let difference=0;
  for (let index=0;index<left.length;index++) difference|=left.charCodeAt(index)^right.charCodeAt(index);
  return difference===0;
}

export async function POST(request:Request) {
  // Vercel Cron sends CRON_SECRET as a Bearer token; RENTIA_CRON_SECRET is the older name.
  const secret=env.CRON_SECRET||env.RENTIA_CRON_SECRET;
  const authorization=request.headers.get('authorization')||'';
  const supplied=authorization.startsWith('Bearer ')?authorization.slice(7):'';
  if (!secret) return NextResponse.json({error:'cron_not_configured'},{status:503});
  if (!supplied||!secureEqual(supplied,secret)) return NextResponse.json({error:'unauthorized'},{status:401});
  const staleBefore=new Date(Date.now()-20*60*1000).toISOString();
  const meliUsers=mercadoLibreConfigured()?await meliUsersForReconciliation(staleBefore,2):[];
  const meliWork=Promise.all(meliUsers.map(async userId=>{
    try{return {userId,ok:true,...await reconcileMercadoLibre(userId)};}
    catch{return {userId,ok:false,error:'mercadolibre_reconciliation_pending'};}
  }));
  const users=await getTiendanubeUsersForReconciliation(staleBefore,10);
  const results=[];
  for (const userId of users) {
    try {
      const result=await reconcileTiendanube(userId,request.url,'scheduled');
      results.push({userId,ok:true,orders:result.orders,products:result.products,recovered:result.retry.recovered});
    } catch (error) {
      results.push({userId,ok:false,error:error instanceof Error?error.message:'reconciliation_failed'});
    }
  }
  const mercadolibre=await meliWork;
  const productAds=mercadoLibreConfigured()?await Promise.all((await meliAdsUsersForReconciliation()).map(async userId=>({userId,...await syncMeliAds(userId)}))):[];
  return NextResponse.json({ok:true,processed:results.length+mercadolibre.length+productAds.length,results,mercadolibre,productAds});
}

// Vercel Cron Jobs call the path with GET.
export const GET=POST;
