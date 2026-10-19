// Ventas y ganancia por categoría de producto (las de Tiendanube). Un producto puede estar en
// varias categorías: cuenta completo en cada una, así que las categorías no suman el total.
export type CategoryInput={categories?:string|null;revenue:number;profit:number;units_sold:number;provider?:string};
export type CategoryRow={name:string;revenue:number;profit:number;units:number;products:number;margin:number;share:number};
export const NO_CATEGORY='Sin categoría';

export function productCategories(value:string|null|undefined) {
  if(!value)return [];
  try {const parsed=JSON.parse(value) as unknown;return Array.isArray(parsed)?parsed.filter((item):item is string=>typeof item==='string'&&Boolean(item.trim())):[];}
  catch {return [];}
}

export function categorySummary(rows:CategoryInput[]) {
  const total=rows.reduce((sum,row)=>sum+Number(row.revenue||0),0);
  const groups=new Map<string,{revenue:number;profit:number;units:number;products:number}>();
  let withCategory=0;
  for(const row of rows) {
    const names=productCategories(row.categories);
    if(names.length)withCategory++;
    for(const name of names.length?names:[NO_CATEGORY]) {
      const group=groups.get(name)||{revenue:0,profit:0,units:0,products:0};
      group.revenue+=Number(row.revenue||0);group.profit+=Number(row.profit||0);group.units+=Number(row.units_sold||0);group.products++;
      groups.set(name,group);
    }
  }
  const categories:CategoryRow[]=[...groups.entries()].map(([name,group])=>({name,...group,margin:group.revenue?group.profit/group.revenue*100:0,share:total?group.revenue/total:0}))
    .sort((a,b)=>(a.name===NO_CATEGORY?1:0)-(b.name===NO_CATEGORY?1:0)||b.revenue-a.revenue);
  return {categories,hasCategories:withCategory>0};
}

export function inCategory(row:CategoryInput,category:string|null) {
  if(!category)return true;
  const names=productCategories(row.categories);
  return category===NO_CATEGORY?names.length===0:names.includes(category);
}
