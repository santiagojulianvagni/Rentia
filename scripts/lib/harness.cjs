// Shared harness for the offline verification scripts: an in-process Postgres
// (PGlite) with the real migrations, and a loader that runs the app's
// TypeScript modules with mocked session, environment and next/server.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');

// Same `?` -> $n conversion as db/client.ts, for the scripts' own queries.
function positional(sql) {
  let output='',index=0,quote=null;
  for(const char of sql) {
    if(quote){if(char===quote)quote=null;output+=char;continue;}
    if(char==='\''||char==='"'){quote=char;output+=char;continue;}
    output+=char==='?'?`$${++index}`:char;
  }
  return output;
}

async function createPostgres() {
  const pg=new PGlite({parsers:{20:value=>Number(value),1700:value=>Number(value)}});
  for(const file of fs.readdirSync('migrations').filter(name=>name.endsWith('.sql')).sort()) await pg.exec(fs.readFileSync(path.join('migrations',file),'utf8'));
  const wrap=run=>async(text,params)=>{const output=await run(text,params);return {rows:output.rows,rowCount:output.affectedRows??0};};
  const query=(sql,params)=>pg.query(positional(sql),params);
  return {
    pg,
    driver:{
      query:wrap((text,params)=>pg.query(text,params)),
      transaction:work=>pg.transaction(tx=>work(wrap((text,params)=>tx.query(text,params)))),
    },
    async get(sql,...params){return (await query(sql,params)).rows[0];},
    async all(sql,...params){return (await query(sql,params)).rows;},
    async run(sql,...params){const output=await query(sql,params);return {changes:output.affectedRows??0};},
    exec:sql=>pg.exec(sql),
    close:()=>pg.close(),
  };
}

// mocks: {env, session, nextServer} plus optional extra(specifier) returning a module or undefined.
function createLoader({env,session,nextServer,extra}) {
  const loaded=new Map();
  function resolveLocal(from,specifier) {
    const base=path.resolve(path.dirname(from),specifier);
    for(const candidate of [base+'.ts',base+'.tsx',base]) if(fs.existsSync(candidate)&&fs.statSync(candidate).isFile()) return candidate;
    throw new Error(`Cannot resolve ${specifier} from ${from}`);
  }
  function load(filename) {
    const absolute=path.resolve(filename);
    if(loaded.has(absolute)) return loaded.get(absolute).exports;
    const module={exports:{}};
    loaded.set(absolute,module);
    const requireLocal=specifier=>{
      const custom=extra?.(specifier);
      if(custom) return custom;
      if(specifier==='next/server') return nextServer;
      if(!specifier.startsWith('.')) return require(specifier);
      const resolved=resolveLocal(absolute,specifier);
      if(resolved===path.resolve('lib/session.ts')) return session;
      if(resolved===path.resolve('lib/env.ts')) return {env};
      return load(resolved);
    };
    const js=ts.transpileModule(fs.readFileSync(absolute,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
    vm.runInThisContext(`(function(require,module,exports){${js}\n})`,{filename:absolute})(requireLocal,module,module.exports);
    return module.exports;
  }
  return load;
}

module.exports={createPostgres,createLoader,positional};
