import { createHash } from 'node:crypto';

// Datos de cliente y envío de una orden para la sección Clientes. Del cliente se guarda solo
// un código anónimo (hash): alcanza para saber si volvió a comprar, sin nombre ni email.
type UnknownRecord=Record<string,unknown>;
const record=(value:unknown):UnknownRecord=>value&&typeof value==='object'&&!Array.isArray(value)?value as UnknownRecord:{};
const text=(value:unknown)=>value===null||value===undefined?'':String(value).trim();
const translated=(value:unknown)=>{
  if(typeof value==='string')return value.trim();
  const names=record(value);
  return text(names.es)||text(names.pt)||text(names.en)||text(Object.values(names)[0]);
};
// "BUENOS AIRES" y "Buenos Aires" son la misma provincia.
const SMALL_WORDS=new Set(['de','del','la','las','los','y','el']);
const ACRONYMS=new Set(['caba','cp']);
export const placeName=(value:string)=>value.toLocaleLowerCase('es-AR').replace(/\s+/g,' ').trim().split(' ').map((word,index)=>ACRONYMS.has(word.replace(/[^a-z]/g,''))?word.toLocaleUpperCase('es-AR'):index>0&&SMALL_WORDS.has(word)?word:word.replace(/^(\P{L}*)(\p{L})/u,(_,before:string,letter:string)=>before+letter.toLocaleUpperCase('es-AR'))).join(' ');

export function customerKey(provider:string,identity:string) {
  const value=identity.trim().toLowerCase();
  return value?createHash('sha256').update(`${provider}:${value}`).digest('hex').slice(0,24):null;
}

export function tiendanubeOrderExtras(order:UnknownRecord) {
  const customer=record(order.customer);
  const address=record(order.shipping_address);
  const option=order.shipping_option;
  const optionName=typeof option==='string'?option:translated(record(option).name)||text(record(option).code);
  const pickup=text(order.shipping_pickup_type)==='pickup';
  return {
    customerKey:customerKey('tiendanube',text(customer.id)||text(customer.email)||text(order.contact_email)),
    province:text(address.province)?placeName(text(address.province)):null,
    city:text(address.city)?placeName(text(address.city)):null,
    shippingMethod:optionName.trim()||(pickup?'Retiro en el local':null),
    storefront:text(order.storefront)||null,
  };
}

export function tiendanubeCategories(product:UnknownRecord) {
  const names=(Array.isArray(product.categories)?product.categories:[]).map(category=>translated(record(category).name)).filter(Boolean);
  return [...new Set(names)];
}
