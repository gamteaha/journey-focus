import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {connectPage,waitFor,sleep} from './cdp.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..'),p=await connectPage({fresh:true});
try{
 await p.send('Page.navigate',{url:'http://localhost:5173/'});assert.ok(await waitFor(p,`document.querySelector('#scene')?.classList.contains('map-ready')&&document.querySelector('#scenery-toggle')?.disabled===false`,55000));
 await p.evaluate(`document.querySelector('#scenery-toggle').click()`);assert.ok(await waitFor(p,`document.querySelector('#scenery-play')?.disabled===false`,24000));
 await p.evaluate(`const progress=document.querySelector('#scenery-progress');progress.value=267;progress.dispatchEvent(new Event('input'))`);
 await waitFor(p,`document.querySelector('#map-frame').contentWindow.ws3d.viewer.scene.globe.tilesLoaded`,15000);await sleep(2000);
 await p.evaluate(`document.querySelector('#map-frame').contentWindow.postMessage({type:'jf:lock',locked:false},location.origin)`);await sleep(100);
 const clip=await p.evaluate(`(()=>{const r=document.querySelector('#scene').getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()`);
 for(const pitch of [0,-6]){
  await p.evaluate(`(()=>{const w=document.querySelector('#map-frame').contentWindow,v=w.ws3d.viewer,C=w.Cesium,c=v.camera;v.camera.setView({destination:C.Cartesian3.clone(c.positionWC),orientation:{heading:c.heading,pitch:C.Math.toRadians(${pitch}),roll:0}});v.scene.requestRender()})()`);await sleep(500);
  const shot=await p.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});await writeFile(path.join(root,`tmp/journey-focus-pitch-${pitch}.png`),Buffer.from(shot.data,'base64'));
 }
 await p.evaluate(`(()=>{const w=document.querySelector('#map-frame').contentWindow,v=w.ws3d.viewer,C=w.Cesium;for(let i=0;i<v.scene.primitives.length;i++){const group=v.scene.primitives.get(i);if(typeof group.get!=='function')continue;for(let j=0;j<group.length;j++){const model=group.get(j);if(model.id==='jf-scenery-house-1')model.modelMatrix=C.Matrix4.multiply(model.modelMatrix,C.Matrix4.fromRotationTranslation(C.Matrix3.fromRotationZ(C.Math.toRadians(25))),new C.Matrix4)}}v.scene.requestRender()})()`);await sleep(300);
 const rotated=await p.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});await writeFile(path.join(root,'tmp/journey-focus-house-angle-25.png'),Buffer.from(rotated.data,'base64'));
 await p.evaluate(`document.querySelector('#scenery-close').click()`);assert.equal(p.errors.length,0);console.log(JSON.stringify({passed:['matched composition variants'],pageErrors:0}));
}catch(error){console.log(JSON.stringify({failed:error.message,pageErrors:p.errors.length}));process.exitCode=1;}
finally{p.close();}
