// Run against an isolated Chrome profile with remote debugging enabled.
// node scripts/passport-dialog-smoke.mjs http://localhost:5173 9224
import assert from 'node:assert/strict';
import {connectPage,waitFor,sleep} from './cdp.mjs';
const base=process.argv[2]||'http://localhost:5173';
const p=await connectPage({fresh:true,port:Number(process.argv[3]||9224)});
async function click(selector){
 const point=await p.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 await p.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
 await p.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
}
async function visibleDialog(id){
 assert(await waitFor(p,`document.getElementById('${id}')?.open`,3000),id+' not open');
 assert(await p.evaluate(`(()=>{const d=document.getElementById('${id}'),r=d.getBoundingClientRect(),s=getComputedStyle(d);return s.display!=='none'&&s.visibility==='visible'&&r.width>100&&r.height>100&&r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1&&d.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})()`),id+' is open but invisible or unreachable');
}
try{
 await p.send('Page.navigate',{url:base+'/'});
 assert(await waitFor(p,"!!document.getElementById('atlas-passport')",15000));
 const original=await p.evaluate(`localStorage.getItem('journey-focus-passport-v1')`);
 try{
  await p.evaluate(`localStorage.removeItem('journey-focus-passport-v1')`);
  for(const width of [1440,390]){
   await p.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<800});
   await click('[data-place=oasis]');await click('#atlas-continue');await visibleDialog('travel-passport');
   await p.screenshot(`../../tmp/locked-map-dialog-${width}.png`);
   await click('#travel-passport [data-close]');
   assert(await p.evaluate(`!document.getElementById('travel-passport').open`));
   await click('[data-place=seoul]');
   assert.equal(await p.evaluate(`document.getElementById('atlas-name').textContent`),'서울');
   await click('#atlas-passport');await visibleDialog('travel-passport');
   await p.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
   await p.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
   await sleep(100);assert(await p.evaluate(`!document.getElementById('travel-passport').open`));
  }
  await p.evaluate(`(async()=>{const m=await import('/passport.mjs');for(const destination of ['seoul','songdo','swiss','desert','oasis'])m.saveReceipt({id:'dialog-fixture-'+destination,destination,from:'출발',to:'도착',elapsed:300,completed:true});})()`);
  await click('#atlas-world');await visibleDialog('world-departure');await click('#world-departure [data-close]');
  assert.deepEqual(p.errors,[]);
  console.log('PASS: locked map and passport dialogs visible, pointer close, Escape, usable destination buttons, unlocked world dialog on desktop/mobile');
 }finally{await p.evaluate(`localStorage.${original===null?'removeItem(\'journey-focus-passport-v1\')':'setItem(\'journey-focus-passport-v1\','+JSON.stringify(original)+')'}`);}
}finally{p.close();}
