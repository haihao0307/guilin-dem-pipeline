import {WholeRenderer} from '../building-rule-sketch-r06/kowloon-building-mother-r01/whole-building-facade-r01/semantic-renderer.mjs';
// Exact rectangular decomposition in each analytic prism's local frame.
// These descriptors are only secondary visibility queries, never visual meshes.
const inside=(p,loops)=>{let yes=false;for(const loop of loops)for(let i=0,j=loop.length-1;i<loop.length;j=i++){const a=loop[i],b=loop[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
const rect=(c,h)=>[[c[0]-h[0],c[1]-h[1]],[c[0]+h[0],c[1]-h[1]],[c[0]+h[0],c[1]+h[1]],[c[0]-h[0],c[1]+h[1]]];
export function shadowBoxes(model){
 const list=model.instances.flatMap(i=>model.archetypes.find(a=>a.id===i.archetypeId).primitives.map(p=>({...p,origin:p.origin.map((v,k)=>v+(i.translation?.[k]??0))}))).concat((model.hostedComponents?.apertures??[]).flatMap(a=>a.primitives));
 const boxes=[];for(const p of list){if(p.part==='glass')continue;let loops,range;
  if(p.kind==='finite_polygon_prism'){loops=p.loops;range=p.range;}
  else if(p.kind==='rounded_rectangle_extrusion'){if(p.outer.radius||p.inner?.radius)throw Error('Rounded shadow boundary needs exact analytic integration; refusing box substitute');loops=[rect(p.outer.center,p.outer.half),...(p.inner?[rect(p.inner.center,p.inner.half)]:[])];range=[-p.halfDepth,p.halfDepth];}
  else throw Error('Unsupported exact shadow primitive '+p.kind);
  for(const loop of loops)for(let i=0;i<loop.length;i++){const a=loop[i],b=loop[(i+1)%loop.length];if(Math.abs(a[0]-b[0])>1e-7&&Math.abs(a[1]-b[1])>1e-7)throw Error('Non-orthogonal shadow boundary requires exact adapter');}
  const xs=[...new Set(loops.flat().map(p=>p[0]))].sort((a,b)=>a-b),ys=[...new Set(loops.flat().map(p=>p[1]))].sort((a,b)=>a-b);
  for(let i=1;i<xs.length;i++)for(let j=1;j<ys.length;j++)if(inside([(xs[i-1]+xs[i])/2,(ys[j-1]+ys[j])/2],loops))boxes.push({origin:p.origin,u:p.u,v:p.v,w:p.w,min:[xs[i-1],ys[j-1],range[0]],max:[xs[i],ys[j],range[1]],nodeId:p.nodeId});
 }return boxes;
}
export function packShadowBoxes(boxes){const data=new Float32Array(Math.max(1,boxes.length)*6*4);boxes.forEach((b,i)=>{const rows=[[...b.origin,0],[...b.u,b.min[0]],[...b.v,b.min[1]],[...b.w,b.min[2]],[...b.max,0],[0,0,0,0]];rows.forEach((r,k)=>data.set(r,(i*6+k)*4));});return{width:6,height:Math.max(1,boxes.length),data};}
export const STUDIO_SHADE=`#version 300 es
precision highp float;precision highp int;
uniform sampler2D uHit,uNormal,uSemantic,uShadowBoxes;
uniform bool uShadowClip;uniform vec3 uShadowClipNormal;uniform float uShadowClipOffset;
uniform int uSemanticCount,uShadowBoxCount;uniform float uSelectedId;
uniform vec3 uCameraEye,uTarget;uniform float uFov;uniform vec2 uResolution;uniform ivec4 uTile;
out vec4 outColor;
vec3 ray(){vec2 uv=(2.*gl_FragCoord.xy-uResolution)/uResolution.y;vec3 f=normalize(uTarget-uCameraEye),r=normalize(cross(f,abs(f.y)>.999?vec3(0,0,1):vec3(0,1,0)));return normalize(f+tan(uFov*.5)*(uv.x*r+uv.y*cross(r,f)));}
bool boxHit(vec3 ro,vec3 rd,vec3 mn,vec3 mx,float maxT){float lo=.001,hi=maxT;for(int a=0;a<3;a++){if(abs(rd[a])<1e-8){if(ro[a]<mn[a]||ro[a]>mx[a])return false;}else{float t0=(mn[a]-ro[a])/rd[a],t1=(mx[a]-ro[a])/rd[a];lo=max(lo,min(t0,t1));hi=min(hi,max(t0,t1));if(hi<=lo)return false;}}return hi>lo;}
float visibility(vec3 p,vec3 n,vec3 light){vec3 ro=p+n*.003,d=light-ro;float limit=length(d);d/=limit;if(uShadowClip){float side=dot(uShadowClipNormal,ro)-uShadowClipOffset,den=dot(uShadowClipNormal,d);if(abs(den)<1e-8){if(side<0.)return 1.;}else if(den<0.){if(side<0.)return 1.;limit=min(limit,-side/den);}else if(side<0.){float enter=-side/den;if(enter>=limit)return 1.;ro+=d*enter;limit-=enter;}}for(int i=0;i<512;i++){if(i>=uShadowBoxCount)break;vec3 o=texelFetch(uShadowBoxes,ivec2(0,i),0).xyz;vec4 a=texelFetch(uShadowBoxes,ivec2(1,i),0),b=texelFetch(uShadowBoxes,ivec2(2,i),0),c=texelFetch(uShadowBoxes,ivec2(3,i),0);vec3 mn=vec3(a.w,b.w,c.w),mx=texelFetch(uShadowBoxes,ivec2(4,i),0).xyz;vec3 q=ro-o;if(boxHit(vec3(dot(q,a.xyz),dot(q,b.xyz),dot(q,c.xyz)),vec3(dot(d,a.xyz),dot(d,b.xyz),dot(d,c.xyz)),mn,mx,limit))return 0.;}return 1.;}
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float grain(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
vec3 illuminate(vec3 p,vec3 n,vec3 rd,vec3 albedo,float rough){vec3 k=vec3(-5.,9.,-6.),f=vec3(9.,7.,4.),kd=normalize(k-p),fd=normalize(f-p);float ks=(visibility(p,n,k+vec3(-.22,0,0))+visibility(p,n,k+vec3(.22,.12,0)))*.5,fs=visibility(p,n,f);vec3 diffuse=vec3(.20)+vec3(1.,.94,.84)*1.30*max(dot(n,kd),0.)*ks+vec3(.79,.88,1.)*.93*max(dot(n,fd),0.)*fs;float shin=mix(130.,12.,rough);float spec=(pow(max(dot(n,normalize(kd-rd)),0.),shin)*ks+pow(max(dot(n,normalize(fd-rd)),0.),shin)*fs)*mix(.40,.025,rough);return albedo*diffuse+vec3(spec);}
void main(){ivec2 px=ivec2(gl_FragCoord.xy);vec4 h=texelFetch(uHit,px,0);vec3 rd=ray(),p,n,c;float rough=.92;
 if(h.w<.5){vec2 uv=gl_FragCoord.xy/uResolution;vec3 bg=mix(vec3(.28,.30,.32),vec3(.48,.49,.50),exp(-dot(uv-vec2(.5,.6),uv-vec2(.5,.6))*3.));float t=(-.82-uCameraEye.y)/rd.y;if(t>0.&&rd.y<-.001){p=uCameraEye+rd*t;n=vec3(0,1,0);vec3 floorColor=illuminate(p,n,rd,vec3(.36,.37,.38),1.);float fade=1.-smoothstep(10.,22.,distance(p.xz,vec2(2,2.5)));bg=mix(bg,floorColor,fade);}outColor=vec4(pow(max(bg,vec3(0)),vec3(1./2.2)),1);return;}
 if(h.w>2.5){outColor=vec4(.8,.05,.4,1);return;}
 p=uCameraEye+rd*h.x;n=normalize(texelFetch(uNormal,px,0).xyz);if(dot(n,rd)>0.)n=-n;
 int lo=0,hi=uSemanticCount-1;c=vec3(.58,.57,.54);for(int k=0;k<20;k++){if(lo>hi)break;int m=(lo+hi)/2;vec4 r=texelFetch(uSemantic,ivec2(m,0),0);if(abs(r.x-h.y)<.1){c=r.yzw;break;}if(r.x<h.y)lo=m+1;else hi=m-1;}
 // Physical-role material presentation, not category/outline drawing. Values
 // are authored display estimates, not tested concrete or glass specifications.
 if(h.z==6.){c=vec3(.35,.48,.52);rough=.12;}else if(h.z==4.){c=vec3(.34,.35,.35);rough=.34;}else if(h.z==5.){c=vec3(.44,.38,.29);rough=.58;}
 else {float aggregate=grain(p*110.);c*=.96+.055*aggregate+.025*grain(p*3.);rough=.94;}
 c=illuminate(p,n,rd,c,rough);if(abs(h.y-uSelectedId)<.1)c=mix(c,vec3(.75,.67,.44),.20);
 // No screen-space outline or semantic edge-darkening pass.
 c=c/(vec3(1.)+c*.25);outColor=vec4(pow(max(c,vec3(0)),vec3(1./2.2)),1.);
}`;
// Local display-only clipping adds the physical cut boundary using the exact
// shared prism occupancy and identity query. Never modifies source geometry.
export function withSolidSectionCaps(source){
 const needle='float start=assemblyEntryStart(uArchetypeMin,uArchetypeMax,ro,rd,uEye,origin,boundsLo,clipLo);';
 if(source.split(needle).length!==2)throw Error('Shared primary assembly contract changed: review section-cap adapter');
 const cap=`if(uClip){float capDen=dot(uClipNormal,rd);if(abs(capDen)>1e-10){float capT=(uClipOffset-dot(uClipNormal,uEye))/capDen;if(capT>=0.&&capT>=boundsLo&&capT<=boundsHi&&capT<=outHit.x){vec3 capPoint=ro+rd*capT;if(assemblyUnionInside(capPoint)){FieldHit capHit=mapField(capPoint);capHit.objectId+=uInstances[i].w;accept(capT,capHit,-normalize(uClipNormal),uInstances[i].w);}}}}`;
 return source.replace(needle,cap+needle);
}
export class StudioRenderer extends WholeRenderer{
 compile(name,source){return super.compile(name,name==='assembly'?withSolidSectionCaps(source):source);}

 setModel(model,source){super.setModel(model,source);const boxes=shadowBoxes(model);if(boxes.length>512)throw Error('Room shadow descriptor bound exceeded');this.shadowBoxCount=boxes.length;this.shadowBoxes=boxes;this.roomShadowTexture=this.texture(packShadowBoxes(boxes));
  // Neutral concrete/plaster colours replace semantic teaching colour coding.
  for(const r of this.semanticRegistry)r.color=({wall:'#ada89e',column:'#92918b',beam:'#92918b',floor:'#a6a298',roof:'#92918b',door:'#70614a',window:'#707879'}[r.classKey]??'#92918b');
  const data=new Float32Array(Math.max(1,this.semanticRegistry.length)*4);this.semanticRegistry.forEach((r,i)=>data.set([r.objectId,...r.color.slice(1).match(/../g).map(v=>parseInt(v,16)/255)],i*4));this.semanticTexture=this.texture({width:Math.max(1,this.semanticRegistry.length),height:1,data});
  if(!this.studioShadeProgram)this.studioShadeProgram=this.compile('solid-material-two-light-exact-visibility',STUDIO_SHADE);this.shadeProgram=this.studioShadeProgram;
 }
 camera(p,w,h,options){const L=super.camera(p,w,h,options);if(p===this.studioShadeProgram&&this.roomShadowTexture){this.bindTexture(p,'uShadowBoxes',7,this.roomShadowTexture);this.gl.uniform1i(L('uShadowBoxCount'),this.shadowBoxCount);this.gl.uniform1i(L('uShadowClip'),options.cut?1:0);this.gl.uniform3fv(L('uShadowClipNormal'),options.clipNormal);this.gl.uniform1f(L('uShadowClipOffset'),options.clipOffset);}return L;}
}
