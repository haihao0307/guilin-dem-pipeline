import {METAL_FIELDS} from '../../../kaopu-material-workbench/material-master-r06/metal-surface.mjs';
// Transport-only adapter: the master's field algebra is unchanged. A varying
// is assigned from the analytic receiver, and unused weather uniforms are bound
// as constants for this intact, dry finish study. uWet is renamed to avoid R07.
export const MASTER_METAL_GLSL=METAL_FIELDS
 .replace('varying vec3 vRestM;varying vec3 vSurfaceN;','vec3 vRestM;vec3 vSurfaceN;')
 .replace('uniform float uWear,uHistory,uWet,uRepair,uMode,uVariant,uRack;','const float uWear=0.,uHistory=0.,mtWet=0.,uRepair=0.,uMode=0.,uVariant=1.,uRack=0.;')
 .replaceAll('uWet','mtWet')
 .replace('uniform vec3 uJoints[16];uniform int uJointCount;','vec3 uJoints[16];const int uJointCount=0;');
export const FINISH_GLSL=String.raw`
uniform float uDoorFinish,uLightShift;
// Authored stainless finish; not an alloy measurement. Metric correlation
// 0.16 mm across grain, 25 mm along; 0.45 um peak amplitude. Unresolved
// microrelief fades; anisotropic roughness retains aggregate optical response.
struct LiftFinish {vec3 diffuse;vec3 f0;float ax;float ay;vec3 normal;};
LiftFinish liftFinish(vec3 p,vec3 n,float fp,bool paint){
 vSurfaceN=n;vRestM=p;
 if(paint){MetalSurface ms=metalField(p,fp);vec4 micro=mt_knvg(p*490.+vec3(11.));vec3 gradient=micro.yzw*(490.*.000012*mt_resolved(490.,fp));gradient-=n*dot(n,gradient);vec3 ns=normalize(n-gradient);return LiftFinish(ms.coverageDiffuse,ms.coverageF0,ms.rough*ms.rough,ms.rough*ms.rough,ns);}
 vec3 tangent=abs(n.z)>.5?vec3(1,0,0):vec3(0,0,1),bitangent=normalize(cross(n,tangent));vec2 chart=vec2(dot(p,tangent),dot(p,bitangent));vec4 grain=mt_knvg(vec3(chart.x/.00016,chart.y/.025,3.17));float gate=mt_resolved(6250.,fp),gx=grain.y*.00000045/.00016*gate,gy=grain.z*.00000045/.025*gate;
 vec3 ns=normalize(n-tangent*gx-bitangent*gy);float band=(mt_kn(vec3(chart.x*70.,chart.y*1.8,11.))-.5)*.012;
 return LiftFinish(vec3(0),vec3(.56,.58,.59),.24+band,.055+band*.2,ns);
}
vec3 liftBRDF(LiftFinish s,vec3 v,vec3 l){vec3 n=s.normal;float nv=max(dot(n,v),.001),nl=max(dot(n,l),0.);if(nl<=0.)return vec3(0);vec3 t=normalize(abs(n.y)<.9?cross(vec3(0,1,0),n):cross(vec3(1,0,0),n)),b=cross(n,t),h=normalize(v+l);float hx=dot(h,t)/s.ax,hy=dot(h,b)/s.ay,hz=dot(h,n);float D=1./(3.14159265*s.ax*s.ay*pow(hx*hx+hy*hy+hz*hz,2.));float lv=(-1.+sqrt(1.+(pow(dot(v,t)*s.ax,2.)+pow(dot(v,b)*s.ay,2.))/(nv*nv)))*.5;float ll=(-1.+sqrt(1.+(pow(dot(l,t)*s.ax,2.)+pow(dot(l,b)*s.ay,2.))/(max(nl*nl,.00001))))*.5;vec3 F=fresnelSchlick(max(dot(v,h),0.),s.f0);return ((1.-F)*s.diffuse/3.14159265+D*F/(4.*nv*max(nl,.001)*(1.+lv+ll)))*nl;}
// Analytic studio cards approximate prefiltered environment illumination.
// These are light sources, not photographic textures, and not a calibrated IBL.
vec3 lightCards(vec3 p,vec3 r,float rough){vec3 color=mix(vec3(.025,.035,.05),vec3(.22,.27,.32),smoothstep(-.3,.9,r.y));if(r.z>.02){float t=(5.-p.z)/r.z;vec3 q=p+r*t;float blur=max(.04,t*rough*.55);float a=(1.-smoothstep(.35,.35+blur,abs(q.x+2.5+uLightShift)))*(1.-smoothstep(2.1,2.1+blur,abs(q.y-uCarY-1.7)));float b=(1.-smoothstep(.2,.2+blur,abs(q.x-2.6+uLightShift)))*(1.-smoothstep(2.2,2.2+blur,abs(q.y-uCarY-1.7)));color+=vec3(4.8,4.5,4.0)*a+vec3(1.8,2.3,3.)*b;}return color;}
vec3 shadeLiftFinish(vec3 p,vec3 local,vec3 n,vec3 v,float fp,bool paint,float visibility){LiftFinish s=liftFinish(local,n,fp,paint);vec3 r=reflect(-v,s.normal),F=fresnelSchlick(max(dot(s.normal,v),0.),s.f0);vec3 color=s.diffuse*.2+lightCards(p,r,sqrt(s.ax*s.ay))*F;
 for(int k=0;k<8;k++){float x=float(k%2)*.7-.35,y=float(k/2)*1.2-.4;vec3 light=vec3(-2.5+x+uLightShift,uCarY+y+1.5,5.)-p;color+=liftBRDF(s,v,normalize(light))*vec3(8.,7.3,6.2)/(1.+dot(light,light))*.5*visibility;}
 vec3 lamp=vec3(0,uCarY+2.32,-.15)-p;color+=liftBRDF(s,v,normalize(lamp))*vec3(3.,2.4,1.8)/(1.+dot(lamp,lamp));return color;}
`;
export const FINISH_DESIGN=Object.freeze({stainless:{f0:[.56,.58,.59],acrossCorrelationM:.00016,alongCorrelationM:.025,microHeightM:.00000045,alphaAcross:.24,alphaAlong:.055},paint:{source:'material-master-r06/metal-surface.mjs',wear:0,history:0,wet:0,coatingM:.00014},bevelM:.002,classification:'illustrative candidate, not measured manufacturer finish'});
