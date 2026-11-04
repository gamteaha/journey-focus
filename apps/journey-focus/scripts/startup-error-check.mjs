import assert from 'node:assert/strict';
import {connectPage,waitFor,sleep} from './cdp.mjs';
const p=await connectPage({fresh:true});
try{
 await p.send('Page.navigate',{url:'http://localhost:5173/'});
 assert.ok(await waitFor(p,`Boolean(document.querySelector('#map-frame')?.contentWindow.ws3d?.viewer?.scene?.renderError)`,45000));
 await sleep(400);
 await p.evaluate(`(()=>{const v=document.querySelector('#map-frame').contentWindow.ws3d.viewer;v.scene.renderError.raiseEvent(v.scene,new Error('QA rendering failure'))})()`);
 assert.ok(await waitFor(p,`document.querySelector('#map-retry').hidden===false`,3000));
 await sleep(11000);
 assert.equal(await p.evaluate(`document.querySelector('#start').disabled`),true,'Late startup cannot clear a terminal rendering failure');
 assert.equal(await p.evaluate(`document.querySelector('#map-retry').hidden`),false);
 p.errors.length=0;
 await p.evaluate(`document.querySelector('#map-retry').click()`);
 assert.ok(await waitFor(p,`document.querySelector('#scene').classList.contains('map-ready')&&!document.querySelector('#start').disabled`,55000),'A new renderer recovers on retry');
 await p.evaluate(`document.querySelector('#compare-toggle').click();const v=document.querySelector('#map-frame').contentWindow.ws3d.viewer;v.scene.renderError.raiseEvent(v.scene,new Error('QA active comparison failure'))`);
 assert.ok(await waitFor(p,`!document.body.classList.contains('comparison-active')&&!document.querySelector('#map-retry').hidden`,3000),'Map failure releases comparison layout');
 p.errors.length=0;await p.evaluate(`document.querySelector('#map-retry').click()`);
 assert.ok(await waitFor(p,`document.querySelector('#scene').classList.contains('map-ready')&&!document.querySelector('#start').disabled`,55000));
 assert.equal(p.errors.length,0);
 console.log(JSON.stringify({passed:['startup render failure remains failed','late ready suppressed','renderer reload recovers','failed comparison exits cleanly'],pageErrors:p.errors.length}));
}catch(error){console.log(JSON.stringify({failed:error.message,pageErrors:p.errors.length}));process.exitCode=1;}
finally{p.close();}
