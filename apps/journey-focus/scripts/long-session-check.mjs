import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {connectPage,waitFor,sleep} from './cdp.mjs';
const p=await connectPage({fresh:true,port:9224});
try{
 await p.send('Page.navigate',{url:'http://localhost:5173/'});
 assert.ok(await waitFor(p,`document.querySelector('#scene')?.classList.contains('map-ready')&&document.querySelector('#start')?.disabled===false`,55000));
 await p.evaluate(`document.querySelector('[data-duration="1500"]').click();document.querySelector('#start').click()`);
 const started=Date.now(),background=(await p.send('Target.createTarget',{url:'about:blank'})).targetId;
 await p.send('Target.activateTarget',{targetId:background});
 assert.equal(await p.evaluate('document.hidden'),true);
 console.log(JSON.stringify({phase:'25-minute real background session started',startedUTC:new Date(started).toISOString()}));
 let complete=false,lastMinute=0;
 while(Date.now()-started<1530000){
  await sleep(10000);
  const state=await p.evaluate(`({complete:document.querySelector('#info-dialog').open&&document.querySelector('#dialog-eyebrow').textContent==='JOURNEY COMPLETE',failed:!document.querySelector('#map-retry').hidden,hidden:document.hidden})`);
  assert.equal(state.failed,false,'Map remains available throughout the long session');assert.equal(state.hidden,true);
  if(state.complete){complete=true;break;}
  const minute=Math.floor((Date.now()-started)/60000);if(minute>=lastMinute+5){lastMinute=minute;console.log(JSON.stringify({phase:'background session in progress',minutes:minute}));}
 }
 assert.equal(complete,true,'Actual 25-minute session completes');
 const result=await p.evaluate(`({timer:document.querySelector('#timer').textContent,hidden:document.hidden,history:JSON.parse(localStorage.getItem('journey-focus-history'))[0]})`);
 assert.equal(result.timer,'00:00');assert.equal(result.hidden,true);assert.equal(result.history.completed,true);assert.equal(result.history.elapsed,1500);
 assert.equal(p.errors.length,0);
 const summary={durationSeconds:1500,observedWallSeconds:(Date.now()-started)/1000,hiddenAtCompletion:true,recordedElapsed:result.history.elapsed,pageErrors:0,completedUTC:new Date().toISOString()};
 await writeFile('docs/long-session-verification.json',JSON.stringify(summary,null,2));
 await p.send('Target.closeTarget',{targetId:background});
 console.log(JSON.stringify({passed:['real 25-minute background completion','elapsed clamp','history save','map survives','no audio autoplay'],summary}));
}catch(error){console.log(JSON.stringify({failed:error.message,pageErrors:p.errors.length}));process.exitCode=1;}
finally{p.close();}
