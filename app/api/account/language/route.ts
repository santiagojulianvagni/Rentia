import { z } from 'zod';
import { setAccountLanguage } from '../../../../db/database';
import { route } from '../../../../server/http/route';

// Guarda el idioma elegido en el panel para mandar los mails de la cuenta en ese idioma.
const Body=z.object({language:z.enum(['es','en','pt'])});

export const POST=route({access:'manager',body:Body,invalidBody:'invalid_data'},async({user,body})=>{
  await setAccountLanguage(user.id,body.language);
  return {ok:true};
});
