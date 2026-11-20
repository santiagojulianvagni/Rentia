// Preguntas del onboarding sobre el negocio. Las opciones son fijas: el servidor solo acepta
// estos valores.
export const BUSINESS_CATEGORIES=[['indumentaria','Indumentaria y calzado'],['cosmetica','Cosmética y cuidado personal'],['suplementos','Suplementos y salud'],['hogar','Hogar y deco'],['electronica','Electrónica'],['otro','Otro rubro']] as const;
export const MONTHLY_ORDERS=[['0-50','Menos de 50'],['50-300','50 a 300'],['300-1000','300 a 1.000'],['1000+','Más de 1.000']] as const;
export const TAX_CONDITIONS=[['monotributo','Monotributo'],['responsable_inscripto','Responsable inscripto'],['exento','Exento'],['no_se','Todavía no sé']] as const;
export const MAIN_GOALS=[['ganancia','Saber cuánto gano de verdad'],['publicidad','Controlar mi publicidad'],['costos','Ordenar costos y stock'],['planificar','Planificar el mes']] as const;

export type BusinessProfile={category:string|null;monthlyOrders:string|null;taxCondition:string|null;goal:string|null};

const allowed=(options:ReadonlyArray<readonly [string,string]>,value:unknown)=>typeof value==='string'&&options.some(([id])=>id===value)?value:null;

export function parseBusinessProfile(body:Record<string,unknown>):BusinessProfile {
  return {category:allowed(BUSINESS_CATEGORIES,body.category),monthlyOrders:allowed(MONTHLY_ORDERS,body.monthlyOrders),taxCondition:allowed(TAX_CONDITIONS,body.taxCondition),goal:allowed(MAIN_GOALS,body.goal)};
}

// Plan sugerido según las órdenes por mes que declara la tienda.
export const SUGGESTED_PLAN:Record<string,string>={'0-50':'Gratis','50-300':'Starter','300-1000':'Growth','1000+':'Pro'};

// Sección del panel que se abre primero según el objetivo.
export const GOAL_SECTION:Record<string,string>={ganancia:'resumen',publicidad:'publicidad',costos:'costos',planificar:'cashflow'};
