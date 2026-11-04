import test from 'node:test';
import assert from 'node:assert/strict';
import { medianHeight,pilotGroundHeight,HeightStabilizer } from '../src/motion.mjs';

test('one terrain height spike cannot lift the median camera path',()=>{
 assert.equal(medianHeight([55,55.1,60.3,55.2,55.1,55.15,55.05]),55.1);
 assert.equal(medianHeight([undefined,NaN,55]),55);
 assert.equal(medianHeight([undefined,NaN]),null);
});
test('continuous movement bounds vertical speed even if terrain jumps',()=>{
 const filter=new HeightStabilizer();
 let previous=filter.update(55,0,false);
 for(let i=1;i<=60;i++){
  const current=filter.update(60, i/60, false);
  assert.ok(Math.abs(current-previous)<=.8/60+1e-9);
  previous=current;
 }
 assert.ok(previous<56);
 assert.equal(filter.update(80,2,true),80,'Explicit scrub may reposition immediately');
});
test('missing terrain samples hold the last stable camera height',()=>{
 const filter=new HeightStabilizer();
 assert.equal(filter.update(null,0,false),null);
 assert.equal(filter.update(55,1,false),55);
 assert.equal(filter.update(null,2,false),55);
});
test('the above-sea-level pilot rejects unready negative and extreme coarse samples',()=>{
 assert.ok(Math.abs(pilotGroundHeight([-90,-90,55,55.1,55.2,150,55.3],55)-55.15)<1e-9);
 assert.equal(pilotGroundHeight([-90,NaN,undefined],55),null);
 assert.equal(pilotGroundHeight([55,55.1,60.3,55.2,55.15],60.3),55.15);
});
