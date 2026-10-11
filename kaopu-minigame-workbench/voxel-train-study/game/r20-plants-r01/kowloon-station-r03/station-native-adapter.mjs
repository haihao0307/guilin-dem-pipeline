import{decode,encode,verifyDependencyBytes,formatInfo}from'./native-codec/codec.mjs';
import{buildWholeStation,DEFAULT_STATION_RUNTIME_SCORE}from'./station-build.mjs';
export const saveStationNative=score=>encode(score??DEFAULT_STATION_RUNTIME_SCORE);
export async function loadStationNative(bytes,{THREE,dependencyBytes,renderer}={}){await verifyDependencyBytes(dependencyBytes);const score=await decode(bytes);if(!renderer?.getContext)throw Error('HOST_WEBGL2_REQUIRED_FOR_ORIGINAL_MOTHER_SAMPLING');return buildWholeStation(THREE,score,{renderer});}
export async function replaceStationNative(bytes,{THREE,dependencyBytes,parent,current,renderer}={}){const next=await loadStationNative(bytes,{THREE,dependencyBytes,renderer});try{parent.add(next.root);}catch(e){next.dispose();throw e;}if(current)current.dispose();return next;}
export const nativeInfo=Object.freeze({...formatInfo,images:0,externalMeshes:0,restore:'regenerate from validated score + exact trusted source pins',hostSceneReplacement:'caller-controlled off-scene build then atomic swap'});
