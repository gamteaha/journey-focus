import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {connectPage,waitFor,sleep} from './cdp.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..'),p=await connectPage({fresh:true});
const leafy=process.argv[2]==='leafy';
try{
 await p.send('Page.navigate',{url:'http://localhost:5173/'});
 assert.ok(await waitFor(p,`document.querySelector('#scene')?.classList.contains('map-ready')&&document.querySelector('#scenery-toggle')?.disabled===false`,55000));
 await p.evaluate(`document.querySelector('#scenery-toggle').click()`);assert.ok(await waitFor(p,`document.querySelector('#scenery-play')?.disabled===false`,24000));
 await p.evaluate(`const progress=document.querySelector('#scenery-progress');progress.value=500;progress.dispatchEvent(new Event('input'))`);
 await waitFor(p,`document.querySelector('#map-frame').contentWindow.ws3d.viewer.scene.globe.tilesLoaded`,15000);await sleep(2000);
 await p.evaluate(`document.querySelector('#map-frame').contentWindow.postMessage({type:'jf:lock',locked:false},location.origin)`);await sleep(100);
 const bounds=await p.evaluate(`(async()=>{
 const w=document.querySelector('#map-frame').contentWindow,v=w.ws3d.viewer,C=w.Cesium;let owner,low;
 for(let i=0;i<v.scene.primitives.length;i++){const collection=v.scene.primitives.get(i);if(typeof collection.get!=='function')continue;for(let j=0;j<collection.length;j++){const model=collection.get(j);if(model.id==='jf-scenery-tree-10'){owner=collection;low=model;}}}
 if(!low)throw new Error('Pine not found');
 let original=C.Model.fromGltf({url:'${leafy?'/assets/leafy_tree_lod/model.gltf':'/assets/pine_sapling_small/model.gltf'}',modelMatrix:C.Matrix4.clone(low.modelMatrix,new C.Matrix4),scale:low.scale*${leafy?'1.2989574084/4.54396665':'1'},allowPicking:false});if(original?.then)original=await original;owner.add(original);await original.readyPromise;
 const target=C.Cartographic.fromCartesian(C.Matrix4.getTranslation(low.modelMatrix,new C.Cartesian3));target.height+=low.scale*.65;
 v.camera.lookAt(C.Cartesian3.fromRadians(target.longitude,target.latitude,target.height),new C.HeadingPitchRange(v.camera.heading,C.Math.toRadians(-10),20));v.scene.requestRender();
 window.__jfTreeCompare={v,C,owner,low,original,saved:Array.from({length:owner.length-1},(_,i)=>owner.get(i).show)};
 return {originalRadius:original.boundingSphere.radius,lodRadius:low.boundingSphere.radius};
 })()`);
 assert.ok(Math.abs(bounds.originalRadius-bounds.lodRadius)/bounds.originalRadius<(leafy ? .4 : .03),'Runtime bounds retain the tree scale');
 await waitFor(p,`document.querySelector('#map-frame').contentWindow.ws3d.viewer.scene.globe.tilesLoaded`,15000);await sleep(2500);
 const clip=await p.evaluate(`(()=>{const r=document.querySelector('#scene').getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,scale:1}})()`);
 for(const variant of ['original','lod']){
  const target=leafy?(variant==='original'?'low':'original'):(variant==='original'?'original':'low');
  await p.evaluate(`(()=>{const s=window.__jfTreeCompare;for(let i=0;i<s.owner.length;i++)s.owner.get(i).show=false;s.original.modelMatrix=s.C.Matrix4.clone(s.low.modelMatrix,new s.C.Matrix4);s.${target}.show=true;s.v.scene.requestRender()})()`);await sleep(150);
  const name=leafy?(variant==='original'?'pine-reference':'leafy-candidate'):variant;
  const shot=await p.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});await writeFile(path.join(root,`tmp/journey-focus-tree-${name}.png`),Buffer.from(shot.data,'base64'));
 }
 await p.evaluate(`(()=>{const s=window.__jfTreeCompare;s.owner.remove(s.original);s.saved.forEach((show,i)=>s.owner.get(i).show=show);s.v.camera.lookAtTransform(s.C.Matrix4.IDENTITY);document.querySelector('#scenery-close').click()})()`);
 assert.equal(p.errors.length,0);
 console.log(JSON.stringify({passed:['original and LOD actual glTF','matched camera and scale screenshots','runtime bounds','cleanup'],bounds,pageErrors:p.errors.length}));
}catch(error){console.log(JSON.stringify({failed:error.message,pageErrors:p.errors.length}));process.exitCode=1;}
finally{p.close();}
