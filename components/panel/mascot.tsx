'use client';

import { useEffect, useRef, useState } from 'react';
import { Share2, X } from 'lucide-react';
import { MASCOT_ART, type MascotPose } from './mascot-art';
import { dailyGreeting, liveRecords, recordText, todayInArgentina, type Greeting, type Lang, type LiveRecord, type Piece, type SalesDay } from '../../lib/mascot';
import type { ShareContent } from './share-card';
import { buildAchievementShare } from './achievement-share';

// El dibujo es fijo y propio (no viene de datos de nadie), por eso se puede insertar tal cual.
export function Mascot({pose,size,className=''}:{pose:MascotPose;size:number;className?:string}) {
  return <span className={`p-mascot ${className}`} style={{width:size,height:size*1.25}} dangerouslySetInnerHTML={{__html:MASCOT_ART[pose]}}/>;
}

// Un solo pedido del historial, compartido por el saludo y el festejo.
let historyRequest:Promise<SalesDay[]>|null=null;
export function useSalesHistory() {
  const [days,setDays]=useState<SalesDay[]|null>(null);
  useEffect(()=>{
    historyRequest??=fetch('/api/insights/records',{cache:'no-store'}).then(response=>response.ok?response.json():null).then(data=>Array.isArray(data?.days)?data.days as SalesDay[]:[]).catch(()=>{historyRequest=null;return [];});
    let alive=true;
    historyRequest.then(value=>{if(alive)setDays(value);});
    return ()=>{alive=false;};
  },[]);
  return days;
}

// Lo que se guarda en el navegador es solo una comodidad: si falla, el cangurito vuelve a aparecer.
const store={
  get:(key:string)=>{try{return window.localStorage.getItem(key);}catch{return null;}},
  set:(key:string,value:string)=>{try{window.localStorage.setItem(key,value);}catch{/* sin almacenamiento */}},
};
const SEEN_KEY='rentia-records-seen';
const seenRecords=()=>{try{return new Set<string>(JSON.parse(store.get(SEEN_KEY)||'[]'));}catch{return new Set<string>();}};

function Pieces({pieces}:{pieces:Piece[]}) {
  return <>{pieces.map((piece,index)=>piece.strong?<b key={index} className={piece.tone==='up'?'p-pos':piece.tone==='down'?'p-neg':undefined}>{piece.text}</b>:<span key={index}>{piece.text}</span>)}</>;
}

// Saludo del cangurito debajo del "Buen día". Se cierra hasta el día siguiente.
export function MascotGreeting({lang,money}:{lang:Lang;money:(value:number)=>string}) {
  const days=useSalesHistory();
  // La hora y la fecha se toman en el navegador, después de cargar, igual que el "Buen día".
  const [now,setNow]=useState<Date|null>(null);
  const [closed,setClosed]=useState(false);
  useEffect(()=>{queueMicrotask(()=>setNow(new Date()));},[]);
  if(!days||!now||closed)return null;
  const today=todayInArgentina(now),key=`rentia-greeting-${today}`;
  if(store.get(key))return null;
  const greeting:Greeting|null=dailyGreeting(days,today,now.getHours(),lang,money);
  if(!greeting)return null;
  const close=()=>{store.set(key,'1');setClosed(true);};
  const label=lang==='en'?'Close':lang==='pt'?'Fechar':'Cerrar';
  return <div className="p-kGreet p-reveal" translate="no">
    <Mascot pose={greeting.pose} size={56}/>
    <div className="p-kBubble" role="status"><Pieces pieces={greeting.pieces}/><button type="button" onClick={close} aria-label={label}><X className="p-i" aria-hidden="true"/></button></div>
  </div>;
}

// Festejo de un récord: aparece una sola vez por récord (mejor día, semana, mes o hito de ventas).
export function RecordCelebration({lang,money,onShare}:{lang:Lang;money:(value:number)=>string;onShare:(content:ShareContent)=>void}) {
  const days=useSalesHistory();
  const [record,setRecord]=useState<LiveRecord|null>(null);
  const [preparing,setPreparing]=useState(false);
  const chosen=useRef(false);
  useEffect(()=>{
    if(!days||chosen.current)return;
    chosen.current=true;
    const seen=seenRecords(),next=liveRecords(days,todayInArgentina()).find(item=>!seen.has(item.id))||null;
    // Se marca como visto al mostrarlo: si la persona no lo cierra, no se repite en la próxima visita.
    if(next){seen.add(next.id);store.set(SEEN_KEY,JSON.stringify([...seen].slice(-60)));}
    queueMicrotask(()=>setRecord(next));
  },[days]);
  if(!record||!days)return null;
  const text=recordText(record,todayInArgentina(),lang,money);
  // Mismo diseño que en Mis logros: el récord se pasa como logro del historial.
  const share=async()=>{
    const today=todayInArgentina(),date=record.kind==='yesterday'?record.id.slice(4):today;
    const event={id:record.id,kind:record.kind==='yesterday'?'day' as const:record.kind,date,value:record.kind==='orders'?record.previous:record.value,previous:record.kind==='orders'?null:record.previous,previousDate:record.kind==='orders'?null:record.previousDate};
    setPreparing(true);
    try{onShare(await buildAchievementShare(event,days,today,money));}finally{setPreparing(false);}
  };
  const confetti=Array.from({length:24},(_,index)=><i key={index} style={{left:`${(index*37)%100}%`,background:['#21D4C2','#3B8CF6','#7FE6DB','#ffffff'][index%4],animationDelay:`${(index%7)*.18}s`,animationDuration:`${1.8+(index%5)*.3}s`}}/>);
  return <div className="p-card p-record p-reveal" translate="no" role="status">
    <div className="p-recordConfetti" aria-hidden="true">{confetti}</div>
    <Mascot pose="festeja" size={104} className="p-kHop"/>
    <div className="p-recordBody">
      <span className="p-eyebrowS">{text.tag}</span>
      <h2>{text.title}</h2>
      <p><Pieces pieces={text.pieces}/></p>
      <div className="p-actions"><button type="button" className="p-btn p-primary" onClick={()=>setRecord(null)}>{lang==='en'?'Awesome!':lang==='pt'?'Que demais!':'¡Genial!'}</button><button type="button" className="p-btn" onClick={()=>void share()} disabled={preparing}><Share2 className="p-i" aria-hidden="true"/>{lang==='en'?'Share':lang==='pt'?'Compartilhar':'Compartir el logro'}</button></div>
    </div>
  </div>;
}

