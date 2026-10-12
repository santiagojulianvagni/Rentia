'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Download, Share2, X } from 'lucide-react';

// Tarjeta para compartir logros o estadísticas. Se dibuja en el navegador: ningún dato sale
// de la computadora salvo que la persona la descargue o la comparta. Por defecto no muestra
// montos (solo crecimiento y porcentajes) ni el nombre de la tienda.

export type ShareStat={label:string;value:string;privateValue:string};
export type ShareContent={eyebrow:string;title:string;value?:string;privateValue?:string;period:string;stats?:ShareStat[];series?:number[];image?:string|null};
type Format='post'|'story';
type Options={format:Format;showAmounts:boolean;storeName:string|null;qr:boolean};

const W=1080;
const SIZES:Record<Format,number>={post:1350,story:1920};

function wrap(context:CanvasRenderingContext2D,text:string,maxWidth:number) {
  const words=text.split(' '),lines:string[]=[];let line='';
  for(const word of words){const next=line?`${line} ${word}`:word;if(context.measureText(next).width>maxWidth&&line){lines.push(line);line=word;}else line=next;}
  if(line)lines.push(line);
  return lines;
}

function loadImage(src:string) {
  return new Promise<HTMLImageElement|null>(resolve=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>resolve(null);image.src=src;});
}

const imageCache=new Map<string,Promise<HTMLImageElement|null>>();
const cachedImage=(src:string)=>{if(!imageCache.has(src))imageCache.set(src,loadImage(src));return imageCache.get(src)!;};

function drawCurve(context:CanvasRenderingContext2D,values:number[],x:number,y:number,width:number,height:number) {
  const max=Math.max(...values),min=Math.min(0,...values),span=max-min||1;
  const points=values.map((value,index)=>[x+(values.length===1?width/2:index*width/(values.length-1)),y+height-((value-min)/span)*height] as const);
  const path=new Path2D();
  points.forEach(([px,py],index)=>{if(!index){path.moveTo(px,py);return;}const [qx,qy]=points[index-1],mid=(qx+px)/2;path.bezierCurveTo(mid,qy,mid,py,px,py);});
  const area=new Path2D(path);area.lineTo(points[points.length-1][0],y+height);area.lineTo(points[0][0],y+height);area.closePath();
  const fill=context.createLinearGradient(0,y,0,y+height);fill.addColorStop(0,'rgba(33,212,194,.35)');fill.addColorStop(1,'rgba(33,212,194,0)');
  context.fillStyle=fill;context.fill(area);
  const stroke=context.createLinearGradient(x,0,x+width,0);stroke.addColorStop(0,'#21d4c2');stroke.addColorStop(1,'#32d583');
  context.strokeStyle=stroke;context.lineWidth=7;context.lineCap='round';context.lineJoin='round';context.stroke(path);
  const [lx,ly]=points[points.length-1];context.fillStyle='#32d583';context.beginPath();context.arc(lx,ly,12,0,Math.PI*2);context.fill();
}

