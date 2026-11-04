import {connectPage,waitFor,sleep} from './cdp.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const out='../../tmp/urban-comparison';await mkdir(out,{recursive:true});
const p=await connectPage({fresh:true});const results=[];
try{
 await p.send('Emulation.setDeviceMetricsOverride',{width:1200,height:720,deviceScaleFactor:1,mobile:false});
 await p.send('Page.navigate',{url:'http://localhost:5173'});
 if(!await waitFor(p,`document.querySelector('#start')?.disabled===false`,55000))throw new Error('Map not ready');
 await p.evaluate(`(()=>{const f=document.querySelector('#map-frame');f.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:99999';document.querySelectorAll('.scene-top,.scene-heading,.scene-shade,.window-frame,.scene-bottom,.view-controls').forEach(e=>e.style.display='none');f.contentWindow.postMessage({type:'jf:lock',locked:true},location.origin)})()`);
 const stations=[{name:'ttukseom',label:'뚝섬',lon:127.047367,lat:37.547184},{name:'seongsu',label:'성수',lon:127.055961,lat:37.544581},{name:'konkuk',label:'건대입구',lon:127.069191,lat:37.540373}];
 for(const s of stations){
  for(const [side,heading]of [['north',-90],['south',90]]){
   await p.evaluate(`(()=>{const w=document.querySelector('#map-frame').contentWindow;w.postMessage({type:'jf:visual',settings:{height:30,pitch:-4,heading:${heading},fov:65,buildings:'textured'}},location.origin);w.postMessage({type:'jf:position',position:${JSON.stringify({...s,heading:110})},snap:true},location.origin)})()`);
   await sleep(7000);
   // Reapply after near terrain is ready, so the comparison uses relative height.
   await p.evaluate(`document.querySelector('#map-frame').contentWindow.postMessage({type:'jf:position',position:${JSON.stringify({...s,heading:110})},snap:true},location.origin)`);
   await sleep(1500);
   await p.screenshot(`${out}/${s.name}-${side}.png`);
   const state=await p.evaluate(`(()=>{const w=document.querySelector('#map-frame').contentWindow,v=w.ws3d.viewer,c=v.camera.positionCartographic;return {altitude:c.height,terrainLoaded:v.scene.globe.tilesLoaded,mapError:w.document.querySelector('#map-error').textContent}})()`);
   results.push({station:s.label,side,...state});console.log(JSON.stringify(results.at(-1)));
  }
 }
 await writeFile(`${out}/results.json`,JSON.stringify(results,null,2));
}finally{p.close();}
