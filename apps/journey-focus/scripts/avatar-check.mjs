import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {connectPage,waitFor,sleep} from './cdp.mjs';
import {boardTrain} from './boarding-flow.mjs';
const p=await connectPage({fresh:true,port:Number(process.env.JF_QA_PORT)||9224,acceptBeforeUnload:true});
const out='../../tmp/avatar-qa';await fs.mkdir(out,{recursive:true});let session;
const C=expression=>p.evaluate(expression,session);
try{
 await p.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
 await p.send('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.clear();sessionStorage.clear();'});
 await p.send('Page.navigate',{url:'http://localhost:5173/'});await boardTrain(p,{duration:300,character:'blue'});
 const target=(await p.send('Target.getTargets')).targetInfos.find(t=>t.type==='iframe'&&t.url.includes('/cabin-frame'));
 session=(await p.send('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;await p.send('Runtime.enable',{},session);
 assert.equal(await C(`document.querySelector('#cabin-stage').dataset.avatar`),'blue-flame.glb');
 await C(`document.querySelector('canvas').focus()`);
 await p.send('Input.dispatchKeyEvent',{type:'keyDown',key:'w',code:'KeyW',windowsVirtualKeyCode:87});await sleep(500);
 assert.equal(await C(`document.querySelector('#cabin-stage').dataset.avatarPose`),'Walk');
 await p.screenshot(`${out}/01-walking.png`);
 await p.send('Input.dispatchKeyEvent',{type:'keyUp',key:'w',code:'KeyW',windowsVirtualKeyCode:87});await sleep(400);
 assert.equal(await C(`document.querySelector('#cabin-stage').dataset.avatarPose`),'Idle');
 await C(`document.querySelector('#cabin-sit').click()`);
 assert.ok(await waitFor(p,`Boolean(document.querySelector('#cabin-root').dataset.seat)`,15000));
 await p.evaluate(`document.querySelector('#start').click()`);assert.ok(await waitFor(p,`document.body.classList.contains('running')`,5000));await sleep(1600);
 await p.evaluate(`document.querySelector('#pause').click()`);
 const palettes=[];
 for(const id of ['blue','mint','amber']){
  await p.evaluate(`(()=>{const frame=document.querySelector('#cabin-frame');frame.contentWindow.postMessage({type:'jf:cabin-configure',character:'${id}'},new URL(frame.src).origin);})()`);
  await sleep(1000);
  assert.equal(await C(`document.querySelector('#cabin-stage').dataset.character`),id);
  assert.equal(await C(`document.querySelector('#cabin-stage').dataset.avatarPose`),'Sit');
  await p.screenshot(`${out}/seated-${id}.png`);palettes.push(id);
 }
 await p.evaluate(`(()=>{const frame=document.querySelector('#cabin-frame');frame.contentWindow.postMessage({type:'jf:cabin-configure',character:'blue'},new URL(frame.src).origin);})()`);
 assert.deepEqual(p.errors,[]);
 await fs.writeFile(`${out}/results.json`,JSON.stringify({model:'blue-flame.glb',palettes,checks:['supplied skinned model','walking','idle','sitting','three colour variants','departure clock'],errors:p.errors},null,2));
 console.log('PASS: supplied character model, Idle/Walk/Sit and blue/mint/amber in the real cabin');
}finally{p.close();}
