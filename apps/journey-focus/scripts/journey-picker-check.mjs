import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {connectPage,waitFor,sleep} from './cdp.mjs';
const p=await connectPage({fresh:true,port:9224,acceptBeforeUnload:true}),out='../../tmp/journey-picker-qa';
await fs.mkdir(out,{recursive:true});
const setTime=(h,m)=>p.evaluate(`(()=>{const h=document.querySelector('#focus-hours'),m=document.querySelector('#focus-minutes');h.value='${h}';m.value='${m}';m.dispatchEvent(new Event('input',{bubbles:true}));})()`);
try{
 await p.send('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.clear();sessionStorage.clear();'});
 await p.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
 await p.send('Page.navigate',{url:'http://localhost:5173/'});
 await p.send('Page.bringToFront');
 assert.ok(await waitFor(p,`document.querySelector('#boarding-next')?.disabled===false`,35000));
 assert.equal(await p.evaluate(`document.querySelector('#from').options.length`),43);
 await p.screenshot(`${out}/01-ticket-25min.png`);
 const destinations=[];
 for(const [h,m,to,count]of [[0,25,'건대입구',1],[1,0,'구의',2],[1,30,'신당',5],[2,0,'동대문역사문화공원',6]]){
  await setTime(h,m);assert.equal(await p.evaluate(`document.querySelector('#to').value`),to);
  assert.equal(await p.evaluate(`document.querySelector('#recommended-count').textContent`),count+'개');
  destinations.push({minutes:h*60+m,to,count});
 }
 await setTime(1,30);await p.screenshot(`${out}/02-ticket-90min.png`);
 await p.evaluate(`document.querySelector('#to').value='건대입구';document.querySelector('#to').dispatchEvent(new Event('change'));`);
 assert.equal(await p.evaluate(`document.querySelector('#recommend-apply').disabled`),false);
 await p.evaluate(`document.querySelector('#recommend-apply').click()`);assert.equal(await p.evaluate(`document.querySelector('#to').value`),'신당');
 await p.evaluate(`document.querySelector('[data-time-step="3600"]').click()`);
 assert.equal(await p.evaluate(`document.querySelector('#focus-hours').value+':'+document.querySelector('#focus-minutes').value`),'02:00');
 await setTime(0,37);assert.equal(await p.evaluate(`JSON.parse(localStorage.getItem('journey-focus-preferences')).duration`),2220);
 await p.evaluate(`const m=document.querySelector('#focus-minutes');m.focus();document.querySelector('#focus-hours').value='2';m.value='1';m.dispatchEvent(new Event('input'));`);
 assert.equal(await p.evaluate(`document.querySelector('#boarding-next').disabled`),true);
 await p.evaluate(`document.querySelector('#focus-minutes').blur()`);
 assert.equal(await p.evaluate(`document.querySelector('#boarding-next').disabled`),false);
 await setTime(1,30);
 const layouts=[];
 for(const [width,height]of [[1440,900],[1366,650],[1280,720],[390,844],[768,1024]])for(const medium of ['ticket','card']){
  await p.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  await p.evaluate(`document.querySelector('[data-medium="${medium}"]').click()`);await sleep(180);
  const layout=await p.evaluate(`(()=>{const s=document.querySelector('#boarding-screen'),r=document.querySelector('#boarding-next').getBoundingClientRect(),c=document.querySelector('.duration-console').getBoundingClientRect(),ticket=document.querySelector('#boarding-pass').getBoundingClientRect();return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,innerScroll:s.scrollHeight,innerHeight:s.clientHeight,buttonBottom:r.bottom,consoleWidth:c.width,consoleRight:c.right,fieldsBottom:document.querySelector('.journey-booking-fields').getBoundingClientRect().bottom,lowerTop:document.querySelector('.boarding-lower').getBoundingClientRect().top,documentHeight:document.documentElement.scrollHeight,ratio:ticket.width/ticket.height}})()`);
  assert.ok(layout.scrollWidth<=width,JSON.stringify(layout));assert.ok(layout.consoleRight<=width,JSON.stringify(layout));
  if(width>=1000)assert.ok(layout.buttonBottom<=height&&layout.innerScroll<=layout.innerHeight+1&&layout.documentHeight<=height&&layout.fieldsBottom<=layout.lowerTop-7,JSON.stringify(layout));
  assert.ok(Math.abs(layout.ratio-(medium==='card'?269.9/428:700/325))<.01);
  layouts.push({...layout,medium});await p.screenshot(`${out}/layout-${width}-${medium}.png`);
 }
 await p.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
 await p.evaluate(`document.querySelector('[data-medium="ticket"]').click()`);await setTime(1,30);
 await p.evaluate(`document.querySelector('#boarding-next').click()`);
 assert.equal(await p.evaluate(`document.querySelector('#boarding-screen').dataset.stage`),'inspect');
 assert.ok((await p.evaluate(`document.querySelector('#boarding-receipt').textContent`)).includes('신당'));
 assert.ok((await p.evaluate(`document.querySelector('#boarding-receipt').textContent`)).includes('1시간 30분'));
 await p.screenshot(`${out}/03-issued-90min.png`);
 assert.deepEqual(p.errors,[]);await fs.writeFile(`${out}/results.json`,JSON.stringify({destinations,layouts,errors:p.errors},null,2));
 console.log('PASS: hour/minute inputs, real destination recommendations, minute persistence, bounds, ticket issue and responsive paper/card proportions');
}catch(error){await p.screenshot(`${out}/failure.png`);console.error(await p.evaluate(`JSON.stringify({hours:document.querySelector('#focus-hours').value,minutes:document.querySelector('#focus-minutes').value,active:document.activeElement.id,status:document.querySelector('#boarding-status').textContent,errors:${JSON.stringify(p.errors)}})`));throw error;}finally{p.close();}
