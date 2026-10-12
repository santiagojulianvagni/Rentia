// Datos del titular que se muestran en las páginas legales. Completar en Vercel cuando
// la SRL esté inscripta (razón social, CUIT, domicilio y email de contacto).
export const LEGAL={
  company:process.env.NEXT_PUBLIC_RENTIA_LEGAL_NAME||'',
  taxId:process.env.NEXT_PUBLIC_RENTIA_LEGAL_CUIT||'',
  address:process.env.NEXT_PUBLIC_RENTIA_LEGAL_ADDRESS||'',
  email:process.env.NEXT_PUBLIC_RENTIA_CONTACT_EMAIL||'',
};

export const LEGAL_UPDATED='12 de octubre de 2026';
