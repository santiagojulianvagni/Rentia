'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { loadDictionary, preferredLanguage, translateDocument, type UiLanguage } from '../lib/ui-translate';

// Mantiene la página traducida al idioma elegido. Mientras se carga el diccionario,
// la página queda oculta un instante para no mostrar el español y después cambiar.
export function useUiTranslation(lang:UiLanguage) {
  useLayoutEffect(()=>{
    document.documentElement.lang=lang==='es'?'es-AR':lang==='pt'?'pt-BR':'en';
    if (lang==='es') return;
    const html=document.documentElement;
    let stop:(()=>void)|undefined;let cancelled=false;
    html.classList.add('i18n-wait');
    const reveal=()=>html.classList.remove('i18n-wait');
    const timer=window.setTimeout(reveal,2500);
    loadDictionary(lang).then(dictionary=>{
      if (cancelled) return;
      stop=translateDocument(dictionary);
      reveal();
    }).catch(reveal);
    return ()=>{ cancelled=true;window.clearTimeout(timer);reveal();stop?.(); };
  },[lang]);
}

// Para las pantallas fuera del panel (registro, ingreso, onboarding, invitación).
export function UiTranslator() {
  const [lang,setLang]=useState<UiLanguage>('es');
  useEffect(()=>{ const next=preferredLanguage(); if (next!=='es') void Promise.resolve().then(()=>setLang(next)); },[]);
  useUiTranslation(lang);
  return null;
}
