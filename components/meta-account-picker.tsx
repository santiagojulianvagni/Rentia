'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

type AdAccount={external_account_id:string;name:string;currency:string};

export default function MetaAccountPicker({accounts,value,disabled,onChange}:{accounts:AdAccount[];value:string;disabled:boolean;onChange:(id:string)=>void}) {
  const [open,setOpen]=useState(false);
  const [active,setActive]=useState(0);
  const root=useRef<HTMLDivElement>(null);
  const button=useRef<HTMLButtonElement>(null);
  const options=useRef<Array<HTMLButtonElement|null>>([]);
  const id=useId();
  const selected=accounts.find(account=>account.external_account_id===value);
  const selectedIndex=Math.max(0,accounts.findIndex(account=>account.external_account_id===value));

  useEffect(()=>{
    if(!open)return;
    options.current[active]?.focus();
  },[open,active]);
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
    document.addEventListener('pointerdown',outside);
    return ()=>document.removeEventListener('pointerdown',outside);
  },[open]);
  if(disabled&&open)setOpen(false);

  function show() {setActive(selectedIndex);setOpen(true);}
  function choose(account:AdAccount) {
    setOpen(false);button.current?.focus();
    if(account.external_account_id!==value)onChange(account.external_account_id);
  }
  return <div ref={root} className="metaAccountPicker" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))setOpen(false);}}>
    <span id={`${id}-label`} className="metaAccountLabel">Cuenta publicitaria</span>
    <button ref={button} className="metaAccountTrigger" type="button" aria-labelledby={`${id}-label ${id}-value`} aria-haspopup="listbox" aria-expanded={open} aria-controls={open?id:undefined} disabled={disabled||!accounts.length}
      onClick={()=>open?setOpen(false):show()}
      onKeyDown={event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();show();}else if(event.key==='Escape')setOpen(false);}}>
      <img src="/brands/meta.png" alt=""/><span id={`${id}-value`}>{selected?.name||'Seleccionar cuenta'}</span>{selected&&<small>{selected.currency}</small>}<ChevronDown aria-hidden="true"/>
    </button>
    {open&&<div id={id} className="metaAccountOptions" role="listbox" aria-labelledby={`${id}-label`} onKeyDown={event=>{
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setActive(current=>(current+(event.key==='ArrowDown'?1:-1)+accounts.length)%accounts.length);}
      else if(event.key==='Home'||event.key==='End'){event.preventDefault();setActive(event.key==='Home'?0:accounts.length-1);}
      else if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setOpen(false);button.current?.focus();}
    }}>
      {accounts.map((account,index)=><button ref={node=>{options.current[index]=node;}} key={account.external_account_id} type="button" role="option" aria-selected={account.external_account_id===value} tabIndex={active===index?0:-1} onFocus={()=>setActive(index)} onClick={()=>choose(account)}>
        <span><strong>{account.name}</strong><small>ID {account.external_account_id.replace(/^act_/,'')}</small></span><span className="metaAccountCurrency">{account.currency}</span>{account.external_account_id===value?<Check aria-hidden="true"/>:<span className="metaAccountCheckSpace"/>}
      </button>)}
    </div>}
  </div>;
}
