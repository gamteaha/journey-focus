import {before,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createWorker} from './worker.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const base='https://journey-focus.example.workers.dev';
const rows=[
 {lineNm:'2호선',stnKrNm:'성수',convX:127.055,convY:37.544},
 {lineNm:'2호선',stnKrNm:'건대입구',convX:127.070,convY:37.540},
 {lineNm:'경춘선',stnKrNm:'신내',convX:127.104,convY:37.613},
];
const env={VWORLD_API_KEY:'test-vworld-value',TDATA_API_KEY:'test-tdata-value',ASSETS:{async fetch(request){
 const pathname=new URL(request.url).pathname;
 try{return new Response(await readFile(path.join(root,'dist/cloudflare',pathname)));}
 catch{return new Response('Not found',{status:404});}
}}};
const call=(worker,route,options,bindings=env)=>worker.fetch(new Request(base+route,options),bindings);
before(async()=>{await import('./build.mjs');});

test('serves the real boarding and cabin HTML from the asset binding',async()=>{
 const worker=createWorker();
 const home=await call(worker,'/');
 assert.equal(home.status,200);
 assert.match(await home.text(),/id="boarding-screen"/);
 for(const route of ['/cabin-frame','/cabin-frame.html']){
  const cabin=await call(worker,route);
  assert.match(await cabin.text(),/src="\/cabin-frame.mjs"/);
  assert.equal(cabin.headers.get('Content-Security-Policy'),"frame-ancestors 'self'");
  assert.equal(await (await call(worker,route,{method:'HEAD'})).text(),'');
 }
});
test('injects the runtime VWorld SDK URL for both map paths',async()=>{
 const worker=createWorker();
 for(const route of ['/map','/map.html']){
  const map=await call(worker,route);
  const html=await map.text();
  assert.equal(map.status,200);
  assert.ok(html.includes('apiKey=test-vworld-value'));
  assert.ok(!html.includes('{{VWORLD_SDK_URL}}'));
  assert.equal(map.headers.get('Cache-Control'),'no-store');
 }
});
test('Swiss boarding URLs resolve the nested HTML and preserve ticket query on slash redirect',async()=>{
 const worker=createWorker();
 const query='?boarding=swiss&ticket=JF-TEST';
 for(const route of ['/alpine-pilot/','/alpine-pilot/index.html']){
  const response=await call(worker,route+query);
  assert.equal(response.status,200);
  assert.match(response.headers.get('Content-Type'),/text\/html/);
  const html=await response.text();assert.match(html,/id="swiss-journey"/);assert.match(html,/src="\.\/pilot.mjs"/);
  assert.equal(await (await call(worker,route+query,{method:'HEAD'})).text(),'');
 }
 const redirect=await call(worker,'/alpine-pilot'+query);
 assert.equal(redirect.status,308);assert.equal(redirect.headers.get('Location'),base+'/alpine-pilot/'+query);
 const config=JSON.parse(await readFile(path.join(root,'wrangler.jsonc'),'utf8'));
 assert.equal(config.assets.html_handling,'none');
 for(const route of ['/alpine-pilot','/alpine-pilot/','/alpine-pilot/index.html'])assert.ok(config.assets.run_worker_first.includes(route));
 for(const asset of ['/alpine-pilot/pilot.mjs','/alpine-pilot/route.json','/models/swiss/monorail-cabin.glb'])assert.equal((await call(worker,asset)).status,200);
 assert.equal((await call(worker,'/alpine-pilot/missing')).status,404);
});
test('Songdo links serve their own illustrated experience and bundled assets',async()=>{
 const worker=createWorker(),query='?ticket=JF-SONGDO';
 for(const route of ['/songdo/','/songdo/index.html']){
  const response=await call(worker,route+query);assert.equal(response.status,200);assert.match(await response.text(),/인천 정원 여행/);
 }
 const redirect=await call(worker,'/songdo'+query);assert.equal(redirect.status,308);assert.equal(redirect.headers.get('Location'),base+'/songdo/'+query);
 for(const file of ['/songdo/src/app.mjs','/songdo/input/window-panorama-v2.png','/songdo/input/inu-character-front.png','/songdo-ticket.mjs','/src/songdo-journey.mjs'])assert.equal((await call(worker,file)).status,200,file);
 const config=JSON.parse(await readFile(path.join(root,'wrangler.jsonc'),'utf8'));
 for(const route of ['/songdo','/songdo/','/songdo/index.html'])assert.ok(config.assets.run_worker_first.includes(route));
});

test('desert links preserve tickets and serve the procedural pixel renderer',async()=>{
 const worker=createWorker(),query='?ticket=JF-DESERT';
 for(const route of ['/desert/','/desert/index.html']){
  const response=await call(worker,route+query);assert.equal(response.status,200);
  assert.match(await response.text(),/src="\.\/src\/app.mjs"/);
 }
 const redirect=await call(worker,'/desert'+query);
 assert.equal(redirect.status,308);assert.equal(redirect.headers.get('Location'),base+'/desert/'+query);
 for(const file of ['/desert/src/app.mjs','/desert/src/pixel-scene.mjs','/desert/src/soundscape.mjs','/desert/src/sound-controls.mjs','/desert/postcard.svg','/desert-ticket.mjs','/src/desert-journey.mjs'])assert.equal((await call(worker,file)).status,200,file);
 const config=JSON.parse(await readFile(path.join(root,'wrangler.jsonc'),'utf8'));
 for(const route of ['/desert','/desert/','/desert/index.html'])assert.ok(config.assets.run_worker_first.includes(route));
});

