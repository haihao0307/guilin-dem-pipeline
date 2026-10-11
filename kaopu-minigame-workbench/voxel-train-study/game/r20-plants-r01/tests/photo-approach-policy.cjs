'use strict';
// Advice for a human-equivalent QA driver only; this module does not mutate
// Session, set position/speed, step physics, or change acceptance thresholds.
exports.photoApproachAction = function photoApproachAction(view, target = 790) {
 const x = view.distance, v = Math.max(0, view.velocity), left = target - x;
 if (![x, v, view.brakingDistance, view.throttle, target].every(Number.isFinite)) throw Error('Finite actual driving state required');
 if (x > target + 4) return 'overshoot';
 if (view.velocity < 0) return 'brake';
 if (v === 0 && x >= target - 4) return 'done';
 // Include the observed 2.467 s input-delivery delay, conservatively rounded up.
 if (x + view.brakingDistance + v * 2.8 >= target - 1) return 'brake';
 // Each brake action means HOLD until actual speed is exactly zero, release,
 // then read a fresh state and call again. A short stop is not a failure.
 const near = left < 35, limit = left < 12 ? .20 : .45;
 if (near && v > limit) return 'brake';
 if (view.throttle > 0 && v > (near ? .20 : 1.2)) return 'decelerate';
 if (view.throttle < 1 && v < (near ? .10 : .6)) return 'accelerate';
 return 'wait';
};
