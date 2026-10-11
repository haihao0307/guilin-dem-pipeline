// An original first-leg score; provenance and reproducible source: music/manifest.json.
// Integration: call unlock() in a user gesture, update(session.view()) each frame,
// and setPaused(value) in the pause/resume handlers. setEnabled and setVolume are
// independent of the locomotive audio. update never resumes an AudioContext.
export const JOURNEY_TRACK = Object.freeze({
  id: 'kowloon-morning-original-r10', title: '九龍晨光 · 首程',
  file: 'kowloon-morning-original-r10.mp3', duration: 93.302326,
  attribution: '原創作曲與合成演奏 · 尼龍弦吉他、低音、柔刷鼓',
  historicalRecording: false, humanVoice: false,
});
const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));
const isHidden = () => !!globalThis.document?.hidden;

export function createJourneyMusic({volume = .32, enabled = true} = {}) {
  let context, master, source, buffer, loading;
  let userVolume = clamp(volume), userEnabled = !!enabled, paused = false, disposed = false;
  let latestView, lastTick = null, lastElapsed = null, lastEvent = 0;
  let lastBrake = false, lastThrottle = 0, lastPhase = null;
  let stage = 'waiting-departure', completedReason = null, sourceStartedAt = null, endedPosition = 0;
  let settlingAt = null, leavingAt = null, sourceStarts = 0, sourceStops = 0;
  let gainTarget = 0, gainTimeConstant = .1, lastDuck = 1;
  let operationGeneration = 0, pendingSuspend = null;
  const ducks = new Map(), errors = {};

  function silent() { return disposed || !userEnabled || paused || isHidden(); }
  function stopSource() {
    if (!source) return;
    const old = source;
    source = null;
    old.onended = null;
    try { old.stop(); } catch { /* A naturally ended node is already stopped. */ }
    old.disconnect();
    sourceStops++;
  }
  function gain(value, seconds = .1, immediate = false) {
    if (!master || !context) return;
    if (!immediate && Math.abs(value - gainTarget) < .00005 && seconds === gainTimeConstant) return;
    gainTarget = value; gainTimeConstant = seconds;
    const parameter = master.gain, now = context.currentTime;
    if (immediate) {
      parameter.cancelScheduledValues(now);
      parameter.setValueAtTime(value, now);
    } else parameter.setTargetAtTime(value, now, seconds);
  }
  function finish(reason) {
    endedPosition = sourceStartedAt === null ? 0 : Math.min(buffer?.duration || JOURNEY_TRACK.duration, (context?.currentTime ?? sourceStartedAt) - sourceStartedAt);
    completedReason = reason; stage = 'completed';
    gain(0, .02, true); stopSource();
  }
  function restart() {
    stopSource(); gain(0, .02, true);
    stage = 'waiting-departure'; completedReason = null;
    sourceStartedAt = null; endedPosition = 0; settlingAt = null; leavingAt = null;
    lastEvent = 0; lastBrake = false; lastThrottle = 0; lastPhase = null;
    ducks.clear(); lastDuck = 1;
  }
  function duck(name, level, seconds) {
    if (!context || silent()) return;
    const until = context.currentTime + seconds, previous = ducks.get(name);
    ducks.set(name, {level: Math.min(previous?.level ?? 1, level), until: Math.max(previous?.until ?? 0, until)});
  }
  function currentLevel() {
    if (!context || !source || !latestView || silent()) return 0;
    const now = context.currentTime, station = latestView.station || {};
    let attenuation = 1;
    for (const [name, cue] of ducks) {
      if (cue.until <= now) ducks.delete(name);
      else attenuation = Math.min(attenuation, cue.level);
    }
    const speed = Math.abs(Number(latestView.velocity) || (Number(latestView.speedKmh) || 0) / 3.6);
    const remaining = Number(station.remaining);
    if ((latestView.brake || Number(latestView.throttle) < 0) && speed > .35) attenuation = Math.min(attenuation, .34);
    if (station.index === 1 && speed > .35 && Number.isFinite(remaining) && remaining < 95 && remaining > -12) {
      attenuation = Math.min(attenuation, .28 + .34 * clamp(Math.max(remaining, 0) / 95));
    }
    // After the arrival sounds, let the theme breathe quietly before closing it.
    let settlement = 1;
    if (settlingAt !== null) {
      const age = now - settlingAt;
      settlement = age < 2 ? .36 : age < 6 ? .36 + (age - 2) * .08 : .68 * clamp(1 - (age - 6) / 9);
    }
    if (leavingAt !== null) settlement *= clamp(1 - (now - leavingAt) / 4);
    lastDuck = attenuation;
    const introduction = sourceStartedAt === null ? 0 : clamp((now - sourceStartedAt) / 3.5);
    return userVolume * attenuation * settlement * introduction;
  }
  function syncGain() {
    if (silent()) return; // Preserve the short fade already scheduled by suspend().
    const next = currentLevel();
    // Cues get priority quickly. Music rises more gently when the cue ends.
    gain(next, next < gainTarget ? .07 : .75);
  }
  function maybeStart() {
    if (!context || context.state !== 'running' || !buffer || source || silent() || stage === 'completed') return;
    if (!latestView?.started || latestView.paused || latestView.phase === 'summary') return;
    const index = Number(latestView.station?.index);
    if (index !== 1) return;
    // A saved game already standing at Yaumati does not restart the first leg.
    if (latestView.station?.opened || latestView.station?.completed) { finish('first-leg-already-arrived'); return; }
    source = context.createBufferSource();
    source.buffer = buffer; source.loop = false; source.connect(master);
    const current = source;
    current.onended = () => {
      if (source !== current) return;
      source = null; current.disconnect();
      endedPosition = buffer?.duration || JOURNEY_TRACK.duration;
      gain(0, .02, true); stage = 'completed'; completedReason = 'score-ended';
    };
    sourceStartedAt = context.currentTime;
    stage = 'playing'; sourceStarts++;
    source.start(sourceStartedAt, 0);
    syncGain();
  }
  function suspend() {
    if (!context || context.state === 'closed') return Promise.resolve();
    if (pendingSuspend?.generation === operationGeneration) return pendingSuspend.promise;
    const generation = ++operationGeneration;
    const now = context.currentTime;
    gainTarget = 0; gainTimeConstant = .018;
    if (master.gain.cancelAndHoldAtTime) master.gain.cancelAndHoldAtTime(now);
    else { const value = master.gain.value; master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(value, now); }
    master.gain.linearRampToValueAtTime(0, now + .018);
    // A short, exact fade prevents a discontinuity at an arbitrary waveform sample.
    // A newer resume invalidates this timer, so quick toggles cannot suspend it later.
    const promise = new Promise(resolve => setTimeout(resolve, 20)).then(async () => {
      if (disposed || generation !== operationGeneration) return;
      await context.suspend();
    }).catch(error => { if (!disposed) errors.context = String(error.message || error); }).finally(() => {
      if (pendingSuspend?.generation === generation) pendingSuspend = null;
    });
    pendingSuspend = {generation, promise};
    return promise;
  }
  // Only called by APIs intended for a gesture, never from update/render/timers.
  function resumeFromGesture() {
    if (!context || context.state === 'closed' || silent()) return pendingSuspend?.promise || Promise.resolve();
    operationGeneration++; pendingSuspend = null;
    if (master && context) {
      const now = context.currentTime;
      if (master.gain.cancelAndHoldAtTime) master.gain.cancelAndHoldAtTime(now);
      else { const value = master.gain.value; master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(value, now); }
      // Force syncGain to establish the recovery curve after cancelling a fade.
      gainTimeConstant = -1;
    }
    return context.resume().then(() => {
      if (disposed) return;
      if (silent()) return pendingSuspend?.promise || suspend();
      maybeStart(); syncGain();
    }).catch(error => { if (!disposed) errors.context = String(error.message || error); });
  }
  async function unlock() {
    if (disposed) return getState();
    if (!context) {
      const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContext) { errors.context = 'Web Audio is unavailable'; return getState(); }
      try {
        context = new AudioContext(); master = context.createGain();
        master.gain.value = 0; master.connect(context.destination);
      } catch (error) { errors.context = String(error.message || error); return getState(); }
      loading = (async () => {
        try {
          const response = await fetch(new URL('../music/' + JOURNEY_TRACK.file, import.meta.url));
          if (!response.ok) throw new Error('HTTP ' + response.status);
          const raw = await response.arrayBuffer();
          if (disposed) return;
          const decoded = await context.decodeAudioData(raw);
          if (disposed) return;
          buffer = decoded; delete errors.asset;
          maybeStart();
        } catch (error) { if (!disposed) errors.asset = String(error.message || error); }
      })();
    }
    // Invoke resume synchronously before awaiting fetch/decode, preserving the gesture.
    const resuming = resumeFromGesture();
    await Promise.all([resuming, loading]);
    if (!disposed) { maybeStart(); syncGain(); }
    return getState();
  }
  function update(view) {
    if (!view || disposed) return;
    const tick = Number(view.tick), elapsed = Number(view.elapsed);
    const reset = (Number.isFinite(tick) && lastTick !== null && tick < lastTick) ||
      (Number.isFinite(elapsed) && lastElapsed !== null && elapsed < lastElapsed - .001) ||
      (latestView?.started && !view.started);
    if (reset) restart();
    latestView = view;
    if (Number.isFinite(tick)) lastTick = tick;
    if (Number.isFinite(elapsed)) lastElapsed = elapsed;
    if (view.paused && !paused) { paused = true; void suspend(); }
    const stationIndex = Number(view.station?.index);
    if (stationIndex >= 2 && stage !== 'completed' && (!source || silent() || context?.state !== 'running')) finish('outside-first-leg');
    if (view.phase === 'summary' && stage !== 'completed') finish('journey-ended');
    if (view.line && view.line !== 'kcr1' && stage !== 'completed') finish('outside-kcr-first-leg');
    maybeStart();
    const now = context?.currentTime ?? 0;
    const speed = Math.abs(Number(view.velocity) || (Number(view.speedKmh) || 0) / 3.6);
    const braking = !!view.brake || Number(view.throttle) < 0;
    if (braking && !lastBrake && speed > .35) duck('brake', .3, 1.4);
    if (Number(view.throttle) > 0 && lastThrottle <= 0 && speed < 2) duck('starting-steam', .42, 1.4);
    if (view.phase !== lastPhase && /^doors-/.test(view.phase || '')) duck('doors', .2, 2.2);
    for (const event of view.events || []) {
      if (!(event.id > lastEvent)) continue;
      if (event.type === 'whistle') duck('whistle', .2, 3.2);
      if (event.type === 'approach-steam') duck('steam', .25, 3);
      if (event.type === 'doors-opening' || event.type === 'doors-closing') duck('doors', .2, 2.2);
      if (event.type === 'departed') duck('guard-whistle', .32, 1.5);
      lastEvent = Math.max(lastEvent, Number(event.id) || 0);
    }
    if (source && stationIndex === 1 && settlingAt === null && speed < .35 &&
        (view.station?.canOpen || view.station?.opened || ['doors-opening', 'unloading', 'boarding', 'ready-depart'].includes(view.phase))) {
      settlingAt = now; stage = 'settling';
    }
    if (source && stationIndex >= 2 && leavingAt === null) leavingAt = now;
    if (source && ((settlingAt !== null && now - settlingAt >= 15) || (leavingAt !== null && now - leavingAt >= 4))) finish('first-leg-settled');
    syncGain();
    lastBrake = braking; lastThrottle = Number(view.throttle) || 0; lastPhase = view.phase;
  }
  function setPaused(value) {
    paused = !!value;
    return paused ? suspend() : resumeFromGesture();
  }
  function setEnabled(value) {
    userEnabled = !!value;
    return userEnabled ? resumeFromGesture() : suspend();
  }
  function setVolume(value) { userVolume = clamp(value); syncGain(); }
  function visibilityChanged() { if (isHidden()) void suspend(); }
  globalThis.document?.addEventListener('visibilitychange', visibilityChanged);
  function getState() {
    return {
      supported: !!(globalThis.AudioContext || globalThis.webkitAudioContext),
      state: disposed ? 'closed' : context?.state || 'locked', stage,
      ready: !!buffer, loaded: !!buffer, unlocked: context?.state === 'running', enabled: userEnabled,
      paused, volume: userVolume, gainTarget, duckFactor: lastDuck,
      playing: !!source && context?.state === 'running' && !silent(),
      activeSources: source ? 1 : 0, sourceStarts, sourceStops,
      cueStarted: sourceStartedAt !== null, finished: stage === 'completed',
      position: !source ? endedPosition : Math.max(0, Math.min(buffer?.duration || JOURNEY_TRACK.duration, (context?.currentTime ?? sourceStartedAt) - sourceStartedAt)),
      audioClock: context?.currentTime || 0, duration: buffer?.duration || JOURNEY_TRACK.duration,
      duckReasons: [...ducks].filter(([,cue])=>cue.until>(context?.currentTime||0)).map(([name])=>name),
      completedReason, scope: 'Kowloon → Yaumati only', track: JOURNEY_TRACK,
      errors: {...errors},
    };
  }
  function dispose() {
    if (disposed) return;
    disposed = true; operationGeneration++; stopSource(); gain(0, .02, true);
    globalThis.document?.removeEventListener('visibilitychange', visibilityChanged);
    master?.disconnect();
    if (context && context.state !== 'closed') void context.close().catch(() => {});
    buffer = null;
  }
  return {unlock, update, setEnabled, setVolume, setPaused, getState, dispose};
}
