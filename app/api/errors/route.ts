import { z } from 'zod';
import { recordError } from '../../../db/database';
import { getRentiaUser } from '../../../lib/session';

const Report=z.object({message:z.string().min(1).max(500),detail:z.string().max(4000).nullable().optional(),path:z.string().max(200).optional()});

// Errores del navegador. Acepta visitantes sin sesión (registro, sitio público), pero solo
// desde el propio sitio; nunca responde con detalles.
export async function POST(request:Request) {
  if(request.headers.get('origin')!==new URL(request.url).origin)return new Response(null,{status:403});
  const parsed=Report.safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return new Response(null,{status:400});
  const user=await getRentiaUser().catch(()=>null);
  await recordError({source:'client',message:parsed.data.message,detail:parsed.data.detail??null,path:parsed.data.path??'',userId:user?.id??null}).catch(()=>undefined);
  console.error(JSON.stringify({tag:'rentia-error',source:'client',path:parsed.data.path,message:parsed.data.message}));
  return new Response(null,{status:204});
}
