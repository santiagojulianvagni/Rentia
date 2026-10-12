'use client';

import { useEffect, useRef, useState } from 'react';
import { Copy, Download, Share2, X } from 'lucide-react';

// Tarjeta para compartir logros o estadísticas. Se dibuja en el navegador: ningún dato sale
// de la computadora salvo que la persona la descargue o la comparta. Por defecto no muestra
// montos (solo crecimiento y porcentajes) y no incluye el nombre de la tienda.

export type ShareStat={label:string;value:string;privateValue:string};
export type ShareContent={eyebrow:string;title:string;value?:string;privateValue?:string;period:string;stats?:ShareStat[]};

const W=1080,H=1350;

function wrap(context:CanvasRenderingContext2D,text:string,maxWidth:number) {
  const words=text.split(' '),lines:string[]=[];let line='';
  for(const word of words){const next=line?`${line} ${word}`:word;if(context.measureText(next).width>maxWidth&&line){lines.push(line);line=word;}else line=next;}
  if(line)lines.push(line);
  return lines;
}

async function loadLogo() {
  const image=new Image();image.src='/favicon.svg';
  await new Promise(resolve=>{image.onload=resolve;image.onerror=resolve;});
  return image;
}

async function draw(canvas:HTMLCanvasElement,content:ShareContent,showAmounts:boolean,storeName:string|null) {
  const context=canvas.getContext('2d');if(!context)return;
  const font=getComputedStyle(document.body).fontFamily||'system-ui, sans-serif';
  canvas.width=W;canvas.height=H;
  const background=context.createLinearGradient(0,0,W,H);background.addColorStop(0,'#081525');background.addColorStop(1,'#0c2230');
  context.fillStyle=background;context.fillRect(0,0,W,H);
  const glow=context.createRadialGradient(W*0.85,H*0.15,20,W*0.85,H*0.15,700);glow.addColorStop(0,'rgba(33,212,194,.22)');glow.addColorStop(1,'rgba(33,212,194,0)');
  context.fillStyle=glow;context.fillRect(0,0,W,H);
  const logo=await loadLogo();
  if(logo.width)context.drawImage(logo,80,80,64,64);
  context.fillStyle='#f2f7fb';context.font=`700 44px ${font}`;context.textBaseline='middle';context.fillText('Rentia',160,113);
  context.textBaseline='alphabetic';
  context.fillStyle='#21d4c2';context.font=`700 28px ${font}`;context.fillText(content.eyebrow.toUpperCase(),80,290);
  context.fillStyle='#f2f7fb';context.font=`700 76px ${font}`;
  let y=380;for(const line of wrap(context,content.title,W-160).slice(0,3)){context.fillText(line,80,y);y+=88;}
  const value=showAmounts?content.value:content.privateValue;
  if(value){
    context.font=`700 ${value.length>12?120:150}px ${font}`;
    const gradient=context.createLinearGradient(80,0,W-80,0);gradient.addColorStop(0,'#21d4c2');gradient.addColorStop(1,'#32d583');
    context.fillStyle=gradient;context.fillText(value,80,y+150);y+=230;
  }
  if(content.stats?.length){
    y+=40;const columns=2,cellW=(W-160-30)/columns,cellH=230;
    content.stats.slice(0,4).forEach((stat,index)=>{
      const x=80+(index%columns)*(cellW+30),top=y+Math.floor(index/columns)*(cellH+24);
      context.fillStyle='rgba(255,255,255,.05)';context.strokeStyle='rgba(255,255,255,.12)';context.lineWidth=2;
      context.beginPath();context.roundRect(x,top,cellW,cellH,24);context.fill();context.stroke();
      context.fillStyle='#9bb0c1';context.font=`600 32px ${font}`;context.fillText(stat.label,x+34,top+70);
      context.fillStyle='#f2f7fb';context.font=`700 ${(showAmounts?stat.value:stat.privateValue).length>11?54:76}px ${font}`;context.fillText(showAmounts?stat.value:stat.privateValue,x+34,top+170);
    });
  }
  context.fillStyle='#9bb0c1';context.font=`500 30px ${font}`;
  context.fillText(storeName?`${storeName} · ${content.period}`:content.period,80,H-150);
  context.fillStyle='#6b8398';context.font=`500 26px ${font}`;context.fillText('Ganancia real medida con Rentia',80,H-100);
}

