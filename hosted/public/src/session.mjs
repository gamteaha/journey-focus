export class SessionClock {
  constructor(now = () => performance.now()) {
    this.now = now;
    this.state = 'idle';
    this.duration = 0;
    this.accumulated = 0;
    this.startedAt = 0;
  }
  start(duration) {
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('Invalid duration');
    this.duration = duration;
    this.accumulated = 0;
    this.startedAt = this.now();
    this.state = 'running';
    return this.snapshot();
  }
  snapshot() {
    let elapsed = this.accumulated;
    if (this.state === 'running') elapsed += Math.max(0, this.now() - this.startedAt) / 1000;
    if (this.duration > 0 && elapsed >= this.duration) {
      elapsed = this.duration;
      this.accumulated = elapsed;
      this.state = 'completed';
    }
    return { state: this.state, elapsed, duration: this.duration, progress: this.duration ? elapsed / this.duration : 0 };
  }
  pause() {
    const snapshot = this.snapshot();
    if (this.state === 'running') { this.accumulated = snapshot.elapsed; this.state = 'paused'; }
    return this.snapshot();
  }
  resume() {
    if (this.state === 'paused') { this.startedAt = this.now(); this.state = 'running'; }
    return this.snapshot();
  }
  stop() {
    const snapshot = this.snapshot();
    if (this.state === 'running' || this.state === 'paused') {
      this.accumulated = snapshot.elapsed; this.state = 'stopped';
    }
    return this.snapshot();
  }
  reset() {
    this.state = 'idle'; this.duration = 0; this.accumulated = 0; this.startedAt = 0;
    return this.snapshot();
  }
}
export function formatTime(seconds) {
  const value = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}
