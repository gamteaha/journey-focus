import { positionAt } from './route.mjs';
function offset(point, meters, angle) {
  const a=angle*Math.PI/180;
  return {lon:point.lon+Math.sin(a)*meters/(111320*Math.cos(point.lat*Math.PI/180)),lat:point.lat+Math.cos(a)*meters/111320};
}
export function makePilot(route) {
  if(route.geometry!=='osm-rail'||route.distance<450)throw new Error('백양리 → 강촌의 OSM 선형이 필요합니다.');
  const pilot={route,start:150,length:300,objects:[]};
  for(const [kind,count,side,minOffset] of [['house',5,1,40],['tree',10,1,17],['shrub',18,1,11],['pole',8,1,6]]){
    for(let i=0;i<count;i++){
      const along=150+(i/count)*300+(kind==='house'?20:kind==='tree'?-5:kind==='shrub'?-10:8);
      const p=positionAt(route,along/route.distance);
      const jitter=Math.sin(i*7.13+count)*7;
      const location=offset(p,(minOffset+jitter)*side,p.heading+90);
      const leafy=kind==='tree'&&i%2===0;
      pilot.objects.push({kind,...location,heading:p.heading+(kind==='house'?180+[20,-25,0,-15,25][i]:(i*137)%360),scale:kind==='tree'?(leafy?1.8+(i%3)*.1:6.5+(i%3)*.6):kind==='shrub'?9+(i%4):1,...(kind==='house'?{railOffset:minOffset+jitter,railHeading:p.heading}:kind==='tree'?{variant:leafy?'leafy':'pine'}:{})});
    }
  }
  // Irregular groups; reserve the camera corridor and house margins.
  const houses=pilot.objects.filter(o=>o.kind==='house');
  for(let i=0;i<72;i++){
    const cluster=Math.floor(i/3),member=i%3;
    const along=154+cluster*12.1+Math.sin(cluster*5.7)*3+member*1.8;
    const p=positionAt(route,along/route.distance);
    let distance=12+((cluster*17)%19)+Math.sin(i*4.3)*1.4;
    let location=offset(p,distance,p.heading+90);
    while(houses.some(h=>Math.hypot((h.lon-location.lon)*111320*Math.cos(p.lat*Math.PI/180),(h.lat-location.lat)*111320)<16)){
      distance-=1;
      location=offset(p,distance,p.heading+90);
    }
    pilot.objects.push({kind:'grass',...location,heading:(i*137)%360,scale:1+(i%4)*.15});
  }
  return pilot;
}
export function pilotPosition(pilot,progress){return positionAt(pilot.route,(pilot.start+Math.max(0,Math.min(1,Number(progress)||0))*pilot.length)/pilot.route.distance);}

export function houseFootprint(object){
 return [[0,0],[-5.5,-5],[0,-5],[5.5,-5],[-5.5,0],[5.5,0],[-5.5,5],[0,5],[5.5,5]].map(([x,z])=>offset(offset(object,x,object.heading+90),z,object.heading+180));
}
export function houseSupport(heights){
 if(!heights.length||heights.some(h=>!Number.isFinite(h)))return null;
 const min=Math.min(...heights),max=Math.max(...heights);
 return {base:max+.04,bottom:min-.25,depth:Math.round((max-min+.29)*1e6)/1e6,range:max-min};
}
export function houseCandidates(object){
 const railOffset=object.railOffset??40;
 const placementHeading=Number.isFinite(object.railHeading)?object.railHeading+180:object.heading;
 return [railOffset,32,24,18,12].filter((n,i,all)=>all.indexOf(n)===i).flatMap(target=>[0,-12,12,-24,24,-36,36].map(along=>({...object,...offset(offset(object,along,placementHeading),railOffset-target,placementHeading+90)})));
}
