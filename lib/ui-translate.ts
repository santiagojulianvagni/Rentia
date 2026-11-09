// Traducción de la interfaz al inglés y al portugués.
// La app se escribe en español; este módulo traduce lo que se ve en pantalla (textos, títulos,
// etiquetas de accesibilidad y placeholders) con un diccionario y lo mantiene traducido mientras
// React actualiza la página. Volver a español restaura los textos originales.

export type UiLanguage='es'|'en'|'pt';
type Template={needle:string;re:RegExp;out:string;weight:number};
type Dictionary={exact:Map<string,string>;templates:Template[];lang:UiLanguage};

const ATTRIBUTES=['title','aria-label','placeholder','alt'];
const SKIP_SELECTOR='script,style,noscript,textarea,code,pre,[translate="no"],.notranslate,[contenteditable="true"]';
const LETTER=/[A-Za-zÁÉÍÓÚáéíóúÑñ]/;

const MONTHS_ES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const MONTHS_ES_SHORT=['ene','feb','mar','abr','may','jun','jul','ago','sept','oct','nov','dic'];
const MONTHS:Record<'en'|'pt',{long:string[];short:string[]}>={
  en:{long:['January','February','March','April','May','June','July','August','September','October','November','December'],short:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']},
  pt:{long:['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'],short:['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']},
};
const WEEKDAYS_ES=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const WEEKDAYS_ES_SHORT=['dom','lun','mar','mié','jue','vie','sáb'];
const WEEKDAYS:Record<'en'|'pt',{long:string[];short:string[]}>={
  en:{long:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],short:['Sun','Mon','Tue','Wed','Thu','Fri','Sat']},
  pt:{long:['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'],short:['dom','seg','ter','qua','qui','sex','sáb']},
};

const escapeRegExp=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const normalize=(value:string)=>value.replace(/\s+/g,' ').trim();

function monthIndex(word:string) {
  const value=word.toLowerCase().replace(/\.$/,'');
  const full=MONTHS_ES.indexOf(value);
  if (full>=0) return {index:full,short:false};
  const short=MONTHS_ES_SHORT.indexOf(value==='sep'?'sept':value);
  return short>=0?{index:short,short:true}:null;
}
function weekdayIndex(word:string) {
  const value=word.toLowerCase().replace(/\.$/,'');
  const full=WEEKDAYS_ES.indexOf(value);
  if (full>=0) return {index:full,short:false};
  const short=WEEKDAYS_ES_SHORT.indexOf(value);
  return short>=0?{index:short,short:true}:null;
}
const capitalize=(value:string)=>value.charAt(0).toUpperCase()+value.slice(1);

const MONTH_WORD='(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sept?|oct|nov|dic)\\.?';
const WEEKDAY_WORD='(domingo|lunes|martes|miércoles|jueves|viernes|sábado|dom|lun|mar|mié|jue|vie|sáb)\\.?';
const DATE_FULL=new RegExp(`(?:${WEEKDAY_WORD},? )?(\\d{1,2}) de ${MONTH_WORD}(?: de (\\d{4}))?`,'gi');
const DATE_SHORT=new RegExp(`^(?:${WEEKDAY_WORD},? )?(\\d{1,2}) ${MONTH_WORD}(?: (\\d{4}))?$`,'i');
const MONTH_YEAR=new RegExp(`^${MONTH_WORD}(?: de)? (\\d{4})$`,'i');
const MONTH_ALONE=new RegExp(`^${MONTH_WORD}$`,'i');
const WEEKDAY_DAY=new RegExp(`^${WEEKDAY_WORD} (\\d{1,2})$`,'i');
const DATE_RANGE=new RegExp(`^(\\d{1,2}) al (\\d{1,2}) de ${MONTH_WORD}(?: de (\\d{4}))?$`,'i');

function formatDate(lang:'en'|'pt',weekday:string|undefined,day:string,month:string,year:string|undefined,compact:boolean,upper:boolean) {
  const m=monthIndex(month);if (!m) return null;
  const w=weekday?weekdayIndex(weekday):null;
  const names=MONTHS[lang];const days=WEEKDAYS[lang];
  const monthName=m.short?names.short[m.index]:names.long[m.index];
  const weekdayName=w?(w.short?days.short[w.index]:days.long[w.index]):'';
  let text:string;
  if (lang==='en') text=`${weekdayName?`${weekdayName}, `:''}${monthName} ${Number(day)}${year?`, ${year}`:''}`;
  else text=compact?`${weekdayName?`${weekdayName}, `:''}${day} ${monthName}${year?` ${year}`:''}`:`${weekdayName?`${weekdayName}, `:''}${day} de ${monthName}${year?` de ${year}`:''}`;
  return upper?capitalize(text):text;
}

