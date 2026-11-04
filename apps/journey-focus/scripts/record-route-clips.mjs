import fs from 'node:fs/promises';
import {connectPage,waitFor,sleep} from './cdp.mjs';
import {buildRoute,positionAt} from '../src/route.mjs';
const out='../../tmp/route-video-pilot';await fs.mkdir(out,{recursive:true});
// Only the dedicated QA browser's local app pages are closed, never user browser tabs.
const targets=await(await fetch('http://127.0.0.1:9223/json/list')).json();
for(const t of targets)if(t.type==='page'&&t.url.startsWith('http://localhost:5173'))await fetch(`http://127.0.0.1:9223/json/close/${t.id}`);
const shape=JSON.parse(await fs.readFile('public/data/seongsu-konkuk.json','utf8'));
const route=buildRoute([{name:shape.from,...shape.points[0]},{name:shape.to,...shape.points.at(-1)}],shape.from,shape.to,shape);
const positions=Array.from({length:301},(_,i)=>positionAt(route,.42+i/300*.16));
const p=await connectPage({fresh:true});
const reports=[];
try{
 await p.send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
 await p.send('Page.navigate',{url:'http://localhost:5173/map'});
 if(!await waitFor(p,`!!window.ws3d?.viewer?.scene?.globe&&!!document.querySelector('#scene-style')`,45000))throw new Error('SDK unavailable');
 await sleep(10000);
 await p.evaluate(`(()=>{document.querySelector('#style-filter').style.display='none';window.postMessage({type:'jf:visual',settings:{height:30,pitch:-4,heading:90,fov:65,buildings:'textured'}},location.origin);window.postMessage({type:'jf:position',position:${JSON.stringify(positions[0])},snap:true},location.origin)})()`);
 await sleep(9000);
 // Warm the same route before each recording so newly requested tiles are less disruptive.
 for(const style of ['original','cinematic']){
  await p.evaluate(`(()=>{const s=document.querySelector('#scene-style');s.value='${style}';s.dispatchEvent(new Event('change'));})()`);
  for(const position of [positions[0],positions[150],positions[300],positions[0]]){
   await p.evaluate(`window.postMessage({type:'jf:position',position:${JSON.stringify(position)},snap:true},location.origin)`);await sleep(1200);
  }
  await p.evaluate(`(()=>{const v=ws3d.viewer,C=window.Cesium||ws3d.common;v.clock.shouldAnimate=false;v.clock.currentTime=C.JulianDate.fromIso8601('2026-11-04T02:00:00Z');window.clipFrames=0;window.clipPositions=${JSON.stringify(positions)};window.clipChunks=[];
    const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=800;window.clipCanvas=canvas;
    const context=canvas.getContext('2d');context.fillStyle='#182c26';context.fillRect(0,0,1280,800);
    window.clipRemove=v.scene.postRender.addEventListener(()=>{context.drawImage(v.canvas,0,0,1280,800);context.fillStyle='#182c26';context.fillRect(0,766,1280,34);context.fillStyle='#ffffff';context.font='13px sans-serif';context.fillText('VWorld · 국토교통부 | © OpenStreetMap contributors · ODbL | 성수→건대입구 / 선로 높이 미검증',12,788);window.clipFrames++;});
    const mime=['video/webm;codecs=vp8','video/webm;codecs=vp9','video/webm'].find(x=>MediaRecorder.isTypeSupported(x));
    const stream=canvas.captureStream(30);window.clipStream=stream;
    const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:5000000});window.clipRecorder=recorder;
    recorder.ondataavailable=e=>{if(e.data.size)window.clipChunks.push(e.data)};
    window.clipFinished=new Promise(resolve=>{recorder.onstop=async()=>{const blob=new Blob(window.clipChunks,{type:mime});const reader=new FileReader();reader.onload=()=>resolve({base64:reader.result.split(',')[1],mime,frames:window.clipFrames});reader.readAsDataURL(blob);};});
    recorder.start(1000);const start=performance.now();function tick(now){const t=Math.min(1,(now-start)/10000);window.postMessage({type:'jf:position',position:window.clipPositions[Math.round(t*300)]},location.origin);v.scene.requestRender();if(t<1)requestAnimationFrame(tick);else setTimeout(()=>recorder.stop(),150);}requestAnimationFrame(tick);
  })()`);
  const data=await p.evaluate('window.clipFinished');
  if(!data.base64||data.frames<10)throw new Error(`Empty or incomplete recording: ${style}`);
  const filename=style==='original'?'route-original-10s.webm':'route-style6-10s.webm';
  await fs.writeFile(`${out}/${filename}`,Buffer.from(data.base64,'base64'));
  const diagnostic=await p.evaluate(`(()=>{const v=ws3d.viewer;clipRemove();clipStream.getTracks().forEach(t=>t.stop());return {ao:v.scene.postProcessStages.ambientOcclusion.enabled,shadows:v.scene.shadowMap.enabled,intensity:v.scene.light.intensity,mapError:document.querySelector('#map-error').textContent,style:document.querySelector('#scene-style').value}})()`);
  await p.screenshot(`${out}/${style}-end.png`);
  reports.push({filename,frames:data.frames,mime:data.mime,...diagnostic});console.log(JSON.stringify(reports.at(-1)));
 }
 await fs.writeFile(`${out}/capture.json`,JSON.stringify({source:'OSM horizontal rail polyline',fromProgress:.42,toProgress:.58,routeLength:route.distance,segmentMetres:route.distance*.16,cameraHeightAboveTerrain:30,captureSeconds:10,aiTransformed:false,reports},null,2));
}finally{p.close();}
