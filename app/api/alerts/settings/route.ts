import { z } from 'zod';
import { getAlertSettings, saveAlertSettings } from '../../../../db/database';
import { route } from '../../../../server/http/route';

const Settings=z.object({
  marginMin:z.number().min(0).max(100),
  marginDrop:z.number().min(0).max(100),
  salesDrop:z.number().min(0).max(100),
  stockDays:z.number().int().min(0).max(365),
  campaignMinSpend:z.number().min(0).max(1e12),
  alertEmail:z.boolean(),
  weeklyEmail:z.boolean(),
});

export const GET=route({},async({user})=>({settings:await getAlertSettings(user.id)}));

// Solo propietario o administrador cambian los umbrales: aplican a todo el equipo.
export const PUT=route({access:'manager',origin:'same',body:Settings,invalidBody:'invalid_alert_settings'},async({user,body})=>({settings:await saveAlertSettings(user.id,body)}));
