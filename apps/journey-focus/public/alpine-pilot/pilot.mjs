const $=id=>document.getElementById(id);
const state={ready:false,playing:false,meters:0,total:0,fps:0,tilePending:0,errors:[],side:1};
window.alpinePilot=state;
$('sources').onclick=()=>{const open=$('info').hidden;$('info').hidden=!open;$('sources').setAttribute('aria-expanded',String(open));};
$('retry').onclick=()=>location.reload();
function fail(error){state.playing=false;state.errors.push(String(error));$('loading').hidden=false;$('status').textContent='풍경 데이터를 연결하지 못했어요. 잠시 후 다시 연결해 주세요.';$('retry').hidden=false;console.error(error);}
function distance(a,b){const r=Math.PI/180,dlat=(b.lat-a.lat)*r,dlon=(b.lon-a.lon)*r;return 6371000*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(dlat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dlon/2)**2)));}
async function init(){
 const begin=performance.now();
 // The pinned classic SDK is deferred. Module/defer ordering can vary on slow networks.
 while(!window.Cesium){if(performance.now()-begin>25000)throw Error('Cesium SDK timeout');await new Promise(r=>setTimeout(r,100));}
 const C=window.Cesium;C.Ion.defaultAccessToken='';
 $('status').textContent='실제 선로와 스위스 지형 연결 중…';
 const [terrain,response]=await Promise.all([C.CesiumTerrainProvider.fromUrl('https://3d.geo.admin.ch/ch.swisstopo.terrain.3d/v1/',{requestVertexNormals:true,credit:'© Data: swisstopo'}),fetch('./route.json')]);
 if(!response.ok)throw Error('Route request failed');const route=await response.json();
 const imagery=new C.UrlTemplateImageryProvider({url:'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg',maximumLevel:19,rectangle:C.Rectangle.fromDegrees(5.140242,45.398181,11.47757,48.230651),credit:'© SWISSIMAGE / swisstopo',hasAlphaChannel:false,enablePickFeatures:false});
 const viewer=new C.Viewer('map',{terrainProvider:terrain,baseLayer:new C.ImageryLayer(imagery),baseLayerPicker:false,geocoder:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,animation:false,timeline:false,fullscreenButton:false,selectionIndicator:false,infoBox:false,shouldAnimate:false,requestRenderMode:false});
 state.viewer=viewer;viewer.resolutionScale=Math.min(1,1/(window.devicePixelRatio||1));viewer.targetFrameRate=30;
 viewer.scene.screenSpaceCameraController.enableInputs=false;viewer.scene.globe.maximumScreenSpaceError=2;viewer.scene.globe.depthTestAgainstTerrain=true;viewer.scene.globe.enableLighting=false;viewer.scene.fog.density=0.00004;
 viewer.scene.renderError.addEventListener((_scene,e)=>fail(e));
 for(const provider of [terrain,imagery])provider.errorEvent.addEventListener(e=>{state.errors.push(e.message);$('health').textContent='일부 지형·영상 요청 지연. 화면에 빈 영역이 있는지 확인해 주세요.';});
 viewer.scene.globe.tileLoadProgressEvent.addEventListener(n=>{state.tilePending=n;});
 // Preserve source vertices, adding points only by linear interpolation along each rail segment.
 const points=[{...route.points[0],along:0}];let along=0;
 for(let i=1;i<route.points.length;i++){const a=route.points[i-1],b=route.points[i],d=distance(a,b),n=Math.ceil(d/15);for(let j=1;j<=n;j++)points.push({lon:a.lon+(b.lon-a.lon)*j/n,lat:a.lat+(b.lat-a.lat)*j/n,along:along+d*j/n});along+=d;}
 state.total=along;state.meters=along*.5;
 // Set a nearby overview before sampling; avoids loading the default global scene.
 viewer.camera.setView({destination:C.Cartesian3.fromDegrees(10.028,46.399,4200),orientation:{heading:0,pitch:-Math.PI/2,roll:0}});
 $('status').textContent='선로를 따라 창가 높이를 준비하는 중…';
 const positions=await C.sampleTerrainMostDetailed(terrain,points.map(p=>C.Cartographic.fromDegrees(p.lon,p.lat)));
 positions.forEach((p,i)=>{if(!Number.isFinite(p.height))throw Error('Terrain height missing');points[i].height=p.height;});
 function at(m){m=Math.max(0,Math.min(along,m));let lo=0,hi=points.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(points[mid].along<m)lo=mid;else hi=mid;}const a=points[lo],b=points[hi],t=(m-a.along)/(b.along-a.along||1);return {lon:a.lon+(b.lon-a.lon)*t,lat:a.lat+(b.lat-a.lat)*t,height:a.height+(b.height-a.height)*t};}
 function setCamera(){const a=at(state.meters),back=at(state.meters-12),front=at(state.meters+12),r=Math.PI/180,dlon=(front.lon-back.lon)*r;const heading=Math.atan2(Math.sin(dlon)*Math.cos(front.lat*r),Math.cos(back.lat*r)*Math.sin(front.lat*r)-Math.sin(back.lat*r)*Math.cos(front.lat*r)*Math.cos(dlon))+state.side*Math.PI/2;
 viewer.camera.setView({destination:C.Cartesian3.fromDegrees(a.lon,a.lat,a.height+3),orientation:{heading,pitch:-2*r,roll:0}});viewer.camera.frustum.fov=65*r;
 $('progress').value=String(state.meters/along*1000);$('distance').textContent=`${(state.meters/1000).toFixed(2)} / ${(along/1000).toFixed(2)} km`;}
 function play(on){state.playing=on;$('play').textContent=on?'잠시 멈추기':'여정 시작';}
 $('play').onclick=()=>{if(state.meters>=along)state.meters=0;play(!state.playing);};
 $('reset').onclick=()=>{play(false);state.meters=0;setCamera();};
 $('progress').oninput=()=>{play(false);state.meters=Number($('progress').value)/1000*along;setCamera();};
 for(const [id,side]of [['right',1],['left',-1]])$(id).onclick=()=>{state.side=side;$('right').setAttribute('aria-pressed',String(side===1));$('left').setAttribute('aria-pressed',String(side===-1));setCamera();};
 document.addEventListener('visibilitychange',()=>{if(document.hidden)play(false);});
 setCamera();$('status').textContent='창밖 항공사진을 불러오는 중…';
 // Honest loading: only reveal once the visible globe tiles have finished, or offer a partial view.
 const loadStart=performance.now();while(!viewer.scene.globe.tilesLoaded&&performance.now()-loadStart<25000)await new Promise(r=>setTimeout(r,250));
 state.initialLoadMs=Math.round(performance.now()-begin);state.ready=true;$('loading').hidden=true;
 for(const id of ['play','right','left','speed','reset','progress'])$(id).disabled=false;
 $('health').textContent=`선로 ${route.points.length}점 · ${(along/1000).toFixed(2)}km · 초기 준비 ${(state.initialLoadMs/1000).toFixed(1)}초. 높이는 지형 기반 시험값.`;
 let last=performance.now(),fpsStart=last,frames=0;
 viewer.scene.postRender.addEventListener(()=>{frames++;const now=performance.now();if(now-fpsStart>1000){state.fps=Math.round(frames*1000/(now-fpsStart));frames=0;fpsStart=now;$('telemetry').textContent=`${state.fps} FPS · ${state.tilePending?'풍경 불러오는 중':'현재 시야 로딩 완료'}`;}});
 viewer.scene.preRender.addEventListener(()=>{const now=performance.now(),dt=Math.min(.15,(now-last)/1000);last=now;if(state.playing){state.meters=Math.min(along,state.meters+dt*Number($('speed').value)/3.6);setCamera();if(state.meters>=along)play(false);}});
}
init().catch(fail);
