// CPU-only audit against the retained FH88 Session, not a second passenger model.
// No browser, renderer, network, or mutation of the retained host files is used.
// This suite validates CPU construction parameters against the real Session.
// The final GPU integration check deliberately stays TODO: passing this suite
// does not establish that the field generator or renderer consumes the recipe.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createStationBinding} from '../station-binding.mjs';
import {createHostConstruction, hostConstructionWGSL, exitSupportWorldHeight, validateHostConstruction} from '../host-construction.mjs';
import {STATION_SCORE} from '../../kowloon-station-r04/station-score.mjs';

const roots = [
  ...(process.env.HOST_88_ROOT ? [pathToFileURL(process.env.HOST_88_ROOT.replace(/\/$/, '') + '/')] : []),
  new URL('../../', import.meta.url),
  new URL('../../kowloon-station-r03/restored/kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01/', import.meta.url),
];
const hostRoot = roots.find(root => fs.existsSync(new URL('session.mjs', root)) && fs.existsSync(new URL('metre-scale.mjs', root)));
assert(hostRoot, 'The exact retained FH88 host is required; set HOST_88_ROOT if it is elsewhere.');
const {Session, FRONT_X, COACHES} = await import(new URL('session.mjs', hostRoot));
const {TRACK, COACH_DIMENSIONS, COACH_FLOOR, PLATFORM_LAYOUT} = await import(new URL('metre-scale.mjs', hostRoot));
const {ADULT_HEIGHTS_M, actorBodyDimensions} = await import(new URL('actor-scale.mjs', hostRoot));
const snapshot = JSON.parse(fs.readFileSync(new URL('./host-datums.json', import.meta.url)));
const binding = createStationBinding({score: STATION_SCORE, track: TRACK, platform: PLATFORM_LAYOUT, coach: COACH_DIMENSIONS, frontX: FRONT_X});
const coverage = binding.validateCoverage();
const hc = binding.construction.host;
const close = (a, b, message = '') => assert(Math.abs(a - b) < 1e-9, `${message}: ${a} != ${b}`);
const doorXs = COACHES.flatMap(c => [c.frontDoor, c.rearDoor]);
const stopMin = Math.max(-7, PLATFORM_LAYOUT.minX + .22 - Math.min(...doorXs));
const stopMax = Math.min(7, PLATFORM_LAYOUT.maxX - .22 - Math.max(...doorXs));
const stationZMin = coverage.platformCenter - binding.construction.platformHalfWidthM - coverage.boardingTrackX;
const stationZMax = coverage.platformCenter + binding.construction.platformHalfWidthM - coverage.boardingTrackX;

function stopped(delta = 0) {
  const session = new Session({line: 'kcr1', seed: 'LAOSIJi-2026'});
  session.distance = session.station.target + delta;
  session.velocity = 0;
  session.stopStable = 1;
  return session;
}

// Session world -> unchanged FH88 flat-render frame -> station-attached frame.
// FRONT_X cancels only after BOTH of the first two transforms, as in the host.
function renderedPoint(session, p) { return [p[0] - session.distance + FRONT_X, p[1], p[2]]; }
function stationPoint(session, p) {
  const rendered = renderedPoint(session, p);
  return [rendered[0] - (session.station.target - session.distance), rendered[1], rendered[2]];
}

function actualPaths(delta = 0, everyCoach = true) {
  const session = stopped(delta);
  // Both coaches can contain arrivals in a valid saved Session. Keep the actual
  // Session path generator; only this private test fixture's destinations change.
  if (everyCoach) for (const actor of session.actors) if (actor.kind === 'seated') actor.destination = 0;
  session.startUnloading();
  const alight = session.actors.filter(a => a.path?.kind === 'alight').map(a => ({id: a.id, points: a.path.points.map(p => stationPoint(session, p))}));
  const leave = new Map();
  for (let i = 0; i < 2000 && leave.size < alight.length; i++) {
    session.updateActors();
    for (const a of session.actors) if (a.path?.kind === 'leave' && !leave.has(a.id)) leave.set(a.id, {id: a.id, points: a.path.points.map(p => stationPoint(session, p))});
  }
  assert.equal(leave.size, alight.length, 'Real Session alighting must reach its leave-path transition.');
  const boardingSession = stopped(delta);
  boardingSession.startBoarding();
  const board = boardingSession.actors.filter(a => a.path?.kind === 'board').map(a => ({id: a.id, points: a.path.points.map(p => stationPoint(boardingSession, p))}));
  return {alight, leave: [...leave.values()], board};
}

