import test from 'node:test';
import assert from 'node:assert/strict';
import {makeSwissPass,validSwissPass,swissPosition,swissElapsedAt,advanceSwissTrip} from '../src/swiss-journey.mjs';

test('Swiss pass carries either endpoint, chosen duration, medium and character independently of Seoul',()=>{
 const pass=makeSwissPass({from:'호수 남쪽',to:'호수 북쪽',duration:1500,medium:'card',character:'mint'});
 assert.ok(validSwissPass(pass));assert.equal(pass.from,'호수 남쪽');assert.equal(pass.duration,1500);assert.equal(pass.character,'mint');
 assert.equal(makeSwissPass({...pass,duration:null}).to,'호수 북쪽');
 assert.throws(()=>makeSwissPass({...pass,from:'성수'}));assert.ok(!validSwissPass({...pass,duration:3}));assert.ok(!validSwissPass({...pass,to:pass.from}));
});
test('five-minute reversals are continuous, stay on the real segment, and preserve equal speed',()=>{
 const total=1588;
 for(const start of ['호수 북쪽','호수 남쪽']){
  for(const turn of [300,600,900,1200]){
   const before=swissPosition(turn-.001,total,start),at=swissPosition(turn,total,start),after=swissPosition(turn+.001,total,start);
   assert.notEqual(before.forward,after.forward);assert.ok(Math.abs(before.meters-at.meters)<.006);assert.ok(Math.abs(after.meters-at.meters)<.006);
  }
  for(let second=0;second<=7200;second+=17){const p=swissPosition(second,total,start);assert.ok(p.meters>=0&&p.meters<=total);assert.ok(Math.abs(swissElapsedAt(p.meters,total,second,start)-second)<1e-8);}
 }
 assert.equal(swissPosition(300,total).meters,total);assert.equal(swissPosition(600,total).meters,0);
});
test('finite sessions stop exactly at their goal, not the first endpoint; unlimited continues',()=>{
 const base={elapsed:299.9,travelSeconds:299.9,duration:1500,total:1588,from:'호수 북쪽'};
 const turn=advanceSwissTrip(base,.2);assert.equal(turn.complete,false);assert.equal(turn.forward,false);assert.ok(turn.meters<1588);
 const done=advanceSwissTrip({...base,elapsed:1499.9,travelSeconds:1499.9},.2);assert.equal(done.elapsed,1500);assert.equal(done.travelSeconds,1500);assert.equal(done.complete,true);
 const forever=advanceSwissTrip({...base,duration:null,elapsed:7199.9,travelSeconds:7199.9},.2);assert.ok(forever.elapsed>7200);assert.equal(forever.complete,false);
 const short=advanceSwissTrip({...base,elapsed:59.9,travelSeconds:59.9,duration:60},.2);assert.equal(short.elapsed,60);assert.equal(short.meters,1588/5);
});
