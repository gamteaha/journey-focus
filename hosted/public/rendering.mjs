import { createRenderingPolicy } from '../src/rendering.mjs';

function read(object, key) { try { return object?.[key]; } catch { return undefined; } }
function writableNumber(object, key) {
  if (!object || !Number.isFinite(read(object, key))) return false;
  try {
    let owner = object;
    while (owner) {
      const descriptor = Object.getOwnPropertyDescriptor(owner, key);
      if (descriptor) return 'value' in descriptor ? descriptor.writable === true : typeof descriptor.set === 'function';
      owner = Object.getPrototypeOf(owner);
    }
  } catch { /* Proxy/unsupported SDK wrapper. */ }
  return false;
}

// C is accepted for consistency with other map controllers; no version-specific
// Cesium constructors or private members are needed for these public settings.
export function createRenderingController(viewer, C, notify = () => {}) {
  const policy = createRenderingPolicy({
    devicePixelRatio: read(globalThis, 'devicePixelRatio'),
    hardwareConcurrency: read(read(globalThis, 'navigator'), 'hardwareConcurrency'),
  });
  const globe = read(read(viewer, 'scene'), 'globe');
  const targets = { resolutionScale: viewer, maximumScreenSpaceError: globe, tileCacheSize: globe };
  const capabilities = {}, originals = {}, applied = {};
  let disposed = false;
  for (const [key, target] of Object.entries(targets)) {
    capabilities[key] = writableNumber(target, key);
    if (capabilities[key]) originals[key] = read(target, key);
  }
  const snapshot = () => ({
    ...policy.snapshot(), capabilities: { ...capabilities }, applied: { ...applied },
    fallback: Object.values(capabilities).some(value => !value), disposed,
  });
  function publish() { try { notify('rendering-state', snapshot()); } catch { /* Parent may have closed. */ } }
  function apply(force = false) {
    if (disposed) return snapshot();
    let changed = false;
    for (const [key, value] of Object.entries(policy.snapshot().budget)) {
      if (!capabilities[key] || (!force && applied[key] === value)) continue;
      try {
        targets[key][key] = value;
        const actual = read(targets[key], key);
        if (!Number.isFinite(actual) || Math.abs(actual - value) > .001) throw new Error('Setting rejected');
        applied[key] = actual; changed = true;
      } catch { capabilities[key] = false; delete applied[key]; changed = true; }
    }
    if (changed) {
      try { read(viewer, 'scene')?.requestRender?.(); } catch { /* Rendering remains provider-owned. */ }
    }
    return snapshot();
  }
  apply(); publish();
  return {
    snapshot,
    setMode(mode) {
      if (disposed) return snapshot();
      policy.setMode(mode); apply(true); publish(); return snapshot();
    },
    sample(value) {
      if (disposed) return snapshot();
      const previous = policy.snapshot().effectiveMode;
      policy.sample(value);
      if (policy.snapshot().effectiveMode !== previous) { apply(); publish(); }
      return snapshot();
    },
    dispose() {
      if (disposed) return;
      for (const [key, value] of Object.entries(applied)) {
        try { if (read(targets[key], key) === value) targets[key][key] = originals[key]; } catch { /* SDK already destroyed. */ }
      }
      disposed = true;
    },
  };
}
