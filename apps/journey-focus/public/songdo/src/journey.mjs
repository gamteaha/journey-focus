import {stations} from './route.mjs';
export function validTrip(from,to,minutes){
 return Number.isInteger(from)&&Number.isInteger(to)&&!!stations[from]&&!!stations[to]&&from!==to&&Number.isInteger(minutes)&&minutes>=1&&minutes<=180;
}
export function recommendDestination(from,minutes){
 const direction=from===stations.length-1?-1:1;
 return stations.filter(s=>(s.index-from)*direction>0).reduce((best,s)=>Math.abs(Math.abs(s.elapsedMinutes-stations[from].elapsedMinutes)-minutes)<Math.abs(Math.abs(best.elapsedMinutes-stations[from].elapsedMinutes)-minutes)?s:best).index;
}
export function tripPosition(from,to,progress){
 const start=stations[from],end=stations[to],direction=Math.sign(to-from),p=Math.min(1,Math.max(0,progress));
 const total=Math.abs(end.kilometer-start.kilometer),km=total*p,position=start.kilometer+direction*km;
 const stops=stations.slice(Math.min(from,to),Math.max(from,to)+1);if(direction<0)stops.reverse();
 let current=stops[0],next=stops[1]??stops[0];
 for(let i=0;i<stops.length;i++)if((position-stops[i].kilometer)*direction>=-1e-8){current=stops[i];next=stops[i+1]??current;}
 return {current,next,km,total,progress:p,stops};
}
