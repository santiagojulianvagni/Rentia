// Mails de Rentia: un mismo diseño (franja oscura con el logo, tarjeta blanca, botón turquesa)
// armado con tablas y estilos en línea, que es lo que respetan Gmail, Outlook y Apple Mail.
// Cada plantilla devuelve asunto, HTML y texto plano.

export const APP_URL='https://www.rentiaapp.com';
export type Email={subject:string;html:string;text:string};

const esc=(value:string)=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const firstName=(name:string|null|undefined)=>(name||'').trim().split(/\s+/)[0]||'';
const hello=(name:string|null|undefined)=>firstName(name)?`¡Hola, ${firstName(name)}!`:'¡Hola!';
export const longDate=(iso:string)=>new Intl.DateTimeFormat('es-AR',{day:'numeric',month:'long',year:'numeric',timeZone:'America/Argentina/Buenos_Aires'}).format(new Date(iso));
const pesos=(amount:number)=>`$ ${new Intl.NumberFormat('es-AR',{maximumFractionDigits:0}).format(amount)}`;

type Block={kind:'p';text:string}|{kind:'box';tone:'info'|'warn'|'ok';title:string;text:string}|{kind:'rows';rows:Array<[string,string]>}|{kind:'list';items:string[]};
type Layout={preheader:string;eyebrow:string;title:string;greeting:string;blocks:Block[];cta?:{label:string;url:string};note?:string};

const COLORS={ink:'#0b1826',text:'#2a3b4c',muted:'#6b7c8d',line:'#e3e9ef',bg:'#eef3f7',accent:'#21d4c2',accentInk:'#031513',accentDark:'#0b8f83'};
const TONES={info:{bg:'#eafaf8',border:'#bfeee8',title:'#0b6f66'},warn:{bg:'#fff7e8',border:'#f6dcaa',title:'#8a5a00'},ok:{bg:'#eafaf1',border:'#bfe9cf',title:'#17703f'}};

function block(item:Block) {
  if (item.kind==='p') return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${COLORS.text}">${esc(item.text)}</p>`;
  if (item.kind==='box') {
    const tone=TONES[item.tone];
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;background:${tone.bg};border:1px solid ${tone.border};border-radius:12px"><tr><td style="padding:14px 16px"><p style="margin:0 0 4px;font-size:14px;font-weight:700;color:${tone.title}">${esc(item.title)}</p><p style="margin:0;font-size:14px;line-height:1.55;color:${COLORS.text}">${esc(item.text)}</p></td></tr></table>`;
  }
  if (item.kind==='rows') return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-top:1px solid ${COLORS.line}">${item.rows.map(([label,value])=>`<tr><td style="padding:10px 0;border-bottom:1px solid ${COLORS.line};font-size:14px;color:${COLORS.muted}">${esc(label)}</td><td align="right" style="padding:10px 0;border-bottom:1px solid ${COLORS.line};font-size:14px;font-weight:700;color:${COLORS.ink}">${esc(value)}</td></tr>`).join('')}</table>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px">${item.items.map(text=>`<tr><td width="22" valign="top" style="padding:3px 0;font-size:15px;color:${COLORS.accentDark};font-weight:700">✓</td><td style="padding:3px 0;font-size:15px;line-height:1.5;color:${COLORS.text}">${esc(text)}</td></tr>`).join('')}</table>`;
}

function render(layout:Layout):{html:string;text:string} {
  const cta=layout.cta?`<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="border-radius:10px;background:${COLORS.accent}"><a href="${esc(layout.cta.url)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:700;color:${COLORS.accentInk};text-decoration:none;border-radius:10px">${esc(layout.cta.label)}</a></td></tr></table>`:'';
  const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(layout.title)}</title></head>
<body style="margin:0;padding:0;background:${COLORS.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(layout.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bg}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="background:${COLORS.ink};border-radius:16px 16px 0 0;padding:22px 28px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td><img src="${APP_URL}/apple-icon.png" width="32" height="32" alt="" style="display:block;border-radius:8px"></td><td style="padding-left:10px;font-size:19px;font-weight:700;color:#ffffff;letter-spacing:-.2px">Rentia</td></tr></table></td></tr>
<tr><td style="background:#ffffff;border-radius:0 0 16px 16px;padding:30px 28px 26px;border:1px solid ${COLORS.line};border-top:0">
<p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${COLORS.accentDark}">${esc(layout.eyebrow)}</p>
<h1 style="margin:0 0 18px;font-size:24px;line-height:1.25;color:${COLORS.ink}">${esc(layout.title)}</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${COLORS.text}">${esc(layout.greeting)}</p>
${layout.blocks.map(block).join('\n')}
${cta}
${layout.note?`<p style="margin:0;font-size:13px;line-height:1.55;color:${COLORS.muted}">${esc(layout.note)}</p>`:''}
</td></tr>
<tr><td align="center" style="padding:20px 16px 4px;font-size:12px;line-height:1.6;color:${COLORS.muted}">Rentia · La ganancia real de tu tienda<br>¿Dudas? Respondé este mail o escribinos a <a href="mailto:hola@rentiaapp.com" style="color:${COLORS.accentDark}">hola@rentiaapp.com</a><br><a href="${APP_URL}/terminos" style="color:${COLORS.muted}">Términos</a> · <a href="${APP_URL}/privacidad" style="color:${COLORS.muted}">Privacidad</a></td></tr>
</table></td></tr></table></body></html>`;
  const lines=[layout.title,'',layout.greeting,''];
  for (const item of layout.blocks) {
    if (item.kind==='p') lines.push(item.text,'');
    else if (item.kind==='box') lines.push(`${item.title}: ${item.text}`,'');
    else if (item.kind==='rows') lines.push(...item.rows.map(([label,value])=>`${label}: ${value}`),'');
    else lines.push(...item.items.map(text=>`- ${text}`),'');
  }
  if (layout.cta) lines.push(`${layout.cta.label}: ${layout.cta.url}`,'');
  if (layout.note) lines.push(layout.note,'');
  lines.push('—','Rentia · hola@rentiaapp.com');
  return {html,text:lines.join('\n')};
}

