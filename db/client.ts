// Postgres access with the small statement API the app was written against
// (prepare/bind/all/first/run/batch). Production uses Neon through `pg`;
// tests plug in PGlite with setDatabase().

export type Row=Record<string,unknown>;
export type QueryOutput={rows:Row[];rowCount:number|null};
export type Query=(text:string,params:unknown[])=>Promise<QueryOutput>;
export type Driver={query:Query;transaction<T>(work:(query:Query)=>Promise<T>):Promise<T>};

export type RunResult={success:true;meta:{changes:number}};
export type AllResult<T>={results:T[];success:true;meta:{changes:number}};

// SQL is written with `?` placeholders; Postgres wants $1, $2…
// Question marks inside quoted literals or identifiers are left alone.
export function toPositional(sql:string) {
  let output='',index=0,quote:string|null=null;
  for(const char of sql) {
    if(quote) { if(char===quote) quote=null; output+=char; continue; }
    if(char==='\''||char==='"') { quote=char; output+=char; continue; }
    output+=char==='?'?`$${++index}`:char;
  }
  return output;
}

// Flags are stored as 0/1 integers, as they were in SQLite.
function toParam(value:unknown) {
  if(value===undefined) return null;
  if(typeof value==='boolean') return value?1:0;
  return value;
}

export class Statement {
  readonly sql:string;
  readonly params:unknown[];
  private readonly driver:()=>Driver;
  constructor(driver:()=>Driver,sql:string,params:unknown[]=[]) {
    this.driver=driver;
    this.sql=sql;
    this.params=params;
  }
  bind(...values:unknown[]) {
    return new Statement(this.driver,this.sql,values.map(toParam));
  }
  execute(query:Query=this.driver().query) {
    return query(toPositional(this.sql),this.params);
  }
  async all<T=Row>():Promise<AllResult<T>> {
    const output=await this.execute();
    return {results:output.rows as T[],success:true,meta:{changes:output.rowCount??0}};
  }
  async first<T=Row>():Promise<T|null> {
    const output=await this.execute();
    return (output.rows[0] as T|undefined)??null;
  }
  async run():Promise<RunResult> {
    const output=await this.execute();
    return {success:true,meta:{changes:output.rowCount??0}};
  }
}

export class Database {
  private readonly driver:()=>Driver;
  constructor(driver:()=>Driver) { this.driver=driver; }
  prepare(sql:string) { return new Statement(this.driver,sql); }
  // Runs every statement in one transaction: all of them apply or none.
  async batch<T=Row>(statements:Statement[]):Promise<AllResult<T>[]> {
    if(!statements.length) return [];
    return this.driver().transaction(async query=>{
      const results:AllResult<T>[]=[];
      for(const statement of statements) {
        const output=await statement.execute(query);
        results.push({results:output.rows as T[],success:true,meta:{changes:output.rowCount??0}});
      }
      return results;
    });
  }
}

let override:Driver|null=null;
let production:Driver|null=null;

// pg already treats sslmode=require as verify-full and warns about it on every
// connection; naming the mode it actually uses keeps the logs clean.
export function strictSsl(url:string|undefined) {
  return url?.replace(/([?&]sslmode=)(prefer|require|verify-ca)(?=&|$)/,'$1verify-full');
}

async function pgDriver():Promise<Driver> {
  const {Pool,types}=await import('pg');
  // COUNT/SUM return int8/numeric; the app expects JS numbers, as with SQLite.
  types.setTypeParser(20,value=>Number(value));
  types.setTypeParser(1700,value=>Number(value));
  const connectionString=strictSsl(process.env.DATABASE_URL);
  if(!connectionString) throw new Error('DATABASE_URL is not configured');
  const pool=new Pool({connectionString,max:5});
  return {
    query:(text,params)=>pool.query(text,params),
    async transaction(work) {
      const client=await pool.connect();
      try {
        await client.query('BEGIN');
        const result=await work((text,params)=>client.query(text,params));
        await client.query('COMMIT');
        return result;
      } catch(error) {
        await client.query('ROLLBACK').catch(()=>undefined);
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

let pending:Promise<Driver>|null=null;
function lazyDriver():Driver {
  if(override) return override;
  if(production) return production;
  pending??=pgDriver().then(driver=>production=driver);
  const ready=pending;
  return {
    query:async(text,params)=>(await ready).query(text,params),
    transaction:async work=>(await ready).transaction(work),
  };
}

export const db=new Database(lazyDriver);

export function database() { return db; }

// Tests point the app at an in-process Postgres (PGlite).
export function setDatabase(driver:Driver|null) { override=driver; }
