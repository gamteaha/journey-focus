import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as T from '../public/vendor/three/build/three.module.js';
import {GLTFLoader} from '../public/vendor/three/examples/jsm/loaders/GLTFLoader.js';

const modelFile=new URL('../public/models/blue-flame.glb',import.meta.url);
function documentOf(buffer){assert.equal(buffer.readUInt32LE(0),0x46546c67);return JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)).toString());}
test('high-quality character embeds a repainted 4K atlas and retains the same rig and animations',async()=>{
 const bytes=await readFile(new URL('../public/models/blue-flame-hq.glb',import.meta.url)),gltf=documentOf(bytes),base=documentOf(await readFile(modelFile));
 assert.ok(bytes.length<2_000_000);assert.equal(gltf.skins[0].joints.length,13);assert.deepEqual(gltf.animations.map(a=>a.name).sort(),base.animations.map(a=>a.name).sort());
 const binary=20+bytes.readUInt32LE(12)+8;
 for(const image of gltf.images){const view=gltf.bufferViews[image.bufferView],png=bytes.subarray(binary+(view.byteOffset||0));assert.equal(png.readUInt32BE(16),4096);assert.equal(png.readUInt32BE(20),4096);}
});
test('supplied source stays intact and the runtime model contains paint, skin and all three motions',async()=>{
 const original=await readFile(new URL('../../../assets-source/characters/blue-flame/white_mesh.glb',import.meta.url));
 assert.equal(createHash('sha256').update(original).digest('hex'),'b35d7e333ac37947b8d5d72dbaec92fb562b5e6a8792069df9a0210324482c1a');
 const bytes=await readFile(modelFile),gltf=documentOf(bytes);
 assert.ok(bytes.length<2_000_000,'character asset budget');
 assert.equal(gltf.skins.length,1);
 assert.equal(gltf.skins[0].joints.length,13);
 assert.deepEqual(gltf.animations.map(a=>a.name).sort(),['Idle','Sit','Walk']);
 assert.ok(gltf.images.every(i=>i.bufferView!==undefined&&!i.uri),'paint is embedded, no remote assets');
 assert.ok(gltf.meshes.every(m=>m.primitives.every(p=>p.attributes.JOINTS_0!==undefined&&p.attributes.WEIGHTS_0!==undefined&&p.attributes.TEXCOORD_0!==undefined)));
});

test('real skin weights stay normalized and sitting moves legs while preserving the face and tail',async()=>{
 // Geometry/animation test: image decoding is irrelevant to skin deformation.
 const savedSelf=globalThis.self,savedBitmap=globalThis.createImageBitmap;
 globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:2048,height:2048,close(){}});
 try{
  const buffer=await readFile(modelFile);
  const gltf=await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),'');
  const meshes=[];gltf.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o);});
  assert.ok(meshes.length>0);
  gltf.scene.updateMatrixWorld(true);
  const sampled=[];
  for(const mesh of meshes){
   const weights=mesh.geometry.getAttribute('skinWeight'),joints=mesh.geometry.getAttribute('skinIndex');
   for(let i=0;i<weights.count;i++){
    let sum=0;for(let j=0;j<4;j++){const weight=weights.getComponent(i,j);assert.ok(weight>=0&&weight<=1);sum+=weight;assert.ok(joints.getComponent(i,j)<mesh.skeleton.bones.length);}
    assert.ok(Math.abs(sum-1)<1e-5);
    const position=mesh.getVertexPosition(i,new T.Vector3()).applyMatrix4(mesh.matrixWorld);
    sampled.push({mesh,index:i,rest:position});
   }
  }
  const mixer=new T.AnimationMixer(gltf.scene),sit=mixer.clipAction(gltf.animations.find(a=>a.name==='Sit'));
  sit.setLoop(T.LoopOnce,1);sit.clampWhenFinished=true;sit.play();mixer.update(1);
  gltf.scene.updateMatrixWorld(true);
  let changedLegs=0,tailVertices=0;
  for(const {mesh,index,rest}of sampled){
   const p=mesh.getVertexPosition(index,new T.Vector3()).applyMatrix4(mesh.matrixWorld);
   assert.ok(p.toArray().every(Number.isFinite));
   const delta=p.distanceTo(rest);
   if(rest.y>.45)assert.ok(delta<.001,'face and flame must not bend when sitting');
   if(rest.y<.10&&delta>.025)changedLegs++;
   if(rest.x>.20&&rest.y<.22&&rest.z<-.10){tailVertices++;assert.ok(delta<.025,'tail must not follow the leg bones');}
  }
  assert.ok(changedLegs>10,'legs actually bend');
  assert.ok(tailVertices>10,'tail vertices inspected');
 }finally{globalThis.self=savedSelf;globalThis.createImageBitmap=savedBitmap;}
});
