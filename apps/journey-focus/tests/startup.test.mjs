import test from 'node:test';
import assert from 'node:assert/strict';
import * as startup from '../src/startup.mjs';
function fixture(){
 const listeners=new Set(),calls=[];
 const viewer={camera:{pitch:-4*Math.PI/180,positionCartographic:{height:100},moveEnd:{addEventListener(fn){listeners.add(fn);return()=>listeners.delete(fn);}}},scene:{globe:{tilesLoaded:false}}};
 const fire=()=>{for(const fn of [...listeners])fn();};
 return{viewer,listeners,calls,fire};
}
test('startup waits for the provider flight and then aligns again after near terrain loads',t=>{
 t.mock.timers.enable({apis:['Date','setInterval']});
 const h=fixture();assert.equal(typeof startup.settleInitialView,'function');
 startup.settleInitialView(h.viewer,{align:()=>h.calls.push('align'),ready:()=>h.calls.push('ready')});
 h.fire();t.mock.timers.tick(1000);assert.deepEqual(h.calls,[]);
 h.viewer.camera.pitch=-35*Math.PI/180;h.viewer.camera.positionCartographic.height=2600;h.fire();
 assert.deepEqual(h.calls,['align']);t.mock.timers.tick(400);assert.deepEqual(h.calls,['align']);
 h.viewer.scene.globe.tilesLoaded=true;t.mock.timers.tick(300);
 assert.deepEqual(h.calls,['align','align','ready']);assert.equal(h.listeners.size,0);
 t.mock.timers.tick(10000);h.fire();assert.equal(h.calls.length,3);
});
test('missing provider events have a bounded fallback and cancellation releases listeners',t=>{
 t.mock.timers.enable({apis:['Date','setInterval']});
 const h=fixture();assert.equal(typeof startup.settleInitialView,'function');
 const cancel=startup.settleInitialView(h.viewer,{align:()=>h.calls.push('align'),ready:()=>h.calls.push('ready')});
 cancel();t.mock.timers.tick(20000);h.fire();assert.deepEqual(h.calls,[]);assert.equal(h.listeners.size,0);
 startup.settleInitialView(h.viewer,{align:()=>h.calls.push('align'),ready:()=>h.calls.push('ready')});
 t.mock.timers.tick(10000);t.mock.timers.tick(3501);assert.deepEqual(h.calls,['align','align','ready']);
});
