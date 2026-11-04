import { STATION_ORDER,CITY_ORDER } from './route.mjs';

const STORAGE_KEY = 'journey-focus-preferences';
const DEFAULTS = Object.freeze({ from: '성수', to: '건대입구', duration: 1500, view: 'window' });
const DURATIONS = new Set([60, 300, 1500, 3000]);

// Read data properties only: unexpected objects cannot execute getters or coerce values.
function ownValue(input, key) {
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined;
    return Object.getOwnPropertyDescriptor(input, key)?.value;
  } catch {
    return undefined;
  }
}

export function normalizePreferences(input) {
  const fromValue = ownValue(input, 'from');
  const toValue = ownValue(input, 'to');
  const durationValue = ownValue(input, 'duration');
  const viewValue = ownValue(input, 'view');
  let from = typeof fromValue === 'string' && STATION_ORDER.includes(fromValue) ? fromValue : DEFAULTS.from;
  let to = typeof toValue === 'string' && STATION_ORDER.includes(toValue) ? toValue : DEFAULTS.to;
  if (from === to||CITY_ORDER.includes(from)!==CITY_ORDER.includes(to)) ({ from, to } = DEFAULTS);
  return {
    from,
    to,
    duration: DURATIONS.has(durationValue) ? durationValue : DEFAULTS.duration,
    view: viewValue === 'window' || viewValue === 'overview' ? viewValue : DEFAULTS.view,
  };
}

export function readPreferences(storage) {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    return normalizePreferences(typeof raw === 'string' ? JSON.parse(raw) : null);
  } catch {
    return normalizePreferences(null);
  }
}

export function savePreferences(storage, value) {
  try {
    if (typeof storage?.setItem !== 'function') return false;
    storage.setItem(STORAGE_KEY, JSON.stringify(normalizePreferences(value)));
    return true;
  } catch {
    return false;
  }
}
