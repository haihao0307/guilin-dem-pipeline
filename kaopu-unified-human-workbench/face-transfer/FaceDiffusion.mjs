/*! Uses Separable SSS. Copyright (C) 2012 Jorge Jimenez and Diego Gutierrez.
 * Adapted from this project's skin-quality-lab/emily-transfer/app.js.
 * See THIRD_PARTY.txt for the complete redistribution notice.
 * Difference: face-region alpha, original host tone mapping, no body replacement. */
import * as THREE from '../full/source/registration-vendor/three.module.js';
const vertex=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
function kernel(){const center=[.530605,.613514,.739601,0],half=[[.000973794,.0000111862,.000000943437,3],[.00333804,.0000785443,.000012945,2.52083],[.00500364,.00020094,.0000528848,2.08333],[.00700976,.00049366,.000151938,1.6875],[.0094389,.00139119,.000416598,1.33333],[.0128496,.00356329,.00132016,1.02083],[.017924,.00711691,.00347194,.75],[.0263642,.0119715,.00684598,.520833],[.0410172,.0199899,.0118481,.333333],[.0493588,.0367726,.0219485,.1875],[.0402784,.0657244,.04631,.0833333],[.0211412,.0459286,.0378196,.0208333]];return [new THREE.Vector4(...center),...half.map(v=>new THREE.Vector4(v[0],v[1],v[2],-v[3])),...half.map(v=>new THREE.Vector4(...v))];}
const blur=`varying vec2 vUv;uniform sampler2D tColor,tDepth,tAlbedo;uniform vec2 direction;uniform float radius,projectionScale,nearPlane,farPlane,firstPass;uniform vec4 kernel[25];
float depthM(float d){return nearPlane*farPlane/(farPlane-d*(farPlane-nearPlane));}
vec3 split(vec2 p){vec3 c=texture2D(tColor,p).rgb;return firstPass>.5?c/sqrt(max(texture2D(tAlbedo,p).rgb,vec3(.025))):c;}
void main(){vec4 c=texture2D(tColor,vUv);if(c.a<.02){gl_FragColor=c;return;}vec3 albedo=texture2D(tAlbedo,vUv).rgb;float z=depthM(texture2D(tDepth,vUv).r);float absorb=mix(.62,1.,smoothstep(.04,.45,dot(albedo,vec3(.2126,.7152,.0722))));float pixels=clamp(radius*.001*projectionScale/max(z,.001)*absorb,.1,35.);vec3 middle=split(vUv),sum=middle*kernel[0].rgb;
for(int i=1;i<25;i++){vec2 p=vUv+direction*pixels*kernel[i].w;float nz=depthM(texture2D(tDepth,p).r),a=texture2D(tColor,p).a;float weight=exp(-abs(nz-z)/max(.0004,radius*.0015))*smoothstep(.02,.75,a);sum+=mix(middle,split(p),weight)*kernel[i].rgb;}gl_FragColor=vec4(sum,c.a);}`;
const compose=`varying vec2 vUv;uniform sampler2D tFull,tDiffuse,tBlur,tAlbedo;uniform float strength;
void main(){vec4 f=texture2D(tFull,vUv),a=texture2D(tAlbedo,vUv);vec3 d=texture2D(tDiffuse,vUv).rgb,b=texture2D(tBlur,vUv).rgb*sqrt(max(a.rgb,vec3(.025)));gl_FragColor=vec4(max(vec3(0.),f.rgb+(b-d)*strength*a.a),1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
function target(depth=false){const t=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true,stencilBuffer:false});if(depth)t.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);return t;}
export class FaceDiffusion{
 constructor(viewer){this.v=viewer;this.targets=[target(true),target(true),target(true),target(),target()];const[full,diff,albedo,A,B]=this.targets;
 this.blur=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:blur,depthTest:false,depthWrite:false,toneMapped:false,uniforms:{tColor:{value:diff.texture},tDepth:{value:diff.depthTexture},tAlbedo:{value:albedo.texture},direction:{value:new THREE.Vector2()},radius:{value:.85},projectionScale:{value:1},nearPlane:{value:.01},farPlane:{value:50},firstPass:{value:1},kernel:{value:kernel()}}});
 this.compose=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:compose,depthTest:false,depthWrite:false,toneMapped:true,uniforms:{tFull:{value:full.texture},tDiffuse:{value:diff.texture},tAlbedo:{value:albedo.texture},tBlur:{value:B.texture},strength:{value:.42}}});
 this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.compose);this.scene.add(this.quad);this.width=0;this.height=0;this.frames=0;
 }
 render(){const v=this.v,r=v.renderer,camera=v.camera,api=v.model.faceSurface,s=api.settings,save={tone:r.toneMapping,color:r.outputColorSpace,target:r.getRenderTarget(),alpha:r.getClearAlpha(),clear:r.getClearColor(new THREE.Color())};const size=r.getDrawingBufferSize(new THREE.Vector2()),W=size.x,H=size.y;
 if(W!==this.width||H!==this.height){this.width=W;this.height=H;for(const t of this.targets)t.setSize(W,H);}
 const[full,diff,albedo,A,B]=this.targets,pass=n=>{for(const skin of api.skins)if(!skin.disposed&&skin.faceExtension)skin.faceExtension.U.uFPass.value=n;};
 try{
  r.toneMapping=THREE.NoToneMapping;r.outputColorSpace=THREE.LinearSRGBColorSpace;
  pass(0);r.setRenderTarget(full);r.clear();r.render(v.scene,camera);
  r.setClearColor(0x000000,0);pass(1);r.setRenderTarget(diff);r.clear();r.render(v.scene,camera);pass(2);r.setRenderTarget(albedo);r.clear();r.render(v.scene,camera);pass(0);
  const u=this.blur.uniforms;u.radius.value=s.radius;u.projectionScale.value=camera.projectionMatrix.elements[5]*H*.5;u.nearPlane.value=camera.near;u.farPlane.value=camera.far;u.tColor.value=diff.texture;u.firstPass.value=1;u.direction.value.set(1/W,0);this.quad.material=this.blur;r.setRenderTarget(A);r.clear();r.render(this.scene,this.camera);u.tColor.value=A.texture;u.firstPass.value=0;u.direction.value.set(0,1/H);r.setRenderTarget(B);r.clear();r.render(this.scene,this.camera);
  r.toneMapping=save.tone;r.outputColorSpace=save.color;r.setClearColor(save.clear,save.alpha);this.compose.uniforms.strength.value=s.diffusion;this.quad.material=this.compose;r.setRenderTarget(save.target);r.render(this.scene,this.camera);this.frames++;v.renders++;
 }finally{pass(0);r.toneMapping=save.tone;r.outputColorSpace=save.color;r.setClearColor(save.clear,save.alpha);r.setRenderTarget(save.target);}
 }
 report(){return {source:'donor 25-tap split-albedo RGB separable diffusion',frames:this.frames,size:[this.width,this.height],regionMask:'native face-only alpha',specularBlurred:false,bodyDiffusion:false,volumetricScattering:false,screenSpaceOcclusionLimit:true};}
 dispose(){for(const t of this.targets)t.dispose();this.blur.dispose();this.compose.dispose();this.quad.geometry.dispose();this.scene.clear();}
}
