import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {connectPage,waitFor,sleep} from './cdp.mjs';
import {boardTrain} from './boarding-flow.mjs';
const p=await connectPage({fresh:true,port:9224,acceptBeforeUnload:true}),out='../../tmp/loop-qa';await fs.mkdir(out,{recursive:true});
let cabinSession;const C=expression=>p.evaluate(expression,cabinSession);
try{
 await p.send('Page.addScriptToEvaluateOnNewDocument',{source:`if(!sessionStorage.getItem('__jfLoopQa')){localStorage.clear();sessionStorage.setItem('__jfLoopQa','1');}window.__qaAdvance=0;const nativeNow=performance.now.bind(performance);performance.now=()=>nativeNow()+window.__qaAdvance;`});
 await p.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});await p.send('Page.navigate',{url:'http://localhost:5173/'});await p.send('Page.bringToFront');
 assert.ok(await waitFor(p,`document.querySelector('#boarding-next')?.disabled===false`,35000));
 assert.equal(await p.evaluate(`document.querySelector('#from').options.length`),43);
 await p.evaluate(`document.querySelector('#duration-unlimited').click()`);
 assert.equal(await p.evaluate(`document.querySelector('#recommended-count').textContent`),'43개 역');
 assert.equal(await p.evaluate(`document.querySelector('#to').disabled`),true);
 assert.equal(await p.evaluate(`JSON.parse(localStorage.getItem('journey-focus-preferences')).duration`),null);
 await p.screenshot(`${out}/01-unlimited-ticket.png`);
 await p.evaluate(`document.querySelector('#from').value='강남';document.querySelector('#from').dispatchEvent(new Event('change'))`);
 assert.equal(await p.evaluate(`document.querySelector('#to').value`),'강남');
 await p.evaluate(`document.querySelector('#duration-finite').click()`);assert.equal(await p.evaluate(`document.querySelector('#to').disabled`),false);
 assert.equal(await p.evaluate(`document.querySelector('#focus-minutes').value`),'25');
 await p.evaluate(`document.querySelector('#from').value='충정로';document.querySelector('#from').dispatchEvent(new Event('change'));document.querySelector('#to').value='을지로입구';document.querySelector('#to').dispatchEvent(new Event('change'))`);
 assert.match(await p.evaluate(`document.querySelector('#route-summary').textContent`),/^3개 역/);
 await p.evaluate(`document.querySelector('#from').value='성수';document.querySelector('#from').dispatchEvent(new Event('change'));document.querySelector('#duration-unlimited').click()`);
 const layouts=[];
 for(const [width,height]of [[1440,900],[1366,650],[1280,720],[390,844]])for(const medium of ['ticket','card']){
  await p.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await p.evaluate(`document.querySelector('[data-medium="${medium}"]').click()`);await sleep(120);
  const layout=await p.evaluate(`(()=>{const s=document.querySelector('#boarding-screen'),fields=document.querySelector('.journey-booking-fields').getBoundingClientRect(),lower=document.querySelector('.boarding-lower').getBoundingClientRect();return{width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,innerScroll:s.scrollHeight,innerHeight:s.clientHeight,fieldsBottom:fields.bottom,lowerTop:lower.top}})()`);
  assert.ok(layout.scrollWidth<=width);if(width>=1000)assert.ok(layout.innerScroll<=layout.innerHeight+1&&layout.fieldsBottom<=layout.lowerTop-5,JSON.stringify(layout));layouts.push({...layout,medium});await p.screenshot(`${out}/layout-${width}-${medium}.png`);
 }
 await p.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
 await boardTrain(p,{duration:null,medium:'ticket'});
 const target=(await p.send('Target.getTargets')).targetInfos.find(t=>t.type==='iframe'&&t.url.includes('/cabin-frame'));cabinSession=(await p.send('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;await p.send('Runtime.enable',{},cabinSession);
 await C(`document.querySelector('#cabin-sit').click()`);assert.ok(await waitFor(p,`Boolean(document.querySelector('#cabin-root').dataset.seat)`,15000));
 await p.evaluate(`document.querySelector('#start').click()`);assert.ok(await waitFor(p,`document.body.classList.contains('running')`,5000));await sleep(1200);
 assert.equal(await C(`document.querySelector('#cabin-stage').dataset.studyUnlimited`),'true');assert.equal(await C(`document.querySelector('#cabin-study-clock').hidden`),false);
 await p.screenshot(`${out}/02-running.png`);
 // Advance the test clock only. No production speed multiplier or debug hook.
 await p.evaluate(`window.__qaAdvance=10800000`);assert.ok(await waitFor(p,`document.querySelector('#game-chrome').dataset.laps==='2'`,5000));
 assert.equal(await p.evaluate(`document.querySelector('#game-chrome').dataset.state`),'running');assert.ok(await C(`Number(document.querySelector('#cabin-stage').dataset.studyElapsed)>=10800`));
 await p.screenshot(`${out}/03-two-laps.png`);
 await p.evaluate(`document.querySelector('#pause').click()`);await sleep(200);const paused=await p.evaluate(`document.querySelector('#timer').textContent`);
 await p.evaluate(`window.__qaAdvance+=3600000`);await sleep(300);assert.equal(await p.evaluate(`document.querySelector('#timer').textContent`),paused);
 await p.evaluate(`document.querySelector('#pause').click()`);await sleep(250);await p.evaluate(`document.querySelector('#stop').click()`);
 const entry=await p.evaluate(`JSON.parse(localStorage.getItem('journey-focus-history'))[0]`);assert.equal(entry.unlimited,true);assert.equal(entry.laps,2);assert.equal(entry.duration,null);assert.ok(entry.elapsed>=10800&&entry.elapsed<10900);assert.equal(entry.completed,false);
 await p.screenshot(`${out}/04-ended-record.png`);
 await p.send('Page.reload');assert.ok(await waitFor(p,`document.querySelector('#boarding-next')?.disabled===false`,35000));
 assert.equal(await p.evaluate(`document.querySelector('#duration-unlimited').getAttribute('aria-pressed')`),'true');assert.equal(await p.evaluate(`document.querySelector('#from').options.length`),43);
 assert.deepEqual(p.errors,[]);await fs.writeFile(`${out}/results.json`,JSON.stringify({entry,layouts,errors:p.errors,checks:['43 stations','unlimited issue','finite mode restored','short arc across City Hall','responsive ticket/card','real cabin badge','two lap boundary','no auto finish after three hours','pause excludes time','manual stop record','unlimited preference reload']},null,2));
 console.log('PASS: 43 stations, unlimited study, two laps, pause/resume, manual stop, elapsed badge, reload and responsive layouts');
}catch(error){await p.screenshot(`${out}/failure.png`);console.error(JSON.stringify({errors:p.errors}));throw error;}finally{p.close();}
