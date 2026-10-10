import { env } from '../../../../../lib/env';
import { NextResponse } from 'next/server';
import { createOAuthState } from '../../../../../db/database';
import { canManageRentia, getRentiaUser } from '../../../../../lib/session';

export async function GET(request:Request) {
  const user = await getRentiaUser();
  if (!user) return NextResponse.redirect(new URL('/ingresar',request.url));
  if (!canManageRentia(user)) return NextResponse.redirect(new URL('/panel?section=integraciones&error=forbidden',request.url));
  const runtime = env as unknown as {TIENDANUBE_CLIENT_ID?:string};
  if (!runtime.TIENDANUBE_CLIENT_ID) return NextResponse.redirect(new URL('/panel?setup=tiendanube',request.url));
  const state = crypto.randomUUID().replaceAll('-','');
  await createOAuthState(user.id,'tiendanube',state);
  const authorize = new URL('https://www.tiendanube.com/apps/'+runtime.TIENDANUBE_CLIENT_ID+'/authorize');
  authorize.searchParams.set('state',state);
  return NextResponse.redirect(authorize);
}
