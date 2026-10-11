import { auth, reverificationErrorResponse } from '@clerk/nextjs/server';

// Acciones sensibles (como dar de baja la suscripción) piden volver a confirmar la
// identidad en los últimos 10 minutos. Si no, el panel muestra la verificación de Clerk.
export async function requireRecentVerification() {
  const { has } = await auth();
  if (!has({ reverification: 'strict' })) return reverificationErrorResponse('strict');
  return null;
}
