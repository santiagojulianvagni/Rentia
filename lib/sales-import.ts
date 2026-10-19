// Lectura de ventas de un local desde Excel o CSV (lo que exporte el sistema de caja).
// Reconoce las columnas por el encabezado o por el contenido, entiende fechas y montos en
// formato argentino ("1.234,56", "31/12/2026") y agrupa por día.
export type Cell=string|number|boolean|Date|null|undefined;
export type ColumnRole='date'|'revenue'|'orders'|'cost';
export type Mapping={date:number;revenue:number;orders:number|null;cost:number|null;rowsAre:'sales'|'days';headerRow:number};
export type ImportDay={date:string;orders:number;revenue:number;productCost:number|null};

const pad=(value:number)=>String(value).padStart(2,'0');
const iso=(year:number,month:number,day:number)=>{
  const date=new Date(Date.UTC(year,month-1,day));
  return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day?`${year}-${pad(month)}-${pad(day)}`:null;
};
const fold=(value:string)=>value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();

// CSV con coma, punto y coma o tabulación, y comillas dobles.
export function parseCsv(text:string):string[][] {
  const clean=text.replace(/^﻿/,'');
  const firstLine=clean.split(/\r?\n/).find(line=>line.trim())||'';
  const delimiter=[';','\t',','].map(char=>[char,firstLine.split(char).length] as const).sort((a,b)=>b[1]-a[1])[0][0];
  const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
  for(let index=0;index<clean.length;index++) {
    const char=clean[index];
    if(quoted){if(char==='"'&&clean[index+1]==='"'){cell+='"';index++;}else if(char==='"')quoted=false;else cell+=char;continue;}
    if(char==='"')quoted=true;
    else if(char===delimiter){row.push(cell);cell='';}
    else if(char==='\n'||char==='\r'){if(char==='\r'&&clean[index+1]==='\n')index++;row.push(cell);rows.push(row);row=[];cell='';}
    else cell+=char;
  }
  if(cell||row.length){row.push(cell);rows.push(row);}
  return rows.filter(item=>item.some(value=>value.trim()));
}

// "$ 1.234,56", "1,234.56", "1234.5", "(500)" → número. null si no es un monto.
export function parseAmount(value:Cell):number|null {
  if(typeof value==='number')return Number.isFinite(value)?value:null;
  if(typeof value!=='string')return null;
  let text=value.trim();
  if(!text)return null;
  const negative=/^\(.*\)$/.test(text)||/^-/.test(text)||/-$/.test(text);
  text=text.replace(/[()$\s]|ARS|USD|U\$S|-/gi,'');
  if(!/^[\d.,]+$/.test(text))return null;
  const lastComma=text.lastIndexOf(','),lastDot=text.lastIndexOf('.');
  if(lastComma>=0&&lastDot>=0) text=lastComma>lastDot?text.replace(/\./g,'').replace(',','.'):text.replace(/,/g,'');
  else if(lastComma>=0) text=/^\d{1,3}(,\d{3})+$/.test(text)?text.replace(/,/g,''):text.replace(',','.');
  else if(lastDot>=0&&/^\d{1,3}(\.\d{3})+$/.test(text)) text=text.replace(/\./g,'');
  const number=Number(text);
  return Number.isFinite(number)?negative?-number:number:null;
}

// Fecha de una celda: objeto Date, número de serie de Excel o texto. dayFirst decide entre
// 03/04 = 3 de abril (Argentina) o 4 de marzo (formato de Estados Unidos).
export function parseDate(value:Cell,dayFirst=true):string|null {
  if(value instanceof Date)return Number.isNaN(value.getTime())?null:iso(value.getUTCFullYear(),value.getUTCMonth()+1,value.getUTCDate());
  if(typeof value==='number'){
    if(value<20000||value>80000)return null;
    const date=new Date(Date.UTC(1899,11,30)+Math.floor(value)*86400000);
    return iso(date.getUTCFullYear(),date.getUTCMonth()+1,date.getUTCDate());
  }
  if(typeof value!=='string')return null;
  const text=value.trim();
  let match=text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?$/);
  if(match)return iso(Number(match[1]),Number(match[2]),Number(match[3]));
  match=text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?:[ ,T].*)?$/);
  if(match){
    const year=match[3].length===2?2000+Number(match[3]):Number(match[3]);
    const [day,month]=dayFirst?[Number(match[1]),Number(match[2])]:[Number(match[2]),Number(match[1])];
    return iso(year,month,day);
  }
  return null;
}

// Si alguna fecha tiene el segundo número mayor a 12, la columna viene en formato mes/día.
export function detectDayFirst(values:Cell[]) {
  for(const value of values) {
    const match=typeof value==='string'?value.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}/):null;
    if(match&&Number(match[2])>12)return false;
    if(match&&Number(match[1])>12)return true;
  }
  return true;
}

const HEADER_HINTS:Record<ColumnRole,RegExp[]>={
  date:[/^fecha/,/fecha/,/^dia$/,/^date/],
  revenue:[/^total( vendido| venta| ventas| facturado| cobrado)?$/,/importe total/,/monto total/,/^total/,/venta/,/importe/,/monto/,/facturad/,/cobrado/,/total/],
  orders:[/cantidad de (ventas|tickets|operaciones|comprobantes|ordenes)/,/^(tickets|operaciones|ordenes|comprobantes|transacciones)$/,/tickets/,/operaciones/,/comprobantes/],
  cost:[/costo/,/^cmv$/,/mercaderia/],
};