export default function ShareDialog({content,storeName,onClose}:{content:ShareContent;storeName:string;onClose:()=>void}) {
  const canvas=useRef<HTMLCanvasElement>(null);
  const [showAmounts,setShowAmounts]=useState(false);
  const [showStore,setShowStore]=useState(false);
  const [message,setMessage]=useState('');
  useEffect(()=>{if(canvas.current)void draw(canvas.current,content,showAmounts,showStore?storeName:null);},[content,showAmounts,showStore,storeName]);
  useEffect(()=>{const close=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};window.addEventListener('keydown',close);return ()=>window.removeEventListener('keydown',close);},[onClose]);

  const text=()=>{
    const value=showAmounts?content.value:content.privateValue;
    const stats=(content.stats||[]).map(stat=>`${stat.label}: ${showAmounts?stat.value:stat.privateValue}`).join(' · ');
    return [`${content.title}${value?`: ${value}`:''}`,stats,`${content.period}. Medido con Rentia.`].filter(Boolean).join('\n');
  };
  const blob=()=>new Promise<Blob|null>(resolve=>canvas.current?canvas.current.toBlob(resolve,'image/png'):resolve(null));
  async function download() {
    const file=await blob();if(!file)return;
    const url=URL.createObjectURL(file),link=document.createElement('a');
    link.href=url;link.download='rentia-logro.png';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    setMessage('Imagen descargada.');
  }
  async function share() {
    const file=await blob();if(!file)return;
    const files=[new File([file],'rentia-logro.png',{type:'image/png'})];
    try {
      if(navigator.canShare?.({files}))await navigator.share({files,text:text()});
      else {await download();setMessage('Tu navegador no comparte imágenes directo: la descargamos para que la subas.');}
    } catch {/* La persona cerró el menú de compartir. */}
  }
  async function copy() {
    try {await navigator.clipboard.writeText(text());setMessage('Texto copiado.');}
    catch {setMessage('No pudimos copiar el texto.');}
  }

  return <><button type="button" className="p-scrim p-open" onClick={onClose} aria-label="Cerrar"/>
    <div className="p-modal p-wide p-open p-shareModal" role="dialog" aria-modal="true" aria-labelledby="share-title">
      <div className="p-drawerHead"><div><span className="p-eyebrowS">COMPARTIR</span><h3 id="share-title">{content.title}</h3><span className="p-sub">Elegí qué mostrar. La imagen se genera en tu navegador.</span></div><button type="button" className="p-iconBtn" onClick={onClose} aria-label="Cerrar"><X className="p-i" aria-hidden="true"/></button></div>
      <div className="p-drawerBody p-shareBody">
        <canvas ref={canvas} className="p-shareCanvas" aria-label="Vista previa de la imagen para compartir"/>
        <div className="p-shareSide">
          <label className="p-check"><input type="checkbox" checked={showAmounts} onChange={event=>setShowAmounts(event.target.checked)}/><span><b>Mostrar montos</b><br/>Si lo dejás apagado, solo se ven porcentajes y crecimiento.</span></label>
          <label className="p-check"><input type="checkbox" checked={showStore} onChange={event=>setShowStore(event.target.checked)}/><span><b>Mostrar el nombre de la tienda</b><br/>{storeName}</span></label>
          <div className="p-shareActions">
            <button type="button" className="p-btn p-primary" onClick={()=>void share()}><Share2 className="p-i" aria-hidden="true"/>Compartir</button>
            <button type="button" className="p-btn" onClick={()=>void download()}><Download className="p-i" aria-hidden="true"/>Descargar imagen</button>
            <button type="button" className="p-btn" onClick={()=>void copy()}><Copy className="p-i" aria-hidden="true"/>Copiar texto</button>
          </div>
          {message&&<p className="p-sub" role="status">{message}</p>}
        </div>
      </div>
    </div></>;
}
