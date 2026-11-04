import test from 'node:test';
import assert from 'node:assert/strict';
import { createRenderingPolicy, renderingBudget, normalizeRenderingMode } from '../src/rendering.mjs';
import { createRenderingController } from '../public/rendering.mjs';

test('untrusted mode and device data produce finite bounded budgets', () => {
  assert.equal(normalizeRenderingMode('__proto__'), 'auto');
  for (const mode of ['auto', 'light', 'balanced', 'cinematic', null]) {
    const budget = renderingBudget(mode, { devicePixelRatio: Infinity, hardwareConcurrency: NaN });
    assert.ok(budget.resolutionScale >= .65 && budget.resolutionScale <= 1.25);
    assert.ok(budget.maximumScreenSpaceError >= 1 && budget.maximumScreenSpaceError <= 4);
    assert.ok(budget.tileCacheSize >= 100 && budget.tileCacheSize <= 384);
  }
  assert.equal(createRenderingPolicy({ hardwareConcurrency: 2 }).snapshot().effectiveMode, 'light');
});

test('auto waits for sustained poor frames and recovers only after cooldown and loaded tiles', () => {
  const policy = createRenderingPolicy({ hardwareConcurrency: 8, devicePixelRatio: 1 });
  for (let i = 0; i < 3; i++) policy.sample({ fps: 10, tilesLoaded: false });
  assert.equal(policy.snapshot().effectiveMode, 'balanced');
  policy.sample({ fps: 10, tilesLoaded: false });
  assert.equal(policy.snapshot().effectiveMode, 'light');
  for (let i = 0; i < 50; i++) policy.sample({ fps: 60, tilesLoaded: false });
  assert.equal(policy.snapshot().effectiveMode, 'light');
  for (let i = 0; i < 15; i++) policy.sample({ fps: 60, tilesLoaded: true });
  assert.equal(policy.snapshot().effectiveMode, 'balanced');
  for (let i = 0; i < 100; i++) policy.sample({ fps: 60, tilesLoaded: true });
  assert.equal(policy.snapshot().effectiveMode, 'balanced');
});

test('manual cinematic cannot be overridden by samples and invalid samples reset streaks', () => {
  const policy = createRenderingPolicy({ hardwareConcurrency: 8 });
  policy.setMode('cinematic');
  for (let i = 0; i < 100; i++) policy.sample({ fps: 1, tilesLoaded: false });
  assert.equal(policy.snapshot().effectiveMode, 'cinematic');
  policy.setMode('auto');
  for (let i = 0; i < 20; i++) { policy.sample({ fps: 10 }); policy.sample({ fps: NaN }); }
  assert.equal(policy.snapshot().effectiveMode, 'balanced');
});

test('controller updates supported numeric properties without creating SDK fields or touching camera', () => {
  const globe = { maximumScreenSpaceError: 2 };
  Object.defineProperty(globe, 'tileCacheSize', { value: 100, writable: false });
  const viewer = { resolutionScale: 1, scene: { globe }, camera: Object.freeze({}) };
  const notices = [];
  const controller = createRenderingController(viewer, {}, (type, data) => notices.push({ type, data }));
  controller.setMode('cinematic');
  assert.equal(viewer.resolutionScale, 1.25);
  assert.equal(globe.maximumScreenSpaceError, 1);
  assert.equal(globe.tileCacheSize, 100);
  assert.equal(controller.snapshot().capabilities.tileCacheSize, false);
  assert.ok(notices.some(n => n.type === 'rendering-state'));
  controller.dispose();
  assert.equal(viewer.resolutionScale, 1);
  assert.equal(globe.maximumScreenSpaceError, 2);
});

test('missing or throwing SDK capabilities and notification callbacks do not break rendering', () => {
  const viewer = { scene: { globe: {} } };
  Object.defineProperty(viewer, 'resolutionScale', { get() { throw new Error('unsupported'); } });
  const controller = createRenderingController(viewer, null, () => { throw new Error('closed parent'); });
  assert.doesNotThrow(() => controller.setMode('cinematic'));
  assert.deepEqual(Object.keys(viewer.scene.globe), []);
  assert.equal(controller.snapshot().fallback, true);
  controller.dispose();
  assert.doesNotThrow(() => controller.sample(null));
});
