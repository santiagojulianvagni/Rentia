'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

type Option={value:string;label:string;description?:string};
export default function ThemedSelect({label,value,options,disabled=false,onChange}:{label:string;value:string;options:Option[];disabled?:boolean;onChange:(value:string)=>void}) {
  const id=useId();
  const trigger=useRef<HTMLButtonElement>(null);
  const menu=useRef<HTMLDivElement>(null);
  const optionRefs=useRef<Array<HTMLButtonElement|null>>([]);
  const [open,setOpen]=useState(false);
  const [active,setActive]=useState(0);
  const [position,setPosition]=useState<{left:number;top:number;width:number;maxHeight:number}|null>(null);
  const selected=options.find(option=>option.value===value);
  function show(){if(disabled||trigger.current?.matches(':disabled'))return;setActive(Math.max(0,options.findIndex(option=>option.value===value)));setOpen(true);}
  function close(focus=false){setOpen(false);setPosition(null);if(focus)trigger.current?.focus();}
  useLayoutEffect(()=>{
    if(!open)return;
    const bounds=trigger.current?.getBoundingClientRect();if(!bounds)return;
    const width=Math.min(options.some(option=>option.description)?Math.max(bounds.width,300):bounds.width,window.innerWidth-24);
    const viewport=window.visualViewport;const bottom=(viewport?.height||window.innerHeight)+(viewport?.offsetTop||0);
    const height=Math.min(menu.current?.scrollHeight||options.length*48+34,320);const below=bottom-bounds.bottom-16;const above=bounds.top-16;
    const down=below>=Math.min(height,200)||below>=above;const maxHeight=Math.max(80,Math.min(320,down?below:above));
    setPosition({left:Math.max(12,Math.min(bounds.left,window.innerWidth-width-12)),top:down?bounds.bottom+7:bounds.top-Math.min(height,maxHeight)-7,width,maxHeight});
  },[open,options.length,position?.width]);
  useEffect(()=>{if(open&&position)optionRefs.current[active]?.focus();},[open,active,position]);
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(!trigger.current?.contains(event.target as Node)&&!menu.current?.contains(event.target as Node))close();};
    const scroll=(event:Event)=>{if(!menu.current?.contains(event.target as Node))close();};
    const resize=()=>close();
    document.addEventListener('pointerdown',outside);window.addEventListener('scroll',scroll,true);window.addEventListener('resize',resize);
    return()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('scroll',scroll,true);window.removeEventListener('resize',resize);};
  },[open]);
  if(disabled&&open){setOpen(false);setPosition(null);}
  return <div className="themedSelect">
    <span className="themedSelectLabel" id={`${id}-label`}>{label}</span>
    <button className="themedSelectTrigger" ref={trigger} type="button" disabled={disabled} aria-labelledby={`${id}-label ${id}-value`} aria-haspopup="listbox" aria-expanded={open} aria-controls={open?id:undefined} onClick={()=>open?close():show()} onKeyDown={event=>{if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();show();}}}>
      <span id={`${id}-value`}>{selected?.label||'Seleccionar'}</span><ChevronDown size={18} aria-hidden="true"/>
    </button>
    {open&&position&&createPortal(<div ref={menu} id={id} className="themedSelectMenu" role="listbox" aria-labelledby={`${id}-label`} style={position} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))close();}} onKeyDown={event=>{
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setActive(current=>(current+(event.key==='ArrowDown'?1:-1)+options.length)%options.length);}
      else if(event.key==='Home'||event.key==='End'){event.preventDefault();setActive(event.key==='Home'?0:options.length-1);}
      else if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);}
      else if(event.key==='Tab'){
        event.preventDefault();
        const focusable=[...document.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(node=>!menu.current?.contains(node)&&node.getClientRects().length>0);
        const next=focusable[focusable.indexOf(trigger.current!)+(event.shiftKey?-1:1)];close();(next||trigger.current)?.focus();
      }
    }}>{options.map((option,index)=><button type="button" role="option" key={option.value} ref={node=>{optionRefs.current[index]=node;}} aria-selected={value===option.value} tabIndex={index===active?0:-1} onFocus={()=>setActive(index)} onClick={()=>{onChange(option.value);close(true);}}><span><strong>{option.label}</strong>{option.description&&<small>{option.description}</small>}</span>{value===option.value&&<Check size={18} aria-hidden="true"/>}</button>)}</div>,document.body)}
  </div>;
}
