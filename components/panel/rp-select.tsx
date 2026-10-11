'use client';

import { Children, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

type Option={value:string;label:string;disabled?:boolean};
type ChangeEvent={target:{value:string}};
type Props={value:string;onChange?:(event:ChangeEvent)=>void;disabled?:boolean;children:ReactNode;'aria-label'?:string;id?:string};

function text(node:ReactNode):string {
  if(node===null||node===undefined||typeof node==='boolean')return '';
  if(typeof node==='string'||typeof node==='number')return String(node);
  if(Array.isArray(node))return node.map(text).join('');
  if(isValidElement(node))return text((node.props as {children?:ReactNode}).children);
  return '';
}

// Lista desplegable con el estilo del panel. Se usa igual que un <select> con <option>.
export default function RpSelect({value,onChange,disabled=false,children,'aria-label':ariaLabel,id:externalId}:Props) {
  const id=useId();
  const trigger=useRef<HTMLButtonElement>(null);
  const menu=useRef<HTMLDivElement>(null);
  const optionRefs=useRef<Array<HTMLButtonElement|null>>([]);
  const [open,setOpen]=useState(false);
  const [active,setActive]=useState(0);
  const [position,setPosition]=useState<{left:number;top:number;width:number;maxHeight:number}|null>(null);
  const options:Option[]=Children.toArray(children).filter((child):child is ReactElement<{value?:string;children?:ReactNode;disabled?:boolean}>=>isValidElement(child)).map(child=>({value:String(child.props.value??''),label:text(child.props.children),disabled:child.props.disabled}));
  const selected=options.find(option=>option.value===value);
  function show(){if(disabled)return;setActive(Math.max(0,options.findIndex(option=>option.value===value)));setOpen(true);}
  function close(focus=false){setOpen(false);setPosition(null);if(focus)trigger.current?.focus();}
  function choose(option:Option){if(option.disabled)return;onChange?.({target:{value:option.value}});close(true);}
  useLayoutEffect(()=>{
    if(!open)return;
    const bounds=(trigger.current?.closest('.p-input')||trigger.current)?.getBoundingClientRect();if(!bounds)return;
    const width=Math.min(Math.max(bounds.width,180),window.innerWidth-24);
    const height=Math.min(options.length*40+12,320);const below=window.innerHeight-bounds.bottom-16;const above=bounds.top-16;
    const down=below>=Math.min(height,200)||below>=above;const maxHeight=Math.max(80,Math.min(320,down?below:above));
    setPosition({left:Math.max(12,Math.min(bounds.left,window.innerWidth-width-12)),top:down?bounds.bottom+6:bounds.top-Math.min(height,maxHeight)-6,width,maxHeight});
  },[open,options.length]);
  useEffect(()=>{if(open&&position)optionRefs.current[active]?.focus();},[open,active,position]);
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(!trigger.current?.contains(event.target as Node)&&!menu.current?.contains(event.target as Node))close();};
    const scroll=(event:Event)=>{if(!menu.current?.contains(event.target as Node))close();};
    const resize=()=>close();
    document.addEventListener('pointerdown',outside);window.addEventListener('scroll',scroll,true);window.addEventListener('resize',resize);
    return()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('scroll',scroll,true);window.removeEventListener('resize',resize);};
  },[open]);
  return <>
    <button ref={trigger} id={externalId} type="button" className="p-selectTrigger" disabled={disabled} aria-label={ariaLabel?`${ariaLabel}: ${selected?.label||'Seleccionar'}`:undefined} aria-haspopup="listbox" aria-expanded={open} aria-controls={open?id:undefined}
      onClick={()=>open?close():show()} onKeyDown={event=>{if(['ArrowDown','ArrowUp','Enter',' '].includes(event.key)){event.preventDefault();show();}}}>
      <span>{selected?.label||'Seleccionar'}</span><ChevronDown aria-hidden="true"/>
    </button>
    {open&&position&&createPortal(<div ref={menu} id={id} className="p-selectMenu" role="listbox" aria-label={ariaLabel} style={position}
      onKeyDown={event=>{
        if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setActive(current=>(current+(event.key==='ArrowDown'?1:-1)+options.length)%options.length);}
        else if(event.key==='Home'||event.key==='End'){event.preventDefault();setActive(event.key==='Home'?0:options.length-1);}
        else if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);}
        else if(event.key==='Tab'){event.preventDefault();close(true);}
      }}>{options.map((option,index)=><button type="button" role="option" key={`${option.value}-${index}`} ref={node=>{optionRefs.current[index]=node;}} aria-selected={value===option.value} disabled={option.disabled} tabIndex={index===active?0:-1} onFocus={()=>setActive(index)} onClick={()=>choose(option)}><span>{option.label}</span>{value===option.value&&<Check aria-hidden="true"/>}</button>)}</div>,document.body)}
  </>;
}
