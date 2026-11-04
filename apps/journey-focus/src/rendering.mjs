const MODES = ['auto', 'balanced', 'cinematic', 'light'];
const PRESETS = Object.freeze({
  light: Object.freeze({ resolutionScale: .75, maximumScreenSpaceError: 3, tileCacheSize: 128 }),
  balanced: Object.freeze({ resolutionScale: 1, maximumScreenSpaceError: 1.7, tileCacheSize: 256 }),
  cinematic: Object.freeze({ resolutionScale: 1.25, maximumScreenSpaceError: 1, tileCacheSize: 384 }),
});
export const normalizeRenderingMode = mode => MODES.includes(mode) ? mode : 'auto';
const validNumber = value => typeof value === 'number' && Number.isFinite(value);
function initialMode(device = {}) {
  device = device && typeof device === 'object' ? device : {};
  const cores = validNumber(device.hardwareConcurrency) ? Math.max(1, Math.min(32, device.hardwareConcurrency)) : 4;
  const pixels = validNumber(device.devicePixelRatio) ? Math.max(1, Math.min(3, device.devicePixelRatio)) : 1;
  return cores <= 2 || (cores <= 4 && pixels >= 2) ? 'light' : 'balanced';
}
export function renderingBudget(mode, device) {
  mode = normalizeRenderingMode(mode);
  return { ...PRESETS[mode === 'auto' ? initialMode(device) : mode] };
}

// Samples represent the map's existing two-second diagnostics window. Auto is
// deliberately limited to light/balanced; supersampling is an explicit choice.
export function createRenderingPolicy(device = {}) {
  let mode = 'auto', effectiveMode = initialMode(device), low = 0, high = 0, cooldown = 0;
  const snapshot = () => ({ mode, effectiveMode, budget: { ...PRESETS[effectiveMode] } });
  return {
    snapshot,
    setMode(value) {
      mode = normalizeRenderingMode(value);
      effectiveMode = mode === 'auto' ? initialMode(device) : mode;
      low = high = cooldown = 0;
      return snapshot();
    },
    sample(value) {
      if (mode !== 'auto') return snapshot();
      if (!value || !validNumber(value.fps) || value.fps <= 0 || value.fps > 240) {
        low = high = 0;
        return snapshot();
      }
      if (cooldown > 0) { cooldown--; low = high = 0; return snapshot(); }
      low = value.fps < 24 ? low + 1 : 0;
      high = value.fps >= 45 && value.tilesLoaded === true ? high + 1 : 0;
      if (effectiveMode === 'balanced' && low >= 4) {
        effectiveMode = 'light'; cooldown = 10; low = high = 0;
      } else if (effectiveMode === 'light' && high >= 15) {
        effectiveMode = 'balanced'; cooldown = 10; low = high = 0;
      }
      return snapshot();
    },
  };
}
