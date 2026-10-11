import {canManageRentia,getRentiaUser} from '../../lib/session';
import {publicOrigin} from '../../lib/public-origin';
import {recordError} from '../../db/database';
import {createRoute} from './handler';

export {HttpError,assertOrigin,validate} from './handler';

// Los errores inesperados quedan en los registros de Vercel (buscar "rentia-error") y en la tabla error_reports.
function logError(entry:Record<string,unknown>) {
  console.error(JSON.stringify({tag:'rentia-error',...entry}));
  const detail=[`${entry.method} ${entry.path}`,entry.stack].filter(Boolean).join('\n');
  void recordError({source:'server',path:String(entry.path||''),message:String(entry.message||'Error'),detail}).catch(()=>undefined);
}

export const route=createRoute({getUser:getRentiaUser,canManage:canManageRentia,configuredOrigin:publicOrigin,log:logError});
