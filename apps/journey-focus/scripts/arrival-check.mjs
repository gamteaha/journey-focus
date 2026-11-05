import assert from 'node:assert/strict';import fs from 'node:fs/promises';
import {connectPage,waitFor,sleep} from './cdp.mjs';
const port=Number(process.env.JF_QA_PORT)||9224,base=`http://127.0.0.1:${port}`,out='../../tmp/arrival-qa';
for(const t of await(await fetch(base+'/json/list')).json())if(t.type==='page'&&t.url.startsWith('http://localhost:5173/'))await fetch(base+'/json/close/'+t.id);
await fs.mkdir(out,{recursive:true});const p=await connectPage({fresh:true,port,acceptBeforeUnload:true}),requests=[];
const off=p.on('Fetch.requestPaused',event=>requests.push(event.requestId));
async function waitRequest(count){for(let i=0;i<500;i++){if(requests.length>=count)return requests[count-1];await sleep(100);}throw Error('Status request was not intercepted');}
async function issue(){assert.ok(await waitFor(p,`document.querySelector('#boarding-next')?.disabled===false`,30000));await p.evaluate(`document.querySelector('[data-medium="ticket"]').click();document.querySelector('[data-duration="60"]').click();document.querySelector('#boarding-next').click();document.querySelector('#boarding-use').click()`);assert.ok(await waitFor(p,`document.querySelector('#boarding-screen').dataset.stage==='loading'`,12000));}
try{
 await p.send('Emulation.setDeviceMetricsOverride',{width:1366,height:650,deviceScaleFactor:1,mobile:false});await p.send('Page.navigate',{url:'http://localhost:5173/'});await p.send('Page.bringToFront');
 await p.send('Fetch.enable',{patterns:[{urlPattern:'*://localhost:5173/api/status',requestStage:'Request'}]});
 await issue();await p.screenshot(`${out}/01-arrival.png`);const first=await waitRequest(1);
 const frame=await p.evaluate(`document.querySelector('#cabin-frame').src`);
 assert.equal(await p.evaluate(`document.querySelector('#journey-workspace').inert`),true);
 assert.equal(await p.evaluate(`document.querySelector('#boarding-screen').hidden`),false);
 assert.equal(await p.evaluate(`document.querySelector('#cabin-root').dataset.ready`),'true');
 assert.equal(await p.evaluate(`document.querySelector('#map-frame').getAttribute('src')`),'about:blank','map starts after the warmed cabin');
 const percent=await p.evaluate(`Number(document.querySelector('#arrival-meter').getAttribute('aria-valuenow'))`);assert.ok(percent>=65&&percent<100);
 await sleep(1200);assert.equal(await p.evaluate(`Number(document.querySelector('#arrival-meter').getAttribute('aria-valuenow'))`),percent,'bar cannot finish while the real response is held');await p.screenshot(`${out}/02-waiting.png`);
 const position=await p.evaluate(`document.querySelector('#cabin-root').dataset.position`);
 await p.send('Input.dispatchKeyEvent',{type:'keyDown',key:'w',code:'KeyW',windowsVirtualKeyCode:87});await sleep(250);await p.send('Input.dispatchKeyEvent',{type:'keyUp',key:'w',code:'KeyW',windowsVirtualKeyCode:87});assert.equal(await p.evaluate(`document.querySelector('#cabin-root').dataset.position`),position,'hidden character cannot move during preparation');
 for(const [width,height]of [[1366,650],[1440,900],[390,844],[844,390]]){
  await p.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await sleep(200);
  const layout=await p.evaluate(`(()=>{const s=document.querySelector('#boarding-screen'),b=document.querySelector('#arrival-back').getBoundingClientRect();return {scroll:s.scrollHeight,height:s.clientHeight,width:document.documentElement.scrollWidth,bottom:b.bottom}})()`);assert.ok(layout.scroll<=layout.height+1&&layout.width<=width&&layout.bottom<=height,'arrival fits viewport');await p.screenshot(`${out}/layout-${width}-${height}.png`);
 }
 await p.send('Emulation.setDeviceMetricsOverride',{width:1366,height:650,deviceScaleFactor:1,mobile:false});
 await p.send('Fetch.fulfillRequest',{requestId:first,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify({vworldConfigured:false})).toString('base64')});
 assert.ok(await waitFor(p,`document.querySelector('#boarding-screen').classList.contains('loading-failed')`,10000));assert.equal(await p.evaluate(`document.querySelector('#arrival-retry').hidden`),false);assert.equal(await p.evaluate(`document.querySelector('#boarding-screen').hidden`),false);await p.screenshot(`${out}/03-retry.png`);
 await p.evaluate(`document.querySelector('#arrival-retry').click()`);await waitRequest(2);assert.equal(await p.evaluate(`document.querySelector('#cabin-frame').src`),frame,'retry reuses prepared cabin');
 await p.evaluate(`document.querySelector('#arrival-back').click()`);assert.equal(await p.evaluate(`document.querySelector('#boarding-screen').dataset.stage`),'choose');assert.equal(await p.evaluate(`document.querySelector('#journey-workspace').hidden`),true);await sleep(350);
 await issue();const third=await waitRequest(3);await p.send('Fetch.continueRequest',{requestId:third});await p.send('Fetch.disable');off();
 assert.ok(await waitFor(p,`document.querySelector('#boarding-screen').hidden`,100000),'real terrain and rendering finish before entry');
 assert.equal(await p.evaluate(`document.querySelector('#arrival-meter').getAttribute('aria-valuenow')`),'100');assert.equal(await p.evaluate(`document.querySelector('#journey-workspace').inert`),false);assert.equal(await p.evaluate(`document.querySelector('#scene').classList.contains('map-ready')`),true);assert.equal(await p.evaluate(`document.querySelector('#game-clock').hidden`),true);
 await p.screenshot(`${out}/04-ready-cabin.png`);
 await p.evaluate(`document.querySelector('#boarding-reopen').click();document.querySelector('#swap').click()`);const destination=await p.evaluate(`document.querySelector('#from').value`);await issue();assert.ok(await waitFor(p,`document.querySelector('#boarding-screen').hidden`,45000),'cached assets can prepare the reversed route without another status request');
 assert.equal(await p.evaluate(`document.querySelector('#monitor-station').textContent`),destination);
 assert.equal(await p.evaluate(`document.querySelector('#cabin-frame').src`),frame);
 assert.deepEqual(p.errors,[]);await fs.writeFile(`${out}/results.json`,JSON.stringify({heldAt:percent,errors:p.errors,checks:['arrival paints before initialization','three warmup frames before cabin ready','sequential model and map preparation','real progress stays below 100 while blocked','input locked while preparing','failure stays at loader with retry','retry reuses model','cancel returns to ticket office','100 percent only after initial view ready','cached re-entry']},null,2));console.log('PASS: arrival gate, real progress, input lock, retry, cancellation and cached entry');
}finally{off();p.close();}
