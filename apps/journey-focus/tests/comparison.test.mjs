import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeVisual, parseTimestamp, timestamp, normalizeBookmark, routeKey } from '../src/comparison.mjs';

test('camera controls are bounded and reject unknown layer and quality modes', () => {
  const settings = normalizeVisual({ height: -500, pitch: 90, heading: 999, fov: 180, buildings: 'unknown', quality: 'unknown' });
  assert.equal(settings.height, 3);
  assert.equal(settings.pitch, 10);
  assert.equal(settings.heading, 180);
  assert.equal(settings.fov, 100);
  assert.equal(settings.buildings, 'textured');
  assert.equal(settings.quality, 'detailed');
  assert.equal(normalizeVisual({ height: NaN }).height, 30);
});
test('video timestamp accepts seconds and h:mm:ss but rejects invalid minutes', () => {
  assert.equal(parseTimestamp('1:23:45'), 5025);
  assert.equal(parseTimestamp('12:30'), 750);
  assert.equal(parseTimestamp('90'), 90);
  assert.equal(timestamp(5025), '1:23:45');
  assert.throws(() => parseTimestamp('1:90'));
  assert.throws(() => parseTimestamp('-5'));
  assert.throws(() => parseTimestamp('javascript:alert(1)'));
});
test('bookmark preserves route identity and settings without persisting a photo URL', () => {
  const bookmark = normalizeBookmark({ name: '산 능선 비교', from: '백양리', to: '강촌', geometry: 'osm-rail', progress: 0.25, seconds: 123, photoUrl: 'blob:local-secret', settings: { height: 8 }, createdAt: '2026-11-03T00:00:00Z' });
  assert.equal(bookmark.progress, 0.25);
  assert.equal(bookmark.settings.height, 8);
  assert.ok(!JSON.stringify(bookmark).includes('blob:'));
  assert.equal(routeKey(bookmark), '백양리|강촌|osm-rail');
  assert.equal(normalizeBookmark({ from: 'bad' }), null);
  assert.equal(normalizeBookmark({ ...bookmark, progress: Infinity }), null);
});
