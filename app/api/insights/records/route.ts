import { getSalesHistory } from '../../../../db/database';
import { route } from '../../../../server/http/route';

// Historial de ventas por día (solo de la propia tienda) para calcular récords y rachas.
export const GET=route({},async({user})=>getSalesHistory(user.id));
