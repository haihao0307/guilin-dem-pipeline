import {source} from './source-brick.mjs';
export const originalPrefix=s=>s.slice(0,s.lastIndexOf('void main(){'));
export function bakeVertex(){return originalPrefix(source.brickVS)+`
in vec3 samplePosition;uniform float nativeSeed;uniform int nativeVariant;uniform int nativeWidth;uniform int nativeHeight;
void main(){vCenter=vec3(0.);vYaw=0.;vSeed=nativeSeed;vVariant=nativeVariant<0?int(floor(h11(nativeSeed)*4.)):nativeVariant;vBoxPoint=samplePosition;int id=gl_VertexID;vec2 pixel=vec2(float(id%nativeWidth)+.5,float(id/nativeWidth)+.5);gl_Position=vec4(pixel/vec2(float(nativeWidth),float(nativeHeight))*2.-1.,0.,1.);gl_PointSize=1.;}`;}
export function bakeFragment(){return originalPrefix(source.brickFS).replace('out vec4 frag;','layout(location=0) out vec4 frag;')+`
layout(location=1)out vec4 sampledNormal;
void main(){vec3 a=vec3(0.);vec3 halfBounds=vec3(.134,.043,.070);float exitScale=1e20;for(int axis=0;axis<3;axis++){float v=abs(vBoxPoint[axis]);if(v>1e-9)exitScale=min(exitScale,halfBounds[axis]/v);}vec3 b=vBoxPoint*(exitScale*1.025);bool ok=brickExactWorld(a)<0.&&brickExactWorld(b)>0.;for(int i=0;i<16;i++){vec3 mid=.5*(a+b);if(brickExactWorld(mid)<=0.)a=mid;else b=mid;}vec3 p=.5*(a+b),n=brickNormal(p);float residual=abs(brickExactWorld(p));ok=ok&&residual<.00015;frag=vec4(p,residual);sampledNormal=vec4(n,ok?float(vVariant+1):0.);}`;}
export function nativeVertex(){return `#version 300 es
precision highp float;precision highp int;
uniform mat4 uViewProj;uniform mat4 modelMatrix;uniform float nativeSeed;uniform int nativeVariant;
in vec3 position;in vec3 normal;in mat4 instanceMatrix;
out vec3 vBoxPoint;out vec3 nativeLocalPoint;out vec3 nativeWorldNormal;
flat out vec3 vCenter;flat out float vYaw;flat out float vSeed;flat out int vVariant;
void main(){mat4 transform=modelMatrix*instanceMatrix;vec4 world=transform*vec4(position,1.);vBoxPoint=world.xyz;nativeLocalPoint=position;nativeWorldNormal=mat3(transform)*normal;vCenter=transform[3].xyz;vYaw=0.;vSeed=nativeSeed;vVariant=nativeVariant;gl_Position=uViewProj*world;}`;}
export function nativeFragment(){return originalPrefix(source.brickFS)+`
in vec3 nativeLocalPoint;in vec3 nativeWorldNormal;
void main(){vec3 rd=uOrtho==1?normalize(uViewDir):normalize(vBoxPoint-uCamera);vec3 n=normalize(nativeWorldNormal);vec3 col=shadeBrick(vBoxPoint,nativeLocalPoint,n,rd);col=pow(max(col/(1.+col),0.),vec3(1./2.2));frag=vec4(col,1.);}`;}
// Original visible raymarch serves only as the isolated QA baseline. The runtime
// native path never invokes it and does not import any door/core/cap adapter.
export function baselineVertex(){return originalPrefix(source.brickVS)+`
uniform float nativeSeed;uniform int nativeVariant;
void main(){vCenter=vec3(0.);vYaw=0.;vSeed=nativeSeed;vVariant=nativeVariant;vec2 q=QUAD[gl_VertexID];vec3 world=.160*(uCameraRight*q.x+uCameraUp*q.y);vBoxPoint=world;gl_Position=uViewProj*vec4(world,1.);}`;}
