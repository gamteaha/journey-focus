import * as T from '/vendor/three/build/three.module.js';
import {characterById} from '/src/boarding.mjs';

// Replace this group with the user's rigged character when a model is available.
export function createAvatar(character='blue'){
 const palette=characterById(character);
 const root=new T.Group(),blue=new T.MeshStandardMaterial({color:palette.color,roughness:.7}),white=new T.MeshStandardMaterial({color:0xf8f6e7,roughness:.8}),navy=new T.MeshStandardMaterial({color:palette.suit,roughness:.8}),yellow=new T.MeshStandardMaterial({color:0xffd456,roughness:.75}),dark=new T.MeshStandardMaterial({color:0x172a46});
 function ball(parent,material,x,y,z,sx,sy,sz){const m=new T.Mesh(new T.SphereGeometry(1,20,14),material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;}
 ball(root,navy,0,.60,0,.19,.22,.14);ball(root,blue,0,1.0,0,.28,.30,.24);
 const flame=new T.Mesh(new T.ConeGeometry(.16,.34,20),blue);flame.position.set(.075,1.31,-.02);flame.rotation.z=-.22;root.add(flame);
 ball(root,white,0,1.0,.205,.205,.215,.06);
 for(const x of [-.13,.13]){ball(root,white,x,1.20,.12,.075,.075,.04);ball(root,dark,x*.65,1.045,.264,.024,.030,.012);ball(root,yellow,x, .97,.253,.045,.04,.012);}
 ball(root,navy,0,1.005,.273,.035,.024,.016);ball(root,dark,0,.956,.267,.027,.01,.01);
 const arms=[],legs=[];
 for(const sign of [-1,1]){
  const arm=new T.Group();arm.position.set(sign*.20,.74,0);ball(arm,white,sign*.035,-.12,0,.065,.15,.065);ball(arm,navy,sign*.035,-.23,0,.068,.045,.07);root.add(arm);arms.push(arm);
  const thigh=new T.Group();thigh.position.set(sign*.085,.43,0);ball(thigh,navy,0,-.11,0,.073,.13,.075);const shin=new T.Group();shin.position.y=-.21;ball(shin,white,0,-.095,0,.065,.11,.065);ball(shin,navy,0,-.18,.035,.073,.055,.11);thigh.add(shin);root.add(thigh);legs.push({thigh,shin});
 }
 const tail=new T.Mesh(new T.ConeGeometry(.07,.22,12),blue);tail.position.set(.18,.47,-.23);tail.rotation.x=-1.0;root.add(tail);
 root.name='temporary-player';
 root.userData.character=palette.id;
 return {root,setCharacter(id){const c=characterById(id);blue.color.set(c.color);navy.color.set(c.suit);root.userData.character=c.id;},pose({seated=false,moving=false,time=0}){for(let i=0;i<2;i++){const swing=moving?Math.sin(time*9+i*Math.PI)*.50:0;arms[i].rotation.x=seated?-.15:-swing;legs[i].thigh.rotation.x=seated?-Math.PI/2:swing;legs[i].shin.rotation.x=seated?Math.PI/2:Math.max(0,-swing)*.5;}root.children[0].rotation.z=moving?Math.sin(time*9)*.025:0;}};
}
