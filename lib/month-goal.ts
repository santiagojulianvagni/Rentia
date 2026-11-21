// Meta del mes en el dashboard: cuánto llevás, cuánto deberías llevar hoy y cuánto vender por
// día para llegar. La meta es la que puso el dueño o, si no puso ninguna, el punto de equilibrio
// (lo que hay que facturar para cubrir todos los costos, calculado en lib/cashflow.ts).

export type GoalStatus='cumplida'|'adelantado'|'llegas'|'atrasado';
export type GoalInput={custom:number|null;breakEven:number|null;revenue:number;elapsed:number;totalDays:number;projected:number};

export function monthGoal(input:GoalInput) {
  const target=input.custom??input.breakEven;
  if(target===null||target<=0)return null;
  const daysLeft=Math.max(0,input.totalDays-input.elapsed);
  const ideal=target*input.elapsed/input.totalDays;
  const remaining=Math.max(0,target-input.revenue);
  const status:GoalStatus=input.revenue>=target?'cumplida':input.revenue>=ideal?'adelantado':input.projected>=target?'llegas':'atrasado';
  return {
    target,source:input.custom!==null?'propia' as const:'equilibrio' as const,
    revenue:input.revenue,ideal,remaining,daysLeft,status,projected:input.projected,
    perDay:remaining>0&&daysLeft>0?remaining/daysLeft:null,
    progress:Math.min(1,input.revenue/target),idealProgress:Math.min(1,ideal/target),
  };
}
