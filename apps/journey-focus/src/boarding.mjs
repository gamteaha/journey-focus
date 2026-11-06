import {CITY_ORDER} from './route.mjs';
import {DURATION_PRESETS,validDuration} from './journey.mjs';
export const BOARDING_DURATIONS=DURATION_PRESETS;
export const CHARACTERS=Object.freeze([
 Object.freeze({id:'blue',name:'블루',color:'#3866b6',suit:'#263b69'}),
 Object.freeze({id:'mint',name:'민트',color:'#408b82',suit:'#244d4a'}),
 Object.freeze({id:'amber',name:'앰버',color:'#c88739',suit:'#69472c'}),
]);
export const characterById=id=>CHARACTERS.find(c=>c.id===id)||CHARACTERS[0];
export function formatDuration(seconds){if(seconds===null)return '∞ 무제한';const minutes=Math.round(seconds/60);return minutes>=60?`${Math.floor(minutes/60)}시간${minutes%60?' '+minutes%60+'분':''}`:`${minutes}분`;}
export function createBoardingPass(input,{id=crypto.randomUUID().slice(0,8).toUpperCase(),date=new Date(),stops=CITY_ORDER,circular=true}={}){
 if(!input||!stops.includes(input.from)||!stops.includes(input.to)||(input.from===input.to&&input.duration!==null))throw new Error('출발역과 도착역을 선택해 주세요.');
 if(!validDuration(input.duration))throw new Error('집중시간을 선택해 주세요.');
 if(!CHARACTERS.some(c=>c.id===input.character))throw new Error('함께할 캐릭터를 선택해 주세요.');
 if(!['ticket','card'].includes(input.medium))throw new Error('승차권 종류를 선택해 주세요.');
 const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
 return Object.freeze({from:input.from,to:input.duration===null&&circular?input.from:input.to,duration:input.duration,character:input.character,medium:input.medium,id:'JF-'+id,date:day});
}
export function tearProgress(distance,width){if(!Number.isFinite(distance)||!Number.isFinite(width)||width<=0)return 0;return Math.max(0,Math.min(1,distance/Math.max(65,Math.min(140,width*.24))));}
export function cardTouchesReader(card,reader){
 if(![card?.x,card?.y,card?.width,card?.height,reader?.x,reader?.y,reader?.width,reader?.height].every(Number.isFinite)||Math.min(card.width,card.height,reader.width,reader.height)<=0)return false;
 const x=card.x+card.width/2,y=card.y+card.height/2;
 return x>=reader.x-12&&x<=reader.x+reader.width+12&&y>=reader.y-12&&y<=reader.y+reader.height+12;
}
export function createTicketCut({x,top,bottom,tolerance=20},start){
 if(![x,top,bottom,tolerance,start?.x,start?.y].every(Number.isFinite)||bottom<=top||tolerance<=0)return null;
 const length=bottom-top,nearTop=Math.abs(start.y-top)<=length*.12,nearBottom=Math.abs(start.y-bottom)<=length*.12;
 if(Math.abs(start.x-x)>tolerance||(!nearTop&&!nearBottom))return null;
 const direction=nearTop?1:-1,origin=direction===1?top:bottom;let progress=0,valid=true;
 return {direction,move(point){
  if(!Number.isFinite(point?.x)||!Number.isFinite(point?.y)||Math.abs(point.x-x)>tolerance)valid=false;
  const next=(point.y-origin)*direction/length;
  if(next<progress-.15)valid=false;
  if(valid)progress=Math.max(progress,Math.min(1,Math.max(0,next)));
  return {progress,valid,complete:valid&&progress>=.9};
 }};
}