// La fila de encabezados es la primera con al menos dos textos y sin fechas.
export function findHeaderRow(rows:Cell[][]) {
  for(let index=0;index<Math.min(rows.length,15);index++) {
    const texts=rows[index].filter(cell=>typeof cell==='string'&&cell.trim()&&parseAmount(cell)===null&&parseDate(cell)===null);
    if(texts.length>=2)return index;
  }
  return -1;
}

export function guessMapping(rows:Cell[][]):Mapping|null {
  if(!rows.length)return null;
  const headerRow=findHeaderRow(rows);
  const headers=headerRow>=0?rows[headerRow].map(cell=>fold(String(cell??''))):[];
  const body=rows.slice(headerRow+1).slice(0,200);
  const width=Math.max(...rows.map(row=>row.length));
  const used=new Set<number>();
  const byHeader=(role:ColumnRole)=>{
    for(const hint of HEADER_HINTS[role]) {
      const index=headers.findIndex((header,column)=>!used.has(column)&&hint.test(header));
      if(index>=0){used.add(index);return index;}
    }
    return null;
  };
  const share=(column:number,test:(cell:Cell)=>boolean)=>{const cells=body.map(row=>row[column]).filter(cell=>cell!==null&&cell!==undefined&&String(cell).trim()!=='');return cells.length?cells.filter(test).length/cells.length:0;};
  let date=byHeader('date');
  if(date===null){for(let column=0;column<width;column++)if(!used.has(column)&&share(column,cell=>parseDate(cell)!==null)>=.8){date=column;used.add(column);break;}}
  const cost=byHeader('cost');
  const orders=byHeader('orders');
  let revenue=byHeader('revenue');
  if(revenue===null){
    // Sin encabezado claro: la columna numérica con la suma más grande.
    let best=-1,bestSum=0;
    for(let column=0;column<width;column++){
      if(used.has(column)||share(column,cell=>parseAmount(cell)!==null)<.8)continue;
      const sum=body.reduce((total,row)=>total+Math.abs(parseAmount(row[column])||0),0);
      if(sum>bestSum){best=column;bestSum=sum;}
    }
    revenue=best>=0?best:null;
  }
  if(date===null||revenue===null)return null;
  // Si la misma fecha aparece en varias filas, cada fila es una venta.
  const dayFirst=detectDayFirst(body.map(row=>row[date]));
  const dates=body.map(row=>parseDate(row[date],dayFirst)).filter(Boolean);
  const rowsAre=new Set(dates).size<dates.length?'sales':'days';
  return {date,revenue,orders,cost,rowsAre,headerRow};
}

export function aggregateDays(rows:Cell[][],mapping:Mapping) {
  const body=rows.slice(mapping.headerRow+1);
  const dayFirst=detectDayFirst(body.map(row=>row[mapping.date]));
  const days=new Map<string,{orders:number;revenue:number;cost:number;costRows:number;rows:number}>();
  const skipped:Array<{row:number;reason:string}>=[];
  body.forEach((row,index)=>{
    if(row.every(cell=>cell===null||cell===undefined||String(cell).trim()===''))return;
    const date=parseDate(row[mapping.date],dayFirst);
    const revenue=parseAmount(row[mapping.revenue]);
    const line=mapping.headerRow+index+2;
    if(!date){skipped.push({row:line,reason:'fecha que no se entiende'});return;}
    if(revenue===null){skipped.push({row:line,reason:'importe que no se entiende'});return;}
    const day=days.get(date)||{orders:0,revenue:0,cost:0,costRows:0,rows:0};
    const orders=mapping.orders===null?null:parseAmount(row[mapping.orders]);
    day.orders+=orders!==null?Math.round(orders):mapping.rowsAre==='sales'?1:0;
    day.revenue+=revenue;day.rows++;
    const cost=mapping.cost===null?null:parseAmount(row[mapping.cost]);
    if(cost!==null){day.cost+=cost;day.costRows++;}
    days.set(date,day);
  });
  const result:ImportDay[]=[...days.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([date,day])=>({
    date,orders:Math.max(0,day.orders),revenue:Math.round(day.revenue*100)/100,
    // El costo del día cuenta solo si vino en todas sus filas; si no, se usa el % del local.
    productCost:mapping.cost!==null&&day.costRows===day.rows?Math.round(day.cost*100)/100:null,
  }));
  const negative=result.filter(day=>day.revenue<0).map(day=>day.date);
  return {days:result.filter(day=>day.revenue>=0),skipped,negative,
    totals:{days:result.length,orders:result.reduce((sum,day)=>sum+day.orders,0),revenue:result.reduce((sum,day)=>sum+Math.max(0,day.revenue),0)},
    range:result.length?{from:result[0].date,to:result[result.length-1].date}:null};
}

export const columnLabel=(rows:Cell[][],headerRow:number,column:number)=>{
  const header=headerRow>=0?String(rows[headerRow]?.[column]??'').trim():'';
  return header||`Columna ${String.fromCharCode(65+(column%26))}`;
};
