// Prepara la imagen para compartir un logro: pide los datos extra que no están en el historial
// (producto estrella del período y provincias) y arma el contenido con lib/share-achievement.

import { achievementRange, achievementShare, type ShareExtras, type StarProduct } from '../../lib/share-achievement';
import type { AchievementEvent } from '../../lib/achievement-history';
import type { SalesDay } from '../../lib/mascot';
import type { ShareContent } from './share-card';

type ProductRow={product_name:string;units_sold:number;profit:number;image_url:string|null;provider:string;external_product_id:string;rentia_archived?:number};

async function getJson<T>(url:string):Promise<T|null> {
  try{const response=await fetch(url,{cache:'no-store'});return response.ok?await response.json() as T:null;}catch{return null;}
}

async function starProduct(start:string,end:string):Promise<StarProduct|null> {
  const data=await getJson<ProductRow[]|{rows?:ProductRow[];products?:ProductRow[]}>(`/api/products/analytics?start=${start}&end=${end}`);
  const rows=Array.isArray(data)?data:data?.rows||data?.products||[];
  const best=rows.filter(row=>!row.rentia_archived&&row.units_sold>0&&row.profit>0).sort((a,b)=>b.profit-a.profit)[0];
  if(!best)return null;
  const image=best.image_url?`/api/products/image?provider=${encodeURIComponent(best.provider)}&product=${encodeURIComponent(best.external_product_id)}`:null;
  return {name:best.product_name,units:best.units_sold,profit:best.profit,image};
}

export async function buildAchievementShare(event:AchievementEvent,days:SalesDay[],today:string,money:(value:number)=>string):Promise<ShareContent> {
  const extras:ShareExtras={};
  if(event.kind==='day'||event.kind==='week'||event.kind==='month'){
    const {start,end}=achievementRange(event,today);
    extras.product=await starProduct(start,end);
  }
  if(event.kind==='orders'){
    const first=days.find(day=>day.orders>0)?.date;
    if(first){const data=await getJson<{provinceCount?:number}>(`/api/insights/customers?start=${first}&end=${event.date}`);extras.provinces=data?.provinceCount??null;}
  }
  return achievementShare(event,days,today,money,extras);
}
