import * as T from'three';
import{yarnShader}from'./material-shaders.mjs';
let residentBytes=0,peakResidentBytes=0;const RESIDENT_LIMIT=384*1024*1024;
const V=`precision highp float;in vec3 position;void main(){gl_Position=vec4(position.xy,0.,1.);}`;
let core=yarnShader.replace(/attribute [^;]+;/g,'').replace(/varying /g,'');
core=core.replace('surfaceFrame(q.xy,P,N,U,V);','surfaceFrame(q.xy,P,N,U,V);cacheN=N;');
core=core.replace('vec3 radial=B*(cos(theta)*ra)+W*(sin(theta)*rz);','cacheP=P;cacheB=B;cacheW=W;cacheT=T;cacheRA=ra;cacheRZ=rz;cacheArc=arc;vec3 radial=B*(cos(theta)*ra)+W*(sin(theta)*rz);');
const F=`precision highp float;precision highp int;
uniform sampler2D uIntervalData;uniform int uFrameWidth,uSamples,uFramePlies,uFrameCount;
uniform mat3 normalMatrix;
vec4 yarnInterval;vec2 yarnEnds;vec3 tubeCoordinate;float tubeCap;
vec3 cacheP,cacheB,cacheW,cacheT,cacheN;float cacheRA,cacheRZ,cacheArc;
${core}
layout(location=0)out vec4 outP;layout(location=1)out vec4 outB;layout(location=2)out vec4 outW;layout(location=3)out vec4 outT;layout(location=4)out vec4 outN;
void main(){int id=int(gl_FragCoord.x)+int(gl_FragCoord.y)*uFrameWidth;
if(id>=uFrameCount){outP=outB=outW=outT=outN=vec4(0.);return;}
int instance=id/(uSamples*uFramePlies),ply=(id/uSamples)%uFramePlies,j=id%uSamples;
yarnInterval=texelFetch(uIntervalData,ivec2(instance%256,instance/256),0);yarnEnds=vec2(0.);tubeCoordinate=vec3(float(j)/float(uSamples-1),0.,float(ply));tubeCap=0.;
vec3 p,n;solidVertex(p,n);outP=vec4(cacheP,cacheArc);outB=vec4(cacheB,cacheRA);outW=vec4(cacheW,cacheRZ);outT=vec4(cacheT,1.);outN=vec4(cacheN,1.);}`;
export class YarnFrameAtlas{
 static estimateBytes(renderer,instances,segments,plies){const count=instances*(segments+1)*plies,width=Math.min(renderer.capabilities.maxTextureSize,2048,2**Math.ceil(Math.log2(Math.max(1,Math.sqrt(count)))));return width*Math.ceil(count/width)*5*16;}
 static memory(){return{residentBytes,peakResidentBytes,limitBytes:RESIDENT_LIMIT};}
 constructor(renderer,uniforms,intervalTexture,instances,segments,plies){
  this.renderer=renderer;this.samples=segments+1;this.plies=plies;this.count=instances*this.samples*plies;
  this.width=Math.min(renderer.capabilities.maxTextureSize,2048,2**Math.ceil(Math.log2(Math.max(1,Math.sqrt(this.count)))));this.height=Math.ceil(this.count/this.width);
  if(this.height>renderer.capabilities.maxTextureSize)throw Error('纱线形变缓存超过设备纹理上限');
  this.bytes=this.width*this.height*5*16;
  if(residentBytes+this.bytes>RESIDENT_LIMIT)throw Error('有界纱线形变缓存预算不足');residentBytes+=this.bytes;peakResidentBytes=Math.max(peakResidentBytes,residentBytes);this.disposed=false;
  this.target=new T.WebGLRenderTarget(this.width,this.height,{count:5,type:T.FloatType,format:T.RGBAFormat,minFilter:T.NearestFilter,magFilter:T.NearestFilter,depthBuffer:false,stencilBuffer:false,generateMipmaps:false});
  this.material=new T.RawShaderMaterial({glslVersion:T.GLSL3,vertexShader:V,fragmentShader:F,uniforms:{...uniforms,uIntervalData:{value:intervalTexture},uFrameWidth:{value:this.width},uSamples:{value:this.samples},uFramePlies:{value:plies},uFrameCount:{value:this.count},normalMatrix:{value:new T.Matrix3()}},depthTest:false,depthWrite:false,blending:T.NoBlending,toneMapped:false});
  this.scene=new T.Scene();this.quad=new T.Mesh(new T.PlaneGeometry(2,2),this.material);this.quad.frustumCulled=false;this.scene.add(this.quad);this.camera=new T.Camera();this.revision=-1;this.submissions=0;this.cpuSubmitMS=0;
 }
 update(revision){if(this.revision===revision)return;const r=this.renderer,previous=r.getRenderTarget(),enabled=r.shadowMap.enabled,dirty=r.shadowMap.needsUpdate,started=performance.now();
  try{r.shadowMap.enabled=false;r.setRenderTarget(this.target);r.render(this.scene,this.camera);this.revision=revision;this.submissions++;this.cpuSubmitMS=performance.now()-started;}
  finally{r.setRenderTarget(previous);r.shadowMap.enabled=enabled;r.shadowMap.needsUpdate=dirty;}
 }
 uniforms(prefix='Current'){return Object.fromEntries(this.target.textures.map((t,i)=>['u'+prefix+['P','B','W','T','N'][i],{value:t}]).concat([['u'+prefix+'Width',{value:this.width}],['u'+prefix+'Samples',{value:this.samples}]]));}
 invalidate(){this.revision=-1;this.material.needsUpdate=true;}
 dispose(){if(this.disposed)return;this.disposed=true;residentBytes-=this.bytes;this.target.dispose();this.material.dispose();this.quad.geometry.dispose();this.scene.clear();}
}
export const cachedYarnShader=`
attribute vec4 yarnInterval;attribute vec2 yarnEnds;attribute vec3 tubeCoordinate;attribute float tubeCap;
uniform sampler2D uCurrentP,uCurrentB,uCurrentW,uCurrentT,uCurrentN,uPreviousP,uPreviousB,uPreviousW,uPreviousT,uPreviousN;
uniform float uCurrentWidth,uPreviousWidth,uCurrentSamples,uPreviousSamples,uCurrentSides,uPreviousSides,uMorph;
uniform float uKnit,uKind,uPlies,uPlain;uniform vec3 uDye,uContrast,uWeftDye;
varying vec3 vSolidColour;varying vec3 vSolidCoord;varying vec3 vYarnT;varying vec3 vClothN;
const float TAU=6.28318530718;
vec4 frameFetch(sampler2D tex,int id,float width){int w=int(width);return texelFetch(tex,ivec2(id%w,id/w),0);}
void frameAt(float t,float ply,bool old,out vec3 P,out vec3 B,out vec3 W,out vec3 TT,out vec3 N,out float ra,out float rz,out float arc){
float samples=old?uPreviousSamples:uCurrentSamples,width=old?uPreviousWidth:uCurrentWidth;
float u=t*(samples-1.);int lo=int(floor(u)),hi=min(int(samples)-1,lo+1);float f=fract(u);
int base=(gl_InstanceID*int(uPlies)+int(ply))*int(samples),a=base+lo,b=base+hi;
vec4 p,bv,w,tv,n;if(old){p=mix(frameFetch(uPreviousP,a,width),frameFetch(uPreviousP,b,width),f);bv=mix(frameFetch(uPreviousB,a,width),frameFetch(uPreviousB,b,width),f);w=mix(frameFetch(uPreviousW,a,width),frameFetch(uPreviousW,b,width),f);tv=mix(frameFetch(uPreviousT,a,width),frameFetch(uPreviousT,b,width),f);n=mix(frameFetch(uPreviousN,a,width),frameFetch(uPreviousN,b,width),f);}else{p=mix(frameFetch(uCurrentP,a,width),frameFetch(uCurrentP,b,width),f);bv=mix(frameFetch(uCurrentB,a,width),frameFetch(uCurrentB,b,width),f);w=mix(frameFetch(uCurrentW,a,width),frameFetch(uCurrentW,b,width),f);tv=mix(frameFetch(uCurrentT,a,width),frameFetch(uCurrentT,b,width),f);n=mix(frameFetch(uCurrentN,a,width),frameFetch(uCurrentN,b,width),f);}
P=p.xyz;arc=p.w;B=bv.xyz;ra=bv.w;W=w.xyz;rz=w.w;TT=tv.xyz;N=n.xyz;}
vec3 section(float theta,float sides,vec3 B,vec3 W,float ra,float rz){float x=theta/TAU*sides,j=floor(x),f=fract(x),a=j*TAU/sides,b=(j+1.)*TAU/sides;return mix(B*cos(a)*ra+W*sin(a)*rz,B*cos(b)*ra+W*sin(b)*rz,f);}
void solidVertex(out vec3 P,out vec3 NN){vec3 B,W,TT,N;float ra,rz,arc;frameAt(tubeCoordinate.x,tubeCoordinate.z,false,P,B,W,TT,N,ra,rz,arc);float theta=tubeCoordinate.y;
vec3 radial=B*cos(theta)*ra+W*sin(theta)*rz;NN=normalize(B*cos(theta)/ra+W*sin(theta)/rz);
if(abs(tubeCap)>.5){float enabled=tubeCap<0.?yarnEnds.x:yarnEnds.y;if(enabled<.5)P+=radial*.001;NN=normalize(TT)*sign(tubeCap);}else P+=radial*.001;
if(uMorph<.99999){vec3 Q,OB,OW,OT,ON;float ora,orz,oarc;frameAt(tubeCoordinate.x,tubeCoordinate.z,true,Q,OB,OW,OT,ON,ora,orz,oarc);vec3 oradial=section(theta,uPreviousSides,OB,OW,ora,orz),oldNormal=normalize(section(theta,uPreviousSides,OB,OW,1./ora,1./orz));if(abs(tubeCap)>.5){float enabled=tubeCap<0.?yarnEnds.x:yarnEnds.y;if(enabled<.5)Q+=oradial*.001;oldNormal=normalize(OT)*sign(tubeCap);}else Q+=oradial*.001;P=mix(Q,P,uMorph);NN=normalize(mix(oldNormal,NN,uMorph));N=mix(ON,N,uMorph);TT=mix(OT,TT,uMorph);arc=mix(oarc,arc,uMorph);}
vYarnT=normalize(normalMatrix*TT);vClothN=normalize(normalMatrix*N);
vSolidColour=uKnit>.5?mix(uDye,uContrast,yarnInterval.w):mix(uDye,uWeftDye,uKind);vSolidColour*=1.+.028*sin(arc*.67+yarnInterval.z*1.47);vSolidColour=mix(vSolidColour,vec3(.52),uPlain);vSolidCoord=vec3(arc,theta,yarnInterval.z);
}`;
