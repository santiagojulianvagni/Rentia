// Carritos abandonados: se guardan sin datos de contacto (solo fecha, importe y productos) y
// se resumen por período: cuántos, cuánta plata quedó en la mesa y qué productos se abandonan.
type UnknownRecord=Record<string,unknown>;
const record=(value:unknown):UnknownRecord=>value&&typeof value==='object'&&!Array.isArray(value)?value as UnknownRecord:{};
const text=(value:unknown)=>value===null||value===undefined?'':String(value).trim();
const number=(value:unknown)=>{const parsed=Number(value);return Number.isFinite(parsed)?parsed:0;};

export type CartItem={name:string;quantity:number;price:number;productId:string|null;variantId:string|null};
export type AbandonedCart={externalId:string;createdAt:string;completedAt:string|null;total:number;currency:string;units:number;items:CartItem[]};

export function normalizeTiendanubeCheckout(row:UnknownRecord):AbandonedCart|null {
  const externalId=text(row.id);
  const createdAt=text(row.created_at);
  if(!externalId||!createdAt)return null;
  const items=(Array.isArray(row.products)?row.products:[]).map(value=>{
    const item=record(value);
    const name=typeof item.name==='string'?item.name:text(record(item.name).es)||'Producto';
    return {name:name.trim()||'Producto',quantity:Math.max(0,Math.round(number(item.quantity))),price:number(item.price),productId:text(item.product_id)||null,variantId:text(item.variant_id)||null};
  });
  return {externalId,createdAt,completedAt:text(row.completed_at)||null,total:number(row.total),currency:text(row.currency)||'ARS',units:items.reduce((sum,item)=>sum+item.quantity,0),items};
}

export function cartSummary(carts:AbandonedCart[],paidOrders:number) {
  const open=carts.filter(cart=>!cart.completedAt);
  const value=open.reduce((sum,cart)=>sum+cart.total,0);
  const products=new Map<string,{name:string;carts:number;units:number;value:number}>();
  for(const cart of open) {
    const seen=new Set<string>();
    for(const item of cart.items) {
      const key=item.productId||item.name;
      const row=products.get(key)||{name:item.name,carts:0,units:0,value:0};
      if(!seen.has(key)){row.carts++;seen.add(key);}
      row.units+=item.quantity;row.value+=item.quantity*item.price;
      products.set(key,row);
    }
  }
  const days=new Map<string,{date:string;carts:number;value:number}>();
  for(const cart of open){const date=cart.createdAt.slice(0,10);const day=days.get(date)||{date,carts:0,value:0};day.carts++;day.value+=cart.total;days.set(date,day);}
  return {
    count:open.length,value,average:open.length?value/open.length:0,
    recovered:carts.length-open.length,
    // De cada 100 compras que empezaron con datos de contacto, cuántas no se terminaron.
    rate:open.length+paidOrders?open.length/(open.length+paidOrders):0,
    topProducts:[...products.values()].sort((a,b)=>b.carts-a.carts||b.value-a.value).slice(0,10),
    daily:[...days.values()].sort((a,b)=>a.date.localeCompare(b.date)),
    recent:open.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,20),
  };
}

// Contacto del comprador para recuperar la venta. Se guarda cifrado, se borra a los 90 días y
// solo lo ven el propietario y los administradores de la tienda.
export type CartContact={name:string|null;email:string|null;phone:string|null;recoveryUrl:string|null};
export function checkoutContact(row:UnknownRecord):CartContact|null {
  const contact={name:text(row.contact_name)||null,email:text(row.contact_email)||null,phone:text(row.contact_phone)||null,recoveryUrl:/^https:\/\//.test(text(row.abandoned_checkout_url))?text(row.abandoned_checkout_url):null};
  return contact.name||contact.email||contact.phone||contact.recoveryUrl?contact:null;
}

// Link de WhatsApp con un mensaje listo. Los celulares argentinos van como 549 + área + número.
export function whatsappLink(phone:string|null,message:string) {
  let digits=(phone||'').replace(/\D/g,'');
  if(!digits)return null;
  if(digits.startsWith('00'))digits=digits.slice(2);
  if(digits.startsWith('0'))digits=digits.slice(1);
  // Formato local con 15 (11 15 5555-0000): se saca el 15 que va después del código de área.
  if(digits.length===12&&!digits.startsWith('54'))for(const area of [2,3,4]) if(digits.slice(area,area+2)==='15'){digits=digits.slice(0,area)+digits.slice(area+2);break;}
  if(digits.startsWith('54')&&!digits.startsWith('549')&&digits.length===12)digits=`549${digits.slice(2)}`;
  else if(!digits.startsWith('54')&&digits.length===10)digits=`549${digits}`;
  if(digits.length<11||digits.length>15)return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function recoveryMessage(storeName:string,name:string|null,url:string|null) {
  const hello=name?`¡Hola ${name.split(' ')[0]}!`:'¡Hola!';
  return `${hello} Te escribimos de ${storeName}. Vimos que dejaste productos en tu carrito.${url?` Podés terminar tu compra acá: ${url}`:''} Si tenés alguna duda, contanos.`;
}
