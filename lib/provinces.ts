// Las 24 jurisdicciones de la Argentina. Las tiendas reciben la provincia escrita a mano y de
// muchas formas ("CABA", "Capital Federal", "Bs. As."), así que se llevan a un nombre único para
// poder contarlas. Lo que no se reconoce no se cuenta.

const PROVINCES=['Buenos Aires','CABA','Catamarca','Chaco','Chubut','Córdoba','Corrientes','Entre Ríos','Formosa','Jujuy','La Pampa','La Rioja','Mendoza','Misiones','Neuquén','Río Negro','Salta','San Juan','San Luis','Santa Cruz','Santa Fe','Santiago del Estero','Tierra del Fuego','Tucumán'];

const plain=(value:string)=>value.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim();
const BY_NAME=new Map(PROVINCES.map(name=>[plain(name),name]));
const ALIASES:Array<[RegExp,string]>=[
  [/^(caba|c a b a|capital federal|cap fed|ciudad autonoma( de buenos aires)?|ciudad de buenos aires|autonomous city of buenos aires)$/,'CABA'],
  [/^(provincia de )?(buenos aires|bs as|bsas|pcia de buenos aires|gba|gran buenos aires)( provincia)?$/,'Buenos Aires'],
  [/^tierra del fuego/,'Tierra del Fuego'],
  [/^santiago del estero$|^sgo del estero$/,'Santiago del Estero'],
  [/^(provincia de )?cordoba$/,'Córdoba'],
];

export function provinceName(value:string|null|undefined):string|null {
  if(!value)return null;
  const key=plain(value).replace(/^(provincia de|pcia de|prov de|provincia del) /,'');
  for(const [pattern,name] of ALIASES)if(pattern.test(key))return name;
  return BY_NAME.get(key)||null;
}

export const countProvinces=(values:Array<string|null|undefined>)=>new Set(values.map(provinceName).filter(Boolean)).size;
