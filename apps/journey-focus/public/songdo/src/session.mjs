export function speedFor(mode, minutes, factor = 1) {
  return 5 * factor * (mode === 'legacy' ? 25 / minutes : 1);
}
export class Session {
  constructor(minutes = 25) { this.reset(minutes); }
  reset(minutes = this.minutes) {
    this.minutes = minutes; this.elapsed = 0; this.status = 'idle'; this.anchor = null;
  }
  start(now) { if (this.status === 'completed') this.reset(); this.anchor = now; this.status = 'running'; }
  tick(now) {
    if (this.status === 'running') {
      this.elapsed = Math.min(this.minutes * 60, this.elapsed + Math.max(0, now - this.anchor) / 1000);
      this.anchor = now;
      if (this.elapsed >= this.minutes * 60) this.status = 'completed';
    }
    return this.elapsed;
  }
  pause(now) { this.tick(now); if (this.status === 'running') this.status = 'paused'; }
}

// Scenery is an imagined above-ground journey, independent of real tunnel locations.
export function sceneryPhase(session) {
  if (session.status === 'idle' || session.status === 'completed') return 'outdoors';
  if (session.elapsed < 3) return 'boarding';
  if (session.minutes * 60 - session.elapsed <= 3) return 'arrival';
  return 'outdoors';
}
