import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
const {createRoute,HttpError}=await import('../server/http/handler.ts');

const owner={id:'store-1',role:'owner'};
const member={id:'store-1',role:'member'};
const logs=[];
function routeFor(user) {
  return createRoute({getUser:async()=>user,canManage:current=>current.role!=='member',configuredOrigin:()=>'https://app.rentia.test',log:entry=>logs.push(entry)});
}
function request(body,{method='POST',origin,url='https://app.rentia.test/api/x'}={}) {
  const headers={'content-type':'application/json'};
  if(origin)headers.origin=origin;
  return new Request(url,{method,headers,body:body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body)});
}
async function call(handler,req) {
  const response=await handler(req);
  return {status:response.status,body:await response.json()};
}

test('rejects anonymous requests before running the handler',async()=>{
  let ran=false;
  const handler=routeFor(null)({},()=>{ran=true;});
  assert.deepEqual(await call(handler,request(undefined,{method:'GET'})),{status:401,body:{error:'unauthorized'}});
  assert.equal(ran,false);
});

test('manager routes reject read-only members',async()=>{
  const handler=routeFor(member)({access:'manager'},()=>({ok:true}));
  assert.deepEqual(await call(handler,request(undefined)),{status:403,body:{error:'forbidden'}});
  assert.deepEqual(await call(routeFor(owner)({access:'manager'},()=>({ok:true})),request(undefined)),{status:200,body:{ok:true}});
});

test('malformed JSON returns the route error code instead of a 500',async()=>{
  const handler=routeFor(owner)({body:z.object({id:z.number()}),invalidBody:'invalid_id'},({body})=>({id:body.id}));
  assert.deepEqual(await call(handler,request('{not json')),{status:400,body:{error:'invalid_id'}});
  const invalid=await call(handler,request({id:'7'}));
  assert.equal(invalid.status,400);
  assert.equal(invalid.body.error,'invalid_id');
  assert.equal(invalid.body.issues[0].path,'id');
  assert.deepEqual(await call(handler,request({id:7})),{status:200,body:{id:7}});
});

test('an empty body is validated like a missing value so optional bodies keep working',async()=>{
  const handler=routeFor(owner)({body:z.object({automatic:z.boolean().optional()}).default({})},({body})=>({automatic:body.automatic===true}));
  assert.deepEqual(await call(handler,request(undefined)),{status:200,body:{automatic:false}});
  assert.deepEqual(await call(handler,request({automatic:true})),{status:200,body:{automatic:true}});
});

test('origin policies compare the browser origin with the expected origin',async()=>{
  const same=routeFor(owner)({origin:'same'},()=>({ok:true}));
  assert.equal((await call(same,request(undefined,{origin:'https://evil.test'}))).status,403);
  assert.equal((await call(same,request(undefined,{origin:'https://app.rentia.test'}))).status,200);
  const configured=routeFor(owner)({origin:'configured'},()=>({ok:true}));
  assert.equal((await call(configured,request(undefined,{origin:'https://other.test',url:'https://other.test/api/x'}))).status,403);
  assert.equal((await call(configured,request(undefined,{origin:'https://app.rentia.test'}))).status,200);
});

test('HttpError keeps its status, code and extra fields',async()=>{
  const handler=routeFor(owner)({},()=>{throw new HttpError(409,'team_limit_reached',{capacity:{limit:2}});});
  assert.deepEqual(await call(handler,request(undefined)),{status:409,body:{error:'team_limit_reached',capacity:{limit:2}}});
});

test('unexpected errors are logged and hidden from the client',async()=>{
  logs.length=0;
  const handler=routeFor(owner)({headers:{'cache-control':'no-store'}},()=>{throw new Error('DB exploded: SELECT * FROM secrets');});
  const response=await handler(request(undefined));
  assert.equal(response.status,500);
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.deepEqual(await response.json(),{error:'internal_error'});
  assert.equal(logs.length,1);
  assert.match(logs[0].message,/DB exploded/);
});

test('handlers may return their own Response untouched',async()=>{
  const handler=routeFor(owner)({},()=>new Response('csv',{headers:{'content-type':'text/csv'}}));
  const response=await handler(request(undefined,{method:'GET'}));
  assert.equal(response.headers.get('content-type'),'text/csv');
  assert.equal(await response.text(),'csv');
});
