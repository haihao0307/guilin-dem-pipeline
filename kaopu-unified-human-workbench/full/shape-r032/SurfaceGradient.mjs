import * as THREE from '../source/registration-vendor/three.module.js';
// Surface gradient formula adapted from Morten S. Mikkelsen, MIT (2020).
// https://github.com/mmikk/surfgrad-bump-standalone-demo
// See LICENSE-MIKK.txt. Anatomical height field and integration are original.
export const VERSION='r032-fragment-anatomical-height/1';
const fragment=`
varying vec3 vAnatomyRest;varying float vAnatomyMask;
uniform vec4 anatomyAnchors;uniform float anatomyAmount;
float ag(float x){return exp(-.5*x*x);}
float anatomyHeight(vec3 q){
 float sc=anatomyAnchors.w,ax=sqrt(q.x*q.x+1e-8),t=(ax-.018*sc)/(anatomyAnchors.x*.92-.018*sc);
 float gate=smoothstep(0.,.14,t)*(1.-smoothstep(.85,1.,t));
 float z=anatomyAnchors.y-.027*sc+.010*sc*sin(3.14159265*clamp(t,0.,1.))+.008*sc*clamp(t,0.,1.);
 // New sub-triangle band, not a repeat of the broad geometric bulge.
 float h=gate*sc*(.0016*ag((q.z-z)/(.0055*sc))-.0007*ag((q.z-z-.010*sc)/(.008*sc)));
 float u=(ax-.025*sc)/(.132*sc),arch=anatomyAnchors.z-.070*sc-.080*sc*sin(3.14159265*.65*clamp(u,0.,1.));
 float rg=smoothstep(0.,.18,u)*(1.-smoothstep(.84,1.06,u));
 h+=rg*sc*(.0018*ag((q.z-arch)/(.007*sc))-.0008*ag((q.z-arch+.013*sc)/(.009*sc)));
 return h;
}
`;
export function installSurfaceGradient(viewer,model){
 viewer.skin.set({enabled:false});
 const rest=model.positions.slice(),mask=new Float32Array(model.vertexCount),norm=viewer.geometry.attributes.normal;
 for(let i=0;i<model.bodyCount;i++){const t=Math.max(0,Math.min(1,(norm.getZ(i)-.1)/.6));mask[i]=t*t*(3-2*t);}
 viewer.geometry.setAttribute('anatomyRest',new THREE.BufferAttribute(rest,3));viewer.geometry.setAttribute('anatomyMask',new THREE.BufferAttribute(mask,1));
 const a=model.r031Bony.last.anchors,scale=(a.clavicle[2]-model.lastBodyDriver.rig.restMatrices[model.lastBodyDriver.rig.names.indexOf('pelvis.L')][11])/.557;
 const uniforms={anatomyAmount:{value:0},anatomyAnchors:{value:new THREE.Vector4(a.shoulder[0],a.clavicle[2],a.spine[2],scale)}};
 const mat=new THREE.MeshStandardMaterial({color:0xbab3a5,roughness:.74,metalness:0});
 mat.customProgramCacheKey=()=>VERSION;
 mat.onBeforeCompile=shader=>{Object.assign(shader.uniforms,uniforms);shader.vertexShader='attribute vec3 anatomyRest;attribute float anatomyMask;varying vec3 vAnatomyRest;varying float vAnatomyMask;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvAnatomyRest=anatomyRest;vAnatomyMask=anatomyMask;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+fragment);shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
 vec3 q=vAnatomyRest;float e=.0002*anatomyAnchors.w;
 vec3 gradH=vec3(anatomyHeight(q+vec3(e,0,0))-anatomyHeight(q-vec3(e,0,0)),anatomyHeight(q+vec3(0,e,0))-anatomyHeight(q-vec3(0,e,0)),anatomyHeight(q+vec3(0,0,e))-anatomyHeight(q-vec3(0,0,e)))/(2.*e);
 float h=anatomyHeight(q),hx=dot(gradH,dFdx(q))*vAnatomyMask+h*dFdx(vAnatomyMask),hy=dot(gradH,dFdy(q))*vAnatomyMask+h*dFdy(vAnatomyMask);
 vec3 dx=dFdx(-vViewPosition),dy=dFdy(-vViewPosition),r1=cross(dy,normal),r2=cross(normal,dx);float det=dot(dx,r1);
 float footprint=max(length(dFdx(q)),length(dFdy(q)));float fade=1.-smoothstep(.004,.014,footprint);
 if(abs(det)>1e-14)normal=normalize(abs(det)*normal-sign(det)*anatomyAmount*fade*(hx*r1+hy*r2));
 `);};
 viewer.mesh.material=mat;
 return{version:VERSION,rest,mask,set:on=>{uniforms.anatomyAmount.value=on?1:0;viewer.render()},dispose:()=>mat.dispose(),recipe:()=>({schema:VERSION,anchors:uniforms.anatomyAnchors.value.toArray(),amplitudeMetres:[.0016,.0018],geometryUnchanged:true,normalOnly:true})};
}
