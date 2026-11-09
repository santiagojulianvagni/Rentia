import { buildDictionary, translateText, type UiLanguage } from '../ui-translate';
import en from '../i18n/ui-en.json' with { type: 'json' };
import pt from '../i18n/ui-pt.json' with { type: 'json' };
import type { Email } from './templates';

// Mails en el idioma del dueño: se arman en español y se traducen con el mismo diccionario
// que la app (asunto, texto del HTML y versión de texto plano).
const dictionaries:Partial<Record<'en'|'pt',ReturnType<typeof buildDictionary>>>={};
const dictionary=(lang:'en'|'pt')=>dictionaries[lang]??=buildDictionary(lang,(lang==='en'?en:pt) as Record<string,string>);

const unescapeHtml=(value:string)=>value.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
const escapeHtml=(value:string)=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

export function translateEmail(email:Email,lang:UiLanguage):Email {
  if (lang==='es') return email;
  const d=dictionary(lang);
  const line=(value:string)=>{
    if (!value.trim()) return value;
    // Ítems de lista ("- texto") de la versión de texto plano.
    const item=/^- (.+)$/.exec(value);
    if (item) return `- ${translateText(d,item[1])??item[1]}`;
    // Filas "Etiqueta: valor" y recuadros "Título: texto": cada parte por separado.
    const row=/^([^:]{2,80}): (.+)$/.exec(value);
    if (row) {
      const label=translateText(d,row[1]);const rest=translateText(d,row[2]);
      if (label!==null||rest!==null) return `${label??row[1]}: ${rest??row[2]}`;
    }
    return translateText(d,value)??value;
  };
  const html=email.html
    .replace('<html lang="es">',`<html lang="${lang==='pt'?'pt-BR':'en'}">`)
    .replace(/>([^<>]+)</g,(match,inner:string)=>{
      const raw=unescapeHtml(inner);
      if (!raw.trim()) return match;
      const out=translateText(d,raw);
      return out===null?match:`>${escapeHtml(out)}<`;
    });
  return {subject:line(email.subject),html,text:email.text.split('\n').map(line).join('\n')};
}
