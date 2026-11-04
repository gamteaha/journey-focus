import assert from 'node:assert/strict';
import {connectPage,waitFor,sleep} from './cdp.mjs';
const p=await connectPage({fresh:true});
const ready=`document.querySelector('#scene')?.classList.contains('map-ready')&&document.querySelector('#start')?.disabled===false`;
try{
 await p.send('Page.navigate',{url:'http://localhost:5173/'});assert.ok(await waitFor(p,ready,55000));
 await p.evaluate(`(()=>{const a=document.querySelector('#from'),b=document.querySelector('#to');a.value='강촌';a.dispatchEvent(new Event('change'));b.value='백양리';b.dispatchEvent(new Event('change'));document.querySelector('[data-duration="300"]').click();document.querySelector('#overview-view').click()})()`);
 await p.send('Page.reload');await sleep(300);assert.ok(await waitFor(p,ready,55000));
 const restored=await p.evaluate(`({from:document.querySelector('#from').value,to:document.querySelector('#to').value,timer:document.querySelector('#timer').textContent,view:document.querySelector('#overview-view').getAttribute('aria-pressed'),running:document.body.classList.contains('running')})`);
 assert.deepEqual(restored,{from:'강촌',to:'백양리',timer:'05:00',view:'true',running:false});
 // Reset only this dedicated QA browser's preferences for the other checks.
 await p.evaluate(`localStorage.removeItem('journey-focus-preferences')`);
 assert.equal(p.errors.length,0);
 console.log(JSON.stringify({passed:['route and duration restore','view restore','no automatic session playback'],pageErrors:p.errors.length}));
}catch(error){console.log(JSON.stringify({failed:error.message,pageErrors:p.errors.length}));process.exitCode=1;}
finally{p.close();}
