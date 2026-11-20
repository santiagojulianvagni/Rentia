'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Download, Share2, X } from 'lucide-react';

// Tarjeta para compartir logros o estadísticas. Se dibuja en el navegador: ningún dato sale
// de la computadora salvo que la persona la descargue o la comparta. Por defecto no muestra
// montos (solo crecimiento y porcentajes) ni el nombre de la tienda.

export type ShareStat={label:string;value:string;privateValue:string};
export type ShareContent={eyebrow:string;title:string;value?:string;privateValue?:string;period:string;stats?:ShareStat[];series?:number[];image?:string|null;
  // Logros y récords: diseño con el cangurito festejando, un subtítulo y el producto estrella.
  achievement?:{tag:string;subtitle:string;privateSubtitle:string;product:{name:string;image:string|null;detail:string;privateDetail:string}|null}};
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

// Tamaño de letra más grande (entre max y min) con el que el texto entra en el ancho.
function fitFont(context:CanvasRenderingContext2D,text:string,weight:number,max:number,min:number,width:number,font:string) {
  let size=max;
  for(;size>min;size-=4){context.font=`${weight} ${size}px ${font}`;if(context.measureText(text).width<=width)break;}
  context.font=`${weight} ${size}px ${font}`;
  return size;
}

const CONFETTI=['#21D4C2','#3B8CF6','#7FE6DB','#ffffff','#f5c451'];

