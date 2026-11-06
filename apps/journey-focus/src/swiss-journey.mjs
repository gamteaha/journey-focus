import {createBoardingPass} from './boarding.mjs';
import {validDuration} from './journey.mjs';

export const SWISS_STOPS=Object.freeze(['호수 북쪽','호수 남쪽']);
export const SWISS_LEG_SECONDS=300;
export const SWISS_PASS_KEY='journey-focus-swiss-pass-v1';
export function makeSwissPass(input,options={}){
 const pass=createBoardingPass(input,{...options,stops:SWISS_STOPS,circular:false});
 return {...pass,destination:'swiss',route:'lago-bianco',version:1};
}
export function validSwissPass(pass){
 return pass?.version===1&&pass.destination==='swiss'&&pass.route==='lago-bianco'&&SWISS_STOPS.includes(pass.from)&&SWISS_STOPS.includes(pass.to)&&pass.from!==pass.to&&validDuration(pass.duration)&&['blue','mint','amber'].includes(pass.character)&&['ticket','card'].includes(pass.medium)&&typeof pass.id==='string';
}
// The train reverses along the same segment without rotating the cabin.
// Geography and the right-hand window therefore remain on the same side.
export function swissPosition(elapsed,total,start=SWISS_STOPS[0]){
 const seconds=Math.max(0,elapsed),leg=Math.floor(seconds/SWISS_LEG_SECONDS),fraction=seconds/SWISS_LEG_SECONDS-leg;
 const reversed=start===SWISS_STOPS[1],forward=(leg%2===0)!==reversed;
 return {meters:total*(forward?fraction:1-fraction),forward,leg,completedLegs:leg};
}
export function swissElapsedAt(meters,total,elapsed,start){
 if(total<=0)return elapsed;
 const {leg,forward}=swissPosition(elapsed,total,start);
 return leg*SWISS_LEG_SECONDS+(forward?meters/total:1-meters/total)*SWISS_LEG_SECONDS;
}
export function advanceSwissTrip({elapsed,travelSeconds,duration,total,from},dt){
 const step=Math.max(0,Math.min(dt,duration===null?Infinity:duration-elapsed));
 const nextElapsed=elapsed+step,nextTravel=travelSeconds+step;
 return {elapsed:nextElapsed,travelSeconds:nextTravel,...swissPosition(nextTravel,total,from),complete:duration!==null&&nextElapsed>=duration};
}
