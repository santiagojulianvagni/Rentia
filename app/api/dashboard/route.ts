import {NextResponse} from 'next/server';
import { route } from '../../../server/http/route';
import {dashboardPayload} from '../../../server/dashboard-payload';

export const GET=route({},async({user,request})=>NextResponse.json(await dashboardPayload(user.id,new URL(request.url))));
