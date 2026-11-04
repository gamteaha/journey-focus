import assert from 'node:assert/strict';
import {connectPage,waitFor,sleep} from './cdp.mjs';
const p=await connectPage({fresh:true});
try{
 await p.send('Page.addScriptToEvaluateOnNewDocument',{source:`try{localStorage.removeItem('journey-focus-visual');localStorage.removeItem('journey-focus-preferences')}catch{}`});
 await p.send('Page.navigate',{url:'http://localhost:5173/'});
 assert.ok(await waitFor(p,`document.querySelector('#scene')?.classList.contains('map-ready')&&document.querySelector('#start')?.disabled===false`,55000));
 const samples=[];
 for(let i=0;i<16;i++){
  samples.push(await p.evaluate(`(()=>{const w=document.querySelector('#map-frame').contentWindow,v=w.ws3d.viewer;return{pitch:w.Cesium.Math.toDegrees(v.camera.pitch),height:v.camera.positionCartographic.height}})()`));
  await sleep(250);
 }
 assert.ok(samples.every(s=>Math.abs(s.pitch+4)<1&&s.height<500),'Ready view never jumps back to SDK aerial flight');
 await p.evaluate(`(()=>{const w=document.querySelector('#map-frame').contentWindow,v=w.ws3d.viewer,c=v.camera.positionCartographic;v.camera.setView({destination:w.Cesium.Cartesian3.fromRadians(c.longitude,c.latitude,c.height+50),orientation:{heading:v.camera.heading,pitch:w.Cesium.Math.toRadians(-15),roll:0}})})()`);
 await sleep(600);
 assert.ok(await p.evaluate(`(()=>{const w=document.querySelector('#map-frame').contentWindow;return Math.abs(w.Cesium.Math.toDegrees(w.ws3d.viewer.camera.pitch)+15)<1})()`),'Startup releases manual camera navigation');
 assert.equal(p.errors.length,0);
 console.log(JSON.stringify({passed:['late SDK flight alignment','stable ready window view','manual navigation released'],maxPitchError:Math.max(...samples.map(s=>Math.abs(s.pitch+4))),pageErrors:p.errors.length}));
}catch(error){console.log(JSON.stringify({failed:error.message,pageErrors:p.errors.length}));process.exitCode=1;}
finally{p.close();}
