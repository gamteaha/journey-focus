import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {connectPage,waitFor,sleep} from './cdp.mjs';
const p=await connectPage({fresh:true,port:9224,acceptBeforeUnload:true}),out='../../tmp/ticket-editor-qa';await fs.mkdir(out,{recursive:true});
async function click(selector){const r=await p.evaluate(`document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect().toJSON()`),x=r.x+r.width/2,y=r.y+r.height/2;await p.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await p.send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});}
const bounds=()=>p.evaluate(`(()=>{const ticket=document.querySelector('#boarding-pass').getBoundingClientRect(),main=document.querySelector('#boarding-pass>.pass-main').getBoundingClientRect(),stub=document.querySelector('#boarding-pass>.pass-stub').getBoundingClientRect(),fields=document.querySelector('#card-journey-fields'),lower=document.querySelector('.boarding-lower').getBoundingClientRect();const controls=[...fields.querySelectorAll('input,select,button')].filter(e=>e.getBoundingClientRect().width>0).map(e=>({id:e.id||e.dataset.timeStep||e.dataset.duration,rect:e.getBoundingClientRect().toJSON()}));return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,ticket:ticket.toJSON(),main:main.toJSON(),stub:stub.toJSON(),inside:document.querySelector('#boarding-pass>.pass-main').contains(fields),charactersInside:document.querySelector('.pass-stub').contains(document.querySelector('.boarding-characters')),lowerTop:lower.top,screen:document.querySelector('#boarding-screen').getBoundingClientRect().toJSON(),innerHeight:document.querySelector('#boarding-screen').clientHeight,innerScroll:document.querySelector('#boarding-screen').scrollHeight,decorations:[...document.querySelectorAll('#boarding-pass .city-stamp,#boarding-pass .seoul-ticket-art,#boarding-pass .ticket-sticker')].map(e=>e.getBoundingClientRect().toJSON()).filter(r=>r.width>0),controls};})()`);
try{
 await p.send('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.clear();sessionStorage.clear();'});await p.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});await p.send('Page.navigate',{url:'http://localhost:5173/'});await p.send('Page.bringToFront');
 assert.ok(await waitFor(p,`document.querySelector('#boarding-next')?.disabled===false`,35000));
 const layouts=[];
 for(const [width,height]of [[1440,900],[1366,650],[1280,720],[900,700],[390,844],[320,740]]){
  await p.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await sleep(180);
  for(const unlimited of [false,true]){
   await p.evaluate(`document.querySelector('#duration-${unlimited?'unlimited':'finite'}').click()`);await sleep(100);const layout=await bounds();
   assert.ok(layout.inside&&layout.charactersInside);assert.ok(layout.scrollWidth<=width,JSON.stringify(layout));
   for(const decoration of layout.decorations){for(const c of layout.controls)assert.ok(decoration.right<=c.rect.left||decoration.left>=c.rect.right||decoration.bottom<=c.rect.top||decoration.top>=c.rect.bottom,'City decoration overlaps a control');}
   for(const c of layout.controls){assert.ok(c.rect.left>=layout.ticket.left-1&&c.rect.right<=layout.ticket.right+1&&c.rect.top>=layout.ticket.top-1&&c.rect.bottom<=layout.ticket.bottom+1,JSON.stringify({width,height,control:c,ticket:layout.ticket}));}
   if(width>=800){assert.ok(layout.ticket.bottom<=layout.lowerTop+1,JSON.stringify(layout));assert.ok(layout.innerScroll<=layout.innerHeight+1,JSON.stringify(layout));assert.ok(Math.abs(layout.ticket.width/layout.ticket.height-1120/520)<.01);}
   layouts.push({...layout,unlimited});await p.screenshot(`${out}/layout-${width}-${unlimited?'unlimited':'finite'}.png`);
  }
 }
 await p.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});await p.evaluate(`document.querySelector('#duration-finite').click();document.querySelector('[data-duration="1500"]').click()`);await sleep(150);
 await click('[data-time-step="60"]');assert.equal(await p.evaluate(`document.querySelector('#focus-minutes').value`),'26');
 await click('[data-character="amber"]');assert.equal(await p.evaluate(`document.querySelector('[data-character="amber"]').getAttribute('aria-pressed')`),'true');
 await click('[data-medium="card"]');assert.equal(await p.evaluate(`document.querySelector('#boarding-pass').contains(document.querySelector('#card-journey-fields'))`),false);
 await click('[data-medium="ticket"]');assert.equal((await bounds()).inside,true);assert.equal(await p.evaluate(`document.querySelector('#focus-minutes').value`),'26');
 assert.equal(await p.evaluate(`document.querySelector('#boarding-pass .seoul-ticket-art').complete&&document.querySelector('#boarding-pass .seoul-ticket-art').naturalWidth>0`),true);
 await p.screenshot(`${out}/01-ticket-editor.png`);await click('#boarding-next');assert.equal(await p.evaluate(`document.querySelector('#boarding-screen').dataset.stage`),'inspect');
 assert.match(await p.evaluate(`document.querySelector('#boarding-receipt').textContent`),/26분/);assert.match(await p.evaluate(`document.querySelector('#boarding-receipt').textContent`),/앰버/);
 await p.screenshot(`${out}/02-issued-ticket.png`);assert.deepEqual(p.errors,[]);await fs.writeFile(`${out}/results.json`,JSON.stringify({layouts,errors:p.errors,checks:['route and time inside ticket','character controls in stub','finite and unlimited','all controls within paper','desktop viewport fit','mobile reflow','mouse stepper under zoom','medium switch preserves choices','issued ticket reflects controls']},null,2));
 console.log('PASS: route/time/character editing inside the ticket, viewport fit, finite/unlimited, zoomed input and preserved paper/card switching');
}catch(error){await p.screenshot(`${out}/failure.png`);console.error(JSON.stringify({errors:p.errors}));throw error;}finally{p.close();}
