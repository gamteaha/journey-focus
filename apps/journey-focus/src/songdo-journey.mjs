import {createBoardingPass} from './boarding.mjs';
import {validDuration} from './journey.mjs';

// Fictional stops in an illustrated world, not Incheon Metro stations or a timetable.
export const SONGDO_STOPS=Object.freeze(['인천숲 입구','벚꽃 산책길','수변 카페','초록 정원','바람 다리','노을 물길','달빛 쉼터']);
export const SONGDO_PASS_KEY='journey-focus-songdo-pass-v1';
// Preserve tickets issued before the display name changed from Songdo to Incheon.
export function migrateSongdoPass(pass){
 if(!pass||pass.destination!=='songdo'||pass.version!==1)return pass;
 const name=value=>value==='송도숲 입구'?SONGDO_STOPS[0]:value;
 return {...pass,from:name(pass.from),to:name(pass.to)};
}
export function makeSongdoPass(input,options={}){
 if(input.from===input.to)throw Error('서로 다른 가상 정거장을 선택해 주세요.');
 return {...createBoardingPass(input,{...options,stops:SONGDO_STOPS,circular:false}),destination:'songdo',version:1};
}
export function validSongdoPass(p){
 return p?.destination==='songdo'&&p.version===1&&SONGDO_STOPS.includes(p.from)&&SONGDO_STOPS.includes(p.to)&&p.from!==p.to&&validDuration(p.duration)&&['blue','mint','amber'].includes(p.character)&&['ticket','card'].includes(p.medium)&&typeof p.id==='string'&&/^JF-[A-Za-z0-9-]{1,40}$/.test(p.id);
}
export function recommendSongdo(from,duration){
 const index=SONGDO_STOPS.indexOf(from),direction=index===6?-1:1;
 const to=SONGDO_STOPS[Math.max(0,Math.min(6,index+direction*(duration===null?6:Math.max(1,Math.round(duration/300)))))];
 const end=SONGDO_STOPS.indexOf(to),stops=SONGDO_STOPS.slice(Math.min(index,end),Math.max(index,end)+1);
 if(direction<0)stops.reverse();
 return {from,to,stops,stopCount:Math.abs(end-index)};
}
