import http from 'node:http';
import * as tls from 'node:tls';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { normalizeStations } from './src/route.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
// Trust OS-installed corporate/local roots as well as Node's bundled roots.
// Certificate verification remains enabled.
if(tls.setDefaultCACertificates&&tls.getCACertificates){
  tls.setDefaultCACertificates([...new Set([...tls.getCACertificates('default'),...tls.getCACertificates('system')])]);
}
const ASSETS = new Map();
try {
  const catalog=JSON.parse(await readFile(path.join(ROOT,'public/assets/catalog.json'),'utf8'));
  const types={'.gltf':'model/gltf+json','.bin':'application/octet-stream','.jpg':'image/jpeg','.png':'image/png'};
  for(const {path:relative} of catalog.files){
    if(typeof relative==='string'&&/^[a-zA-Z0-9_./-]+$/.test(relative)&&!relative.startsWith('/')&&!relative.split('/').includes('..')&&types[path.extname(relative)])ASSETS.set('/assets/'+relative,[relative,types[path.extname(relative)]]);
  }
} catch { /* The app still works without the optional scenery assets. */ }
const PUBLIC = new Map([
  ['/destinations.mjs', ['public/destinations.mjs', 'text/javascript']],
  ['/destination-globe.mjs', ['public/destination-globe.mjs', 'text/javascript']],
  ['/destinations.css', ['public/destinations.css', 'text/css']],
  ['/world-land.json', ['public/world-land.json', 'application/json']],
  ['/alpine-pilot/', ['public/alpine-pilot/index.html', 'text/html']],
  ['/alpine-pilot/index.html', ['public/alpine-pilot/index.html', 'text/html']],
  ['/alpine-pilot/pilot.css', ['public/alpine-pilot/pilot.css', 'text/css']],
  ['/alpine-pilot/pilot.mjs', ['public/alpine-pilot/pilot.mjs', 'text/javascript']],
  ['/alpine-pilot/route.json', ['public/alpine-pilot/route.json', 'application/json']],
  ['/fonts/gowun/fonts.css', ['public/fonts/gowun/fonts.css', 'text/css']],
  ['/fonts/gowun/OFL-Batang.txt', ['public/fonts/gowun/OFL-Batang.txt', 'text/plain']],
  ['/fonts/gowun/OFL-Dodum.txt', ['public/fonts/gowun/OFL-Dodum.txt', 'text/plain']],
  ['/images/seoul-stickers/index.html', ['public/images/seoul-stickers/index.html', 'text/html']],
  ['/images/seoul-stickers/green-metro.png', ['public/images/seoul-stickers/green-metro.png', 'image/png']],
  ['/images/seoul-stickers/blue-bus.png', ['public/images/seoul-stickers/blue-bus.png', 'image/png']],
  ['/images/seoul-stickers/namsan-tower.png', ['public/images/seoul-stickers/namsan-tower.png', 'image/png']],
  ['/images/seoul-stickers/palace-gate.png', ['public/images/seoul-stickers/palace-gate.png', 'image/png']],
  ['/images/seoul-stickers/hangang-bridge.png', ['public/images/seoul-stickers/hangang-bridge.png', 'image/png']],
  ['/images/seoul-stickers/travel-bag.png', ['public/images/seoul-stickers/travel-bag.png', 'image/png']],
  ['/images/seoul-stickers/pocket-watch.png', ['public/images/seoul-stickers/pocket-watch.png', 'image/png']],
  ['/images/seoul-stickers/hearts-sparkles.png', ['public/images/seoul-stickers/hearts-sparkles.png', 'image/png']],
  ['/seoul-ticket.css', ['public/seoul-ticket.css', 'text/css']],
  ['/images/seoul-ticket-watercolor.png', ['public/images/seoul-ticket-watercolor.png', 'image/png']],
  ['/images/seoul-route-paper.svg', ['public/images/seoul-route-paper.svg', 'image/svg+xml']],
  ['/images/seoul-map-background.png', ['public/images/seoul-map-background.png', 'image/png']],
  ['/window-weather.mjs', ['public/window-weather.mjs', 'text/javascript']],
  ['/window-weather.css', ['public/window-weather.css', 'text/css']],
  ['/boarding.mjs', ['public/boarding.mjs', 'text/javascript']],
  ['/journey-picker.mjs', ['public/journey-picker.mjs', 'text/javascript']],
  ['/journey-picker.css', ['public/journey-picker.css', 'text/css']],
  ['/src/journey.mjs', ['src/journey.mjs', 'text/javascript']],
  ['/boarding.css', ['public/boarding.css', 'text/css']],
  ['/images/inu-transit-card.jpg', ['public/images/inu-transit-card.jpg', 'image/jpeg']],
  ['/src/boarding.mjs', ['src/boarding.mjs', 'text/javascript']],
  ['/cabin.mjs', ['public/cabin.mjs', 'text/javascript']],
  ['/cabin-frame.mjs', ['public/cabin-frame.mjs', 'text/javascript']],
  ['/avatar.mjs', ['public/avatar.mjs', 'text/javascript']],
  ['/cabin.css', ['public/cabin.css', 'text/css']],
  ['/src/cabin.mjs', ['src/cabin.mjs', 'text/javascript']],
  ['/models/subway-car.fbx', ['../../assets-source/subway-car/SubwayCar_Compiled.fbx', 'application/octet-stream']],
  ['/models/blue-flame.glb', ['public/models/blue-flame.glb', 'model/gltf-binary']],
  ['/render-study', ['public/review/realism-comparison/index.html', 'text/html']],
  ['/render-study/', ['public/review/realism-comparison/index.html', 'text/html']],
  ['/render-study/front-light.html', ['public/review/realism-comparison/front-light.html', 'text/html']],
  ['/render-study-front/', ['public/review/realism-comparison-front/index.html', 'text/html']],
  ['/video-pilot/', ['public/video-pilot.html', 'text/html']],
  ['/video-pilot/route-original-10s.webm', ['public/review/route-video-pilot/route-original-10s.webm', 'video/webm']],
  ['/video-pilot/route-style6-10s.webm', ['public/review/route-video-pilot/route-style6-10s.webm', 'video/webm']],
  ['/forest.mjs', ['public/forest.mjs', 'text/javascript']],
  ['/style-filter.mjs', ['public/style-filter.mjs', 'text/javascript']],
  ['/', ['public/index.html', 'text/html']],
  ['/styles.css', ['public/styles.css', 'text/css']],
  ['/finish.css', ['public/finish.css', 'text/css']],
  ['/rendering.mjs', ['public/rendering.mjs', 'text/javascript']],
  ['/src/rendering.mjs', ['src/rendering.mjs', 'text/javascript']],
  ['/src/loading.mjs', ['src/loading.mjs', 'text/javascript']],
  ['/src/preferences.mjs', ['src/preferences.mjs', 'text/javascript']],
  ['/src/startup.mjs', ['src/startup.mjs', 'text/javascript']],
  ['/src/frame-work.mjs', ['src/frame-work.mjs', 'text/javascript']],
  ['/app.mjs', ['public/app.mjs', 'text/javascript']],
  ['/map.mjs', ['public/map.mjs', 'text/javascript']],
  ['/audio.mjs', ['public/audio.mjs', 'text/javascript']],
  ['/comparison.mjs', ['public/comparison.mjs', 'text/javascript']],
  ['/comparison.css', ['public/comparison.css', 'text/css']],
  ['/scenery.mjs', ['public/scenery.mjs', 'text/javascript']],
  ['/scenery-layer.mjs', ['public/scenery-layer.mjs', 'text/javascript']],
  ['/src/session.mjs', ['src/session.mjs', 'text/javascript']],
  ['/src/route.mjs', ['src/route.mjs', 'text/javascript']],
  ['/src/comparison.mjs', ['src/comparison.mjs', 'text/javascript']],
  ['/src/scenery.mjs', ['src/scenery.mjs', 'text/javascript']],
  ['/src/motion.mjs', ['src/motion.mjs', 'text/javascript']],
  ['/favicon.svg', ['public/favicon.svg', 'image/svg+xml']],
  ['/data/baegyangri-gangchon.json', ['public/data/baegyangri-gangchon.json', 'application/json']],
  ['/data/seongsu-konkuk.json', ['public/data/seongsu-konkuk.json', 'application/json']],
  ['/data/line2-surface.json', ['public/data/line2-surface.json', 'application/json']],
  ['/data/line2-loop.json', ['public/data/line2-loop.json', 'application/json']],
]);
// Only bundled font chunks from the checked-in manifest can be served.
const fontManifest=JSON.parse(await readFile(path.join(ROOT,'public/fonts/gowun/manifest.json'),'utf8'));
for(const {file} of fontManifest.files){
 if(!/^font-\d{3}\.woff2$/.test(file))throw new Error('Invalid bundled font path');
 PUBLIC.set(`/fonts/gowun/${file}`,[`public/fonts/gowun/${file}`,'font/woff2']);
}
for(const file of ['build/three.module.js','examples/jsm/loaders/FBXLoader.js','examples/jsm/loaders/GLTFLoader.js','examples/jsm/utils/BufferGeometryUtils.js','examples/jsm/libs/fflate.module.js','examples/jsm/curves/NURBSCurve.js','examples/jsm/curves/NURBSUtils.js'])PUBLIC.set('/vendor/three/'+file,['public/vendor/three/'+file,'text/javascript']);
// Local comparison gallery: explicit captures only, never arbitrary tmp files.
for(const name of ['01-original','02-grade','03-ao','04-light','05-ao-light','06-combined','07-ai-concept','08-pbr','09-ibl','10-material-combined','11-front-soft','12-front-medium','13-front-shadow','14-front-high']){
 PUBLIC.set(`/render-study/${name}.png`,[`public/review/realism-comparison/${name}.png`,'image/png']);
}
for(const name of ['01-original','02-grade','03-ao','04-light','05-ao-light','06-combined','07-ai-concept','08-pbr','09-ibl','10-material-combined']){
 PUBLIC.set(`/render-study-front/${name}.png`,[`public/review/realism-comparison-front/${name}.png`,'image/png']);
}
export async function loadConfig() {
  const env = {};
  try {
    const text = await readFile(path.resolve(ROOT, '../../.env.local'), 'utf8');
    for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z_][A-Z_0-9]*)\s*=\s*(.*?)\s*$/);
      if (match) env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2');
    }
  } catch (error) { if (error.code !== 'ENOENT') throw new Error('설정 파일을 읽지 못했습니다.'); }
  return {
    VWORLD_API_KEY: process.env.VWORLD_API_KEY || env.VWORLD_API_KEY || '',
    TDATA_API_KEY: process.env.TDATA_API_KEY || env.TDATA_API_KEY || '',
    VWORLD_SERVICE_URL: process.env.VWORLD_SERVICE_URL || env.VWORLD_SERVICE_URL || 'http://localhost:5173',
  };
}
function send(res, status, body, type = 'application/json') {
  res.writeHead(status, {
    'Content-Type': Buffer.isBuffer(body) ? type : `${type}; charset=utf-8`, 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'SAMEORIGIN',
  });
  res.end(Buffer.isBuffer(body)?body:typeof body === 'object' ? JSON.stringify(body) : body);
}
export function createApp(config, fetcher = fetch) {
  let cached = null, pending = null;
  async function stations() {
    if (cached && Date.now() - cached.fetchedAt < 3600000) return cached;
    if (pending) return pending;
    pending = (async () => {
      if (!config.TDATA_API_KEY) throw new Error('TDATA_MISSING');
      const url = new URL('https://t-data.seoul.go.kr/apig/apiman-gateway/tapi/TaimsKsccDvSubwayStationGeom/1.0');
      url.search = new URLSearchParams({ apikey: config.TDATA_API_KEY, startRow: '1', rowCnt: '1000' });
      const response = await fetcher(url, { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error('TDATA_UNAVAILABLE');
      const raw = await response.json();
      const rows = normalizeStations(raw,'2호선');
      if (rows.length < 2) throw new Error('TDATA_NO_STATIONS');
      cached = { stations: rows, fetchedAt: Date.now(), source: '서울특별시 T Data · 교통정책지원시스템(TAIMS)', geometry: '역 좌표만 제공 · 선로 선형 미검증' };
      return cached;
    })();
    try { return await pending; } finally { pending = null; }
  }
  return http.createServer(async (req, res) => {
    try {
      const host = req.headers.host || '';
      if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return send(res, 403, { error: 'LOCAL_ONLY' });
      const url = new URL(req.url, `http://${host}`),port=url.port||'80';
      let referrerOrigin='';try{referrerOrigin=new URL(req.headers.referer).origin;}catch{}
      const localOrigins=[`http://localhost:${port}`,`http://127.0.0.1:${port}`];
      const cabinNavigation=url.pathname==='/cabin-frame'&&localOrigins.includes(req.headers.origin||referrerOrigin);
      const origin = req.headers.origin;
      if (origin && origin !== `http://${host}`&&!cabinNavigation) return send(res, 403, { error: 'ORIGIN_DENIED' });
      if (req.headers['sec-fetch-site'] === 'cross-site'&&!cabinNavigation) return send(res, 403, { error: 'ORIGIN_DENIED' });
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
      if(url.pathname==='/cabin-frame'){
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':`frame-ancestors http://localhost:${port} http://127.0.0.1:${port}`});
        return res.end(await readFile(path.join(ROOT,'public/cabin-frame.html'),'utf8'));
      }
      if(ASSETS.has(url.pathname)){
        const [relative,type]=ASSETS.get(url.pathname);
        return send(res,200,await readFile(path.join(ROOT,'public/assets',relative)),type);
      }
      if (url.pathname === '/api/status') return send(res, 200, {
        vworldConfigured: Boolean(config.VWORLD_API_KEY), tdataConfigured: Boolean(config.TDATA_API_KEY),
        serviceUrl: config.VWORLD_SERVICE_URL, sdkVersion: '3.0',
      });
      if (url.pathname === '/api/stations') {
        try { return send(res, 200, await stations()); }
        catch { return send(res, 502, { error: config.TDATA_API_KEY ? 'TDATA_UNAVAILABLE' : 'TDATA_MISSING', message: '역 정보를 가져오지 못했습니다. 키와 네트워크를 확인한 뒤 다시 시도해 주세요.' }); }
      }
      if (url.pathname === '/map') {
        let html = await readFile(path.join(ROOT, 'public/map.html'), 'utf8');
        const sdk = new URL('https://map.vworld.kr/js/webglMapInit.js.do');
        sdk.search = new URLSearchParams({ version: '3.0', apiKey: config.VWORLD_API_KEY });
        html = html.replace('{{VWORLD_SDK_URL}}', sdk.href.replaceAll('&', '&amp;').replaceAll('"', '&quot;'));
        return send(res, 200, html, 'text/html');
      }
      const entry = PUBLIC.get(url.pathname);
      if (!entry) return send(res, 404, { error: 'NOT_FOUND' });
      return send(res, 200, await readFile(path.join(ROOT, entry[0]), /^(image|video|font)\//.test(entry[1])||entry[1]==='application/octet-stream'||entry[1]==='model/gltf-binary'?undefined:'utf8'), entry[1]);
    } catch { return send(res, 500, { error: 'SERVER_ERROR' }); }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const config = await loadConfig();
  const app = createApp(config);
  app.on('error', error => {
    console.error(error.code === 'EADDRINUSE' ? '5173 포트가 사용 중입니다. 기존 서버를 종료하고 다시 실행해 주세요.' : '로컬 서버를 시작하지 못했습니다.');
    process.exitCode = 1;
  });
  app.listen(5173, '127.0.0.1', () => {
    console.log('Journey Focus: http://localhost:5173');
    console.log(`VWorld key: ${config.VWORLD_API_KEY ? 'configured' : 'missing'} | T Data key: ${config.TDATA_API_KEY ? 'configured' : 'missing'}`);
  });
}
