import { SessionClock, formatTime } from '/src/session.mjs';
import { buildRoute, positionAt } from '/src/route.mjs';
import { TrainAudio } from '/audio.mjs';
import { createComparison } from '/comparison.mjs';
import { createScenery } from '/scenery.mjs';
import {normalizeRenderingMode} from '/src/rendering.mjs';
import {readPreferences,savePreferences} from '/src/preferences.mjs';

const $ = id => document.getElementById(id);
let preferenceStorage;
try{preferenceStorage=localStorage;}catch{}
const savedPreferences=readPreferences(preferenceStorage);
const clock = new SessionClock();
const audio = new TrainAudio(() => { if(scenery?.active)return scenery.remaining;const s = clock.snapshot(); return s.duration - s.elapsed; });
const state = { stations: [], route: null, railShape: null, duration: savedPreferences.duration, mapReady: false, mapFailed: false, view: savedPreferences.view, recorded: false, stationError: false, loading: false, fetchedAt: null, fps: null };
let toastTimer, mapTimer, completionTimer, lastUpdate = 0, lastCamera = 0;
let comparison = null;
let scenery=null;
let renderMode='auto';
try{renderMode=normalizeRenderingMode(localStorage.getItem('journey-focus-rendering'));}catch{}
$('render-quality').value=renderMode;
$('render-quality').onchange=()=>{
 renderMode=normalizeRenderingMode($('render-quality').value);
 try{localStorage.setItem('journey-focus-rendering',renderMode);}catch{}
 post('rendering',{mode:renderMode});
};
function post(type, data = {}) { $('map-frame').contentWindow?.postMessage({ type: `jf:${type}`, ...data }, location.origin); }
function toast(message) {
  $('toast').textContent = message; $('toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4500);
}
function dialog(title, html, eyebrow = 'JOURNEY GUIDE') {
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
  $('connection-text').textContent = failed ? '연결 상태를 확인해 주세요' : ready ? `VWorld 연결 · 2호선 ${state.stations.length}개 역` : '실제 API 연결 확인 중';
  $('retry').hidden = !failed;
  $('start').disabled = !ready || !state.route || state.loading;
  $('compare-toggle').disabled = !ready || !state.route || state.loading;
  $('scenery-toggle').disabled=true;$('scenery-toggle').hidden=true;
  if(scenery?.active){$('start').disabled=true;$('compare-toggle').disabled=true;}
  $('start-label').textContent = clock.state === 'running' ? '여정 진행 중' : clock.state === 'paused' ? '여정 이어가기' : ready ? '나의 여정 시작하기' : failed ? 'API 연결을 확인해 주세요' : '여정 준비 중';
  if (clock.state === 'running') $('start').disabled = true;
}
function setControls(active) {
  for (const id of ['from', 'to', 'swap']) $(id).disabled = active || state.stations.length < 2;
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
  $('route-summary').textContent = `${state.route.stations.length}개 역 · ${rail ? 'OSM 철도 선형' : '보간 경로'} 약 ${(state.route.distance / 1000).toFixed(1)} km`;
  $('geometry-label').textContent = rail ? '2호선 실제 선로 · 오른쪽 창가 · 높이 30m 시험값' : '실제 지형 · 역 사이 보간 이동';
  post('geometry', { rail });
  $('scene-description').textContent = `${$('from').value}에서 ${$('to').value}까지, 나에게 집중하는 시간`;
  $('ticket-duration').textContent = `${state.duration / 60} MIN`;
  if (!['running', 'paused'].includes(clock.state)) {
    $('timer').textContent = formatTime(state.duration);
    $('location-label').textContent = `${$('from').value} → ${$('to').value} · 여정 준비`;
    post('position', { position: positionAt(state.route, 0) });
    $('progress-fill').style.width = '0%'; $('train-dot').style.left = '0%'; $('progress-track').setAttribute('aria-valuenow', '0');
  }
}
function chooseRoute() {
  resetSessionPreview();
  try { state.route = buildRoute(state.stations, $('from').value, $('to').value, state.railShape); preview(); }
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
      fetch('/data/seongsu-konkuk.json').then(r => r.ok ? r.json() : null).catch(() => null),
    ]);
    state.railShape = shape;
    if (!response.ok) throw new Error('역 API 연결 실패');
    const data = await response.json();
    if (!Array.isArray(data.stations) || data.stations.length < 2) throw new Error('역 정보가 없습니다');
    state.stations = data.stations; state.fetchedAt = data.fetchedAt;
    for (const id of ['from', 'to']) {
      $(id).replaceChildren(...state.stations.map(s => new Option(s.name, s.name)));
    }
    $('from').value = state.stations.some(s => s.name === savedPreferences.from) ? savedPreferences.from : state.stations[0].name;
    $('to').value = state.stations.some(s => s.name === savedPreferences.to) ? savedPreferences.to : state.stations.at(-1).name;
    setControls(false); chooseRoute();
  } catch {
    state.stationError = true;
    $('route-summary').textContent = '역 정보를 불러오지 못했어요. 다시 연결해 주세요.';
  } finally { state.loading = false; connection(); }
}
function loadMap() {
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
  if (event.origin !== location.origin || event.source !== $('map-frame').contentWindow) return;
  const data = event.data;
  if(data?.type==='jf:map-initialized'){
    post('view',{view:state.view});post('rendering',{mode:renderMode});
    if(state.route)post('position',{position:positionAt(state.route,clock.snapshot().progress)});
  }
  if (data?.type === 'jf:map-ready') {
    clearTimeout(mapTimer); state.mapReady = true; state.mapFailed = false;
    $('scene-loading').hidden = true; $('scene').classList.add('map-ready'); $('scene').classList.remove('loading-error');
    post('view', { view: state.view });
    post('geometry', { rail: state.route?.geometry === 'osm-rail' });
    if (state.route) post('position', { position: positionAt(state.route, clock.snapshot().progress) });
    post('lock', { locked: Boolean(comparison?.active) || ['running', 'paused'].includes(clock.state) });
    comparison?.ready();
    post('rendering',{mode:renderMode});
    scenery?.mapReady();
    connection();
  }
  if (data?.type === 'jf:map-error') mapError(typeof data.message === 'string' ? data.message : '지도 연결을 확인해 주세요.');
  if(data?.type==='jf:shortcut')handleShortcut(data.key);
  if(data?.type==='jf:rendering-state'&&data.mode===renderMode){
    const label={light:'가볍게',balanced:'균형',cinematic:'높은 디테일'}[data.effectiveMode]||'균형';
    $('render-quality-status').textContent=`${renderMode==='auto'?'자동 · ':''}${label}${data.fallback?' · 일부 설정은 기기 기본값 사용':''}`;
  }
  if (data?.type === 'jf:map-stats' && Number.isFinite(data.fps)) {
    state.fps = data.fps;
    $('fps-label').textContent = `${data.fps} FPS · ${data.tilesLoaded ? '지형 로딩 완료' : '지형 불러오는 중'}`;
  }
  comparison?.diagnostics(data || {});
  scenery?.message(data||{});
});
function begin() {
  if (!state.route || !state.mapReady) return;
  comparison?.close();
  scenery?.close();
  if (clock.state === 'paused') { togglePause(); return; }
  clock.start(state.duration); state.recorded = false;
  setControls(true); document.body.classList.add('running'); post('lock', { locked: true });
  $('pause').textContent = 'Ⅱ 일시정지'; $('session-kicker').textContent = 'YOUR JOURNEY IS UNDERWAY'; $('session-title').textContent = '지금은, 나에게 집중할 시간.';
  audio.setActive(true); scheduleCompletion(); connection(); update();
}
function scheduleCompletion() {
  clearTimeout(completionTimer);
  const snapshot = clock.snapshot();
  if (snapshot.state === 'running') completionTimer = setTimeout(() => { update(); scheduleCompletion(); }, Math.max(50, (snapshot.duration - snapshot.elapsed) * 1000 + 20));
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
  const entry = { from: $('from').value, to: $('to').value, elapsed: Math.round(snapshot.elapsed), duration: snapshot.duration, completed, date: new Date().toISOString() };
  let saved = true;
  try { localStorage.setItem('journey-focus-history', JSON.stringify([entry, ...history()].slice(0, 30))); } catch { saved = false; }
  updateHistoryCount(); setControls(false); audio.setActive(false); post('lock', { locked: Boolean(comparison?.active) }); document.body.classList.remove('running');
  $('session-kicker').textContent = completed ? 'YOU HAVE ARRIVED' : 'A MOMENT WELL SPENT';
  $('session-title').textContent = completed ? '오늘의 여정을 완주했어요.' : '잠시 머문 시간도, 나를 위한 시간.';
  connection();
  dialog(completed ? '나에게 도착한 시간.' : '오늘의 여정을 마쳤어요.', `<p>${escape(entry.from)}에서 ${escape(entry.to)}까지 ${completed ? '목표 집중시간을 채웠어요.' : '여기까지 함께했어요.'}</p><div class="result-big">${formatTime(entry.elapsed)}</div><p class="result-note">${completed ? '잘 다녀왔어요. 작은 여행이 오늘의 일상에 여유를 더했기를 바라요.' : '다시 떠나고 싶을 때, 언제든 새로운 여정을 시작하세요.'}</p><p>${saved ? '이 브라우저의 여정 기록에 저장했습니다.' : '브라우저 저장이 제한되어 기록을 저장하지 못했습니다.'} 실제 열차 도착이나 운행시간을 의미하지 않습니다.</p>`, completed ? 'JOURNEY COMPLETE' : 'JOURNEY ENDED');
}
function update() {
  const s = clock.snapshot();
  if (['running', 'paused', 'completed', 'stopped'].includes(s.state) && s.duration) {
    $('timer').textContent = formatTime(s.duration - s.elapsed);
    const percent = s.progress * 100;
    $('progress-fill').style.width = `${percent}%`; $('train-dot').style.left = `${percent}%`;
    $('progress-track').setAttribute('aria-valuenow', String(Math.round(percent)));
    $('session-state').textContent = s.state === 'running' ? `${Math.floor(s.elapsed / 60)}분 집중 중 · ${Math.round(percent)}%` : s.state === 'paused' ? '잠시 쉬어가는 중' : s.state === 'completed' ? '여정 완주' : '여정 종료';
    if (state.route) {
      const position = positionAt(state.route, s.progress);
      const movement = state.route.geometry === 'osm-rail' ? (position.tunnel ? '터널 구간 지상 조망' : '철도 선형 조망') : '보간 경로 이동';
      $('location-label').textContent = s.progress >= 1 ? `${position.name} · 여정 완주` : `${position.name} → ${position.next} · ${s.state === 'paused' ? '잠시 정지' : movement}`;
      if (s.state === 'completed'&&!state.recorded) post('position', { position });
    }
    if (s.state === 'completed') finish();
  }
}
function tick(now) {
  if (now - lastUpdate > 100) { update(); lastUpdate = now; }
  if (clock.state === 'running' && state.route && now - lastCamera > 30) {
    post('position', { position: positionAt(state.route, clock.snapshot().progress) });
    lastCamera = now;
  }
  requestAnimationFrame(tick);
}
$('start').onclick = begin;
$('pause').onclick = togglePause;
$('stop').onclick = () => { clock.stop(); update(); finish(); };
$('from').onchange = chooseRoute; $('to').onchange = chooseRoute;
$('swap').onclick = () => { const from = $('from').value; $('from').value = $('to').value; $('to').value = from; chooseRoute(); };
document.querySelectorAll('[data-duration]').forEach(button => {
  button.setAttribute('aria-pressed', String(button.classList.contains('selected')));
  button.onclick = () => {
    resetSessionPreview();
    state.duration = Number(button.dataset.duration);
    document.querySelectorAll('[data-duration]').forEach(b => { b.classList.toggle('selected', b === button); b.setAttribute('aria-pressed', String(b === button)); });
    preview();
    saveUserSettings();
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
$('about-button').onclick = () => dialog('창밖으로 떠나는 집중.', '<p>Journey Focus는 책상이나 도서관에 앉아, 열차에 타고 이동하는 느낌으로 나만의 집중 시간을 보내는 서비스입니다.</p><h3>작은 여행을 시작하는 방법</h3><ol><li>출발역과 도착역을 선택하세요.</li><li>집중하고 싶은 시간을 정하세요. 처음이라면 1분 체험을 추천해요.</li><li>여정을 시작하고, 잠시 나에게 집중하세요.</li></ol><p>브이월드의 실제 3D 공간정보와 서울시 T Data의 역 좌표를 사용합니다. 기본 구간인 성수–건대입구은 OpenStreetMap 철도 선형을 따라갑니다. 다른 구간은 역 사이 보간 경로입니다. 선로 높이와 열차 시각표는 미검증이며, 터널 구간은 지상에서 조망합니다. 창가 시점의 높이는 설정에 따라 달라지고, 넓게 보기는 항공 조망입니다. 300m 근경 미리보기는 지형 위 약 6m의 재구성 시점이며 실제 선로 표고는 미검증입니다.</p>');
function showData() {
  const time = state.fetchedAt ? new Date(state.fetchedAt).toLocaleString('ko-KR') : '미수신';
  const rail = state.route?.geometry === 'osm-rail';
  dialog('실제 데이터, 정확한 구분.', `<div class="data-grid"><div class="data-item"><strong>브이월드 3D API 3.0</strong><span>${state.mapReady ? '지도 렌더러 연결됨' : '지도 연결 확인 필요'}</span></div><div class="data-item"><strong>T Data 2호선 역사마스터</strong><span>${state.stations.length}개 역 · 좌표 수신</span></div></div><h3>현재 확인된 것</h3><p>브이월드 공식 SDK를 통해 지도와 지형을 요청합니다. 역 이름과 좌표는 서울특별시 교통정책지원시스템(TAIMS)의 지하철역_GEOM 응답입니다. 수신 시각: ${escape(time)}.</p><h3>지금 선택한 이동 경로</h3><p>${rail ? '성수–건대입구의 OpenStreetMap 철도 선형 13개 좌표를 사용합니다. 공식 OSM API에서 가져온 수평 선형 후보이며, 현장 측량 또는 운영기관 검증 자료는 아닙니다. 터널 구간도 지형 위에서 조망합니다.' : '이 구간은 역 좌표를 연결한 보간 경로입니다. 산이나 건물을 가로지를 수 있으며 실제 선로와 일치하지 않습니다. 기본 구간 성수–건대입구에서는 OSM 철도 선형을 사용할 수 있습니다.'} 표시 거리는 선택한 경로를 계산한 값입니다.</p><h3>아직 검증하지 않은 것</h3><p>선로 높이, 터널 내부, 정차시간과 운행 시각표입니다. 창가 시점은 지형 위 설정한 높이의 조망이며, 넓게 보기는 항공 시점입니다. 실제 열차 창문 높이가 아닙니다. 집중시간에 맞춰 이동하므로 실제 운행시간을 뜻하지 않습니다.</p><h3>데이터 이용과 기록</h3><p>브이월드 지형·3D 자산은 별도 저장하지 않습니다. 여정 기록은 이 브라우저에만 보관됩니다. 화면 우측 FPS는 현재 기기의 지도 렌더 횟수 측정치이며 품질을 보장하는 수치가 아닙니다.</p><p><a href="https://www.vworld.kr/" target="_blank" rel="noopener noreferrer">VWorld 공간정보 오픈플랫폼 ↗</a><br><a href="https://t-data.seoul.go.kr/category/dataviewopenapi.do?data_id=1036" target="_blank" rel="noopener noreferrer">서울특별시 T Data · 지하철역 좌표정보 (저작자 표시) ↗</a><br><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">철도 선형 © OpenStreetMap contributors · ODbL 1.0 ↗</a><br><a href="https://polyhaven.com/license" target="_blank" rel="noopener noreferrer">근경 식생·재질: Poly Haven CC0 ↗</a></p>`, 'DATA & SOURCES');
}
$('data-button').onclick = showData; $('geometry-info').onclick = showData;
$('history-button').onclick = () => {
  const rows = history();
  dialog('나에게 남은 여정들.', rows.length ? rows.map(row => `<div class="history-row"><div>${escape(row.from)} → ${escape(row.to)}<small>${escape(new Date(row.date).toLocaleString('ko-KR'))}</small></div><div>${formatTime(row.elapsed)}<small>${row.completed ? '완주' : '중간 종료'}</small></div></div>`).join('') + '<p>기록은 이 브라우저에만 저장됩니다.</p><button class="quiet-button" id="clear-history">기록 모두 지우기</button>' : '<p>아직 기록된 여정이 없어요. 첫 여정을 떠나 보세요.</p>', 'YOUR JOURNEYS');
  const clear = $('clear-history');
  if (clear) clear.onclick = () => { try { localStorage.removeItem('journey-focus-history'); updateHistoryCount(); $('dialog-content').innerHTML = '<p>여정 기록을 지웠습니다.</p>'; } catch { toast('기록을 지우지 못했어요.'); } };
};
$('dialog-close').onclick = () => $('info-dialog').close();
$('info-dialog').addEventListener('click', event => { if (event.target === $('info-dialog')) { const rect = $('info-dialog').getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) $('info-dialog').close(); } });
function handleShortcut(key){
 if($('info-dialog').open)return;
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
window.addEventListener('beforeunload', event => { if (['running', 'paused'].includes(clock.state)) { event.preventDefault(); event.returnValue = ''; } });
comparison = createComparison({
  toast,
  context: () => ({ route: state.route, from: $('from').value, to: $('to').value, geometry: state.route?.geometry, sessionProgress: clock.snapshot().progress }),
  applySettings: settings => post('visual', { settings }),
  pause: () => { if (clock.state === 'running') togglePause(); },
  windowView: () => setView('window'),
  seek: position => post('position', { position }),
  lock: locked => post('lock', { locked: locked || ['running', 'paused'].includes(clock.state) }),
  restore: () => { if (state.route) post('position', { position: positionAt(state.route, clock.snapshot().progress) }); },
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
  restore:()=>{post('lock',{locked:['running','paused'].includes(clock.state)});comparison.ready();if(state.route)post('position',{position:positionAt(state.route,clock.snapshot().progress)});},
});
document.querySelectorAll('[data-duration]').forEach(b=>{const selected=Number(b.dataset.duration)===state.duration;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
setView(state.view);
updateHistoryCount(); requestAnimationFrame(tick);
loadStations();
fetch('/api/status').then(r => r.json()).then(config => {
  if (!config.vworldConfigured) { mapError('BAI/.env.local의 VWORLD_API_KEY를 입력하고 서버를 다시 시작해 주세요.'); return; }
  if (config.serviceUrl.replace(/\/$/, '') !== location.origin) toast(`키 등록 주소 ${config.serviceUrl}에서 접속하는 것을 권장합니다.`);
  loadMap();
}).catch(() => mapError('로컬 서버에 연결하지 못했습니다. 서버 실행 상태를 확인해 주세요.'));
