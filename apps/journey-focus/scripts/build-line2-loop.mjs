import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {distance} from '../src/route.mjs';
const source='https://api.openstreetmap.org/api/0.6/relation/4729409/full.json';
const cache=fileURLToPath(new URL('../../../tmp/line2-loop-source/',import.meta.url));
await fs.mkdir(cache,{recursive:true});
let raw;
if(process.argv.includes('--cached'))raw=JSON.parse(await fs.readFile(cache+'full.json','utf8'));
else {const response=await fetch(source,{headers:{'User-Agent':'JourneyFocus-Prototype/0.1'},signal:AbortSignal.timeout(45000)});if(!response.ok)throw Error('OSM '+response.status);raw=await response.json();await fs.writeFile(cache+'full.json',JSON.stringify(raw));}
const elements=new Map(raw.elements.map(e=>[e.type+e.id,e])),relation=elements.get('relation4729409');
if(relation?.tags?.roundtrip!=='yes'||relation.tags.ref!=='2')throw Error('Expected Line 2 circular relation');
const points=[],ids=[],wayIds=[];
for(const member of relation.members.filter(m=>m.type==='way')){
 const way=elements.get('way'+member.ref);if(way.tags?.railway!=='subway'||way.tags.name!=='2호선')throw Error('Unexpected rail member');
 let nodes=way.nodes;
 if(ids.length&&ids.at(-1)===nodes.at(-1))nodes=[...nodes].reverse();
 if(ids.length&&ids.at(-1)!==nodes[0])throw Error('Disconnected rail ways: '+member.ref);
 wayIds.push(member.ref);
 for(const [i,id]of nodes.entries()){
  if(i===0&&ids.length)continue;
  if(points.length)points.at(-1).tunnel=way.tags.tunnel==='yes';
  const node=elements.get('node'+id);ids.push(id);points.push({id,lon:node.lon,lat:node.lat,tunnel:false});
 }
}
if(ids[0]!==ids.at(-1))throw Error('The source rail is not a closed loop');
if(new Set(ids).size!==ids.length-1)throw Error('The main loop revisits a source node before completing the circle');
points.at(-1).tunnel=points[0].tunnel;
const stationAnchors=[],seen=new Set();
for(const member of relation.members.filter(m=>m.role==='stop')){
 if(seen.has(member.ref))continue;seen.add(member.ref);
 const node=elements.get('node'+member.ref),name=node.tags.name.replace(/\s*\([^)]*\)\s*/g,'').trim(),pointIndex=ids.indexOf(member.ref);
 if(pointIndex<0)throw Error('Station is not on the source rail');
 stationAnchors.push({name,pointIndex,nodeId:member.ref});
}
if(stationAnchors.length!==43||!stationAnchors.every((s,i)=>!i||s.pointIndex>stationAnchors[i-1].pointIndex))throw Error('Expected 43 ordered main-loop stops');
const distanceMetres=points.slice(1).reduce((sum,p,i)=>sum+distance(points[i],p),0);
const result={id:'seoul-line2-inner-circle-osm',loop:true,from:stationAnchors[0].name,to:stationAnchors[0].name,geometry:'osm-rail',license:'ODbL-1.0',attribution:'© OpenStreetMap contributors',copyrightUrl:'https://www.openstreetmap.org/copyright',source,relationId:4729409,wayIds,retrievedAt:new Date().toISOString(),distanceMetres,stationAnchors,note:'43 main-loop stops only; branch lines excluded. Native OSM stop nodes lie on the connected rail. Horizontal geometry; track elevation and operating rules not surveyed. Underground sections currently viewed above ground.',points};
await fs.writeFile(new URL('../public/data/line2-loop.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({points:points.length,stations:stationAnchors.length,closed:true,distanceKm:Math.round(distanceMetres/100)/10,names:stationAnchors.map(s=>s.name)}));
