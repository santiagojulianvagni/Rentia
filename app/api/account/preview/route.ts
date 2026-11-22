import { currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { isRentiaOwnerEmail } from '../../../../lib/billing-checkout';

// Funciones en vista previa: solo las ven los dueños de Rentia (identificados por la huella de su
// email principal y verificado), para probarlas en su propia tienda antes de abrirlas a todos.
export async function GET() {
  const user=await currentUser();
  const primary=user?.emailAddresses.find(item=>item.id===user.primaryEmailAddressId);
  const owner=Boolean(primary&&primary.verification?.status==='verified'&&isRentiaOwnerEmail(primary.emailAddress));
  return NextResponse.json({askRentia:owner},{headers:{'cache-control':'no-store'}});
}
