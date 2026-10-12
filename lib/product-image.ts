// Solo se piden fotos por https a los servidores de Tiendanube y Mercado Libre.
const ALLOWED_HOSTS=['.mitiendanube.com','.tiendanube.com','.nuvemshop.com.br','.mlstatic.com'];

export function allowedImageUrl(value:string|null) {
  if(!value)return null;
  try {
    const url=new URL(value);
    if(url.protocol!=='https:'||url.username||url.password||url.port)return null;
    return ALLOWED_HOSTS.some(suffix=>url.hostname.endsWith(suffix))?url:null;
  } catch { return null; }
}
