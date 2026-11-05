import * as T from '/vendor/three/build/three.module.js';
import {GLTFLoader} from '/vendor/three/examples/jsm/loaders/GLTFLoader.js';
import {characterById} from '/src/boarding.mjs';

export async function createAvatar(character='blue',{onProgress}={}){
 const gltf=await new GLTFLoader().loadAsync('/models/blue-flame.glb',onProgress);
 const root=gltf.scene,rig=root.getObjectByName('FlameRig');
 if(!rig||!gltf.animations?.length)throw new Error('캐릭터 관절 데이터를 불러오지 못했습니다.');
 root.name='supplied-player';root.userData.source='blue-flame.glb';
 const height=Number(rig.userData.avatarHeight)||1.25,hipHeight=Number(rig.userData.avatarHipHeight)||.11875;
 const mixer=new T.AnimationMixer(root),actions=new Map(gltf.animations.map(clip=>[clip.name,mixer.clipAction(clip)]));
 for(const name of ['Idle','Walk','Sit'])if(!actions.has(name))throw new Error('캐릭터 동작이 누락되었습니다.');
 let current=null,lastTime=null;
 const materials=new Set();root.traverse(o=>{if(o.isMesh)for(const m of [o.material].flat())materials.add(m);});
 const originalMap=[...materials].find(m=>m.map)?.map;
 const maps=new Map([['blue',originalMap]]);
 function mapFor(palette){
  if(maps.has(palette.id))return maps.get(palette.id);
  if(!originalMap?.image)return originalMap;
  const image=originalMap.image,canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),data=pixels.data;
  const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
  const replacements=[{from:[49,95,193],to:rgb(palette.color)},{from:[38,52,82],to:rgb(palette.suit)}];
  for(let i=0;i<data.length;i+=4){
   for(const {from,to}of replacements){
    if(Math.abs(data[i]-from[0])+Math.abs(data[i+1]-from[1])+Math.abs(data[i+2]-from[2])<35){
     data[i]=to[0];data[i+1]=to[1];data[i+2]=to[2];break;
    }
   }
  }
  ctx.putImageData(pixels,0,0);
  const texture=new T.CanvasTexture(canvas);texture.flipY=false;texture.colorSpace=T.SRGBColorSpace;
  texture.wrapS=originalMap.wrapS;texture.wrapT=originalMap.wrapT;
  maps.set(palette.id,texture);return texture;
 }
 function setCharacter(id){
  const palette=characterById(id),map=mapFor(palette);
  for(const material of materials){if(material.map){material.map=map;material.needsUpdate=true;}}
  root.userData.character=palette.id;
 }
 setCharacter(character);
 return {
  root,height,seatOffset:.525-hipHeight,
  setCharacter,
  pose({seated=false,moving=false,time=0}={}){
   const name=seated?'Sit':moving?'Walk':'Idle';
   if(name!==current){
    const previous=actions.get(current),next=actions.get(name);
    next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1);
    next.setLoop(name==='Sit'?T.LoopOnce:T.LoopRepeat,name==='Sit'?1:Infinity);next.clampWhenFinished=name==='Sit';next.play();
    if(previous){previous.fadeOut(.18);next.fadeIn(.18);}
    current=name;
   }
   const delta=lastTime===null?0:Math.max(0,Math.min(.1,time-lastTime));lastTime=time;mixer.update(delta);
   root.userData.pose=name;root.updateMatrixWorld(true);
  },
  dispose(){mixer.stopAllAction();mixer.uncacheRoot(root);for(const texture of new Set(maps.values()))texture?.dispose();},
 };
}
