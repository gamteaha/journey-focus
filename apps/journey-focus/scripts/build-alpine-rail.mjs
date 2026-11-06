// Rebuild from one cached OSM map response; --fetch explicitly refreshes it.
import fs from 'node:fs/promises';
import tls from 'node:tls';
import {distance} from '../src/route.mjs';
const source='https://api.openstreetmap.org/api/0.6/map.json?bbox=9.985,46.37,10.05,46.425';
const cache=new URL('../../../tmp/alpine-source/osm.json',import.meta.url);
if(process.argv.includes('--fetch')){
 tls.setDefaultCACertificates([...new Set([...tls.getCACertificates('default'),...tls.getCACertificates('system')])]);
 const r=await fetch(source,{headers:{'User-Agent':'JourneyFocus-Prototype/0.1'},signal:AbortSignal.timeout(45000)});
 if(!r.ok)throw Error(`OSM ${r.status}`);
 await fs.mkdir(new URL('.',cache),{recursive:true});await fs.writeFile(cache,await r.text());
}
const raw=JSON.parse(await fs.readFile(cache,'utf8'));
const nodes=new Map(raw.elements.filter(e=>e.type==='node').map(n=>[n.id,n]));
const ways=raw.elements.filter(e=>e.type==='way'&&e.tags?.railway==='narrow_gauge'&&e.tags.operator==='RhB'&&!e.tags.service);
const graph=new Map();
for(const w of ways)for(let i=1;i<w.nodes.length;i++){
 const a=w.nodes[i-1],b=w.nodes[i];if(!nodes.has(a)||!nodes.has(b))throw Error('Missing rail node');
 const d=distance(nodes.get(a),nodes.get(b));
 for(const [from,to]of [[a,b],[b,a]]){if(!graph.has(from))graph.set(from,[]);graph.get(from).push({to,d,way:w.id,tunnel:w.tags.tunnel||null,bridge:w.tags.bridge||null});}
}
const start=13839385690,end=9164120795; // OSM stop_position nodes on the main track.
const dist=new Map([[start,0]]),prev=new Map(),visited=new Set();
while(true){
 let u,best=Infinity;for(const [id,d]of dist)if(!visited.has(id)&&d<best){best=d;u=id;}
 if(u===undefined)throw Error('No connected main track');if(u===end)break;visited.add(u);
 for(const e of graph.get(u)||[]){const nd=best+e.d;if(nd<(dist.get(e.to)??Infinity)){dist.set(e.to,nd);prev.set(e.to,{from:u,...e});}}
}
const steps=[];let id=end;while(id!==start){const e=prev.get(id);steps.unshift(e);id=e.from;}
// Only use a connected open-air stretch; no invented tunnel or bridge elevation.
const runs=[];let run=[];
for(const e of steps){if(e.tunnel||e.bridge){if(run.length)runs.push(run);run=[];}else run.push(e);}
if(run.length)runs.push(run);
runs.sort((a,b)=>b.reduce((n,e)=>n+e.d,0)-a.reduce((n,e)=>n+e.d,0));
const chosen=runs[0];if(!chosen)throw Error('No open stretch');
const ids=[chosen[0].from,...chosen.map(e=>e.to)];
const result={id:'bernina-open-air-pilot',name:'베르니나선 · 라고 비앙코 주변',
 corridor:'Ospizio Bernina → Alp Grüm',geometry:'osm-rail',
 attribution:'© OpenStreetMap contributors',license:'ODbL-1.0',copyrightUrl:'https://www.openstreetmap.org/copyright',
 source,retrievedAt:raw.osm3s?.timestamp_osm_base||(await fs.stat(cache)).mtime.toISOString(),
 stationNodes:{from:start,to:end},corridorMeters:Math.round(dist.get(end)),
 distanceMeters:Math.round(chosen.reduce((s,e)=>s+e.d,0)),wayIds:[...new Set(chosen.map(e=>e.way))],
 note:'Longest connected open-air stretch between station stop nodes. Excludes OSM-tagged tunnels, snow galleries and bridges. Horizontal track geometry only; ground+3m is a test camera height, not surveyed rail/window elevation. Not the full station-to-station journey.',
 points:ids.map(id=>({id,lon:nodes.get(id).lon,lat:nodes.get(id).lat}))};
await fs.mkdir(new URL('../public/alpine-pilot/',import.meta.url),{recursive:true});
await fs.writeFile(new URL('../public/alpine-pilot/route.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({points:result.points.length,meters:result.distanceMeters,corridorMeters:result.corridorMeters,wayIds:result.wayIds,first:result.points[0],last:result.points.at(-1)}));
