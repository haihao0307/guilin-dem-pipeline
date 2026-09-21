// V0172 visual-readability instrumentation. This does not alter the fishing result or add aim assist.
function pilotObservationVisualMetrics(){
 const o=SURVIVAL.observation,eye=[o.anchorX,o.bobY-.055,o.anchorZ],focalPx=Math.max(1,innerHeight)/(2*Math.tan(camera.fov*.5));
 const focusWater=waveAt(o.focusX,o.focusZ,physicalTime,config).eta,focus=[o.focusX,focusWater-.72,o.focusZ];
 const targetRangeM=Math.hypot(focus[0]-eye[0],focus[1]-eye[1],focus[2]-eye[2]);
 const cameraFocusXZErrorM=Math.hypot(camera.target[0]-focus[0],camera.target[2]-focus[2]);
 const n=SURVIVAL.fish.length,candidate=n?SURVIVAL.fish[((SURVIVAL.fishing.candidate%n)+n)%n]:null;
 let candidateFishLengthPx=0;
 if(candidate){const d=Math.max(.15,Math.hypot(candidate.x-eye[0],candidate.y-eye[1],candidate.z-eye[2]));candidateFishLengthPx=.68*candidate.size/d*focalPx}
 let baitDiameterPx=0,baitRangeM=0;
 if(FISH.target){const b=pilotBaitPoint();baitRangeM=Math.max(.15,Math.hypot(b[0]-eye[0],b[1]-eye[1],b[2]-eye[2]));baitDiameterPx=.18/baitRangeM*focalPx}
 return{targetRangeM,cameraFocusXZErrorM,candidateFishLengthPx,baitDiameterPx,baitRangeM,solidLensCount:0,lensFrame:'thin-screen-space',visibleFishCount:SURVIVAL.telemetry.visibleFishCount};
}
function installPilotObservationVisual(){
 SURVIVAL.telemetry.surfaceGearSolidLensCount=0;
 SURVIVAL.telemetry.lensFrame='thin-screen-space';
 SURVIVAL.telemetry.observationVisualCandidate=true;
 window.PalauExperience.observationVisualMetrics=pilotObservationVisualMetrics;
 qa.observationVisualV0172=true;
}
