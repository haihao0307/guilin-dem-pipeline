import * as THREE from 'three';
/** The visible native skin and its shadow must use the identical full binding.
 * A static rest-pose depth pass casts stale hands and facial shadows on animation.
 */
export function bindNativeShadows(binding){
 const max=binding.report.maxInfluences;
 const prefix=`uniform sampler2D mrRanges,mrEntries,mrBones;uniform float mrActive;
 vec4 mrRead(sampler2D t,int k){return texelFetch(t,ivec2(k%2048,k/2048),0);}
 vec3 mrP=vec3(0.);mat3 mrR=mat3(1.);
 void mrEvaluate(){vec4 range=mrRead(mrRanges,gl_VertexID);mrP=vec3(0.);mrR=mat3(0.);for(int k=0;k<${max};k++){if(k>=int(range.y))break;int s=(int(range.x)+k)*2;vec4 p=mrRead(mrEntries,s);float w=mrRead(mrEntries,s+1).x;int j=int(p.w);vec4 a=texelFetch(mrBones,ivec2(0,j),0),b=texelFetch(mrBones,ivec2(1,j),0),c=texelFetch(mrBones,ivec2(2,j),0);mrP+=w*vec3(dot(a,vec4(p.xyz,1.)),dot(b,vec4(p.xyz,1.)),dot(c,vec4(p.xyz,1.)));mrR+=w*transpose(mat3(a.xyz,b.xyz,c.xyz));}}
 vec3 mrToNative(vec3 p){return vec3(p.x,-p.z,p.y);}vec3 mrToWorld(vec3 p){return vec3(p.x,p.z,-p.y);}
 `;
 const patch=material=>{const prior=material.onBeforeCompile.bind(material);material.onBeforeCompile=s=>{prior(s);Object.assign(s.uniforms,binding.U);s.vertexShader=prefix+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','if(mrActive>.5)mrEvaluate();\n#include <begin_vertex>').replace('#include <project_vertex>','if(mrActive>.5)transformed=mrToWorld(mrP+mrR*mrToNative(transformed-position));\n#include <project_vertex>');};material.customProgramCacheKey=()=>`mp05-native-shadow-full-binding-${max}`;material.needsUpdate=true;return material;};
 const mesh=binding.mesh;mesh.customDepthMaterial=patch(new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking}));mesh.customDistanceMaterial=patch(new THREE.MeshDistanceMaterial());binding.report.shadowsUseSameBinding=true;binding.report.shadowVertices=mesh.geometry.attributes.position.count;
}
