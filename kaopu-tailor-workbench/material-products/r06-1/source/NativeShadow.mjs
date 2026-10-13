/** The same full native influence field drives beauty and directional shadows. */
export function installNativeShadow(T,binding){
 const prefix=`uniform sampler2D mrRanges,mrEntries,mrBones;uniform float mrActive;
vec4 mrRead(sampler2D t,int k){return texelFetch(t,ivec2(k%2048,k/2048),0);}
vec3 mrP=vec3(0.);mat3 mrR=mat3(1.);
void mrEvaluate(){vec4 range=mrRead(mrRanges,gl_VertexID);mrP=vec3(0.);mrR=mat3(0.);for(int k=0;k<${binding.report.maxInfluences};k++){if(k>=int(range.y))break;int s=(int(range.x)+k)*2;vec4 p=mrRead(mrEntries,s);float w=mrRead(mrEntries,s+1).x;int j=int(p.w);vec4 a=texelFetch(mrBones,ivec2(0,j),0),b=texelFetch(mrBones,ivec2(1,j),0),c=texelFetch(mrBones,ivec2(2,j),0);mrP+=w*vec3(dot(a,vec4(p.xyz,1.)),dot(b,vec4(p.xyz,1.)),dot(c,vec4(p.xyz,1.)));mrR+=w*transpose(mat3(a.xyz,b.xyz,c.xyz));}}
vec3 mrToNative(vec3 p){return vec3(p.x,-p.z,p.y);}vec3 mrToWorld(vec3 p){return vec3(p.x,p.z,-p.y);}
`;
 const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,side:T.DoubleSide});depth.onBeforeCompile=s=>{Object.assign(s.uniforms,binding.U);if(!s.vertexShader.includes('#include <project_vertex>'))throw Error('Native depth shader anchor changed');s.vertexShader=prefix+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <project_vertex>','if(mrActive>.5){mrEvaluate();transformed=mrToWorld(mrP+mrR*mrToNative(transformed-position));}\n#include <project_vertex>');};depth.customProgramCacheKey=()=>`MP06-full-native-depth-${binding.report.maxInfluences}`;binding.mesh.customDepthMaterial=depth;binding.mesh.castShadow=binding.mesh.receiveShadow=true;return depth;
}
