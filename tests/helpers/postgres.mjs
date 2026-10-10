// In-process Postgres (PGlite) with Rentia's migrations applied.
// Tests run the real database code against it; nothing leaves the machine.
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const migrations=new URL('../../migrations/',import.meta.url);

export async function createTestDatabase({beforeStatement}={}) {
  // int8/numeric as JS numbers, like the production pg driver.
  const pg=new PGlite({parsers:{20:value=>Number(value),1700:value=>Number(value)}});
  for(const file of readdirSync(migrations).filter(name=>name.endsWith('.sql')).sort()) await pg.exec(readFileSync(new URL(file,migrations),'utf8'));
  const wrap=run=>async(text,params)=>{
    beforeStatement?.(text,params);
    const output=await run(text,params);
    return {rows:output.rows,rowCount:output.affectedRows??0};
  };
  const driver={
    query:wrap((text,params)=>pg.query(text,params)),
    transaction:work=>pg.transaction(tx=>work(wrap((text,params)=>tx.query(text,params)))),
  };
  return {pg,driver};
}
