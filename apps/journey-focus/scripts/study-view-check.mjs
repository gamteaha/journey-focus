import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {connectPage,waitFor,sleep} from './cdp.mjs';import {boardTrain} from './boarding-flow.mjs';
const port=Number(process.env.JF_QA_PORT)||9224,base=`http://127.0.0.1:${port}`,out='../../tmp/study-view-qa';
for(const t of await(await fetch(base+'/json/list')).json())if(t.type==='page'&&t.url.startsWith('http://localhost:5173/'))await fetch(base+'/json/close/'+t.id);
const p=await connectPage({fresh:true,port,acceptBeforeUnload:true});await fs.mkdir(out,{recursive:true});let session;
const C=expression=>p.evaluate(expression,session);
try{
 await p.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});await p.send('Page.navigate',{url:'http://localhost:5173/'});await p.send('Page.bringToFront');await boardTrain(p,{duration:300,character:'blue'});
 const target=(await p.send('Target.getTargets')).targetInfos.find(t=>t.type==='iframe'&&t.url.includes('/cabin-frame'));session=(await p.send('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;await p.send('Runtime.enable',{},session);
 assert.equal(await C(`document.querySelector('#cabin-study-clock').hidden`),true);
 await C(`document.querySelector('#cabin-sit').click()`);assert.ok(await waitFor(p,`document.querySelector('#cabin-root').dataset.seat==='A10'`,15000));assert.equal(await C(`document.querySelector('#cabin-stage').dataset.cameraMode`),'follow');
 await p.evaluate(`document.querySelector('#start').click()`);assert.ok(await waitFor(p,`document.body.classList.contains('running')`,5000));await sleep(1800);
 assert.equal(await C(`document.querySelector('#cabin-stage').dataset.cameraMode`),'study');assert.equal(await C(`document.querySelector('#cabin-study-clock').hidden`),false);
 const a=await C(`JSON.parse(document.querySelector('canvas').dataset.camera)`);assert.ok(a.position[0]>0&&a.target[0]<0);assert.ok(Math.abs(a.position[2]-a.target[2])<.03);await p.screenshot(`${out}/01-left-bench.png`);
 const elapsed=Number(await C(`document.querySelector('#cabin-stage').dataset.studyElapsed`));assert.ok(elapsed>=1);
 await p.evaluate(`document.querySelector('#pause').click()`);await sleep(150);const paused=await C(`document.querySelector('#cabin-study-elapsed').textContent`);await sleep(1400);assert.equal(await C(`document.querySelector('#cabin-study-elapsed').textContent`),paused);assert.equal(await C(`document.querySelector('#cabin-study-state').textContent`),'잠시 쉬는 중');
 const sum=await p.evaluate(`(()=>{const t=document.querySelector('#timer').textContent.split(':').map(Number);return t[0]*60+t[1]})()`)+Number(await C(`document.querySelector('#cabin-stage').dataset.studyElapsed`));assert.equal(sum,300,'elapsed and remaining use the same session clock');
 await p.evaluate(`document.querySelector('#pause').click();document.querySelector('#landscape-view').click()`);await sleep(2200);await p.evaluate(`document.querySelector('#cabin-view').click()`);await sleep(700);assert.ok(Number(await C(`document.querySelector('#cabin-stage').dataset.studyElapsed`))>=elapsed+2);assert.equal(await C(`document.querySelector('#cabin-stage').dataset.cameraMode`),'study');
 await C(`document.querySelector('#cabin-stand').click();document.querySelector('canvas').focus()`);await sleep(100);await p.send('Input.dispatchKeyEvent',{type:'keyDown',key:'d',code:'KeyD',windowsVirtualKeyCode:68});await sleep(500);await p.send('Input.dispatchKeyEvent',{type:'keyUp',key:'d',code:'KeyD',windowsVirtualKeyCode:68});await sleep(200);assert.equal(await C(`document.querySelector('#cabin-stage').dataset.candidate`),'B10');await C(`document.querySelector('#cabin-sit').click()`);assert.ok(await waitFor(p,`document.querySelector('#cabin-root').dataset.seat==='B10'`,15000));await sleep(1800);
 const b=await C(`JSON.parse(document.querySelector('canvas').dataset.camera)`);assert.ok(b.position[0]<0&&b.target[0]>0);await p.screenshot(`${out}/02-right-bench.png`);
 await p.evaluate(`document.querySelector('#pause').click()`);
 const layouts=[];
 for(const[width,height]of[[1440,900],[1366,650],[390,844],[844,390]]){
  await p.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await sleep(1200);
  const box=await C(`(()=>{const r=document.querySelector('#cabin-study-clock').getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,hidden:document.querySelector('#cabin-study-clock').hidden}})()`);assert.equal(box.hidden,false);assert.ok(box.left>=0&&box.right<=width&&box.top>=0&&box.bottom<=height);layouts.push({width,height,...box});await p.screenshot(`${out}/layout-${width}-${height}.png`);
 }
 assert.deepEqual(p.errors,[]);await fs.writeFile(`${out}/results.json`,JSON.stringify({leftCamera:a,rightCamera:b,layouts,errors:p.errors,checks:['no clock before departure','frontal camera on both bench sides','elapsed time above head','paused time excluded','window switching retains elapsed time','standing and reseating stay available','responsive badge']},null,2));console.log('PASS: frontal study camera, elapsed clock, pause/resume, screen switching and both seat sides');
}finally{p.close();}
