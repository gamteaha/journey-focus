import {buildRoute,buildLoopRoute} from './route.mjs';

export const MIN_DURATION=60,MAX_DURATION=7200;
export const DURATION_PRESETS=Object.freeze([60,300,1500,3000,3600,5400,7200]);
// Current line2-loop.json rail length between Seongsu and Konkuk, over five minutes.
// This is a focus experience speed, not an operating train's timetable.
export const REFERENCE_SPEED=1246.6715839251906/300;
export const loopLapSeconds=route=>(route?.distance||0)/REFERENCE_SPEED;
export const validDuration=value=>value===null||(Number.isInteger(value)&&value>=MIN_DURATION&&value<=MAX_DURATION&&value%60===0);
export function journeyMetrics(route,snapshot){
 if(snapshot.unlimited){const lapSeconds=loopLapSeconds(route),turns=lapSeconds>0?snapshot.elapsed/lapSeconds:0;return {progress:turns%1,laps:Math.floor(turns),distance:turns*(route?.distance||0)};}
 return {progress:snapshot.progress,laps:0,distance:snapshot.progress*(route?.distance||0)};
}
export function durationFromParts(hours,minutes){
 if(!Number.isInteger(hours)||!Number.isInteger(minutes)||hours<0||hours>2||minutes<0||minutes>59)return null;
 const seconds=hours*3600+minutes*60;return validDuration(seconds)?seconds:null;
}
export function recommendJourney(stations,from,duration,shape){
 if(!validDuration(duration)||!Array.isArray(stations)||!shape)return null;
 const index=stations.findIndex(s=>s.name===from);if(index<0)return null;
 if(duration===null){try{const route=buildLoopRoute(stations,from,shape);return {from,to:from,duration:null,unlimited:true,distance:route.distance,speed:REFERENCE_SPEED,lapSeconds:loopLapSeconds(route),stops:route.stops.map(s=>s.name),stopCount:route.stops.length-1};}catch{return null;}}
 // Compare both directions; prefer the forward direction only when tied.
 const candidates=[...stations.slice(index+1),...stations.slice(0,index).reverse()];
 let best=null;
 for(const destination of candidates)for(const direction of shape.loop?[1,-1]:[undefined]){
  let route;try{route=buildRoute(stations,from,destination.name,shape,{direction});}catch{continue;}
  if(route.geometry!=='osm-rail')continue;
  const speed=route.distance/duration,score=Math.abs(Math.log(speed/REFERENCE_SPEED));
  if(!best||score<best.score){const stops=route.stops?.map(s=>s.name)||route.stations.map(s=>s.name);best={from,to:destination.name,duration,distance:route.distance,speed,score,direction:route.direction,stops,stopCount:stops.length-1,shortPreview:duration<300,paceDifference:Math.abs(speed/REFERENCE_SPEED-1)};}
 }
 return best;
}
