import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {connectPage,waitFor,sleep} from './cdp.mjs';
import {boardTrain} from './boarding-flow.mjs';
const p=await connectPage({fresh:true,port:9224,acceptBeforeUnload:true}),out='../../tmp/weather-qa';await fs.mkdir(out,{recursive:true});
const state=()=>p.evaluate(`(()=>{const e=document.querySelector('#window-weather'),r=e.getBoundingClientRect(),s=document.querySelector('#scene').getBoundingClientRect();return {hidden:e.hidden,mode:e.dataset.mode,animating:e.dataset.animating,frames:Number(e.dataset.frames||0),blur:getComputedStyle(e.querySelector('.weather-frost')).backdropFilter,pointer:getComputedStyle(e).pointerEvents,width:e.querySelector('canvas').width,rect:r.toJSON(),scene:s.toJSON(),fps:document.querySelector('#fps-label').textContent};})()`);
async function weather(mode){await p.evaluate(`document.querySelector('#game-settings-button').click();document.querySelector('[data-weather="${mode}"]').click();document.querySelector('#game-settings-close').click();`);await sleep(300);}
try{
 await p.send('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.clear();sessionStorage.clear();'});
 await p.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
 await p.send('Page.navigate',{url:'http://localhost:5173/'});await p.send('Page.bringToFront');
 assert.ok(await waitFor(p,`document.querySelector('#boarding-next')?.disabled===false`,35000));
 assert.equal((await state()).hidden,true);
 await boardTrain(p,{duration:300});
 assert.equal((await state()).animating,'false');
 const target=(await p.send('Target.getTargets')).targetInfos.find(t=>t.type==='iframe'&&t.url.includes('/cabin-frame'));
 const cabin=(await p.send('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;await p.send('Runtime.enable',{},cabin);
 await p.evaluate(`document.querySelector('#cabin-sit').click()`,cabin);
 assert.ok(await waitFor(p,`!document.querySelector('#landscape-view').disabled`,15000));
 await p.evaluate(`document.querySelector('#landscape-view').click()`);
 assert.ok(await waitFor(p,`document.querySelector('#window-weather').hidden===false`,5000));await sleep(2500);
 const compared=[];
 for(const [mode,file]of [['clear','01-clear.png'],['rain','02-rain.png'],['mist','03-mist.png']]){
  await weather(mode);const s=await state();assert.equal(s.mode,mode);assert.equal(s.hidden,mode==='clear');
  assert.equal(s.pointer,'none');if(mode!=='clear'){assert.ok(s.width<=1000);assert.ok(s.rect.bottom<=s.scene.bottom-61);assert.equal(s.animating,'true');}
  if(mode==='mist')assert.ok(s.blur.includes('2.925px'),JSON.stringify(s));
  compared.push(s);await p.screenshot(`${out}/${file}`);
 }
 await p.evaluate(`document.querySelector('#game-settings-button').click();const r=document.querySelector('#weather-humidity');r.value='90';r.dispatchEvent(new Event('input',{bubbles:true}));`);
 assert.equal(await p.evaluate(`document.querySelector('#weather-settings output').value`),'90%');
 assert.deepEqual(await p.evaluate(`JSON.parse(localStorage.getItem('journey-focus-window-weather'))`),{mode:'mist',humidity:90});
 await p.screenshot(`${out}/04-settings.png`);await p.evaluate(`document.querySelector('#game-settings-close').click()`);
 const before=await state();await sleep(1100);const after=await state();assert.ok(after.frames>before.frames);assert.ok(after.frames-before.frames<38,'rain painting stays below 30fps plus timing tolerance');
 await p.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});assert.ok(await waitFor(p,`document.querySelector('#window-weather').dataset.animating==='false'`,5000));const reduced=await state();await sleep(200);assert.equal((await state()).frames,reduced.frames);
 await p.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
 await p.evaluate(`document.querySelector('#cabin-view').click()`);await sleep(150);const paused=await state();await sleep(250);assert.equal((await state()).frames,paused.frames);assert.equal(paused.hidden,true);
 await p.evaluate(`document.querySelector('#landscape-view').click()`);await sleep(200);assert.equal((await state()).hidden,false);
 await weather('clear');const off=await state();await sleep(200);assert.equal((await state()).frames,off.frames);
 await p.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});await weather('mist');await sleep(200);assert.equal(await p.evaluate(`document.documentElement.scrollWidth<=innerWidth`),true);await p.screenshot(`${out}/05-mobile.png`);
 assert.deepEqual(p.errors,[]);await fs.writeFile(`${out}/results.json`,JSON.stringify({compared,framesPerSecond:(after.frames-before.frames)/1.1,errors:p.errors,checks:['real VWorld comparison','controls persist','provider footer clear','no pointer capture','canvas size and frame cap','reduced motion static','inactive cabin and clear stop drawing','mobile fit']},null,2));
 console.log('PASS: actual map clear/rain/mist, humidity controls, bounded drawing, reduced motion, cabin suspension and mobile layout');
}catch(error){await p.screenshot(`${out}/failure.png`);console.error(JSON.stringify({errors:p.errors,state:await state()}));throw error;}finally{p.close();}
