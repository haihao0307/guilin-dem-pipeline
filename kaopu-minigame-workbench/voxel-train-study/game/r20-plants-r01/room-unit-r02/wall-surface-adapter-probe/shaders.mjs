import {original} from '../r312-wall/original-shaders.mjs';
import {originalPrefix,fragmentShader} from '../r312-wall/adapter-shaders.mjs';
import {DOOR_BOTTOM_TOLERANCE} from './geometry.mjs';
export const KIND_FIELD={brick:'brickExactWorld',soil:'layeredExactSdf'};
export function bakeVertex(kind){
 const prefix=originalPrefix(original[kind+'VS']);
 const setup=kind==='brick'?`int id=gl_InstanceID;if(uMotherMode==1){vCenter=vec3(0.,0.030575,0.);vYaw=0.;vSeed=0.;vVariant=0;}else{if(uBatch==0)decodeBase(id,vCenter,vYaw);else if(uBatch==1)decodeClosure(id,vCenter,vYaw);else decodeCap(id,vCenter,vYaw);vSeed=float(id)+float(uBatch)*10007.+dot(vCenter,vec3(13.7,41.3,73.1))+uSessionSeed*.03125;vVariant=int(floor(h11(vSeed)*4.));}`:'';
 return prefix+`\nin vec3 aSample;uniform int probeWidth;uniform int probeSamples;void main(){${setup}vBoxPoint=aSample;int index=gl_InstanceID*probeSamples+gl_VertexID;vec2 pixel=vec2(float(index%probeWidth)+.5,float(index/probeWidth)+.5);gl_Position=vec4(pixel/vec2(float(probeWidth),float(probeHeight))*2.-1.,0.,1.);gl_PointSize=1.;}`.replace('in vec3 aSample;','in vec3 aSample;uniform int probeHeight;');
}
export function bakeFragment(kind){
 const field=KIND_FIELD[kind];if(!field)throw Error('Only original brick/core supported in this probe');
 const meta=kind==='brick'?'probeMeta=vec4(vCenter,vYaw);probeSeed=vec4(vSeed,float(vVariant),residual,ok?1.:0.);':'probeMeta=vec4(0.);probeSeed=vec4(0.,0.,residual,ok?1.:0.);';
 // WebGL2 requires explicit locations for EVERY output when MRT is used.
 // This declaration-only bridge leaves all original function text unchanged.
 const prefix=originalPrefix(original[kind+'FS']).replace('out vec4 frag;','layout(location=0) out vec4 frag;');
 return prefix+`\nlayout(location=1)out vec4 probeMeta;layout(location=2)out vec4 probeSeed;uniform vec3 probeCenter;uniform vec3 probeBoundsMin;uniform vec3 probeBoundsMax;
// A bounded radial surface sampler, not a per-pixel view-ray trace.
// Exact original field is evaluated 19 times; output topology is one shell.
void main(){vec3 a=probeCenter;float exitScale=1e20;for(int axis=0;axis<3;axis++){float v=vBoxPoint[axis];if(abs(v)>1e-9)exitScale=min(exitScale,((v>0.?probeBoundsMax[axis]:probeBoundsMin[axis])-probeCenter[axis])/v);}vec3 b=probeCenter+vBoxPoint*(exitScale*1.025);float da=${field}(a),db=${field}(b);bool ok=da<0.&&db>0.;for(int i=0;i<16;i++){vec3 mid=.5*(a+b);float d=${field}(mid);if(d<=0.)a=mid;else b=mid;}vec3 p=.5*(a+b);float residual=abs(${field}(p));ok=ok&&residual<.00015;frag=vec4(p,1.);${meta}}`;
}
export function surfaceVertex(kind){
 const brick=kind==='brick';
 return `#version 300 es\nprecision highp float;precision highp int;uniform mat4 uViewProj;uniform vec3 uCamera;uniform vec3 uViewDir;uniform int uOrtho;in vec3 position;in vec3 probeNormal;in float probeCap;out vec3 vBoxPoint;out vec3 surfaceCapNormal;flat out float surfaceCap;${brick?'in vec4 probeMeta;in vec2 probeSeed;flat out vec3 vCenter;flat out float vYaw;flat out float vSeed;flat out int vVariant;':''}\nvoid main(){vBoxPoint=position;surfaceCap=probeCap;surfaceCapNormal=probeNormal;${brick?'vCenter=probeMeta.xyz;vYaw=probeMeta.w;vSeed=probeSeed.x;vVariant=int(probeSeed.y);':''}gl_Position=uViewProj*vec4(position,1.);${kind==='soil'?'if(probeCap>.5){vec3 rd=uOrtho==1?normalize(uViewDir):normalize(position-uCamera);vec4 biased=uViewProj*vec4(position-rd*.00005,1.);gl_Position.z=min(biased.z/biased.w,gl_Position.z/gl_Position.w-4./16777215.)*gl_Position.w;}':''}}`;
}
export function surfaceFragment(kind){
 const field=KIND_FIELD[kind];if(!field)throw Error('Unsupported surface kind');
 const setup=kind==='brick'?'vec3 p=rotateToLocal(world-vCenter,vYaw);':'vec3 p=world;';
 const normal=kind==='brick'?'rotateToWorld(brickNormal(p),vYaw)':'soilNormal(p)';
 const shade=kind==='brick'?'shadeBrick(world,p,n,rd)':'shadeSoil(p,n,rd,layerIdAt(p))';
 const adapted=fragmentShader(kind),capNormal=kind==='brick'?'rotateToWorld(r312Normal(p),vYaw)':'r312Normal(p)';
 return adapted.slice(0,adapted.lastIndexOf('void main(){'))+`\nin vec3 surfaceCapNormal;flat in float surfaceCap;
void main(){vec3 world=vBoxPoint;${setup}bool cap=surfaceCap>.5;
 if(!cap&&r312DoorEnabled==1&&abs(world.x-r312DoorCenter.x)<r312DoorHalf.x&&world.y>=r312DoorCenter.y-r312DoorHalf.y-${DOOR_BOTTOM_TOLERANCE.toFixed(5)}&&world.y<r312DoorCenter.y+r312DoorHalf.y)discard;
 if(cap&&${field}(p)>.00002)discard;
 vec3 rd=uOrtho==1?normalize(uViewDir):normalize(world-uCamera);vec3 n=cap?${capNormal}:${normal};vec3 col=${shade};col=pow(max(col/(1.+col),0.),vec3(1./2.2));frag=vec4(col,1.);
 // No gl_FragDepth in this material: standard raster depth is used.
}`;
}
