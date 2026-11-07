import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SONGDO_STOPS,makeSongdoPass,validSongdoPass,recommendSongdo} from '../src/songdo-journey.mjs';
import {Session} from '../public/songdo/src/session.mjs';
const input={from:SONGDO_STOPS[0],to:SONGDO_STOPS[5],duration:1500,character:'mint',medium:'card'};
test('Songdo tickets accept virtual stops, reject real rail names and malformed stored tickets',()=>{
 const pass=makeSongdoPass(input);assert.equal(validSongdoPass(pass),true);
 for(const patch of [{from:'성수'},{to:input.from},{duration:0},{duration:'1500'},{destination:'swiss'},{version:2},{id:'bad<script>'}])assert.equal(validSongdoPass({...pass,...patch}),false);
 assert.throws(()=>makeSongdoPass({...input,to:input.from}));
 assert.equal(validSongdoPass(makeSongdoPass({...input,duration:null})),true);
});
test('recommendations stay within the fictional route at both endpoints',()=>{
 for(const from of SONGDO_STOPS)for(const duration of [60,300,1500,7200,null]){
  const r=recommendSongdo(from,duration);assert.notEqual(r.from,r.to);assert.ok(SONGDO_STOPS.includes(r.to));assert.equal(r.stops[0],from);assert.equal(r.stops.at(-1),r.to);assert.equal(r.stopCount,r.stops.length-1);
 }
 assert.equal(recommendSongdo(SONGDO_STOPS[6],300).to,SONGDO_STOPS[5]);
});
test('finite sessions finish once and unlimited sessions pause without consuming hidden time',()=>{
 const finite=new Session(1);finite.start(100);finite.tick(60100);assert.equal(finite.status,'completed');assert.equal(finite.elapsed,60);
 const unlimited=new Session(Infinity);unlimited.start(0);unlimited.pause(120000);assert.equal(unlimited.elapsed,120);unlimited.tick(200000);assert.equal(unlimited.elapsed,120);unlimited.start(200000);unlimited.tick(201000);assert.equal(unlimited.elapsed,121);assert.equal(unlimited.status,'running');
});
