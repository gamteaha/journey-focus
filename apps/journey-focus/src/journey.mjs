import {buildRoute} from './route.mjs';

export const MIN_DURATION=60,MAX_DURATION=7200;
export const DURATION_PRESETS=Object.freeze([60,300,1500,3000,3600,5400,7200]);
// Keep the original 25-minute Seongsu–Konkuk scenery pace as the reference.
// This is a focus experience speed, not an operating train's timetable.
export const REFERENCE_SPEED=1191.981695320105/1500;
export const validDuration=value=>Number.isInteger(value)&&value>=MIN_DURATION&&value<=MAX_DURATION&&value%60===0;
export function durationFromParts(hours,minutes){
 if(!Number.isInteger(hours)||!Number.isInteger(minutes)||hours<0||hours>2||minutes<0||minutes>59)return null;
 const seconds=hours*3600+minutes*60;return validDuration(seconds)?seconds:null;
}
export function recommendJourney(stations,from,duration,shape){
 if(!validDuration(duration)||!Array.isArray(stations)||!shape)return null;
 const index=stations.findIndex(s=>s.name===from);if(index<0)return null;
 // Compare both directions; prefer the forward direction only when tied.
 const candidates=[...stations.slice(index+1),...stations.slice(0,index).reverse()];
 let best=null;
 for(const destination of candidates){
  let route;try{route=buildRoute(stations,from,destination.name,shape);}catch{continue;}
  if(route.geometry!=='osm-rail')continue;
  const speed=route.distance/duration,score=Math.abs(Math.log(speed/REFERENCE_SPEED));
  if(!best||score<best.score){const stops=route.stops?.map(s=>s.name)||route.stations.map(s=>s.name);best={from,to:destination.name,duration,distance:route.distance,speed,score,stops,stopCount:stops.length-1,shortPreview:duration<600,paceDifference:Math.abs(speed/REFERENCE_SPEED-1)};}
 }
 return best;
}
