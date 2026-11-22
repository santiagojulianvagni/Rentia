import { AD_PREVIEW_FORMATS, fetchMetaAdPreview } from '../../../../../lib/meta';
import { HttpError, route } from '../../../../../server/http/route';

// Vista previa de un anuncio de la cuenta elegida, como se ve en Instagram o Facebook.
export const GET=route({},async({user,request})=>{
  const params=new URL(request.url).searchParams;
  const adId=params.get('ad')||'';
  const format=(AD_PREVIEW_FORMATS as readonly string[]).includes(params.get('format')||'')?params.get('format') as typeof AD_PREVIEW_FORMATS[number]:'INSTAGRAM_STANDARD';
  if(!/^\d{5,25}$/.test(adId)) throw new HttpError(400,'invalid_ad');
  try {
    const preview=await fetchMetaAdPreview(user.id,adId,format);
    if(!preview) throw new HttpError(404,'ad_not_found');
    return preview;
  } catch(error) {
    if(error instanceof HttpError) throw error;
    throw new HttpError(502,'meta_unavailable');
  }
});
