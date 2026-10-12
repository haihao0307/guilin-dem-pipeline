// SI construction contract for the retained FH88 Session. These are function
// recipe parameters, not meshes. CPU validation does NOT attest GPU consumption.
export const HOST_DOORS = Object.freeze([
  Object.freeze({frontDoor: -18.785225, rearDoor: -35.185225}),
  Object.freeze({frontDoor: -39.572225, rearDoor: -55.972225}),
]);
const finite = (n, name) => { if (!Number.isFinite(n)) throw Error('Nonfinite ' + name); return n; };
const requireThat = (ok, message) => { if (!ok) throw Error(message); };
const freeze = x => { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x); } return x; };
const overlaps = (a, b, c, d) => a < d && b > c;

export function createHostConstruction({score, platform, coach, frontX = 5,
  hallBehindStopM = 75, boardingTrackX = 5, worldVerticalOffsetM = .25,
  doors = HOST_DOORS, maxActorHeightM = 1.84, clearanceM = .10,
  boardingFarWorldZM = platform?.maxZ, outerSupportLocalXM = 30,
  transferStartLocalXM = -10, transferDepthM = 1.6, transferBottomLocalYM = 9.25,
} = {}) {
  for (const [name, value] of Object.entries({frontX, hallBehindStopM, boardingTrackX,
    worldVerticalOffsetM, maxActorHeightM, clearanceM, boardingFarWorldZM,
    outerSupportLocalXM, transferStartLocalXM, transferDepthM, transferBottomLocalYM})) finite(value, name);
  requireThat(score?.units === 'metres', 'Host construction requires SI station recipe');
  requireThat(platform && coach && doors.length === 2, 'Retained platform, coach and two door pairs required');
  for (const key of ['minX', 'maxX', 'minZ', 'maxZ', 'top']) finite(platform[key], 'platform.' + key);
  finite(coach.width, 'coach.width');
  requireThat(maxActorHeightM >= 1.84 && clearanceM >= .10, 'Cannot shrink the audited adult/accessory clearance');
  requireThat(frontX === 5, 'Retained FRONT_X must remain 5m');
  requireThat(boardingFarWorldZM === platform.maxZ, 'Far platform edge must preserve the unchanged Session exit datum');
  requireThat(platform.maxZ > platform.minZ && platform.top === 1.1, 'Unsupported host platform datum');
  requireThat(score.tracks.centers.includes(boardingTrackX), 'Boarding track absent');
  requireThat(boardingTrackX===5, 'This retained host alignment is audited for the local X=5 track');
  const originalIslandX = score.platforms.centers.find(x => x > boardingTrackX);
  requireThat(Number.isFinite(originalIslandX), 'Boarding island absent');
  doors.forEach((d, i) => {
    finite(d.frontDoor, 'frontDoor'); finite(d.rearDoor, 'rearDoor');
    requireThat(d.frontDoor === HOST_DOORS[i].frontDoor && d.rearDoor === HOST_DOORS[i].rearDoor,
      'Door layout differs from retained FH88; re-audit Session paths first');
  });
  const allDoors = doors.flatMap(d => [d.frontDoor, d.rearDoor]);
  const stopMin = Math.max(-7, platform.minX + .22 - Math.min(...allDoors));
  const stopMax = Math.min(7, platform.maxX - .22 - Math.max(...allDoors));
  requireThat(stopMin < stopMax, 'Empty unchanged Session stop gate');
  const accessoryRadiusM = Math.hypot(.21, .91) * Math.sqrt(maxActorHeightM / 1.72);
  const sweptRadiusM = accessoryRadiusM + clearanceM;
  const centerMinX = Math.min(...doors.map(d => d.rearDoor)) + stopMin;
  const centerMaxX = -7.5 + frontX; // actual updateAnger cap, in station frame
  const centerMaxZ = platform.maxZ + 1.2;
  const clearWorld = {minX: centerMinX - sweptRadiusM, maxX: centerMaxX + sweptRadiusM,
    minZ: platform.minZ, maxZ: centerMaxZ + sweptRadiusM};
  const clearLocal = {minX: boardingTrackX + clearWorld.minZ, maxX: boardingTrackX + clearWorld.maxZ,
    minZ: -hallBehindStopM - clearWorld.maxX, maxZ: -hallBehindStopM - clearWorld.minX};
  const near = boardingTrackX + platform.minZ, far = boardingTrackX + boardingFarWorldZM;
  const platformFront = score.shed.front + 1.3, platformBack = score.shed.front - score.shed.length - 1.3;
  const boardingIsland = {originalCenterLocalXM: originalIslandX, nearLocalXM: near, farLocalXM: far,
    centerLocalXM: (near + far) / 2, halfWidthM: (far - near) / 2,
    frontLocalZM: platformFront, backLocalZM: platformBack,
    topLocalYM: platform.top - worldVerticalOffsetM,
    nearWorldZM: platform.minZ, farWorldZM: boardingFarWorldZM,
    copingHalfWidthM: .14, copingNearCenterLocalXM: near + .14, copingFarCenterLocalXM: far - .14,
    copingTopLocalYM: platform.top-worldVerticalOffsetM,
    copingHalfHeightM: .045, copingCenterLocalYM: platform.top-worldVerticalOffsetM-.045};
  const footingHalfWidthM = .42, columnRadiusMaxM = .34;
  const vehicleHalfWidthM = Math.max(coach.width / 2, score.tracks.assumedVehicleHalfWidth || 0);
  const railClearanceM = Math.min(...score.tracks.centers.map(x => Math.abs(x - outerSupportLocalXM)))
    - vehicleHalfWidthM - footingHalfWidthM;
  requireThat(railClearanceM >= clearanceM, 'Outer support foundation enters a track vehicle envelope');
  requireThat(score.platforms.centers.includes(outerSupportLocalXM), 'Use an existing outer support row');
  requireThat(outerSupportLocalXM - footingHalfWidthM >= clearLocal.maxX + clearanceM,
    'Outer support foundation enters passenger swept envelope');
  requireThat(transferStartLocalXM === -10 && outerSupportLocalXM === 30,
    'Transfer must span the existing -10m and 30m support rows');
  requireThat(transferDepthM >= 1.6 && transferBottomLocalYM >= 9.25,
    'Transfer truss must retain at least 1.6m depth and 9.25m underside');
  const postLocalZ = Array.from({length: score.shed.bays + 1}, (_, i) => score.shed.front - i * score.shed.bay);
  const vacatedBoardingPostLocalZ = postLocalZ.filter(z => overlaps(z - footingHalfWidthM, z + footingHalfWidthM, clearLocal.minZ, clearLocal.maxZ));
  const stationaryBoardingPostLocalZ = postLocalZ.filter(z => !vacatedBoardingPostLocalZ.includes(z));
  // Preserve every original full-detail post. Densify the quiet rear half of the
  // boarding island to a 3.75m rhythm; the boarding throat stays column-free.
  const relocatedBoardingPosts=vacatedBoardingPostLocalZ.map((from,i)=>({from,to:-81.25-i*7.5}));
  const retainedBoardingPostLocalZ=[...stationaryBoardingPostLocalZ,...relocatedBoardingPosts.map(p=>p.to)].sort((a,b)=>b-a);
  requireThat(retainedBoardingPostLocalZ.length===postLocalZ.length&&new Set(retainedBoardingPostLocalZ).size===postLocalZ.length,'Every authored boarding post must survive');
  // The original three other support rows stay in the common recipe. The outer
  // row is SHARED, not duplicated at X=13.84 inside the adjacent rolling stock.
  const supports = {boardingRowLocalXM: originalIslandX, outerRowLocalXM: outerSupportLocalXM,
    unchangedRowsLocalXM: score.platforms.centers.filter(x => x !== originalIslandX),
    retainedBoardingPostLocalZ, vacatedBoardingPostLocalZ, relocatedBoardingPosts, omittedBoardingPostLocalZ:[], columnRadiusMaxM, footingHalfWidthM,
    railClearanceM, vehicleHalfWidthM, trackCentersLocalX: score.tracks.centers.slice(),
    footingBottomLocalYM: -worldVerticalOffsetM, footingTopLocalYM: 1.25,
    transfer: {startLocalXM: transferStartLocalXM, endLocalXM: outerSupportLocalXM,
      spanM: outerSupportLocalXM - transferStartLocalXM, depthM: transferDepthM,
      bottomLocalYM: transferBottomLocalYM, topLocalYM: transferBottomLocalYM + transferDepthM,
      localZ: vacatedBoardingPostLocalZ, structuralLoadCertification: false}};
  const benchHalfLengthM = 1.7, benchHalfWidthM = .4;
  const originalBenchLocalZ = Array.from({length: 6}, (_, i) => -13.75 - i * 22.5);
  const stationaryBenchLocalZ = originalBenchLocalZ.filter(z => !overlaps(z - benchHalfLengthM - clearanceM,
    z + benchHalfLengthM + clearanceM, clearLocal.minZ, clearLocal.maxZ));
  const relocatedBenches=originalBenchLocalZ.filter(z=>!stationaryBenchLocalZ.includes(z)).map((from,i)=>({from,to:-88.75-i*22.5}));
  // The complete restored stair replaces empty R04 space. Preserve this bench's
  // identity/wood stock while moving it to the audited vacant inter-column bay.
  if(score.bridge?.boardingBenchRelocation){const move=score.bridge.boardingBenchRelocation,r=relocatedBenches.find(b=>b.from===move.sourceLocalZ);requireThat(r&&r.to===move.previousLocalZ,'Changed bench history requires footbridge clearance audit');r.to=move.to;}
  const benchPlacements=[...stationaryBenchLocalZ.map(z=>({from:z,to:z})),...relocatedBenches].sort((a,b)=>b.to-a.to);
  const retainedBenchLocalZ=benchPlacements.map(p=>p.to);
  const benchRowX=8.8; // Preserve all six benches beside, not through, the rear post row.
  const benches = {boardingRowLocalXM: benchRowX, sourceRowLocalXM:originalIslandX, halfLengthM: benchHalfLengthM,
    halfWidthM: benchHalfWidthM, retainedLocalZ: retainedBenchLocalZ,
    omittedLocalZ:[],relocated:relocatedBenches,sourceLocalZ:benchPlacements.map(p=>p.from),
    otherIslandRowsUnchanged: true};
  requireThat(benchRowX - benchHalfWidthM >= near && benchRowX + benchHalfWidthM <= far,
    'Retained benches extend outside the narrowed boarding island');

  // The unchanged actor linearly interpolates these heights. Ordinary flat
  // stairs alone cannot support that trajectory without penetration/floating.
  // Use the piecewise planar surface inside each exit strip; legacy flat treads
  // are reference dimensions only, not additional solids in the walking strip.
  const profile = [
    [platform.maxZ, platform.top], [platform.maxZ + .15, platform.top],
    [platform.maxZ + .43, platform.top * .7], [platform.maxZ + .71, platform.top * .4],
    [platform.maxZ + 1, .14], [platform.maxZ + 1.2 + sweptRadiusM, .14],
  ].map(([worldZ, worldY]) => ({worldZ, worldY, localX: boardingTrackX + worldZ,
    localY: worldY - worldVerticalOffsetM}));
  const exits = doors.map((d, coachIndex) => {
    const centerMin = d.rearDoor + 1.1 + stopMin, centerMax = d.rearDoor + 1.1 + stopMax;
    const worldMinX = centerMin - sweptRadiusM, worldMaxX = centerMax + sweptRadiusM;
    const localMinZ = -hallBehindStopM - worldMaxX, localMaxZ = -hallBehindStopM - worldMinX;
    const referenceTreads = [platform.top, platform.top * .7, platform.top * .4, .14].map((top, j) => ({
      centerWorldX: (worldMinX + worldMaxX) / 2, widthM: worldMaxX - worldMinX,
      centerWorldZ: platform.maxZ + .15 + j * .28, topWorldYM: top, depthM: .32,
      centerLocalZ: (localMinZ + localMaxZ) / 2, halfLengthM: (localMaxZ - localMinZ) / 2,
      centerLocalX: boardingTrackX + platform.maxZ + .15 + j * .28,
      topLocalYM: top - worldVerticalOffsetM,
      renderInsideWalkingStrip: false,
    }));
    return {coachIndex, worldMinX, worldMaxX, localMinZ, localMaxZ,
      finalApronWorldMaxX: worldMaxX + 2.2, finalApronLocalMinZ: localMinZ - 2.2,
      groundOverride: {requiresTerrainReconciliation:true, localMinX:boardingTrackX+platform.maxZ,
        localMaxX:profile.at(-1).localX, localMinZ:localMinZ-2.2, localMaxZ,
        topLocalYM:.14-worldVerticalOffsetM,
        rule:'If retained terrain is above this surface, replace/cut only this domain before union; terrain height is not attested here'},
      referenceTreads, profile};
  });
  const minimumExitX = Math.min(...exits.map(e => e.worldMinX));
  requireThat(-platformFront - hallBehindStopM <= Math.min(clearWorld.minX, minimumExitX)
    && -platformBack - hallBehindStopM >= clearWorld.maxX, 'Longitudinal platform misses path sweep');
  const result = {schema: 'kaopu.fh88.host-construction/1', units: 'metres',
    validationScope: 'CPU recipe/path contract only; rendered geometry and GPU consumption are unverified',
    gpuVerified: false, coordinateFrame: 'station local; host stationary X=-hallBehindStopM-localZ, Z=localX-boardingTrackX',
    transform: {hallBehindStopM, boardingTrackX, worldVerticalOffsetM},
    stopOffsetsM: {min: stopMin, max: stopMax}, boardingIsland, supports, benches, exits,
    passengerClearance: {maxActorHeightM, accessoryRadiusM, sweptRadiusM, clearanceM,
      centerMinX, centerMaxX, centerMaxZ, world: clearWorld, local: clearLocal,
      verticalClearTopLocalYM: platform.top + maxActorHeightM + .3 - worldVerticalOffsetM},
  };
  validateHostConstruction(result);
  return freeze(result);
}

