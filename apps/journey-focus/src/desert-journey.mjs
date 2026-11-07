import {createBoardingPass} from './boarding.mjs';
import {validDuration} from './journey.mjs';

// Fictional stops in an illustrated world, not real desert rail stations or a timetable.
export const DESERT_STOPS=Object.freeze(['모래바람역','황금사구','야자수 쉼터','오아시스','별빛 유적','붉은 협곡','달의 정거장']);
export const DESERT_PASS_KEY='journey-focus-desert-pass-v1';
export const OASIS_STOPS=Object.freeze(['달빛 정원','은빛 물가','반딧불 숲','초승달 쉼터','별의 호수']);
export const OASIS_PASS_KEY='journey-focus-oasis-pass-v1';
export function makeOasisPass(input,options={}){if(input.from===input.to)throw Error('서로 다른 정거장을 골라 주세요.');return {...createBoardingPass(input,{...options,stops:OASIS_STOPS,circular:false}),destination:'oasis',version:1};}
export function validOasisPass(p){return validDesertPass({...p,destination:'desert',from:DESERT_STOPS[0],to:DESERT_STOPS[1]})&&p?.destination==='oasis'&&OASIS_STOPS.includes(p.from)&&OASIS_STOPS.includes(p.to)&&p.from!==p.to;}
export function recommendOasis(from,duration){const index=OASIS_STOPS.indexOf(from),end=Math.max(0,Math.min(4,index+(index===4?-1:1)*(duration===null?4:Math.max(1,Math.round(duration/300))))),stops=OASIS_STOPS.slice(Math.min(index,end),Math.max(index,end)+1);if(end<index)stops.reverse();return {from,to:OASIS_STOPS[end],stops,stopCount:Math.abs(end-index)};}
export function makeDesertPass(input,options={}){
 if(input.from===input.to)throw Error('서로 다른 가상 정거장을 선택해 주세요.');
 return {...createBoardingPass(input,{...options,stops:DESERT_STOPS,circular:false}),destination:'desert',version:1};
}
export function validDesertPass(p){
 return p?.destination==='desert'&&p.version===1&&DESERT_STOPS.includes(p.from)&&DESERT_STOPS.includes(p.to)&&p.from!==p.to&&validDuration(p.duration)&&['blue','mint','amber'].includes(p.character)&&['ticket','card'].includes(p.medium)&&typeof p.id==='string'&&/^JF-[A-Za-z0-9-]{1,40}$/.test(p.id);
}
export function recommendDesert(from,duration){
 const index=DESERT_STOPS.indexOf(from),direction=index===6?-1:1;
 const to=DESERT_STOPS[Math.max(0,Math.min(6,index+direction*(duration===null?6:Math.max(1,Math.round(duration/300)))))];
 const end=DESERT_STOPS.indexOf(to),stops=DESERT_STOPS.slice(Math.min(index,end),Math.max(index,end)+1);
 if(direction<0)stops.reverse();
 return {from,to,stops,stopCount:Math.abs(end-index)};
}
