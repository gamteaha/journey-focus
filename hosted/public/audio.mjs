export class TrainAudio {
  constructor(remaining = () => Infinity) { this.context = null; this.enabled = false; this.active = false; this.remaining = remaining; }
  async toggle() {
    if (!this.context) {
      this.context = new AudioContext();
      const buffer = this.context.createBuffer(1, this.context.sampleRate * 4, this.context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const source = this.context.createBufferSource(); source.buffer = buffer; source.loop = true;
      const filter = this.context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 260;
      this.gain = this.context.createGain(); this.gain.gain.value = 0;
      source.connect(filter).connect(this.gain).connect(this.context.destination); source.start();
    }
    await this.context.resume();
    this.enabled = !this.enabled; this.update(); return this.enabled;
  }
  setActive(value) { this.active = value; this.update(); }
  update() {
    if (!this.context) return;
    const now = this.context.currentTime;
    const seconds = this.remaining();
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setTargetAtTime(this.enabled && this.active ? 0.24 : 0, now, 0.2);
    if (this.active && Number.isFinite(seconds)) this.gain.gain.setValueAtTime(0, now + Math.max(0, seconds));
  }
}