export function validateHostConstruction(c) {
  requireThat(c?.schema === 'kaopu.fh88.host-construction/1', 'Unknown construction contract');
  const q = c.passengerClearance.local, s = c.supports, b = c.benches;
  const checkNumbers = x => { for(const v of Object.values(x)){if(typeof v==='number')finite(v,'construction value');else if(v&&typeof v==='object')checkNumbers(v);} };checkNumbers(c);
  requireThat(c.boardingIsland.farWorldZM === 6.15 && c.boardingIsland.nearWorldZM === 1.5897,
    'Host boarding edge or unchanged exit datum changed');
  requireThat(s.transfer.bottomLocalYM > c.passengerClearance.verticalClearTopLocalYM,
    'Transfer truss enters passenger head/accessory envelope');
  requireThat(s.transfer.depthM>=1.6 && s.transfer.bottomLocalYM>=9.25 && s.transfer.spanM===40,
    'Transfer truss lacks the required geometric envelope');
  requireThat(s.outerRowLocalXM-s.footingHalfWidthM>=q.maxX+c.passengerClearance.clearanceM,
    'Outer foundation enters passenger clearance');
  for(const x of s.trackCentersLocalX)requireThat(Math.abs(x-s.outerRowLocalXM)-s.footingHalfWidthM-s.vehicleHalfWidthM>=c.passengerClearance.clearanceM,
    'Outer foundation enters track vehicle clearance');
  for (const z of s.retainedBoardingPostLocalZ) requireThat(!overlaps(z - s.footingHalfWidthM,
    z + s.footingHalfWidthM, q.minZ, q.maxZ), 'Retained boarding post enters swept passenger corridor');
  requireThat(Math.abs(b.boardingRowLocalXM-s.boardingRowLocalXM)-b.halfWidthM-s.footingHalfWidthM>=c.passengerClearance.clearanceM,'Retained bench intersects a support footing');
  for (const z of b.retainedLocalZ) requireThat(!overlaps(z - b.halfLengthM - c.passengerClearance.clearanceM,
    z + b.halfLengthM + c.passengerClearance.clearanceM, q.minZ, q.maxZ), 'Retained bench enters swept passenger corridor');
  return true;
}

