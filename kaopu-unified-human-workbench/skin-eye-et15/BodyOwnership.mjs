import {createProfile} from './ProfileLibrary.mjs';
import {NATIVE_FEATURES} from '../identity-lab/Catalogue.mjs';
import {defaultState} from '../full/src/State.mjs';
// Native Anny face bases contain tiny nonzero body residuals. Evaluate this
// character's BODY with the original values for newly-owned face keys; preserve
// full original state for HEAD evaluation and archives. No vertex freezing,
// bone scaling, replacement skinning, or neck cutting is involved.
export function installBodyOwnership(model,api){
 const driver=model.bodyDriver;if(!driver)return;const original=driver.evaluate.bind(driver),cache=new Map(),rows=new Map(NATIVE_FEATURES.map(r=>[r.id,r]));
 const profile=id=>{if(!cache.has(id)){const p=createProfile(id,defaultState());cache.set(id,{base:p.baseState.anny.localChanges,keys:p.nativeFaceFields.flatMap(id=>rows.get(id).keys)});}return cache.get(id);};
 const status={version:'et15/face-body-ownership@1',active:false,keys:[],nativeNeckRepairRetained:true};
 const evaluate=(state,options)=>{
  // Shared driver users in other motion actors keep their own unchanged inputs.
  if(state!==model.effectiveState)return original(state,options);
  const id=api.cast?.id;if(!id){status.active=false;status.keys=[];return original(state,options);}
  const p=profile(id),localChanges={...state.anny.localChanges};
  for(const key of p.keys){if(Object.hasOwn(p.base,key))localChanges[key]=p.base[key];else delete localChanges[key];}
  status.active=true;status.keys=p.keys.slice();status.castId=id;
  const result=original({...state,anny:{...state.anny,localChanges}},options);
  return {...result,et15FaceOwnership:{castId:id,isolatedKeys:p.keys.slice(),bodyPhenotypesUnchanged:true,bodyPoseUnchanged:true}};
 };
 driver.evaluate=evaluate;api.bodyOwnership={report:()=>({...status,keys:status.keys.slice()}),dispose(){if(driver.evaluate===evaluate)driver.evaluate=original;cache.clear();}};
}
