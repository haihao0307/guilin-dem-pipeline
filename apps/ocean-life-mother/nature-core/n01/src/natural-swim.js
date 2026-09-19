/* Ocean Life N01: new self-authored time/current adapter. No model, skin,
 * texture, source animation or fitted-asset coefficients are imported.
 * Published biological regression is input DATA with an explicit domain.
 * Acceleration and constant-heading transport are engineering models, not
 * experimentally validated escape/feeding trajectories or a fluid solver. */
const NaturalSwim = (() => {
'use strict';
const TAU = 2 * Math.PI;
const copy = x => JSON.parse(JSON.stringify(x));
const finite = (x, name) => { if (!Number.isFinite(x)) throw Error(name + ' must be finite'); return x; };
const vec = (v, name) => { if (!Array.isArray(v) || v.length !== 3 || v.some(x => !Number.isFinite(x))) throw Error(name + ' requires finite xyz'); return v.slice(); };
const inside = (x, r) => x >= r[0] - 1e-12 && x <= r[1] + 1e-12;
function interval(r, name) {
 if (!Array.isArray(r) || r.length !== 2 || r.some(x => !Number.isFinite(x)) || r[0] >= r[1]) throw Error('Invalid ' + name);
}
function profileCheck(p) {
 if (!p || p.schema !== 'ocean-life-nature-motion-evidence/0.1' || typeof p.id !== 'string' || !p.id) throw Error('Unknown evidence profile');
 if (p.lengthMeasure !== 'fork-length' || p.speedFrame !== 'relative-to-water' || p.regime !== 'steady') throw Error('Incompatible measurement semantics');
 for (const k of ['lengthRangeM', 'waterTemperatureRangeC', 'speedRangeFLps']) interval(p[k], k);
 if (p.lengthRangeM[0] <= 0 || p.speedRangeFLps[0] <= 0 || p.extrapolationAllowed !== false) throw Error('Bounded swimming domain required');
 const f = p.frequencyFit;
 if (!f || f.kind !== 'linear' || !Number.isFinite(f.slopeHzPerFLps) || !Number.isFinite(f.interceptHz) || f.slopeHzPerFLps <= 0 || f.interceptHz < 0) throw Error('Unsupported regression');
 if (!Array.isArray(p.sourceAssetDependencies) || p.sourceAssetDependencies.length) throw Error('This adapter requires no model-asset dependencies');
 if (!Array.isArray(p.sources) || !p.sources.length) throw Error('Natural evidence record required');
 return p;
}
function estimate(profile, q) {
 const p = profileCheck(profile);
 if (!q) throw Error('Measurement required');
 for (const k of ['lengthM', 'speedFLps', 'waterTemperatureC']) finite(q[k], k);
 const reasons = [];
 if (q.species !== p.species) reasons.push('species-outside-evidence');
 if (q.lengthMeasure !== p.lengthMeasure) reasons.push('fork-length-required');
 if (q.speedFrame !== p.speedFrame) reasons.push('water-relative-speed-required');
 if (q.regime !== 'steady') reasons.push('nonsteady-regime-not-calibrated');
 if (!inside(q.lengthM, p.lengthRangeM)) reasons.push('length-outside-study-cohort');
 if (!inside(q.waterTemperatureC, p.waterTemperatureRangeC)) reasons.push('temperature-outside-source-conditions');
 if (!inside(q.speedFLps, p.speedRangeFLps)) reasons.push('speed-outside-source-conditions');
 if (reasons.length) return {supported:false, reasons, frequencyHz:null, speedMps:null, strideM:null};
 const frequencyHz = p.frequencyFit.slopeHzPerFLps * q.speedFLps + p.frequencyFit.interceptHz;
 const speedMps = q.speedFLps * q.lengthM;
 return {supported:true, reasons:[], frequencyHz, speedMps, strideM:speedMps/frequencyHz,
  sourceProfile:p.id, evidence:'published-regression-estimate', uncertaintyInterval:null, fieldValidated:false};
}
function create(profile, config) {
 const p = copy(profileCheck(profile));
 if (!config || typeof config.id !== 'string' || !config.id) throw Error('Actor identity required');
 const input = {species:config.species, lengthMeasure:config.lengthMeasure, lengthM:config.lengthM,
  speedFLps:config.initialSpeedFLps, waterTemperatureC:config.waterTemperatureC,
  speedFrame:'relative-to-water', regime:'steady'};
 const initial = estimate(p, input);
 if (!initial.supported) throw Error(initial.reasons.join(','));
 const direction = vec(config.forward, 'forward'), magnitude = Math.hypot(...direction);
 if (Math.abs(magnitude - 1) > 1e-9) throw Error('forward must be explicitly normalized');
 const pos = vec(config.positionM, 'positionM');
 finite(config.timeS, 'timeS'); finite(config.phaseCycles, 'phaseCycles');
 if (config.timeS < 0 || config.phaseCycles < 0) throw Error('Nonnegative clock state required');
 const signature = JSON.stringify([p.id,p.species,p.lengthMeasure,p.lengthRangeM,p.waterTemperatureRangeC,p.speedRangeFLps,p.frequencyFit]);
 const immutable = {id:config.id, species:p.species, lengthM:config.lengthM, lengthMeasure:p.lengthMeasure, forward:direction};
 const start = {...immutable, profileId:p.id, timeS:config.timeS, phaseCycles:config.phaseCycles,
  speedFLps:config.initialSpeedFLps, waterTemperatureC:config.waterTemperatureC, positionM:pos,
  lastTransport:null, lastRegime:'steady-model'};
 function validate(s) {
  if (!s || s.id !== immutable.id || s.profileId !== p.id || s.species !== p.species || s.lengthM !== immutable.lengthM || s.lengthMeasure !== p.lengthMeasure) throw Error('Clock/actor identity mismatch');
  vec(s.positionM, 'state position');
  if (!Array.isArray(s.forward) || s.forward.some((x,i) => x !== direction[i]) || s.forward.length!==3) throw Error('Changing heading requires a separate turning model');
  for (const k of ['timeS','phaseCycles','speedFLps','waterTemperatureC']) finite(s[k], 'state ' + k);
  if (s.timeS < 0 || s.phaseCycles < 0 || !inside(s.speedFLps,p.speedRangeFLps) || !inside(s.waterTemperatureC,p.waterTemperatureRangeC)) throw Error('Invalid saved state');
 }
 function query(s) {
  validate(s);
  const f = p.frequencyFit.slopeHzPerFLps * s.speedFLps + p.frequencyFit.interceptHz;
  return {id:s.id, timeS:s.timeS, frequencyHz:f, phaseCycles:s.phaseCycles,
   phaseRadians:TAU*(s.phaseCycles % 1), speedThroughWaterMps:s.speedFLps*s.lengthM,
   positionM:s.positionM.slice(), regime:s.lastRegime, sourceProfile:p.id,
   numericalPrediction:true, biologicalMotionAcceptance:false};
 }
 function advance(s, endTimeS, control, environment) {
  validate(s); finite(endTimeS,'endTimeS');
  const dt = endTimeS - s.timeS;
  if (dt < 0 || dt > 60) throw Error('Require an ordered interval of at most 60s; elapsed time is not silently clamped');
  if (!control || !environment || environment.timeS !== s.timeS) throw Error('Matching environment start time required');
  if (environment.frame !== 'metre-y-up' || environment.flowStatus !== 'known' || environment.constantOverInterval !== true) throw Error('Explicit constant known flow in metre-y-up frame required');
  const current = vec(environment.currentMps,'currentMps');
  finite(control.targetSpeedFLps,'targetSpeedFLps'); finite(control.accelerationFLps2,'accelerationFLps2');
  if (control.accelerationFLps2 <= 0) throw Error('Positive authored acceleration limit required');
  const target = estimate(p,{...input, speedFLps:control.targetSpeedFLps, waterTemperatureC:environment.waterTemperatureC});
  if (!target.supported) return {accepted:false, state:copy(s), reasons:target.reasons};
  if (dt===0) return {accepted:true, state:copy(s), reasons:[], phaseIntegralCycles:0, displacementThroughWaterM:0};
  // Exact integral for one constant-acceleration-to-target interval. This makes
  // phase continuous on speed changes and invariant to redraw rate/step splits.
  const delta = control.targetSpeedFLps-s.speedFLps;
  const signedA = Math.sign(delta)*control.accelerationFLps2;
  const rampSeconds = Math.min(dt, Math.abs(delta)/control.accelerationFLps2);
  const speedEnd = s.speedFLps + signedA*rampSeconds;
  const integratedFL = s.speedFLps*rampSeconds + .5*signedA*rampSeconds*rampSeconds + speedEnd*(dt-rampSeconds);
  const cycles = p.frequencyFit.slopeHzPerFLps*integratedFL + p.frequencyFit.interceptHz*dt;
  const next = {...s, timeS:endTimeS, phaseCycles:s.phaseCycles+cycles, speedFLps:speedEnd,
   waterTemperatureC:environment.waterTemperatureC,
   positionM:s.positionM.map((x,i) => x + direction[i]*integratedFL*s.lengthM + current[i]*dt),
   lastRegime:rampSeconds>0?'authored-transient-using-steady-fit':'steady-model',
   lastTransport:{currentMps:current, velocityWorldMps:direction.map((x,i) => x*speedEnd*s.lengthM+current[i]),
    accelerationFLps2:control.accelerationFLps2, observedEscapeTrajectory:false}};
  if (!Number.isFinite(next.phaseCycles) || next.phaseCycles>1e12) throw Error('Clock precision budget exceeded');
  return {accepted:true, state:next, reasons:[], phaseIntegralCycles:cycles, displacementThroughWaterM:integratedFL*s.lengthM};
 }
 function checkpoint(s) {validate(s);return {schema:'ocean-life-swim-clock-checkpoint/0.1',profileSignature:signature,state:copy(s)};}
 function restore(record) {
  if (!record || record.schema!=='ocean-life-swim-clock-checkpoint/0.1' || record.profileSignature!==signature) throw Error('Checkpoint rule mismatch');
  validate(record.state);return copy(record.state);
 }
 return Object.freeze({initialState:()=>copy(start), query, advance, checkpoint, restore});
}
return Object.freeze({estimate, create});
})();
if (typeof module!=='undefined') module.exports=NaturalSwim;
if (typeof window!=='undefined') window.NaturalSwim=NaturalSwim;
