// Original mechanism implementation. No P.T. source or data is embedded.
// Concepts studied: staged state, gaze memory, and events after looking away.
export class ObservationCycle {
  constructor() { this.reset(); }
  reset() {
    this.phase = 0; this.stage = 'unseen'; this.gazeSeconds = 0;
    this.awaySeconds = 0; this.elapsed = 0; this.events = [];
  }
  update(dt, seen, active = true) {
    if (!active || this.stage === 'complete') return null;
    dt = Math.max(0, Math.min(dt, 0.1));
    this.elapsed += dt;
    if (this.stage === 'unseen') {
      this.gazeSeconds = seen ? this.gazeSeconds + dt : Math.max(0, this.gazeSeconds - dt * 1.5);
      if (this.gazeSeconds >= 0.85 - 1e-9) {
        this.stage = 'observed'; this.awaySeconds = 0;
        this.events.push({type:'observed', phase:this.phase, time:this.elapsed});
        return 'observed';
      }
    } else if (this.stage === 'observed') {
      this.awaySeconds = seen ? 0 : this.awaySeconds + dt;
      if (this.awaySeconds >= 0.3 - 1e-9) {
        this.phase += 1; this.gazeSeconds = 0; this.awaySeconds = 0;
        if (this.phase >= 3) { this.phase = 2; this.stage = 'complete'; }
        else this.stage = 'unseen';
        const kind = this.stage === 'complete' ? 'complete' : 'change';
        this.events.push({type:kind, phase:this.phase, time:this.elapsed});
        return kind;
      }
    }
    return null;
  }
  snapshot() {
    return {phase:this.phase, stage:this.stage, gazeSeconds:this.gazeSeconds,
      awaySeconds:this.awaySeconds, elapsed:this.elapsed, events:this.events.map(x=>({...x}))};
  }
}

// Frame-rate independent smoothing used for input and focal length only.
export function approach(value, target, rate, dt) {
  return target + (value - target) * Math.exp(-Math.max(0, rate) * Math.max(0, dt));
}

export function rotateToTarget(position, target) {
  const dx=target.x-position.x, dy=target.y-position.y, dz=target.z-position.z;
  return {yaw:Math.atan2(-dx,-dz), pitch:Math.atan2(dy,Math.hypot(dx,dz))};
}
