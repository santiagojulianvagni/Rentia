'use client';

import { useEffect, useId, useRef, useState } from 'react';

export type RpChartPoint={label:string;detail?:string;[key:string]:number|string|undefined};

type Props={
  data:RpChartPoint[];
  valueKey:string;
  secondKey?:string|null;
  type?:'area'|'line'|'bar';
  color?:string;
  secondColor?:string;
  height?:number;
  format:(value:number)=>string;
  axisFormat?:(value:number)=>string;
  name?:string;
  secondName?:string;
};

// Gráfico del panel: mismo dibujo que la propuesta (área, línea o barras) con tooltip al pasar el mouse.
export default function RpChart({data,valueKey,secondKey=null,type='area',color='#21d4c2',secondColor='#21d4c2',height=280,format,axisFormat,name,secondName}:Props) {
  const box=useRef<HTMLDivElement>(null);
  const [width,setWidth]=useState(0);
  const [hover,setHover]=useState<number|null>(null);
  const id=useId().replace(/:/g,'');
  useEffect(()=>{
    const element=box.current;if(!element)return;
    const observer=new ResizeObserver(entries=>setWidth(Math.round(entries[0].contentRect.width)));
    observer.observe(element);setWidth(element.clientWidth);
    return()=>observer.disconnect();
  },[]);
  const W=Math.max(260,width),H=height,P={l:62,r:8,t:12,b:26};
  const vals=data.map(point=>Number(point[valueKey]||0));
  const sec=secondKey?data.map(point=>Number(point[secondKey]||0)):null;
  const max=Math.max(1,...vals,...(sec||[]))*1.12;
  const x=(index:number)=>P.l+(W-P.l-P.r)*(data.length<=1?.5:index/(data.length-1));
  const y=(value:number)=>H-P.b-(H-P.t-P.b)*Math.max(0,value)/max;
  const path=(values:number[])=>values.map((value,index)=>`${index?'L':'M'}${x(index).toFixed(1)} ${y(value).toFixed(1)}`).join(' ');
  const axis=axisFormat||format;
  const step=Math.max(1,Math.ceil(data.length/Math.max(3,Math.floor(W/90))));
  const slot=(W-P.l-P.r)/Math.max(1,data.length);
  const barWidth=Math.max(3,slot*(sec?.38:.6));
  const move=(event:React.MouseEvent<SVGSVGElement>)=>{
    if(!data.length)return;
    const rect=event.currentTarget.getBoundingClientRect();
    const index=Math.round((event.clientX-rect.left-P.l)/(W-P.l-P.r)*(data.length-1));
    setHover(Math.max(0,Math.min(data.length-1,index)));
  };
  const active=hover===null?null:data[hover];
  return <div className="p-chart" style={{height}} ref={box} onMouseLeave={()=>setHover(null)}>
    {width>0&&<svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} onMouseMove={move} role="img" aria-label={name||'Gráfico'}>
      <defs>
        <linearGradient id={`${id}a`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".32"/><stop offset="1" stopColor={color} stopOpacity="0"/></linearGradient>
        <linearGradient id={`${id}b`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={secondColor} stopOpacity=".3"/><stop offset="1" stopColor={secondColor} stopOpacity="0"/></linearGradient>
      </defs>
      <g className="p-axis">
        {[0,.25,.5,.75,1].map(fraction=><g key={fraction}><line className="p-gridl" x1={P.l} x2={W-P.r} y1={y(max*fraction)} y2={y(max*fraction)}/><text x={P.l-10} y={y(max*fraction)+4} textAnchor="end">{axis(max*fraction)}</text></g>)}
        {data.map((point,index)=>index%step===0?<text key={index} x={x(index)} y={H-6} textAnchor="middle">{point.label}</text>:null)}
      </g>
      {type==='bar'?data.map((point,index)=><g key={index}>
        <rect className="p-barr" x={x(index)-(sec?barWidth:barWidth/2)} y={y(vals[index])} width={barWidth} height={H-P.b-y(vals[index])} rx={3} fill={color} style={{animationDelay:`${index*10}ms`}}/>
        {sec&&<rect className="p-barr" x={x(index)} y={y(sec[index])} width={barWidth} height={H-P.b-y(sec[index])} rx={3} fill={secondColor} style={{animationDelay:`${index*10}ms`}}/>}
      </g>):<>
        {type==='area'&&<path className="p-areaFill" d={`${path(vals)} L${x(vals.length-1)} ${H-P.b} L${x(0)} ${H-P.b}Z`} fill={`url(#${id}a)`}/>}
        <path className="p-line" d={path(vals)} stroke={color}/>
        {sec&&type==='area'&&<path className="p-areaFill" d={`${path(sec)} L${x(sec.length-1)} ${H-P.b} L${x(0)} ${H-P.b}Z`} fill={`url(#${id}b)`}/>}
        {sec&&<path className="p-line" d={path(sec)} stroke={secondColor}/>}
        {data.length<=2&&vals.map((value,index)=><circle key={`a${index}`} r={4} cx={x(index)} cy={y(value)} fill={color}/>)}
        {data.length<=2&&sec&&sec.map((value,index)=><circle key={`b${index}`} r={4} cx={x(index)} cy={y(value)} fill={secondColor}/>)}
      </>}
      {hover!==null&&<><line className="p-hover" x1={x(hover)} x2={x(hover)} y1={P.t} y2={H-P.b} stroke="#36607f" strokeDasharray="3 4"/>{type!=='bar'&&<circle r={5} cx={x(hover)} cy={y(vals[hover])} fill={color} stroke="#07111f" strokeWidth={2}/>}</>}
    </svg>}
    {active&&<div className="p-tip" style={{opacity:1,left:Math.min(W-210,Math.max(0,x(hover||0)-95)),top:0}}><b>{active.detail||active.label}</b>{name?`${name} `:''}{format(vals[hover||0])}{sec&&<><br/><span style={{color:secondColor}}>{secondName||'Ganancia'} {format(sec[hover||0])}</span></>}</div>}
  </div>;
}