async function draw(canvas:HTMLCanvasElement,content:ShareContent,options:Options) {
  const context=canvas.getContext('2d');if(!context)return;
  const H=SIZES[options.format],font=getComputedStyle(document.body).fontFamily||'system-ui, sans-serif';
  const [logo,photo,qr]=await Promise.all([cachedImage('/favicon.svg'),content.image?cachedImage(content.image):Promise.resolve(null),options.qr?QRCode.toDataURL(`${window.location.origin}/registro?ref=compartir`,{margin:1,width:220,color:{dark:'#07111f',light:'#ffffff'}}).then(cachedImage).catch(()=>null):Promise.resolve(null)]);
  canvas.width=W;canvas.height=H;
  const background=context.createLinearGradient(0,0,W,H);background.addColorStop(0,'#081525');background.addColorStop(1,'#0c2230');
  context.fillStyle=background;context.fillRect(0,0,W,H);
  const glow=context.createRadialGradient(W*0.85,H*0.12,20,W*0.85,H*0.12,760);glow.addColorStop(0,'rgba(33,212,194,.22)');glow.addColorStop(1,'rgba(33,212,194,0)');
  context.fillStyle=glow;context.fillRect(0,0,W,H);

  // Encabezado
  if(logo)context.drawImage(logo,80,80,64,64);
  context.fillStyle='#f2f7fb';context.font=`700 44px ${font}`;context.textBaseline='middle';context.fillText('Rentia',160,113);
  context.textBaseline='alphabetic';

  // Contenido: se mide primero y después se centra en el espacio disponible.
  const value=options.showAmounts?content.value:content.privateValue;
  const top=220,bottom=H-(qr?330:220),inner=W-160,gap=options.format==='story'?56:36;
  context.font=`700 76px ${font}`;
  const titleLines=wrap(context,content.title,inner).slice(0,3);
  const stats=(content.stats||[]).slice(0,4),statRows=Math.ceil(stats.length/2),cellH=options.format==='story'?250:220;
  const curveH=content.series&&content.series.length>1?(options.format==='story'?300:200):0;
  // Cada bloque va separado del anterior por "gap"; la foto ocupa el espacio que sobra.
  const fixed=50+titleLines.length*88+(value?190:0)+(statRows?statRows*(cellH+24)-24:0)+curveH;
  const gaps=gap*[titleLines.length>0,Boolean(value),statRows>0,curveH>0].filter(Boolean).length;
  const fitted=photo?Math.min(options.format==='story'?640:440,bottom-top-fixed-gaps-gap):0;
  const photoSize=fitted>=200?fitted:0;
  const total=fixed+gaps+(photoSize?photoSize+gap:0);
  let y=top+Math.max(0,(bottom-top-total)/2);

  context.fillStyle='#21d4c2';context.font=`700 30px ${font}`;context.fillText(content.eyebrow.toUpperCase(),80,y+30);y+=50;
  if(photo&&photoSize){
    y+=gap;
    const side=Math.min(photo.width,photo.height),sx=(photo.width-side)/2,sy=(photo.height-side)/2,x=(W-photoSize)/2;
    context.save();context.beginPath();context.roundRect(x,y,photoSize,photoSize,40);context.clip();context.fillStyle='#ffffff';context.fillRect(x,y,photoSize,photoSize);context.drawImage(photo,sx,sy,side,side,x,y,photoSize,photoSize);context.restore();
    context.strokeStyle='rgba(255,255,255,.18)';context.lineWidth=3;context.beginPath();context.roundRect(x,y,photoSize,photoSize,40);context.stroke();
    y+=photoSize;
  }
  context.fillStyle='#f2f7fb';context.font=`700 76px ${font}`;
  if(titleLines.length)y+=gap;
  for(const line of titleLines){y+=76;context.fillText(line,80,y);y+=12;}
  if(value){
    y+=gap;context.font=`700 ${value.length>12?120:150}px ${font}`;
    const gradient=context.createLinearGradient(80,0,W-80,0);gradient.addColorStop(0,'#21d4c2');gradient.addColorStop(1,'#32d583');
    context.fillStyle=gradient;context.fillText(value,80,y+150);y+=190;
  }
  if(statRows){
    y+=gap;const cellW=(inner-30)/2;
    stats.forEach((stat,index)=>{
      const x=80+(index%2)*(cellW+30),cellTop=y+Math.floor(index/2)*(cellH+24);
      const shown=options.showAmounts?stat.value:stat.privateValue;
      context.fillStyle='rgba(255,255,255,.05)';context.strokeStyle='rgba(255,255,255,.12)';context.lineWidth=2;
      context.beginPath();context.roundRect(x,cellTop,cellW,cellH,26);context.fill();context.stroke();
      context.fillStyle='#9bb0c1';context.font=`600 32px ${font}`;context.fillText(stat.label,x+34,cellTop+72);
      context.fillStyle='#f2f7fb';context.font=`700 ${shown.length>11?54:76}px ${font}`;context.fillText(shown,x+34,cellTop+cellH-56);
    });
    y+=statRows*(cellH+24)-24;
  }
  if(curveH&&content.series){y+=gap;drawCurve(context,content.series,80,y,inner,curveH);y+=curveH;}

  // Pie: período, tienda y QR a la prueba gratis.
  const footerY=H-(qr?110:100);
  context.fillStyle='#9bb0c1';context.font=`500 30px ${font}`;
  context.fillText(options.storeName?`${options.storeName} · ${content.period}`:content.period,80,footerY-50,qr?W-420:inner);
  context.fillStyle='#6b8398';context.font=`500 26px ${font}`;context.fillText('Ganancia real medida con Rentia',80,footerY);
  if(qr){
    const size=220,x=W-80-size,qy=H-80-size;
    context.fillStyle='#ffffff';context.beginPath();context.roundRect(x-14,qy-14,size+28,size+28,24);context.fill();
    context.drawImage(qr,x,qy,size,size);
    context.fillStyle='#21d4c2';context.font=`600 24px ${font}`;context.fillText('Probalo gratis',80,footerY+40);
  }
}

