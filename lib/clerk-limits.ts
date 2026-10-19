// Tope de miembros por organización que permite el plan de Clerk (el gratuito permite 5).
// Al pasar a un plan de Clerk con más miembros, subirlo con CLERK_ORG_MEMBER_CAP en Vercel.
export function clerkMemberCap(env:Record<string,string|undefined>=process.env) {
  const value=Number(env.CLERK_ORG_MEMBER_CAP);
  return Number.isInteger(value)&&value>0?value:5;
}

// Límite a pedirle a Clerk para una tienda: el del plan de Rentia, sin pasar el tope de Clerk.
export function clerkMemberLimit(planLimit:number|null,env:Record<string,string|undefined>=process.env) {
  const cap=clerkMemberCap(env);
  return planLimit===null?cap:Math.min(planLimit,cap);
}
