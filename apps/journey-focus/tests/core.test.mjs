import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SessionClock, formatTime } from '../src/session.mjs';
import { buildRoute, positionAt, normalizeStations } from '../src/route.mjs';

test('pause and resume exclude paused time and completion clamps elapsed time', () => {
  let now = 1000;
  const clock = new SessionClock(() => now);
  clock.start(60);
  now += 15000;
  assert.equal(clock.snapshot().elapsed, 15);
  clock.pause();
  now += 30000;
  assert.equal(clock.snapshot().elapsed, 15);
  clock.resume();
  now += 50000;
  assert.deepEqual(clock.snapshot(), { state: 'completed', elapsed: 60, duration: 60, progress: 1, unlimited:false });
});
test('stop retains partial time and restart starts from zero', () => {
  let now = 0;
  const clock = new SessionClock(() => now);
  assert.throws(() => clock.start(0));
  clock.start(120); now = 4250;
  clock.stop(); now = 10000;
  assert.equal(clock.snapshot().elapsed, 4.25);
  assert.equal(clock.snapshot().state, 'stopped');
  clock.start(60);
  assert.equal(clock.snapshot().elapsed, 0);
  assert.equal(formatTime(60.1), '01:01');
});
test('a late pause cannot turn an already complete session into a paused one', () => {
  let now = 0; const clock = new SessionClock(() => now);
  clock.start(1); now = 3000; clock.pause();
  assert.equal(clock.snapshot().state, 'completed');
});
test('reset clears a previous session when choosing a new route or duration', () => {
  let now = 0; const clock = new SessionClock(() => now);
  clock.start(60); now = 20000; clock.stop(); clock.reset();
  assert.deepEqual(clock.snapshot(), { state: 'idle', elapsed: 0, duration: 0, progress: 0, unlimited:false });
});
const stations = [
  { name: '가평', lon: 127.510739, lat: 37.814536 },
  { name: '굴봉산', lon: 127.557695, lat: 37.832067 },
  { name: '백양리', lon: 127.58933, lat: 37.830779 },
  { name: '강촌', lon: 127.634146, lat: 37.805723 },
];
test('route endpoints and reverse direction stay correct', () => {
  const route = buildRoute(stations, '가평', '강촌');
  assert.equal(route.stations.length, 4);
  assert.ok(route.distance > 10000);
  assert.equal(positionAt(route, -1).lon, stations[0].lon);
  assert.equal(positionAt(route, 2).lon, stations[3].lon);
  const reverse = buildRoute(stations, '강촌', '가평');
  assert.equal(positionAt(reverse, 0).name, '강촌');
  assert.equal(positionAt(reverse, 1).name, '가평');
  assert.throws(() => buildRoute(stations, '가평', '가평'));
  assert.throws(() => buildRoute(stations, '없는역', '강촌'));
});
test('view direction blends across a rail bend without moving the route coordinates',()=>{
 const points=[{name:'가평',lon:127,lat:37},{name:'굴봉산',lon:127.001,lat:37},{name:'백양리',lon:127.001,lat:37.001}];
 const route=buildRoute(points,'가평','백양리'),p=route.segments[0].distance/route.distance;
 const corner=positionAt(route,p),before=positionAt(route,p-.0001),after=positionAt(route,p+.0001);
 assert.ok(corner.heading>40&&corner.heading<50,'camera looks along the local bend rather than snapping by 90 degrees');
 assert.ok(Math.abs(before.heading-after.heading)<1);
 assert.ok(Math.abs(corner.lon-127.001)<1e-10&&Math.abs(corner.lat-37)<1e-10,'source geometry stays intact');
});
test('coincident source points never produce non-finite camera positions',()=>{
 const points=[{name:'가평',lon:127,lat:37},{name:'굴봉산',lon:127,lat:37},{name:'백양리',lon:127.001,lat:37}];
 const route=buildRoute(points,'가평','백양리');
 for(const progress of [0,.5,1]){const p=positionAt(route,progress);assert.ok([p.lon,p.lat,p.heading].every(Number.isFinite));}
 assert.equal(positionAt(route,0).name,'가평');assert.equal(positionAt(route,1).name,'백양리');
});
test('normalization keeps valid Gyeongchun records and orders them along the line', () => {
  const result = normalizeStations([
    { lineNm: '경춘선', stnKrNm: '강촌', convX: '127.634146', convY: '37.805723' },
    { lineNm: '2호선', stnKrNm: '성수', convX: '127.1', convY: '37.5' },
    { lineNm: '경춘선', stnKrNm: '가평', convX: '127.510739', convY: '37.814536' },
    { lineNm: '경춘선', stnKrNm: '청평', convX: 'bad', convY: '37.7' },
  ]);
  assert.deepEqual(result.map(s => s.name), ['가평', '강촌']);
});
test('the sourced rail path replaces interpolation only for its supported station pair', () => {
  const shape = JSON.parse(readFileSync(new URL('../public/data/baegyangri-gangchon.json', import.meta.url)));
  const forward = buildRoute(stations, '백양리', '강촌', shape);
  const reverse = buildRoute(stations, '강촌', '백양리', shape);
  assert.equal(forward.geometry, 'osm-rail');
  assert.equal(forward.segments.length, shape.points.length - 1);
  assert.ok(forward.distance > distanceBetweenStations());
  assert.equal(positionAt(forward, 0).lon, positionAt(reverse, 1).lon);
  assert.equal(positionAt(forward, 1).lat, positionAt(reverse, 0).lat);
  assert.equal(forward.segments.filter(s => s.tunnel).length, reverse.segments.filter(s => s.tunnel).length);
  assert.equal(buildRoute(stations, '가평', '강촌', shape).geometry, 'station-interpolation');
  assert.equal(shape.license, 'ODbL-1.0');
  function distanceBetweenStations() { return buildRoute(stations, '백양리', '강촌').distance; }
});
