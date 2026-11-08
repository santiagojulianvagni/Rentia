import { env } from './env';
import { customerKey } from './order-customer';
import { decryptToken } from './token-crypto';
import { clearCartContacts, countCustomerData, findStoreOwner, listCartContacts, recordPrivacyRequest, redactCustomerOrders, redactStoreCustomerData } from '../db/database';

// Avisos de privacidad obligatorios de Tiendanube (LGPD). Cada uno tiene su propia dirección,
// que se carga en el panel de Socios de Tiendanube:
//   /api/webhooks/tiendanube/privacy/store-redact            la tienda desinstaló la app
//   /api/webhooks/tiendanube/privacy/customers-redact        borrar los datos de un comprador
//   /api/webhooks/tiendanube/privacy/customers-data-request  un comprador pidió sus datos
export const PRIVACY_TOPICS={'store-redact':'store/redact','customers-redact':'customers/redact','customers-data-request':'customers/data_request'} as const;
export type PrivacyTopic=keyof typeof PRIVACY_TOPICS;
export const isPrivacyTopic=(value:string):value is PrivacyTopic=>Object.hasOwn(PRIVACY_TOPICS,value);

type UnknownRecord=Record<string,unknown>;
const record=(value:unknown):UnknownRecord=>value&&typeof value==='object'&&!Array.isArray(value)?value as UnknownRecord:{};
const text=(value:unknown)=>value===null||value===undefined?'':String(value).trim();
const ids=(value:unknown)=>Array.isArray(value)?[...new Set(value.map(text).filter(Boolean))].slice(0,5000):[];
// Un teléfono se compara por sus últimos 8 dígitos: "+54 9 11 5555-0000" y "11 15 5555 0000" son el mismo.
const phoneTail=(value:unknown)=>text(value).replace(/\D/g,'').slice(-8);

// Carritos cuyo contacto guardado (cifrado) es del comprador.
async function matchingCarts(userId:string,email:string,phone:string,keyBase64:string|undefined) {
  if(!email&&phone.length<8)return [];
  const rows=await listCartContacts(userId,'tiendanube');
  if(!rows.length)return [];
  if(!keyBase64)throw new Error('privacy_missing_encryption_key');
  const matched:string[]=[];
  for(const row of rows){
    let contact:UnknownRecord;
    try{contact=record(JSON.parse(await decryptToken(row.contact_encrypted,row.contact_iv,keyBase64)));}catch{continue;}
    const sameEmail=Boolean(email)&&text(contact.email).toLowerCase()===email;
    const samePhone=phone.length>=8&&phoneTail(contact.phone)===phone;
    if(sameEmail||samePhone)matched.push(row.external_id);
  }
  return matched;
}

export async function handleTiendanubePrivacy(topic:PrivacyTopic,payload:unknown,runtime:{TOKEN_ENCRYPTION_KEY?:string}=env as unknown as {TOKEN_ENCRYPTION_KEY?:string}) {
  const body=record(payload);
  const storeId=text(body.store_id);
  const kind=PRIVACY_TOPICS[topic];
  if(!storeId)throw new Error('privacy_missing_store');
  const owner=await findStoreOwner('tiendanube',storeId);
  if(!owner){
    // Rentia no tiene nada de esa tienda: igual queda registrado que llegó el pedido.
    await recordPrivacyRequest({provider:'tiendanube',storeId,userId:null,kind,externalId:null,result:{storeKnown:false}});
    return {kind,storeKnown:false};
  }
  let result:Record<string,unknown>;
  let externalId:string|null=null;
  if(topic==='store-redact'){
    // Si la tienda volvió a instalar la app antes de que llegue el aviso, no se borra nada.
    result=owner.status==='connected'?{skipped:'store_reconnected'}:await redactStoreCustomerData(owner.user_id,'tiendanube',storeId);
  } else {
    const customer=record(body.customer);
    const email=text(customer.email).toLowerCase();
    const keys=[customerKey('tiendanube',text(customer.id)),customerKey('tiendanube',email)].filter((key):key is string=>Boolean(key));
    const carts=await matchingCarts(owner.user_id,email,phoneTail(customer.phone),runtime.TOKEN_ENCRYPTION_KEY);
    if(topic==='customers-redact'){
      result={orders:await redactCustomerOrders(owner.user_id,'tiendanube',keys,ids(body.orders_to_redact)),carts:await clearCartContacts(owner.user_id,'tiendanube',carts)};
    } else {
      // Todo lo que Rentia tiene del comprador sale de Tiendanube, que ya se lo entrega a la tienda.
      // Rentia solo agrega un código anónimo, la ciudad de envío y el contacto de carritos abandonados.
      externalId=text(record(body.data_request).id)||null;
      result={...await countCustomerData(owner.user_id,'tiendanube',keys,ids(body.orders_requested),ids(body.checkouts_requested)),cartContacts:carts.length};
    }
  }
  await recordPrivacyRequest({provider:'tiendanube',storeId,userId:owner.user_id,kind,externalId,result});
  return {kind,...result};
}
