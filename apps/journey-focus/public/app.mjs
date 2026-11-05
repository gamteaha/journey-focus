import { SessionClock, formatTime } from '/src/session.mjs';
import { buildRoute, buildLoopRoute, positionAt } from '/src/route.mjs';
import { TrainAudio } from '/audio.mjs';
import { createComparison } from '/comparison.mjs';
import { createScenery } from '/scenery.mjs';
import {normalizeRenderingMode} from '/src/rendering.mjs';
import {readPreferences,savePreferences} from '/src/preferences.mjs';
import {CABIN_SEATS} from '/src/cabin.mjs';
import {createBoarding} from '/boarding.mjs';
import {characterById,formatDuration} from '/src/boarding.mjs';
import {recommendJourney,validDuration,journeyMetrics} from '/src/journey.mjs';

const $ = id => document.getElementById(id);
let preferenceStorage;
try{preferenceStorage=localStorage;}catch{}
const savedPreferences=readPreferences(preferenceStorage);
const clock = new SessionClock();
const audio = new TrainAudio(() => { if(scenery?.active)return scenery.remaining;const s = clock.snapshot(); return s.unlimited?Infinity:s.duration - s.elapsed; });
const state = { stations: [], route: null, railShape: null, duration: savedPreferences.duration, mapReady: false, mapFailed: false, view: savedPreferences.view, recorded: false, stationError: false, loading: false, fetchedAt: null, fps: null };
let toastTimer, mapTimer, completionTimer, lastUpdate = 0, lastCamera = 0;
let comparison = null;
let scenery=null;
let cabin=null,selectedSeat=null,experienceMode='cabin';
let lastCabinSession='';
function publishCabinSession(force=false){
 if(!cabin)return;const s=clock.snapshot(),session={state:s.state,elapsed:Math.floor(s.elapsed),duration:s.duration,unlimited:s.unlimited,laps:journeyMetrics(state.route,s).laps},key=JSON.stringify(session);
 if(force||key!==lastCabinSession){lastCabinSession=key;cabin.setSession(session);}
}
let boarding=null,boardingTicket=null;
let recommendationMemo;
function routeProgress(snapshot=clock.snapshot()){return journeyMetrics(state.route,snapshot).progress;}
function journeyRecommendation(){
 const from=$('from').value;
 if(recommendationMemo?.shape===state.railShape&&recommendationMemo.stations===state.stations&&recommendationMemo.from===from&&recommendationMemo.duration===state.duration)return recommendationMemo.value;
 const value=recommendJourney(state.stations,from,state.duration,state.railShape);recommendationMemo={shape:state.railShape,stations:state.stations,from,duration:state.duration,value};return value;
}
function applyRecommendation(){const recommendation=journeyRecommendation();if(recommendation){$('to').value=recommendation.to;chooseRoute();}}
function changeDuration(duration){
 if(!validDuration(duration)||['running','paused'].includes(clock.state))return;
 resetSessionPreview();state.duration=duration;
 document.querySelectorAll('[data-duration]').forEach(b=>{const selected=Number(b.dataset.duration)===duration;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
 const recommendation=journeyRecommendation();if(recommendation)$('to').value=recommendation.to;
 if(state.stations.length>1)chooseRoute();else boarding?.update();
 setControls(false);
 saveUserSettings();
}
let cabinFailed=false,entryProgress=()=>{},activeEntry=null,entrySequence=0,entryViewId=null,entryViewReady=false;
function setExperience(mode){
  experienceMode=mode==='window'?'window':'cabin';
  document.body.classList.toggle('cabin-mode',experienceMode==='cabin');
  $('cabin-root').hidden=experienceMode!=='cabin';
  for(const [id,value]of [['cabin-view','cabin'],['landscape-view','window']]){$(id).classList.toggle('active',value===experienceMode);$(id).setAttribute('aria-pressed',String(value===experienceMode));}
  cabin?.setActive(experienceMode==='cabin');
  post('cabin',{active:experienceMode==='cabin'});
  if(experienceMode==='cabin'){comparison?.close();scenery?.close();setView('window');}
  else{setView('window');applySeatView();if(state.route)post('position',{position:positionAt(state.route,routeProgress())});}
  syncGameHUD();
  publishCabinSession(true);
}
function applySeatView(){if(selectedSeat)post('visual',{settings:{...(comparison?.settings||{}),heading:selectedSeat.side==='A'?-90:90}});}
$('cabin-view').onclick=()=>setExperience('cabin');$('landscape-view').onclick=()=>setExperience('window');
$('compare-toggle').addEventListener('click',()=>setExperience('window'));
let renderMode='auto';
try{renderMode=normalizeRenderingMode(localStorage.getItem('journey-focus-rendering'));}catch{}
$('render-quality').value=renderMode;
$('render-quality').onchange=()=>{
 renderMode=normalizeRenderingMode($('render-quality').value);
 try{localStorage.setItem('journey-focus-rendering',renderMode);}catch{}
 post('rendering',{mode:renderMode});
};
function post(type, data = {}) { $('map-frame')?.contentWindow?.postMessage({ type: `jf:${type}`, ...data }, location.origin); }
function toast(message) {
  $('toast').textContent = message; $('toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4500);
}
function dialog(title, html, eyebrow = 'JOURNEY GUIDE') {
  cabin?.setActive(false);
  $('dialog-title').textContent = title; $('dialog-content').innerHTML = html; $('dialog-eyebrow').textContent = eyebrow;
  if (!$('info-dialog').open) $('info-dialog').showModal();
}
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function history() {
  try { const rows = JSON.parse(localStorage.getItem('journey-focus-history') || '[]'); return Array.isArray(rows) ? rows.filter(r => r && typeof r.from === 'string' && typeof r.to === 'string' && Number.isFinite(r.elapsed) && typeof r.date === 'string').slice(0, 30) : []; }
  catch { return []; }
}
function updateHistoryCount() { $('history-count').textContent = history().length; }
function connection() {
  const failed = state.stationError || state.mapFailed;
  const ready = state.mapReady && state.stations.length > 1;
  document.querySelector('.status-led').className = `status-led ${failed ? 'error' : ready ? '' : 'pending'}`;
  $('connection-text').textContent = failed ? '풍경 연결을 확인해 주세요' : ready ? selectedSeat?'출발 준비가 됐어요':'앉을 자리를 골라 주세요' : '열차의 풍경을 준비하고 있어요';
  $('retry').hidden = !failed;
  $('start').disabled = !ready || !state.route || state.loading || (!selectedSeat&&!['running','paused'].includes(clock.state));
  $('compare-toggle').disabled = !ready || !state.route || state.loading;
  $('scenery-toggle').disabled=true;$('scenery-toggle').hidden=true;
  if(scenery?.active){$('start').disabled=true;$('compare-toggle').disabled=true;}
  $('start-label').textContent = clock.state === 'running' ? '여정 진행 중' : clock.state === 'paused' ? '여정 이어가기' : ready ? selectedSeat?'나의 여정 시작하기':'객실에서 먼저 자리를 골라 주세요' : failed ? '풍경 연결을 확인해 주세요' : '열차 준비 중';
  if (clock.state === 'running') $('start').disabled = true;
  boarding?.update();
  syncGameHUD();
}
function setControls(active) {
  for (const id of ['from', 'to', 'swap']) $(id).disabled = active || state.stations.length < 2;
  if(state.duration===null){$('to').disabled=true;$('swap').disabled=true;}
  document.querySelector('label[for="to"]').firstChild.textContent=state.duration===null?'한 바퀴 후 돌아오는 역':'도착역';
  document.querySelectorAll('[data-duration]').forEach(button => { button.disabled = active; });
  $('pause').hidden = !active; $('stop').hidden = !active;
}
function preview() {
  if (!state.route) return;
  $('ticket-from').textContent = $('from').value;
  $('ticket-to').textContent = $('to').value;
  $('progress-from').textContent = $('from').value;
  $('progress-to').textContent = $('to').value;
  const rail = state.route.geometry === 'osm-rail';
  $('route-summary').textContent = state.duration===null?`2호선 43개 역 순환 · 한 바퀴 약 ${(state.route.distance/1000).toFixed(1)} km`:`${state.route.stations.length}개 역 · 약 ${(state.route.distance / 1000).toFixed(1)} km`;
  $('geometry-label').textContent = rail ? '2호선 실제 선로 · 오른쪽 창가 · 높이 30m 시험값' : '실제 지형 · 역 사이 보간 이동';
  post('geometry', { rail });
  $('scene-description').textContent = `${$('from').value}에서 ${$('to').value}까지, 나에게 집중하는 시간`;
  $('ticket-duration').textContent = state.duration===null?'∞ 무제한':`${state.duration / 60} MIN`;
  if (!['running', 'paused'].includes(clock.state)) {
    $('timer').textContent = state.duration===null?'∞':formatTime(state.duration);
    $('location-label').textContent = `${$('from').value} → ${$('to').value} · 여정 준비`;
    post('position', { position: positionAt(state.route, 0) });
    $('progress-fill').style.width = '0%'; $('train-dot').style.left = '0%'; $('progress-track').setAttribute('aria-valuenow', '0');
  }
  boarding?.update();
  syncGameHUD();
}
function chooseRoute() {
  resetSessionPreview();
  try { state.route = state.duration===null?buildLoopRoute(state.stations,$('from').value,state.railShape):buildRoute(state.stations, $('from').value, $('to').value, state.railShape); preview(); }
  catch (error) { state.route = null; $('route-summary').textContent = error.message; }
  connection();
  comparison?.routeChanged();
  if(state.route)saveUserSettings();
}
function saveUserSettings(){savePreferences(preferenceStorage,{from:state.route?$('from').value:savedPreferences.from,to:state.route?$('to').value:savedPreferences.to,duration:state.duration,view:state.view});}
function resetSessionPreview() {
  if (['running', 'paused'].includes(clock.state)) return;
  clock.reset();
  $('session-kicker').textContent = 'TIME FOR YOURSELF';
  $('session-title').textContent = '풍경은 흐르고, 집중은 깊어지고.';
  $('session-state').textContent = '아직 출발하지 않았어요';
}
async function loadStations() {
  if (state.loading) return;
  state.loading = true; state.stationError = false; connection();
  try {
    const [response, shape] = await Promise.all([
      fetch('/api/stations', { signal: AbortSignal.timeout(25000) }),
      fetch('/data/line2-loop.json').then(r => r.ok ? r.json() : null).catch(() => null),
    ]);
    state.railShape = shape;
    if(!shape?.stationAnchors?.length)throw new Error('실제 선로를 불러오지 못했습니다.');
    if (!response.ok) throw new Error('역 API 연결 실패');
    const data = await response.json();
    if (!Array.isArray(data.stations) || data.stations.length < 2) throw new Error('역 정보가 없습니다');
    state.stations = data.stations; state.fetchedAt = data.fetchedAt;
    for (const id of ['from', 'to']) {
      $(id).replaceChildren(...state.stations.map(s => new Option(s.name, s.name)));
    }
    $('from').value = state.stations.some(s => s.name === savedPreferences.from) ? savedPreferences.from : state.stations[0].name;
    $('to').value = state.stations.some(s => s.name === savedPreferences.to) ? savedPreferences.to : state.stations.at(-1).name;
    if(state.duration===null)$('to').value=$('from').value;
    setControls(false); chooseRoute();
  } catch {
    state.stationError = true;
    $('route-summary').textContent = '역 정보를 불러오지 못했어요. 다시 연결해 주세요.';
  } finally { state.loading = false; connection(); }
}
function loadMap() {
  state.tilesLoaded=false;state.tileSampleAt=0;state.mapReadyAt=0;
  $('landscape-tools').replaceChildren();
  state.mapReady = false; state.mapFailed = false;
  $('scene-loading').hidden = false; $('scene').classList.remove('map-ready', 'loading-error');
  $('map-retry').hidden = true;
  $('map-status').textContent = '창밖의 풍경을 준비하고 있어요';
  $('map-detail').textContent = '브이월드의 실제 3D 지도를 불러옵니다.';
  $('map-frame').src = `/map?t=${Date.now()}`;
  clearTimeout(mapTimer);
  mapTimer = setTimeout(() => mapError('지도 연결 시간이 길어지고 있습니다. 네트워크와 브라우저 하드웨어 가속을 확인해 주세요.'), 60000);
  connection();
}
function mapError(message) {
  scenery?.close();
  comparison?.close();
  clearTimeout(mapTimer); state.mapFailed = true; state.mapReady = false;
  if (clock.state === 'running') { clock.pause(); clearTimeout(completionTimer); audio.setActive(false); $('pause').textContent = '▶ 이어가기'; }
  $('scene-loading').hidden = false; $('scene').classList.add('loading-error');
  $('map-status').textContent = '풍경을 불러오지 못했어요'; $('map-detail').textContent = message; $('map-retry').hidden = false;
  connection();
}
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== $('map-frame')?.contentWindow) return;
  const data = event.data;
  if(data?.type==='jf:map-initialized'){
    post('view',{view:state.view});post('rendering',{mode:renderMode});
    post('cabin',{active:experienceMode==='cabin'});
    if(state.route)post('position',{position:positionAt(state.route,routeProgress())});
  }
  if (data?.type === 'jf:map-ready') {
    state.mapReadyAt=performance.now();entryProgress({progress:88,stage:'world',label:'창밖 풍경을 채우고 있어요.',detail:'처음 바라볼 곳의 지형과 풍경을 기다리는 중이에요.'});
    clearTimeout(mapTimer); state.mapReady = true; state.mapFailed = false;
    $('scene-loading').hidden = true; $('scene').classList.add('map-ready'); $('scene').classList.remove('loading-error');
    post('view', { view: state.view });
    post('geometry', { rail: state.route?.geometry === 'osm-rail' });
    if (state.route) post('position', { position: positionAt(state.route, routeProgress()) });
    post('lock', { locked: Boolean(comparison?.active) || ['running', 'paused'].includes(clock.state) });
    comparison?.ready();
    applySeatView();
    post('rendering',{mode:renderMode});
    post('cabin',{active:experienceMode==='cabin'});
    scenery?.mapReady();
    connection();
  }
  if (data?.type === 'jf:map-error') mapError(typeof data.message === 'string' ? data.message : '지도 연결을 확인해 주세요.');
  if(data?.type==='jf:entry-view-ready'&&data.id===entryViewId)entryViewReady=true;
  if(data?.type==='jf:shortcut')handleShortcut(data.key);
  if(data?.type==='jf:rendering-state'&&data.mode===renderMode){
    const label={light:'가볍게',balanced:'균형',cinematic:'높은 디테일'}[data.effectiveMode]||'균형';
    $('render-quality-status').textContent=`${renderMode==='auto'?'자동 · ':''}${label}${data.fallback?' · 일부 설정은 기기 기본값 사용':''}`;
  }
  if (data?.type === 'jf:map-stats' && Number.isFinite(data.fps)) {
    state.tilesLoaded=Boolean(data.tilesLoaded);state.tileSampleAt=performance.now();
    state.fps = data.fps;
    $('fps-label').textContent = `${data.fps} FPS · ${data.tilesLoaded ? '지형 로딩 완료' : '지형 불러오는 중'}`;
  }
  comparison?.diagnostics(data || {});
  scenery?.message(data||{});
});
function begin() {
  if (!state.route || !state.mapReady || document.body.classList.contains('boarding-mode')||document.body.classList.contains('entry-preparing')) return;
  comparison?.close();
  scenery?.close();
  if (clock.state === 'paused') { togglePause(); return; }
  if (!selectedSeat) return;
  clock.start(state.duration); state.recorded = false;
  setControls(true); document.body.classList.add('running'); post('lock', { locked: true });
  $('pause').textContent = 'Ⅱ 일시정지'; $('session-kicker').textContent = 'YOUR JOURNEY IS UNDERWAY'; $('session-title').textContent = '지금은, 나에게 집중할 시간.';
  audio.setActive(true); scheduleCompletion(); connection(); update();
}
function scheduleCompletion() {
  clearTimeout(completionTimer);
  const snapshot = clock.snapshot();
  if (snapshot.state === 'running'&&!snapshot.unlimited) completionTimer = setTimeout(() => { update(); scheduleCompletion(); }, Math.max(50, (snapshot.duration - snapshot.elapsed) * 1000 + 20));
  else if (snapshot.state === 'completed') finish();
}
function togglePause() {
  if (clock.state === 'running') clock.pause();
  else if (clock.state === 'paused' && state.mapReady) clock.resume();
  if (clock.state === 'completed') { finish(); return; }
  $('pause').textContent = clock.state === 'paused' ? '▶ 이어가기' : 'Ⅱ 일시정지';
  audio.setActive(clock.state === 'running'); scheduleCompletion(); connection(); update();
}
function finish() {
  if (state.recorded || !state.route) return;
  state.recorded = true;
  clearTimeout(completionTimer);
  const snapshot = clock.snapshot();
  const completed = snapshot.state === 'completed';
  const metrics=journeyMetrics(state.route,snapshot);
  const entry = { from: $('from').value, to: snapshot.unlimited?positionAt(state.route,metrics.progress).name:$('to').value, elapsed: Math.round(snapshot.elapsed), duration: snapshot.duration, completed, date: new Date().toISOString(),...(snapshot.unlimited?{unlimited:true,laps:metrics.laps,distanceMetres:Math.round(metrics.distance)}:{}) };
  let saved = true;
  try { localStorage.setItem('journey-focus-history', JSON.stringify([entry, ...history()].slice(0, 30))); } catch { saved = false; }
  updateHistoryCount(); setControls(false); audio.setActive(false); post('lock', { locked: Boolean(comparison?.active) }); document.body.classList.remove('running');
  $('session-kicker').textContent = completed ? 'YOU HAVE ARRIVED' : 'A MOMENT WELL SPENT';
  $('session-title').textContent = completed ? '오늘의 여정을 완주했어요.' : '잠시 머문 시간도, 나를 위한 시간.';
  connection();
  dialog(completed ? '나에게 도착한 시간.' : '오늘의 여정을 마쳤어요.', `<p>${entry.unlimited?`2호선 무제한 순환 · ${entry.laps}바퀴 완료 · 약 ${(entry.distanceMetres/1000).toFixed(1)}km`:`${escape(entry.from)}에서 ${escape(entry.to)}까지 ${completed ? '목표 집중시간을 채웠어요.' : '여기까지 함께했어요.'}`}</p><div class="result-big">${formatTime(entry.elapsed)}</div><p class="result-note">${completed ? '잘 다녀왔어요. 작은 여행이 오늘의 일상에 여유를 더했기를 바라요.' : '다시 떠나고 싶을 때, 언제든 새로운 여정을 시작하세요.'}</p><p>${saved ? '이 브라우저의 여정 기록에 저장했습니다.' : '브라우저 저장이 제한되어 기록을 저장하지 못했습니다.'} 실제 열차 도착이나 운행시간을 의미하지 않습니다.</p>`, completed ? 'JOURNEY COMPLETE' : 'JOURNEY ENDED');
}
function update() {
  const s = clock.snapshot();
  if (['running', 'paused', 'completed', 'stopped'].includes(s.state) && (s.unlimited||s.duration)) {
    const metrics=journeyMetrics(state.route,s);
    $('timer').textContent = formatTime(s.unlimited?Math.floor(s.elapsed):s.duration - s.elapsed);
    const percent = metrics.progress * 100;
    $('progress-fill').style.width = `${percent}%`; $('train-dot').style.left = `${percent}%`;
    $('progress-track').setAttribute('aria-valuenow', String(Math.round(percent)));
    $('session-state').textContent = s.state === 'running' ? s.unlimited?`${Math.floor(s.elapsed/60)}분 집중 중 · ${metrics.laps}바퀴 완료`:`${Math.floor(s.elapsed / 60)}분 집중 중 · ${Math.round(percent)}%` : s.state === 'paused' ? '잠시 쉬어가는 중' : s.state === 'completed' ? '여정 완주' : '여정 종료';
    if (state.route) {
      const position = positionAt(state.route, metrics.progress);
      const movement = state.route.geometry === 'osm-rail' ? (position.tunnel ? '터널 구간 지상 조망' : '철도 선형 조망') : '보간 경로 이동';
      $('location-label').textContent = s.progress >= 1 ? `${position.name} · 여정 완주` : `${position.name} → ${position.next} · ${s.state === 'paused' ? '잠시 정지' : movement}`;
      if (s.state === 'completed'&&!state.recorded) post('position', { position });
    }
    if (s.state === 'completed') finish();
  }
  syncGameHUD();
  publishCabinSession();
}
function tick(now) {
  if (now - lastUpdate > 100) { update(); lastUpdate = now; }
  if (clock.state === 'running' && state.route && now - lastCamera > 30) {
    post('position', { position: positionAt(state.route, routeProgress()) });
    lastCamera = now;
  }
  requestAnimationFrame(tick);
}
$('start').onclick = begin;
$('pause').onclick = togglePause;
$('stop').onclick = () => { clock.stop(); update(); finish(); };
$('from').onchange = () => {if(journeyRecommendation())applyRecommendation();else chooseRoute();}; $('to').onchange = chooseRoute;
$('swap').onclick = () => { const from = $('from').value; $('from').value = $('to').value; $('to').value = from; chooseRoute(); };
document.querySelectorAll('[data-duration]').forEach(button => {
  button.setAttribute('aria-pressed', String(button.classList.contains('selected')));
  button.onclick = () => {
    resetSessionPreview();
    changeDuration(Number(button.dataset.duration));
  };
});
function setView(view) {
  state.view = view; $('scene').dataset.view = view;
  for (const [id, mode] of [['window-view', 'window'], ['overview-view', 'overview']]) { $(id).classList.toggle('active', mode === view); $(id).setAttribute('aria-pressed', String(mode === view)); }
  post('view', { view });
}
$('window-view').onclick = () => {setView('window');saveUserSettings();}; $('overview-view').onclick = () => {setView('overview');saveUserSettings();};
$('sound-button').onclick = async () => {
  try { const enabled = await audio.toggle(); $('sound-button').setAttribute('aria-pressed', String(enabled)); $('sound-button').querySelector('span').textContent = enabled ? '열차 소리 켬' : '열차 소리 끔'; if (enabled && clock.state !== 'running'&&!scenery?.running) toast('여정이나 풍경 미리보기를 재생하면 합성 열차 소리가 들려요.'); }
  catch { toast('이 브라우저에서 소리를 재생하지 못했어요.'); }
};
$('focus-button').onclick = () => {
  const enabled = document.body.classList.toggle('focus-mode'); $('focus-button').setAttribute('aria-pressed', String(enabled)); $('focus-button').querySelector('span').textContent = enabled ? '기본 화면' : '집중 화면';
};
$('map-retry').onclick = loadMap;
$('retry').onclick = () => { if (state.stationError) loadStations(); if (state.mapFailed) loadMap(); };
$('about-button').onclick = () => dialog('창밖으로 떠나는 집중.', '<p>Journey Focus는 책상이나 도서관에 앉아, 열차에 타고 이동하는 느낌으로 나만의 집중 시간을 보내는 서비스입니다.</p><h3>작은 여행을 시작하는 방법</h3><ol><li>출발역과 도착역을 선택하세요.</li><li>집중하고 싶은 시간을 정하세요. 처음이라면 1분 체험을 추천해요.</li><li>여정을 시작하고, 잠시 나에게 집중하세요.</li></ol><p>브이월드의 실제 3D 공간정보와 서울시 T Data의 역 좌표를 사용합니다. 2호선 본선 43개 역의 실제 OSM 선로를 사용합니다. 시간에 맞는 도착역을 추천하며, 무제한 모드에서는 한 바퀴 약 90분의 속도로 계속 순환합니다. 지하 구간은 현재 지상 지도에서 조망합니다. 선로 높이와 열차 시각표는 미검증이며, 터널 구간은 지상에서 조망합니다. 창가 시점의 높이는 설정에 따라 달라지고, 넓게 보기는 항공 조망입니다. 300m 근경 미리보기는 지형 위 약 6m의 재구성 시점이며 실제 선로 표고는 미검증입니다.</p>');
function showData() {
  const time = state.fetchedAt ? new Date(state.fetchedAt).toLocaleString('ko-KR') : '미수신';
  const rail = state.route?.geometry === 'osm-rail';
  dialog('실제 데이터, 정확한 구분.', `<div class="data-grid"><div class="data-item"><strong>브이월드 3D API 3.0</strong><span>${state.mapReady ? '지도 렌더러 연결됨' : '지도 연결 확인 필요'}</span></div><div class="data-item"><strong>T Data 2호선 역사마스터</strong><span>${state.stations.length}개 역 · 좌표 수신</span></div></div><h3>현재 확인된 것</h3><p>브이월드 공식 SDK를 통해 지도와 지형을 요청합니다. 역 이름과 좌표는 서울특별시 교통정책지원시스템(TAIMS)의 지하철역_GEOM 응답입니다. 수신 시각: ${escape(time)}.</p><h3>지금 선택한 이동 경로</h3><p>${rail ? 'OSM 내선순환 관계 4729409의 연결된 선로 554개 좌표와 43개 본선 역을 사용합니다. 지선은 제외합니다. 무제한은 닫힌 선로를 계속 순환하며, 지하 구간도 현재 지상 지도에서 조망합니다. 실제 선로 표고와 운행 규칙은 검증하지 않았습니다.' : '이 구간은 역 좌표를 연결한 보간 경로입니다. 산이나 건물을 가로지를 수 있으며 실제 선로와 일치하지 않습니다. 기본 구간 성수–건대입구에서는 OSM 철도 선형을 사용할 수 있습니다.'} 표시 거리는 선택한 경로를 계산한 값입니다.</p><h3>아직 검증하지 않은 것</h3><p>선로 높이, 터널 내부, 정차시간과 운행 시각표입니다. 창가 시점은 지형 위 설정한 높이의 조망이며, 넓게 보기는 항공 시점입니다. 실제 열차 창문 높이가 아닙니다. 집중시간에 맞춰 이동하므로 실제 운행시간을 뜻하지 않습니다.</p><h3>데이터 이용과 기록</h3><p>브이월드 지형·3D 자산은 별도 저장하지 않습니다. 여정 기록은 이 브라우저에만 보관됩니다. 화면 우측 FPS는 현재 기기의 지도 렌더 횟수 측정치이며 품질을 보장하는 수치가 아닙니다.</p><p><a href="https://www.vworld.kr/" target="_blank" rel="noopener noreferrer">VWorld 공간정보 오픈플랫폼 ↗</a><br><a href="https://t-data.seoul.go.kr/category/dataviewopenapi.do?data_id=1036" target="_blank" rel="noopener noreferrer">서울특별시 T Data · 지하철역 좌표정보 (저작자 표시) ↗</a><br><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">철도 선형 © OpenStreetMap contributors · ODbL 1.0 ↗</a><br><a href="https://polyhaven.com/license" target="_blank" rel="noopener noreferrer">근경 식생·재질: Poly Haven CC0 ↗</a></p>`, 'DATA & SOURCES');
}
$('data-button').onclick = showData; $('geometry-info').onclick = showData;
$('history-button').onclick = () => {
  const rows = history();
  dialog('나에게 남은 여정들.', rows.length ? rows.map(row => `<div class="history-row"><div>${escape(row.from)} → ${escape(row.to)}<small>${escape(new Date(row.date).toLocaleString('ko-KR'))}</small></div><div>${formatTime(row.elapsed)}<small>${row.unlimited===true?'순환 종료 · '+(Number.isInteger(row.laps)?row.laps:0)+'바퀴':row.completed ? '완주' : '중간 종료'}</small></div></div>`).join('') + '<p>기록은 이 브라우저에만 저장됩니다.</p><button class="quiet-button" id="clear-history">기록 모두 지우기</button>' : '<p>아직 기록된 여정이 없어요. 첫 여정을 떠나 보세요.</p>', 'YOUR JOURNEYS');
  const clear = $('clear-history');
  if (clear) clear.onclick = () => { try { localStorage.removeItem('journey-focus-history'); updateHistoryCount(); $('dialog-content').innerHTML = '<p>여정 기록을 지웠습니다.</p>'; } catch { toast('기록을 지우지 못했어요.'); } };
};
$('dialog-close').onclick = () => $('info-dialog').close();
$('info-dialog').addEventListener('click', event => { if (event.target === $('info-dialog')) { const rect = $('info-dialog').getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) $('info-dialog').close(); } });
function handleShortcut(key){
 if(document.body.classList.contains('entry-preparing'))return;
 if(key==='escape'&&$('game-settings')?.open){$('game-settings').close();return;}
 if($('info-dialog').open||document.body.classList.contains('boarding-mode'))return;
 if(key==='escape'&&document.body.classList.contains('focus-mode'))$('focus-button').click();
 if(key!=='space')return;
 if(scenery?.active){if(!$('scenery-play').disabled)$('scenery-play').click();return;}
 if(!comparison?.active&&['running','paused'].includes(clock.state))togglePause();
}
document.addEventListener('keydown', event => {
 if(event.isComposing)return;
 if(event.key==='Escape')handleShortcut('escape');
 if(event.code==='Space'&&!/^(INPUT|SELECT|TEXTAREA|BUTTON|A)$/.test(event.target?.tagName)&&!event.target?.isContentEditable){event.preventDefault();if(!event.repeat)handleShortcut('space');}
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) update(); });
let unloadRecoveryTimer;
window.addEventListener('beforeunload', event => {
 if (!['running','paused'].includes(clock.state)) return;
 event.preventDefault();event.returnValue='';clearTimeout(unloadRecoveryTimer);
 // Some provider builds dispose their scene during beforeunload, even when
 // the user later cancels navigation. Recreate only a disposed map frame.
 unloadRecoveryTimer=setTimeout(()=>{
  if(!state.mapReady||document.body.classList.contains('boarding-mode'))return;
  let valid=false;try{const v=$('map-frame').contentWindow.ws3d?.viewer;valid=Boolean(v?.scene)&&v.isDestroyed?.()!==true&&v.scene.isDestroyed?.()!==true;}catch{}
  if(!valid)loadMap();
 },150);
});
window.addEventListener('pagehide',()=>clearTimeout(unloadRecoveryTimer));
comparison = createComparison({
  toast,
  context: () => ({ route: state.route, from: $('from').value, to: $('to').value, geometry: state.route?.geometry, sessionProgress: routeProgress() }),
  applySettings: settings => post('visual', { settings }),
  pause: () => { if (clock.state === 'running') togglePause(); },
  windowView: () => setView('window'),
  seek: position => post('position', { position }),
  lock: locked => post('lock', { locked: locked || ['running', 'paused'].includes(clock.state) }),
  restore: () => { if (state.route) post('position', { position: positionAt(state.route, routeProgress()) }); },
});
scenery=createScenery({
  toast,post,
  sound:active=>audio.setActive(active),
  route:()=>state.route?.stations[0]?.name==='백양리'&&state.route?.stations.at(-1)?.name==='강촌'?state.route:null,
  pause:()=>{if(clock.state==='running')togglePause();setView('window');},
  closeComparison:()=>comparison.close(),
  seek:(position,snap=false)=>post('position',{position,snap}),
  controls:active=>{
    if(active){for(const id of ['from','to','swap','start','compare-toggle','pause','stop'])$(id).disabled=true;document.querySelectorAll('[data-duration]').forEach(b=>b.disabled=true);}
    else{setControls(['running','paused'].includes(clock.state));$('pause').disabled=false;$('stop').disabled=false;connection();}
  },
  restore:()=>{post('lock',{locked:['running','paused'].includes(clock.state)});comparison.ready();if(state.route)post('position',{position:positionAt(state.route,routeProgress())});},
});
document.querySelectorAll('[data-duration]').forEach(b=>{const selected=Number(b.dataset.duration)===state.duration;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
setView(state.view);
setExperience('cabin');
function initCabin(character){
 cabin?.dispose?.();cabinFailed=false;$('cabin-root').dataset.ready='false';
const cabinFrame=document.createElement('iframe');cabinFrame.id='cabin-frame';cabinFrame.title='객실 안에서 캐릭터를 움직이고 좌석을 고르는 화면';
const cabinUrl=new URL('/cabin-frame',location.origin);if(['localhost','127.0.0.1'].includes(location.hostname))cabinUrl.hostname=location.hostname==='localhost'?'127.0.0.1':'localhost';cabinUrl.searchParams.set('parent',location.origin);cabinUrl.searchParams.set('character',character);
const cabinOrigin=cabinUrl.origin;
function cabinPost(active){cabinFrame.contentWindow?.postMessage({type:'jf:cabin-active',active},cabinOrigin);}
cabin={setActive:cabinPost,suspend:()=>cabinPost(false),setSession:session=>cabinFrame.contentWindow?.postMessage({type:'jf:cabin-session',session},cabinOrigin),configure:(id,reset)=>cabinFrame.contentWindow?.postMessage({type:'jf:cabin-configure',character:id,reset},cabinOrigin),dispose:()=>{window.removeEventListener('message',onCabinMessage);cabinFrame.remove();}};
function onCabinMessage(event){
 if(event.source!==cabinFrame.contentWindow||event.origin!==cabinOrigin)return;
 if(event.data?.type==='jf:cabin-error'){cabinFailed=true;}
 if(event.data?.type==='jf:cabin-progress'){
  const p=event.data.progress||{};
  if(p.phase==='character')entryProgress({progress:8,stage:'cabin',label:'함께할 캐릭터를 준비하고 있어요.',detail:'캐릭터의 모습과 움직임을 불러오고 있어요.'});
  if(p.phase==='download')entryProgress({progress:p.total>0?10+Math.min(1,p.loaded/p.total)*32:15,stage:'cabin',label:'열차 객실을 불러오고 있어요.',detail:'내가 앉을 좌석과 객실을 준비하고 있어요.'});
  if(p.phase==='materials')entryProgress({progress:46,stage:'cabin',label:'객실을 꾸미고 있어요.',detail:'의자와 캐릭터의 모습을 준비하고 있어요.'});
  if(p.phase==='shaders')entryProgress({progress:54,stage:'cabin',label:'객실에 불을 켜고 있어요.',detail:'처음 화면이 부드럽게 보이도록 미리 그려보고 있어요.'});
 }
 if(event.data?.type==='jf:cabin-ready'){$('cabin-root').dataset.ready='true';cabinPost(experienceMode==='cabin'&&!document.body.classList.contains('boarding-mode'));publishCabinSession(true);}
 if(event.data?.type==='jf:cabin-window')setExperience('window');
 if(event.data?.type==='jf:cabin-shortcut'&&['space','escape'].includes(event.data.key))handleShortcut(event.data.key);
 if(event.data?.type==='jf:cabin-state'){
  const s=event.data.state;if(!s||!Number.isFinite(s.x)||!Number.isFinite(s.z))return;
  const seat=s.seatId===null?null:CABIN_SEATS.find(seat=>seat.id===s.seatId);if(s.seatId!==null&&!seat)return;
  $('cabin-root').dataset.character=characterById(s.character).id;$('cabin-root').dataset.seat=seat?.id||'';$('cabin-root').dataset.position=String(s.x)+','+String(s.z);$('cabin-root').dataset.posture=s.posture;
  const changed=seat?.id!==selectedSeat?.id;selectedSeat=seat;
  $('cabin-view').textContent='캐릭터';if(changed){applySeatView();connection();}
 }
}
window.addEventListener('message',onCabinMessage);
cabinFrame.src=cabinUrl.href;$('cabin-root').replaceChildren(cabinFrame);
window.addEventListener('pagehide',()=>cabin?.suspend());

}
updateHistoryCount(); requestAnimationFrame(tick);
loadStations();
async function initJourney(signal){
return fetch('/api/status',{signal}).then(r => r.json()).then(config => {
  signal?.throwIfAborted();
  if (!config.vworldConfigured) { mapError('BAI/.env.local의 VWORLD_API_KEY를 입력하고 서버를 다시 시작해 주세요.'); return; }
  if (config.serviceUrl.replace(/\/$/, '') !== location.origin) toast(`키 등록 주소 ${config.serviceUrl}에서 접속하는 것을 권장합니다.`);
  loadMap();
}).catch(error => {if(signal?.aborted)throw error;mapError('로컬 서버에 연결하지 못했습니다. 서버 실행 상태를 확인해 주세요.');});

}
function waitForEntry(test,failure,timeout,signal){
 return new Promise((resolve,reject)=>{
  let timer,interval;const stop=()=>{clearTimeout(timer);clearInterval(interval);signal?.removeEventListener('abort',abort);};
  const abort=()=>{stop();reject(new DOMException('입장을 취소했습니다.','AbortError'));};
  const check=()=>{if(signal?.aborted){abort();return;}const error=failure();if(error){stop();reject(new Error(error));return;}if(test()){stop();resolve();}};
  timer=setTimeout(()=>{stop();reject(new Error('열차 준비가 평소보다 오래 걸리고 있어요. 연결을 확인한 뒤 다시 시도해 주세요.'));},timeout);interval=setInterval(check,100);signal?.addEventListener('abort',abort,{once:true});check();
 });
}
async function enterTrain(ticket,{signal,onProgress=()=>{}}={}){
 const token=Symbol('entry');activeEntry=token;entryProgress=onProgress;
 let cabinPrepared=false;
 document.body.classList.add('entry-preparing');$('journey-workspace').inert=true;
 boardingTicket=ticket;selectedSeat=null;clock.reset();state.recorded=false;state.duration=ticket.duration;$('from').value=ticket.from;$('to').value=ticket.to;setControls(false);chooseRoute();document.body.classList.remove('boarding-mode');document.body.classList.add('in-train');$('journey-workspace').hidden=false;
 document.querySelector('.header-center').textContent=(ticket.duration===null?ticket.from+' 출발 · 2호선 순환':ticket.from+' → '+ticket.to)+' · '+formatDuration(ticket.duration)+' · '+characterById(ticket.character).name;
 try{
  signal?.throwIfAborted();onProgress({progress:10,stage:'cabin',label:'열차 객실을 준비하고 있어요.',detail:'마음에 드는 창가 자리를 곧 고를 수 있어요.'});
  if(!$('cabin-frame')||cabinFailed)initCabin(ticket.character);else cabin?.configure(ticket.character,true);
  setExperience('cabin');preview();connection();
  await waitForEntry(()=>$('cabin-root').dataset.ready==='true'&&$('cabin-root').dataset.character===ticket.character&&$('cabin-root').dataset.seat==='',()=>cabinFailed?'객실을 불러오지 못했어요. 다시 준비해 볼까요?':null,60000,signal);
  cabinPrepared=true;
  onProgress({progress:65,stage:'world',label:'창밖 풍경을 불러오고 있어요.',detail:'열차가 출발할 곳의 풍경을 준비하고 있어요.'});
  // Avoid compiling two 3D renderers at the same time on the GPU.
  cabin?.setActive(false);
  if(!state.mapReady||state.mapFailed)await initJourney(signal);
  await waitForEntry(()=>state.mapReady,()=>state.mapFailed?'창밖 풍경에 연결하지 못했어요. 연결을 확인하고 다시 시도해 주세요.':null,65000,signal);
  onProgress({progress:90,stage:'world',label:'열차가 곧 도착해요.',detail:'처음 보이는 풍경이 채워질 때까지 기다리고 있어요.'});
  entryViewId='entry-'+(++entrySequence);entryViewReady=false;post('entry-prepare',{id:entryViewId,position:positionAt(state.route,0)});
  await waitForEntry(()=>entryViewReady,()=>state.mapFailed?'창밖 풍경 준비가 중단됐어요. 다시 시도해 주세요.':null,60000,signal);
  onProgress({progress:98,stage:'world',label:'탑승할 준비가 됐어요.',detail:'객실 문을 열고 있어요.'});
  cabin?.setActive(true);await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);signal?.throwIfAborted();
 }catch(error){if(activeEntry===token){cabin?.setActive(false);if(!signal?.aborted){if(!cabinPrepared)cabinFailed=true;else state.mapFailed=true;}}throw error;}finally{if(activeEntry===token){activeEntry=null;entryProgress=()=>{};}}
}
boarding=createBoarding({host:$('boarding-screen'),context:()=>({from:$('from').value,to:$('to').value,duration:state.duration,recommendation:journeyRecommendation(),ready:Boolean(state.route?.geometry==='osm-rail'&&state.stations.length>1&&!state.loading&&!state.stationError),error:state.stationError}),onDurationChange:changeDuration,onApplyRecommendation:applyRecommendation,onBoarded:enterTrain,onEntered:()=>{document.body.classList.remove('entry-preparing');$('journey-workspace').inert=false;cabin?.setActive(experienceMode==='cabin');},onRetry:loadStations,onOpen:()=>{document.body.classList.remove('entry-preparing');$('journey-workspace').inert=false;cabin?.setActive(false);post('cabin',{active:true});comparison?.close();setControls(false);document.querySelector('.header-center').textContent='다음 여정을 준비하는 시간';}});
$('boarding-reopen').onclick=()=>{if(['running','paused'].includes(clock.state)){dialog('나의 승차권', '<p>'+(boardingTicket.duration===null?escape(boardingTicket.from)+' 출발 · 2호선 순환':escape(boardingTicket.from)+' → '+escape(boardingTicket.to))+'</p><div class="result-big">'+escape(formatDuration(boardingTicket.duration))+'</div><p>'+escape(characterById(boardingTicket.character).name)+' · '+escape(boardingTicket.id)+'</p><p>여정을 마친 뒤 새 승차권을 준비할 수 있어요.</p>','MY BOARDING PASS');}else boarding.open();};
setupGameHUD();
document.querySelector('.header-center').textContent='다음 여정을 준비하는 시간';

document.querySelector('.skip-link').onclick=event=>{if(!document.body.classList.contains('boarding-mode')){event.preventDefault();$('journey-workspace').focus();}};

function setupGameHUD(){
 const chrome=document.createElement('div');chrome.id='game-chrome';chrome.innerHTML=`<div class="game-nav"><button id="game-settings-button" aria-label="열차 설정 열기" title="열차 설정">☰ <span>설정</span></button><div id="game-views"></div></div><section class="train-monitor" aria-label="열차 역 안내"><i class="monitor-screw"></i><div class="monitor-display"><span class="monitor-line">2</span><div><small id="monitor-caption">이번 역</small><strong id="monitor-station">성수</strong></div><span class="monitor-arrow">→</span><div class="monitor-next"><small id="monitor-next-caption">다음 역</small><b id="monitor-next">건대입구</b></div><div class="monitor-track"><span id="monitor-progress"></span></div></div><i class="monitor-screw"></i></section><section class="game-clock" id="game-clock" aria-label="집중 시간" hidden><div class="game-clock-label"><i></i><span id="game-clock-label">집중하는 시간</span></div><div id="game-timer-slot"></div><div class="game-clock-actions" id="game-clock-actions"></div></section><div class="game-departure" id="game-departure"><div id="game-departure-status"></div><div id="game-start-slot"></div></div>`;
 $('journey-workspace').append(chrome);
 $('game-views').append(document.querySelector('.experience-tabs'));
 $('game-timer-slot').append($('timer'));$('game-clock-actions').append($('pause'),$('stop'));
 $('game-start-slot').append($('start'));$('game-departure-status').append($('connection'));
 const settings=document.createElement('dialog');settings.id='game-settings';settings.setAttribute('aria-labelledby','game-settings-title');settings.innerHTML=`<div class="game-settings-heading"><div><small>JOURNEY FOCUS</small><h2 id="game-settings-title">열차 설정</h2></div><button id="game-settings-close" aria-label="설정 닫기">×</button></div><div id="game-settings-links" class="game-settings-links"></div><h3>창밖 풍경</h3><div id="game-visual-settings"></div><div id="game-extra-settings" class="game-extra-settings"></div><p class="game-settings-note">위쪽 전광판은 집중 여정의 위치를 안내해요. 실제 운행 정보와는 다를 수 있어요.</p>`;
 document.body.append(settings);
 $('game-settings-links').append($('boarding-reopen'),$('about-button'),$('history-button'));
 $('game-visual-settings').append(document.querySelector('.render-settings'),$('landscape-tools'));
 $('game-extra-settings').append($('sound-button'),$('data-button'),$('geometry-info'),$('compare-toggle'));
 $('geometry-info').textContent='이동 경로 안내';
 $('game-settings-button').onclick=()=>{cabin?.setActive(false);settings.showModal();};
 $('game-settings-close').onclick=()=>settings.close();
 settings.addEventListener('close',()=>{if(!$('info-dialog').open)cabin?.setActive(experienceMode==='cabin'&&!document.body.classList.contains('boarding-mode'));});
 settings.addEventListener('click',e=>{if(e.target===settings){const r=settings.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)settings.close();}});
 for(const id of ['boarding-reopen','about-button','history-button','data-button','geometry-info','compare-toggle'])$(id).addEventListener('click',()=>settings.close());
 $('info-dialog').addEventListener('close',()=>{if(!settings.open)cabin?.setActive(experienceMode==='cabin'&&!document.body.classList.contains('boarding-mode'));});
 syncGameHUD();
}
function syncGameHUD(){
 if(!$('game-chrome'))return;
 const s=clock.snapshot(),metrics=journeyMetrics(state.route,s),started=['running','paused','completed','stopped'].includes(s.state)&&(s.unlimited||Boolean(s.duration)),p=state.route?positionAt(state.route,metrics.progress):null;
 const text=(id,value)=>{if($(id).textContent!==value)$(id).textContent=value;};
 $('game-clock').hidden=!started;$('game-departure').hidden=started;
 $('game-chrome').dataset.state=s.state;
 text('game-clock-label',s.state==='paused'?'잠시 쉬어가는 중':s.state==='completed'?'여정 도착':s.state==='stopped'?'여정 종료':s.unlimited?'누적 집중시간 · ∞':'남은 집중시간');
 text('monitor-caption',s.unlimited?`∞ ${metrics.laps}바퀴 완료`:s.progress>=1?'도착역':s.state==='running'?'지금 지나고 있어요':'이번 역');
 text('monitor-station',p?.name||$('from').value||'성수');
 text('monitor-next',s.progress>=1?'여정 완료':p?.next||$('to').value||'건대입구');
 text('monitor-next-caption',s.progress>=1?'잘 다녀왔어요':s.state==='paused'?'잠시 정차':'다음 역');
 $('monitor-progress').style.width=`${Math.round(metrics.progress*100)}%`;
 $('game-chrome').dataset.laps=String(metrics.laps);$('game-chrome').dataset.unlimited=String(s.unlimited);
 $('landscape-view').disabled=!selectedSeat;
 if($('game-settings').open||$('info-dialog').open)cabin?.setActive(false);
}
