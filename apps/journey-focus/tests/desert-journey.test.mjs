import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DESERT_STOPS,makeDesertPass,validDesertPass,recommendDesert} from '../src/desert-journey.mjs';

test('desert boarding isolates its tickets and rejects invalid journeys',()=>{
 const input={from:DESERT_STOPS[0],to:DESERT_STOPS[5],duration:1500,character:'amber',medium:'card'};
 const pass=makeDesertPass(input);
 assert.equal(validDesertPass(pass),true);
 assert.equal(validDesertPass(makeDesertPass({...input,duration:null})),true);
 for(const patch of [{destination:'songdo'},{from:'성수'},{to:input.from},{duration:0},{duration:'1500'},{id:'<script>'}])assert.equal(validDesertPass({...pass,...patch}),false);
 assert.throws(()=>makeDesertPass({...input,to:input.from}));
});

test('desert recommendations use five-minute segments and remain reachable at both ends',()=>{
 assert.equal(recommendDesert(DESERT_STOPS[0],1500).stopCount,5);
 assert.equal(recommendDesert(DESERT_STOPS[6],300).to,DESERT_STOPS[5]);
 for(const from of DESERT_STOPS)for(const duration of [60,300,1500,7200,null]){
  const r=recommendDesert(from,duration);
  assert.notEqual(r.from,r.to);assert.equal(r.stops[0],from);assert.equal(r.stops.at(-1),r.to);
  assert.equal(r.stopCount,r.stops.length-1);assert.ok(r.stops.every(s=>DESERT_STOPS.includes(s)));
 }
});
