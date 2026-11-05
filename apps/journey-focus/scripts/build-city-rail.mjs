// Derive a connected Line 2 surface corridor from the official OSM read API.
// No VWorld assets or credentials are read or stored.
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {distance} from '../src/route.mjs';
const cache=fileURLToPath(new URL('../../../tmp/city-rail-source/',import.meta.url));
const bboxes=['127.037,37.545,127.055,37.562','127.068,37.529,127.097,37.548','127.084,37.511,127.110,37.536'];
const sources=bboxes.map(b=>'https://api.openstreetmap.org/api/0.6/map.json?bbox='+b);
await fs.mkdir(cache,{recursive:true});
const tiles=await Promise.all(sources.map(async(source,i)=>{
 const file=cache+`tile-${i}.json`;
 if(process.argv.includes('--cached'))return JSON.parse(await fs.readFile(file,'utf8'));
 const response=await fetch(source,{headers:{'User-Agent':'JourneyFocus-Prototype/0.1'},signal:AbortSignal.timeout(45000)});
 if(!response.ok)throw Error('OSM request failed: '+response.status);
 const raw=await response.text();await fs.writeFile(file,raw);return JSON.parse(raw);
}));
const elements=new Map(tiles.flatMap(t=>t.elements).map(e=>[e.type+e.id,e]));
const wayIds=[1458437482,625534094,628671356,628671358];
const ids=[];
for(const id of wayIds){
 const way=elements.get('way'+id);
 if(!way||way.tags?.railway!=='subway'||way.tags?.name!=='2호선'||way.tags?.tunnel)throw Error('Unexpected rail way '+id);
 if(ids.length&&ids.at(-1)!==way.nodes[0])throw Error('Disconnected source ways');
 ids.push(...(ids.length?way.nodes.slice(1):way.nodes));
}
const nodes=ids.map(id=>{const n=elements.get('node'+id);if(!n)throw Error('Missing source node');return{id,lon:n.lon,lat:n.lat};});
// Reference station centres verified against Seoul T Data's GEOM response.
const stations=[['한양대',127.043655,37.555273],['뚝섬',127.047367,37.547184],['성수',127.055961,37.544581],['건대입구',127.069191,37.540373],['구의',127.085916,37.537077],['강변',127.094681,37.535095],['잠실나루',127.10379,37.520733]].map(([name,lon,lat])=>({name,lon,lat}));
const lengths=[0];for(let i=1;i<nodes.length;i++)lengths.push(lengths.at(-1)+distance(nodes[i-1],nodes[i]));
const anchors=stations.map(station=>{
 let best;
 for(let i=0;i<nodes.length-1;i++){
  const a=nodes[i],b=nodes[i+1],c=Math.cos(station.lat*Math.PI/180),dx=(b.lon-a.lon)*c,dy=b.lat-a.lat;
  const t=Math.max(0,Math.min(1,(((station.lon-a.lon)*c)*dx+(station.lat-a.lat)*dy)/(dx*dx+dy*dy)));
  const p={lon:a.lon+(b.lon-a.lon)*t,lat:a.lat+(b.lat-a.lat)*t},offset=distance(station,p);
  if(!best||offset<best.offsetMeters)best={...p,name:station.name,offsetMeters:offset,along:lengths[i]+distance(a,p)};
 }
 if(best.offsetMeters>150)throw Error('Station is too far from the source rail: '+station.name);
 return best;
});
if(!anchors.every((a,i)=>!i||a.along>anchors[i-1].along))throw Error('Station anchors out of order');
const combined=[...nodes.map((p,i)=>({...p,along:lengths[i]})),...anchors].filter(p=>p.along>=anchors[0].along&&p.along<=anchors.at(-1).along).sort((a,b)=>a.along-b.along);
const points=[],stationAnchors=[];
for(const p of combined){
 if(!points.length||distance(points.at(-1),p)>.001)points.push({...(p.id?{id:p.id}:{}),lon:p.lon,lat:p.lat});
 if(p.name)stationAnchors.push({name:p.name,pointIndex:points.length-1,offsetMeters:Math.round(p.offsetMeters*10)/10});
}
const result={id:'line2-surface-osm',from:stations[0].name,to:stations.at(-1).name,geometry:'osm-rail',license:'ODbL-1.0',attribution:'© OpenStreetMap contributors',copyrightUrl:'https://www.openstreetmap.org/copyright',stationSource:'https://t-data.seoul.go.kr/category/dataviewopenapi.do?data_id=1036',sources,wayIds,retrievedAt:new Date().toISOString(),stationAnchors,note:'Connected horizontal rail geometry; station centres projected onto existing source segments without shifting the track. Elevation and operational direction are not surveyed. Focus time is not the real train timetable.',points};
await fs.writeFile(new URL('../public/data/line2-surface.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({points:points.length,stations:stationAnchors,distanceMetres:Math.round(anchors.at(-1).along-anchors[0].along)}));
