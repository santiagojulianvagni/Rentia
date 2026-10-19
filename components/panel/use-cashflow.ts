'use client';

import { useEffect, useState } from 'react';
import { cashflow, percentageCostRate, type CashflowRule } from '../../lib/cashflow';
import type { Receivables } from '../../lib/receivables';

// Datos del cashflow: el mes en curso, los últimos 14 días completos y la plata por cobrar.
// Los usan la sección Cashflow y la alerta de la campana, así nunca muestran números distintos.

export type MonthDashboard={metrics:{revenue:number;productCost:number;shipping:number;commissions:number;taxes:number;refundLoss?:number;totalAdSpend?:number;adSpend:number;orders:number;metaReportedRevenue?:number;adSpendComparable?:boolean;meliAdsComparable?:boolean};meliAds?:{summary?:{attributedRevenue?:number}};timeline:Array<{date:string;storeRevenue:number}>;quality:{completeOrders:number;totalOrders:number}};
export type CashflowData={today:string;month:string;current:MonthDashboard;recent:MonthDashboard|null;receivables:Receivables|null};

const DAY=24*60*60*1000;
const iso=(value:number)=>new Date(value).toISOString().slice(0,10);
export const todayAr=()=>{const local=new Date(Date.now()-3*60*60*1000);return iso(Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate()));};

async function getJson<T>(url:string):Promise<T|null> {
  const response=await fetch(url,{cache:'no-store'});
  return response.ok?await response.json() as T:null;
}

export function useCashflowData(refreshKey:unknown) {
  const [state,setState]=useState<{data:CashflowData|null;error:boolean}>({data:null,error:false});
  useEffect(()=>{
    if(!refreshKey)return;
    let cancelled=false;
    const today=todayAr(),month=today.slice(0,7),base=Date.parse(`${today}T00:00:00Z`);
    Promise.all([getJson<MonthDashboard>(`/api/dashboard?start=${month}-01&end=${today}`),getJson<MonthDashboard>(`/api/dashboard?start=${iso(base-14*DAY)}&end=${iso(base-DAY)}`),getJson<Receivables>('/api/cashflow/receivables')])
      .then(([current,recent,receivables])=>{if(cancelled)return;setState(current?{data:{today,month,current,recent,receivables},error:false}:{data:null,error:true});})
      .catch(()=>{if(!cancelled)setState({data:null,error:true});});
    return ()=>{cancelled=true;};
  },[refreshKey]);
  return state;
}

// Todo lo que se calcula a partir de los datos: proyección, serie diaria, ritmos y la base del simulador.
export function cashflowView(data:CashflowData,rules:CashflowRule[]) {
  const {today,month,current}=data,m=current.metrics,base=Date.parse(`${today}T00:00:00Z`);
  const recentByDate=new Map((data.recent?.timeline||[]).map(point=>[point.date.slice(0,10),point.storeRevenue]));
  const recentDaily=Array.from({length:14},(_,index)=>recentByDate.get(iso(base-(14-index)*DAY))||0);
  const result=cashflow({month,today,metrics:m,rules,recentDaily});
  const byDate=new Map(current.timeline.map(point=>[point.date.slice(0,10),point.storeRevenue]));
  const daily=Array.from({length:result.totalDays},(_,index)=>byDate.get(`${month}-${String(index+1).padStart(2,'0')}`)||0);
  const ads=m.totalAdSpend??m.adSpend??0;
  const recentAds=data.recent?(data.recent.metrics.totalAdSpend??data.recent.metrics.adSpend??0)/14:ads/result.elapsed;
  const marginBeforeAds=result.margin!==null&&m.revenue>0?result.margin+ads/m.revenue:null;
  const attributed=(m.adSpendComparable?m.metaReportedRevenue||0:0)+(m.meliAdsComparable?current.meliAds?.summary?.attributedRevenue||0:0);
  const scale=m.revenue>0?result.projectedRevenue/m.revenue:0;
  const simulation=m.revenue>0?{revenue:result.projectedRevenue,productCost:m.productCost*scale,shipping:m.shipping*scale,commissions:m.commissions*scale,taxes:m.taxes*scale,refundLoss:(m.refundLoss||0)*scale,ads:ads*scale,fixed:result.fixed,percentageRate:percentageCostRate(rules),roas:ads>0?attributed/ads:0,orders:m.orders*scale}:null;
  return {result,daily,recentAds,marginBeforeAds,simulation,revenue:m.revenue,incomplete:current.quality.totalOrders>current.quality.completeOrders};
}
