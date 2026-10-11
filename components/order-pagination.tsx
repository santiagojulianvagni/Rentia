'use client';

export const ORDERS_PAGE_SIZE=100;

export function orderPageWindow(total:number,page:number) {
  const pages=Math.max(1,Math.ceil(total/ORDERS_PAGE_SIZE));
  const current=Math.min(pages,Math.max(1,page));
  const start=(current-1)*ORDERS_PAGE_SIZE;
  return {pages,current,start,end:Math.min(total,start+ORDERS_PAGE_SIZE)};
}

export default function OrderPagination({total,page,onChange,position}:{total:number;page:number;onChange:(page:number)=>void;position:'top'|'bottom'}) {
  const {pages,current,start,end}=orderPageWindow(total,page);
  if(!total)return null;
  const number=(value:number)=>value.toLocaleString('es-AR');
  const visible=[...new Set([1,current-1,current,current+1,pages])].filter(value=>value>=1&&value<=pages).sort((a,b)=>a-b);
  return <nav className={`p-pager ${position==='top'?'p-pagerTop':'p-pagerBottom'}`} aria-label={`Páginas de órdenes · ${position==='top'?'arriba':'abajo'}`}>
    <span>{number(start+1)}–{number(end)} de {number(total)} órdenes · hasta 100 por página</span>
    <div className="p-pages">
      <button type="button" disabled={current===1} onClick={()=>onChange(current-1)} aria-label="Página anterior">‹</button>
      {visible.map((value,index)=><span key={value} style={{display:'contents'}}>{index>0&&value-visible[index-1]>1&&<span className="p-ellipsis" aria-hidden="true">…</span>}<button type="button" className={value===current?'p-on':''} aria-label={`Página ${value}`} aria-current={value===current?'page':undefined} onClick={()=>onChange(value)}>{value}</button></span>)}
      <button type="button" disabled={current===pages} onClick={()=>onChange(current+1)} aria-label="Página siguiente">›</button>
    </div>
  </nav>;
}
