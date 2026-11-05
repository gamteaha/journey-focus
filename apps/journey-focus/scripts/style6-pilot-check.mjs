import assert from 'node:assert/strict';
import {connectPage,waitFor,sleep} from './cdp.mjs';
import {writeFile} from 'node:fs/promises';
import {boardTrain} from './boarding-flow.mjs';
const p=await connectPage();
try{
 await p.send('Emulation.setDeviceMetricsOverride',{width:1366,height:650,deviceScaleFactor:1,mobile:false});
 await p.send('Page.navigate',{url:'http://localhost:5173/'});
 await boardTrain(p);
 assert.ok(await waitFor(p,`!!document.querySelector('#scene-style')&&!!document.querySelector('#map-frame').contentWindow.ws3d?.viewer`,45000));
 await sleep(6000);
 assert.ok(await waitFor(p,`document.querySelector('#scene').classList.contains('map-ready')`,45000));
 await p.evaluate(`document.querySelector('#landscape-view')?.click()`);await sleep(1000);
 const state=await p.evaluate(`(()=>{const v=document.querySelector('#map-frame').contentWindow.ws3d.viewer;return {style:document.querySelector('#scene-style').value,intensity:v.scene.light.intensity,shadows:v.scene.shadowMap.enabled,ao:v.scene.postProcessStages.ambientOcclusion.enabled,locked:!v.scene.screenSpaceCameraController.enableInputs,height:innerHeight,scroll:document.documentElement.scrollHeight,error:document.querySelector('#map-frame').contentDocument.querySelector('#map-error').textContent}})()`);
 console.log(JSON.stringify(state));assert.equal(state.style,'cinematic');assert.equal(state.intensity,1.2);assert.equal(state.shadows,false);assert.equal(state.ao,true);assert.equal(state.locked,true);assert.equal(state.error,'');assert.ok(state.scroll<=state.height+1);
 await p.screenshot('../../tmp/route-video-pilot/app-style6.png');
 const alignment=await p.evaluate(`new Promise(resolve=>{const v=document.querySelector('#map-frame').contentWindow.ws3d.viewer;v.camera.setView({orientation:{heading:v.camera.heading+.2,pitch:v.camera.pitch,roll:0}});v.scene.requestRender();setTimeout(()=>{const a=v.camera.directionWC,b=v.scene.light.direction;resolve(a.x*b.x+a.y*b.y+a.z*b.z)},500)})`);
 assert.ok(alignment>.9999);
 await p.evaluate(`(()=>{const s=document.querySelector('#scene-style');s.value='original';s.dispatchEvent(new Event('change'));})()`);
 assert.equal(await p.evaluate(`document.querySelector('#map-frame').contentWindow.ws3d.viewer.scene.postProcessStages.ambientOcclusion.enabled`),false);
 await p.evaluate(`(()=>{const s=document.querySelector('#scene-style');s.value='cinematic';s.dispatchEvent(new Event('change'));})()`);
 await p.send('Page.navigate',{url:'http://localhost:5173/video-pilot/'});
 assert.ok(await waitFor(p,`[...document.querySelectorAll('video')].every(v=>v.readyState>=2)`,20000));
 await p.evaluate(`document.querySelector('#play').click()`);await sleep(3500);
 const videos=await p.evaluate(`[...document.querySelectorAll('video')].map(v=>({time:v.currentTime,width:v.videoWidth,height:v.videoHeight,error:v.error?.message||'',paused:v.paused,decoded:v.getVideoPlaybackQuality().totalVideoFrames}))`);
 for(const v of videos){assert.ok(v.time>2);assert.equal(v.width,1280);assert.equal(v.height,800);assert.equal(v.error,'');assert.ok(v.decoded>5);}
 await p.screenshot('../../tmp/route-video-pilot/video-preview.png');
 await p.evaluate(`document.querySelector('#pause').click()`);
 await writeFile('../../tmp/route-video-pilot/qa.json',JSON.stringify({state,alignment,videos,errors:p.errors.filter(e=>!e.includes('favicon'))},null,2));
 console.log(JSON.stringify({state,alignment,videos}));
 console.log('PASS: default 6, camera following, shadow off, original restore, locked input, desktop viewport, both video decodes');
}finally{p.close();}
