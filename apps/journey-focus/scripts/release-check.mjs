import assert from 'node:assert/strict';
import {connectPage,waitFor,sleep} from './cdp.mjs';
const p=await connectPage({fresh:true});
try{
 await p.send('Page.navigate',{url:'http://localhost:5173/'});
 assert.ok(await waitFor(p,`document.querySelector('#scene')?.classList.contains('map-ready')&&document.querySelector('#start')?.disabled===false`,55000));
 await p.evaluate(`document.querySelector('[data-duration="60"]').click();document.querySelector('#start').click()`);
 assert.ok(await waitFor(p,`document.querySelector('#info-dialog').open&&document.querySelector('#dialog-eyebrow').textContent==='JOURNEY COMPLETE'`,65000));
 await p.evaluate(`document.querySelector('#dialog-close').click();window.__jfAfterCompletePosts=0;document.querySelector('#map-frame').contentWindow.addEventListener('message',event=>{if(event.origin===location.origin&&event.data?.type==='jf:position')window.__jfAfterCompletePosts++})`);
 await sleep(1200);
 assert.equal(await p.evaluate('window.__jfAfterCompletePosts'),0,'Completed session must release camera ownership');
 await p.evaluate(`document.querySelector('#compare-toggle').click();const range=document.querySelector('#lab-progress');range.value=120;range.dispatchEvent(new Event('input'))`);
 await sleep(300);await p.evaluate('window.__jfAfterCompletePosts=0');
 await sleep(800);
 const comparisonPosts=await p.evaluate('window.__jfAfterCompletePosts');
 assert.equal(comparisonPosts,0,'Completed session must not fight comparison seeking');
 await p.evaluate(`document.querySelector('#compare-toggle').click();document.querySelector('#scenery-toggle').click()`);
 assert.ok(await waitFor(p,`document.querySelector('#scenery-play')?.disabled===false`,60000));
 await p.evaluate(`document.querySelector('#scenery-play').click()`);await sleep(1800);
 assert.ok(await p.evaluate(`Number(document.querySelector('#scenery-progress').value)>20`),'Scenic preview progresses after completion');
 await p.evaluate(`document.querySelector('#scenery-close').click()`);
 assert.equal(p.errors.length,0,'No browser errors');
 console.log(JSON.stringify({passed:['real minute completion','completed camera release','completed to comparison','completed to scenery'],pageErrors:p.errors.length}));
}catch(error){console.log(JSON.stringify({failed:error.message,pageErrors:p.errors.length}));process.exitCode=1;}
finally{p.close();}
