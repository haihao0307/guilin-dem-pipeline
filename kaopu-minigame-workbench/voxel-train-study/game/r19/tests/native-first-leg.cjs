'use strict';
// Audit deliverable only. Requires the approved official CI browser; never
// launch a local browser to evade the existing socket/access restriction.
// All page evaluation is read-only. All state changes use trusted Playwright
// mouse or keyboard input and the production requestAnimationFrame clock.
const assert = require('node:assert/strict');
module.exports = async function serveFirstTwoStations(page, clickTarget, checkpoint=async()=>{}, afterStart=async()=>{}) {
  const states = [], state = () => page.evaluate(() => window.__trainDriver.getState());
  const until = (fn, arg, timeout = 180000) => page.waitForFunction(fn, arg, {polling: 25, timeout});
  const save = async label => {const s = await state(); states.push({label, state:s}); return s;};
  async function brakeToRest() {
    await page.keyboard.down('Space');
    await until(() => __trainDriver.getState().velocity === 0);
    await page.keyboard.up('Space');
    await until(() => !__trainDriver.getState().brake);
  }
  await until(() => window.__trainDriver?.ready);
  await clickTarget(page, '#startGame');
  await afterStart();
  await until(() => __trainDriver.getState().station.canOpen);
  await clickTarget(page, '#stationAction');
  await until(() => ['doors-opening','unloading','boarding','ready-depart'].includes(__trainDriver.getState().phase));
  await page.keyboard.press('w');
  let s = await save('first-door-interlock');
  assert.equal(s.throttle, 0); assert.equal(s.velocity, 0);
  await until(() => __trainDriver.getState().phase === 'ready-depart');
  s = await save('first-stop-served');
  assert.equal(s.stats.stops, 1); assert.equal(s.station.index, 0);
  assert.equal(s.station.boarded, 3); assert.equal(s.station.alighted, 2);
  await checkpoint('first-station');
  await clickTarget(page, '#stationAction');
  await until(() => {const s=__trainDriver.getState();return s.phase==='running'&&s.station.index===1&&s.door===0;});
  s = await save('first-departure');
  assert.equal(s.throttle, 1); assert.equal(s.station.target, 700);
  // Keep notch 1 while accelerating: one neutral command at 12 m/s gives
  // far more latency headroom than notch 3. Do not screenshot during braking.
  await until(() => {const s=__trainDriver.getState();return s.velocity>=12||s.station.remaining<=s.velocity*s.velocity/6.2+5*s.velocity+22;});
  s = await state();
  if (s.throttle > 0) await page.keyboard.press('s');
  for(const point of [150,350,500]){await until(point => __trainDriver.getState().distance >= point, point);await checkpoint('native-'+point);}
  await until(() => {const s=__trainDriver.getState();return s.station.remaining<=s.velocity*s.velocity/6.2+5*s.velocity+22;});
  await brakeToRest();
  await save('second-station-early-approach');
  // Conservative native crawl. The geometry-derived valid opening interval
  // is [695.6965,707], not the nominal [693,707]. A conservative six-second near-stop predictor allows several native input/observation round trips;
  // record actual input latency and fail rather than claim precision if slower.
  const deadline = Date.now()+360000;
  while (Date.now()<deadline) {
    s = await state();
    if (s.station.canOpen) break;
    assert.equal(s.station.index,1,'Do not skip the second station');
    assert.equal(s.stats.missed,0,'Overshoot is a failed acceptance; do not hide it with teleport/replay');
    assert(s.distance<707,'Approach must remain inside the permitted opening corridor');
    if (s.velocity > 0 && s.station.remaining <= s.velocity*s.velocity/6.2+6*s.velocity-1) {
      await brakeToRest(); continue;
    }
    if (s.velocity < .35 && s.station.platformCoverage && Math.abs(s.station.remaining)<=7) {
      await until(() => __trainDriver.getState().station.canOpen); break;
    }
    // Native W is only sent from neutral/near-stationary state.
    if (s.throttle===0 && s.velocity<=.35) await page.keyboard.press('w');
    await until(() => {const s=__trainDriver.getState();return s.station.canOpen||s.velocity >= (s.station.remaining < 18 ? .6 : 1.2)||s.station.remaining<=s.velocity*s.velocity/6.2+6*s.velocity-1;});
    s = await state();
    if (s.station.canOpen) break;
    if (s.throttle>0) await page.keyboard.press('s');
    await until(() => {const s=__trainDriver.getState();return s.station.canOpen||s.velocity<=.3||s.station.remaining<=s.velocity*s.velocity/6.2+6*s.velocity-1;});
  }
  s = await save('second-station-native-stop');
  assert(s.station.canOpen,'Second-station native stop was not established before the test deadline');
  assert(s.station.platformCoverage); assert(s.distance>=695.6965&&s.distance<=707);
  await clickTarget(page, '#stationAction');
  await until(() => ['doors-opening','unloading','boarding','ready-depart'].includes(__trainDriver.getState().phase));
  await page.keyboard.press('w');
  s = await save('second-door-interlock');
  assert.equal(s.throttle,0); assert.equal(s.velocity,0);
  await until(() => {const s=__trainDriver.getState();return s.phase==='ready-depart'&&s.stats.stops===2;});
  s = await save('second-stop-served');
  assert.equal(s.station.index,1); assert.equal(s.station.completed,true);
  await checkpoint('second-station');
  assert.equal(s.station.boarded,4); assert.equal(s.stats.missed,0); assert.equal(s.stats.stops,2);
  // Leave stationary with doors serviced for actual city/platform screenshots.
  // Do not close doors here: that would begin the third leg.
  return {kind:'trusted-ui-production-clock',fixtureStateWrites:false,states};
};
