/** Exact per-fragment domain display. The SAME linear scalar field is used by
 * root activation, the contour and the fill. This is not an opaque scalp cap. */
import * as THREE from 'three';
export function installDomainDisplay(material){
 const uniforms={s01View:{value:0},s01Density:{value:1}};
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader='attribute vec4 s01Field; varying vec4 vS01Field;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvS01Field=s01Field;');
  shader.fragmentShader='varying vec4 vS01Field; uniform float s01View; uniform float s01Density;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   if(vS01Field.w>0.5 && vS01Field.x>0.000000001 && s01View<2.5){
    vec3 fieldColor=vec3(0.024,0.125,0.098);
    if(s01View>0.5 && s01View<1.5){
     float t=clamp(vS01Field.z/0.08,0.0,1.0);
     fieldColor=mix(vec3(0.025,0.19,0.25),vec3(0.50,0.15,0.018),t);
    }else if(s01View>1.5){
     float d=clamp(vS01Field.y*s01Density,0.0,1.0);
     fieldColor=mix(vec3(0.035,0.045,0.055),vec3(0.028,0.20,0.13),d);
    }
    diffuseColor.rgb=fieldColor;
   }
  `);
 };
 material.customProgramCacheKey=()=> 's01-signed-domain-display-v1';
 return uniforms;
}
export function updateDomainDisplay(geometry,domain,mode,factor,uniforms){
 let attribute=geometry.getAttribute('s01Field');
 if(!attribute){attribute=new THREE.BufferAttribute(new Float32Array(domain.s.N*4),4);geometry.setAttribute('s01Field',attribute)}
 for(let i=0;i<domain.s.N;i++){
  const p=i*4,a=attribute.array;a[p]=domain.phi[i];a[p+1]=domain.density[i];a[p+2]=Number.isFinite(domain.distance[i])?domain.distance[i]:0;a[p+3]=domain.s.component[i]===0?1:0;
 }
 attribute.needsUpdate=true;uniforms.s01View.value={domain:0,distance:1,density:2,clay:3}[mode];uniforms.s01Density.value=factor;
}
