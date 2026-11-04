import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildRoute } from '../src/route.mjs';
import { makePilot, pilotPosition } from '../src/scenery.mjs';
import * as scenery from '../src/scenery.mjs';
const shape=JSON.parse(readFileSync(new URL('../public/data/baegyangri-gangchon.json',import.meta.url)));
const route=buildRoute([{name:shape.from,...shape.points[0]},{name:shape.to,...shape.points.at(-1)}],shape.from,shape.to,shape);
test('pilot follows the sourced rail segment and bounds camera travel to 300m',()=>{
 const pilot=makePilot(route);
 assert.equal(pilot.length,300);assert.equal(pilot.start,150);
 assert.ok(pilot.objects.some(o=>o.kind==='house'));
 assert.ok(pilot.objects.some(o=>o.kind==='tree'));
 assert.equal(pilotPosition(pilot,-1).lon,pilotPosition(pilot,0).lon);
 assert.equal(pilotPosition(pilot,2).lat,pilotPosition(pilot,1).lat);
 assert.deepEqual(makePilot(route).objects,pilot.objects);
 assert.throws(()=>makePilot({...route,geometry:'station-interpolation'}));
});
test('CC0 manifest and generated glTF references are local allowlisted files',()=>{
 const root=new URL('../public/assets/',import.meta.url);
 const catalog=JSON.parse(readFileSync(new URL('catalog.json',root)));
 const allowed=new Set(catalog.files.map(f=>f.path));
 for(const name of ['leafy_tree_lod/model.gltf','pine_sapling_lod/model.gltf','shrub_sorrel_01/model.gltf','grass/model.gltf','house/house.gltf','pine_sapling_small/model.gltf','shrub_03/model.gltf']){
  const gltf=JSON.parse(readFileSync(new URL(name,root)));
  for(const entry of [...gltf.buffers,...(gltf.images||[])]){
   if(entry.uri.startsWith('data:'))continue;
   const relative=name.slice(0,name.lastIndexOf('/')+1)+entry.uri;
   assert.ok(allowed.has(relative),relative);
  }
 }
});

test('grass is bounded and deterministic',()=>{const p=makePilot(route),g=p.objects.filter(o=>o.kind==='grass');assert.equal(g.length,72);assert.ok(p.objects.length<=120);assert.ok(g.every(o=>o.scale>=1&&o.scale<=1.45));});
test('mixed tree families keep natural preview heights instead of sharing incompatible scales',()=>{
 const trees=makePilot(route).objects.filter(o=>o.kind==='tree');
 assert.ok(trees.some(o=>o.variant==='leafy')&&trees.some(o=>o.variant==='pine'));
 for(const tree of trees){const height=tree.scale*(tree.variant==='leafy'?4.54396665:1.2989574084);assert.ok(height>=7&&height<=11,'trees remain approximately 8–10 metres high');}
});

function meters(a,b){return Math.hypot((a.lon-b.lon)*111320*Math.cos(a.lat*Math.PI/180),(a.lat-b.lat)*111320);}
test('grass clears the camera corridor and house foundations while forming varied clusters',()=>{
 const p=makePilot(route),g=p.objects.filter(o=>o.kind==='grass'),houses=p.objects.filter(o=>o.kind==='house');
 for(const blade of g){
  assert.ok(houses.every(h=>meters(h,blade)>9),'grass must not intersect a house');
  let clearance=Infinity;
  for(let i=0;i<=300;i++)clearance=Math.min(clearance,meters(blade,pilotPosition(p,i/300)));
  assert.ok(clearance>=6,'camera corridor remains clear');
 }
 const nearest=g.map((a,i)=>Math.min(...g.filter((_,j)=>j!==i).map(b=>meters(a,b))));
 assert.ok(nearest.some(d=>d<5),'grass grows in close groups');
 const along=g.map(a=>meters(pilotPosition(p,0),a)).sort((a,b)=>a-b);
 assert.ok(along.some((d,i)=>i&&d-along[i-1]>6),'groups leave open spaces');
});
test('house support spans the complete footprint, and missing terrain never becomes zero elevation',()=>{
 assert.equal(typeof scenery.houseFootprint,'function');
 const h={lon:127.61,lat:37.82,heading:0};
 const points=scenery.houseFootprint(h);
 assert.equal(points.length,9);
 assert.ok(Math.max(...points.map(p=>meters(h,p)))>7);
 assert.deepEqual(scenery.houseSupport([40,40,40]),{base:40.04,bottom:39.75,depth:.29,range:0});
 const slope=scenery.houseSupport([40,41,42]);
 assert.equal(slope.base,42.04);assert.ok(slope.depth>2);assert.equal(slope.range,2);
 assert.equal(scenery.houseSupport([40,undefined]),null);
 assert.equal(scenery.houseSupport([]),null);
});
test('house facing can vary without rotating the search corridor into the railway',()=>{
 const house=makePilot(route).objects.find(o=>o.kind==='house');assert.ok(Number.isFinite(house.railHeading));
 const first=scenery.houseCandidates(house),turned=scenery.houseCandidates({...house,heading:house.heading+90});
 assert.deepEqual(first.map(({lon,lat})=>({lon,lat})),turned.map(({lon,lat})=>({lon,lat})), 'placement follows the rail independently of facade direction');
});
test('grass mesh has tapered bent leaves, varied colour and explicit lighting normals within budget',()=>{
 const asset=JSON.parse(readFileSync(new URL('../public/assets/grass/model.gltf',import.meta.url)));
 const primitive=asset.meshes[0].primitives[0];
 assert.ok(Number.isInteger(primitive.attributes.NORMAL));
 assert.ok(Number.isInteger(primitive.attributes.COLOR_0));
 const count=asset.accessors[primitive.attributes.POSITION].count;
 assert.ok(count>300&&count<5000);
 assert.ok(count/3*72<=100000,'all grass stays below a 100k triangle budget');
 assert.equal(asset.materials[0].doubleSided,true);
});
