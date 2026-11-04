// Small, deterministic grass clump. Project-authored geometry, no textures.
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root=new URL('../public/assets/',import.meta.url);
const vertices=[];
function random(i){const n=Math.sin(i*127.1+31.7)*43758.5453;return n-Math.floor(n);}
function triangle(a,b,c,color){
 const u=b.map((v,i)=>v-a[i]),v=c.map((n,i)=>n-a[i]);
 const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...n);
 for(const p of [a,b,c])vertices.push(...p,...n.map(x=>x/length),...color.map(x=>x*(.68+.32*p[1])));
}
for(let i=0;i<256;i++){
 const angle=random(i+1)*Math.PI*2,radius=Math.sqrt(random(i+100))*1.3;
 const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius,direction=random(i+200)*Math.PI*2;
 const h=.22+random(i+300)*.49,w=.018+random(i+400)*.018,bend=.12+random(i+500)*.24;
 const color=[.20+random(i+600)*.11,.32+random(i+700)*.17,.07+random(i+800)*.08];
 let previous;
 for(let segment=0;segment<=3;segment++){
  const t=segment/3,spread=w*(1-t),cx=x+Math.cos(direction)*bend*t*t,cz=z+Math.sin(direction)*bend*t*t;
  const current=[[cx-Math.sin(direction)*spread,h*t,cz+Math.cos(direction)*spread],[cx+Math.sin(direction)*spread,h*t,cz-Math.cos(direction)*spread]];
  if(previous){triangle(previous[0],previous[1],current[0],color);if(segment<3)triangle(previous[1],current[1],current[0],color);}
  previous=current;
 }
}
const data=Buffer.from(new Float32Array(vertices).buffer);
const count=vertices.length/9;
const min=[0,1,2].map(k=>Math.min(...Array.from({length:count},(_,i)=>vertices[i*9+k]))),max=[0,1,2].map(k=>Math.max(...Array.from({length:count},(_,i)=>vertices[i*9+k])));
const gltf={asset:{version:'2.0',generator:'Journey Focus grass generator'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1,COLOR_0:2},material:0}]}],materials:[{doubleSided:true,pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:1}}],buffers:[{byteLength:data.length,uri:'data:application/octet-stream;base64,'+data.toString('base64')}],bufferViews:[{buffer:0,byteOffset:0,byteLength:data.length,byteStride:36,target:34962}],accessors:[{bufferView:0,byteOffset:0,componentType:5126,count,type:'VEC3',min,max},{bufferView:0,byteOffset:12,componentType:5126,count,type:'VEC3'},{bufferView:0,byteOffset:24,componentType:5126,count,type:'VEC3'}]};
mkdirSync(new URL('grass/',root),{recursive:true});
const output=JSON.stringify(gltf);
writeFileSync(new URL('grass/model.gltf',root),output);
const catalog=JSON.parse(readFileSync(new URL('catalog.json',root)));
catalog.files=catalog.files.filter(f=>f.path!=='grass/model.gltf');
catalog.files.push({path:'grass/model.gltf',bytes:Buffer.byteLength(output),sha256:createHash('sha256').update(output).digest('hex')});
catalog.sources=catalog.sources.filter(s=>s.id!=='journey-focus-grass');
catalog.sources.push({id:'journey-focus-grass',source:'scripts/build-scenery-grass.mjs',license:'project-owned geometry'});
writeFileSync(new URL('catalog.json',root),JSON.stringify(catalog,null,2)+'\n');
