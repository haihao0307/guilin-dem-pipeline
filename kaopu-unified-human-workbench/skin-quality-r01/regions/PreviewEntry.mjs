// Rebuild the existing ET13 application with one opt-in regional extension.
// All imports share its native Three runtime; no replacement scene or renderer.
import '../../full/ui/identity-app.generated.mjs';
import {attachSkinSampling,installSkinSamplingBridge} from '../SkinSampling.mjs';
import {installRegionalSkin,attachRegionalSkin,mountRegionalControls} from './RegionalSkin.mjs';
const ready=(async()=>{
 const start=performance.now();while(!window.__IDENTITY_QA__?.viewer()||!window.fullCommonWorkbench?.diagnostics().ready||window.fullCommonWorkbench.diagnostics().busy){if(performance.now()-start>240000)throw Error('Native ET13 initialization timed out');await new Promise(r=>setTimeout(r,50));}
 await window.fullFaceTransfer.ready();const model=__IDENTITY_QA__.model(),viewer=__IDENTITY_QA__.viewer();
 await attachSkinSampling(viewer.skin);installSkinSamplingBridge(model);const api=installRegionalSkin(model);attachRegionalSkin(viewer.skin,api);mountRegionalControls(api);
 window.regionalWorkbench={ready:()=>ready,set:api.set,report:api.report,inspect:api.inspect,view(which){if(which==='eyes')model.eyeSurface.viewEyes();else if(which==='face')viewer.view('face');else model.faceSurface.featureView(which);}};
 viewer.view('face');return api.report();
})();
window.__REGIONAL_PREVIEW_READY__=ready;
ready.catch(error=>{const node=document.createElement('p');node.textContent='区域材质候选未载入：'+error.message;node.style.cssText='padding:16px;background:#692f2f;color:white';document.body.prepend(node);console.error(error);});
