import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {connectPage,waitFor,sleep} from './cdp.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const p=await connectPage({fresh:true});
try{
 await p.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1080,deviceScaleFactor:1,mobile:false});
 await p.send('Page.navigate',{url:'http://localhost:5173/'});
 assert.ok(await waitFor(p,`document.querySelector('#scene')?.classList.contains('map-ready')&&document.querySelector('#start')?.disabled===false`,55000));
 const modes={light:[.75,3,128],balanced:[1,1.7,256],cinematic:[1.25,1,384]};
 for(const [mode,budget]of Object.entries(modes)){
  await p.evaluate(`(()=>{const s=document.querySelector('#render-quality');s.value='${mode}';s.dispatchEvent(new Event('change'))})()`);
  assert.ok(await waitFor(p,`document.querySelector('#map-frame').contentWindow.ws3d.viewer.resolutionScale===${budget[0]}`,4000));
  const actual=await p.evaluate(`(()=>{const v=document.querySelector('#map-frame').contentWindow.ws3d.viewer;return[v.resolutionScale,v.scene.globe.maximumScreenSpaceError,v.scene.globe.tileCacheSize]})()`);
  assert.deepEqual(actual,budget,`${mode} real SDK budget`);
 }
 await p.send('Page.reload');await sleep(300);
 assert.ok(await waitFor(p,`document.querySelector('#scene')?.classList.contains('map-ready')&&document.querySelector('#start')?.disabled===false`,55000));
 assert.equal(await p.evaluate(`document.querySelector('#render-quality').value`),'cinematic','Rendering preference survives reload');
 await p.evaluate(`document.querySelector('[data-duration="60"]').click();document.querySelector('#start').click();document.querySelector('#map-frame').focus()`);
 await p.send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});
 await sleep(250);
 assert.ok(await p.evaluate(`document.querySelector('#pause').textContent.includes('이어가기')`),'Space from focused map pauses');
 for(let i=0;i<3;i++)await p.send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32,autoRepeat:true});
 await p.send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
 assert.ok(await p.evaluate(`document.querySelector('#pause').textContent.includes('이어가기')`),'Holding space does not resume');
 await p.evaluate(`document.querySelector('#stop').click();document.querySelector('#dialog-close').click()`);
 for(const [width,height] of [[360,900],[390,900],[768,900],[1366,768],[1440,900]]){
  await p.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<768});await sleep(150);
  assert.equal(await p.evaluate('document.documentElement.scrollWidth>innerWidth'),false,`${width}px has no overflow`);
  if(width>1100)assert.ok(await p.evaluate(`['start','timer'].every(id=>{const r=document.getElementById(id).getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})`),`${width}x${height} primary controls fit the first viewport`);
  await p.evaluate(`document.querySelector('#focus-button').click()`);
  assert.ok(await p.evaluate(`(()=>{const r=document.querySelector('#focus-button').getBoundingClientRect();return r.width>0&&r.top>=0&&r.bottom<=innerHeight})()`),'Focus exit stays visible');
  await p.evaluate(`document.querySelector('#focus-button').click()`);
 }
 await p.evaluate(`const s=document.querySelector('#render-quality');s.value='auto';s.dispatchEvent(new Event('change'))`);
 await waitFor(p,`document.querySelector('#map-frame').contentWindow.ws3d.viewer.scene.globe.tilesLoaded`,20000);await sleep(300);
 await p.screenshot(path.join(root,'tmp/journey-focus-release-desktop.png'));
 await p.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await sleep(200);
 await p.screenshot(path.join(root,'tmp/journey-focus-release-mobile.png'));
 assert.equal(p.errors.length,0,'No browser errors');
 console.log(JSON.stringify({passed:['real rendering budgets','preference restore','map-focused space','held space','360/390/768/1366/1440 layout','laptop first-fold controls','focus exit visibility'],pageErrors:p.errors.length}));
}catch(error){console.log(JSON.stringify({failed:error.message,pageErrors:p.errors.length}));process.exitCode=1;}
finally{p.close();}
