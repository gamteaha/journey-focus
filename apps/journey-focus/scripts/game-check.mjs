import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {connectPage,waitFor,sleep} from './cdp.mjs';
import {boardTrain} from './boarding-flow.mjs';
import * as T from '../public/vendor/three/build/three.module.js';
const p=await connectPage({port:Number(process.env.JF_QA_PORT)||9224,acceptBeforeUnload:true});
const out='../../tmp/game-qa';await fs.mkdir(out,{recursive:true});let session;
const C=expression=>p.evaluate(expression,session);
async function pointAtSeat(x,z){
 const r=await C(`(()=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,camera:JSON.parse(c.dataset.camera)}})()`);
 const cam=new T.PerspectiveCamera(r.camera.fov,r.camera.aspect,.04,100);cam.position.fromArray(r.camera.position);cam.lookAt(...r.camera.target);cam.updateMatrixWorld();
 const v=new T.Vector3(x,.80,z).project(cam);return {x:r.x+(v.x+1)*r.width/2,y:r.y+(1-v.y)*r.height/2};
}
async function mouse(type,pt){await p.send('Input.dispatchMouseEvent',{type,...pt,...(type==='mouseMoved'?{}:{button:'left',clickCount:1})});}
const layouts=[];
try{
 await p.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
 await p.send('Page.navigate',{url:'http://localhost:5173/'});await p.send('Page.bringToFront');await boardTrain(p,{duration:300});
 const target=(await p.send('Target.getTargets')).targetInfos.find(t=>t.type==='iframe'&&t.url.includes('/cabin-frame'));assert.ok(target);
 session=(await p.send('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;await p.send('Runtime.enable',{},session);
 await sleep(1700);assert.equal(await p.evaluate(`document.querySelector('#game-clock').hidden`),true);
 await p.screenshot(`${out}/01-carriage.png`);
 const point=await pointAtSeat(.93,-1.17569),before=await p.evaluate(`document.querySelector('#cabin-root').dataset.position`);
 await mouse('mouseMoved',point);await sleep(150);
 assert.equal(await C(`document.querySelector('#cabin-stage').dataset.hover`),'B10');
 await mouse('mousePressed',point);await mouse('mouseReleased',point);await sleep(500);
 assert.equal(await C(`document.querySelector('#cabin-stage').dataset.candidate`),'B10');
 assert.equal(await p.evaluate(`document.querySelector('#cabin-root').dataset.position`),before,'preview cannot move avatar');
 assert.equal(await p.evaluate(`document.querySelector('#cabin-root').dataset.seat`),'');
 await p.screenshot(`${out}/02-seat-preview.png`);
 await C(`document.querySelector('#cabin-sit').click()`);
 assert.ok(await waitFor(p,`document.querySelector('#cabin-root').dataset.seat==='B10'`,15000));
 await sleep(800);await p.screenshot(`${out}/03-seated.png`);
 assert.ok(await waitFor(p,`document.querySelector('#start').disabled===false`,60000));
 await p.evaluate(`document.querySelector('#start').click()`);await sleep(800);
 assert.equal(await p.evaluate(`document.querySelector('#game-clock').hidden`),false);
 assert.equal(await p.evaluate(`document.querySelector('#game-departure').hidden`),true);
 assert.equal(await p.evaluate(`document.querySelector('#monitor-next').textContent`),await p.evaluate(`document.querySelector('#to').value`));
 await p.screenshot(`${out}/04-departed.png`);
 const time=await p.evaluate(`document.querySelector('#timer').textContent`);
 await C(`document.querySelector('#cabin-window').click()`);await sleep(1600);
 assert.equal(await p.evaluate(`document.body.classList.contains('cabin-mode')`),false);
 assert.equal(await p.evaluate(`document.querySelector('#map-frame').contentWindow.ws3d.viewer.scene.screenSpaceCameraController.enableInputs`),false);
 assert.equal(await p.evaluate(`document.querySelector('#map-frame').contentWindow.ws3d.viewer.useDefaultRenderLoop`),true);
 assert.notEqual(await p.evaluate(`document.querySelector('#timer').textContent`),time);
 await p.screenshot(`${out}/05-window.png`);
 await p.evaluate(`document.querySelector('#cabin-view').click();document.querySelector('#game-settings-button').click()`);
 assert.equal(await p.evaluate(`document.querySelector('#game-settings').open`),true);
 await p.screenshot(`${out}/06-settings.png`);
 await p.evaluate(`document.querySelector('#game-settings-close').click();document.querySelector('#pause').click()`);
 assert.equal(await p.evaluate(`document.querySelector('#map-frame').contentWindow.ws3d.viewer.targetFrameRate`),2);
 assert.equal(await p.evaluate(`document.querySelector('#game-clock-label').textContent`),'잠시 쉬어가는 중');
 await sleep(700); // Let the isolated renderer resume and publish its front camera after the dialog closes.
 const other=await pointAtSeat(.93,-1.68217);await mouse('mousePressed',other);await mouse('mouseReleased',other);await sleep(200);
 assert.equal(await p.evaluate(`document.querySelector('#cabin-root').dataset.seat`),'B10','previewing another seat retains current seat');
 assert.equal(await C(`document.querySelector('#cabin-stage').dataset.candidate`),'B09');
 await C(`document.querySelector('#cabin-sit').click()`);assert.ok(await waitFor(p,`document.querySelector('#cabin-root').dataset.seat==='B09'`,15000));
 await C(`document.querySelector('#cabin-stand').click();document.querySelector('canvas').focus()`);
 const start=await p.evaluate(`document.querySelector('#cabin-root').dataset.position`);
 await p.send('Input.dispatchKeyEvent',{type:'keyDown',key:'w',code:'KeyW',windowsVirtualKeyCode:87});await sleep(400);await p.send('Input.dispatchKeyEvent',{type:'keyUp',key:'w',code:'KeyW',windowsVirtualKeyCode:87});await sleep(150);
 assert.notEqual(await p.evaluate(`document.querySelector('#cabin-root').dataset.position`),start);
 for(const [width,height]of [[1440,900],[1366,650],[1100,700],[390,844],[844,390]]){
  await p.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await sleep(850);
  const layout=await p.evaluate(`(()=>{const r=document.querySelector('#scene').getBoundingClientRect(),m=document.querySelector('.train-monitor').getBoundingClientRect();return {width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollHeight,scrollWidth:document.documentElement.scrollWidth,scene:r.toJSON(),monitor:m.toJSON()}})()`);
  assert.equal(layout.scene.x,0);assert.equal(layout.scene.y,0);assert.equal(layout.scene.width,width);assert.equal(layout.scene.height,height);assert.ok(layout.scroll<=height+1);assert.ok(layout.scrollWidth<=width+1);assert.ok(layout.monitor.left>=0&&layout.monitor.right<=width);
  const bubble=await C(`(()=>{const r=document.querySelector('#cabin-interaction').getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}})()`);
  assert.ok(bubble.left>=0&&bubble.right<=width&&bubble.bottom<=height,'context action stays on screen');
  layouts.push({...layout,bubble});await p.screenshot(`${out}/layout-${width}-${height}.png`);
 }
 if(process.argv.includes('--reload')){
  const origin=await p.evaluate('performance.timeOrigin');await p.send('Page.reload');
  assert.ok(await waitFor(p,`performance.timeOrigin!==${origin}&&document.querySelector('#boarding-next')?.disabled===false`,30000));
  assert.equal(await p.evaluate(`!!document.querySelector('#cabin-frame')`),false);
  await boardTrain(p);assert.equal(await p.evaluate(`document.querySelector('#game-clock').hidden`),true);
  assert.ok(p.dialogs.some(d=>d.type==='beforeunload'));
 }
 assert.deepEqual(p.errors.filter(e=>!e.includes('favicon')),[]);
 await fs.writeFile(`${out}/results.json`,JSON.stringify({layouts,errors:p.errors,checks:['edge-to-edge carriage','no timer before departure','seat hover','click previews without moving','confirm walks and sits','timer after departure','overhead station monitor','window view retains timer and map lock','settings drawer','movement after closing settings','no overflow desktop/mobile/landscape']},null,2));
 console.log('PASS: immersive game layout, contextual seat interaction, departure clock, station monitor, settings and window view');
}finally{p.close();}