function distanceToSegmentXZ(p, a, b) {
  const dx = b[0] - a[0], dz = b[2] - a[2], den = dx * dx + dz * dz;
  const u = den ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[2] - a[2]) * dz) / den)) : 0;
  return Math.hypot(p[0] - a[0] - u * dx, p[2] - a[2] - u * dz);
}

function columnCenters(phaseM = 0, worldZM = 5) {
  return Array.from({length: STATION_SCORE.shed.bays + 1}, (_, i) => [
    -75 - (STATION_SCORE.shed.front - i * STATION_SCORE.shed.bay + phaseM), 1.1, worldZM,
  ]);
}

function minimumColumnClearance(paths, columns, radius = .209) {
  let result = {clearance: Infinity};
  for (const path of paths) for (let i = 1; i < path.points.length; i++) {
    const a = path.points[i - 1], b = path.points[i];
    if (Math.max(a[2], b[2]) < PLATFORM_LAYOUT.minZ) continue;
    for (const column of columns) {
      const clearance = distanceToSegmentXZ(column, a, b) - radius;
      if (clearance < result.clearance) result = {clearance, actor: path.id, segment: i - 1, column, from: a, to: b};
    }
  }
  return result;
}

function embeddedLeavePoints(paths, farEdge) {
  return paths.flatMap(path => path.points.filter(p => p[0] > coverage.worldMin && p[0] < coverage.worldMax && p[2] > stationZMin && p[2] < farEdge && p[1] < PLATFORM_LAYOUT.top - 1e-9 && p[1] > .1).map(p => ({actor: path.id, point: p})));
}

test('retained FH88 datums, actual four doors and Kowloon target are used', () => {
  assert.deepEqual(TRACK, snapshot.track);
  assert.deepEqual(PLATFORM_LAYOUT, snapshot.platform);
  assert.deepEqual(COACH_DIMENSIONS, snapshot.coach);
  assert.equal(FRONT_X, 5);
  assert.equal(stopped().station.english, 'Kowloon');
  assert.equal(stopped().station.target, 0);
  [-18.785225, -35.185225, -39.572225, -55.972225].forEach((x, i) => close(doorXs[i], x, 'door ' + i));
});

test('FRONT_X cancels between Session and render frames; binding must not add it again', () => {
  for (const delta of [stopMin, 0, 2.8, 7]) {
    const session = stopped(delta), frame = binding.frame(session.view(), session.route);
    for (const x of doorXs) {
      const global = session.toWorld([x, COACH_FLOOR, COACH_DIMENSIONS.width / 2]);
      close(global[0], session.distance + x - FRONT_X);
      const rendered = renderedPoint(session, global);
      close(rendered[0], x);
      frame.toWorld(frame.toLocal(rendered)).forEach((v, i) => close(v, rendered[i]));
      close(frame.toWorld([5, .85, -75])[0], session.station.target - session.distance);
    }
  }
});

test('all four complete door widths fit the bound platform over the unchanged opening gate', () => {
  close(stopMin, -4.3035);
  close(stopMax, 7);
  assert(!stopped(stopMin - .001).canOpen());
  assert(!stopped(stopMax + .001).canOpen());
  close(coverage.worldMin, -66.3);
  close(coverage.worldMax, 71.3);
  for (const delta of [stopMin, -.001, 0, 2.8, stopMax]) {
    const session = stopped(delta);
    assert(session.canOpen());
    for (const x of doorXs) {
      assert(x + delta - COACH_DIMENSIONS.doorWidth / 2 >= coverage.worldMin);
      assert(x + delta + COACH_DIMENSIONS.doorWidth / 2 <= coverage.worldMax);
    }
  }
});

