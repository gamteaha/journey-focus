import * as T from '/vendor/three/build/three.module.js';
import {FBXLoader} from '/vendor/three/examples/jsm/loaders/FBXLoader.js';
import {createCabinState,CABIN_SEATS,cabinStudyFrame} from '/src/cabin.mjs';
import {createAvatar} from '/avatar.mjs';
import {formatTime} from '/src/session.mjs';

export async function createCabin({host,onSeatChange,onWindow,onState,onProgress,character='blue'}){
 let controller=createCabinState();let active=true,disposed=false,ready=false,last=performance.now(),time=0,lastUi='';
 let study={state:'idle',elapsed:0,duration:0},cameraSnap=true;
 host.innerHTML=`<div class="cabin-canvas" id="cabin-canvas"></div><div class="cabin-interaction" id="cabin-interaction"><span id="cabin-status" role="status">앉고 싶은 의자를 골라 주세요</span><div><button id="cabin-sit">앉기 <kbd>E</kbd></button><button id="cabin-stand" hidden>일어나기 <kbd>E</kbd></button><button id="cabin-window" hidden>창밖 보기 ↗</button></div></div><div class="cabin-help">WASD / 방향키로 이동 <span>·</span> 의자를 누르고 앉기</div><div class="cabin-pad" aria-label="캐릭터 이동"><button data-walk="up" aria-label="앞으로 이동">↑</button><button data-walk="left" aria-label="왼쪽 이동">←</button><button data-walk="down" aria-label="뒤로 이동">↓</button><button data-walk="right" aria-label="오른쪽 이동">→</button></div>`;
 const $=id=>host.querySelector('#'+id),surface=$('cabin-canvas'),keys=new Set(),held=new Set();
 const studyBadge=document.createElement('div');studyBadge.id='cabin-study-clock';studyBadge.className='cabin-study-clock';studyBadge.hidden=true;studyBadge.setAttribute('role','timer');studyBadge.setAttribute('aria-live','off');studyBadge.setAttribute('aria-label','공부한 누적 시간');studyBadge.innerHTML='<span>공부한 시간</span><strong id="cabin-study-elapsed">00:00</strong><small id="cabin-study-state">집중 중</small>';host.append(studyBadge);
 function setStudySession(value={}){
  const state=['idle','running','paused','completed','stopped'].includes(value.state)?value.state:'idle',duration=Number.isFinite(value.duration)&&value.duration>0?Math.min(86400,value.duration):0,elapsed=Number.isFinite(value.elapsed)?Math.floor(Math.max(0,Math.min(duration,value.elapsed))):0;
  if(study.state==='idle'&&state!=='idle')cameraSnap=true;
  study={state,duration,elapsed};host.dataset.studyElapsed=String(elapsed);studyBadge.dataset.state=state;
  $('cabin-study-elapsed').textContent=formatTime(elapsed);$('cabin-study-state').textContent=state==='paused'?'잠시 쉬는 중':state==='completed'?'집중 완료':state==='stopped'?'이번 여정의 기록':'집중 중';
  if(!duration||state==='idle')studyBadge.hidden=true;
 }
 const scene=new T.Scene();scene.background=new T.Color(0xb4cecd);scene.fog=new T.Fog(0xb4cecd,25,65);
 const renderer=new T.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','객실 3D 화면. 방향키 또는 WASD로 이동하고 좌석을 클릭하세요.');surface.prepend(renderer.domElement);
 const camera=new T.PerspectiveCamera(65,1,.04,100);camera.position.set(.25,1.65,3.4);
 scene.add(new T.HemisphereLight(0xe5f4ff,0x726c52,2.5));const sun=new T.DirectionalLight(0xfff2da,2);sun.position.set(-2,5,2);scene.add(sun);
 for(const z of [-6,0,6]){const light=new T.PointLight(0xfff5df,9,9,1.2);light.position.set(0,2.45,z);scene.add(light);}
 const avatar=createAvatar(character);scene.add(avatar.root);host.dataset.character=avatar.root.userData.character;
 const shadow=new T.Mesh(new T.CircleGeometry(.26,24),new T.MeshBasicMaterial({color:0x203339,transparent:true,opacity:.20,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.015;scene.add(shadow);
 const raycaster=new T.Raycaster(),pointer=new T.Vector2(),floor=new T.Mesh(new T.PlaneGeometry(.94,16),new T.MeshBasicMaterial({visible:false}));floor.rotation.x=-Math.PI/2;floor.position.y=.02;scene.add(floor);
 const markers=[],highlights=new Map();let hoverSeatId=null;
 for(const seat of CABIN_SEATS){
  const highlight=new T.Group(),mat=new T.MeshBasicMaterial({color:0x8ff5d1,transparent:true,opacity:.65,depthWrite:false,side:T.DoubleSide});
  const cushion=new T.Mesh(new T.BoxGeometry(.46,.035,.43),mat);cushion.position.set(seat.x,.565,seat.z);highlight.add(cushion);
  const back=new T.Mesh(new T.BoxGeometry(.035,.43,.43),mat);back.position.set(seat.x+Math.sign(seat.x)*.21,.80,seat.z);highlight.add(back);
  highlight.visible=false;scene.add(highlight);highlights.set(seat.id,{group:highlight,material:mat});
  const hit=new T.Mesh(new T.BoxGeometry(.48,.8,.43),new T.MeshBasicMaterial({visible:false}));hit.position.set(seat.x,.80,seat.z);hit.userData.seatId=seat.id;scene.add(hit);markers.push(hit);
 }
 const backdrop=new T.Mesh(new T.BoxGeometry(40,12,40),new T.MeshBasicMaterial({color:0xb4cecd,side:T.BackSide}));scene.add(backdrop);
 const materials={SubwayBody_Rough:[0xc9ceca,.75,.15],SubwayBody_Refl:[0xa8b6b5,.38,.55],Carbon:[0x4d5755,.95,0],Rubber:[0x263131,.95,0],metal_rough:[0xbdc8c4,.38,.65],Plastic:[0xe2dfce,.72,0],Ceiling:[0xe4e7db,.8,0],Seats:[0x538d8b,.85,0],'Seats.color':[0x426d83,.8,0],Yellow:[0xe5bc60,.6,.15],DarkMetal:[0x495a59,.5,.55],Subway_Roof:[0xdbe0d5,.8,.15]};
 try{
  onProgress?.({phase:'download',loaded:0,total:0});
  const model=await new FBXLoader().loadAsync('/models/subway-car.fbx',event=>onProgress?.({phase:'download',loaded:event.loaded,total:event.lengthComputable?event.total:0}));
  if(disposed)return null;
  onProgress?.({phase:'materials'});
  model.traverse(m=>{if(!m.isMesh)return;const source=Array.isArray(m.material)?m.material:[m.material];m.material=source.map(old=>{if(/Glass/.test(old.name))return new T.MeshStandardMaterial({name:old.name,color:0x99b9bd,roughness:.4,metalness:.05,side:T.DoubleSide});const values=materials[old.name]||[0xd5ddcd,.8,0];const mat=new T.MeshStandardMaterial({name:old.name,color:values[0],roughness:values[1],metalness:values[2],side:T.DoubleSide});if(/Lgt|Light/.test(old.name)){mat.color.setHex(0xfff8d7);mat.emissive.setHex(0xfff0bf);mat.emissiveIntensity=.7;}return mat;});source.forEach(mat=>mat.dispose());});
  model.rotation.y=Math.PI/2;model.scale.setScalar(.004);model.position.set(-238.399536*.004,400*.004,0);scene.add(model);model.name='supplied-subway-car';ready=true;
 }catch{renderer.dispose();throw new Error('객실 모델을 불러오지 못했습니다.');}
 function resize(){const r=surface.getBoundingClientRect();if(r.width<1||r.height<1)return;renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}
 const observer=new ResizeObserver(resize);observer.observe(surface);resize();
 function selectSeat(id){if(!ready||!controller.previewSeat(id))return;renderer.domElement.focus({preventScroll:true});sync(controller.snapshot());}
 function availableSeat(s){if(s.candidateSeatId)return CABIN_SEATS.find(seat=>seat.id===s.candidateSeatId);if(s.seatId||s.targetSeatId||s.moving)return null;return controller.nearestSeat();}
 function sync(s){const candidate=availableSeat(s),signature=[s.seatId,s.targetSeatId,s.posture,s.candidateSeatId,candidate?.id,hoverSeatId].join('|');if(signature===lastUi)return;lastUi=signature;
  host.dataset.posture=s.posture;host.dataset.seat=s.seatId||'';
  host.dataset.candidate=candidate?.id||'';host.dataset.hover=hoverSeatId||'';
  $('cabin-status').textContent=candidate?`${candidate.id} · ${candidate.side==='A'?'왼쪽':'오른쪽'} 창가`:s.seatId?`${s.seatId} · 나의 창가 자리`:s.targetSeatId?`${s.targetSeatId} 자리로 이동 중…`:'의자를 눌러 자리를 골라 주세요';
  $('cabin-sit').hidden=!candidate;$('cabin-stand').hidden=!s.seatId&&!s.targetSeatId;$('cabin-stand').disabled=false;$('cabin-window').hidden=!s.seatId;
  $('cabin-stand').innerHTML=s.targetSeatId?'이동 취소':'일어나기 <kbd>E</kbd>';
  for(const [id,h]of highlights){const selected=id===s.seatId||id===s.targetSeatId||id===candidate?.id;h.group.visible=selected||id===hoverSeatId;h.material.color.setHex(id===s.seatId?0xa5e4ff:selected?0xffd779:0x8ff5d1);h.material.opacity=selected ? .67 : .42;}
  onSeatChange?.(CABIN_SEATS.find(seat=>seat.id===s.seatId)||null);onState?.(s);
 }
 $('cabin-sit').onclick=()=>{const candidate=availableSeat(controller.snapshot());if(candidate){controller.previewSeat(candidate.id);controller.confirmSeat();sync(controller.snapshot());renderer.domElement.focus({preventScroll:true});}};$('cabin-stand').onclick=()=>{controller.stand();controller.clearPreview();sync(controller.snapshot());renderer.domElement.focus({preventScroll:true});};$('cabin-window').onclick=()=>onWindow?.();
 const isEditing=e=>/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target?.tagName)||e.target?.isContentEditable;
 function keydown(e){if(!active||!ready||isEditing(e)||document.querySelector('dialog[open]'))return;if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyE'].includes(e.code)){e.preventDefault();e.stopPropagation();if(e.code==='KeyE'&&!e.repeat){const s=controller.snapshot();if(s.candidateSeatId)$('cabin-sit').click();else if(s.seatId||s.targetSeatId)$('cabin-stand').click();else $('cabin-sit').click();}else keys.add(e.code);}}
 function keyup(e){keys.delete(e.code);}function clearInput(){keys.clear();held.clear();}
 window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',clearInput);document.addEventListener('visibilitychange',clearInput);
 for(const b of host.querySelectorAll('[data-walk]')){b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);held.add(b.dataset.walk);};b.onpointerup=b.onpointercancel=()=>held.delete(b.dataset.walk);b.onlostpointercapture=()=>held.delete(b.dataset.walk);}
 function cast(e){const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const s=controller.snapshot(),targets=study.duration>0&&study.state!=='idle'&&s.seatId?markers.filter(m=>Math.sign(m.position.x)===Math.sign(s.x)):markers;return raycaster.intersectObjects(targets,false)[0]?.object.userData.seatId||null;}
 renderer.domElement.addEventListener('pointermove',e=>{if(!active||!ready||e.pointerType==='touch')return;hoverSeatId=cast(e);renderer.domElement.style.cursor=hoverSeatId?'pointer':'default';sync(controller.snapshot());});
 renderer.domElement.addEventListener('pointerleave',()=>{hoverSeatId=null;sync(controller.snapshot());});
 renderer.domElement.addEventListener('pointerdown',e=>{if(!active||!ready||e.button!==0)return;renderer.domElement.focus({preventScroll:true});const id=cast(e);if(id){selectSeat(id);return;}const hit=raycaster.intersectObject(floor,false)[0];if(hit){controller.clearPreview();controller.moveTo(hit.point.x,hit.point.z);sync(controller.snapshot());}});
 const desired=new T.Vector3(),look=new T.Vector3();
 function render(now){if(disposed)return;const dt=Math.min(.05,(now-last)/1000);last=now;if(!active)return;time+=dt;
  const input={x:Number(keys.has('KeyD')||keys.has('ArrowRight')||held.has('right'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')||held.has('left')),z:Number(keys.has('KeyS')||keys.has('ArrowDown')||held.has('down'))-Number(keys.has('KeyW')||keys.has('ArrowUp')||held.has('up'))};
  const s=ready?controller.update(dt,input):controller.snapshot();avatar.root.position.set(s.x,s.seatId ? .09 : 0,s.z);avatar.root.rotation.y=s.heading;avatar.pose({seated:!!s.seatId,moving:s.moving,time});shadow.position.set(s.x,.015,s.z);sync(s);
  host.dataset.position=`${s.x.toFixed(2)},${s.z.toFixed(2)}`;
  const started=study.duration>0&&study.state!=='idle',frame=started&&s.seatId?cabinStudyFrame(s.seatId,camera.aspect,surface.clientHeight):null;
  host.dataset.cameraMode=frame?'study':'follow';
  if(frame)for(const [id,h]of highlights)h.group.visible=id===hoverSeatId||Boolean(s.candidateSeatId)&&(id===s.candidateSeatId||id===s.seatId);
  if(frame){desired.fromArray(frame.position);look.fromArray(frame.target);}else{const fromEnd=s.z>5.5;desired.set(s.seatId?Math.sign(s.x)*-.20:s.x*.45,1.72,fromEnd?s.z-3.1:Math.min(8.05,s.z+3.1));look.set(s.x*.7,.93,s.z+(fromEnd ? .6 : -.6));}
  const fov=frame?.fov||65;if(camera.fov!==fov){camera.fov=fov;camera.updateProjectionMatrix();}
  if(cameraSnap){camera.position.copy(desired);cameraSnap=false;}else camera.position.lerp(desired,1-Math.exp(-dt*5));camera.lookAt(look);renderer.render(scene,camera);
  const bubble=$('cabin-interaction'),point=new T.Vector3(s.x,.22,s.z).project(camera),w=surface.clientWidth,h=surface.clientHeight;
  const bw=bubble.offsetWidth||180,bh=bubble.offsetHeight||70;let bx=(point.x+1)*w/2+42;if(bx+bw>w-20)bx=(point.x+1)*w/2-bw-32;
  bubble.style.left=`${Math.max(12,Math.min(w-bw-12,bx))}px`;bubble.style.top=`${Math.max(Math.min(138,h*.24),Math.min(h-bh-100,(1-point.y)*h/2-bh*.5))}px`;
  const head=new T.Vector3(s.x,avatar.root.position.y+1.65,s.z).project(camera);
  studyBadge.hidden=!started||head.z<-1||head.z>1;
  if(!studyBadge.hidden){const bw=studyBadge.offsetWidth||128,bh=studyBadge.offsetHeight||70;studyBadge.style.left=`${Math.max(10,Math.min(w-bw-10,(head.x+1)*w/2-bw/2))}px`;studyBadge.style.top=`${Math.max(h<500?82:w<760?145:112,Math.min(h-bh-20,(1-head.y)*h/2-bh-12))}px`;}
  if(frame&&h<500)bubble.style.setProperty('--study-actions-x',`${head.x>=0?12:Math.max(12,w-bubble.offsetWidth-12)}px`);
  renderer.domElement.dataset.camera=JSON.stringify({position:camera.position.toArray(),target:look.toArray(),aspect:camera.aspect,fov:camera.fov,mode:frame?'study':'follow'});
 }
 onProgress?.({phase:'shaders'});
 // Compile materials and upload buffers while the parent still covers this
 // frame with the arrival screen. Ready means rendered, not just downloaded.
 await renderer.compileAsync(scene,camera);
 for(let i=0;i<3;i++){await new Promise(requestAnimationFrame);render(performance.now());}
 renderer.setAnimationLoop(render);host.dataset.ready=String(ready);sync(controller.snapshot());onProgress?.({phase:'ready'});
 return {get seat(){return CABIN_SEATS.find(s=>s.id===controller.snapshot().seatId)||null;},snapshot:()=>controller.snapshot(),setSession:setStudySession,setCharacter(id){avatar.setCharacter(id);host.dataset.character=avatar.root.userData.character;},reset(){controller=createCabinState();setStudySession();cameraSnap=true;clearInput();hoverSeatId=null;lastUi='';sync(controller.snapshot());},setActive(value){active=Boolean(value);clearInput();last=performance.now();renderer.setAnimationLoop(active?render:null);if(active){cameraSnap=true;observer.observe(surface);resize();requestAnimationFrame(()=>renderer.domElement.focus({preventScroll:true}));}},suspend(){if(disposed)return;active=false;clearInput();observer.disconnect();renderer.setAnimationLoop(null);},dispose(){if(disposed)return;disposed=true;observer.disconnect();renderer.setAnimationLoop(null);window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',clearInput);document.removeEventListener('visibilitychange',clearInput);scene.traverse(o=>{o.geometry?.dispose();for(const m of [o.material].flat().filter(Boolean))m.dispose();});renderer.dispose();renderer.forceContextLoss();host.replaceChildren();}};
}