// Fechas escritas en español por Intl (es-AR) o a mano.
function translateDates(text:string,lang:'en'|'pt') {
  const short=DATE_SHORT.exec(text.trim());
  if (short) return formatDate(lang,short[1],short[2],short[3],short[4],true,/^[A-ZÁÉÍÓÚ]/.test(text.trim()));
  const monthYear=MONTH_YEAR.exec(text.trim());
  if (monthYear) { const m=monthIndex(monthYear[1]);if (m) { const name=(m.short?MONTHS[lang].short:MONTHS[lang].long)[m.index];return lang==='en'?`${capitalize(name)} ${monthYear[2]}`:`${capitalize(name)} de ${monthYear[2]}`; } }
  const alone=MONTH_ALONE.exec(text.trim());
  if (alone) { const m=monthIndex(alone[1]);if (m) { const name=(m.short?MONTHS[lang].short:MONTHS[lang].long)[m.index];return /^[A-Z]/.test(text.trim())||lang==='en'?capitalize(name):name; } }
  const weekdayDay=WEEKDAY_DAY.exec(text.trim());
  if (weekdayDay) { const w=weekdayIndex(weekdayDay[1]); if (w) { const name=(w.short?WEEKDAYS[lang].short:WEEKDAYS[lang].long)[w.index]; return `${/^[A-ZÁÉÍÓÚ]/.test(text.trim())||lang==='en'?capitalize(name):name} ${weekdayDay[2]}`; } }
  // "2 al 8 de noviembre" → "November 2 – 8" / "2 a 8 de novembro"
  const range=DATE_RANGE.exec(text.trim());
  if (range) { const m=monthIndex(range[3]); if (m) { const name=(m.short?MONTHS[lang].short:MONTHS[lang].long)[m.index]; return lang==='en'?`${name} ${Number(range[1])} – ${Number(range[2])}${range[4]?`, ${range[4]}`:''}`:`${range[1]} a ${range[2]} de ${name}${range[4]?` de ${range[4]}`:''}`; } }
  if (!/\d{1,2} de /i.test(text)) return null;
  let changed=false;
  const result=text.replace(DATE_FULL,(match,weekday,day,month,year,offset)=>{
    const formatted=formatDate(lang,weekday,day,month,year,false,offset===0&&/^[A-ZÁÉÍÓÚ]/.test(match));
    if (!formatted) return match;
    changed=true;return formatted;
  });
  if (!changed) return null;
  // Hora escrita por es-AR: "a las 2:09 p. m." o ", 14:05". Rangos: "… al …".
  return result
    .replace(/ al (?=\d|[A-Z][a-z]+ \d)/g,lang==='en'?' – ':' a ')
    .replace(/(?:\s+a las|,)\s+(\d{1,2}):(\d{2})\s?([ap])\.\s?m\./gi,(_,h,m,ap)=>{
      const hour=Number(h)%12+(ap.toLowerCase()==='p'?12:0);
      return lang==='en'?` at ${Number(h)}:${m} ${ap.toUpperCase()}M`:` às ${String(hour).padStart(2,'0')}:${m}`;
    })
    .replace(/(?:\s+a las|,)\s+(\d{1,2}:\d{2})\b/g,(_,time)=>lang==='en'?` at ${time}`:` às ${time}`);
}

// Números con coma decimal (35,0% o 1.234,5) → formato inglés.
function translateNumber(text:string,lang:UiLanguage) {
  if (lang!=='en') return null;
  const trimmed=text.trim();
  if (!/^[+\-−]?[\d.]*\d,\d+\s?(%|pp|x|p\.p\.)?$/.test(trimmed)) return null;
  return text.replace(trimmed,trimmed.replace(/\./g,'§').replace(',','.').replace(/§/g,',').replace('p.p.','pp'));
}

