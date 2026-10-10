import type {ZodType} from 'zod';

// Shared request pipeline for authenticated API routes: session, role, origin,
// JSON body validation and error handling live here instead of being repeated
// in every route. It has no Clerk or database imports so it can be tested with node:test.

export class HttpError extends Error {
  readonly status:number;
  readonly code:string;
  readonly extra:Record<string,unknown>|undefined;
  constructor(status:number,code:string,extra?:Record<string,unknown>) {
    super(code);
    this.name='HttpError';
    this.status=status;
    this.code=code;
    this.extra=extra;
  }
}

export type Access='member'|'manager';

// 'same': the browser Origin must match the request origin.
// 'configured': both must match the public origin (RENTIA_PUBLIC_ORIGIN).
export type OriginPolicy='same'|'configured';

export type RouteOptions<TBody>={
  access?:Access;
  origin?:OriginPolicy;
  body?:ZodType<TBody>;
  // Error code for a malformed or invalid body. Routes keep their historical codes.
  invalidBody?:string;
  // Sent with every JSON response of the route, errors included.
  headers?:Record<string,string>;
};

export type RouteContext<TUser,TBody>={user:TUser;body:TBody;request:Request;url:URL};

export type RouteDeps<TUser>={
  getUser:()=>Promise<TUser|null>;
  canManage:(user:TUser)=>boolean;
  configuredOrigin:()=>string;
  log?:(entry:Record<string,unknown>)=>void;
};

function json(body:unknown,status:number,headers?:Record<string,string>) {
  return Response.json(body,{status,headers});
}

function defaultLog(entry:Record<string,unknown>) {
  console.error(JSON.stringify(entry));
}

export function assertOrigin(request:Request,expected:string) {
  if(request.headers.get('origin')!==expected||new URL(request.url).origin!==expected) throw new HttpError(403,'invalid_origin');
}

// Validates an already-parsed value; throws a 400 with the given code and the field issues.
export function validate<T>(schema:ZodType<T>,value:unknown,invalidCode='invalid_body'):T {
  const parsed=schema.safeParse(value);
  if(!parsed.success) throw new HttpError(400,invalidCode,{issues:parsed.error.issues.map(issue=>({path:issue.path.join('.'),message:issue.message}))});
  return parsed.data;
}

// An empty body is validated as undefined, so schemas with .default() accept it.
export async function readJsonBody<T>(request:Request,schema:ZodType<T>,invalidCode='invalid_body'):Promise<T> {
  const text=await request.text();
  let raw:unknown=undefined;
  if(text.trim()) {
    try { raw=JSON.parse(text); }
    catch { throw new HttpError(400,invalidCode); }
  }
  return validate(schema,raw,invalidCode);
}

export function createRoute<TUser>(deps:RouteDeps<TUser>) {
  return function route<TBody=undefined>(options:RouteOptions<TBody>,handler:(ctx:RouteContext<TUser,TBody>)=>unknown) {
    return async (request:Request):Promise<Response>=>{
      const url=new URL(request.url);
      try {
        const user=await deps.getUser();
        if(!user) throw new HttpError(401,'unauthorized');
        if(options.access==='manager'&&!deps.canManage(user)) throw new HttpError(403,'forbidden');
        if(options.origin) assertOrigin(request,options.origin==='configured'?deps.configuredOrigin():url.origin);
        const body=options.body?await readJsonBody(request,options.body,options.invalidBody):undefined as TBody;
        const result=await handler({user,body,request,url});
        return result instanceof Response?result:json(result??{ok:true},200,options.headers);
      } catch(error) {
        if(error instanceof HttpError) return json({error:error.code,...error.extra},error.status,options.headers);
        (deps.log||defaultLog)({level:'error',method:request.method,path:url.pathname,message:error instanceof Error?error.message:String(error)});
        return json({error:'internal_error'},500,options.headers);
      }
    };
  };
}
