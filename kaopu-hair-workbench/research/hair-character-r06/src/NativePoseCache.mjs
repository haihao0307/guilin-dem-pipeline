import * as THREE from '../references/three.module.js';
// Evaluate the retained native weights once per visible pose. The face's
// full/diffuse/albedo and shadow passes then share the exact same position/R.
export class NativePoseCache {
 constructor(native,viewer){this.native=native;this.viewer=viewer;this.width=1024;this.height=Math.ceil(native.geometry.attributes.position.count/this.width);this.count=native.geometry.attributes.position.count;this.version=-1;this.bakes=0;this.sourceHeader=native.vertexHeader;this.target=new THREE.WebGLRenderTarget(this.width,this.height,{count:3,type:THREE.FloatType,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:false,stencilBuffer:false});
  const header=`uniform sampler2D mrCache0,mrCache1,mrCache2;uniform float mrActive;vec3 mrP=vec3(0.);mat3 mrR=mat3(1.);
void mrEvaluate(){ivec2 p=ivec2(gl_VertexID%1024,gl_VertexID/1024);vec4 a=texelFetch(mrCache0,p,0),b=texelFetch(mrCache1,p,0),c=texelFetch(mrCache2,p,0);mrP=a.xyz;mrR=mat3(vec3(a.w,b.xy),vec3(b.zw,c.x),c.yzw);}
vec3 mrToNative(vec3 p){return vec3(p.x,-p.z,p.y);}vec3 mrToWorld(vec3 p){return vec3(p.x,p.z,-p.y);}
`;
  Object.assign(native.U,{mrCache0:{value:this.target.textures[0]},mrCache1:{value:this.target.textures[1]},mrCache2:{value:this.target.textures[2]}});native.vertexHeader=header;const key=native.material.customProgramCacheKey.bind(native.material);native.material.customProgramCacheKey=()=>key()+'/r06-native-pose-cache';native.material.needsUpdate=true;
  const compute=this.sourceHeader.replace('mrRead(mrRanges,gl_VertexID)','mrRead(mrRanges,mrVertexIndex)');this.material=new THREE.RawShaderMaterial({glslVersion:THREE.GLSL3,uniforms:{...native.U,mrCount:{value:this.count}},vertexShader:'precision highp float;in vec3 position;void main(){gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`precision highp float;precision highp int;precision highp sampler2D;int mrVertexIndex;uniform int mrCount;${compute}
layout(location=0)out vec4 pose0;layout(location=1)out vec4 pose1;layout(location=2)out vec4 pose2;
void main(){mrVertexIndex=int(gl_FragCoord.x)+int(gl_FragCoord.y)*1024;if(mrVertexIndex>=mrCount)discard;mrEvaluate();pose0=vec4(mrP,mrR[0].x);pose1=vec4(mrR[0].yz,mrR[1].xy);pose2=vec4(mrR[1].z,mrR[2]);}`,depthTest:false,depthWrite:false,toneMapped:false});
  this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material);this.quad.frustumCulled=false;this.scene.add(this.quad);this.viewport=new THREE.Vector4();
 }
 update(version){if(this.version===version)return;const r=this.viewer.renderer,target=r.getRenderTarget(),auto=r.autoClear;r.getViewport(this.viewport);r.autoClear=false;try{r.setRenderTarget(this.target);r.render(this.scene,this.camera);this.version=version;this.bakes++;}finally{r.setRenderTarget(target);r.setViewport(this.viewport);r.autoClear=auto;}}
 dispose(){this.target.dispose();this.quad.geometry.dispose();this.material.dispose();this.scene.clear();}
 report(){return{bakes:this.bakes,width:this.width,height:this.height,bytes:this.width*this.height*3*16,nativeVertices:this.count,precision:'RGBA32F position + complete blended native normal/morph matrix',oneBakePerVisiblePose:true};}
}
