// Pure SI/state adapter. No renderer, timer, scene mesh or state mutation.
export const HOST_BASELINE=Object.freeze({release:'2eacc2f45637ad1063efebec40087b2fb795f857',path:'kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01',threeRevision:'170',appGitBlob:'c02b3690b2f619d9f791b34e3d7f28e68a3f030d',stationIndex:0});
const finite=(n,label)=>{if(!Number.isFinite(n))throw Error('Nonfinite '+label);return n;};
const vec=(p,label)=>{if(!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite))throw Error('Invalid '+label);return p;};
export function createStationBinding({score,track,platform,coach,frontX=5,hallBehindStopM=75,boardingTrackX=5}={}){
 if(score?.units!=='metres')throw Error('Station must remain SI metres');
 if(!score.tracks.centers.includes(boardingTrackX))throw Error('Boarding track missing from the common recipe');
 if(Math.abs(track.gauge-score.tracks.gauge)>1e-9)throw Error('Track gauges differ; cannot scale the railway');
 const deckLocal=.85,shiftY=platform.top-deckLocal,railLocal=track.railHead-shiftY;
 const platformCenter=score.platforms.centers.find(x=>x>boardingTrackX),halfWidth=platformCenter-boardingTrackX-platform.minZ;
 if(!(halfWidth>0)||halfWidth>=5)throw Error('Invalid functional platform envelope');
 const construction=Object.freeze({stationDeckTopM:deckLocal,worldVerticalOffsetM:shiftY,railTopLocalM:railLocal,railCenterOffsetM:track.railCenterZ,railHeadWidthM:track.headWidth,platformHalfWidthM:halfWidth,copingHalfWidthM:.18,copingCenterOffsetM:halfWidth-.18,boardingGapM:platform.minZ-coach.width/2,uniformScale:1});
 function frame(view,route){
  finite(view.distance,'distance');finite(view.elapsed,'elapsed');finite(view.tick,'tick');const plan=route.find(s=>s.index===HOST_BASELINE.stationIndex);
  if(!plan)throw Error('Kowloon station is absent from this route');
  const origin=[plan.target-view.distance-hallBehindStopM,shiftY,-boardingTrackX];
  const toWorld=p=>{vec(p,'station point');return[origin[0]-p[2],origin[1]+p[1],origin[2]+p[0]];};
  const toLocal=p=>{vec(p,'world point');return[p[2]-origin[2],p[1]-origin[1],origin[0]-p[0]];};
  const worldDirectionToLocal=d=>{vec(d,'world direction');return[d[2],d[1],-d[0]];};
  const localDirectionToWorld=d=>{vec(d,'station direction');return[-d[2],d[1],d[0]];};
  const record=Object.freeze({tick:view.tick,simulationSeconds:view.elapsed,timetableMinutes:finite(view.timetable?.minutes??380,'timetable'),paused:!!view.paused,stationTargetM:plan.target,distanceM:view.distance,origin:Object.freeze(origin),wet:!!plan.wet,materialAge:score.fabric.age,construction});
  return{record,toWorld,toLocal,worldDirectionToLocal,localDirectionToWorld};
 }
 function validateCoverage(){
  const platformBack=score.shed.front-score.shed.length-1.3,platformFront=score.shed.front+1.3;
  const worldMin=-platformFront-hallBehindStopM,worldMax=-platformBack-hallBehindStopM;
  if(worldMin>platform.minX||worldMax<platform.maxX)throw Error('New platform fails original door-coverage envelope');
  return{worldMin,worldMax,originalMin:platform.minX,originalMax:platform.maxX,frontX,boardingTrackX,platformCenter,construction};
 }
 validateCoverage();return Object.freeze({frame,construction,validateCoverage});
}
export function stationClockHands(minutes){finite(minutes,'clock minutes');const minute=((minutes%60)+60)%60,hour=((minutes/60%12)+12)%12;return {minuteAngle:Math.PI/2-minute*Math.PI/30,hourAngle:Math.PI/2-hour*Math.PI/6};}
export function requireSharedFrame({camera,frame,light,backend}){
 if(!camera?.projectionMatrix?.elements||!camera?.matrixWorld?.elements)throw Error('Actual host camera matrices required');
 if(camera.projectionMatrix.elements.length!==16||camera.matrixWorld.elements.length!==16)throw Error('Invalid camera matrices');
 if(!frame?.record||!light?.direction?.every(Number.isFinite))throw Error('Authoritative host state/light required');
 if(backend!=='webgl2-function')throw Error('This bridge targets WebGL2 functions, not the independent WebGPU preview');
 return Object.freeze({backend,projection:Array.from(camera.projectionMatrix.elements),cameraToWorld:Array.from(camera.matrixWorld.elements),state:frame.record,light:{...light,direction:light.direction.slice()},depthConvention:'OpenGL NDC [-1,1], window depth=ndc.z*.5+.5',appearanceTextures:0,stationSurfaceMeshes:0,source:'same station recipe and material functions; backend equivalence pending'});
}
