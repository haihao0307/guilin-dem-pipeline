import {original} from './original-shaders.mjs';
export function originalPrefix(source){return source.slice(0,source.lastIndexOf('void main(){'));}
const common=`
uniform int r312DoorEnabled;
uniform vec3 r312DoorCenter;
uniform vec3 r312DoorHalf;
float r312DoorSdf(vec3 p){vec3 q=abs(p-r312DoorCenter)-r312DoorHalf;return length(max(q,vec3(0.)))+min(max(q.x,max(q.y,q.z)),0.);}
bool r312DoorInterval(vec3 ro,vec3 rd,out float a,out float b){
 a=-1e20;b=1e20;
 for(int i=0;i<3;i++){
  float lo=r312DoorCenter[i]-r312DoorHalf[i],hi=r312DoorCenter[i]+r312DoorHalf[i];
  if(abs(rd[i])<1e-9){if(ro[i]<lo||ro[i]>hi)return false;}
  else {float t0=(lo-ro[i])/rd[i],t1=(hi-ro[i])/rd[i];a=max(a,min(t0,t1));b=min(b,max(t0,t1));}
 }
 return a<=b;
}
`;
const configs={brick:{field:'brickExactWorld',trace:'traceBrick',normal:'brickNormal',toWall:'vCenter+rotateToWorld(p,vYaw)',dirToWall:'rotateToWorld(rd,vYaw)'},soil:{field:'layeredExactSdf',trace:'traceSoil',normal:'soilNormal',toWall:'p',dirToWall:'rd'},plaster:{field:'plasterSdfExact',trace:'tracePlaster',normal:'normalAt',toWall:'p',dirToWall:'rd'}};
export function fragmentShader(kind,{adapted=true}={}){
 if(!configs[kind])throw Error('Unknown R3.12 source kind');
 if(!adapted)return original[kind+'FS'];
 const c=configs[kind];
 const helpers=`
bool r312CapHit=false;
vec3 r312ToWall(vec3 p){return ${c.toWall};}
bool r312ValidHit(vec3 ro,vec3 rd,float lo,float hi,vec3 p){
 float t=dot(p-ro,rd);return t>=lo-.000001&&t<=hi+.000001&&r312DoorSdf(r312ToWall(p))>=-.000001;
}
float r312Field(vec3 p){float d=${c.field}(p);return r312DoorEnabled==0?d:max(d,-r312DoorSdf(r312ToWall(p)));}
// Only geometric CSG is added. Original field, material, lighting and tracing functions stay byte-for-byte.
// Split the finite ray interval around the analytic rectangular opening. No new noise and no unsafe field stepping.
bool r312Trace(vec3 ro,vec3 rd,float tn,float tf,out vec3 p){
 if(r312DoorEnabled==0)return ${c.trace}(ro,rd,tn,tf,p);
 float a,b;vec3 wr=r312ToWall(ro),wd=${c.dirToWall};
 if(!r312DoorInterval(wr,wd,a,b)||b<max(tn,0.)||a>tf)return ${c.trace}(ro,rd,tn,tf,p);
 float start=max(tn,0.);
 if(a>start){
  if(${c.trace}(ro,rd,start,min(a,tf),p)&&r312ValidHit(ro,rd,start,min(a,tf),p))return true;
  // The cut boundary itself is a surface only where the original solid occupies it.
  if(a<=tf&&${c.field}(ro+rd*a)<=.00002){p=ro+rd*a;r312CapHit=true;return true;}
 }
 if(b>=start&&b<=tf){
  if(${c.field}(ro+rd*b)<=.00002){p=ro+rd*b;r312CapHit=true;return true;}
  if(${c.trace}(ro,rd,b+.000025,tf,p)&&r312ValidHit(ro,rd,b+.000025,tf,p))return true;
 }
 return false;
}
vec3 r312Normal(vec3 p){
 if(r312DoorEnabled==0||abs(r312DoorSdf(r312ToWall(p)))>.001)return ${c.normal}(p);
 float e=.00014;vec2 k=vec2(1.,-1.);
 return normalize(k.xyy*r312Field(p+k.xyy*e)+k.yyx*r312Field(p+k.yyx*e)+k.yxy*r312Field(p+k.yxy*e)+k.xxx*r312Field(p+k.xxx*e));
}
`;
 let main;
 if(kind==='brick')main=`void main(){vec3 worldRd=uOrtho==1?normalize(uViewDir):normalize(vBoxPoint-uCamera),worldRo=uOrtho==1?vBoxPoint-worldRd*8.:uCamera;vec3 ro=rotateToLocal(worldRo-vCenter,vYaw),rd=rotateToLocal(worldRd,vYaw);float tn,tf;if(!rayBox(ro,rd,vec3(.134,.043,.070),tn,tf))discard;vec3 p;if(!r312Trace(ro,rd,tn,tf,p))discard;vec3 localNormal=r312Normal(p),worldNormal=rotateToWorld(localNormal,vYaw),world=vCenter+rotateToWorld(p,vYaw);vec3 col=shadeBrick(world,p,worldNormal,worldRd);col=pow(max(col/(1.+col),0.),vec3(1./2.2));frag=vec4(col,1.);vec4 clip=uViewProj*vec4(world,1.);gl_FragDepth=clamp(clip.z/clip.w*.5+.5,0.,1.);}`;
 else main=`void main(){vec3 rd=uOrtho==1?normalize(uViewDir):normalize(vBoxPoint-uCamera),ro=uOrtho==1?vBoxPoint-rd*8.:uCamera;float tn,tf;if(!${kind==='soil'?'rayBounds':'bounds'}(ro,rd,tn,tf))discard;vec3 p;if(!r312Trace(ro,rd,tn,tf,p))discard;vec3 n=r312Normal(p),col=${kind==='soil'?'shadeSoil(p,n,rd,layerIdAt(p))':'shade(p,n,rd)'};col=pow(max(col/(1.+col),0.),vec3(1./2.2));frag=vec4(col,1.);vec4 clip=uViewProj*vec4(p,1.);gl_FragDepth=clamp(clip.z/clip.w*.5+.5,0.,1.);}`;
 // Distinct overlapping solids share the analytic cut plane. A 50/100 micrometre
 // eye-space depth-only priority resolves local/world float roundoff on that plane.
 // Shading positions, silhouettes and all uncut depths remain unchanged.
 const capBias=kind==='soil'?'.00005':kind==='plaster'?'.00010':'0.';
 const position=kind==='brick'?'world':'p', direction=kind==='brick'?'worldRd':'rd';
 if(kind!=='brick') main=main.replace('gl_FragDepth=clamp(clip.z/clip.w*.5+.5,0.,1.);',`gl_FragDepth=clamp(clip.z/clip.w*.5+.5,0.,1.);if(r312CapHit){vec4 capClip=uViewProj*vec4(${position}-${direction}*${capBias},1.);gl_FragDepth=clamp(capClip.z/capClip.w*.5+.5,0.,1.);}`);
 return originalPrefix(original[kind+'FS'])+common+helpers+main;
}
export function doorInterval(ro,rd,center,half){let a=-Infinity,b=Infinity;for(let i=0;i<3;i++){const lo=center[i]-half[i],hi=center[i]+half[i];if(Math.abs(rd[i])<1e-9){if(ro[i]<lo||ro[i]>hi)return null;}else{const t0=(lo-ro[i])/rd[i],t1=(hi-ro[i])/rd[i];a=Math.max(a,Math.min(t0,t1));b=Math.min(b,Math.max(t0,t1));}}return a<=b?[a,b]:null;}
