import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CITY_ORDER,buildLoopRoute,buildRoute,positionAt,distance} from '../src/route.mjs';
import {SessionClock} from '../src/session.mjs';
import {journeyMetrics,loopLapSeconds,recommendJourney,REFERENCE_SPEED} from '../src/journey.mjs';
import {createBoardingPass,formatDuration} from '../src/boarding.mjs';
import {normalizePreferences,savePreferences,readPreferences} from '../src/preferences.mjs';
const shape=JSON.parse(readFileSync(new URL('../public/data/line2-loop.json',import.meta.url)));
const stations=shape.stationAnchors.map(s=>({name:s.name,...shape.points[s.pointIndex]}));
test('the main loop has 43 on-track stations, actual closure, and preserves underground metadata',()=>{
 assert.deepEqual(stations.map(s=>s.name),CITY_ORDER);assert.equal(new Set(CITY_ORDER).size,43);
 for(const branch of ['신설동','용답','신정네거리','도림천'])assert.ok(!CITY_ORDER.includes(branch));
 assert.equal(shape.points[0].id,shape.points.at(-1).id);
 assert.ok(shape.points.some(p=>p.tunnel)&&shape.points.some(p=>!p.tunnel));
 for(const from of CITY_ORDER){
  const route=buildLoopRoute(stations,from,shape);
  assert.equal(route.stops.length,44);assert.equal(route.stops[0].name,from);assert.equal(route.stops.at(-1).name,from);
  assert.ok(Math.abs(route.distance-shape.distanceMetres)<.001);
  const before=positionAt(route,1-1e-7),after=positionAt(route,1e-7);
  assert.ok(distance(before,after)<.02,'wrap follows the same rail without a teleport');
  const headingDelta=((after.heading-before.heading+540)%360)-180;assert.ok(Math.abs(headingDelta)<1,'heading is continuous at the seam');
  assert.equal(positionAt(route,3).name,from);assert.equal(positionAt(route,3).next,route.stops[1].name);
 }
});
test('finite destinations can cross the City Hall seam using the short real arc in both directions',()=>{
 const a=buildRoute(stations,'충정로','을지로입구',shape),b=buildRoute(stations,'을지로입구','충정로',shape);
 assert.deepEqual(a.stops.map(s=>s.name),['충정로','시청','을지로입구']);assert.deepEqual(b.stops.map(s=>s.name),['을지로입구','시청','충정로']);
 assert.ok(Math.abs(a.distance-b.distance)<.001);assert.ok(a.distance<2100);assert.equal(positionAt(a,1).name,'을지로입구');
 assert.throws(()=>buildRoute(stations,'성수','성수',shape));
});
test('every pair of the 43 main-loop stations has symmetric short-arc distance and its native rail endpoints',()=>{
 for(const from of stations)for(const to of stations)if(from.name!==to.name){
  const route=buildRoute(stations,from.name,to.name,shape),reverse=buildRoute(stations,to.name,from.name,shape);
  assert.ok(Math.abs(route.distance-reverse.distance)<.001);assert.ok(route.distance<=shape.distanceMetres/2+.001);
  assert.ok(distance(positionAt(route,0),from)<.001&&distance(positionAt(route,1),to)<.001);
  assert.equal(route.stops[0].name,from.name);assert.equal(route.stops.at(-1).name,to.name);
 }
});
test('unlimited study runs for many laps, pauses without travelling, resumes and only ends on stop',()=>{
 let now=0;const clock=new SessionClock(()=>now),route=buildLoopRoute(stations,'성수',shape);clock.start(null);
 now=loopLapSeconds(route)*1000*8+125000;let s=clock.snapshot(),m=journeyMetrics(route,s);
 assert.equal(s.state,'running');assert.equal(s.unlimited,true);assert.equal(s.duration,null);assert.equal(m.laps,8);assert.ok(m.progress>0);
 clock.pause();const paused=clock.snapshot();now+=86400000;assert.equal(clock.snapshot().elapsed,paused.elapsed);assert.deepEqual(journeyMetrics(route,clock.snapshot()),m);
 clock.resume();now+=45000;clock.stop();s=clock.snapshot();assert.equal(s.state,'stopped');assert.equal(s.elapsed,paused.elapsed+45);
 clock.reset();assert.equal(clock.snapshot().unlimited,false);clock.start(60);now+=61000;assert.equal(clock.snapshot().state,'completed');
 assert.throws(()=>clock.start(Infinity));
});
test('five-minute reference recommends both real directions and keeps two-hour travel on the longer arc',()=>{
 const reference=buildRoute(stations,'건대입구','성수',shape);
 assert.ok(Math.abs(reference.distance/REFERENCE_SPEED-300)<1e-8);
 const choices=[300,1500,3600,5400,7200].map(duration=>recommendJourney(stations,'성수',duration,shape));
 assert.deepEqual(choices.map(r=>r.to),['건대입구','잠실','서초','구로디지털단지','문래']);
 assert.deepEqual(choices.map(r=>r.stopCount),[1,5,13,22,24]);
 for(const choice of choices){
  const route=buildRoute(stations,choice.from,choice.to,shape,{direction:choice.direction});
  assert.ok(Math.abs(route.distance-choice.distance)<.001);
  assert.deepEqual(route.stops.map(s=>s.name),choice.stops);
  assert.ok(choice.paceDifference<.07);
  assert.equal(positionAt(route,1).name,choice.to);
 }
 const long=choices.at(-1),short=buildRoute(stations,long.from,long.to,shape);
 assert.ok(long.distance>shape.distanceMetres/2&&short.distance<shape.distanceMetres/2);
 assert.equal(recommendJourney(stations,'건대입구',300,shape).to,'성수');
});
test('unlimited and recommended trips share the five-minute spatial pace from every station',()=>{
 for(const station of stations){
  const route=buildLoopRoute(stations,station.name,shape),lapSeconds=loopLapSeconds(route);
  assert.ok(Math.abs(lapSeconds/60-196.4701514339385)<1e-6);
  const recommendation=recommendJourney(stations,station.name,null,shape);
  assert.equal(recommendation.speed,REFERENCE_SPEED);
  assert.equal(recommendation.lapSeconds,lapSeconds);
  const metrics=journeyMetrics(route,{unlimited:true,elapsed:300});
  assert.ok(Math.abs(metrics.distance-referenceDistance())<.001);
  assert.ok(Math.abs(journeyMetrics(route,{unlimited:true,elapsed:lapSeconds+.01}).progress)<.00001);
 }
 assert.deepEqual(journeyMetrics(null,{unlimited:true,elapsed:300}),{progress:0,laps:0,distance:0});
 function referenceDistance(){return buildRoute(stations,'성수','건대입구',shape).distance;}
});
test('unlimited tickets and preferences serialize explicitly as null and restore the same starting station',()=>{
 const input={from:'강남',to:'강남',duration:null,character:'blue',medium:'card'},pass=createBoardingPass(input);
 assert.equal(pass.duration,null);assert.equal(formatDuration(pass.duration),'∞ 무제한');assert.equal(JSON.parse(JSON.stringify(pass)).duration,null);
 const storage=new Map(),adapter={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};
 savePreferences(adapter,{...input,view:'window'});assert.deepEqual(readPreferences(adapter),{from:'강남',to:'강남',duration:null,view:'window'});
 assert.equal(normalizePreferences({duration:Infinity}).duration,1500);
 const recommendation=recommendJourney(stations,'강남',null,shape);assert.equal(recommendation.stopCount,43);assert.equal(recommendation.to,'강남');
});
