'use client';

import { useLayoutEffect, useRef, useState } from 'react';

// Nombre largo cortado a un ancho fijo. Si no entra, se puede tocar para verlo completo.
export default function RpClamp({text}:{text:string}) {
  const ref=useRef<HTMLSpanElement>(null);
  const [open,setOpen]=useState(false);
  const [cut,setCut]=useState(false);
  useLayoutEffect(()=>{
    const element=ref.current;if(!element)return;
    const measure=()=>setCut(element.scrollWidth>element.clientWidth+1);
    measure();
    const observer=new ResizeObserver(measure);observer.observe(element);
    return()=>observer.disconnect();
  },[text]);
  return <span className={`p-clampWrap ${open?'p-open':''}`}>
    <b ref={ref} className="p-clamp" title={cut&&!open?text:undefined}>{text}</b>
    {(cut||open)&&<button type="button" className="p-clampMore" onClick={event=>{event.stopPropagation();setOpen(value=>!value);}} onKeyDown={event=>event.stopPropagation()} aria-expanded={open}>{open?'Ver menos':'Ver más'}</button>}
  </span>;
}