const PLAN_URL=`${APP_URL}/panel?section=plan`;

export function trialEndingEmail(input:{ownerName:string|null;storeName:string;daysLeft:number;trialEndsAt:string}):Email {
  const when=input.daysLeft<=1?'mañana':`en ${input.daysLeft} días`;
  return {subject:input.daysLeft<=1?'Tu prueba de Rentia termina mañana':`Tu prueba de Rentia termina en ${input.daysLeft} días`,...render({
    preheader:`El ${longDate(input.trialEndsAt)} termina la prueba de ${input.storeName}. Elegí un plan para seguir con todo.`,
    eyebrow:'Tu prueba gratis',title:`Tu prueba termina ${when}`,greeting:hello(input.ownerName),
    blocks:[
      {kind:'p',text:`La prueba gratis de ${input.storeName} termina el ${longDate(input.trialEndsAt)}. Para seguir viendo la ganancia real de tu tienda sin límites, elegí el plan que mejor te queda.`},
      {kind:'list',items:['Ganancia real de cada venta y producto','Publicidad, envíos y comisiones en un solo lugar','Alertas, cashflow y resumen semanal']},
      {kind:'box',tone:'info',title:'Si no elegís un plan',text:'Pasás al plan Gratis: hasta 50 órdenes por mes y los últimos 12 meses de historial. No perdés ningún dato.'},
    ],
    cta:{label:'Elegir mi plan',url:PLAN_URL},
    note:'Pagás con Mercado Pago, en pesos, y te podés dar de baja cuando quieras desde la app.',
  })};
}

export function trialEndedEmail(input:{ownerName:string|null;storeName:string}):Email {
  return {subject:'Terminó tu prueba de Rentia',...render({
    preheader:`${input.storeName} pasó al plan Gratis. Tus datos siguen ahí.`,
    eyebrow:'Tu prueba gratis',title:'Terminó tu prueba gratis',greeting:hello(input.ownerName),
    blocks:[
      {kind:'p',text:`La prueba de ${input.storeName} terminó y tu cuenta pasó al plan Gratis. Tus datos están intactos.`},
      {kind:'rows',rows:[['Órdenes por mes','Hasta 50'],['Historial visible','Últimos 12 meses'],['Usuarios','1']]},
      {kind:'p',text:'Cuando quieras volver a tener todo, elegís un plan y se activa en el momento.'},
    ],
    cta:{label:'Ver los planes',url:PLAN_URL},
  })};
}

export function subscriptionActiveEmail(input:{ownerName:string|null;storeName:string;planName:string;amount:number|null;cycle:string;nextPaymentDate:string|null}):Email {
  const rows:Array<[string,string]>=[['Plan',input.planName],['Facturación',input.cycle==='annual'?'Anual':'Mensual']];
  if (input.amount) rows.push(['Monto de hoy',pesos(input.amount)]);
  if (input.nextPaymentDate) rows.push(['Próximo cobro',longDate(input.nextPaymentDate)]);
  return {subject:`¡Listo! Tu plan ${input.planName} está activo`,...render({
    preheader:`Mercado Pago confirmó el pago. ${input.storeName} ya tiene el plan ${input.planName}.`,
    eyebrow:'Suscripción',title:`Tu plan ${input.planName} está activo`,greeting:hello(input.ownerName),
    blocks:[
      {kind:'p',text:`Mercado Pago confirmó el pago y ${input.storeName} ya tiene el plan ${input.planName}. ¡Gracias por confiar en Rentia!`},
      {kind:'rows',rows},
      {kind:'p',text:'El monto en pesos se ajusta al dólar oficial del día anterior a cada cobro. Podés ver tus pagos y darte de baja cuando quieras desde Plan y facturación.'},
    ],
    cta:{label:'Ir a mi panel',url:`${APP_URL}/panel`},
  })};
}