export function buildDictionary(lang:UiLanguage,entries:Record<string,string>):Dictionary {
  const exact=new Map<string,string>();const templates:Template[]=[];
  for (const [source,target] of Object.entries(entries)) {
    if (!target) continue;
    const key=normalize(source);
    if (!/\{\d+\}/.test(key)) { exact.set(key,target); continue; }
    const parts=key.split(/\{(\d+)\}/);
    // En modelos con poco texto fijo ("{0} días"), lo variable no puede ser una frase en
    // español: así "Últimos 7 días" no se toma como "{0} días" con {0}="Últimos 7".
    const fixed=parts.filter((_,index)=>index%2===0).join('').replace(/[\s.,:;·()%#+\-–—/]/g,'');
    // Con poco texto fijo, lo variable tiene que empezar con un número o símbolo, o ser una sola palabra.
    const capture=fixed.length<7?'((?=[^A-Za-zÁÉÍÓÚáéíóúÑñ\\s])[\\s\\S]+?|\\S+?)':'([\\s\\S]+?)';
    let pattern='^';const literals:string[]=[];const order:number[]=[];
    parts.forEach((part,index)=>{
      if (index%2===0) { pattern+=escapeRegExp(part); if (part.trim()) literals.push(part.trim()); }
      else { pattern+=capture; order.push(Number(part)); }
    });
    pattern+='$';
    const needle=literals.sort((a,b)=>b.length-a.length)[0]||'';
    if (needle.length<3) continue;
    // Las capturas se nombran por posición; el texto destino usa {n} con el número original.
    const out=target.replace(/\{(\d+)\}/g,(_,n)=>`{@${order.indexOf(Number(n))}}`);
    templates.push({needle,re:new RegExp(pattern),out,weight:literals.join('').length*10-order.length});
  }
  // Los modelos más específicos (más texto fijo) primero.
  templates.sort((a,b)=>b.weight-a.weight);
  return {exact,templates,lang};
}

function translateFragment(dictionary:Dictionary,value:string,depth:number):string {
  const key=normalize(value);
  const hit=dictionary.exact.get(key);
  if (hit!==undefined) return value.replace(key,hit);
  if (depth<2) { const nested=translateText(dictionary,value,depth+1); if (nested!==null) return nested; }
  return value;
}

export function translateText(dictionary:Dictionary,text:string,depth=0,split=true):string|null {
  if (dictionary.lang==='es') return null;
  const lang=dictionary.lang;
  const number=translateNumber(text,lang);
  if (number!==null) return number;
  if (!LETTER.test(text)) return null;
  const key=normalize(text);
  if (!key) return null;
  const lead=text.match(/^\s*/)?.[0]||'';const trail=text.match(/\s*$/)?.[0]||'';
  const exact=dictionary.exact.get(key);
  if (exact!==undefined) return lead+exact+trail;
  // Encabezados que a veces llevan " ·" al final y a veces no.
  const dotted=key.endsWith(' ·')?dictionary.exact.get(key.slice(0,-2)):dictionary.exact.get(`${key} ·`);
  if (dotted!==undefined) return lead+(key.endsWith(' ·')?`${dotted} ·`:dotted.replace(/\s·$/,''))+trail;
  if (key.length<=600) for (const template of dictionary.templates) {
    if (!key.includes(template.needle)) continue;
    const match=template.re.exec(key);
    if (!match) continue;
    const out=template.out.replace(/\{@(\d+)\}/g,(_,n)=>translateFragment(dictionary,match[Number(n)+1]||'',depth));
    return lead+out+trail;
  }
  const dated=translateDates(key,lang);
  if (dated!==null) { const again=dated!==key?dictionary.exact.get(dated):undefined; return lead+(again??dated)+trail; }
  // Último intento: frases unidas ("Datos al día. Actualizaciones…") y, dentro de cada una, partes separadas por " · ".
  if (split&&depth<=1) {
    const byParts=(piece:string)=>splitTranslate(dictionary,piece,/\s+·\s+/g,part=>translateText(dictionary,part,2));
    const split=splitTranslate(dictionary,key,/(?<=[.!?…])\s+(?=[¿¡A-ZÁÉÍÓÚ0-9])/g,piece=>translateText(dictionary,piece,2)??byParts(piece))??byParts(key);
    if (split!==null) return lead+split+trail;
  }
  return null;
}

function splitTranslate(dictionary:Dictionary,text:string,separator:RegExp,translate:(piece:string)=>string|null) {
  const pieces=text.split(separator);
  if (pieces.length<2) return null;
  const separators=text.match(separator)||[];
  let changed=false;
  const out=pieces.map(piece=>{ const translated=translate(piece); if (translated!==null) { changed=true; return translated; } return piece; });
  return changed?out.map((piece,index)=>piece+(separators[index]??'')).join(''):null;
}

const loaders:Record<'en'|'pt',()=>Promise<Record<string,string>>>={
  en:()=>import('./i18n/ui-en.json').then(module=>module.default as Record<string,string>),
  pt:()=>import('./i18n/ui-pt.json').then(module=>module.default as Record<string,string>),
};
const dictionaries:Partial<Record<'en'|'pt',Promise<Dictionary>>>={};
export function loadDictionary(lang:'en'|'pt') {
  dictionaries[lang]??=loaders[lang]().then(entries=>buildDictionary(lang,entries));
  return dictionaries[lang]!;
}

// Traduce el DOM y lo mantiene traducido. Devuelve una función que restaura el español.
export function translateDocument(dictionary:Dictionary,root:Element=document.body) {
  const original=new WeakMap<Text,string>();
  const applied=new WeakMap<Text,string>();
  const attrOriginal=new WeakMap<Element,Map<string,string>>();
  const attrApplied=new WeakMap<Element,Map<string,string>>();
  const touchedText=new Set<Text>();const touchedElements=new Set<Element>();

  const sourceOf=(node:Text)=>{
    const value=node.nodeValue||'';
    if (applied.has(node)&&applied.get(node)===value) return original.get(node)??value;
    original.set(node,value);applied.delete(node);
    return value;
  };
  const write=(node:Text,value:string)=>{
    if (!original.has(node)) original.set(node,node.nodeValue||'');
    applied.set(node,value);touchedText.add(node);
    if (node.nodeValue!==value) node.nodeValue=value;
  };
  const skip=(element:Element|null)=>!element||Boolean(element.closest(SKIP_SELECTOR));

  const processElementText=(element:Element)=>{
    if (skip(element)) return;
    const texts:Text[]=[];let onlyText=true;
    element.childNodes.forEach(child=>{ if (child.nodeType===3) texts.push(child as Text); else if (child.nodeType===1||child.nodeType===8) { if (child.nodeType===1) onlyText=false; } });
    if (!texts.length) return;
    const sources=texts.map(sourceOf);
    if (onlyText&&texts.length>1) {
      const joined=sources.join('');
      // Unida solo si hay una traducción completa; si no, cada parte por separado.
      const translated=translateText(dictionary,joined,0,false);
      if (translated!==null) {
        const first=texts.findIndex((_,index)=>sources[index].trim()!=='');
        texts.forEach((node,index)=>write(node,index===(first<0?0:first)?translated:''));
        return;
      }
    }
    texts.forEach((node,index)=>{
      const translated=translateText(dictionary,sources[index]);
      if (translated!==null) write(node,translated);
      else if (applied.has(node)) { applied.delete(node); }
    });
  };
  const processAttributes=(element:Element)=>{
    if (skip(element)) return;
    for (const name of ATTRIBUTES) {
      const value=element.getAttribute(name);
      if (value===null) continue;
      const done=attrApplied.get(element);
      if (done?.get(name)===value) continue;
      const translated=translateText(dictionary,value);
      if (translated===null) continue;
      if (!attrOriginal.has(element)) attrOriginal.set(element,new Map());
      if (!attrApplied.has(element)) attrApplied.set(element,new Map());
      attrOriginal.get(element)!.set(name,value);attrApplied.get(element)!.set(name,translated);
      touchedElements.add(element);
      element.setAttribute(name,translated);
    }
  };
  const processTree=(start:Element)=>{
    processElementText(start);processAttributes(start);
    const walker=document.createTreeWalker(start,NodeFilter.SHOW_ELEMENT);
    let node=walker.nextNode();
    while (node) { processElementText(node as Element);processAttributes(node as Element);node=walker.nextNode(); }
  };

  const observer=new MutationObserver(records=>{
    const elements=new Set<Element>();
    for (const record of records) {
      if (record.type==='characterData') { const parent=record.target.parentElement; if (parent) elements.add(parent); }
      else if (record.type==='attributes') { elements.add(record.target as Element); }
      else {
        if (record.target.nodeType===1) elements.add(record.target as Element);
        record.addedNodes.forEach(node=>{ if (node.nodeType===1) elements.add(node as Element); else if (node.parentElement) elements.add(node.parentElement); });
      }
    }
    elements.forEach(element=>{ if (element.isConnected) processTree(element); });
    observer.takeRecords();
    if (touchedText.size>8000) touchedText.forEach(node=>{ if (!node.isConnected) touchedText.delete(node); });
  });

  processTree(root);
  const title=document.title;const translatedTitle=translateText(dictionary,title);
  if (translatedTitle) document.title=translatedTitle;
  observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTRIBUTES});

  return ()=>{
    observer.disconnect();
    touchedText.forEach(node=>{ if (node.isConnected&&applied.get(node)===node.nodeValue) node.nodeValue=original.get(node)??node.nodeValue; });
    touchedElements.forEach(element=>{
      const done=attrApplied.get(element);const before=attrOriginal.get(element);
      before?.forEach((value,name)=>{ if (element.getAttribute(name)===done?.get(name)) element.setAttribute(name,value); });
    });
    if (translatedTitle&&document.title===translatedTitle) document.title=title;
  };
}

// Idioma guardado por la persona (o el del navegador la primera vez).
export const UI_LANGUAGE_KEY='rentia-display-language';
export function preferredLanguage():UiLanguage {
  try {
    const saved=window.localStorage.getItem(UI_LANGUAGE_KEY);
    if (saved==='es'||saved==='en'||saved==='pt') return saved;
  } catch { /* sin almacenamiento */ }
  const browser=(navigator.language||'es').toLowerCase();
  return browser.startsWith('pt')?'pt':browser.startsWith('en')?'en':'es';
}
export function savePreferredLanguage(lang:UiLanguage) {
  try { window.localStorage.setItem(UI_LANGUAGE_KEY,lang); } catch { /* sin almacenamiento */ }
}
