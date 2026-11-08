import { NextResponse } from 'next/server';
import { verifyTiendanubeWebhook } from '../../../../../../lib/tiendanube';
import { handleTiendanubePrivacy, isPrivacyTopic } from '../../../../../../lib/tiendanube-privacy';

// Avisos de privacidad (LGPD) de Tiendanube, firmados con el secreto de la app como los demás.
export async function POST(request:Request,{params}:{params:Promise<{topic:string}>}) {
  const {topic}=await params;
  if (!isPrivacyTopic(topic)) return NextResponse.json({error:'not_found'},{status:404});
  const rawBody=await request.text();
  if (!await verifyTiendanubeWebhook(rawBody,request.headers.get('x-linkedstore-hmac-sha256'))) return NextResponse.json({error:'invalid_signature'},{status:401});
  let payload:unknown;
  try { payload=JSON.parse(rawBody); }
  catch { return NextResponse.json({error:'invalid_json'},{status:400}); }
  try {
    return NextResponse.json({ok:true,...await handleTiendanubePrivacy(topic,payload)});
  } catch {
    // Tiendanube reintenta si no recibe 2XX.
    return NextResponse.json({error:'privacy_failed'},{status:500});
  }
}
