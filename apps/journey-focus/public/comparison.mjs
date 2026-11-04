import { DEFAULT_VISUAL, BASELINE_VISUAL, normalizeVisual, normalizeBookmark, parseTimestamp, timestamp, routeKey } from '/src/comparison.mjs';
import { positionAt } from '/src/route.mjs';

const VIDEO_ID = 's9KmHA-Jty4';
const SETTINGS_KEY = 'journey-focus-visual';
const BOOKMARKS_KEY = 'journey-focus-comparisons';
const $ = id => document.getElementById(id);
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function readSettings() { try { return normalizeVisual(JSON.parse(localStorage.getItem(SETTINGS_KEY))); } catch { return { ...DEFAULT_VISUAL }; } }
function readBookmarks() { try { const value = JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]'); return Array.isArray(value) ? value.map(normalizeBookmark).filter(Boolean).slice(0, 30) : []; } catch { return []; } }

export function createComparison(api) {
  let active = false, progress = 0, settings = readSettings(), player = null, playerReady = false, loadingVideo = false, seconds = 0, photoUrl = null;
  let bookmarks = readBookmarks(), referenceMode = 'video', cameraSettingsApplied = false, videoTimer;
  $('comparison-panel').innerHTML = `
    <div class="lab-top"><div><h2>풍경을 실제 장면에 맞춰 보세요.</h2><p>먼저 같은 위치와 바라보는 방향을 맞춘 뒤, 능선·건물·숲의 차이를 비교합니다.</p></div><div class="lab-presets"><button id="lab-baseline">이전 화면</button><button id="lab-near">낮은 시점 실험</button><button id="lab-default">추천 시점</button></div></div>
    <div class="lab-route"><label for="lab-progress"><span>지도 위치 · 세션 시간과 별개</span><output id="lab-position">여정 준비 중</output></label><input id="lab-progress" type="range" min="0" max="1000" step="1" value="0"><div id="surface-candidates" class="surface-candidates"></div></div>
    <div class="lab-controls">
      <label class="lab-control"><span>지형 위 높이 <output id="lab-height-value"></output></span><input id="lab-height" type="range" min="3" max="300" step="1"></label>
      <label class="lab-control"><span>바라보는 방향 <output id="lab-heading-value"></output></span><input id="lab-heading" type="range" min="-180" max="180" step="1"></label>
      <label class="lab-control"><span>위아래 각도 <output id="lab-pitch-value"></output></span><input id="lab-pitch" type="range" min="-60" max="10" step="1"></label>
      <label class="lab-control"><span>화각 <output id="lab-fov-value"></output></span><input id="lab-fov" type="range" min="30" max="100" step="1"></label>
      <label class="lab-control">건물 데이터<select id="lab-buildings"><option value="all">전체 상세도 비교 (All)</option><option value="lod4">기존 고상세 (LoD4)</option><option value="lod3">LoD3</option><option value="lod2">LoD2</option><option value="lod1">LoD1</option><option value="off">건물 끄기</option></select></label>
      <p class="lab-control">화면 품질은 위의 품질 메뉴에서 조절할 수 있어요.</p>
    </div>
    <div class="lab-diagnostics" aria-live="polite"><span id="lab-layer-status">건물 레이어 확인 중</span><span id="lab-camera-status">카메라 준비 중</span><span id="lab-render-status">지형 로딩 확인 중</span></div>
    <p class="lab-limit">높이는 선로가 아닌 지형 표고 기준입니다. 터널은 지상 조망으로 표시합니다. 정밀 모드는 없는 건물·나무를 생성하거나 원본 사진의 해상도를 높이지 않습니다. 레이어 전환 성공은 이 위치의 건물 제공을 보장하지 않습니다.</p>
    <div class="lab-bookmarks"><div class="lab-save-row"><input id="bookmark-name" maxlength="80" placeholder="비교 지점 이름 · 예: 강변 산 능선" aria-label="비교 지점 이름"><button id="save-comparison">비교 지점 저장</button><button id="export-comparisons" class="export-bookmarks">JSON 내보내기</button></div><textarea id="comparison-note" class="lab-evidence-note" rows="2" maxlength="1000" placeholder="대조 메모 · 같은 장소인지, 능선/집/숲이 어떻게 다른지" aria-label="실사 대조 메모"></textarea><div id="bookmark-list" class="lab-bookmark-list"></div></div>`;

  function syncSettings() {
    for (const key of ['height', 'heading', 'pitch', 'fov', 'buildings']) $(`lab-${key}`).value = settings[key];
    $('lab-height-value').textContent = `${Math.round(settings.height)} m`;
    $('lab-heading-value').textContent = `${settings.heading > 0 ? '오른쪽' : settings.heading < 0 ? '왼쪽' : '진행 방향'} ${Math.abs(settings.heading)}°`;
    $('lab-pitch-value').textContent = `${settings.pitch}°`;
    $('lab-fov-value').textContent = `${settings.fov}°`;
  }
  function applySettings(value = settings) {
    settings = normalizeVisual(value); syncSettings(); cameraSettingsApplied = false;
    api.applySettings(settings);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* Usable without storage. */ }
  }
  function seekMap() {
    const context = api.context();
    if (!context.route || !active) return;
    const position = positionAt(context.route, progress);
    api.seek(position);
    $('lab-progress').value = Math.round(progress * 1000);
    $('lab-position').textContent = `${Math.round(progress * 100)}% · ${(context.route.distance * progress / 1000).toFixed(2)} km · ${context.geometry === 'osm-rail' ? position.tunnel ? '터널 지상 조망' : 'OSM 지상 후보' : '보간 경로'}`;
  }
  function renderSurfaces() {
    const { route } = api.context();
    const container = $('surface-candidates'); container.replaceChildren();
    if (!route || route.geometry !== 'osm-rail') { container.textContent = '지상 후보는 OSM 선형이 확보된 백양리–강촌에서 확인할 수 있습니다.'; return; }
    const groups = []; let accumulated = 0, current = null;
    for (const segment of route.segments) {
      if (!segment.tunnel) {
        if (!current) { current = { start: accumulated, length: 0 }; groups.push(current); }
        current.length += segment.distance;
      } else current = null;
      accumulated += segment.distance;
    }
    const label = document.createElement('span'); label.textContent = '지상 후보로 이동'; container.append(label);
    groups.filter(g => g.length > 50).forEach((group, i) => {
      const button = document.createElement('button'); button.textContent = `${i + 1} · 약 ${Math.round(group.length)}m`;
      button.onclick = () => { progress = (group.start + group.length / 2) / route.distance; seekMap(); };
      container.append(button);
    });
  }
  function setActive(value) {
    if (value === active) return;
    if (value) {
      if (!api.context().route) { api.toast('먼저 유효한 여정을 선택해 주세요.'); return; }
      api.pause(); progress = api.context().sessionProgress; api.windowView();
      document.body.classList.remove('focus-mode');
      $('focus-button').setAttribute('aria-pressed', 'false'); $('focus-button').querySelector('span').textContent = '집중 화면';
    }
    active = value;
    api.lock(active);
    document.body.classList.toggle('comparison-active', active);
    $('reference-pane').hidden = !active; $('comparison-panel').hidden = !active;
    $('compare-toggle').setAttribute('aria-pressed', String(active));
    $('compare-toggle').textContent = active ? '◫ 비교 마치기' : '◫ 실사와 비교하기';
    $('pause').disabled = active;
    if (active) { renderSurfaces(); seekMap(); applySettings(); renderBookmarks(); }
    else { player?.pauseVideo?.(); api.restore(); }
  }
  function setReferenceMode(mode) {
    referenceMode = mode;
    $('video-container').hidden = mode !== 'video'; $('photo-container').hidden = mode !== 'photo';
    $('video-time').hidden = mode !== 'video'; $('photo-picker').hidden = mode !== 'photo';
    for (const kind of ['video', 'photo']) { $(`reference-${kind}-tab`).classList.toggle('active', mode === kind); $(`reference-${kind}-tab`).setAttribute('aria-pressed', String(mode === kind)); }
    if (mode === 'photo') { player?.pauseVideo?.(); $('reference-status').textContent = photoUrl ? '선택한 사진을 브라우저 안에서 표시합니다. 위치와 촬영 방향을 직접 맞춰 주세요.' : '사진을 선택한 뒤 같은 위치·방향으로 지도를 맞춰 주세요.'; }
    else $('reference-status').textContent = '영상 시각과 지도 위치는 수동 정렬입니다. 자동 동기화되지 않습니다.';
  }
  function updateVideoLink() { $('reference-link').href = `https://www.youtube.com/watch?v=${VIDEO_ID}&t=${seconds}s`; }
  function videoError(code) {
    playerReady = false; clearTimeout(videoTimer); loadingVideo = false;
    try { player?.destroy?.(); } catch { /* An already removed iframe is safe to replace. */ }
    player = null;
    if (!$('reference-player')) { const mount = document.createElement('div'); mount.id = 'reference-player'; $('video-container').append(mount); }
    $('video-placeholder').hidden = false;
    $('load-reference').disabled = false; $('read-reference-time').disabled = true;
    $('reference-status').textContent = `YouTube에서 재생을 허용하지 않거나 연결하지 못했습니다${code ? ` (${code})` : ''}. 아래 원본 링크에서 확인할 수 있습니다.`;
  }
  function loadVideo() {
    if (loadingVideo || player) return;
    loadingVideo = true; $('load-reference').disabled = true;
    $('reference-status').textContent = 'YouTube 공식 플레이어를 연결하고 있어요.';
    videoTimer = setTimeout(() => videoError(), 18000);
    const create = () => {
      if (player) return;
      $('video-placeholder').hidden = true;
      player = new YT.Player('reference-player', {
        videoId: VIDEO_ID, width: '100%', height: '100%',
        playerVars: { origin: location.origin, playsinline: 1, start: seconds, rel: 0 },
        events: {
          onReady: event => { if (event.target !== player) return; playerReady = true; loadingVideo = false; clearTimeout(videoTimer); $('read-reference-time').disabled = false; $('reference-status').textContent = '영상 시각과 지도 위치를 직접 맞춰 주세요. 두 화면은 자동 동기화되지 않습니다.'; },
          onError: event => { if (event.target === player) videoError(event.data); },
        },
      });
    };
    if (window.YT?.Player) create();
    else {
      window.onYouTubeIframeAPIReady = create;
      let script = document.getElementById('youtube-api');
      if (!script) { script = document.createElement('script'); script.id = 'youtube-api'; script.src = 'https://www.youtube.com/iframe_api'; script.onerror = () => { script.remove(); videoError(); }; document.head.append(script); }
    }
  }
  function persistBookmarks(next) {
    try { localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next)); bookmarks = next; renderBookmarks(); return true; }
    catch { api.toast('브라우저 저장이 제한되어 비교 지점을 저장하지 못했습니다.'); return false; }
  }
  function renderBookmarks() {
    const list = $('bookmark-list'); list.replaceChildren();
    if (!bookmarks.length) { const p = document.createElement('p'); p.className = 'reference-note'; p.textContent = '저장한 비교 지점이 없습니다. 사진 원본은 저장되지 않습니다.'; list.append(p); return; }
    for (const bookmark of bookmarks) {
      const row = document.createElement('div'); row.className = 'lab-bookmark';
      const desc = document.createElement('div');
      desc.innerHTML = `<strong>${escape(bookmark.name)}</strong><small>${escape(bookmark.from)} → ${escape(bookmark.to)} · ${Math.round(bookmark.progress * 100)}% · 영상 ${timestamp(bookmark.seconds)} · 수동 대조</small>`;
      const restore = document.createElement('button'); restore.textContent = '불러오기';
      restore.onclick = () => {
        if (routeKey(api.context()) !== routeKey(bookmark)) { api.toast(`먼저 ${bookmark.from} → ${bookmark.to} 여정을 선택해 주세요. 다른 경로에 좌표를 적용하지 않았습니다.`); return; }
        progress = bookmark.progress; seconds = bookmark.seconds;
        $('reference-time').value = timestamp(seconds); $('bookmark-name').value = bookmark.name; $('comparison-note').value = bookmark.note;
        applySettings(bookmark.settings); seekMap(); updateVideoLink();
        if (playerReady) { player.seekTo(seconds, true); player.pauseVideo(); }
        api.toast('비교 설정을 불러왔습니다. 사진은 필요하면 다시 선택해 주세요.');
      };
      const remove = document.createElement('button'); remove.textContent = '삭제'; remove.setAttribute('aria-label', `${bookmark.name} 비교 지점 삭제`);
      remove.onclick = () => persistBookmarks(bookmarks.filter(b => b.id !== bookmark.id));
      row.append(desc, restore, remove); list.append(row);
    }
  }
  $('compare-toggle').onclick = () => setActive(!active);
  $('lab-progress').oninput = () => { progress = Number($('lab-progress').value) / 1000; seekMap(); };
  for (const key of ['height', 'heading', 'pitch', 'fov']) $(`lab-${key}`).oninput = () => applySettings({ ...settings, [key]: Number($(`lab-${key}`).value) });
  for (const key of ['buildings']) $(`lab-${key}`).onchange = () => applySettings({ ...settings, [key]: $(`lab-${key}`).value });
  $('lab-baseline').onclick = () => applySettings(BASELINE_VISUAL);
  $('lab-default').onclick = () => applySettings(DEFAULT_VISUAL);
  $('lab-near').onclick = () => applySettings({ ...DEFAULT_VISUAL, height: 8, pitch: 0 });
  $('reference-video-tab').onclick = () => setReferenceMode('video'); $('reference-photo-tab').onclick = () => setReferenceMode('photo');
  $('load-reference').onclick = loadVideo;
  $('seek-reference').onclick = () => {
    try { seconds = parseTimestamp($('reference-time').value); $('reference-time').value = timestamp(seconds); updateVideoLink(); if (playerReady) { player.seekTo(seconds, true); player.pauseVideo(); } else api.toast('원본 링크에 입력한 시각을 반영했습니다.'); }
    catch (error) { api.toast(error.message); }
  };
  $('read-reference-time').onclick = () => { if (playerReady) { seconds = Math.floor(player.getCurrentTime()); $('reference-time').value = timestamp(seconds); updateVideoLink(); } };
  $('reference-file').onchange = () => {
    const file = $('reference-file').files[0]; if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024) { api.toast('20MB 이하의 JPG, PNG, WebP 사진을 선택해 주세요.'); return; }
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = URL.createObjectURL(file); $('reference-photo').src = photoUrl; $('reference-photo').hidden = false; $('photo-placeholder').hidden = true;
    setReferenceMode('photo');
  };
  $('reference-photo').onerror = () => { if (photoUrl) URL.revokeObjectURL(photoUrl); photoUrl = null; $('reference-photo').hidden = true; $('photo-placeholder').hidden = false; api.toast('사진을 읽지 못했습니다. 다른 사진을 선택해 주세요.'); };
  $('save-comparison').onclick = () => {
    const context = api.context(); if (!context.route) return;
    try {
      seconds = parseTimestamp($('reference-time').value);
      const bookmark = normalizeBookmark({ id: crypto.randomUUID(), name: $('bookmark-name').value.trim() || `${context.from}–${context.to} ${Math.round(progress * 100)}%`, from: context.from, to: context.to, geometry: context.geometry, progress, seconds, settings, note: $('comparison-note').value, createdAt: new Date().toISOString() });
      if (persistBookmarks([bookmark, ...bookmarks].slice(0, 30))) api.toast('비교 지점을 저장했습니다. 사진 원본은 저장하지 않았습니다.');
    } catch (error) { api.toast(error.message); }
  };
  $('export-comparisons').onclick = () => {
    const blob = new Blob([JSON.stringify({ version: 1, video: `https://www.youtube.com/watch?v=${VIDEO_ID}`, alignment: 'manual-unverified', bookmarks }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'JourneyFocus-comparisons.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  syncSettings(); renderBookmarks();
  return {
    get active() { return active; }, get settings() { return settings; }, close: () => setActive(false),
    routeChanged: () => { if (active) { progress = 0; renderSurfaces(); seekMap(); } },
    ready: () => { api.lock(active); applySettings(); if (active) seekMap(); },
    diagnostics: data => {
      if (data.type === 'jf:visual-result') {
        cameraSettingsApplied = Boolean(data.result?.ok);
        $('lab-layer-status').dataset.error = String(!cameraSettingsApplied);
        $('lab-layer-status').textContent = cameraSettingsApplied ? `건물 ${data.result.mode} 적용 · 지역 제공 여부는 화면으로 대조` : '건물 레이어 적용 실패 · 이전 화면을 확인해 주세요';
      }
      if (data.type === 'jf:map-stats') {
        if (data.camera && Number.isFinite(data.camera.lon)) $('lab-camera-status').textContent = `${data.camera.lat.toFixed(5)}, ${data.camera.lon.toFixed(5)} · 해발 ${Math.round(data.camera.altitude)}m${Number.isFinite(data.camera.ground) ? ` / 지형 위 약 ${Math.round(data.camera.altitude - data.camera.ground)}m` : ' / 지형 표고 미수신'}`;
        $('lab-render-status').textContent = `${data.fps} FPS · ${data.tilesLoaded ? '지형 로딩 완료' : '지형 로딩 중'} · ${document.querySelector('#render-quality-status')?.textContent||''}`;
      }
    },
  };
}
