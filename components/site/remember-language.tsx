'use client';

import { useEffect } from 'react';
import { savePreferredLanguage, type UiLanguage } from '../../lib/ui-translate';

// Quien entra a la página en inglés o portugués ve la app (registro y panel) en ese idioma.
export default function RememberLanguage({lang}:{lang:UiLanguage}) {
  useEffect(()=>{ if (lang!=='es') savePreferredLanguage(lang); },[lang]);
  return null;
}
