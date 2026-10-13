import portraits from './PortraitPresets.json';
import{createPresetState}from'../full/ui/PresetCatalogueR2.mjs';
import{defaultState}from'../full/src/State.mjs';
export const portraitId=()=>{const id=new URLSearchParams(location.hash.slice(1)).get('portrait');return portraits.some(p=>p.id===id)?id:'P01';};
export function firstState(){const state=createPresetState('r02-adult-male-sturdy',defaultState()),p=portraits.find(p=>p.id===portraitId());state.gnm.identity=p.identity.slice();state.gnm.expression.fill(0);state.owners.headShape='gnm';state.owners.expression='anny';state.headShapeComposition='shared-layers/1';state.anny.facialActions={};return state;}
export function portraitFinish(model,id){Object.assign(model.foldProfile.settings,{strength:.10,slack:.12,forehead:.05,eyes:.08,gray:false});Object.assign(model.regionalFace.settings,{zygoma:.16,malar:.18,buccal:.12,masseter:.14,jaw:.12,temple:.10,brow:.12,vault:.08,diagnostic:0,oil:.25});model.eyeSurface.settings.gray=false;model.eyeSurface.settings.grid=false;model.naturalEyes.preset({P01:'darkBrown',P02:'darkBrown',P03:'lightBrown',P04:'slate',P05:'olive',P06:'harveyHazel'}[id]||'darkBrown');}
