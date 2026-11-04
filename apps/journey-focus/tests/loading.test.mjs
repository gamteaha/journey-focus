import test from 'node:test';
import assert from 'node:assert/strict';
import {createSceneryLayer} from '../public/scenery-layer.mjs';
const flush=async()=>{for(let i=0;i<25;i++)await Promise.resolve();};
function harness(fromGltf){
 let heightCalls=0;
 const events=[],groups=[],listeners=new Set(),layers=new Map(['facility_build_all','facility_build'].map(id=>[id,{visible:true,show(){this.visible=true;},hide(){this.visible=false;}}]));
 class Collection{constructor(){this.models=[];this.dead=false;}add(m){this.models.push(m);return m;}isDestroyed(){return this.dead;}destroy(){this.dead=true;for(const m of this.models)m.destroy();}}
 class Cartesian3{constructor(...args){this.args=args;}static fromDegrees(...args){return args;}}
 const viewer={terrainProvider:{},map:{getElementById:id=>layers.get(id)},entities:{add:e=>e,remove:()=>{}},scene:{requestRender(){},globe:{tilesLoaded:true,getHeight:()=>{heightCalls++;return 55;},tileLoadProgressEvent:{addEventListener(fn){listeners.add(fn);return()=>listeners.delete(fn);}}},primitives:{add(g){groups.push(g);return g;},remove(g){g.destroy();}}}};
 const C={PrimitiveCollection:Collection,Cartesian3,Cartographic:{fromDegrees:(lon,lat)=>({lon,lat})},sampleTerrain:async()=>{},Transforms:{headingPitchRollToFixedFrame:()=>({})},HeadingPitchRoll:class{},Math:{toRadians:n=>n},Model:{fromGltf}};
 return {layer:createSceneryLayer(viewer,C,(type,data)=>events.push({type,data}),()=>{}),events,groups,layers,listeners,heightCalls:()=>heightCalls};
}
const object={kind:'tree',lon:127.61,lat:37.82,heading:0,scale:1};
const model=readyPromise=>({readyPromise,show:true,dead:false,isDestroyed(){return this.dead;},destroy(){this.dead=true;}});
test('tile completion never performs all terrain queries synchronously',async()=>{
 const h=harness(()=>model(Promise.resolve()));await h.layer.load([object]);
 const before=h.heightCalls();for(const fn of h.listeners)fn(0);
 assert.equal(h.heightCalls(),before,'terrain work is deferred out of the tile completion event');
 h.layer.clear();
});
test('a stalled model reaches a retryable error and restores the map',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const stalled=model(new Promise(()=>{})),h=harness(()=>stalled);
 let done=false;const pending=h.layer.load([object]).then(()=>done=true);await flush();
 t.mock.timers.tick(20001);await flush();
 assert.equal(done,true,'load must settle when a texture never resolves');
 assert.equal(h.events.at(-1).type,'scenery-error');assert.equal(stalled.dead,true);assert.equal(h.listeners.size,0);
 assert.ok([...h.layers.values()].every(l=>l.visible));await pending;
});
test('clear cancels a stalled generation promptly and a retry can finish',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const stalled=model(new Promise(()=>{})),ready=model(Promise.resolve());let calls=0;
 const h=harness(()=>calls++?ready:stalled);let done=false;
 const first=h.layer.load([object]).then(()=>done=true);await flush();h.layer.clear();await flush();
 assert.equal(done,true,'clear must release pending model waits immediately');assert.equal(h.listeners.size,0);
 await h.layer.load([object]);assert.equal(h.events.at(-1).type,'scenery-ready');
 t.mock.timers.tick(20001);await flush();assert.equal(h.events.at(-1).type,'scenery-ready');assert.equal(ready.dead,false);await first;
});
test('a model returned after cancellation is destroyed without joining the next generation',async()=>{
 let resolve;const delayed=new Promise(r=>resolve=r),ready=model(Promise.resolve());let calls=0;
 const h=harness(()=>calls++?ready:delayed);let done=false;
 const first=h.layer.load([object]).then(()=>done=true);await flush();h.layer.clear();await flush();
 assert.equal(done,true);await h.layer.load([object]);const late=model(Promise.resolve());resolve(late);await flush();
 assert.equal(late.dead,true);assert.equal(ready.dead,false);assert.equal(h.events.at(-1).type,'scenery-ready');await first;
});

test('the deadline also bounds asynchronous model creation and disposes its late result',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 let resolve;const h=harness(()=>new Promise(r=>resolve=r));let done=false;
 const pending=h.layer.load([object]).then(()=>done=true);await flush();
 t.mock.timers.tick(20001);await flush();assert.equal(done,true);
 assert.equal(h.events.at(-1).type,'scenery-error');assert.equal(h.listeners.size,0);
 const late=model(Promise.resolve());resolve(late);await flush();assert.equal(late.dead,true);await pending;
});
