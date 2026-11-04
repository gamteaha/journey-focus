import { normalizeVisual, BUILDING_IDS } from '/src/comparison.mjs';
import { createSceneryLayer } from '/scenery-layer.mjs';
import { pilotGroundHeight,HeightStabilizer } from '/src/motion.mjs';
import {createRenderingController} from '/rendering.mjs';
import {settleInitialView} from '/src/startup.mjs';
import {createForestStudy} from '/forest.mjs';
import {createStyleFilter} from '/style-filter.mjs';
const notify = (type, data = {}) => parent.postMessage({ type: `jf:${type}`, ...data }, location.origin);
const errorBox = document.getElementById('map-error');
let viewer, engine, lastPosition, view = 'window', locked = false;
let ground = 100, ready = false, renders = 0, lastSample = performance.now();
let visual = normalizeVisual(), layerResult = null;
let scenery=null,sceneryActive=false,sceneryMoving=false,sceneryHasStarted=false;
let heightStabilizer=new HeightStabilizer();
let sampledHeight=null,sampledAt=0;
let rendering=null,renderMode='auto';
let cancelStartup=()=>{};
let terminalFailure=false;
let forestStudy=null;
let styleFilter=null;
let removeInputLock=()=>{};
let resizeTimer;
window.addEventListener('resize',()=>{
  clearTimeout(resizeTimer);
  resizeTimer=setTimeout(()=>{if(lastPosition&&!terminalFailure){viewer?.resize?.();setCamera(lastPosition);}},150);
});
function applyVisual(input) {
  visual = normalizeVisual(input);
  if (!viewer) return;
  try {
    if (!sceneryActive && (layerResult?.mode !== visual.buildings || !layerResult.ok)) {
    const selected = visual.buildings==='textured' ? [BUILDING_IDS.lod3,BUILDING_IDS.lod4] : [BUILDING_IDS[visual.buildings]].filter(Boolean);
    const layers = Object.values(BUILDING_IDS).map(id => ({ id, layer: viewer.map.getElementById(id) }));
    if (selected.length && !layers.some(l => selected.includes(l.id)&&l.layer)) throw new Error('Layer unavailable');
    for (const { id, layer } of layers) {
      if (!layer) continue;
      if (selected.includes(id)) layer.show(); else layer.hide();
    }
    layerResult = { ok: true, mode: visual.buildings, activeIds: layers.filter(l => l.layer?.visible).map(l => l.id) };
    }
  } catch { layerResult = { ok: false, mode: visual.buildings, message: '이 SDK에서 선택한 건물 레이어를 적용하지 못했습니다.' }; }
  notify('visual-result', { result: layerResult, settings: visual, terrainError: viewer.scene.globe.maximumScreenSpaceError });
  setCamera(lastPosition);
}
function fail(message) {
  if(terminalFailure)return;
  terminalFailure=true;ready=false;cancelStartup();rendering?.dispose();
  try{scenery?.clear();}catch{}
  errorBox.hidden = false; errorBox.textContent = message; notify('map-error', { message });
}
function setCamera(position,snap=false) {
  if (!position || !Number.isFinite(position.lon) || !Number.isFinite(position.lat)) return;
  lastPosition = position;
  if(terminalFailure)return;
  if(!viewer?.scene?.globe||!engine?.Cartographic)return;
  const cartographic = engine.Cartographic.fromDegrees(position.lon, position.lat);
  const now=performance.now()/1000;
  const sampleGround=!sceneryActive||snap||!sceneryHasStarted||now-sampledAt>=.2;
  if(sampleGround&&!sceneryActive){
    const height=viewer.scene.globe.getHeight(cartographic);
    if(Number.isFinite(height)&&(!sceneryActive||height>=0))ground=height;
  }
  const overview = view === 'overview'&&!sceneryActive;
  const settings=sceneryActive?{height:6,pitch:-5,heading:90,fov:65}:visual;
  let cameraGround=ground;
  if(sceneryActive){
    if(sampleGround){
    const heading=engine.Math.toRadians(Number.isFinite(position.heading)?position.heading:0);
    // Five spatial samples at 5 Hz retain a 12 m median window. The camera
    // itself still interpolates each frame; duplicate centre queries are avoided.
    const heights=[-6,-3,0,3,6].map(meters=>{
      const lon=position.lon+Math.sin(heading)*meters/(111320*Math.cos(engine.Math.toRadians(position.lat)));
      const lat=position.lat+Math.cos(heading)*meters/111320;
      return viewer.scene.globe.getHeight(engine.Cartographic.fromDegrees(lon,lat));
    });
    if(Number.isFinite(heights[2])&&heights[2]>=0)ground=heights[2];
    // This fixed Baegyangri pilot is above sea level. Reject unready-tile
    // negative values and unrelated coarse-tile extremes near the rail.
    sampledHeight=pilotGroundHeight(heights,ground);sampledAt=now;
    }
    cameraGround=heightStabilizer.update(sampledHeight,now,snap||!sceneryHasStarted)??Math.max(0,ground);
  }
  const altitude = cameraGround + (overview ? 1400 : settings.height);
  viewer.camera.cancelFlight?.();
  viewer.camera.setView({
    destination: engine.Cartesian3.fromDegrees(position.lon, position.lat, altitude),
    orientation: { heading: engine.Math.toRadians(position.heading + (overview ? 0 : settings.heading)), pitch: engine.Math.toRadians(overview ? -55 : settings.pitch), roll: 0 },
  });
  if ('fov' in viewer.camera.frustum) viewer.camera.frustum.fov = engine.Math.toRadians(settings.fov);
  viewer.scene.requestRender?.();
}
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== parent || !event.data?.type?.startsWith('jf:')) return;
  if (event.data.type === 'jf:position') setCamera(event.data.position,Boolean(event.data.snap));
  if (event.data.type === 'jf:view') { view = event.data.view === 'overview' ? 'overview' : 'window'; setCamera(lastPosition); }
  if (event.data.type === 'jf:geometry') document.getElementById('osm-credit').hidden = !event.data.rail;
  if (event.data.type === 'jf:visual') applyVisual(event.data.settings);
  if(event.data.type==='jf:rendering'){renderMode=event.data.mode;rendering?.setMode(renderMode);}
  if (event.data.type === 'jf:scenery-load'&&scenery)scenery.load(event.data.objects).catch(()=>notify('scenery-error',{message:'풍경 시안을 시작하지 못했습니다.'}));
  if (event.data.type === 'jf:scenery-clear')scenery?.clear();
  if (event.data.type === 'jf:scenery-motion'){
    sceneryMoving=Boolean(event.data.running)&&sceneryActive;
    const firstStart=sceneryMoving&&!sceneryHasStarted;
    if(sceneryMoving)sceneryHasStarted=true;
    // Ready/reset/replay already align explicitly. Starting playback must not
    // snap again when a freshly loaded terrain tile changes the height query.
    if(firstStart)setCamera(lastPosition);
  }
  if (event.data.type === 'jf:lock') {
    locked = Boolean(event.data.locked);
    // Camera movement is owned by the app, including before/after a session.
    if (viewer) viewer.scene.screenSpaceCameraController.enableInputs = false;
  }
});
notify('map-initialized');
try {
  if (window.vworldIsValid !== 'true' && window.vworldIsValid !== true) throw new Error('브이월드 인증에 실패했습니다. 키와 등록 URL을 확인해 주세요.');
  if (!window.vw?.Map) throw new Error('3D 지도 SDK를 불러오지 못했습니다. 네트워크를 확인해 주세요.');
  const options = {
    mapId: 'vmap',
    initPosition: new vw.CameraPosition(new vw.CoordZ(127.055961, 37.544581, 1600), new vw.Direction(110, -35, 0)),
    logo: true, navigation: false,
  };
  const map = new vw.Map();
  map.setOption(options);
  map.start();
  const deadline = performance.now() + 35000;
  const poll = setInterval(() => {
    viewer = window.ws3d?.viewer;
    engine = window.Cesium || window.ws3d?.common;
    if (viewer?.scene?.globe && engine?.Cartesian3 && engine?.Cartographic) {
      clearInterval(poll);
      viewer.scene.screenSpaceCameraController.enableInputs = false;
      // Provider startup may re-enable its controller after the viewer appears.
      removeInputLock=(viewer.scene.preUpdate||viewer.scene.preRender).addEventListener(()=>{
        if(viewer?.scene?.screenSpaceCameraController)viewer.scene.screenSpaceCameraController.enableInputs=false;
      });
      rendering=createRenderingController(viewer,engine,notify);rendering.setMode(renderMode);
      // Rural forest reconstruction belongs to the archived Gyeongchun pilot.
      styleFilter=createStyleFilter(viewer,engine);
      // A fixed window view is available even while station information connects.
      if(!lastPosition)lastPosition={lon:127.055961,lat:37.544581,heading:110};
      applyVisual(visual);
      scenery=createSceneryLayer(viewer,engine,(type,data)=>notify(type,data),active=>{sceneryActive=active;sceneryMoving=false;sceneryHasStarted=false;sampledHeight=null;sampledAt=0;heightStabilizer=new HeightStabilizer();setCamera(lastPosition);});
      viewer.scene.globe.tileLoadProgressEvent.addEventListener(count => {
        if (count === 0 && locked && lastPosition) setCamera(lastPosition);
      });
      viewer.scene.renderError.addEventListener(() => fail('지도 렌더링이 중단되었습니다. 지도 다시 불러오기를 눌러 주세요.'));
      viewer.scene.postRender.addEventListener(() => {
        if(terminalFailure)return;
        renders++;
        const now = performance.now();
        if (now - lastSample >= 2000) {
          const c = viewer.camera.positionCartographic;
          const terrainHeight = viewer.scene.globe.getHeight(c);
          const fps=Math.round(renders*1000/(now-lastSample)),tilesLoaded=Boolean(viewer.scene.globe.tilesLoaded);
          rendering.sample({fps,tilesLoaded});
          notify('map-stats', {
            fps, tilesLoaded,
            camera: { lon: engine.Math.toDegrees(c.longitude), lat: engine.Math.toDegrees(c.latitude), altitude: c.height, ground: Number.isFinite(terrainHeight) ? terrainHeight : null },
          });
          renders = 0; lastSample = now;
        }
      });
      viewer.scene.requestRender?.();
      if (lastPosition) setCamera(lastPosition);
      if(!terminalFailure)cancelStartup=settleInitialView(viewer,{align:()=>setCamera(lastPosition,true),ready:()=>{if(!ready&&!terminalFailure){ready=true;notify('map-ready');}}});
    } else if (performance.now() > deadline) { clearInterval(poll); fail('3D 지도 초기화 시간이 초과되었습니다. 잠시 후 다시 연결해 주세요.'); }
  }, 200);
} catch (error) {
  fail(error.message?.startsWith('브이월드') || error.message?.startsWith('3D 지도 SDK') ? error.message : '3D 지도를 시작하지 못했습니다. 브라우저의 하드웨어 가속을 확인해 주세요.');
}
document.addEventListener('keydown',event=>{
  if(event.code==='Space'&&!event.repeat&&!event.isComposing&&!/^(INPUT|SELECT|TEXTAREA|BUTTON|A)$/.test(event.target?.tagName)&&!event.target?.isContentEditable){event.preventDefault();notify('shortcut',{key:'space'});}
  if(event.key==='Escape')notify('shortcut',{key:'escape'});
});
window.addEventListener('pagehide',()=>{cancelStartup();removeInputLock();rendering?.dispose();forestStudy?.dispose();styleFilter?.dispose();});