test('shared travel controls, passport and bonus map survive deployment',async()=>{
 const worker=createWorker();
 for(const file of ['/travel-shell.mjs','/travel-sound.mjs','/travel-ui.css','/passport.mjs','/src/passport.mjs','/world-tour.mjs','/desert/oasis-postcard.svg','/keepsakes.mjs','/arrival-audio.mjs','/mascot.mjs','/visual-quality.mjs','/models/blue-flame-hq.glb'])assert.equal((await call(worker,file)).status,200,file);
 const response=await call(worker,'/desert/?world=oasis&ticket=JF-OASIS&tour=test');
 assert.equal(response.status,200);assert.match(await response.text(),/src="\.\/src\/app.mjs"/);
});

test('reports configuration without exposing secret values',async()=>{
 const worker=createWorker();
 const status=await (await call(worker,'/api/status')).json();
 assert.deepEqual(status,{vworldConfigured:true,tdataConfigured:true,serviceUrl:base,sdkVersion:'3.0'});
 assert.ok(!JSON.stringify(status).includes('test-'));
 assert.equal(await (await call(worker,'/api/status',{method:'HEAD'})).text(),'');
});
test('requests the city stations once and shares concurrent requests and cached results',async()=>{
 let count=0;
 const worker=createWorker(async url=>{
  count++;
  assert.equal(url.hostname,'t-data.seoul.go.kr');
  assert.equal(url.searchParams.get('apikey'),env.TDATA_API_KEY);
  assert.equal(url.searchParams.get('rowCnt'),'1000');
  return Response.json(rows);
 });
 const responses=await Promise.all([call(worker,'/api/stations'),call(worker,'/api/stations')]);
 for(const response of responses)assert.deepEqual((await response.json()).stations.map(s=>s.name),['성수','건대입구']);
 await call(worker,'/api/stations');
 assert.equal(count,1);
});
test('rejects a foreign Origin and unsupported methods without fetching upstream',async()=>{
 const worker=createWorker(()=>{throw new Error('Unexpected upstream call');});
 assert.equal((await call(worker,'/api/stations',{headers:{Origin:'https://other.invalid'}})).status,403);
 assert.equal((await call(worker,'/api/stations',{method:'POST'})).status,405);
 assert.equal((await call(worker,'/api/unknown')).status,404);
});

test('accepts all 43 main-loop stations and excludes the branch lines',async()=>{
 const shape=JSON.parse(await readFile(path.join(root,'apps/journey-focus/public/data/line2-loop.json'),'utf8'));
 const names=[...shape.stationAnchors.map(a=>a.name==='강변'?'강변(동서울터미널)':a.name),'신설동','용답','도림천'];
 const worker=createWorker(async()=>Response.json(names.map(stnKrNm=>({lineNm:'2호선',stnKrNm,convX:127.05,convY:37.54}))));
 const response=await call(worker,'/api/stations');assert.equal(response.status,200);
 const stations=(await response.json()).stations.map(s=>s.name);assert.equal(stations.length,43);
 assert.ok(stations.includes('시청')&&stations.includes('강남')&&stations.includes('강변'));assert.ok(!stations.includes('신설동')&&!stations.includes('용답'));
});
test('handles missing keys and upstream errors without leaking their details, then allows retry',async()=>{
 let count=0;
 const worker=createWorker(async()=>{
  if(++count===1)throw new Error('secret upstream URL');
  return Response.json(rows);
 });
 const noKey=await call(worker,'/api/stations',undefined,{...env,TDATA_API_KEY:''});
 assert.equal(noKey.status,502);
 assert.equal((await noKey.json()).error,'TDATA_MISSING');
 const failure=await call(worker,'/api/stations');
 assert.equal(failure.status,502);
 assert.ok(!(await failure.text()).includes('secret upstream URL'));
 assert.equal((await call(worker,'/api/stations')).status,200);
});
test('serves the bundled train model, rail shape and browser modules',async()=>{
 const worker=createWorker();
 const model=await call(worker,'/models/subway-car.fbx');
 assert.equal(model.status,200);
 assert.ok((await model.arrayBuffer()).byteLength>4_000_000);
 const avatar=await call(worker,'/models/blue-flame.glb');
 assert.equal(avatar.status,200);
 const avatarBytes=new Uint8Array(await avatar.arrayBuffer());
 assert.deepEqual([...avatarBytes.slice(0,4)],[0x67,0x6c,0x54,0x46]);
 assert.ok(avatarBytes.length<2_000_000);
 const route=await (await call(worker,'/data/seongsu-konkuk.json')).json();
 assert.equal(route.from,'성수');
 assert.equal(route.to,'건대입구');
 const loop=await(await call(worker,'/data/line2-loop.json')).json();assert.equal(loop.stationAnchors.length,43);assert.equal(loop.points[0].id,loop.points.at(-1).id);
 for(const file of ['/app.mjs','/src/boarding.mjs','/src/cabin.mjs','/vendor/three/examples/jsm/loaders/FBXLoader.js'])assert.equal((await call(worker,file)).status,200,file);
 assert.equal((await call(worker,'/.env.local')).status,404);
});
