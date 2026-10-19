import {importHistoryStart} from './import-history';

export type ImportWindow={start:string;end:string;page:number};
export type ImportProgress={version:number;since:string|null;until:string;productsPage:number;productsDone:boolean;windows:ImportWindow[];orders:number;products:number;done:boolean};
// 10: las órdenes traen cliente anónimo, provincia, ciudad, envío y canal; los productos, categorías.
export const IMPORT_VERSION=10;
export const IMPORT_PAGE_SIZE=50;

export function newImportProgress(previous:ImportProgress|null,now=new Date()):ImportProgress {
  const since=previous?.done&&previous.version===IMPORT_VERSION?new Date(Date.parse(previous.until)-5*60*1000).toISOString():null;
  return {version:IMPORT_VERSION,since,until:now.toISOString(),productsPage:1,productsDone:false,windows:[{start:since||importHistoryStart(now),end:now.toISOString(),page:1}],orders:0,products:0,done:false};
}

export function splitImportWindow(progress:ImportProgress) {
  const current=progress.windows.at(-1);
  if(!current)throw new Error('No hay un intervalo pendiente');
  const start=Date.parse(current.start),end=Date.parse(current.end);
  if(end-start<=1000)throw new Error('Tiendanube limita los resultados de este intervalo. La importación quedó pendiente, sin omitir órdenes.');
  const middle=new Date(Math.floor((start+end)/2)).toISOString();
  // Boundaries deliberately overlap: UPSERTs prevent duplicates, including
  // orders with exactly the same timestamp as the split.
  progress.windows.splice(-1,1,{start:current.start,end:middle,page:1},{start:middle,end:current.end,page:1});
}

export function importOrdersPath(progress:ImportProgress) {
  const window=progress.windows.at(-1);
  if(!window)return null;
  const key=progress.since?'updated_at':'created_at';
  return `orders?${key}_min=${encodeURIComponent(window.start)}&${key}_max=${encodeURIComponent(window.end)}&aggregates=fulfillment_orders&page=${window.page}&per_page=${IMPORT_PAGE_SIZE}`;
}

export function advanceImportWindow(progress:ImportProgress,count:number) {
  const current=progress.windows.at(-1);
  if(!current)throw new Error('No hay un intervalo pendiente');
  progress.orders+=count;
  if(count<IMPORT_PAGE_SIZE)progress.windows.pop();
  else if(current.page>=10000/IMPORT_PAGE_SIZE)splitImportWindow(progress);
  else current.page++;
  progress.done=progress.productsDone&&progress.windows.length===0;
}

export function parseImportProgress(value:string):ImportProgress {
  const state=JSON.parse(value) as ImportProgress;
  // Una importación de una versión anterior se reemplaza por una completa con los datos nuevos.
  if(Number.isSafeInteger(state.version)&&state.version<IMPORT_VERSION)return newImportProgress(null);
  if(state.version!==IMPORT_VERSION||!Array.isArray(state.windows)||!Number.isFinite(Date.parse(state.until))||!Number.isSafeInteger(state.productsPage)||state.productsPage<1)throw new Error('El avance de importación no es válido');
  if(!state.since&&!state.done) {
    // Upgrade pending all-time imports without resetting completed jobs or
    // deleting rows already saved. Clipping a window changes its page offsets.
    const earliest=importHistoryStart(new Date(state.until));
    state.windows=state.windows.filter(window=>Date.parse(window.end)>=Date.parse(earliest)).map(window=>Date.parse(window.start)<Date.parse(earliest)?{...window,start:earliest,page:1}:window);
  }
  return state;
}
