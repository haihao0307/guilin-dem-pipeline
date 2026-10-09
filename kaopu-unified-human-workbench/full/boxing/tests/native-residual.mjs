/** Read-only diagnostic: the deployed Float32 GPU-packet skinning equation is
 * replayed by AnimatedHuman.sampleVertex, then compared with full native pose
 * reevaluation. This is not framebuffer readback or a native-corrective claim. */
import fs from 'node:fs';
import {loadLocal} from './load-model.mjs';
import {PRESETS,createPresetState} from '../../ui/PresetCatalogueR2.mjs';
import {AnimatedHuman} from '../AnimatedHuman.mjs';
import {createBoxingRig,sampleBoxingPair,BOXING_VARIANTS} from '../Motion.mjs';
const {model,defaultState}=await loadLocal();
const ids=[0,5,18,19,21,23],rows=[];
const accepted=JSON.parse(fs.readFileSync(new URL('../../research/characters-r02/ACCEPTED-STATES.json',import.meta.url))).states,heightMap=new Map(accepted.map(s=>[s.id,s.measurements.heightCM/100]));
function summarize(errors,indices){const values=indices.map(i=>errors[i]).sort((a,b)=>a-b),n=values.length;let sum=0;for(const x of values)sum+=x*x;return{vertices:n,maxMM:n?values.at(-1)*1000:0,rmsMM:n?Math.sqrt(sum/n)*1000:0,p95MM:n?values[Math.min(n-1,Math.floor(n*.95))]*1000:0};}
for(const index of ids){
 const preset=PRESETS[index],state=createPresetState(preset.id,defaultState);model.compute(state);const originalNeutral=model.positions.slice();state.owners.headRig='body';model.compute(state);
 let ownershipNeutralMax=0;for(let i=0;i<originalNeutral.length;i++)ownershipNeutralMax=Math.max(ownershipNeutralMax,Math.abs(originalNeutral[i]-model.positions[i]));
 const human=new AnimatedHuman(model,state),child=['child','teen'].includes(preset.stage),rig=createBoxingRig({names:human.names,parents:human.rig.parents,restMatrices:human.rig.restMatrices,stature:human.height,child}),pairIndex=Math.floor(index/2),fighter=index%2,opponentStature=heightMap.get(PRESETS[index^1].id);
 const neckSet=new Set([...model.neckSurface.indices,...model.neckSurface.boundary,...model.canonical.neckFairing.band.map(r=>r.index),...(model.canonical.neckContour?.headRing||[]),...(model.canonical.neckContour?.headLinks||[]).map(r=>model.bodyCount+r[0])]);
 const regions={all:Array.from({length:human.N},(_,i)=>i),bodyExterior:[],headExterior:[],neckTransition:[...neckSet],shoulders:[]};
 for(let v=0;v<human.N;v++){if(!neckSet.has(v))regions[v<model.bodyCount?'bodyExterior':'headExterior'].push(v);let shoulder=0;for(let n=0;n<human.range[v*2+1];n++){const k=(human.range[v*2]+n)*8,j=human.packed[k+3];if(/clavicle|shoulder|upperarm01/.test(human.names[j]))shoulder+=human.packed[k+4];}if(shoulder>.4)regions.shoulders.push(v);}
 const events=BOXING_VARIANTS[pairIndex%3].events,s0=sampleBoxingPair(0,pairIndex,{child}),cycleTimes=[0,...events.map(e=>e.start+.43*(e.end-e.start))];
 for(const cycleTime of cycleTimes){const seconds=(((cycleTime-s0.phaseOffset)%12+12)%12)/s0.speed,out=rig.evaluate(seconds,{pairIndex,fighter,child,opponentStature,poseOutput:true});human.animate(out.skinMatrices);const nativeState=structuredClone(state);nativeState.anny.pose={};nativeState.anny.translations={};for(const [name,value]of Object.entries(out.pose)){nativeState.anny.pose[name]=value.rotation.slice();if(value.translation)nativeState.anny.translations[name]=value.translation.slice();}
  model.compute(nativeState);const errors=new Float64Array(human.N);let worst=0;for(let v=0;v<human.N;v++){const gpu=human.sampleVertex(v),k=v*3;errors[v]=Math.hypot(gpu[0]-model.positions[k],gpu[1]-model.positions[k+1],gpu[2]-model.positions[k+2]);if(errors[v]>errors[worst])worst=v;}
  const row={id:preset.id,pairIndex,fighter,cycleTime,phase:out.state.phase,rootTranslation:Array.from(out.rootTranslation),ownershipNeutralMaxMM:ownershipNeutralMax*1000,regions:Object.fromEntries(Object.entries(regions).map(([name,indices])=>[name,summarize(errors,indices)])),worst:{vertex:worst,inNeckTransition:neckSet.has(worst),position:Array.from(model.positions.slice(worst*3,worst*3+3)),errorMM:errors[worst]*1000},nativeNeckMetrics:{contourMM:model.neckContourMaxMM,fairingMM:model.neckFairingMaxMM,surfaceMM:model.neckSurface.maxDisplacementMM}};
  rows.push(row);console.log(preset.id,cycleTime.toFixed(3),row.phase,'maxMM',row.regions.all.maxMM.toFixed(3),'rmsMM',row.regions.all.rmsMM.toFixed(3),'neckMM',row.regions.neckTransition.maxMM.toFixed(3));
 }
 human.dispose();
}
const summary={schema:'boxing-r01-frozen-neutral-versus-native-reevaluation/1',generatedAt:new Date().toISOString(),cases:ids.length,poses:rows.length,method:'CPU replay of the deployed Float32 shader texture/CSR skinning equation via AnimatedHuman.sampleVertex versus CommonPerson.compute with exported native Anny local-ref rotvecs, root translation and owners.headRig=body. Not GPU framebuffer readback.',boundary:'The deployed animation transports the neutral corrected neck. Native reevaluation repeats shape, semantic head and neck contour/fairing/surface computations per pose. Differences are measured, not hidden or represented as equivalent native dynamic correctives.',maxMM:Math.max(...rows.map(r=>r.regions.all.maxMM)),maxRMSMM:Math.max(...rows.map(r=>r.regions.all.rmsMM)),maxNeckMM:Math.max(...rows.map(r=>r.regions.neckTransition.maxMM)),maxExteriorBodyMM:Math.max(...rows.map(r=>r.regions.bodyExterior.maxMM)),maxExteriorHeadMM:Math.max(...rows.map(r=>r.regions.headExterior.maxMM)),rows};
fs.writeFileSync(new URL('../../research/boxing-r01/NATIVE-POSE-RESIDUAL.json',import.meta.url),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({...summary,rows:undefined},null,2));process.exit(0);
