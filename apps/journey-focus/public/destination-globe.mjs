import * as THREE from '/vendor/three/build/three.module.js';

export async function createGlobe({canvas,container,pins,places}){
 const response=await fetch('/world-land.json');if(!response.ok)throw Error('World map unavailable');const land=await response.json();
 const textureCanvas=document.createElement('canvas');textureCanvas.width=2048;textureCanvas.height=1024;const ctx=textureCanvas.getContext('2d');
 ctx.fillStyle='#acc5c3';ctx.fillRect(0,0,2048,1024);
 ctx.strokeStyle='#d2ded2';ctx.lineWidth=1;
 for(let lon=0;lon<2048;lon+=2048/24){ctx.beginPath();ctx.moveTo(lon,0);ctx.lineTo(lon,1024);ctx.stroke();}
 for(let lat=0;lat<1024;lat+=1024/12){ctx.beginPath();ctx.moveTo(0,lat);ctx.lineTo(2048,lat);ctx.stroke();}
 ctx.fillStyle='#f1e8cf';ctx.strokeStyle='#b1b49a';ctx.lineWidth=1.3;
 for(const geometry of land.geometry){
  const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
  for(const polygon of polygons){ctx.beginPath();for(const ring of polygon){ring.forEach(([lon,lat],i)=>{const x=(lon+180)/360*2048,y=(90-lat)/180*1024;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();}ctx.fill('evenodd');ctx.stroke();}
 }
 const texture=new THREE.CanvasTexture(textureCanvas);texture.colorSpace=THREE.SRGBColorSpace;
 const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1.3,1.3,1.3,-1.3,.1,20);camera.position.set(0,0,5);
 const group=new THREE.Group();scene.add(group);const geometry=new THREE.SphereGeometry(1,72,48);
 const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({map:texture,roughness:1,metalness:0}));mesh.rotation.y=-Math.PI/2;group.add(mesh);
 scene.add(new THREE.AmbientLight(0xffffff,2.1));const light=new THREE.DirectionalLight(0xfff6dd,2.4);light.position.set(-3,4,5);scene.add(light);
 const rad=Math.PI/180;const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;let lon=65,lat=25,targetLon=lon,targetLat=lat,active=true,frame=0,drag=null,lastTime=0;
 const markers=[...pins].map(element=>{const p=places[element.dataset.pin],a=p.lat*rad,b=p.lon*rad;return{element,point:new THREE.Vector3(Math.cos(a)*Math.sin(b),Math.sin(a),Math.cos(a)*Math.cos(b)).multiplyScalar(1.015)};});
 function render(){
  group.rotation.set(lat*rad,-lon*rad,0,'XYZ');group.updateMatrixWorld(true);renderer.render(scene,camera);
  const {width,height}=container.getBoundingClientRect();
  for(const {element,point} of markers){const world=point.clone().applyMatrix4(group.matrixWorld);const visible=world.z>.09;const screen=world.project(camera);element.hidden=!visible;element.style.left=`${(screen.x*.5+.5)*width}px`;element.style.top=`${(-screen.y*.5+.5)*height}px`;}
  canvas.dataset.longitude=lon.toFixed(2);canvas.dataset.latitude=lat.toFixed(2);
 }
 function tick(time){frame=0;if(!active||document.hidden)return;const dt=Math.min((time-lastTime)/1000,.05);lastTime=time;
  const factor=1-Math.exp(-dt*9);lon+=(targetLon-lon)*factor;lat+=(targetLat-lat)*factor;render();
  if(Math.abs(targetLon-lon)+Math.abs(targetLat-lat)>.015)frame=requestAnimationFrame(tick);
 }
 function request(){if(active&&!frame&&!document.hidden){if(reducedMotion){lon=targetLon;lat=targetLat;render();return;}lastTime=performance.now();frame=requestAnimationFrame(tick);}}
 function rotate(dx,dy){targetLon+=dx;targetLat=Math.max(-65,Math.min(65,targetLat+dy));request();}
 function focus(p){targetLon=lon+((p.lon-lon+540)%360+360)%360-180;targetLat=p.lat*.7;request();}
 function resize(){const {width,height}=container.getBoundingClientRect();if(!width||!height)return;const aspect=width/height;const half=1.17;camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();renderer.setSize(width,height,false);request();}
 const observer=new ResizeObserver(resize);observer.observe(container);
 canvas.addEventListener('pointerdown',event=>{if(event.button!==0||drag)return;drag={id:event.pointerId,x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);canvas.classList.add('is-dragging');});
 canvas.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;const scale=180/Math.max(280,container.clientWidth);rotate(-dx*scale,dy*scale);drag.x=event.clientX;drag.y=event.clientY;});
 function end(event){if(drag?.id!==event.pointerId)return;drag=null;canvas.classList.remove('is-dragging');if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);}
 canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);canvas.addEventListener('lostpointercapture',()=>{drag=null;canvas.classList.remove('is-dragging');});
 canvas.addEventListener('keydown',event=>{const keys={ArrowLeft:[-15,0],ArrowRight:[15,0],ArrowUp:[0,10],ArrowDown:[0,-10]};if(keys[event.key]){event.preventDefault();rotate(...keys[event.key]);}if(event.key==='Home'){event.preventDefault();targetLon=65;targetLat=25;request();}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else request();});
 canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();active=false;cancelAnimationFrame(frame);frame=0;for(const {element} of markers)element.hidden=true;const status=document.getElementById('atlas-globe-status');status.hidden=false;status.textContent='지구본이 잠시 쉬고 있어요. 여행지 버튼으로 선택해 주세요.';});
 resize();render();
 return {focus,rotate,setActive(value){active=value;if(!active){cancelAnimationFrame(frame);frame=0;}else{resize();request();}}};
}