// Logro: cangurito festejando con confeti, etiqueta, título, número grande y hasta dos datos.
function drawAchievement(context:CanvasRenderingContext2D,content:ShareContent,options:Options,{H,font,mascot,photo,hasQr}:{H:number;font:string;mascot:HTMLImageElement|null;photo:HTMLImageElement|null;hasQr:boolean}) {
  const a=content.achievement!,story=options.format==='story',inner=W-160,cx=W/2;
  const top=190,bottom=H-(hasQr?340:230),gap=story?40:24;
  const value=(options.showAmounts?content.value:content.privateValue)||'';
  const subtitle=options.showAmounts?a.subtitle:a.privateSubtitle;
  const stats=(content.stats||[]).filter(stat=>{const shown=options.showAmounts?stat.value:stat.privateValue;return Boolean(shown)&&shown!=='—';}).slice(0,2);
  const product=a.product;
  const titleSize=story?80:62,titleLine=story?92:72,subSize=story?38:32,subLine=story?50:42;
  context.font=`700 ${titleSize}px ${font}`;
  const titleLines=wrap(context,content.title,inner).slice(0,2);
  const valueSize=value?fitFont(context,value,800,story?170:124,60,inner,font):0;
  context.font=`500 ${subSize}px ${font}`;
  const subLines=subtitle?wrap(context,subtitle,inner).slice(0,2):[];
  const pillH=story?72:64,cellH=story?170:150,productH=story?232:204;
  let showStats=stats.length>0,showProduct=Boolean(product);
  const statH=()=>showProduct?Math.round(cellH*.75):cellH;
  const blocks=(mascotH:number)=>(mascotH?mascotH+gap:0)+pillH+gap+titleLines.length*titleLine+(value?gap*.5+valueSize*1.05:0)+(subLines.length?gap*.4+subLines.length*subLine:0)+(showProduct?gap+productH:0)+(showStats?gap+statH():0);
  // El cangurito ocupa el espacio que queda, entre un mínimo y un máximo. Si ni con el mínimo
  // entra todo, se saca primero el dato extra y después el producto.
  const maxMascot=story?470:320,minMascot=story?220:170,room=bottom-top;
  if(mascot&&blocks(minMascot)>room&&showStats)showStats=false;
  if(mascot&&blocks(minMascot)>room&&showProduct)showProduct=false;
  const mascotH=mascot?Math.max(minMascot,Math.min(maxMascot,room-blocks(0)-gap)):0;
  let y=top+Math.max(0,(bottom-top-blocks(mascotH))/2);

  // Confeti alrededor del cangurito (posiciones fijas para que la imagen sea siempre igual).
  const confettiTop=150,confettiBottom=Math.max(confettiTop+200,y+mascotH+gap+pillH);
  for(let index=0;index<26;index++){
    const px=60+((index*173)%(W-120)),py=confettiTop+((index*97)%(confettiBottom-confettiTop));
    // Sin confeti encima del cangurito ni de la etiqueta.
    if(Math.abs(px-cx)<Math.max(mascotH*.5,200)&&py>y-24&&py<y+mascotH+gap+pillH+24)continue;
    context.save();context.translate(px,py);context.rotate(index*.55);context.fillStyle=CONFETTI[index%CONFETTI.length];context.globalAlpha=.85;
    context.beginPath();context.roundRect(-11,-11,22,22,5);context.fill();context.restore();
  }
  if(mascot&&mascotH){
    const mascotW=mascotH*.8,ringR=mascotH*.42,ringY=y+mascotH*.53;
    const halo=context.createRadialGradient(cx,ringY,10,cx,ringY,ringR);halo.addColorStop(0,'rgba(33,212,194,.20)');halo.addColorStop(1,'rgba(33,212,194,.04)');
    context.fillStyle=halo;context.beginPath();context.arc(cx,ringY,ringR,0,Math.PI*2);context.fill();
    context.strokeStyle='rgba(33,212,194,.28)';context.lineWidth=3;context.stroke();
    context.drawImage(mascot,cx-mascotW/2,y,mascotW,mascotH);
    y+=mascotH+gap;
  }
  // Etiqueta
  context.font=`800 ${story?30:27}px ${font}`;context.letterSpacing='4px';
  const pillW=context.measureText(a.tag).width+70;
  context.fillStyle='rgba(33,212,194,.14)';context.strokeStyle='rgba(33,212,194,.45)';context.lineWidth=2;
  context.beginPath();context.roundRect(cx-pillW/2,y,pillW,pillH,pillH/2);context.fill();context.stroke();
  context.fillStyle='#21d4c2';context.textAlign='center';context.textBaseline='middle';context.fillText(a.tag,cx+2,y+pillH/2+1);
  context.letterSpacing='0px';context.textBaseline='alphabetic';y+=pillH+gap;
  // Título, número grande y subtítulo, centrados.
  context.fillStyle='#f2f7fb';context.font=`700 ${titleSize}px ${font}`;
  for(const line of titleLines){y+=titleLine*.82;context.fillText(line,cx,y);y+=titleLine*.18;}
  if(value){
    y+=gap*.5;context.font=`800 ${valueSize}px ${font}`;
    const gradient=context.createLinearGradient(cx-inner/2,0,cx+inner/2,0);gradient.addColorStop(0,'#21d4c2');gradient.addColorStop(1,'#32d583');
    context.fillStyle=gradient;y+=valueSize*.88;context.fillText(value,cx,y);y+=valueSize*.17;
  }
  if(subLines.length){y+=gap*.4;context.fillStyle='#9bb0c1';context.font=`500 ${subSize}px ${font}`;for(const line of subLines){y+=subLine*.8;context.fillText(line,cx,y);y+=subLine*.2;}}
  context.textAlign='left';
  // Producto estrella del período, con foto.
  if(showProduct&&product){
    y+=gap;const x=80,pad=26,side=productH-pad*2;
    context.fillStyle='rgba(255,255,255,.05)';context.strokeStyle='rgba(255,255,255,.12)';context.lineWidth=2;
    context.beginPath();context.roundRect(x,y,inner,productH,28);context.fill();context.stroke();
    let textX=x+pad;
    if(photo){
      const crop=Math.min(photo.width,photo.height);
      context.save();context.beginPath();context.roundRect(x+pad,y+pad,side,side,20);context.clip();context.fillStyle='#ffffff';context.fillRect(x+pad,y+pad,side,side);
      context.drawImage(photo,(photo.width-crop)/2,(photo.height-crop)/2,crop,crop,x+pad,y+pad,side,side);context.restore();
      textX=x+pad+side+30;
    }
    const textW=x+inner-pad-textX;
    context.fillStyle='#21d4c2';context.font=`800 ${story?24:22}px ${font}`;context.letterSpacing='3px';context.fillText('PRODUCTO ESTRELLA',textX,y+pad+26);context.letterSpacing='0px';
    context.fillStyle="#f2f7fb";context.font=`700 ${story?40:34}px ${font}`;
    const allLines=wrap(context,product.name,textW),nameLines=allLines.slice(0,2);
    if(allLines.length>2)nameLines[1]=`${nameLines[1]}…`;
    nameLines.forEach((line,index)=>context.fillText(line,textX,y+pad+(story?78:70)+index*(story?48:40),textW));
    context.fillStyle='#9bb0c1';context.font=`500 ${story?28:25}px ${font}`;
    context.fillText(options.showAmounts?product.detail:product.privateDetail,textX,y+productH-pad-4,textW);
    y+=productH;
  }
  // Hasta dos datos extra en cajitas.
  if(showStats){
    y+=gap;const h=statH(),cellW=(inner-(stats.length-1)*24)/stats.length;
    stats.forEach((stat,index)=>{
      const x=80+index*(cellW+24),shown=options.showAmounts?stat.value:stat.privateValue;
      context.fillStyle='rgba(255,255,255,.05)';context.strokeStyle='rgba(255,255,255,.12)';context.lineWidth=2;
      context.beginPath();context.roundRect(x,y,cellW,h,26);context.fill();context.stroke();
      if(showProduct){
        context.textBaseline='middle';context.textAlign='left';context.fillStyle='#9bb0c1';context.font=`600 ${story?30:27}px ${font}`;context.fillText(stat.label,x+30,y+h/2,cellW*.55);
        context.textAlign='right';context.fillStyle='#f2f7fb';fitFont(context,shown,700,story?52:46,26,cellW*.38,font);context.fillText(shown,x+cellW-30,y+h/2);
        context.textBaseline='alphabetic';
      }else{
        context.textAlign='center';context.fillStyle='#9bb0c1';context.font=`600 ${story?28:25}px ${font}`;context.fillText(stat.label,x+cellW/2,y+(story?56:50),cellW-40);
        context.fillStyle='#f2f7fb';fitFont(context,shown,700,story?62:54,28,cellW-40,font);context.fillText(shown,x+cellW/2,y+h-(story?44:38));
      }
      context.textAlign='left';
    });
  }
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
  // Se espera a la letra de Rentia: si no, el primer dibujo sale con una letra genérica.
  try{await document.fonts?.ready;}catch{/* sin fuentes cargadas */}
  const H=SIZES[options.format],font=getComputedStyle(document.body).fontFamily||'system-ui, sans-serif';
  const [logo,photo,mascot,qr]=await Promise.all([cachedImage('/favicon.svg'),content.image?cachedImage(content.image):Promise.resolve(null),content.achievement?cachedImage('/mascota/canguro-festeja-oscuro.svg'):Promise.resolve(null),options.qr?QRCode.toDataURL(`${window.location.origin}/registro?ref=compartir`,{margin:1,width:220,color:{dark:'#07111f',light:'#ffffff'}}).then(cachedImage).catch(()=>null):Promise.resolve(null)]);
  canvas.width=W;canvas.height=H;
  const background=context.createLinearGradient(0,0,W,H);background.addColorStop(0,'#081525');background.addColorStop(1,'#0c2230');
  context.fillStyle=background;context.fillRect(0,0,W,H);
  const glow=context.createRadialGradient(W*0.85,H*0.12,20,W*0.85,H*0.12,760);glow.addColorStop(0,'rgba(33,212,194,.22)');glow.addColorStop(1,'rgba(33,212,194,0)');
  context.fillStyle=glow;context.fillRect(0,0,W,H);

  // Encabezado
  if(logo)context.drawImage(logo,80,80,64,64);
  context.fillStyle='#f2f7fb';context.font=`700 44px ${font}`;context.textBaseline='middle';context.fillText('Rentia',160,113);
  context.textBaseline='alphabetic';

  if(content.achievement)drawAchievement(context,content,options,{H,font,mascot,photo,hasQr:Boolean(qr)});
  else {
  // Contenido: se mide primero y después se centra en el espacio disponible.
  const value=options.showAmounts?content.value:content.privateValue;
  const top=220,bottom=H-(qr?330:220),inner=W-160,gap=options.format==='story'?56:36;
  context.font=`700 76px ${font}`;
  const titleLines=wrap(context,content.title,inner).slice(0,3);
  // Sin montos, un dato sin comparación posible ("—") no se muestra.
  const stats=(content.stats||[]).filter(stat=>{const shown=options.showAmounts?stat.value:stat.privateValue;return Boolean(shown)&&shown!=='—';}).slice(0,4),statRows=Math.ceil(stats.length/2),cellH=options.format==='story'?250:220;
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
  }

  // Pie: período, tienda y QR a la prueba gratis.
  const footerY=H-(qr?110:100);
  context.fillStyle='#9bb0c1';context.font=`500 30px ${font}`;
  context.fillText(options.storeName?`${options.storeName} · ${content.period}`:content.period,80,footerY-50,qr?W-420:W-160);
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
    const subtitle=content.achievement?(showAmounts?content.achievement.subtitle:content.achievement.privateSubtitle):'';
    const stats=(content.stats||[]).map(stat=>`${stat.label}: ${showAmounts?stat.value:stat.privateValue}`).join(' · ');
    return [`${content.title}${value?`: ${value}`:''}${subtitle?` ${subtitle}`:''}`,stats,`${content.period}. Medido con Rentia.`].filter(Boolean).join('\n');
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
