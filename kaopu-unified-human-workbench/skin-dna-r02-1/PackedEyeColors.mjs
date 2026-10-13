import {checkEyeSampling} from './EyeSamplingProof.mjs';
import * as THREE from '../full/source/registration-vendor/three.module.js';
/** Same three source images, same filtering and sRGB decode, separate array layers.
 * The fourth vessel image is linear data and MUST remain a separate sampler.
 * No rescaling, atlas bleeding, texture substitution or feature removal. */
export function createPackedFallback(){const a=new Uint8Array(3*4);for(let i=0;i<3;i++)a.set([180,178,166,255],i*4);const t=new THREE.DataArrayTexture(a,1,1,3);t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;return t;}
export function createPackedEyeColors(source){
 if(source.length!==3)throw Error('Eye colour packing requires exactly three sRGB sources');
 const w=source[0].image.width,h=source[0].image.height;
 for(const t of source)if(t.image.width!==w||t.image.height!==h||t.colorSpace!==THREE.SRGBColorSpace||t.flipY!==false||t.wrapS!==THREE.ClampToEdgeWrapping||t.wrapT!==THREE.ClampToEdgeWrapping||t.minFilter!==THREE.LinearMipmapLinearFilter||t.magFilter!==THREE.LinearFilter)throw Error('Eye source dimensions, colour space or filter contract changed');
 const data=new Uint8Array(w*h*4*3),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true,colorSpace:'srgb'});if(!ctx)throw Error('Cannot decode retained eye colours');
 for(let i=0;i<3;i++){ctx.clearRect(0,0,w,h);ctx.drawImage(source[i].image,0,0);data.set(ctx.getImageData(0,0,w,h).data,i*w*h*4);}
 const texture=new THREE.DataArrayTexture(data,w,h,3);texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;
 const report={version:'EYE-COLOR-SAMPLER-PACK-1',sources:3,layers:3,width:w,height:h,colorSpace:'sRGB',vesselDataSeparate:true,sourceResized:false,geometryChanged:false,baseBytes:data.byteLength,savedFragmentSamplers:2,allPixelsCopied:true};
 // Sampling proof is exposed only for read-only engineering diagnostics.
 return {texture,source,report,checkSampling:renderer=>checkEyeSampling(renderer,texture,source),dispose(){texture.dispose();}};
}
