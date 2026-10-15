// Next-version runtime helper. No production file is modified by importing this module.
import {PROJECTION} from './patch-plan.mjs';
export function projectionForFrame({mode='map',distance}){
 if(!Number.isFinite(distance)||distance<=0)throw Error('Shared projection requires finite positive mapState.distance');
 return Object.freeze({clipNear:mode==='map'?Math.max(.15,Math.min(3000,distance*.02)):.15,clipFar:150000,clipMode:mode});
}
export function frame(camera,context){
 for(const key of['cam','fw','right','up'])if(!Array.isArray(camera?.[key])||camera[key].length!==3||!camera[key].every(Number.isFinite))throw Error('Invalid shared camera '+key);
 const clip=projectionForFrame(context);return Object.freeze({...camera,...clip,near:clip.clipNear,far:clip.clipFar,fov:PROJECTION.fov});
}
export function installSharedProjection(target=globalThis){
 if(target.HKSharedProjection&&target.HKSharedProjection.schema!=='hk-shared-projection/1')throw Error('Existing shared projection contract conflicts');
 const api=Object.freeze({schema:'hk-shared-projection/1',frame,projectionForFrame});target.HKSharedProjection=api;return api;
}
