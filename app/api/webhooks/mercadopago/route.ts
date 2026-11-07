import { NextResponse } from 'next/server';
import { recordError } from '../../../../db/database';
import { syncAuthorizedPayment, syncPreapproval } from '../../../../lib/billing-checkout';
import { verifyWebhookSignature } from '../../../../lib/mercadopago';

// Avisos de Mercado Pago sobre las suscripciones de Rentia. Solo se aceptan los firmados con
// la clave secreta del webhook, y el estado siempre se vuelve a leer de Mercado Pago.
export async function POST(request:Request) {
  const url=new URL(request.url);
  const body=await request.json().catch(()=>({})) as {type?:string;topic?:string;data?:{id?:string|number}};
  const type=url.searchParams.get('type')||body.type||url.searchParams.get('topic')||body.topic||'';
  const dataId=url.searchParams.get('data.id')||(body.data?.id!==undefined?String(body.data.id):null);
  const valid=verifyWebhookSignature({signature:request.headers.get('x-signature'),requestId:request.headers.get('x-request-id'),dataId,secret:process.env.MERCADOPAGO_WEBHOOK_SECRET});
  if(!valid)return NextResponse.json({error:'invalid_signature'},{status:401});
  try {
    if(type==='subscription_preapproval'||type==='preapproval')await syncPreapproval(dataId!);
    else if(type==='subscription_authorized_payment'||type==='authorized_payment')await syncAuthorizedPayment(dataId!);
  } catch(error) {
    await recordError({source:'server',path:'/api/webhooks/mercadopago',message:error instanceof Error?error.message:String(error),detail:`${type} ${dataId}`}).catch(()=>undefined);
    // 500: Mercado Pago reintenta el aviso más tarde.
    return NextResponse.json({error:'sync_failed'},{status:500});
  }
  return NextResponse.json({ok:true});
}