export default function ShareDialog({content,storeName,onClose}:{content:ShareContent;storeName:string;onClose:()=>void}) {
  const canvas=useRef<HTMLCanvasElement>(null);
  const [format,setFormat]=useState<Format>('story');
  const [showAmounts,setShowAmounts]=useState(false);
  const [showStore,setShowStore]=useState(false);
  const [qr,setQr]=useState(true);
  const [message,setMessage]=useState('');
  useEffect(()=>{if(canvas.current)void draw(canvas.current,content,{format,showAmounts,storeName:showStore?storeName:null,qr});},[content,format,showAmounts,showStore,storeName,qr]);
  useEffect(()=>{const close=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};window.addEventListener('keydown',close);return ()=>window.removeEventListener('keydown',close);},[onClose]);

  const text=()=>{
    const value=showAmounts?content.value:content.privateValue;
    const stats=(content.stats||[]).map(stat=>`${stat.label}: ${showAmounts?stat.value:stat.privateValue}`).join(' · ');
    return [`${content.title}${value?`: ${value}`:''}`,stats,`${content.period}. Medido con Rentia.`].filter(Boolean).join('\n');
  };
  const fileName=`rentia-${format==='story'?'historia':'publicacion'}.png`;
  const blob=()=>new Promise<Blob|null>(resolve=>canvas.current?canvas.current.toBlob(resolve,'image/png'):resolve(null));
  async function download() {
    const file=await blob();if(!file)return;
    const url=URL.createObjectURL(file),link=document.createElement('a');
    link.href=url;link.download=fileName;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    setMessage('Imagen descargada.');
  }
  async function share() {
    const file=await blob();if(!file)return;
    const files=[new File([file],fileName,{type:'image/png'})];
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
        <canvas ref={canvas} className={`p-shareCanvas p-${format}`} aria-label="Vista previa de la imagen para compartir"/>
        <div className="p-shareSide">
          <div className="p-tabs p-shareFormat" role="tablist" aria-label="Formato">
            <button type="button" role="tab" aria-selected={format==='story'} className={format==='story'?'p-on':''} onClick={()=>setFormat('story')}>Historia</button>
            <button type="button" role="tab" aria-selected={format==='post'} className={format==='post'?'p-on':''} onClick={()=>setFormat('post')}>Publicación</button>
          </div>
          <label className="p-check"><input type="checkbox" checked={showAmounts} onChange={event=>setShowAmounts(event.target.checked)}/><span><b>Mostrar montos</b><br/>Si lo dejás apagado, solo se ven porcentajes y crecimiento.</span></label>
          <label className="p-check"><input type="checkbox" checked={showStore} onChange={event=>setShowStore(event.target.checked)}/><span><b>Mostrar el nombre de la tienda</b><br/>{storeName}</span></label>
          <label className="p-check"><input type="checkbox" checked={qr} onChange={event=>setQr(event.target.checked)}/><span><b>Incluir código QR</b><br/>Lleva a la prueba gratis de Rentia.</span></label>
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
