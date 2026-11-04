import { STATION_ORDER } from './route.mjs';
export const DEFAULT_VISUAL = Object.freeze({ height: 30, pitch: -4, heading: -90, fov: 65, buildings: 'all', quality: 'detailed' });
export const BASELINE_VISUAL = Object.freeze({ height: 110, pitch: -12, heading: 70, fov: 60, buildings: 'lod4', quality: 'standard' });
export const BUILDING_IDS = Object.freeze({ all: 'facility_build_all', lod1: 'facility_build_lod1', lod2: 'facility_build_lod2', lod3: 'facility_build_lod3', lod4: 'facility_build' });
const bounded = (value, fallback, min, max) => Number.isFinite(Number(value)) && value !== '' && value !== null ? Math.max(min, Math.min(max, Number(value))) : fallback;
export function normalizeVisual(input = {}) {
  input = input && typeof input === 'object' ? input : {};
  return {
    height: bounded(input.height, DEFAULT_VISUAL.height, 3, 300),
    pitch: bounded(input.pitch, DEFAULT_VISUAL.pitch, -60, 10),
    heading: bounded(input.heading, DEFAULT_VISUAL.heading, -180, 180),
    fov: bounded(input.fov, DEFAULT_VISUAL.fov, 30, 100),
    buildings: Object.hasOwn(BUILDING_IDS, input.buildings) || input.buildings === 'off' ? input.buildings : DEFAULT_VISUAL.buildings,
    quality: input.quality === 'standard' ? 'standard' : 'detailed',
  };
}
export function parseTimestamp(input) {
  const text = String(input).trim();
  if (!/^\d+(?::\d{1,2}){0,2}$/.test(text)) throw new Error('영상 시각은 12:30 또는 1:02:30 형식으로 입력해 주세요.');
  const parts = text.split(':').map(Number);
  if (parts.slice(1).some(v => v >= 60)) throw new Error('분과 초는 0~59 범위여야 합니다.');
  const seconds = parts.reduce((total, part) => total * 60 + part, 0);
  if (!Number.isSafeInteger(seconds) || seconds > 86400) throw new Error('영상 시각 범위를 확인해 주세요.');
  return seconds;
}
export function timestamp(seconds) {
  const value = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = Math.floor(value / 60), secs = String(value % 60).padStart(2, '0');
  return mins >= 60 ? `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}:${secs}` : `${mins}:${secs}`;
}
export function routeKey(route) { return `${route.from}|${route.to}|${route.geometry}`; }
export function normalizeBookmark(input) {
  if (!input || !STATION_ORDER.includes(input.from) || !STATION_ORDER.includes(input.to) || input.from === input.to || !['osm-rail', 'station-interpolation'].includes(input.geometry)) return null;
  if (!Number.isFinite(input.progress) || input.progress < 0 || input.progress > 1 || !Number.isFinite(input.seconds) || input.seconds < 0 || input.seconds > 86400) return null;
  return {
    id: String(input.id || Date.now()).slice(0, 80), name: String(input.name || '비교 지점').slice(0, 80),
    from: input.from, to: input.to, geometry: input.geometry, progress: input.progress,
    seconds: Math.floor(input.seconds), settings: normalizeVisual(input.settings),
    note: String(input.note || '').slice(0, 1000), alignment: 'manual-unverified',
    createdAt: Number.isFinite(Date.parse(input.createdAt)) ? new Date(input.createdAt).toISOString() : new Date().toISOString(),
  };
}
