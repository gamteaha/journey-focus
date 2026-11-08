// Use an isolated Chrome profile with remote debugging. Run from the repository root.
// node apps/journey-focus/scripts/keepsake-smoke.mjs http://localhost:5173 9224
import {connectPage,waitFor,sleep} from './cdp.mjs';import assert from 'node:assert/strict';import fs from 'node:fs';
const base=process.argv[2]||'http://localhost:5173',p=await connectPage({fresh:true,port:Number(process.argv[3]||9224)});
await p.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
await p.send('Page.navigate',{url:base+'/'});assert(await waitFor(p,"!!document.getElementById('atlas-passport')",15000));
const previous=await p.evaluate(`localStorage.getItem('journey-focus-passport-v1')`),previousSound=await p.evaluate(`localStorage.getItem('journey-focus-boarding-sound')`);
try{
await p.evaluate(`localStorage.removeItem('journey-focus-passport-v1');(async()=>{const m=await import('/passport.mjs');for(const [id,destination,elapsed]of [['k1','seoul',1500],['k2','songdo',300],['k3','swiss',900]])m.saveReceipt({id,destination,from:'출발',to:'도착',elapsed,completed:true});m.showPassport();})()`);
assert(await waitFor(p,"!!document.getElementById('passport-cover')",3000));await p.screenshot('tmp/passport-book-cover.png');
await p.evaluate(`document.getElementById('passport-cover').click()`);await sleep(650);await p.screenshot('tmp/passport-book-open.png');
assert(await p.evaluate(`document.querySelector('.passport-pages').getBoundingClientRect().height>200`));
await p.evaluate(`document.querySelector('.stamp-replay').click();document.querySelector('.personal-ranking').open=true`);assert(await p.evaluate(`document.querySelector('.stamp-pop')!==null`));
assert.match(await p.evaluate(`document.querySelector('.personal-ranking').innerText`),/25分|25분/);
for(const width of [390,760]){await p.send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width===390});await sleep(150);assert(await p.evaluate(`document.getElementById('travel-passport').scrollWidth<=document.getElementById('travel-passport').clientWidth`));await p.screenshot('tmp/passport-book-'+width+'.png');}
await p.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
await p.evaluate(`document.getElementById('travel-passport').close();(async()=>{const m=await import('/passport.mjs');m.showCompletion(m.saveReceipt({id:'k4',destination:'desert',from:'모래바람역',to:'별빛 사막선',elapsed:1800,completed:true}));})()`);
assert(await waitFor(p,"!!document.getElementById('learning-share')",3000));await sleep(1200);await p.screenshot('tmp/flame-stamp-complete.png');
fs.mkdirSync('tmp',{recursive:true});const downloadDir=fs.mkdtempSync('tmp/share-card-');await p.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:fs.realpathSync(downloadDir)});
await p.evaluate(`Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false});document.getElementById('learning-share').click()`);assert(await waitFor(p,"document.getElementById('learning-share-status').textContent.includes('저장했어요')",5000));
await sleep(600);assert(fs.existsSync(downloadDir+'/journey-focus-study.png'));
// Exercise native sharing and cancellation without sending to another person.
await p.evaluate(`Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.qaShare=data.files[0].size;}});document.getElementById('learning-share').click()`);assert(await waitFor(p,"document.getElementById('learning-share-status').textContent==='공유했어요.'",5000));assert(await p.evaluate(`qaShare>10000`));
await p.evaluate(`Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new DOMException('Cancelled','AbortError')}});document.getElementById('learning-share').click()`);assert(await waitFor(p,"document.getElementById('learning-share-status').textContent.includes('취소')",5000));
await p.evaluate(`document.getElementById('travel-complete').close();localStorage.setItem('journey-focus-boarding-sound','on');(async()=>{const m=await import('/arrival-audio.mjs');window.qaSpeech=[];Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[],speak:u=>qaSpeech.push(u.text),cancel:()=>{}}});const root=document.createElement('div');root.id='qa-arrival';document.body.append(root);m.mountArrivalAudio(root,'건대입구');root.querySelector('[data-announcement-mute]').click();root.querySelector('button').click();})()`);
assert(await waitFor(p,"window.qaSpeech?.length===2",3000));assert.match(await p.evaluate('qaSpeech[0]'),/지금 건대입구행 열차가 들어오고 있습니다/);
assert(await p.evaluate(`(async()=>{Object.defineProperty(window,'speechSynthesis',{configurable:true,value:undefined});const m=await import('/arrival-audio.mjs'),status=document.querySelector('#qa-arrival p');return m.speakArrival('서울',{status})===false&&status.textContent.includes('지원하지');})()`));
assert.deepEqual(p.errors,[]);console.log('PASS: passport cover/open/stamp replay, responsive pages, personal ranking, completion ceremony, PNG/native share/cancel, Korean arrival speech');
}finally{await p.evaluate(`for(const [key,value] of ${JSON.stringify([['journey-focus-passport-v1',previous],['journey-focus-boarding-sound',previousSound]])}){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}`);p.close();}
