import {DEFAULTS,validate} from './FoldMath.mjs';
export function installFoldProfile(model){
 if(model.foldProfile)return model.foldProfile;
 const api={schema:'kaopu/geometric-skin-folds@2',settings:{...DEFAULTS}},archive=model.archive.bind(model),restore=model.restore.bind(model);
 model.archive=()=>({...archive(),geometricSkinFolds:{schema:api.schema,settings:{...api.settings}}});
 model.restore=input=>{const p=input?.geometricSkinFolds;if(p&&p.schema!==api.schema&&p.schema!=='kaopu/geometric-skin-folds@1')throw Error('Unsupported fold profile');const next=validate(p?.settings||{}),old=api.settings;api.settings=next;try{const value=restore(input);api.onRestore?.();return value;}catch(e){api.settings=old;throw e;}};
 model.foldProfile=api;return api;
}
