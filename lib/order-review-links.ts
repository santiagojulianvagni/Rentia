import {analyticsRangeFromUrl} from './analytics-range';
import {argentinaDay} from './local-date';

export function orderDetailsHref(order:{provider?:string;externalOrderId:string;date:string},review=false) {
  const params=new URLSearchParams({section:'ordenes',provider:order.provider||'',order:order.externalOrderId});
  const day=argentinaDay(order.date);
  const dated=new URL('https://rentia.example.invalid');
  dated.searchParams.set('start',day);dated.searchParams.set('end',day);
  if(analyticsRangeFromUrl(dated).range){params.set('start',day);params.set('end',day);}
  return `/panel?${params}${review?`#meli-review-${encodeURIComponent(order.externalOrderId)}`:''}`;
}
