import { fetchMetaCreatives } from '../../../../lib/meta';
import { HttpError, route } from '../../../../server/http/route';

const PERIODS=new Set([7,14,30,90]);

// Creativos de Meta del período, consultados en el momento. Solo lectura.
export const GET=route({},async({user,request})=>{
  const requested=Number(new URL(request.url).searchParams.get('days')||30);
  const days=PERIODS.has(requested)?requested:30;
  const day=(offset:number)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()-offset*86400000));
  const since=day(days-1),until=day(0);
  try {
    const result=await fetchMetaCreatives(user.id,since,until);
    return {connected:true,since,until,...result};
  } catch(error) {
    if(error instanceof Error&&error.message==='meta_not_connected') return {connected:false,since,until,account:null,currency:null,ads:[]};
    throw new HttpError(502,'meta_unavailable');
  }
});
