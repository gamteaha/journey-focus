import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildRoute,positionAt,normalizeStations} from '../src/route.mjs';
test('city default uses the sourced rail bends and reverses the same track',()=>{
 const shape=JSON.parse(readFileSync(new URL('../public/data/seongsu-konkuk.json',import.meta.url)));
 const stations=normalizeStations([
  {lineNm:'2호선',stnKrNm:'성수',convX:'127.055961',convY:'37.544581'},
  {lineNm:'7호선',stnKrNm:'건대입구',convX:'127.1',convY:'37.5'},
  {lineNm:'2호선',stnKrNm:'건대입구',convX:'127.069191',convY:'37.540373'},
 ],'2호선');
 assert.deepEqual(stations.map(s=>s.name),['성수','건대입구']);
 const route=buildRoute(stations,'성수','건대입구',shape),reverse=buildRoute(stations,'건대입구','성수',shape);
 assert.equal(route.geometry,'osm-rail');assert.equal(route.segments.length,12);
 assert.ok(route.distance>1100&&route.distance<1300);
 assert.equal(positionAt(route,0).lon,shape.points[0].lon);
 assert.equal(positionAt(reverse,0).lon,shape.points.at(-1).lon);
 assert.equal(reverse.distance.toFixed(3),route.distance.toFixed(3));
});
