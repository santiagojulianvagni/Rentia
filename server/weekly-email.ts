import { weeklyEmailUsers } from '../db/database';
import { notify, storeName, type Sender } from '../lib/notifications';
import { sendEmail } from '../lib/email/send';
import { weeklySummaryEmail, type WeekMetrics } from '../lib/email/templates';
import { dashboardPayload } from './dashboard-payload';
import { previousWeek } from '../lib/weekly';

// Resumen semanal por mail: los lunes (hora de Argentina), con la semana anterior (lunes a
// domingo) comparada con la previa. Usa el mismo cálculo que el dashboard.
async function metrics(userId:string,start:string,end:string):Promise<WeekMetrics> {
  const payload=await dashboardPayload(userId,new URL(`https://rentia.local/api/dashboard?start=${start}&end=${end}`));
  const m=payload.metrics;
  return {revenue:Number(m.totalRevenue||0),profit:Number(m.profit||0),margin:Number(m.margin||0),orders:Number(m.totalOrders||0),aov:Number(m.totalAov||0),adSpend:Number(m.totalAdSpend||0)};
}

export async function weeklySummaryEmails(now=new Date(),send:Sender=sendEmail) {
  const week=previousWeek(now);
  if (!week.isMonday) return {skipped:'not_monday'};
  let sent=0,failed=0;
  for (const userId of await weeklyEmailUsers()) {
    try {
      const [current,previous]=await Promise.all([metrics(userId,week.from,week.to),metrics(userId,week.prevFrom,week.prevTo)]);
      const result=await notify(userId,'weekly_summary',week.from,account=>weeklySummaryEmail({ownerName:account.owner_name,storeName:storeName(account),from:week.from,to:week.to,current,previous}),send);
      if (result.sent) sent++;
    } catch { failed++; }
  }
  return {sent,failed};
}
