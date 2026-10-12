import { getProductImageUrl } from '../../../../db/database';
import { allowedImageUrl } from '../../../../lib/product-image';
import { HttpError, route } from '../../../../server/http/route';

// Foto de un producto de la propia tienda, servida desde Rentia para poder dibujarla en la
// imagen para compartir.
const MAX_BYTES=5*1024*1024;

export const GET=route({},async({user,url})=>{
  const provider=url.searchParams.get('provider')||'',product=url.searchParams.get('product')||'';
  if(!['tiendanube','mercadolibre'].includes(provider)||!product||product.length>100)throw new HttpError(400,'invalid_product');
  const source=allowedImageUrl(await getProductImageUrl(user.id,provider,product));
  if(!source)throw new HttpError(404,'image_not_found');
  const response=await fetch(source,{redirect:'error',signal:AbortSignal.timeout(8000)}).catch(()=>null);
  const type=response?.headers.get('content-type')||'';
  if(!response?.ok||!/^image\/(png|jpe?g|webp|gif)$/i.test(type.split(';')[0].trim()))throw new HttpError(404,'image_not_found');
  const body=await response.arrayBuffer();
  if(body.byteLength>MAX_BYTES)throw new HttpError(413,'image_too_large');
  return new Response(body,{headers:{'content-type':type,'cache-control':'private, max-age=3600','x-content-type-options':'nosniff'}});
});
