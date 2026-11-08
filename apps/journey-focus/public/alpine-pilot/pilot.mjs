import {mountArrivalAudio} from '/arrival-audio.mjs';
import {visualPixelRatio,visualQuality} from '/visual-quality.mjs';
import {createTravelShell} from '/travel-shell.mjs';
import {activeTour} from '/world-tour.mjs';
import {createSwissCabin} from './swiss-cabin.mjs';
import {boardingLoadingMarkup} from '/boarding-loading.mjs';
import {SWISS_PASS_KEY,validSwissPass,swissPosition,swissElapsedAt,advanceSwissTrip} from '/src/swiss-journey.mjs';
import {formatDuration,characterById} from '/src/boarding.mjs';
let ticket;try{ticket=JSON.parse(sessionStorage.getItem(SWISS_PASS_KEY));}catch{}
const requestedTicket=new URLSearchParams(location.search).get('ticket');
if(!validSwissPass(ticket)||(requestedTicket&&ticket.id!==requestedTicket)){location.replace('/?destination=swiss');await new Promise(()=>{});}
const $=id=>document.getElementById(id);
const state={ready:false,mapReady:false,cabinReady:false,playing:false,started:false,elapsed:0,travelSeconds:0,duration:ticket.duration,from:ticket.from,character:ticket.character,ticket,meters:0,total:0,fps:0,tilePending:0,errors:[],side:1,view:'cabin',seat:null};
window.alpinePilot=state;
let shell,recorded=false,autoTourStarted=false;
let cabin,cameraPose={heading:0,pitch:0,fov:65},setCamera=()=>{},sessionTick=0;
$('loading').innerHTML=boardingLoadingMarkup({hidden:false});mountArrivalAudio($('loading'),ticket.to);
$('loading').querySelector('[data-boarding-from]').textContent=ticket.from;
$('loading').querySelector('[data-boarding-to]').textContent=ticket.to;
$('loading').querySelector('.arrival-route>span').textContent='CH';
$('loading').querySelector('.arrival-route>small').textContent='BERNINA · SWITZERLAND';
$('arrival-title').focus({preventScroll:true});
let loadPercent=0,loadFailed=false,loadFinishing=false;
const loadStages={cabin:0,world:0};
const format=seconds=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(Math.floor(seconds)%60).padStart(2,'0')}`;
function sync(){
 const complete=state.duration!==null&&state.elapsed>=state.duration,position=swissPosition(state.travelSeconds,state.total,state.from);const direction=position.forward?'호수 북쪽 → 호수 남쪽':'호수 남쪽 → 호수 북쪽';
 $('play').disabled=!state.ready||!state.seat;
 $('play').textContent=!state.ready?'탑승 준비 중':!state.seat?'앉을 자리를 골라 주세요':state.playing?'잠시 멈추기':complete?'다시 출발하기':state.started?'계속 집중하기':'열차 출발하기';
 $('right').disabled=!state.ready||!state.seat;$('trip-clock').hidden=!state.started||state.view!=='window';$('elapsed').textContent=format(state.elapsed);$('goal').textContent=state.duration===null?'∞ 무제한 왕복':'목표 '+formatDuration(state.duration);$('ticket-details').textContent=`${characterById(ticket.character).name} · ${ticket.from} 출발 · ${formatDuration(ticket.duration)} · 5분마다 왕복`;
 $('ride-status').textContent=!state.ready?'객실과 풍경 준비 중':!state.seat?'오른쪽 의자를 누르고, 횃불이 옆의 앉기를 눌러 주세요':complete?'오늘의 집중 여정을 마쳤어요':state.playing?`${state.seat.id} · ${direction} · ${Math.floor(state.travelSeconds/300)+1}번째 구간`:state.started?'잠시 쉬어가는 중':`${state.seat.id} · 준비되면 출발해요`;
 $('monitor-title').textContent=complete?'작은 여정의 끝':'Lago Bianco';$('monitor-detail').textContent=!state.seat?'오른쪽 창가에 앉아 주세요':complete?'수고했어요. 잠깐 쉬어가세요.':state.playing?direction:'베르니나선 · '+formatDuration(state.duration);
 $('monitor-progress').style.width=`${state.total?100*state.meters/state.total:0}%`;
 cabin?.setSession({elapsed:state.elapsed,state:!state.started?'idle':complete?'completed':state.playing?'running':'paused'});
}
function play(on){state.playing=Boolean(on&&state.ready&&state.seat);if(state.playing)state.started=true;shell?.sound.setActive(state.playing);if(state.playing)void shell?.sound.unlock();sync();}
function showView(view){if(view==='window'&&!state.seat)return;state.view=view;$('swiss-journey').dataset.view=view;$('swiss-cabin').hidden=view!=='cabin';cabin?.setActive(view==='cabin'&&!document.querySelector('dialog[open]'));$('right').setAttribute('aria-pressed',String(view==='window'));$('cabin-view').setAttribute('aria-pressed',String(view==='cabin'));setCamera();sync();}
function progress(message,stages={}){
 if(loadFailed)return;
 for(const key of ['cabin','world'])loadStages[key]=Math.max(loadStages[key],stages[key]||0);
 if(state.cabinReady)loadStages.cabin=1;if(state.mapReady)loadStages.world=1;
 loadPercent=Math.max(loadPercent,Math.floor(40*loadStages.cabin+60*loadStages.world));
 if(message)$('arrival-status').textContent=message;
 $('arrival-percent').textContent=loadPercent+'%';$('arrival-fill').style.width=loadPercent+'%';$('arrival-meter').setAttribute('aria-valuenow',String(loadPercent));
 $('arrival-detail').textContent=`객실 ${state.cabinReady?'준비 완료':'준비 중'} · 스위스 풍경 ${state.mapReady?'준비 완료':'준비 중'} · 준비 단계 기준`;
 $('arrival-cabin').className=state.cabinReady?'done':'active';$('arrival-world').className=state.mapReady?'done':loadStages.world?'active':'';
 if(state.mapReady&&state.cabinReady&&!loadFinishing){
  loadFinishing=true;$('arrival-status').textContent='열차가 도착했어요.';$('arrival-detail').textContent='오른쪽 창가에서 마음에 드는 자리를 골라 주세요.';
  $('boarding-loading').setAttribute('aria-busy','false');
  setTimeout(()=>{if(loadFailed)return;state.ready=true;$('loading').hidden=true;cabin?.setActive(true);for(const id of ['reset','progress'])$(id).disabled=false;sync();void autoTour();$('swiss-cabin').querySelector('canvas')?.focus({preventScroll:true});},matchMedia('(prefers-reduced-motion: reduce)').matches?0:400);
 }
}
function fail(error){loadFailed=true;state.playing=false;state.ready=false;state.errors.push(String(error));cabin?.setActive(false);$('loading').hidden=false;$('loading').classList.add('loading-failed');$('boarding-loading').setAttribute('aria-busy','false');$('arrival-title').textContent='열차 준비가 잠시 멈췄어요.';$('arrival-status').textContent='열차를 준비하지 못했어요. 잠시 후 다시 연결해 주세요.';$('arrival-detail').textContent='승차권은 그대로 보관하고 있어요.';$('arrival-retry').hidden=false;sync();console.error(error);}
$('arrival-retry').onclick=()=>location.reload();
$('arrival-back').onclick=()=>location.assign('/?destination=swiss');
$('sources').onclick=()=>{cabin?.setActive(false);$('info').showModal();};$('info-close').onclick=()=>$('info').close();$('info').addEventListener('close',()=>cabin?.setActive(state.view==='cabin'));$('info').addEventListener('click',event=>{if(event.target===$('info')){const r=$('info').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('info').close();}});
$('cabin-view').onclick=()=>showView('cabin');$('right').onclick=()=>showView('window');
$('play').onclick=()=>{if(recorded||(state.duration!==null&&state.elapsed>=state.duration)){recorded=false;state.travelSeconds=0;state.elapsed=0;state.meters=swissPosition(0,state.total,state.from).meters;setCamera();}play(!state.playing);};
$('reset').onclick=()=>{play(false);state.travelSeconds=0;state.meters=swissPosition(0,state.total,state.from).meters;state.elapsed=0;state.started=false;recorded=false;setCamera();sync();};
$('progress').oninput=()=>{play(false);state.meters=Number($('progress').value)/1000*state.total;state.travelSeconds=swissElapsedAt(state.meters,state.total,state.travelSeconds,state.from);setCamera();sync();};
document.addEventListener('visibilitychange',()=>{if(document.hidden)play(false);});
window.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat&&!/^(INPUT|SELECT|BUTTON|TEXTAREA|A)$/.test(e.target?.tagName)&&!document.querySelector('dialog[open]')){e.preventDefault();if(!$('play').disabled)$('play').click();}});
function distance(a,b){const r=Math.PI/180,dlat=(b.lat-a.lat)*r,dlon=(b.lon-a.lon)*r;return 6371000*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(dlat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dlon/2)**2)));}
async function initMap(){
 const begin=performance.now();while(!window.Cesium){if(performance.now()-begin>25000)throw Error('Cesium SDK timeout');await new Promise(r=>setTimeout(r,100));}
 const C=window.Cesium;C.Ion.defaultAccessToken='';progress('스위스의 선로와 풍경을 연결하고 있어요.',{world:.1});
 const [terrain,response]=await Promise.all([C.CesiumTerrainProvider.fromUrl('https://3d.geo.admin.ch/ch.swisstopo.terrain.3d/v1/',{requestVertexNormals:true,credit:'© Data: swisstopo'}),fetch('./route.json')]);if(!response.ok)throw Error('Route request failed');const route=await response.json();
 const imagery=new C.UrlTemplateImageryProvider({url:'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg',maximumLevel:19,rectangle:C.Rectangle.fromDegrees(5.140242,45.398181,11.47757,48.230651),credit:'© SWISSIMAGE / swisstopo',hasAlphaChannel:false,enablePickFeatures:false});
 const viewer=new C.Viewer('map',{terrainProvider:terrain,baseLayer:new C.ImageryLayer(imagery),baseLayerPicker:false,geocoder:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,animation:false,timeline:false,fullscreenButton:false,selectionIndicator:false,infoBox:false,shouldAnimate:false,requestRenderMode:false});state.viewer=viewer;viewer.targetFrameRate=30;const quality=()=>{viewer.useBrowserRecommendedResolution=true;viewer.resolutionScale=visualPixelRatio();viewer.scene.globe.maximumScreenSpaceError=visualQuality()==='high'?1:visualQuality()==='light'?3:2;viewer.scene.postProcessStages.fxaa.enabled=true;};window.addEventListener('journey-quality',quality);quality();
 viewer.scene.screenSpaceCameraController.enableInputs=false;viewer.scene.globe.depthTestAgainstTerrain=true;viewer.scene.globe.enableLighting=false;viewer.scene.fog.density=.00004;
 viewer.scene.renderError.addEventListener((_scene,e)=>fail(e));for(const provider of [terrain,imagery])provider.errorEvent.addEventListener(e=>{state.errors.push(e.message);$('health').textContent='일부 풍경 데이터를 불러오는 데 시간이 걸리고 있어요.';});viewer.scene.globe.tileLoadProgressEvent.addEventListener(n=>state.tilePending=n);
 const points=[{...route.points[0],along:0}];let along=0;for(let i=1;i<route.points.length;i++){const a=route.points[i-1],b=route.points[i],d=distance(a,b),n=Math.ceil(d/15);for(let j=1;j<=n;j++)points.push({lon:a.lon+(b.lon-a.lon)*j/n,lat:a.lat+(b.lat-a.lat)*j/n,along:along+d*j/n});along+=d;}state.total=along;state.meters=swissPosition(0,along,state.from).meters;
 viewer.camera.setView({destination:C.Cartesian3.fromDegrees(10.028,46.399,4200),orientation:{heading:0,pitch:-Math.PI/2,roll:0}});progress('선로를 따라 창가 높이를 준비하고 있어요.',{world:.35});
 const positions=await C.sampleTerrainMostDetailed(terrain,points.map(p=>C.Cartographic.fromDegrees(p.lon,p.lat)));positions.forEach((p,i)=>{if(!Number.isFinite(p.height))throw Error('Terrain height missing');points[i].height=p.height;});
 function at(m){m=Math.max(0,Math.min(along,m));let lo=0,hi=points.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(points[mid].along<m)lo=mid;else hi=mid;}const a=points[lo],b=points[hi],t=(m-a.along)/(b.along-a.along||1);return{lon:a.lon+(b.lon-a.lon)*t,lat:a.lat+(b.lat-a.lat)*t,height:a.height+(b.height-a.height)*t};}
 setCamera=()=>{const a=at(state.meters),back=at(state.meters-12),front=at(state.meters+12),r=Math.PI/180,dlon=(front.lon-back.lon)*r;const railHeading=Math.atan2(Math.sin(dlon)*Math.cos(front.lat*r),Math.cos(back.lat*r)*Math.sin(front.lat*r)-Math.sin(back.lat*r)*Math.cos(front.lat*r)*Math.cos(dlon));const outside=state.view==='window'||!state.mapReady;
  const cx=outside?.98:(cameraPose.x||0),forward=outside?-(state.seat?.z||0):-(cameraPose.z||0),cy=outside?1.35:(cameraPose.y||1.5);
  const origin=C.Cartesian3.fromDegrees(a.lon,a.lat,a.height+1.5),enu=C.Transforms.eastNorthUpToFixedFrame(origin);
  const offset=new C.Cartesian3(cx*Math.cos(railHeading)+forward*Math.sin(railHeading),-cx*Math.sin(railHeading)+forward*Math.cos(railHeading),cy);
  let eye=C.Matrix4.multiplyByPoint(enu,offset,new C.Cartesian3());
  const eyeGeo=C.Cartographic.fromCartesian(eye),ground=viewer.scene.globe.getHeight(eyeGeo);
  // A seat may lie several metres away from the rail sample on a steep bank.
  // Keep that translated eye above the loaded terrain instead of inside it.
  if(Number.isFinite(ground)&&eyeGeo.height<ground+.8){eyeGeo.height=ground+.8;eye=C.Cartesian3.fromRadians(eyeGeo.longitude,eyeGeo.latitude,eyeGeo.height);}
  viewer.camera.setView({destination:eye,orientation:{heading:railHeading+(outside?Math.PI/2:cameraPose.heading),pitch:outside?-2*r:cameraPose.pitch,roll:0}});
  // Three.js fov is vertical; Cesium uses the larger viewport dimension.
  const vertical=(outside?65:cameraPose.fov)*r,aspect=viewer.canvas.clientWidth/viewer.canvas.clientHeight;viewer.camera.frustum.fov=aspect>1?2*Math.atan(Math.tan(vertical/2)*aspect):vertical;
  $('progress').value=String(state.meters/along*1000);$('distance').textContent=`${(state.meters/1000).toFixed(2)} / ${(along/1000).toFixed(2)} km`;
 };setCamera();progress('처음 보이는 풍경을 채우고 있어요.',{world:.7});
 // Warm the right-window panorama before exposing the cabin: the close-up
 // camera otherwise loads a different set of tiles and first shows bare DEM.
 const loadStart=performance.now();while(!viewer.scene.globe.tilesLoaded&&performance.now()-loadStart<45000)await new Promise(r=>setTimeout(r,250));state.initialLoadMs=Math.round(performance.now()-begin);state.mapReady=true;setCamera();progress();$('health').textContent=`실제 선로 ${(along/1000).toFixed(2)}km · 풍경 초기 준비 ${(state.initialLoadMs/1000).toFixed(1)}초. ${state.tilePending?'일부 타일은 계속 불러오는 중입니다.':''}`;
 let frames=0,fpsStart=performance.now();viewer.scene.postRender.addEventListener(()=>{frames++;const now=performance.now();if(now-fpsStart>1000){state.fps=Math.round(frames*1000/(now-fpsStart));frames=0;fpsStart=now;$('telemetry').textContent=`${state.fps} FPS · ${state.tilePending?'풍경 불러오는 중':'현재 시야 로딩 완료'}`;}});
}
async function initCabin(){cabin=await createSwissCabin({host:$('swiss-cabin'),character:ticket.character,onSeat:seat=>{state.seat=seat;if(!seat){play(false);if(state.view==='window')showView('cabin');}sync();},onWindow:()=>showView('window'),onCamera:pose=>{cameraPose=pose;if(state.view==='cabin')setCamera();},onProgress:message=>progress(message,{cabin:.15})});await new Promise(requestAnimationFrame);cabin.setActive(false);state.cabin=cabin;state.cabinReady=true;progress();}
function finishSwiss(completed=false){if(recorded||!state.started)return;recorded=true;play(false);shell.complete({from:ticket.from,to:ticket.to,elapsed:state.elapsed,completed,unlimited:state.duration===null});}
shell=createTravelShell({destination:'swiss',getState:()=>({ready:state.ready,seated:!!state.seat,status:recorded?'completed':state.playing?'running':state.started?'paused':'idle',elapsed:state.elapsed,duration:state.duration,view:state.view}),actions:{play:()=>{$('play').click();},pause:()=>play(false),view:showView,settings:()=>$('sources').click(),end:()=>finishSwiss(false)}});
async function autoTour(){if(!activeTour('swiss')||autoTourStarted)return;autoTourStarted=true;cabin.selectSeat(cabin.seats.reduce((a,b)=>Math.abs(a.z)<Math.abs(b.z)?a:b).id);cabin.confirmSeat();const deadline=performance.now()+25000;while(!state.seat&&performance.now()<deadline)await new Promise(r=>setTimeout(r,100));if(state.seat){showView('window');play(true);}}
Promise.all([initMap(),initCabin()]).catch(fail);
let last=performance.now();function tick(now){const dt=Math.min(.15,(now-last)/1000);last=now;if(state.playing&&!document.hidden){const next=advanceSwissTrip(state,dt);Object.assign(state,next);setCamera();if(next.complete){play(false);finishSwiss(true);}}if(now-sessionTick>200){sessionTick=now;sync();}requestAnimationFrame(tick);}requestAnimationFrame(tick);
window.addEventListener('pagehide',()=>{play(false);cabin?.setActive(false);});
