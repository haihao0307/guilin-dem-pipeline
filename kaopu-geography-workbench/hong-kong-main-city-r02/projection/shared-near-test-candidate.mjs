// TEST ONLY. Does not change patch-plan's .15 near, a source file, a live host, or a CI job.
import {PROJECTION} from './patch-plan.mjs';
export const TEST_NEAR_VALUES=Object.freeze([0.15,10,100]);
export const REQUIRED_CLIP_PARTICIPANTS=Object.freeze(['r03Ocean','r03TerrainAndRoutes','r03Vegetation','r03Stations','threeMainCamera','airport','cityBuildings','outerTerrain','cityCulling','outerCulling']);
export function makeSharedTestProjection(near){if(!TEST_NEAR_VALUES.includes(near))throw Error('Unreviewed test near plane');return Object.freeze({...PROJECTION,near});}
// Illustrative threshold for tests only. Follow/platform/train/close views retain .15.
// A real integration needs one immutable per-frame clip snapshot, including both cullers,
// before ANY world draw; never update Three first and leave raw shaders on the old near.
export function chooseSharedNearTestCandidate({mode,distance,overviewNear=100}){
 if(!Number.isFinite(distance)||distance<=0)throw Error('Invalid test camera distance');
 return makeSharedTestProjection(mode==='map'&&distance>=30000?overviewNear:0.15);
}
export function assertClipParticipantsSynchronized(participants,expected){
 for(const key of REQUIRED_CLIP_PARTICIPANTS){const actual=participants[key];if(!actual||actual.near!==expected.near||actual.far!==expected.far)throw Error('Unsynchronized clip participant: '+key);}
 return true;
}
export function float32DepthDiagnostic(viewDepthM,{near,far}=PROJECTION){
 const z=Math.fround(viewDepthM),A=Math.fround((far+near)/(far-near)),B=Math.fround(2*far*near/(far-near)),clipZ=Math.fround(Math.fround(A*z)-B),depth=clipZ/z*.5+.5,d24=Math.round(depth*(2**24-1));
 return {viewDepthM,z,clipZ,windowDepth:depth,emulatedD24:d24,atOrBeyondClearDepth:d24>=2**24-1,warningOnlyNotGPUEvidence:true};
}
