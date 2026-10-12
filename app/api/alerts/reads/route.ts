import { z } from 'zod';
import { getAlertReads, saveAlertReads } from '../../../../db/database';
import { route } from '../../../../server/http/route';

const Body=z.object({keys:z.array(z.string().min(1).max(300)).min(1).max(50),state:z.enum(['seen','dismissed'])});

// Cada persona marca sus propias alertas; no cambia lo que ven los demás del equipo.
const viewer=(user:{clerkUserId:string|null;email:string})=>user.clerkUserId||user.email;

export const GET=route({},async({user})=>({reads:await getAlertReads(user.id,viewer(user))}));
export const POST=route({origin:'same',body:Body,invalidBody:'invalid_alert_reads'},async({user,body})=>({reads:await saveAlertReads(user.id,viewer(user),body.keys,body.state)}));
