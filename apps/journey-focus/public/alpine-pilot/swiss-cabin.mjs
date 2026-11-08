import {configureRenderer} from '/visual-quality.mjs';
import * as T from '/vendor/three/build/three.module.js';
import {GLTFLoader} from '/vendor/three/examples/jsm/loaders/GLTFLoader.js';
import {createAvatar} from '/avatar.mjs';

export async function createSwissCabin({host,onSeat,onWindow,onCamera,onProgress,character='blue'}){
 host.innerHTML='<div class="swiss-cabin-canvas"></div><div class="seat-interaction" hidden><span id="seat-caption"></span><button id="seat-action">앉기 <kbd>E</kbd></button></div><div class="study-badge" hidden><small>공부한 시간</small><strong>00:00</strong></div><div class="cabin-instructions">WASD · 방향키로 이동 / 의자를 누르고 앉기</div><div class="swiss-pad" aria-label="횃불이 이동"><button data-walk="up" aria-label="앞으로">↑</button><button data-walk="left" aria-label="왼쪽으로">←</button><button data-walk="down" aria-label="뒤로">↓</button><button data-walk="right" aria-label="오른쪽으로">→</button></div>';
 const surface=host.querySelector('.swiss-cabin-canvas'),interaction=host.querySelector('.seat-interaction'),caption=host.querySelector('#seat-caption'),action=host.querySelector('#seat-action'),badge=host.querySelector('.study-badge');
 let disposed=false,active=true,raf=0,keys=new Set(),last=performance.now(),time=0,session={elapsed:0,state:'idle'};
 let x=0,z=2.8,heading=Math.PI,seat=null,candidate=null,target=null,waypoints=[],hover=null,snap=true;
 const renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});const releaseQuality=configureRenderer(renderer,surface);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;renderer.setClearColor(0,0);surface.append(renderer.domElement);renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','스위스 임시 객실. 방향키로 이동하고 오른쪽 좌석을 선택하세요.');
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(65,1,.035,80);
 scene.add(new T.HemisphereLight(0xf1f6ff,0xc6b8a2,3));const sun=new T.DirectionalLight(0xfff8ec,2.5);sun.position.set(3,4,2);scene.add(sun);
 for(const p of [-4,0,4]){const light=new T.PointLight(0xfff4df,7,7,1.5);light.position.set(0,2.1,p);scene.add(light);}
 const response=await fetch('/models/swiss/seats.json');if(!response.ok)throw Error('Swiss seat data unavailable');const config=await response.json();
 onProgress?.('열차와 횃불이를 불러오고 있어요.');
 let model,avatar;
 try{const result=await Promise.allSettled([new GLTFLoader().loadAsync('/models/swiss/monorail-cabin.glb'),createAvatar(character,{maxAnisotropy:renderer.capabilities.getMaxAnisotropy()})]);if(result[0].status==='fulfilled')model=result[0].value.scene;if(result[1].status==='fulfilled')avatar=result[1].value;if(!model||!avatar)throw Error('Swiss cabin model or avatar unavailable');}catch(e){avatar?.dispose();releaseQuality();renderer.dispose();throw e;}
 scene.add(model);model.traverse(o=>{if(o.isMesh){for(const m of [o.material].flat()){m.side=T.DoubleSide;if(m.name==='glass'){m.transparent=true;m.opacity=.08;m.depthWrite=false;}if(m.map)m.map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());}}});
 // Continuous interior reveals bridge the glass/wall seam on both sides.
 // These bounds are measured from the supplied model's glass, in metres.
 const reveals=new T.Group();reveals.name='MatchedWindowReveals';scene.add(reveals);
 const trim=new T.MeshStandardMaterial({color:0x626d65,roughness:.75}),rail=new T.MeshStandardMaterial({color:0xbac1ab,roughness:.8});
 const windows=[[-5.156,-4.0802],[-3.7295,-2.5174],[-2.1668,-.9546],[-.604,.6081],[.9588,2.1709],[2.5215,3.7336],[4.0832,5.159]];
 function bar(w,h,d,x,y,z,material){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);reveals.add(mesh);}
 for(const side of [-1,1]){
  for(const [a,b] of windows){
   const center=(a+b)/2,width=b-a;
   bar(.065,.045,width+.055,side*1.197,.8181,center,trim);bar(.065,.045,width+.055,side*1.197,1.71,center,trim);
   bar(.065,.8919,.045,side*1.197,1.26405,a,trim);bar(.065,.8919,.045,side*1.197,1.26405,b,trim);
  }
  bar(.09,.065,10.65,side*1.185,.765,0,rail);bar(.09,.065,10.65,side*1.185,1.77,0,rail);
  for(const end of [-5.32,5.32])bar(.12,1.12,.08,side*1.185,1.27,end,rail);
 }
 const avatarScale=.62;avatar.root.scale.setScalar(avatarScale);scene.add(avatar.root);
 const markers=config.seats.map(s=>{const material=new T.MeshBasicMaterial({color:0xf1c583,transparent:true,opacity:.64,depthWrite:false});const mesh=new T.Mesh(new T.BoxGeometry(.43,.025,.44),material);mesh.position.set(s.x,s.y+.025,s.z);mesh.userData.seat=s;mesh.visible=false;scene.add(mesh);return mesh;});
 const hitTargets=config.seats.map(s=>{const mesh=new T.Mesh(new T.BoxGeometry(.44,.68,.5),new T.MeshBasicMaterial({visible:false}));mesh.position.set(s.x,s.y+.28,s.z);mesh.userData.seat=s;scene.add(mesh);return mesh;});
 const floor=new T.Mesh(new T.PlaneGeometry(.48,10.4),new T.MeshBasicMaterial({visible:false}));floor.rotation.x=-Math.PI/2;floor.position.y=.015;scene.add(floor);
 const ray=new T.Raycaster(),pointer=new T.Vector2(),desired=new T.Vector3(),look=new T.Vector3(),direction=new T.Vector3();
 function snapshot(){return{x,z,heading,seatId:seat?.id||null,candidateId:candidate?.id||null,targetId:target?.id||null,moving:waypoints.length>0};}
 function notify(){host.dataset.seat=seat?.id||'';host.dataset.candidate=candidate?.id||'';host.dataset.target=target?.id||'';onSeat?.(seat,snapshot());}
 function stand(){if(seat)x=0;seat=null;target=null;waypoints=[];snap=true;notify();}
 function selectSeat(id){candidate=config.seats.find(s=>s.id===id)||null;if(candidate?.id===seat?.id)candidate=null;notify();}
 function confirm(){if(!candidate)return;const next=candidate;stand();candidate=null;target=next;const frontZ=next.z+Math.cos(next.heading)*.34;waypoints=[{x:0,z},{x:0,z:frontZ},{x:next.x,z:frontZ},{x:next.x,z:next.z}];notify();}
 function nearest(){return config.seats.reduce((a,b)=>Math.hypot(a.x-x,a.z-z)<Math.hypot(b.x-x,b.z-z)?a:b);}
 function act(){if(seat){stand();candidate=nearest();notify();}else{candidate??=nearest();confirm();}}
 action.onclick=()=>{act();renderer.domElement.focus({preventScroll:true});};
 const editing=e=>/^(INPUT|SELECT|TEXTAREA|BUTTON|A)$/.test(e.target?.tagName)||e.target?.isContentEditable;
 const codes=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
 function keydown(e){if(!active||document.querySelector('dialog[open]')||editing(e))return;if(codes.includes(e.code)){e.preventDefault();keys.add(e.code);}if(e.code==='KeyE'&&!e.repeat){e.preventDefault();act();}if(e.code==='KeyV'&&seat)onWindow?.();}
 function keyup(e){keys.delete(e.code);}
 function clear(){keys.clear();}
 window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);
 for(const b of host.querySelectorAll('[data-walk]')){const code={up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'}[b.dataset.walk];b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(code);};b.onpointerup=b.onpointercancel=b.onlostpointercapture=()=>keys.delete(code);}
 function cast(e){const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);return ray.intersectObjects(hitTargets,false)[0]?.object.userData.seat;}
 renderer.domElement.addEventListener('pointermove',e=>{if(!active)return;hover=cast(e);renderer.domElement.style.cursor=hover?'pointer':'default';});renderer.domElement.addEventListener('pointerleave',()=>hover=null);
 renderer.domElement.addEventListener('pointerdown',e=>{if(!active||e.button!==0)return;renderer.domElement.focus({preventScroll:true});const chosen=cast(e);if(chosen){selectSeat(chosen.id);return;}const hit=ray.intersectObject(floor)[0];if(hit){stand();candidate=null;waypoints=[{x:0,z:Math.max(config.aisleMinZ,Math.min(config.aisleMaxZ,hit.point.z))}];notify();}});
 function resize(){const r=surface.getBoundingClientRect();if(!r.width||!r.height)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();snap=true;}
 const observer=new ResizeObserver(resize);observer.observe(surface);resize();
 function render(now){raf=0;if(disposed||!active||document.hidden)return;const dt=Math.min(.05,(now-last)/1000);last=now;time+=dt;
  let dx=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')),dz=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'));let moving=false;
  if(dx||dz){if(seat||target)stand();waypoints=[];candidate=null;const n=Math.hypot(dx,dz);x=Math.max(-config.aisleHalfWidth,Math.min(config.aisleHalfWidth,x+dx/n*1.3*dt));z=Math.max(config.aisleMinZ,Math.min(config.aisleMaxZ,z+dz/n*1.3*dt));heading=Math.atan2(dx,dz);moving=true;}
  else if(waypoints.length){const point=waypoints[0],d=Math.hypot(point.x-x,point.z-z),step=1.3*dt;moving=true;if(d<=step+.002){x=point.x;z=point.z;waypoints.shift();if(!waypoints.length&&target){seat=target;heading=seat.heading;target=null;snap=true;notify();}}else{heading=Math.atan2(point.x-x,point.z-z);x+=(point.x-x)/d*step;z+=(point.z-z)/d*step;}}
  avatar.root.position.set(x,seat?seat.y-(.525-avatar.seatOffset)*avatarScale:0,z);avatar.root.rotation.y=heading;avatar.pose({seated:!!seat,moving,time});
  const nearby=!seat&&!target&&!moving?(candidate||nearest()):null;
  for(const m of markers){const chosen=m.userData.seat.id;const selected=chosen===candidate?.id||chosen===nearby?.id;m.visible=selected||chosen===hover?.id||chosen===seat?.id;m.material.color.setHex(chosen===seat?.id?0xa3dce0:selected?0xffce78:0xadd8b5);}
  if(seat){desired.set(-.05,1.62,seat.z+Math.cos(seat.heading)*.38);look.set(seat.x,seat.y+.39,seat.z);camera.fov=camera.aspect<1?80:70;}
  else{desired.set(x*.15,1.5,Math.min(5.15,z+2.0));look.set(x,.62,Math.min(z-.45,4.7));camera.fov=camera.aspect<1?72:60;}
  camera.updateProjectionMatrix();if(snap){camera.position.copy(desired);snap=false;}else camera.position.lerp(desired,Math.min(1,dt*7));camera.lookAt(look);camera.getWorldDirection(direction);onCamera?.({heading:Math.atan2(direction.x,-direction.z),pitch:Math.asin(direction.y),fov:camera.fov,x:camera.position.x,y:camera.position.y,z:camera.position.z});
  const point=new T.Vector3(x,(seat?seat.y+.83:.84),z).project(camera);const screenX=(point.x*.5+.5)*surface.clientWidth,screenY=(-point.y*.5+.5)*surface.clientHeight;
  interaction.hidden=!!target||moving||(!nearby&&!seat);interaction.style.left=`${Math.max(100,Math.min(surface.clientWidth-100,screenX+(seat?145:120)))}px`;interaction.style.top=`${Math.max(180,Math.min(surface.clientHeight-180,screenY+(seat?150:110)))}px`;caption.textContent=seat?`${seat.id} · 오른쪽 창가`:`${nearby?.id||''} · 오른쪽 창가`;action.innerHTML=seat?'일어나기 <kbd>E</kbd>':'앉기 <kbd>E</kbd>';
  if(nearby&&!candidate)candidate=nearby;
  badge.hidden=!seat||session.state==='idle';badge.style.left=`${screenX}px`;badge.style.top=`${Math.max(surface.clientWidth<760?230:150,screenY-20)}px`;
  const seconds=Math.floor(session.elapsed);badge.querySelector('strong').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;badge.querySelector('small').textContent=session.state==='paused'?'잠시 쉬는 중':'공부한 시간';
  host.dataset.position=`${x.toFixed(2)},${z.toFixed(2)}`;host.dataset.posture=seat?'seated':moving?'walking':'standing';renderer.render(scene,camera);raf=requestAnimationFrame(render);
 }
 function setActive(value){active=value;clear();if(!active){cancelAnimationFrame(raf);raf=0;}else if(!raf&&!document.hidden){last=performance.now();resize();raf=requestAnimationFrame(render);}}
 const visibility=()=>setActive(active);document.addEventListener('visibilitychange',visibility);
 onProgress?.('객실과 좌석 준비가 끝났어요.');notify();setActive(true);
 return{snapshot,selectSeat,confirmSeat:confirm,seats:config.seats,setActive,setSession(value){session=value;},dispose(){disposed=true;setActive(false);observer.disconnect();window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',clear);document.removeEventListener('visibilitychange',visibility);avatar.dispose();scene.traverse(o=>{o.geometry?.dispose();for(const m of [o.material].flat())if(m){m.map?.dispose();m.dispose();}});releaseQuality();renderer.dispose();}};
}
