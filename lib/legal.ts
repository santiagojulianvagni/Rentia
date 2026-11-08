// Datos del titular que se muestran en las páginas legales. Completar en Vercel cuando
// la SRL esté inscripta (razón social, CUIT, domicilio y email de contacto).
export const LEGAL={
  company:process.env.NEXT_PUBLIC_RENTIA_LEGAL_NAME||'IMPORTADORA SOLDOUT S.R.L.',
  taxId:process.env.NEXT_PUBLIC_RENTIA_LEGAL_CUIT||'30-71966908-1',
  address:process.env.NEXT_PUBLIC_RENTIA_LEGAL_ADDRESS||'',
  email:process.env.NEXT_PUBLIC_RENTIA_CONTACT_EMAIL||'hola@rentiaapp.com',
};

export const LEGAL_UPDATED='8 de noviembre de 2026';
// La política de privacidad se actualizó aparte: datos para Clientes y carritos abandonados.
export const PRIVACY_UPDATED='8 de noviembre de 2026';
