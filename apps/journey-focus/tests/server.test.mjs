import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createApp } from '../server.mjs';

test('server protects secrets, handles API failure safely, and serves the map with only the browser SDK key', async t => {
  const app = createApp({
    VWORLD_API_KEY: 'test-browser-key', TDATA_API_KEY: 'test-secret-key',
    VWORLD_SERVICE_URL: 'http://localhost:5173',
  }, async () => { throw new Error('contains test-secret-key'); });
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => app.close(resolve)));
  const base = `http://127.0.0.1:${app.address().port}`;
  for (const path of ['/.env.local', '/.git/config', '/server.mjs', '/%2e%2e/.env.local']) {
    const response = await fetch(base + path);
    assert.equal(response.status, 404);
    assert.ok(!(await response.text()).includes('test-secret-key'));
  }
  const status = await (await fetch(base + '/api/status')).text();
  assert.ok(!status.includes('test-browser-key'));
  assert.ok(!status.includes('test-secret-key'));
  const map = await (await fetch(base + '/map')).text();
  assert.ok(map.includes('test-browser-key'));
  assert.ok(!map.includes('test-secret-key'));
  const modelBytes=Buffer.from(await(await fetch(base+'/assets/house/house.bin')).arrayBuffer());
  assert.deepEqual(modelBytes,await readFile(new URL('../public/assets/house/house.bin',import.meta.url)));
  assert.equal((await fetch(base+'/assets/../server.mjs')).status,404);
  assert.equal((await fetch(base+'/assets/unknown.bin')).status,404);
  const failure = await fetch(base + '/api/stations');
  assert.equal(failure.status, 502);
  assert.ok(!(await failure.text()).includes('test-secret-key'));
  assert.equal((await fetch(base + '/api/status', { headers: { Origin: 'https://unrelated.example' } })).status, 403);
});

test('successful station requests filter other lines and share one in-memory fetch', async t => {
  let requests = 0;
  const app = createApp({ TDATA_API_KEY: 'test-only', VWORLD_API_KEY: '', VWORLD_SERVICE_URL: 'http://localhost:5173' }, async url => {
    requests++;
    assert.equal(url.hostname, 't-data.seoul.go.kr');
    return new Response(JSON.stringify([
      { lineNm: '경춘선', stnKrNm: '백양리', convX: '127.58933', convY: '37.830779' },
      { lineNm: '경춘선', stnKrNm: '강촌', convX: '127.634146', convY: '37.805723' },
      { lineNm: '2호선', stnKrNm: '성수', convX: '127.055961', convY: '37.544581' },
      { lineNm: '2호선', stnKrNm: '건대입구', convX: '127.069191', convY: '37.540373' },
    ]));
  });
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => app.close(resolve)));
  const url = `http://127.0.0.1:${app.address().port}/api/stations`;
  const results = await Promise.all([fetch(url), fetch(url)]);
  for (const r of results) assert.equal((await r.json()).stations.length, 2);
  assert.equal(requests, 1);
});
