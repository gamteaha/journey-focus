import test from 'node:test';
import assert from 'node:assert/strict';
import {createFrameWork} from '../src/frame-work.mjs';
function harness(run){let time=0,id=0;const frames=new Map(),errors=[];const work=createFrameWork(run,{request:fn=>{frames.set(++id,fn);return id;},cancel:i=>frames.delete(i),now:()=>time,budgetMs:4,maxSteps:4,onError:e=>errors.push(e)});return{work,frames,errors,spend:ms=>time+=ms,tick(){const [i,fn]=frames.entries().next().value;frames.delete(i);fn();}};}
test('expensive jobs stay within one query beyond the frame budget and never run synchronously',()=>{
 const calls=[];let h;h=harness(function*(){for(let i=0;i<10;i++){calls.push(i);h.spend(3);yield;}});
 h.work.request();assert.equal(calls.length,0);h.tick();assert.equal(calls.length,2);h.tick();assert.equal(calls.length,4);
 while(h.frames.size)h.tick();assert.deepEqual(calls,[0,1,2,3,4,5,6,7,8,9]);
});
test('repeated events coalesce without abandoning current work and cancel releases pending frames',()=>{
 let runs=0;const h=harness(function*(){runs++;for(let i=0;i<5;i++)yield;});
 h.work.request();h.tick();for(let i=0;i<20;i++)h.work.request();
 while(h.frames.size)h.tick();assert.equal(runs,2);
 h.work.request();h.work.cancel();assert.equal(h.frames.size,0);assert.equal(runs,2);
 h.work.request();while(h.frames.size)h.tick();assert.equal(runs,3);
});
test('cancelling from inside an update cannot resurrect the old frame queue',()=>{
 let h;h=harness(function*(){h.work.cancel();yield;});
 h.work.request();h.tick();assert.equal(h.frames.size,0);assert.equal(h.errors.length,0);
});
