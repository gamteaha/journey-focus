import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CITY_ORDER,buildRoute,positionAt,normalizeStations} from '../src/route.mjs';
import {durationFromParts,recommendJourney,REFERENCE_SPEED} from '../src/journey.mjs';
import {createBoardingPass} from '../src/boarding.mjs';
const shape=JSON.parse(readFileSync(new URL('../public/data/line2-surface.json',import.meta.url)));
const stations=shape.stationAnchors.map(a=>({name:a.name,...shape.points[a.pointIndex]}));
test('every supported city pair stays on the connected rail with reversible endpoints and intermediate station progress',()=>{
 assert.ok(stations.every(s=>CITY_ORDER.includes(s.name)));
 assert.ok(shape.stationAnchors.every(a=>a.offsetMeters<10));
 for(let a=0;a<stations.length;a++)for(let b=0;b<stations.length;b++)if(a!==b){
  const forward=buildRoute(stations,stations[a].name,stations[b].name,shape),reverse=buildRoute(stations,stations[b].name,stations[a].name,shape);
  assert.equal(forward.geometry,'osm-rail');assert.ok(Math.abs(forward.distance-reverse.distance)<.001);
  assert.deepEqual(positionAt(forward,0).lon,positionAt(reverse,1).lon);
  assert.equal(forward.stops.length,Math.abs(a-b)+1);
  for(let i=0;i<forward.stops.length-1;i++){const stop=forward.stops[i],position=positionAt(forward,(stop.metres+.1)/forward.distance);assert.equal(position.name,stop.name);assert.equal(position.next,forward.stops[i+1].name);}
 }
});
test('longer focus times recommend farther real destinations while keeping the five-minute reference pace close',()=>{
 const choices=[300,600,900,1200].map(duration=>recommendJourney(stations,'성수',duration,shape));
 assert.deepEqual(choices.map(r=>r.to),['건대입구','구의','강변','잠실나루']);
 assert.deepEqual(choices.map(r=>r.stopCount),[1,2,3,4]);
 assert.ok(choices.every(r=>Math.abs(r.speed/REFERENCE_SPEED-1)<.2));
 assert.ok(choices.every((r,i)=>!i||r.distance>choices[i-1].distance));
 const reverse=recommendJourney(stations,'잠실나루',5400,shape);assert.equal(reverse.from,'잠실나루');assert.ok(reverse.stops.length>2);
 const middle=recommendJourney(stations,'강변',7200,shape);assert.equal(middle.to,'한양대');
 assert.equal(recommendJourney(stations,'성수',5400,null),null);
 assert.equal(recommendJourney(stations,'unknown',5400,shape),null);
});
test('minute precision survives ticket issue and validates the two-hour bounds',()=>{
 assert.equal(durationFromParts(1,30),5400);assert.equal(durationFromParts(0,37),2220);assert.equal(durationFromParts(2,0),7200);
 for(const parts of [[0,0],[2,1],[0,60],[-1,20],[NaN,30],[1.5,0]])assert.equal(durationFromParts(...parts),null);
 const pass=createBoardingPass({from:'성수',to:'강변',duration:2220,character:'blue',medium:'ticket'});assert.equal(pass.duration,2220);assert.equal(pass.to,'강변');
});
test('T Data qualified station names normalize into the supported corridor without taking other lines',()=>{
 const result=normalizeStations([{lineNm:'2호선',stnKrNm:'구의(광진구청)',convX:127.085916,convY:37.537077},{lineNm:'2호선',stnKrNm:'강변(동서울터미널)',convX:127.094681,convY:37.535095},{lineNm:'7호선',stnKrNm:'건대입구',convX:127.1,convY:37.5}],'2호선');
 assert.deepEqual(result.map(s=>s.name),['구의','강변']);
});
