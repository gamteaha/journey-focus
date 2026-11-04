import assert from 'node:assert/strict';
import {connectPage,waitFor,sleep} from './cdp.mjs';
const p=await connectPage({fresh:true});
try{
 await p.send('Page.navigate',{url:'http://localhost:5173/'});
 assert.ok(await waitFor(p,`document.querySelector('#scene')?.classList.contains('map-ready')&&document.querySelector('#scenery-toggle')?.disabled===false`,55000));
 await p.send('Network.enable');
 await p.send('Network.setBlockedURLs',{urls:['*assets/shrub_sorrel_01/*']});
 await p.evaluate(`document.querySelector('#scenery-toggle').click()`);
 assert.ok(await waitFor(p,`document.querySelector('#scenery-retry')?.hidden===false`,24000),'Failed model exits loading with retry');
 const original=await p.evaluate(`(()=>{const v=document.querySelector('#map-frame').contentWindow.ws3d.viewer;return{entities:v.entities.values.length,layer:v.map.getElementById('facility_build_all').visible}})()`);
 assert.equal(original.entities,0,'Failed model load cleans up all scenery entities');
 assert.equal(original.layer,true,'Failed load restores original building layer');
 await p.send('Network.setBlockedURLs',{urls:[]});
 // Blocked requests are expected; capture only errors from recovery onward.
 p.errors.length=0;
 await p.evaluate(`document.querySelector('#scenery-retry').click()`);
 assert.ok(await waitFor(p,`document.querySelector('#scenery-play')?.disabled===false`,24000),'One-click retry recovers');
 await p.evaluate(`document.querySelector('#scenery-close').click()`);await sleep(250);
 assert.equal(await p.evaluate(`document.querySelector('#start').disabled`),false,'Study controls recover');
 assert.equal(p.errors.length,0,'No recovery errors');
 console.log(JSON.stringify({passed:['blocked model fails safely','model cleanup','layer restoration','one-click retry','study controls restored'],pageErrors:p.errors.length}));
}catch(error){console.log(JSON.stringify({failed:error.message,pageErrors:p.errors.length}));process.exitCode=1;}
finally{p.close();}
