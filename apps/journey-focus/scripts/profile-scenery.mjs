import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {connectPage,waitFor} from './cdp.mjs';
const p=await connectPage({fresh:true});
const mode=process.argv[2]==='light'?'light':'balanced';
const phase=['staggered','lod','camera'].includes(process.argv[3])?process.argv[3]:'';
try{
 await p.send('Page.navigate',{url:'http://localhost:5173/'});
 assert.ok(await waitFor(p,`document.querySelector('#scene')?.classList.contains('map-ready')&&document.querySelector('#scenery-toggle')?.disabled===false`,55000));
 await p.evaluate(`(()=>{const s=document.querySelector('#render-quality');s.value='${mode}';s.dispatchEvent(new Event('change'));document.querySelector('#scenery-toggle').click()})()`);
 assert.ok(await waitFor(p,`document.querySelector('#scenery-play')?.disabled===false`,24000));
 await waitFor(p,`document.querySelector('#map-frame').contentWindow.ws3d.viewer.scene.globe.tilesLoaded`,15000);
 await p.send('Profiler.enable');await p.send('Profiler.setSamplingInterval',{interval:1000});await p.send('Profiler.start');
 await p.evaluate(`(()=>{
 const w=document.querySelector('#map-frame').contentWindow,v=w.ws3d.viewer,stats={height:{calls:0,ms:0,max:0},camera:{calls:0,ms:0,max:0},tiles:[],longTasks:[],frameGaps:[]};window.__jfProfile=stats;window.__jfProfileDone=false;
 const start=performance.now(),wrapped=[];
 for(const [object,key,bucket] of [[v.scene.globe,'getHeight',stats.height],[v.camera,'setView',stats.camera]]){
  const original=object[key];object[key]=function(...args){const t=performance.now();try{return original.apply(this,args)}finally{const ms=performance.now()-t;bucket.calls++;bucket.ms+=ms;bucket.max=Math.max(bucket.max,ms)}};wrapped.push(()=>{object[key]=original});
 }
 const remove=v.scene.globe.tileLoadProgressEvent.addEventListener(count=>{if(count===0)stats.tiles.push(performance.now()-start)});
 const observer=new PerformanceObserver(list=>{for(const e of list.getEntries())stats.longTasks.push({t:e.startTime-start,ms:e.duration})});observer.observe({type:'longtask'});
 let previous=null;document.querySelector('#scenery-play').click();
 function sample(now){if(previous!==null)stats.frameGaps.push(now-previous);previous=now;if(now-start<30500)requestAnimationFrame(sample);else{observer.disconnect();remove();for(const restore of wrapped)restore();window.__jfProfileDone=true}}requestAnimationFrame(sample);
 })()`);
 assert.ok(await waitFor(p,'window.__jfProfileDone===true',40000));
 const {profile}=await p.send('Profiler.stop');
 const times=new Map();for(let i=0;i<(profile.samples||[]).length;i++){const id=profile.samples[i];times.set(id,(times.get(id)||0)+(profile.timeDeltas[i]||0)/1000);}
 const top=profile.nodes.map(n=>{let source='';try{source=new URL(n.callFrame.url).pathname;}catch{}return{name:n.callFrame.functionName||'(anonymous)',source,line:n.callFrame.lineNumber,selfMs:Math.round(times.get(n.id)||0)};}).sort((a,b)=>b.selfMs-a.selfMs).slice(0,25);
 const runtime=await p.evaluate(`(()=>{const s=window.__jfProfile,g=[...s.frameGaps].sort((a,b)=>a-b);return{height:s.height,camera:s.camera,tileCompletions:s.tiles.length,tileTimes:s.tiles.slice(0,30),longTasks:s.longTasks.sort((a,b)=>b.ms-a.ms).slice(0,12),frameGapP95:g[Math.floor(g.length*.95)],frameGapMax:g.at(-1)}})()`);
 const result={mode,phase,cpuProfiledMs:(profile.endTime-profile.startTime)/1000,top,runtime,pageErrors:p.errors.length};
 await writeFile(`docs/performance-profile-${mode}${phase?'-'+phase:''}.json`,JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
}catch(error){console.log(JSON.stringify({failed:error.message,pageErrors:p.errors.length}));process.exitCode=1;}
finally{p.close();}
