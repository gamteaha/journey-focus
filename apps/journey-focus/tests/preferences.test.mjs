import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePreferences, readPreferences, savePreferences } from '../src/preferences.mjs';

const defaults = { from: '백양리', to: '강촌', duration: 1500, view: 'window' };

test('defaults malformed input without coercion or inherited properties', () => {
  for (const value of [undefined, null, [], 'route', 42, true, Object.create({ from: '춘천', duration: 60 })]) {
    assert.deepEqual(normalizePreferences(value), defaults);
  }
  const hazardous = { from: { toString() { throw new Error('coerced'); } }, duration: '60', view: ['overview'] };
  assert.deepEqual(normalizePreferences(hazardous), defaults);
});

test('preserves reversed valid routes and all allowed durations and views', () => {
  for (const duration of [60, 300, 1500, 3000]) {
    const value = { from: '춘천', to: '신내', duration, view: 'overview' };
    assert.deepEqual(normalizePreferences(value), value);
  }
});

test('rejects unknown stations, identical endpoints, and invalid duration types', () => {
  assert.deepEqual(normalizePreferences({ from: 'unknown', to: null }), defaults);
  assert.deepEqual(normalizePreferences({ from: '춘천', to: '춘천' }), defaults);
  for (const duration of [0, -60, 120, NaN, Infinity, '300', new Number(300), null]) {
    assert.equal(normalizePreferences({ duration }).duration, 1500);
  }
  assert.deepEqual(normalizePreferences({ from: '강촌' }), defaults);
});

test('does not read getters or persist unrelated session fields', () => {
  const value = { ...defaults, date: '2026-11-03', sound: true, elapsed: 900, state: 'running' };
  Object.defineProperty(value, 'duration', { get() { throw new Error('getter'); } });
  assert.deepEqual(normalizePreferences(value), defaults);
});

test('read handles absent storage, corrupt JSON, malformed JSON values and blocked storage', () => {
  assert.deepEqual(readPreferences(), defaults);
  for (const raw of [null, '{broken', 'null', '[]', '"300"', '{"duration":"300"}']) {
    assert.deepEqual(readPreferences({ getItem() { return raw; } }), defaults);
  }
  assert.deepEqual(readPreferences({ getItem() { throw new Error('blocked'); } }), defaults);
  assert.deepEqual(readPreferences(Object.defineProperty({}, 'getItem', { get() { throw new Error('blocked'); } })), defaults);
});

test('saves only normalized preferences under a fixed key and round-trips them', () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const expected = { from: '강촌', to: '백양리', duration: 300, view: 'overview' };
  assert.equal(savePreferences(storage, { ...expected, sound: true, elapsed: 200, date: 'today' }), true);
  assert.deepEqual([...data.keys()], ['journey-focus-preferences']);
  assert.deepEqual(JSON.parse(data.get('journey-focus-preferences')), expected);
  assert.deepEqual(readPreferences(storage), expected);
});

test('save returns false when storage is unavailable or throws', () => {
  assert.equal(savePreferences(undefined, defaults), false);
  assert.equal(savePreferences({}, defaults), false);
  assert.equal(savePreferences({ setItem() { throw new Error('quota'); } }, defaults), false);
  assert.equal(savePreferences(Object.defineProperty({}, 'setItem', { get() { throw new Error('blocked'); } }), defaults), false);
});
