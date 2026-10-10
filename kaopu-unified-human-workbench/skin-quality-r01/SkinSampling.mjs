import * as THREE from '../full/source/registration-vendor/three.module.js';
import {ATLAS_LAYOUT,splitAtlasRGBA} from './AtlasLayout.mjs';
import {patchSkinSamplingShader} from './SamplingShader.mjs';

// Additive ET13 candidate. Preserves every original pixel in its atlas layer,
// every region, every complexion/identity setting, and every geometry buffer.
export const SKIN_SAMPLING_VERSION='skin-sampling/r01';

function arrayTexture(original){
 const L=ATLAS_LAYOUT,image=original.image;
 if(!image||image.width!==L.width||image.height!==L.height)throw new Error('ET12 source atlas is not ready at its pinned dimensions');
 const canvas=document.createElement('canvas');canvas.width=L.width;canvas.height=L.height;
 const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw new Error('Atlas readback requires Canvas 2D');
 context.drawImage(image,0,0);const rgba=context.getImageData(0,0,L.width,L.height).data;
 const t=new THREE.DataArrayTexture(splitAtlasRGBA(rgba,L.width,L.height),L.tile,L.tile,L.layers);
 t.name='KAOPU '+SKIN_SAMPLING_VERSION+' original ET12 atlas layers';
 t.colorSpace=THREE.NoColorSpace;t.flipY=false;t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;
 t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.unpackAlignment=1;t.needsUpdate=true;
 canvas.width=canvas.height=1;return t;
}
export async function attachSkinSampling(skin){
 if(skin.samplingExtension)return skin.samplingExtension;
 if(!skin.faceExtension||!skin.faceReady)throw new Error('ET12 FaceSkin must be attached before skin sampling');
 await skin.faceReady;if(skin.disposed)throw new Error('The native skin was disposed during atlas preparation');
 if(skin.samplingExtension)return skin.samplingExtension;
 const U=skin.faceExtension.U,source=[U.uFAtlas.value,U.uFChroma.value],arrays=[];
 try{for(const t of source)arrays.push(arrayTexture(t));}catch(e){for(const t of arrays)t.dispose();throw e;}
 const previous=skin.material.onBeforeCompile,key=skin.material.customProgramCacheKey.bind(skin.material);
 const ext={version:SKIN_SAMPLING_VERSION,enabled:true,shaderCompiles:0,disposed:false,
  report(){return{version:this.version,enabled:this.enabled,shaderCompiles:this.shaderCompiles,disposed:this.disposed,atlas:[256,256,8],originalAtlasPixelsPreserved:true,explicitContinuousGradients:true,isolatedMips:true,extraGPUBytesApprox:2*1024*512*4*4/3,sourceAssetsAdded:0,geometryChanged:false,identityParametersChanged:false,sssChanged:false,eyeOpticsChanged:false,remaining:'Source patch repeat discontinuities and planar stretch remain; this is sampling correctness, not full skin realism.'};},
  setEnabled(enabled){if(this.disposed)throw new Error('Sampling extension disposed');this.enabled=!!enabled;skin.material.needsUpdate=true;skin.viewer.render();return this.report();}
 };
 skin.samplingExtension=ext;
 skin.material.customProgramCacheKey=()=>key()+'/'+SKIN_SAMPLING_VERSION+'/'+(ext.enabled?'array-grad':'original');
 skin.material.onBeforeCompile=shader=>{previous(shader);if(!ext.enabled||ext.disposed)return;shader.fragmentShader=patchSkinSamplingShader(shader.fragmentShader);shader.uniforms.uSamplingAtlas={value:arrays[0]};shader.uniforms.uSamplingChroma={value:arrays[1]};ext.shaderCompiles++;};
 const dispose=skin.dispose.bind(skin);skin.dispose=()=>{if(!ext.disposed){ext.disposed=true;for(const t of arrays)t.dispose();}dispose();};
 skin.material.needsUpdate=true;skin.viewer.render();return ext;
}

// Optional same-platform hook, never automatically installed by importing.
export function installSkinSamplingBridge(model){
 if(model.__skinSamplingBridge)return;
 if(!model.faceSurface?.attachSkin)throw new Error('Existing ET13 skin bridge is required');
 const attach=model.faceSurface.attachSkin;
 model.faceSurface.attachSkin=skin=>{attach(skin);skin.samplingReady=attachSkinSampling(skin);};
 model.__skinSamplingBridge=true;
}
