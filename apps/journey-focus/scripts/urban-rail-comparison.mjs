import fs from 'node:fs/promises';
import {buildRoute,positionAt,distance} from '../src/route.mjs';
import {connectPage,waitFor,sleep} from './cdp.mjs';
const height=process.argv.includes('--height30')?30:12;
const out='../../tmp/urban-rail-comparison'+(height===30?'-height30':'');await fs.mkdir(out,{recursive:true});
const raw=JSON.parse(await fs.readFile('scripts/fixtures/urban-osm.json','utf8'));
const nodes=new Map(raw.elements.filter(e=>e.type==='node').map(e=>[e.id,e]));
const ways=[1458437482,625534094].map(id=>raw.elements.find(e=>e.type==='way'&&e.id===id));
if(ways.some(w=>!w)||ways[0].nodes.at(-1)!==ways[1].nodes[0])throw new Error('Rail ways are not joined');
const ids=[...ways[0].nodes,...ways[1].nodes.slice(1)];
const points=ids.map(id=>({id,lon:nodes.get(id).lon,lat:nodes.get(id).lat}));
const stations=[{name:'뚝섬',lon:127.047367,lat:37.547184},{name:'성수',lon:127.055961,lat:37.544581},{name:'건대입구',lon:127.069191,lat:37.540373}];
const nearest=s=>points.reduce((best,p,i)=>distance(s,p)<distance(s,points[best])?i:best,0);
const indices=stations.map(nearest);
if(!(indices[0]<indices[1]&&indices[1]<indices[2]))throw new Error('Unexpected station order');
const segments=stations.slice(0,-1).map((s,i)=>{
 const shape={from:s.name,to:stations[i+1].name,points:points.slice(indices[i],indices[i+1]+1)};
 return {name:i===0?'ttukseom-seongsu':'seongsu-konkuk',shape,route:buildRoute(stations,s.name,stations[i+1].name,shape)};
});
await fs.writeFile(`${out}/rail-source.json`,JSON.stringify({source:'https://api.openstreetmap.org/api/0.6/map.json?bbox=127.043,37.536,127.073,37.550',license:'ODbL-1.0',attribution:'© OpenStreetMap contributors',wayIds:ways.map(w=>w.id),cameraHeightAboveTerrain:height,note:'OSM mainline horizontal geometry. Travel direction and track elevation not surveyed. Camera height above terrain is illustrative, not actual track height.',stationOffsets:stations.map((s,i)=>({name:s.name,nearestNode:points[indices[i]].id,offsetMetres:distance(s,points[indices[i]])})),segments:segments.map(s=>({name:s.name,...s.shape,distance:s.route.distance}))},null,2));
const p=await connectPage({fresh:true});const results=[];
try{
 await p.send('Emulation.setDeviceMetricsOverride',{width:1200,height:720,deviceScaleFactor:1,mobile:false});
 await p.send('Page.navigate',{url:'http://localhost:5173'});
 if(!await waitFor(p,`document.querySelector('#start')?.disabled===false`,55000))throw new Error('Map not ready');
 await p.evaluate(`(()=>{const f=document.querySelector('#map-frame');f.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:99999';for(const selector of ['.scene-top','.scene-heading','.scene-shade','.window-frame','.scene-bottom','.view-controls','.session-panel'])document.querySelectorAll(selector).forEach(e=>e.style.visibility='hidden');f.contentWindow.postMessage({type:'jf:lock',locked:true},location.origin);f.contentWindow.postMessage({type:'jf:geometry',rail:true},location.origin)})()`);
 for(const segment of segments)for(const [side,heading]of [['left',-90],['right',90]]){
  await p.evaluate(`document.querySelector('#map-frame').contentWindow.postMessage({type:'jf:visual',settings:{height:${height},pitch:-4,heading:${heading},fov:65,buildings:'textured'}},location.origin)`);
  for(const progress of (height===30?[.5]:[.25,.5,.75])){
   const position=positionAt(segment.route,progress);
   await p.evaluate(`document.querySelector('#map-frame').contentWindow.postMessage({type:'jf:position',position:${JSON.stringify(position)},snap:true},location.origin)`);
   await sleep(4500);
   await p.evaluate(`document.querySelector('#map-frame').contentWindow.postMessage({type:'jf:position',position:${JSON.stringify(position)},snap:true},location.origin)`);
   await sleep(500);
   await p.screenshot(`${out}/${segment.name}-${side}-${progress*100}.png`);
   results.push({segment:segment.name,side,progress,position});
  }
  // Continuous travel samples the actual OSM polyline, never station-to-station chords.
  const positions=Array.from({length:181},(_,i)=>positionAt(segment.route,.25+i/180*.5));
  await p.evaluate(`new Promise(resolve=>{const points=${JSON.stringify(positions)},start=performance.now();function tick(now){const t=Math.min(1,(now-start)/3000);document.querySelector('#map-frame').contentWindow.postMessage({type:'jf:position',position:points[Math.round(t*180)]},location.origin);if(t<1)requestAnimationFrame(tick);else resolve()}requestAnimationFrame(tick)})`);
  console.log(JSON.stringify({segment:segment.name,side,distance:segment.route.distance,nodes:segment.shape.points.length}));
 }
 await fs.writeFile(`${out}/results.json`,JSON.stringify(results,null,2));
}finally{p.close();}
