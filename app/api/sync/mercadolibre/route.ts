import {after} from 'next/server';
import {HttpError,assertOrigin,route} from '../../../../server/http/route';
import {mercadoLibreConfigured,mercadoLibreOrigin} from '../../../../lib/mercadolibre';
import {getMeliSyncView,reconcileMercadoLibre} from '../../../../lib/mercadolibre-sync';

export const dynamic='force-dynamic';
const headers={'cache-control':'no-store'};

export const GET=route({},async({user})=>Response.json(await getMeliSyncView(user.id),{headers}));

export const POST=route({access:'manager',headers},async({user,request,url})=>{
  // Checked before the origin: an unconfigured app has no public origin to compare with.
  if(!mercadoLibreConfigured()) throw new HttpError(503,'mercadolibre_not_configured');
  assertOrigin(request,mercadoLibreOrigin());
  try {
    const work=reconcileMercadoLibre(user.id,url.searchParams.get('force')==='1');
    // Register this same bounded promise with after() (the platform's waitUntil) immediately,
    // before awaiting it. Reloading/closing the tab must not cancel a claimed
    // batch and leave its lease behind. This does not start a second import.
    after(work.then(()=>undefined,()=>undefined));
    return Response.json(await work,{headers});
  }catch{throw new HttpError(502,'mercadolibre_sync_unavailable');}
});