// Exact centerline support elevation. Each segment is a planar function, not
// a texture/baked surface. Callers build bounded ramp/landing solids from this
// same profile. Below-deck stair faces elsewhere may keep discrete treads.
export function exitSupportWorldHeight(construction, worldZ) {
  finite(worldZ, 'exit world Z');
  const p = construction.exits[0].profile;
  if (worldZ < p[0].worldZ || worldZ > p.at(-1).worldZ) return null;
  for (let i = 1; i < p.length; i++) if (worldZ <= p[i].worldZ) {
    const a = p[i - 1], b = p[i], u = (worldZ - a.worldZ) / (b.worldZ - a.worldZ);
    return a.worldY + (b.worldY - a.worldY) * u;
  }
  return p.at(-1).worldY;
}

export function hostConstructionWGSL(c) {
  validateHostConstruction(c);
  const f = n => { finite(n, 'WGSL constant'); return Number.isInteger(n) ? n + '.' : String(n); };
  const scalar = (name, n) => `const HOST_${name}:f32=${f(n)};`;
  const array = (name, values) => `const HOST_${name}:array<f32,${values.length}> = array<f32,${values.length}>(${values.map(f).join(',')});`;
  const b = c.boardingIsland, s = c.supports, q = c.passengerClearance.local;
  return ['// CPU contract constants only. The station field generator must consume them.',
    ...Object.entries({ISLAND_NEAR_X:b.nearLocalXM,ISLAND_FAR_X:b.farLocalXM,ISLAND_CENTER_X:b.centerLocalXM,
      ISLAND_HALF_WIDTH:b.halfWidthM,ISLAND_TOP_Y:b.topLocalYM,BOARDING_ROW_X:s.boardingRowLocalXM,
      BENCH_ROW_X:c.benches.boardingRowLocalXM,
      COPING_TOP_Y:b.copingTopLocalYM,COPING_CENTER_Y:b.copingCenterLocalYM,COPING_HALF_HEIGHT:b.copingHalfHeightM,
      COPING_NEAR_X:b.copingNearCenterLocalXM,COPING_FAR_X:b.copingFarCenterLocalXM,
      OUTER_SUPPORT_X:s.outerRowLocalXM,FOUNDATION_HALF:s.footingHalfWidthM,
      FOUNDATION_BOTTOM_Y:s.footingBottomLocalYM,FOUNDATION_TOP_Y:s.footingTopLocalYM,
      TRUSS_START_X:s.transfer.startLocalXM,TRUSS_END_X:s.transfer.endLocalXM,
      TRUSS_BOTTOM_Y:s.transfer.bottomLocalYM,TRUSS_DEPTH:s.transfer.depthM,
      CLEAR_MIN_X:q.minX,CLEAR_MAX_X:q.maxX,CLEAR_MIN_Z:q.minZ,CLEAR_MAX_Z:q.maxZ,
      EXIT_GROUND_Y:c.exits[0].groundOverride.topLocalYM,
    }).map(([name,n]) => scalar(name,n)),
    array('VACATED_POST_Z',s.vacatedBoardingPostLocalZ), array('RETAINED_POST_Z',s.retainedBoardingPostLocalZ),
    array('RETAINED_BENCH_Z',c.benches.retainedLocalZ),array('BENCH_SOURCE_Z',c.benches.sourceLocalZ),
    array('EXIT_MIN_Z',c.exits.map(e=>e.localMinZ)), array('EXIT_MAX_Z',c.exits.map(e=>e.localMaxZ)),
    array('EXIT_APRON_MIN_Z',c.exits.map(e=>e.finalApronLocalMinZ)),
    array('EXIT_PROFILE_X',c.exits[0].profile.map(p=>p.localX)),
    array('EXIT_PROFILE_Y',c.exits[0].profile.map(p=>p.localY)),
  ].join('\n') + '\n';
}
