import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { connectPage,waitFor } from './cdp.mjs';
const page=await connectPage({fresh:true});
try{
 await page.send('Page.navigate',{url:'http://localhost:5173/'});
 if(!await waitFor(page,`document.querySelector('#scene')?.classList.contains('map-ready')&&!document.querySelector('#scenery-toggle').disabled`,45000))throw new Error('Map unavailable');
 if(process.argv[2]==='overnight')await page.evaluate(`(()=>{const s=document.querySelector('#render-quality');s.value='auto';s.dispatchEvent(new Event('change'))})()`);
 await page.evaluate(`document.querySelector('#scenery-toggle').click()`);
 if(!await waitFor(page,`!document.querySelector('#scenery-play').disabled`,60000))throw new Error('Scenery unavailable');
 await waitFor(page,`document.querySelector('#map-frame').contentWindow.ws3d.viewer.scene.globe.tilesLoaded`,15000);
 const renderingExpression=`(()=>{const v=document.querySelector('#map-frame').contentWindow.ws3d.viewer;return{mode:document.querySelector('#render-quality').value,status:document.querySelector('#render-quality-status').textContent,resolutionScale:v.resolutionScale,terrainError:v.scene.globe.maximumScreenSpaceError}})()`;
 const renderingStart=await page.evaluate(renderingExpression);
 if(process.argv.includes('--collision-off'))await page.evaluate(`document.querySelector('#map-frame').contentWindow.ws3d.viewer.scene.screenSpaceCameraController.enableCollisionDetection=false`);
 await page.evaluate(`(()=>{
 const w=document.querySelector('#map-frame').contentWindow, frames=[];const start=performance.now();window.__jfMotionFrames=frames;window.__jfMotionComplete=false;
 document.querySelector('#scenery-play').click();
 function sample(now){const c=w.ws3d.viewer.camera.positionCartographic;frames.push({t:(now-start)/1000,height:c.height,ground:w.ws3d.viewer.scene.globe.getHeight(c),lon:c.longitude,lat:c.latitude,heading:w.ws3d.viewer.camera.heading,remaining:document.querySelector('#scenery-time').textContent});if(now-start<30500)requestAnimationFrame(sample);else window.__jfMotionComplete=true}requestAnimationFrame(sample);
 })()`);
 if(!await waitFor(page,'window.__jfMotionComplete===true',40000))throw new Error('Motion capture timeout');
 const samples=await page.evaluate('window.__jfMotionFrames');
 const steps=samples.slice(1).map((s,i)=>({t:s.t,remaining:s.remaining,dt:s.t-samples[i].t,dz:s.height-samples[i].height})).filter(s=>s.dt>.001);
 const sorted=steps.map(s=>s.dt*1000).sort((a,b)=>a-b);
 const summary={samples:samples.length,altitudeMin:Math.min(...samples.map(s=>s.height)),altitudeMax:Math.max(...samples.map(s=>s.height)),maxHeightStep:Math.max(...steps.map(s=>Math.abs(s.dz))),maxVerticalSpeed:Math.max(...steps.map(s=>Math.abs(s.dz)/s.dt)),frameGapP95ms:sorted[Math.floor(sorted.length*.95)],maxFrameGapMs:sorted.at(-1),largestHeightSteps:[...steps].sort((a,b)=>Math.abs(b.dz)-Math.abs(a.dz)).slice(0,8),pageErrorCount:page.errors.length};
 // getHeight can briefly report a different cached LOD below the camera.
 // Cross-check every suspicious frame with independent provider sampling;
 // never discard a frame or replace the camera trajectory with filtered data.
 const clearance=await page.evaluate(`(async()=>{
 const a=window.__jfMotionFrames,w=document.querySelector('#map-frame').contentWindow,C=w.Cesium,v=w.ws3d.viewer;
 const bad=a.filter(s=>Number.isFinite(s.ground)&&(s.height-s.ground<=.25||s.height-s.ground>=15));
 const points=bad.map(s=>new C.Cartographic(s.lon,s.lat));
 if(points.length)await C.sampleTerrain(v.terrainProvider,14,points);
 return {checked:a.filter(s=>Number.isFinite(s.ground)).length,transientQueries:bad.length,
 providerClearances:bad.map((s,i)=>Number.isFinite(points[i].height)&&points[i].height>=0?s.height-points[i].height:null)};
 })()`);
 summary.clearanceCrossCheck=clearance;
 summary.rendering={start:renderingStart,end:await page.evaluate(renderingExpression)};
 const name=process.argv.includes('--collision-off')?'collision-off':['after','naturalness','overnight'].includes(process.argv[2])?process.argv[2]:'before';
 if(['after','naturalness','overnight'].includes(name)){
  assert.ok(summary.maxHeightStep<.2,'No large per-frame camera elevation jump');
  assert.ok(clearance.checked>samples.length*.95,'Terrain available for the traversal');
  assert.ok(clearance.providerClearances.every(d=>Number.isFinite(d)&&d>.25&&d<15),'Suspicious cached-LOD readings independently confirm camera clearance');
 }
 // Keep only derived motion metrics; terrain samples and coordinates stay in
 // the temporary QA page memory and are not exported as a terrain profile.
 await writeFile(`docs/motion-${name}.json`,JSON.stringify({dateKST:'2026-11-03',summary},null,2));
 console.log(JSON.stringify(summary));
}catch(error){console.log(JSON.stringify({error:error.message}));process.exitCode=1;}
finally{page.close();}
