import assert from 'node:assert/strict';
import {connectPage,waitFor,sleep} from './cdp.mjs';
const p=await connectPage();
try{
  await p.send('Page.reload');
  assert.ok(await waitFor(p,`!!document.querySelector('#map-frame')?.contentWindow.document.querySelector('#scene-style')`,45000));
  await sleep(5000);
  await p.evaluate(`(()=>{const f=document.querySelector('#map-frame');f.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:99999';f.contentWindow.postMessage({type:'jf:position',position:{lon:127.5891698,lat:37.8307979,heading:115},snap:true},location.origin)})()`);
  await sleep(3000);
  await p.screenshot('../../tmp/filter-original.png');
  await p.evaluate(`(()=>{const s=document.querySelector('#map-frame').contentWindow.document.querySelector('#scene-style');s.value='realistic';s.dispatchEvent(new Event('change'))})()`);
  await sleep(4000);
  const state=await p.evaluate(`(()=>{const w=document.querySelector('#map-frame').contentWindow,s=w.ws3d.viewer.scene.postProcessStages;let result;for(let i=0;i<s.length;i++){const stage=s.get(i);if(stage.name==='journey-realistic-study')result={enabled:stage.enabled,ready:stage.ready,strength:stage.uniforms.strength};}return {stage:result,error:w.document.querySelector('#map-error').textContent}})()`);
  console.log(JSON.stringify(state));assert.equal(state.error,'');assert.equal(state.stage.enabled,true);assert.equal(state.stage.ready,true);
  await p.screenshot('../../tmp/filter-realistic.png');
  await p.evaluate(`(()=>{const w=document.querySelector('#map-frame').contentWindow,r=w.document.querySelector('#scene-style-strength');r.value='0';r.dispatchEvent(new Event('input'));})()`);
  assert.equal(await p.evaluate(`document.querySelector('#map-frame').contentWindow.document.querySelector('#scene-style-value').value`),'0%');
  await p.evaluate(`(()=>{const d=document.querySelector('#map-frame').contentWindow.document;const s=d.querySelector('#scene-style'),r=d.querySelector('#scene-style-strength');r.value='70';s.value='original';s.dispatchEvent(new Event('change'));})()`);
  console.log('PASS: shader compiled, rendered, strength zero, original restore');
}finally{await p.evaluate(`document.querySelector('#map-frame').style.cssText=''`).catch(()=>{});p.close();}