test('rail crown, deck, near edge, handrail gap and actual stepboard gap stay distinct', () => {
  const session = stopped(), frame = binding.frame(session.view(), session.route), c = binding.construction;
  close(c.worldVerticalOffsetM, .25);
  close(frame.toWorld([5, c.railTopLocalM, -75])[1], .3485);
  close(frame.toWorld([10, .85, -75])[1], 1.10);
  close(stationZMin, 1.5897);
  close(stationZMax, 6.15);
  close(coverage.platformCenter, 8.86985);
  close(binding.construction.platformHalfWidthM, 2.28015);
  close(c.boardingGapM, .18);
  close(stationZMin - COACH_DIMENSIONS.bodyAndStepsWidth / 2, .2181);
  close(COACH_FLOOR, 1.5985);
  close(2 * c.railCenterOffsetM - c.railHeadWidthM, TRACK.gauge);
});

test('actual Session boarding and alighting point chains retain the same steps and doors', () => {
  const {board, alight, leave} = actualPaths();
  assert.equal(board.length, 3);
  assert.equal(alight.length, 4);
  assert.equal(leave.length, 4);
  for (const path of board) {
    assert(COACHES.some(c => Math.abs(c.frontDoor - path.points[2][0]) < 1e-9));
    close(path.points[2][1], 1.1); close(path.points[2][2], 1.8097);
    close(path.points[3][1], 1.2661666666666667); close(path.points[3][2], 1.2016);
    close(path.points[4][1], 1.4323333333333335); close(path.points[4][2], .8916);
    close(path.points[5][1], 1.5985); close(path.points[5][2], .6);
  }
  for (const path of alight) assert(COACHES.some(c => Math.abs(c.rearDoor - path.points[6][0]) < 1e-9));
  for (const path of leave) close(path.points.at(-1)[2], 7.35);
});

test('diagnostic: non-centred far edge 6.15 removes deck penetration, but exit stairs must exist', () => {
  const paths = actualPaths().leave;
  assert(embeddedLeavePoints(paths, 8.4103).length > 0, 'Regression evidence: old symmetric island swallowed actors.');
  assert.equal(embeddedLeavePoints(paths, PLATFORM_LAYOUT.maxZ).length, 0);
  for (const path of paths) {
    const p = path.points;
    close(p[1][2], 6.3); close(p[1][1], 1.1);
    close(p[2][2], 6.58); close(p[2][1], .77);
    close(p[3][2], 6.86); close(p[3][1], .44);
    close(p[4][2], 7.15); close(p[4][1], .14);
  }
  // This assertion is a source audit, not evidence that the new renderer already
  // renders these retained stair objects or supports off-centre stop exits.
  const source = fs.readFileSync(new URL('station-platform.mjs', hostRoot), 'utf8');
  assert.match(source, /car\.rearDoor\+1\.1/);
  assert.match(source, /maxZ\+\.15\+j\*\.28/);
});

test('diagnostic: half-bay column shift clears exact stop but fails a legal positive stop offset', () => {
  const atStop = minimumColumnClearance(actualPaths(0, false).alight, columnCenters(3.75));
  assert(atStop.clearance > 2, JSON.stringify(atStop));
  const delta = 3.935225;
  assert(stopped(delta).canOpen(), 'Counterexample must be admitted by the real Session.');
  const hit = minimumColumnClearance(actualPaths(delta, false).alight, columnCenters(3.75));
  close(hit.clearance, -.209);
});

