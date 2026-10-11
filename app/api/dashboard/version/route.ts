import { getDashboardVersion } from '../../../../db/database';
import { route } from '../../../../server/http/route';

// Consulta liviana: el panel solo recalcula el resumen cuando esta versión cambia.
export const GET=route({},async({user})=>({version:await getDashboardVersion(user.id)}));
