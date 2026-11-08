import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {createTestDatabase} from './helpers/postgres.mjs';

// Instalación desde la tienda de apps de Tiendanube: la tienda queda en espera una hora, atada a
// una cookie, y se conecta a la cuenta de Rentia con la que se ingresa desde ese navegador.
registerHooks({resolve(specifier,context,next){
  try{return next(specifier,context);}catch(error){
    if(error.code==='ERR_MODULE_NOT_FOUND'&&specifier.startsWith('.')&&!/\.[a-z]+$/i.test(specifier))return next(`${specifier}.ts`,context);
    throw error;
  }
}});
const {setDatabase}=await import('../db/client.ts');
const install=await import('../lib/tiendanube-install.ts');
const database=await import('../db/database.ts');
const now='2026-11-08T10:00:00.000Z';
const options={};

async function seed() {
  const {pg,driver}=await createTestDatabase();setDatabase(driver);
  for(const id of ['a','b'])await pg.query("INSERT INTO accounts (user_id,email,owner_name,store_name,trial_started_at,created_at,updated_at) VALUES ($1,$2,'Owner','Store',$3,$3,$3)",[id,`${id}@example.invalid`,now]);
  return pg;
}
const hold=(storeId='777')=>install.holdTiendanubeInstall({storeId,storeName:'Casa Norte',encryptedToken:'sealed',iv:'iv',scopes:'read_orders'});

test('the install cookie is read only when it has the expected shape',()=>{
  const token=install.newInstallToken();
  const request=cookie=>new Request('https://www.rentiaapp.com/x',{headers:{cookie}});
  assert.equal(install.readInstallCookie(request(`a=1; ${install.INSTALL_COOKIE}=${token}; b=2`)),token);
  assert.equal(install.readInstallCookie(request(`${install.INSTALL_COOKIE}=corto`)),null);
  assert.equal(install.readInstallCookie(new Request('https://www.rentiaapp.com/x')),null);
  assert.match(install.installCookie(token),/HttpOnly; Secure; SameSite=Lax/);
  assert.notEqual(install.hashInstallToken(token),token);
});

test('a held install is connected to the account that claims it, only once',async()=>{
  const pg=await seed();
  const token=await hold();
  assert.equal((await database.getPendingInstall(install.hashInstallToken(token))).store_name,'Casa Norte');
  assert.equal((await pg.query('SELECT COUNT(*)::int AS n FROM pending_installs WHERE token_hash=$1',[token])).rows[0].n,0,'only the hash is stored');
  const result=await install.claimTiendanubeInstall('a',token,options);
  assert.deepEqual(result,{claimed:true,storeName:'Casa Norte',automatic:false});
  const integration=(await pg.query("SELECT user_id,external_store_id,encrypted_access_token,status FROM integrations WHERE provider='tiendanube'")).rows;
  assert.deepEqual(integration,[{user_id:'a',external_store_id:'777',encrypted_access_token:'sealed',status:'connected'}]);
  assert.deepEqual(await install.claimTiendanubeInstall('b',token,options),{claimed:false,reason:'none'},'it cannot be used twice');
  assert.deepEqual(await install.claimTiendanubeInstall('a',null,options),{claimed:false,reason:'none'});
});

test('a store already connected to another Rentia account is not moved',async()=>{
  const pg=await seed();
  await database.saveIntegration({userId:'a',provider:'tiendanube',storeId:'777',encryptedToken:'old',iv:'iv',scopes:''});
  const token=await hold();
  assert.deepEqual(await install.claimTiendanubeInstall('b',token,options),{claimed:false,reason:'store_already_connected'});
  assert.equal((await pg.query("SELECT user_id FROM integrations WHERE provider='tiendanube'")).rows[0].user_id,'a');
});

test('installing again replaces the previous wait, and an expired wait is ignored',async()=>{
  const pg=await seed();
  const first=await hold();
  const second=await hold();
  assert.equal(await database.getPendingInstall(install.hashInstallToken(first)),null);
  assert.ok(await database.getPendingInstall(install.hashInstallToken(second)));
  await pg.query("UPDATE pending_installs SET expires_at='2000-01-01T00:00:00.000Z'");
  assert.deepEqual(await install.claimTiendanubeInstall('a',second,options),{claimed:false,reason:'none'});
});
