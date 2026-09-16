import * as THREE from 'three';
import {installOverlayTransformContract} from './overlay-transform-contract.js';
import {installEyeLookContract} from './eye-look-contract.js';
import {installSoilPairLoader} from './soil-pair-loader.js';
import {installEvidenceGzipLoader} from './evidence-gzip-loader.js';
import {installReadingControls} from './reading-controls.js';
import {installSoilContext} from './soil-context.js';
import {installEnvironmentContext} from './environment-context.js';
import {installWorldScore} from './world-score.js';
installOverlayTransformContract(THREE);
installEyeLookContract();
installSoilPairLoader();
installEvidenceGzipLoader();
installReadingControls();
THREE.Object3D.prototype[Symbol.for('wenzhou.r3.3.surface-evidence-installed')]=true;
installSoilContext();installEnvironmentContext();installWorldScore();
await import('../r3-6/bootstrap.js');
if(window.__WENZHOU_HISTORY_1942===true){
  const canvas=document.getElementById('terrain');
  const started=performance.now();
  while(canvas&&(canvas.dataset.ready!=='true'||!canvas.dataset.osmPatch)){
    if(performance.now()-started>45000)throw Error('1953 历史控制层等待基础地图稳定超时');
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  const {installHistorical1953ControlLayer}=await import('./history-1953-control-layer.js');
  const {installHistorical1940sRefine}=await import('./history-1940s-refine.js');
  installHistorical1953ControlLayer();
  installHistorical1940sRefine();
  await new Promise(resolve=>requestAnimationFrame(resolve));
  const location=document.getElementById('location');
  if(location)location.dispatchEvent(new Event('change',{bubbles:true}));
}
document.documentElement.dataset.wenzhouR38Boot='true';
