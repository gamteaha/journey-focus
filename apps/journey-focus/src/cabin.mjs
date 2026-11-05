// Metre-like display coordinates calibrated to the supplied FBX, not surveyed dimensions.
export const CABIN_FLOOR_Y=.123;
const bays=[-7.57655,-7.07007,-6.56820,-4.19614,-3.68966,-3.18778,-2.68591,-2.18404,-1.68217,-1.17569,1.17569,1.68217,2.18404,2.68591,3.18778,3.68966,4.19614,6.56820,7.07007,7.57655];
export const CABIN_SEATS=Object.freeze(['A','B'].flatMap((side)=>bays.map((z,i)=>Object.freeze({id:`${side}${String(i+1).padStart(2,'0')}`,side,x:side==='A'?-.93:.93,z,y:.52,label:`${side}${String(i+1).padStart(2,'0')} · ${side==='A'?'왼쪽':'오른쪽'} 창가`,heading:side==='A'?Math.PI/2:-Math.PI/2}))));
export function cabinStudyFrame(seatId,aspect=16/9,height=900){
 const seat=CABIN_SEATS.find(s=>s.id===seatId);if(!seat)return null;
 const ratio=Number.isFinite(aspect)&&aspect>0?aspect:16/9,index=bays.indexOf(seat.z);let start=index,end=index;
 while(start>0&&bays[start]-bays[start-1]<1)start--;while(end<bays.length-1&&bays[end+1]-bays[end]<1)end++;
 const z=ratio<1.2?seat.z:(bays[start]+bays[end])/2;
 const short=Number.isFinite(height)&&height<500,narrow=ratio<1.2;
 const fit=2*Math.atan(((bays[end]-bays[start])/2+.6)/(1.75*ratio))*180/Math.PI;
 return {position:[-Math.sign(seat.x)*1.16,1.20,z],target:[seat.x,short?1.20:narrow ? .96 : 1.15,z],fov:narrow&&!short?60:Math.max(short?75:60,Math.min(85,fit)),rowSeats:end-start+1};
}
export function createCabinState(){
 let x=0,z=0,heading=0,seatId=null,targetSeatId=null,candidateSeatId=null,waypoints=[];
 const snapshot=()=>({x,z,heading,seatId,targetSeatId,candidateSeatId,moving:waypoints.length>0,posture:seatId?'seated':waypoints.length?'walking':'standing'});
 const stand=()=>{if(seatId){x=Math.sign(x)*.40;seatId=null;}targetSeatId=null;waypoints=[];return snapshot();};
 return {
  snapshot,stand,
  previewSeat(id){if(!CABIN_SEATS.some(s=>s.id===id))return false;if(waypoints.length)stand();candidateSeatId=id===seatId?null:id;return true;},
  clearPreview(){candidateSeatId=null;},
  confirmSeat(){return candidateSeatId?this.chooseSeat(candidateSeatId):false;},
  chooseSeat(id){const s=CABIN_SEATS.find(s=>s.id===id);if(!s)return false;if(seatId===id)return true;stand();candidateSeatId=null;targetSeatId=id;waypoints=[{x:0,z},{x:0,z:s.z},{x:s.x,z:s.z}];return true;},
  nearestSeat(){return CABIN_SEATS.reduce((a,s)=>Math.hypot(s.x-x,s.z-z)<Math.hypot(a.x-x,a.z-z)?s:a);},
  moveTo(px,pz){if(!Number.isFinite(px)||!Number.isFinite(pz))return false;stand();waypoints=[{x:Math.max(-.46,Math.min(.46,px)),z:Math.max(-7.9,Math.min(7.9,pz))}];return true;},
  update(delta,input={x:0,z:0}){
   const dt=Math.max(0,Math.min(.05,Number.isFinite(delta)?delta:0));
   let dx=Number.isFinite(input.x)?input.x:0,dz=Number.isFinite(input.z)?input.z:0;
   if(dx||dz){candidateSeatId=null;if(seatId||targetSeatId||waypoints.length)stand();const n=Math.hypot(dx,dz);dx/=n;dz/=n;x=Math.max(-.46,Math.min(.46,x+dx*1.65*dt));z=Math.max(-7.9,Math.min(7.9,z+dz*1.65*dt));heading=Math.atan2(dx,dz);return {...snapshot(),moving:true,posture:'walking'};}
   if(waypoints.length){const p=waypoints[0],d=Math.hypot(p.x-x,p.z-z),step=1.65*dt;if(d<=step+.002){x=p.x;z=p.z;waypoints.shift();if(!waypoints.length&&targetSeatId){const s=CABIN_SEATS.find(s=>s.id===targetSeatId);seatId=s.id;heading=s.heading;targetSeatId=null;}}else{x+=(p.x-x)/d*step;z+=(p.z-z)/d*step;heading=Math.atan2(p.x-x,p.z-z);}}
   return snapshot();
  },
 };
}
