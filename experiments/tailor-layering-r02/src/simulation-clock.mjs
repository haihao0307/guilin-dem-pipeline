/**
 * Run serial fixed simulation steps independently of presentation callbacks.
 *
 * `step` owns the simulation dt; this clock neither changes it nor receives a
 * render promise. Starts are separated by at least periodMS on the monotonic
 * `now` clock. A slow step or late timer establishes the next actual start,
 * without accumulating catch-up steps. Every continuation yields through wait,
 * including when the previous step already exceeded the requested period.
 *
 * Cancellation is cooperative: active() is checked before each new step and
 * after every wait. An outstanding step is awaited to completion; cancelling
 * never abandons a worker result or launches a replacement concurrently.
 * Timers cannot overcome a blocked main thread or a slow solver. This provides
 * a maximum dispatch rate, not a guarantee of real-time simulation.
 */
export async function runFixedStepLoop({
  step,
  active,
  periodMS = 1000 / 120,
  now = () => performance.now(),
  wait = ms => new Promise(resolve => setTimeout(resolve, Math.ceil(ms))),
} = {}) {
  if (typeof step !== 'function' || typeof active !== 'function' ||
      typeof now !== 'function' || typeof wait !== 'function') {
    throw new TypeError('step, active, now and wait must be functions.');
  }
  if (!Number.isFinite(periodMS) || periodMS <= 0) {
    throw new RangeError('periodMS must be positive and finite.');
  }
  const time = () => {
    const value = now();
    if (!Number.isFinite(value)) throw new RangeError('now() must return a finite monotonic time.');
    return value;
  };

  let steps = 0, lastStarted = null;
  while (active()) {
    if (lastStarted !== null) {
      // Even an overdue step yields one task. Early/fractional timer wakeups
      // recheck the deadline instead of exceeding the maximum start rate.
      const earliestStart = lastStarted + periodMS;
      do {
        await wait(Math.max(0, earliestStart - time()));
        if (!active()) return {steps};
      } while (time() < earliestStart);
    }
    lastStarted = time();
    await step();
    steps++;
  }
  return {steps};
}