export function paymentFailedEmail(input:{ownerName:string|null;storeName:string;planName:string;graceUntil:string}):Email {
  return {subject:'No pudimos cobrar tu plan de Rentia',...render({
    preheader:`Revisá tu tarjeta en Mercado Pago antes del ${longDate(input.graceUntil)} para no perder el plan.`,
    eyebrow:'Cobro rechazado',title:'No pudimos cobrar tu plan',greeting:hello(input.ownerName),
    blocks:[
      {kind:'p',text:`Mercado Pago rechazó el último cobro del plan ${input.planName} de ${input.storeName}. Suele pasar por una tarjeta vencida o sin saldo.`},
      {kind:'box',tone:'warn',title:`Tenés tiempo hasta el ${longDate(input.graceUntil)}`,text:'Mientras tanto seguís con tu plan. Si el cobro sigue sin pasar, la cuenta pasa a Gratis, sin perder datos.'},
      {kind:'p',text:'Entrá a Mercado Pago, revisá el medio de pago de tu suscripción a Rentia y Mercado Pago lo vuelve a intentar solo.'},
    ],
    cta:{label:'Revisar en Mercado Pago',url:'https://www.mercadopago.com.ar/subscriptions'},
    note:'Si ya lo resolviste, ignorá este mail.',
  })};
}

export function subscriptionCanceledEmail(input:{ownerName:string|null;storeName:string;planName:string;until:string|null}):Email {
  return {subject:'Confirmamos tu baja de Rentia',...render({
    preheader:input.until?`No se te va a cobrar más. Tenés el plan ${input.planName} hasta el ${longDate(input.until)}.`:'No se te va a cobrar más.',
    eyebrow:'Baja confirmada',title:'Tu baja está confirmada',greeting:hello(input.ownerName),
    blocks:[
      {kind:'p',text:`Diste de baja el plan ${input.planName} de ${input.storeName}. No se te va a cobrar más.`},
      {kind:'box',tone:'ok',title:input.until?`Seguís con ${input.planName} hasta el ${longDate(input.until)}`:'Tus datos quedan guardados',text:'Después pasás al plan Gratis y tu información sigue disponible. Si cambiás de idea, volvés a elegir un plan cuando quieras.'},
      {kind:'p',text:'Si te diste de baja dentro de los 10 días de tu primera contratación, podés pedir el reintegro total desde la página de baja del servicio.'},
    ],
    cta:{label:'Ver mi cuenta',url:PLAN_URL},
    note:'Si no fuiste vos, respondé este mail y lo revisamos enseguida.',
  })};
}

export function planExpiredEmail(input:{ownerName:string|null;storeName:string}):Email {
  return {subject:'Tu cuenta de Rentia pasó al plan Gratis',...render({
    preheader:`${input.storeName} ahora tiene el plan Gratis. Tus datos siguen ahí.`,
    eyebrow:'Tu plan',title:'Pasaste al plan Gratis',greeting:hello(input.ownerName),
    blocks:[
      {kind:'p',text:`El plan pago de ${input.storeName} terminó y la cuenta pasó al plan Gratis. No se borró ningún dato.`},
      {kind:'rows',rows:[['Órdenes por mes','Hasta 50'],['Historial visible','Últimos 12 meses'],['Usuarios','1']]},
    ],
    cta:{label:'Volver a un plan',url:PLAN_URL},
  })};
}

export function customerDataRequestEmail(input:{ownerName:string|null;storeName:string;requestId:string|null;orders:number;carts:number;cartContacts:number}):Email {
  return {subject:'Un comprador pidió sus datos (Tiendanube)',...render({
    preheader:'Te contamos qué datos de ese comprador tiene Rentia.',
    eyebrow:'Privacidad',title:'Un comprador pidió sus datos',greeting:hello(input.ownerName),
    blocks:[
      {kind:'p',text:`Tiendanube nos avisó que un comprador de ${input.storeName} pidió conocer sus datos personales${input.requestId?` (pedido ${input.requestId})`:''}. Como responsable de la tienda, sos quien le responde.`},
      {kind:'rows',rows:[['Órdenes de ese comprador en Rentia',String(input.orders)],['Carritos abandonados pedidos',String(input.carts)],['Carritos con su contacto guardado',String(input.cartContacts)]]},
      {kind:'p',text:'Todo lo que Rentia guarda sale de tu Tiendanube. Además del detalle de esas órdenes, Rentia solo agrega un código anónimo de cliente, la ciudad de envío y, en los carritos, el contacto que dejó el comprador (se borra a los 90 días).'},
    ],
    cta:{label:'Ver Clientes en Rentia',url:`${APP_URL}/panel?section=clientes`},
    note:'Si necesitás que te mandemos el detalle completo, respondé este mail.',
  })};
}