test('conservative clear envelope includes adults, rotated baskets and unchanged angry-running limit', () => {
  const tallest = actorBodyDimensions(Math.max(...ADULT_HEIGHTS_M));
  const basketRadius = Math.hypot(.21, .91) * tallest.accessoryScale;
  close(basketRadius, .9659457349099368);
  const margin = basketRadius + .1;
  const minX = Math.min(...COACHES.map(c => c.rearDoor)) + stopMin;
  const maxNormalX = Math.max(...COACHES.map(c => c.frontDoor)) + stopMax;
  close(minX, -60.275725); close(maxNormalX, -11.785225);
  const angryMax = -7.5 + FRONT_X;
  const envelope = {minX: minX - margin, maxX: angryMax + margin, maxZ: 7.35 + margin};
  assert(envelope.minX >= -61.35 && envelope.maxX <= -1.43 && envelope.maxZ <= 8.42);
  assert(8.84 - .42 >= 8.42 - 1e-9, 'Outer foundation may only touch the reserved clear boundary.');
  const source = fs.readFileSync(new URL('characters.mjs', hostRoot), 'utf8');
  assert.match(source, /sign\*\.72\*q/); assert.match(source, /\.42\*q,\.019\*q,\.38\*q/);
  const sessionSource = fs.readFileSync(new URL('session.mjs', hostRoot), 'utf8');
  assert.match(sessionSource, /Math\.min\(s\.target-7\.5/);
});

test('CPU recipe: asymmetric island must not contain actual descending exit paths', () => {
  const embedded = embeddedLeavePoints(actualPaths().leave, stationZMax);
  assert.equal(embedded.length, 0, 'New island reaches Z=' + stationZMax + ' while real actors descend inside it: ' + JSON.stringify(embedded));
});

test('regression diagnostic: original column grid intersects default Kowloon alighting paths', () => {
  const hit = minimumColumnClearance(actualPaths(0, false).alight, columnCenters());
  assert(hit.clearance < 0, 'Regression fixture must expose the actual original conflict: ' + JSON.stringify(hit));
  close(hit.clearance, -.023775);
});

test('regression diagnostic: old boarding-island bench intersects a legally admitted stop', () => {
  const delta = -3.564775;
  assert(stopped(delta).canOpen());
  const paths = actualPaths(delta, false).alight;
  const center = [-38.75, 1.6, 5]; // Current local bench Z=-36.25 -> host X=-38.75.
  const hit = paths.some(path => path.points.some(p => Math.abs(p[0] - center[0]) < 1.7 && p[2] > 4.69 && p[2] < 5.31));
  // Test the actual transverse segment too: its endpoints lie on either side.
  const crossing = paths.some(path => path.points.slice(1).some((b, i) => {
    const a = path.points[i];
    return Math.abs(a[0] - center[0]) < 1.7 && Math.abs(b[0] - center[0]) < 1.7 && Math.min(a[2], b[2]) < 5 && Math.max(a[2], b[2]) > 5;
  }));
  assert(hit || crossing, 'The original bench collision must remain observable in this fixture.');
});

test('CPU recipe: actual path segments clear retained posts across the complete stop-offset interval', (t) => {
  const columns = hc.supports.retainedBoardingPostLocalZ.map(z => [-75-z, 1.1, 5]);
  let minimum = Infinity;
  for (let i=0;i<=128;i++) {
    const delta=stopMin+(stopMax-stopMin)*i/128;
    assert(stopped(delta).canOpen());
    const {board,alight,leave}=actualPaths(delta);
    const hit=minimumColumnClearance([...board,...alight,...leave],columns,
      hc.supports.footingHalfWidthM*Math.SQRT2+hc.passengerClearance.sweptRadiusM);
    minimum=Math.min(minimum,hit.clearance);
    assert(hit.clearance>0, JSON.stringify({delta,...hit}));
  }
  assert(minimum>2, 'Includes circumscribed square footing and rotated carrying-basket radius.');
  t.diagnostic('Minimum sampled path/footing separation after carrying radius + 0.10m reserve: '+minimum+'m');
  assert.deepEqual(hc.supports.vacatedBoardingPostLocalZ,[-17.5,-25,-32.5,-40,-47.5,-55,-62.5,-70]);
  assert.deepEqual(hc.supports.unchangedRowsLocalXM,[-30,-10,30]);
});

test('CPU recipe: outer supports clear every rail vehicle envelope and deep transfer clears headroom',()=>{
  assert.equal(hc.supports.outerRowLocalXM,30);
  close(hc.supports.railClearanceM,3.08);
  assert.equal(hc.supports.transfer.spanM,40);
  assert.equal(hc.supports.transfer.depthM,1.6);
  assert.equal(hc.supports.transfer.bottomLocalYM,9.25);
  assert(hc.supports.transfer.bottomLocalYM>hc.passengerClearance.verticalClearTopLocalYM);
  assert.equal(hc.supports.transfer.structuralLoadCertification,false);
  close(hc.boardingIsland.copingCenterLocalYM+hc.boardingIsland.copingHalfHeightM,hc.boardingIsland.topLocalYM);
});

test('CPU recipe: retained boarding-island benches are wholly outside the swept corridor',()=>{
  assert.deepEqual(hc.benches.retainedLocalZ,[-81.25,-88.75,-103.75,-111.25,-126.25,-133.75]);
  assert.deepEqual(hc.benches.relocated.map(p=>p.from),[-13.75,-36.25,-58.75]);
  for(const z of hc.benches.retainedLocalZ){
    const maxZ=z+hc.benches.halfLengthM+hc.passengerClearance.clearanceM;
    assert(maxZ<hc.passengerClearance.local.minZ);
  }
});

test('CPU recipe: exit strips cover every stop offset and support the actual interpolated centerline',()=>{
  for(const delta of [stopMin,0,3.935225,stopMax])for(const path of actualPaths(delta).leave){
    const first=path.points[0],exit=hc.exits.find(e=>first[0]>=e.worldMinX&&first[0]<=e.worldMaxX);
    assert(exit,'A swept exit strip must cover this actual rear-door path');
    for(let i=1;i<path.points.length;i++)for(let j=0;j<=32;j++){
      const a=path.points[i-1],b=path.points[i],u=j/32,p=a.map((v,k)=>v+(b[k]-v)*u);
      if(p[2]<PLATFORM_LAYOUT.maxZ)continue;
      close(exitSupportWorldHeight(hc,p[2]),p[1],'interpolated Session foot-center height');
      assert(p[0]>=exit.worldMinX&&p[0]<=exit.finalApronWorldMaxX);
    }
    assert(exit.referenceTreads.every(t=>t.depthM===.32&&t.renderInsideWalkingStrip===false));
    close(exit.referenceTreads[0].widthM,13.435391469819876);
    close(exit.groundOverride.topLocalYM,-.11);
  }
});

test('CPU contract rejects narrowed clearance, unsafe outer foundations and unsupported host changes',()=>{
  const make=options=>createHostConstruction({score:STATION_SCORE,platform:PLATFORM_LAYOUT,
    coach:COACH_DIMENSIONS,...options});
  for(const options of [{clearanceM:.01},{maxActorHeightM:1.7},{outerSupportLocalXM:13.84},
    {boardingFarWorldZM:8.4103},{transferDepthM:1.59},{transferBottomLocalYM:3},
    {hallBehindStopM:250},{frontX:0},{outerSupportLocalXM:NaN},
    {doors:[{...COACHES[0],rearDoor:-30},COACHES[1]]}])assert.throws(()=>make(options),JSON.stringify(options));
  const unsafe=JSON.parse(JSON.stringify(hc));unsafe.supports.retainedBoardingPostLocalZ.push(-32.5);
  assert.throws(()=>validateHostConstruction(unsafe),/post enters/);
});

test('CPU contract exports shared WGSL constants without claiming GPU verification',()=>{
  const wgsl=hostConstructionWGSL(hc);
  assert.match(wgsl,/const HOST_ISLAND_NEAR_X:f32=6\.5897;/);
  assert.match(wgsl,/const HOST_ISLAND_FAR_X:f32=11\.15;/);
  assert.match(wgsl,/const HOST_OUTER_SUPPORT_X:f32=30\.;/);
  assert.match(wgsl,/HOST_EXIT_PROFILE_Y/);
  assert(Object.isFrozen(hc)&&Object.isFrozen(hc.exits[0].profile));
  assert.equal(hc.gpuVerified,false);
  assert.match(hc.validationScope,/CPU.*unverified/);
});

test.todo('INTEGRATION PENDING: actual common field consumption and host-camera GPU pixels require independent evidence');
