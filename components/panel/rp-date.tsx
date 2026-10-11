'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

type ChangeEvent={target:{value:string}};
type Props={value:string;onChange?:(event:ChangeEvent)=>void;min?:string;max?:string;required?:boolean;disabled?:boolean;'aria-label'?:string;id?:string;placeholder?:string};

const pad=(value:number)=>String(value).padStart(2,'0');
const iso=(date:Date)=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
const parse=(value:string|undefined)=>{if(!value||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;const [y,m,d]=value.split('-').map(Number);return new Date(y,m-1,d);};
const WEEK=['L','M','M','J','V','S','D'];

// Selector de fecha con el estilo del panel. Se usa igual que <input type="date"> y devuelve AAAA-MM-DD.
export default function RpDate({value,onChange,min,max,required=false,disabled=false,'aria-label':ariaLabel,id:externalId,placeholder='Elegir fecha'}:Props) {
  const id=useId();
  const trigger=useRef<HTMLButtonElement>(null);
  const panel=useRef<HTMLDivElement>(null);
  const selected=parse(value);
  const [open,setOpen]=useState(false);
  const [view,setView]=useState(()=>selected||parse(max)||new Date());
  const [focusDay,setFocusDay]=useState<string>(value||iso(new Date()));
  const [position,setPosition]=useState<{left:number;top:number}|null>(null);
  const label=selected?new Intl.DateTimeFormat('es-AR',{day:'numeric',month:'short',year:'numeric'}).format(selected):placeholder;
  const allowed=(day:string)=>(!min||day>=min)&&(!max||day<=max);
  function show(){if(disabled)return;const start=selected||parse(max)||new Date();setView(new Date(start.getFullYear(),start.getMonth(),1));setFocusDay(value||iso(start));setOpen(true);}
  function close(focus=false){setOpen(false);setPosition(null);if(focus)trigger.current?.focus();}
  function choose(day:string){if(!allowed(day))return;onChange?.({target:{value:day}});close(true);}
  function moveFocus(days:number){const current=parse(focusDay)||new Date();current.setDate(current.getDate()+days);setFocusDay(iso(current));if(current.getMonth()!==view.getMonth()||current.getFullYear()!==view.getFullYear())setView(new Date(current.getFullYear(),current.getMonth(),1));}
  useLayoutEffect(()=>{
    if(!open)return;
    const bounds=(trigger.current?.closest('.p-input')||trigger.current)?.getBoundingClientRect();if(!bounds)return;
    const width=292,height=340;
    const down=window.innerHeight-bounds.bottom-16>=height||bounds.top<height;
    setPosition({left:Math.max(12,Math.min(bounds.left,window.innerWidth-width-12)),top:down?bounds.bottom+6:bounds.top-height-6});
  },[open]);
  useEffect(()=>{if(open&&position)panel.current?.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)?.focus();},[open,position,focusDay,view]);
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(!trigger.current?.contains(event.target as Node)&&!panel.current?.contains(event.target as Node))close();};
    const resize=()=>close();
    document.addEventListener('pointerdown',outside);window.addEventListener('resize',resize);
    return()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',resize);};
  },[open]);
  const first=new Date(view.getFullYear(),view.getMonth(),1);
  const offset=(first.getDay()+6)%7;
  const daysInMonth=new Date(view.getFullYear(),view.getMonth()+1,0).getDate();
  const cells:Array<string|null>=[...Array(offset).fill(null),...Array.from({length:daysInMonth},(_,index)=>iso(new Date(view.getFullYear(),view.getMonth(),index+1)))];
  const today=iso(new Date());
  const prevMonth=new Date(view.getFullYear(),view.getMonth()-1,1),nextMonth=new Date(view.getFullYear(),view.getMonth()+1,1);
  const canPrev=!min||iso(new Date(view.getFullYear(),view.getMonth(),0))>=min;
  const canNext=!max||iso(nextMonth)<=max;
  return <>
    <button ref={trigger} id={externalId} type="button" className={`p-dateTrigger ${selected?'':'p-empty'}`} disabled={disabled} aria-label={ariaLabel?`${ariaLabel}: ${label}`:undefined} aria-haspopup="dialog" aria-expanded={open} aria-controls={open?id:undefined} onClick={()=>open?close():show()}>
      <CalendarDays aria-hidden="true"/><span>{label}</span>
    </button>
    {required&&<input className="p-dateRequired" tabIndex={-1} aria-hidden="true" required value={value} onChange={()=>{}}/>}
    {open&&position&&createPortal(<div ref={panel} id={id} className="p-datePanel" role="dialog" aria-label={ariaLabel||'Elegir fecha'} style={position}
      onKeyDown={event=>{
        if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);}
        else if(event.key==='ArrowLeft'){event.preventDefault();moveFocus(-1);}
        else if(event.key==='ArrowRight'){event.preventDefault();moveFocus(1);}
        else if(event.key==='ArrowUp'){event.preventDefault();moveFocus(-7);}
        else if(event.key==='ArrowDown'){event.preventDefault();moveFocus(7);}
      }}>
      <div className="p-dateHead"><button type="button" onClick={()=>setView(prevMonth)} disabled={!canPrev} aria-label="Mes anterior"><ChevronLeft aria-hidden="true"/></button><b>{new Intl.DateTimeFormat('es-AR',{month:'long',year:'numeric'}).format(view)}</b><button type="button" onClick={()=>setView(nextMonth)} disabled={!canNext} aria-label="Mes siguiente"><ChevronRight aria-hidden="true"/></button></div>
      <div className="p-dateGrid" role="grid">{WEEK.map((day,index)=><span key={index} className="p-dateWeek" aria-hidden="true">{day}</span>)}{cells.map((day,index)=>day?<button type="button" key={day} data-day={day} className={`${day===value?'p-on':''} ${day===today?'p-today':''}`} disabled={!allowed(day)} tabIndex={day===focusDay?0:-1} aria-pressed={day===value} aria-label={new Intl.DateTimeFormat('es-AR',{dateStyle:'full'}).format(parse(day)!)} onClick={()=>choose(day)}>{Number(day.slice(8))}</button>:<span key={`e${index}`}/>)}</div>
      <div className="p-dateFoot">{!required&&value?<button type="button" onClick={()=>{onChange?.({target:{value:''}});close(true);}}>Borrar</button>:<span/>}{allowed(today)&&<button type="button" onClick={()=>choose(today)}>Hoy</button>}</div>
    </div>,document.body)}
  </>;
}
