// Demonstration dwell times, not measured species behaviour. Only supplies mode;
// the existing locomotion solver owns all smoothing, clocks and actor state.
export const VERSION = 'R05_MOTION_CYCLE_1';
export const MODES = Object.freeze(['cruise', 'hover', 'burst', 'turn', 'rest']);
export const DEFAULT_DURATIONS = Object.freeze({cruise:12, hover:8, burst:5, turn:9, rest:3});

function validMode(mode) {
  if (!MODES.includes(mode)) throw new RangeError('Unknown fish movement mode: '+mode);
  return mode;
}
function duration(c) { return c.durations[c.mode]; }
function result(c, changed=false) {
  return {mode:c.mode, changed, automatic:c.automatic, elapsed:c.elapsed,
    remaining:Math.max(0,duration(c)-c.elapsed), transitionCount:c.transitionCount};
}

export function create(options={}) {
  const durations={...DEFAULT_DURATIONS,...options.durations};
  for (const mode of MODES) {
    if (!Number.isFinite(durations[mode]) || durations[mode]<=0)
      throw new RangeError('Movement dwell must be a positive finite simulation duration: '+mode);
  }
  const order=Object.freeze(options.includeRest ? [...MODES] : MODES.slice(0,4));
  const mode=validMode(options.initialMode ?? 'cruise');
  return {version:VERSION, order, durations:Object.freeze(durations), mode,
    index:order.indexOf(mode), elapsed:0, activeTime:0, transitionCount:0,
    automatic:options.automatic!==false,
    initialMode:mode, initialAutomatic:options.automatic!==false,
    cycleDuration:order.reduce((sum,key)=>sum+durations[key],0)};
}

// dt is accepted simulation time. A gated frame never accumulates hidden debt.
// Full cycles are skipped arithmetically, not by dropping simulation delta.
export function update(c,dt,input={}) {
  if (!c.automatic || input.playing===false || input.visible===false || input.loaded===false ||
      !Number.isFinite(dt) || dt<=0) return result(c);
  const before=c.transitionCount;
  c.activeTime+=dt;
  let remaining=c.elapsed+dt;
  // Manual REST remains available even when omitted from the automatic cycle.
  if (c.index<0) {
    if (remaining<duration(c)) { c.elapsed=remaining; return result(c); }
    remaining-=duration(c);
    c.index=0; c.mode=c.order[0]; c.transitionCount++;
  }
  const fullCycles=Math.floor(remaining/c.cycleDuration);
  if (fullCycles>0) {
    remaining-=fullCycles*c.cycleDuration;
    c.transitionCount+=fullCycles*c.order.length;
  }
  // At most one cycle remains, irrespective of how large dt was.
  for (let count=0;count<c.order.length;count++) {
    const dwell=duration(c), tolerance=1e-12*Math.max(1,dwell);
    if (remaining<dwell-tolerance) break;
    remaining=Math.max(0,remaining-dwell);
    c.index=(c.index+1)%c.order.length; c.mode=c.order[c.index];
    c.transitionCount++;
  }
  c.elapsed=remaining;
  return result(c,c.transitionCount!==before);
}

// User selection starts a fresh dwell and suspends the automatic scheduler.
// Enabling auto keeps that selected mode until its dwell naturally finishes.
export function setManual(c,mode) {
  validMode(mode);
  const changed=c.mode!==mode;
  c.mode=mode; c.index=c.order.indexOf(mode); c.elapsed=0; c.automatic=false;
  return result(c,changed);
}
export function setAutomatic(c,enabled=true) {
  c.automatic=Boolean(enabled);
  return result(c);
}
export function reset(c) {
  c.mode=c.initialMode; c.index=c.order.indexOf(c.mode); c.elapsed=0;
  c.activeTime=0; c.transitionCount=0; c.automatic=c.initialAutomatic;
  return result(c);
}
export function snapshot(c) {
  return {...result(c), activeTime:c.activeTime, order:[...c.order],
    durations:{...c.durations}, cycleDuration:c.cycleDuration, version:VERSION};
}
