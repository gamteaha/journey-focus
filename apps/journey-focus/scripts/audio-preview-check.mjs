import assert from 'node:assert/strict';
import {connectPage,waitFor,sleep} from './cdp.mjs';
const p=await connectPage({fresh:true});
try{
 // Observe real GainNodes without replacing audio generation or scheduling.
 await p.send('Page.addScriptToEvaluateOnNewDocument',{source:`window.__jfObservedGains=[];const NativeAudioContext=window.AudioContext;window.AudioContext=class extends NativeAudioContext{constructor(...args){super(...args);const create=this.createGain.bind(this);this.createGain=()=>{const gain=create();window.__jfObservedGains.push(gain);return gain}}};`});
 await p.send('Page.navigate',{url:'http://localhost:5173/'});
 assert.ok(await waitFor(p,`document.querySelector('#scene')?.classList.contains('map-ready')&&document.querySelector('#scenery-toggle')?.disabled===false`,55000));
 await p.evaluate(`document.querySelector('#sound-button').click();document.querySelector('#scenery-toggle').click()`);
 assert.ok(await waitFor(p,`document.querySelector('#scenery-play')?.disabled===false`,24000));
 assert.equal(await p.evaluate(`document.querySelector('#sound-button').getAttribute('aria-pressed')`),'true');
 await p.evaluate(`document.querySelector('#scenery-play').click()`);await sleep(500);
 assert.ok(await p.evaluate(`window.__jfObservedGains[0].gain.value>.05`),'Preview playback is audible through the real audio graph');
 await p.evaluate(`document.querySelector('#scenery-play').click()`);await sleep(600);
 assert.ok(await p.evaluate(`window.__jfObservedGains[0].gain.value<.05`),'Preview pause fades sound');
 await p.evaluate(`const range=document.querySelector('#scenery-progress');range.value=950;range.dispatchEvent(new Event('input'));document.querySelector('#scenery-play').click()`);
 await sleep(1900);
 assert.equal(await p.evaluate(`window.__jfObservedGains[0].gain.value`),0,'Preview sound stops on its own audio deadline');
 await p.evaluate(`document.querySelector('#scenery-close').click();document.querySelector('#sound-button').click()`);
 assert.equal(p.errors.length,0);
 console.log(JSON.stringify({passed:['preview sound playback','pause fade','independent preview audio deadline','close sound cleanup'],pageErrors:p.errors.length}));
}catch(error){console.log(JSON.stringify({failed:error.message,pageErrors:p.errors.length}));process.exitCode=1;}
finally{p.close();}
