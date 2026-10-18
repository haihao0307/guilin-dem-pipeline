import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const project=new URL('../../',import.meta.url),report=JSON.parse(fs.readFileSync(new URL('a6-valve-gear-experiment-r01/docs/FINITE_VALVE_SWEEP_LATEST.json',project),'utf8')),s=report.sweep;
// The experiment report generator preserves failed evidence. This candidate
// gate rejects failed full-scope results after they have been saved.
assert.equal(s.sampledSurfaceWitnessCount,0,'New finite surface collision');
assert.deepEqual(report.sourceFilesChangedDuringRun,[],'Sweep dependencies changed during run');
for(const [path,sha] of Object.entries(report.sourceHashes))assert.equal(createHash('sha256').update(fs.readFileSync(new URL(path,project))).digest('hex'),sha,`Stale sweep ${path}`);
for(const name of ['a6-motion.mjs','a6-motion-corrections.mjs','a6-locomotive-shell.mjs'])assert.equal(createHash('sha256').update(fs.readFileSync(new URL('a6-native-r03/src/'+name,project))).digest('hex'),report.sourceHashes['a6-native-r02/src/'+name],`R03 runtime diverges from swept dependency ${name}`);
assert.equal(s.previousExperimentMovingWitnessPairChecks.length,2);
assert.equal(s.intervalDegrees,1);assert.equal(s.intervals,360);
assert.equal(s.defaultShellIncluded,true);assert.equal(s.defaultShellBodyCount,94);assert.equal(s.inheritedComponents,338);
assert.equal(s.originalSixPairChecks.length,6);
for(const pair of [...s.originalSixPairChecks,...s.previousExperimentMovingWitnessPairChecks]){assert(pair.continuousLateralSeparationPass);assert(pair.minimumContinuousLateralGapM>0);}
assert.equal(s.continuousTriangleNarrowPhaseComplete,false);
assert.equal(s.fullVehicleApproval,false);
assert(s.unresolvedNoWitnessCandidateCount>0,'Do not silently relabel conservative candidates as cleared');
console.log(JSON.stringify({status:'PASS',sampledSurfaceWitnesses:s.sampledSurfaceWitnessCount,continuousCandidatesUnresolved:s.unresolvedNoWitnessCandidateCount,scope:'Full-scope candidate regression gate; not continuous triangle or engineering approval'}));
