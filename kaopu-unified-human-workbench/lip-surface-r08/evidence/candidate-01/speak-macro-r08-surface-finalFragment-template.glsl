#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>

varying vec3 vFRest; varying vec4 vFA,vFB,vCSRegion; varying float vEWeight;
uniform float psSeed,psTone,psWarmth,psBlood,psVariation,psPores,psRadius,psSpacing,psMicro,psRoughness,psOil,psScatter,psFreckles,psLip,psWet,psThin,psView;
float psHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33+psSeed*.001);return fract((p.x+p.y)*p.z);}
float psNoise(vec3 p){vec3 c=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(psHash(c),psHash(c+vec3(1,0,0)),f.x),mix(psHash(c+vec3(0,1,0)),psHash(c+vec3(1,1,0)),f.x),f.y),mix(mix(psHash(c+vec3(0,0,1)),psHash(c+vec3(1,0,1)),f.x),mix(psHash(c+vec3(0,1,1)),psHash(c+vec3(1,1,1)),f.x),f.y),f.z);}
float psRegion(vec3 p,vec3 c,vec3 scale){vec3 q=(vec3(abs(p.x),p.y,p.z)-c)/scale;return exp(-dot(q,q)*1.5);}
// Filtered jittered follicle bowls: radius and depth independent, weak positive rim.
vec2 psPoreChart(vec2 q,float chart,float radius,float spacing,float footprint){
 vec2 cell=floor(q/spacing);float height=0.,pigment=0.,nearest=1e6,second=1e6;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  vec2 id=cell+vec2(float(x),float(y));vec3 key=vec3(id,chart);
  vec2 jitter=vec2(psHash(key),psHash(key+vec3(19.1,73.7,2.1)));
  vec2 delta=q-(id+.14+.72*jitter)*spacing;
  float rr=radius*mix(.62,1.35,psHash(key+4.3));float r2=rr*rr;
  float filteredArea=r2+footprint*footprint*.24;
  float d2=dot(delta,delta);if(d2<nearest){second=nearest;nearest=d2;}else if(d2<second){second=d2;}float bowl=exp(-d2/filteredArea)*r2/filteredArea;
  float rim=exp(-d2/(filteredArea*3.8))*r2/filteredArea;
  float presence=smoothstep(.12,.30,psHash(key+12.4));
  height+=(-bowl+.085*rim)*presence;pigment+=bowl*.12*presence;
 }
 float gap=sqrt(max(second,0.))-sqrt(max(nearest,0.));float width=.035+footprint*.45;float crease=exp(-gap*gap/(width*width))*.035/width;return vec2(height,crease);
}
vec2 psPoreSurface(vec3 mm,vec3 weights,float radius,float spacing,float footprint){
 vec3 warp=vec3(psNoise(mm*.10+11.7),psNoise(mm*.10+33.1),psNoise(mm*.10+78.2))-.5;mm+=warp*.20;
 return psPoreChart(mm.yz,7.,radius,spacing,footprint)*weights.x+psPoreChart(mm.xz,31.,radius,spacing,footprint)*weights.y+psPoreChart(mm.xy,61.,radius,spacing,footprint)*weights.z;
}
float psFreckleField(vec3 mm){float cluster=smoothstep(.65,.89,psNoise(mm*.17+19.));float dots=pow(clamp(psNoise(mm*2.1+4.),0.,1.),9.);return clamp(cluster*dots*10.,0.,1.);}
vec3 psToLinear(vec3 s){return mix(s/12.92,pow((s+.055)/1.055,vec3(2.4)),step(vec3(.04045),s));}

varying vec3 vCSRest;varying vec4 vCSExtra;
uniform vec3 csTone;uniform float csRoughness,csOil,csVariation,csRedness,csDetail,csAge;
float pcBlend=1.,pcR=.6,pcH=0.,pcCoat=0.,pcCoatR=.4;
float pcHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float pcNoise(vec3 p){vec3 c=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(pcHash(c),pcHash(c+vec3(1,0,0)),f.x),mix(pcHash(c+vec3(0,1,0)),pcHash(c+vec3(1,1,0)),f.x),f.y),mix(mix(pcHash(c+vec3(0,0,1)),pcHash(c+vec3(1,0,1)),f.x),mix(pcHash(c+vec3(0,1,1)),pcHash(c+vec3(1,1,1)),f.x),f.y),f.z);}
vec3 pcToSRGB(vec3 c){return mix(c*12.92,1.055*pow(max(c,vec3(0.)),vec3(1./2.4))-.055,step(vec3(.0031308),c));}
vec3 pcBoundary(){
 float cover=clamp(vCSRegion.x,0.,1.),t=clamp(vCSRegion.z,0.,1.),cheek=clamp(vCSRegion.w,0.,1.);
 float thin=clamp(vCSExtra.x,0.,1.),dry=clamp(vCSExtra.y,0.,1.),palm=clamp(vCSExtra.z,0.,1.);
 float macro=(pcNoise(vCSRest*73.7)-.5)*.6+(pcNoise(vCSRest*263.1)-.5)*.4;
 vec3 base=csTone*(1.+macro*csVariation*.11);
 base*=vec3(1.+cheek*csRedness*.12,1.-cheek*csRedness*.13,1.-cheek*csRedness*.09);
 base=mix(base,base*vec3(.94,.92,.95),thin*.27);
 base=mix(base,min(base*1.17+vec3(.014,.009,.005),vec3(.9)),palm*.55);
 pcR=clamp(csRoughness-t*.13+dry*.09+palm*.035+macro*.035*csVariation,.27,.9);
 float pores=pcNoise(vCSRest*1650.)-.5,fine=pcNoise(vCSRest*4900.+vec3(11.7))-.5,meso=pcNoise(vCSRest*370.+vec3(4.3))-.5;
 pcH=(pores*.000015+fine*.0000025+meso*.000020)*(1.+t*.5+dry*.45-thin*.55)*(0.7+csAge*.45)*csDetail*cover;
 pcCoat=cover*clamp(csOil*(.25+t*.65),0.,.55);pcCoatR=.4-t*.08;
 return base;
}

uniform float uE6Enabled;uniform vec3 uE6WorldDirections[3];varying vec3 vE6Direct;varying float vE6Weight;
float hcEarVisibility(vec3 direction){float agreement=-2.,visible=1.;for(int i=0;i<3;i++){vec3 d=normalize((viewMatrix*vec4(uE6WorldDirections[i],0.)).xyz);float a=dot(direction,d);if(a>agreement){agreement=a;visible=vE6Direct[i];}}return mix(1.,clamp(visible,0.,1.),clamp(vE6Weight,0.,1.)*uE6Enabled);}

uniform float fbEnabled,fbRegional,fbLidWarmth,fbNoseWarmth,fbEarBlood,fbTransmission,fbVariation,fbPores,fbJointTone,fbNeckCreases,fbBeard,fbAudit;
uniform vec3 fbRestOffset;
varying vec4 vETissue;varying vec3 vE6Deep;
float fbHead=0.,fbBody=0.,fbLid=0.,fbCanthus=0.,fbNose=0.,fbCheek=0.,fbEarRim=0.,fbEarLobe=0.,fbGlabrous=0.,fbDry=0.,fbBloodMask=0.,fbNeck=0.,fbPoreGain=1.;
vec3 fbGeomN=vec3(0.,0.,1.);
float fbBell(vec3 p,vec3 c,vec3 r){vec3 q=(p-c)/r;return exp(-dot(q,q)*1.5);}
float fbDeepVisibility(vec3 direction){float best=-2.,value=0.;for(int i=0;i<3;i++){vec3 d=normalize((viewMatrix*vec4(uE6WorldDirections[i],0.)).xyz);float a=dot(direction,d);if(a>best){best=a;value=vE6Deep[i];}}return best>.97?clamp(value,0.,1.):0.;}

vec3 psBase=vec3(0.);float psR=0.,psL=0.,psT=0.,psE=0.,psH=0.,psThinMask=0.;

#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>

// Bounded shadow-aware RGB light wrap, not measured/full volume transport.
void psDirect(const in IncidentLight light,const in vec3 pos,const in vec3 N,const in vec3 V,const in vec3 CN,const in PhysicalMaterial material,inout ReflectedLight reflectedLight){
 IncidentLight hcLight=light;hcLight.color*=hcEarVisibility(light.direction);RE_Direct_Physical(hcLight,pos,N,V,CN,material,reflectedLight);
 float ndl=dot(N,light.direction);vec3 width=vec3(.22,.105,.055)*psScatter;
 vec3 wrap=clamp((vec3(ndl)+width)/(1.+width),0.,1.);
 reflectedLight.directDiffuse+=(wrap-vec3(max(ndl,0.)))*hcLight.color*BRDF_Lambert(material.diffuseColor)*.46*pcBlend;

 // Native R05 measured geometric path / confidence + R06 exit visibility.
 // Effective RGB attenuation is artist-calibrated, not full spectral volume transport.
 if(fbEnabled>.5&&psE>.001&&fbTransmission>.0){
  float fnl=dot(fbGeomN,light.direction);
  float pathMM=clamp(vETissue.x,.15,35.)/max(abs(fnl),.40);
  vec3 extinction=mix(vec3(.20,.49,.78),vec3(.18,.44,.70),fbEarLobe);
  vec3 transmitted=exp(-extinction*pathMM)*max(-fnl,0.);
  float confidence=clamp(vETissue.y,0.,1.)*fbDeepVisibility(light.direction);
  reflectedLight.directDiffuse+=light.color*BRDF_Lambert(material.diffuseColor)*transmitted*confidence*psE*(1.10*fbTransmission);
 }

}
#undef RE_Direct
#define RE_Direct psDirect

#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

// LIP-REALISM-R01: all coordinates are attached to the inherited lip rest frame.
varying vec4 vL19State,vL19Detail;
uniform float lrEnabled,lrRedness,lrPigment,lrUpperDifference,lrVariation,lrEdgeSoftness,lrWetness,lrRoughness,lrFoldStrength,lrSeed,lrDiagnostic;
uniform float lrRevision;
float lrMask=0.,lrScope=0.,lrUpper=0.,lrDepth=0.,lrWet=0.,lrR=0.,lrHeight=0.;
vec3 lrSkinSrgb=vec3(0.),lrAlbedo=vec3(0.);
vec3 lrTissueAlbedo=vec3(0.);float lrOuterBlend=0.;
float lrTop(float x){if(x<=-0.025241218)return 0.230674872;if(x<=-0.017426041){float t=clamp((x-(-0.025241218))/0.007815176,0.,1.);float t2=t*t,t3=t2*t;return (2.*t3-3.*t2+1.)*0.230674872+(t3-2.*t2+t)*0.005133142+(-2.*t3+3.*t2)*0.235808014+(t3-t2)*0.004558758;}if(x<=-0.009139501){float t=clamp((x-(-0.017426041))/0.008286540,0.,1.);float t2=t*t,t3=t2*t;return (2.*t3-3.*t2+1.)*0.235808014+(t3-2.*t2+t)*0.004833714+(-2.*t3+3.*t2)*0.240067344+(t3-t2)*0.001806606;}if(x<=0.000011541){float t=clamp((x-(-0.009139501))/0.009151042,0.,1.);float t2=t*t,t3=t2*t;return (2.*t3-3.*t2+1.)*0.240067344+(t3-2.*t2+t)*0.001995082+(-2.*t3+3.*t2)*0.239609702+(t3-t2)*0.000008259;}if(x<=0.009205195){float t=clamp((x-(0.000011541))/0.009193654,0.,1.);float t2=t*t,t3=t2*t;return (2.*t3-3.*t2+1.)*0.239609702+(t3-2.*t2+t)*0.000008298+(-2.*t3+3.*t2)*0.240083901+(t3-t2)*-0.001958994;}if(x<=0.017558544){float t=clamp((x-(0.009205195))/0.008353349,0.,1.);float t2=t*t,t3=t2*t;return (2.*t3-3.*t2+1.)*0.240083901+(t3-2.*t2+t)*-0.001779941+(-2.*t3+3.*t2)*0.235870767+(t3-t2)*-0.004824508;}if(x<=0.025414154){float t=clamp((x-(0.017558544))/0.007855611,0.,1.);float t2=t*t,t3=t2*t;return (2.*t3-3.*t2+1.)*0.235870767+(t3-2.*t2+t)*-0.004537037+(-2.*t3+3.*t2)*0.230722357+(t3-t2)*-0.005148411;}return 0.230722357;}
float lrBottom(float x){if(x<=-0.025241218)return 0.230674872;if(x<=-0.018607258){float t=clamp((x-(-0.025241218))/0.006633959,0.,1.);float t2=t*t,t3=t2*t;return (2.*t3-3.*t2+1.)*0.230674872+(t3-2.*t2+t)*-0.004176433+(-2.*t3+3.*t2)*0.226498439+(t3-t2)*-0.003226911;}if(x<=-0.011371004){float t=clamp((x-(-0.018607258))/0.007236254,0.,1.);float t2=t*t,t3=t2*t;return (2.*t3-3.*t2+1.)*0.226498439+(t3-2.*t2+t)*-0.003519881+(-2.*t3+3.*t2)*0.223928080+(t3-t2)*-0.001241462;}if(x<=0.000008352){float t=clamp((x-(-0.011371004))/0.011379356,0.,1.);float t2=t*t,t3=t2*t;return (2.*t3-3.*t2+1.)*0.223928080+(t3-2.*t2+t)*-0.001952258+(-2.*t3+3.*t2)*0.223304719+(t3-t2)*-0.000052479;}if(x<=0.011388176){float t=clamp((x-(0.000008352))/0.011379825,0.,1.);float t2=t*t,t3=t2*t;return (2.*t3-3.*t2+1.)*0.223304719+(t3-2.*t2+t)*-0.000052481+(-2.*t3+3.*t2)*0.223823119+(t3-t2)*0.001871489;}if(x<=0.018693941){float t=clamp((x-(0.011388176))/0.007305765,0.,1.);float t2=t*t,t3=t2*t;return (2.*t3-3.*t2+1.)*0.223823119+(t3-2.*t2+t)*0.001201482+(-2.*t3+3.*t2)*0.226377690+(t3-t2)*0.003593632;}if(x<=0.025414154){float t=clamp((x-(0.018693941))/0.006720213,0.,1.);float t2=t*t,t3=t2*t;return (2.*t3-3.*t2+1.)*0.226377690+(t3-2.*t2+t)*0.003305605+(-2.*t3+3.*t2)*0.230722357+(t3-t2)*0.004344667;}return 0.230722357;}
float lrInnerTop(float x){if(x<=-0.022988267)return 0.230345465;if(x<=-0.012185731){float t=clamp((x-(-0.022988267))/0.010802536,0.,1.);float t2=t*t,t3=t2*t;return (2.*t3-3.*t2+1.)*0.230345465+(t3-2.*t2+t)*0.003327049+(-2.*t3+3.*t2)*0.233672513+(t3-t2)*0.001965430;}if(x<=0.000020084){float t=clamp((x-(-0.012185731))/0.012205814,0.,1.);float t2=t*t,t3=t2*t;return (2.*t3-3.*t2+1.)*0.233672513+(t3-2.*t2+t)*0.002220745+(-2.*t3+3.*t2)*0.234531639+(t3-t2)*-0.000007347;}if(x<=0.012307430){float t=clamp((x-(0.000020084))/0.012287346,0.,1.);float t2=t*t,t3=t2*t;return (2.*t3-3.*t2+1.)*0.234531639+(t3-2.*t2+t)*-0.000007396+(-2.*t3+3.*t2)*0.233657770+(t3-t2)*-0.002214008;}if(x<=0.023151093){float t=clamp((x-(0.012307430))/0.010843663,0.,1.);float t2=t*t,t3=t2*t;return (2.*t3-3.*t2+1.)*0.233657770+(t3-2.*t2+t)*-0.001953876+(-2.*t3+3.*t2)*0.230363755+(t3-t2)*-0.003294014;}return 0.230363755;}
float lrInnerBottom(float x){if(x<=-0.022988267)return 0.230345465;if(x<=-0.012351627){float t=clamp((x-(-0.022988267))/0.010636639,0.,1.);float t2=t*t,t3=t2*t;return (2.*t3-3.*t2+1.)*0.230345465+(t3-2.*t2+t)*0.000131171+(-2.*t3+3.*t2)*0.230476636+(t3-t2)*-0.000193490;}if(x<=-0.000021753){float t=clamp((x-(-0.012351627))/0.012329874,0.,1.);float t2=t*t,t3=t2*t;return (2.*t3-3.*t2+1.)*0.230476636+(t3-2.*t2+t)*-0.000224291+(-2.*t3+3.*t2)*0.229927684+(t3-t2)*-0.000002766;}if(x<=0.012357372){float t=clamp((x-(-0.000021753))/0.012379125,0.,1.);float t2=t*t,t3=t2*t;return (2.*t3-3.*t2+1.)*0.229927684+(t3-2.*t2+t)*-0.000002777+(-2.*t3+3.*t2)*0.230471092+(t3-t2)*0.000232953;}if(x<=0.023151093){float t=clamp((x-(0.012357372))/0.010793721,0.,1.);float t2=t*t,t3=t2*t;return (2.*t3-3.*t2+1.)*0.230471092+(t3-2.*t2+t)*0.000203119+(-2.*t3+3.*t2)*0.230363755+(t3-t2)*-0.000107337;}return 0.230363755;}
float lrHash(vec2 p){vec3 q=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));q+=dot(q,q.yzx+31.32+lrSeed*.00071);return fract((q.x+q.y)*q.z);}
float lrNoise(vec2 p){vec2 i=floor(p),v=fract(p);v=v*v*(3.-2.*v);return mix(mix(lrHash(i),lrHash(i+vec2(1,0)),v.x),mix(lrHash(i+vec2(0,1)),lrHash(i+vec2(1,1)),v.x),v.y);}
// Jittered finite grooves with connected short branches. No repeating sine rows.
// Spacing and heights below are engineering initial values, in mm and metres.
float lrFolds(vec2 mm,float depth,float upper,float footprint){
 float spacing=1.05,cell=floor(mm.x/spacing),height=0.;
 for(int j=-1;j<=1;j++){
  float id=cell+float(j);vec2 k=vec2(id,upper*97.+23.);
  float a=lrHash(k),b=lrHash(k+17.7),c=lrHash(k+54.1),d=lrHash(k+91.3);
  float root=(id+.13+.74*a)*spacing;
  float start=.035+.18*b,end=.60+.36*c;
  float tangent=(a-.5)*.34+(root/25.327685970)*.20;
  float center=root+tangent*(depth-.40)+(b-.5)*.18*depth*(1.-depth)*4.;
  float width=.035+.030*d,filterWidth=sqrt(width*width+footprint*footprint*.30);
  float along=smoothstep(start,start+.13,depth)*(1.-smoothstep(end-.17,end,depth));
  float delta=(mm.x-center)/filterWidth;
  float primary=-exp(-delta*delta)*along;
  float branchStart=.24+.20*c,branchEnd=min(.96,branchStart+.17+.18*a);
  float t=clamp((depth-branchStart)/max(.04,branchEnd-branchStart),0.,1.);
  float branchCenter=center+mix(-1.,1.,step(.5,d))*(.14+.26*b)*t*t*(3.-2.*t);
  float branchDelta=(mm.x-branchCenter)/(filterWidth*.72);
  float branch=-exp(-branchDelta*branchDelta)*smoothstep(0.,.2,t)*(1.-smoothstep(.72,1.,t));
  height+=(primary+.32*branch)*(.000005+.000006*c)*(width/filterWidth);
 }
 float crossField=lrNoise(mm*vec2(.47,3.0)+upper*41.);
 float crossFold=-pow(clamp((crossField-.48)*2.,0.,1.),3.)*.0000024;
 float micro=(lrNoise(mm*vec2(5.1,6.3)+upper*71.)-.5)*.0000016;
 float visibility=1.-smoothstep(.055,.34,footprint);
 return (height+crossFold+micro)*visibility*smoothstep(-.08,.12,depth)*(1.-smoothstep(.86,1.08,depth));
}
void lrEvaluate(float oldMask){
 float top=lrTop(vFRest.x),bottom=lrBottom(vFRest.x),it=lrInnerTop(vFRest.x),ib=lrInnerBottom(vFRest.x);
 float u=(vFRest.x-0.000086468)/0.025327686;
 lrUpper=step((it+ib)*.5,vFRest.y);
 lrDepth=mix((ib-vFRest.y)/max(.001,ib-bottom),(vFRest.y-it)/max(.001,top-it),lrUpper);
 vec2 mm=(vFRest.xy-vec2(0.000086468,0.232229661))*1000.;
 float footprint=max(length(dFdx(mm)),length(dFdy(mm)));
 // R08 edge: narrower, spatially varying shared exterior coverage; engineering metres.
 float edgeWidth=mix(.00011,.00046,lrEdgeSoftness)*(.55+.90*lrNoise(vec2(u*6.+13.,lrUpper*9.)));
 float aa=max(fwidth(vFRest.y)*.65,edgeWidth);
 float contourJitter=(lrNoise(mm*vec2(1.8,1.1))-.5)*.00015;
 float y=vFRest.y+contourJitter;
 float cover=clamp(vCSRegion.x,0.,1.);
 float front=smoothstep(0.111193347,0.117193347,vFRest.z);
 float lateral=1.-smoothstep(.965,1.005,abs(u));
 float shape=smoothstep(bottom-aa,bottom+aa,y)*(1.-smoothstep(top-aa,top+aa,y));
 lrMask=shape*lateral*front*cover*smoothstep(0.,.0006,max(0.,top-bottom));
 // Audit/legacy-replacement domain only. R02 never uses this as another alpha.
 lrScope=max(lrMask,oldMask)*front*cover;
 // Derivatives above are evaluated for every fragment before this branch.
 // Unrelated face/body pixels need no tissue noise or groove evaluation.
 if(lrScope==0.)return;
 float tissue=(lrNoise(vec2(u*3.4,lrDepth*2.0)+vec2(31.,lrUpper*7.))-.5);
 float smallTissue=(lrNoise(mm*.48+vec2(11.,lrUpper*37.))-.5);
 float pigmentField=.65+.35*lrNoise(vec2(u*2.6+4.,lrDepth*1.7+lrUpper*8.));
 float wetBand=(1.-smoothstep(.015,.30,lrDepth));
 lrWet=clamp(max(wetBand,clamp(vL19State.x,0.,1.)),0.,1.)*lrMask*(.76+.24*lrNoise(mm*.7+61.));
 float tone=smoothstep(.26,.78,dot(lrSkinSrgb,vec3(.2126,.7152,.0722)));
 vec3 color=mix(vec3(.34,.20,.19),vec3(.77,.54,.51),tone);
 color+=vec3(.10,-.055,-.025)*(lrRedness-.44);
 color*=exp(-vec3(.18,.27,.28)*lrPigment*pigmentField);
 color*=exp(-vec3(.15,.13,.09)*lrUpperDifference*lrUpper);
 // R08 colour: separate signed chroma and absorption-like appearance fields.
 // Existing palette, upper/lower controls and rest seed remain the owners.
 // The fields have zero-centred construction, NOT an asserted exact image mean.
 // Their coefficients are artistic engineering choices, not measured blood or melanin.
 float lsSmall=(smallTissue*2.);
 float lsBroad=(tissue*2.);
 // Fade only this new fine field when its rest-space pixel footprint grows.
 float lsFine=(lrNoise(mm*vec2(1.15,1.65)+vec2(47.,lrUpper*19.+8.))-.5)*2.*(1.-smoothstep(.16,.42,footprint));
 float lsBlood=.28*lsBroad+.54*lsSmall+.18*lsFine;
 float lsPigment=(pigmentField-.825)/.175;
 float lsExterior=(1.-clamp(vL19State.x,0.,1.))*smoothstep(-.05,.15,lrDepth);
 float lsGain=lrVariation*lsExterior;
 color+=vec3(.115,-.060,-.035)*lsBlood*lsGain;
 color*=exp(-vec3(.115,.180,.235)*lsPigment*lsGain);
 color*=1.+lsFine*.035*lsGain;
 // Tissue colour and saliva-film controls are intentionally independent.
 color=mix(color,color*vec3(.90,.85,.91),wetBand*.18);
 // R08 edge: keep the skin transition close to the inherited exterior rail.
 float outer=smoothstep(.78,1.04,lrDepth)*(.28+.24*lrNoise(mm*.30+13.));
 // Keep the exact R01 colour below for a matched comparison. R02 uses the
 // same palette, DNA, seed, geometry and light. Added pigment, inner darkening
 // and extra exterior blending were rejected by actual image review.
 lrOuterBlend=outer;
 lrTissueAlbedo=psToLinear(clamp(color,.006,.93));
 color=mix(color,lrSkinSrgb,outer);
 lrAlbedo=psToLinear(clamp(color,.006,.93));
 float roughVariation=(lrNoise(mm*.8+vec2(19.,3.))-.5)*.032;
 lrR=clamp(lrRoughness+lrUpper*.016+roughVariation-lrWetness*lrWet*.20,.28,.80);
 float strain=clamp(vL19State.y,.72,1.5);
 lrHeight=lrFolds(mm,lrDepth,lrUpper,footprint)*lrFoldStrength/strain;
 lrHeight*=1.-lrWet*.16*lrWetness;
}

// LIP-INNER-R04 continuous native oral responsibility
varying float vCSType;
uniform vec3 csLipColor;
uniform float csLipMix,uLEnabled,uLPigment,uLUpperShade,uLWet,uLRough,uL19Oxygen;
uniform vec2 uL19Mel,uL19Blood,uL19Rough,uL19Wet;
uniform float liEnabled,liDiagnostic;
float liOral=0.,liWeight=0.,liWetGain=0.;

void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>

 vec3 psP=mix(vFRest,vCSRest-fbRestOffset,fbEnabled),psMM=psP*1000.;
 psL=clamp(max(vCSRegion.y,vFA.y),0.,1.);psT=clamp(max(vFA.w,vFB.x*.66),0.,1.);psE=clamp(vEWeight,0.,1.);psThinMask=clamp(vFA.z,0.,1.);
 float psCheek=psRegion(psP,vec3(.038,.273,.056),vec3(.033,.034,.060));
 float psLowerEye=psRegion(psP,vec3(.031,.289,.060),vec3(.026,.009,.035));
 float psJaw=psRegion(psP,vec3(.042,.228,.027),vec3(.043,.023,.060));
 
 // Head masks use the native template frame. Body detail uses the SAME continuous rest field.
 vec3 fbQ=vec3(abs(psP.x),psP.y,psP.z);
 fbHead=smoothstep(.130,.240,psP.y);fbBody=1.-fbHead;
 fbLid=fbBell(fbQ,vec3(.031,.292,.108),vec3(.023,.0065,.025));
 fbCanthus=fbBell(fbQ,vec3(.015,.300,.113),vec3(.005,.005,.013));
 fbNose=.60*fbBell(fbQ,vec3(.018,.267,.122),vec3(.012,.011,.022))+.28*fbBell(fbQ,vec3(.004,.278,.137),vec3(.013,.012,.019));
 fbCheek=fbBell(fbQ,vec3(.044,.280,.080),vec3(.036,.029,.043));
 fbEarRim=psE*fbBell(fbQ,vec3(.077,.284,.009),vec3(.030,.027,.013));
 fbEarLobe=psE*fbBell(fbQ,vec3(.080,.249,.026),vec3(.030,.012,.017));
 fbDry=clamp(vCSExtra.y*2.,0.,1.)*fbBody;
 float fbSole=(1.-smoothstep(-.978,-.950,vCSRest.y))*fbBody;
 fbGlabrous=clamp(max(vCSExtra.z,fbSole),0.,1.);
 fbNeck=fbBell(fbQ,vec3(.025,.124,.033),vec3(.080,.080,.070))*(1.-smoothstep(.185,.225,psP.y));
 fbPoreGain=mix(1.,fbPores*.90,fbBody)*(1.-fbGlabrous*.98);
 fbBloodMask=clamp(fbLid*fbLidWarmth*.72+fbCanthus*fbLidWarmth*.80+fbNose*fbNoseWarmth+fbCheek*.15+psE*fbEarBlood*(.26+.50*fbEarRim+.36*fbEarLobe),0.,1.);

 float psMacro=(psNoise(psMM*.045)-.5)*.60+(psNoise(psMM*.14+11.)-.5)*.28+(psNoise(psMM*.6+39.)-.5)*.12;
 vec3 psSrgb=pcToSRGB(mix(psToLinear(vec3(.32,.20,.14)),psToLinear(vec3(.86,.715,.625)),psTone));
 psSrgb+=vec3(.045,-.004,-.045)*(psWarmth-.5);psSrgb*=1.+psMacro*.105*psVariation*mix(1.,.32,fbBody*fbEnabled);
 float psRed=(.18+.45*psCheek+.30*psT+.32*psE)*(psBlood-.20);psSrgb+=vec3(.065,-.050,-.040)*psRed;
 psSrgb=mix(psSrgb,psSrgb*vec3(.88,.86,.91),psLowerEye*psThin*mix(.44,.19,fbEnabled));psSrgb=mix(psSrgb,psSrgb*vec3(.98,.98,1.025),psJaw*.13);
 vec3 psRestN=normalize(cross(dFdx(psMM),dFdy(psMM)));vec3 psWeights=pow(abs(psRestN),vec3(8.));psWeights/=max(dot(psWeights,vec3(1.)),.00001);
 float psFoot=max(length(dFdx(psMM)),length(dFdy(psMM)));
 psSrgb*=exp(-psFreckleField(psMM)*psFreckles*(.24+.76*psCheek)*vec3(.30,.46,.57));
 float psLipFeather=smoothstep(.02,.94,psL);lrSkinSrgb=psSrgb;lrEvaluate(psLipFeather);vec3 psLipColour=psSrgb*vec3(1.01,.74,.83)+vec3(.018,.004,.009);
 psLipColour=mix(psSrgb*vec3(1.0,.82,.84),psLipColour,psLip);if(!(lrEnabled>.5&&lrRevision>1.5&&lrScope>0.))psSrgb=mix(psSrgb,psLipColour,psLipFeather);
 
 // Restrained, correlated colour layers; never baked shadows or uniform red rings.
 if(fbEnabled>.5){
  float tissueNoise=.80+.20*psNoise(psMM*.095+vec3(9.,31.,67.));
  float warm=fbBloodMask*fbRegional*tissueNoise;
  psSrgb*=vec3(1.+.045*warm,1.-.145*warm,1.-.105*warm);
  float forehead=fbBell(fbQ,vec3(.021,.347,.065),vec3(.063,.031,.077));
  float temple=fbBell(fbQ,vec3(.069,.321,.023),vec3(.020,.032,.033));
  psSrgb+=fbRegional*(vec3(.008,.003,-.006)*forehead+vec3(-.005,-.004,.001)*temple);
  float beard=fbBell(fbQ,vec3(.016,.214,.082),vec3(.050,.027,.041))+.40*fbBell(fbQ,vec3(.020,.243,.106),vec3(.030,.011,.018));
  psSrgb*=exp(-vec3(.080,.070,.046)*beard*fbBeard*(1.-psLipFeather));
  float bodyMottle=(psNoise(psMM*.062+vec3(14.,61.,23.))-.5)*.60+(psNoise(psMM*.21+vec3(43.))-.5)*.40;
  psSrgb*=1.+bodyMottle*.045*fbVariation*fbBody;
  // A smooth exposure tendency, not a neck seam or an automatic tan line.
  psSrgb+=vec3(.008,.010,.009)*fbBody*fbVariation;
  psSrgb*=exp(-vec3(.085,.115,.120)*fbDry*fbJointTone);
  psSrgb=mix(psSrgb,min(psSrgb*vec3(1.07,1.10,1.085)+vec3(.005,.004,.003),vec3(.94)),fbGlabrous*(.38+.32*fbJointTone));
  psSrgb*=1.-psLipFeather*fbRegional*.035*smoothstep(.228,.240,psP.y);
 }

 pcBlend=mix(smoothstep(.190,.234,psP.y),1.,fbEnabled);vec3 pcBase=pcBoundary();psBase=mix(pcBase,psToLinear(clamp(psSrgb,.008,.94)),pcBlend);diffuseColor.rgb=psBase;
 vec2 psPore=psPoreSurface(psMM,psWeights,psRadius*(1.+psT*.22-psThinMask*.32)*mix(1.,.86,fbBody*fbEnabled),psSpacing*(1.-psT*.10)*mix(1.,1.35,fbBody*fbEnabled),psFoot);
 float pcGrain=(psNoise(psMM*3.7+vec3(91.3))-.5)*.025*psMicro;
   float pcChroma=(pcGrain+psPore.x*.08*psPores-psPore.y*.004*psMicro)*pcBlend*(1.-psLipFeather)*(1.-psThinMask*.6);
   float hcPigment=(psNoise(psMM*.19+vec3(73.))-0.5)*.72+(psNoise(psMM*.76+vec3(19.))-0.5)*.28;
    psBase*=exp(-vec3(.055,.105,.14)*hcPigment*psVariation*pcBlend*mix(1.,.52,fbBody*fbEnabled)*(1.-psLipFeather*.7));
    pcChroma*=mix(1.,.72*fbPoreGain,fbEnabled*fbBody);psBase*=clamp(1.+pcChroma,.9,1.08);diffuseColor.rgb=psBase;
   float psResolve=1.-smoothstep(.18,.72,psFoot);float psMeso=(psNoise(psMM*1.65)-.5)*.0000045;
 float psStria=sin(psMM.x*8.5+psNoise(psMM*1.05)*3.7)*.0000015;float psLipH=psStria*psMicro+(psNoise(psMM*2.2)-.5)*.0000013;
 psH=(psPore.x*.000020*psPores+(psMeso-psPore.y*.000010)*psMicro)*(1.-psThinMask*.50)*(1.-psLipFeather);psH+=psLipH*psLipFeather;psH*=psResolve;psH=mix(pcH,psH,pcBlend);
 psR=clamp(psRoughness-.13*psT*psOil+.025*psCheek+.045*psThinMask+(psNoise(psMM*.85)-.5)*.055*psMicro,.27,.89);psR=mix(psR,.44-.13*psWet,psLipFeather);psR=mix(pcR,psR,pcBlend);

	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
psR=clamp(psR+(psPore.y-.20)*.028*psMicro*pcBlend*(1.-psLipFeather),.27,.89);
 if(fbEnabled>.5){
  psH*=fbPoreGain;
  float y1=psP.y-(.112+.23*psP.x*psP.x+.0008*sin(psP.x*59.));
  float y2=psP.y-(.066+.35*psP.x*psP.x+.0010*sin(psP.x*43.+1.));
  float creases=exp(-y1*y1/.0000019)+.55*exp(-y2*y2/.0000028);
  psH-=.000028*fbNeckCreases*creases*fbNeck*(1.-smoothstep(.40,1.5,psFoot));
  // Fine palmar/plantar ridge tendency: no facial follicle holes on glabrous skin.
  float ridge=sin(psMM.y*11.+psNoise(psMM*.34)*4.2)*sin(psMM.x*2.4+psNoise(psMM*.23));
  psH+=ridge*.000006*fbGlabrous*fbPores*(1.-smoothstep(.06,.26,psFoot));
  psR=clamp(psR+fbBody*(.045+.060*fbDry)-fbGlabrous*.025,.27,.89);
 }

 
 // Final lip ownership comes AFTER all inherited skin colour and relief layers.
 if(lrEnabled>.5&&lrScope>0.){
  if(lrRevision>1.5){
   // psBase now includes every inherited skin pigment/chroma/region layer.
   // One native-tissue coverage, one linear-light compositing operation.
   psBase=mix(psBase,lrTissueAlbedo,lrMask*(1.-lrOuterBlend));
  }else{
   vec3 boundedBase=mix(psToLinear(clamp(lrSkinSrgb,.008,.94)),lrAlbedo,lrMask);
   psBase=mix(psBase,boundedBase,lrScope);
  }
  diffuseColor.rgb=psBase;
  if(lrMask>0.){psH=mix(psH,lrHeight,lrMask);psR=mix(psR,lrR,lrMask);}
 }
 
 // Semantic ownership is independent of external lip silhouette and camera.
 // csType guards teeth/gums/tongue; the shared procedural slot is skin-only.
 liOral=clamp(vL19State.x,0.,1.)*clamp(vCSRegion.x,0.,1.)*(1.-step(.5,vCSType));
 liWeight=liEnabled>.5?liOral*clamp(uLEnabled,0.,1.):0.;
 if(liWeight>0.){
  // The original inner rails define upper/lower throughout the mouth.
  // vL19Detail.z is incomplete on deep oral vertices and is not used here.
  float liUpper=step((lrInnerTop(vFRest.x)+lrInnerBottom(vFRest.x))*.5,vFRest.y);
  float liMel=mix(uL19Mel.x,uL19Mel.y,liUpper);
  float liBlood=mix(uL19Blood.x,uL19Blood.y,liUpper);
  liWetGain=clamp(uLWet/.35*mix(uL19Wet.x,uL19Wet.y,liUpper),0.,1.);
  vec3 liColor=mix(pcBase,csLipColor,clamp(csLipMix*(.43+uLPigment*.30+liBlood*.25),0.,.94));
  liColor*=exp(-liMel*vec3(.20,.31,.42));
  liColor*=vec3(1.+liBlood*.10,1.-liBlood*.10,1.-liBlood*(.035+.06*uL19Oxygen));
  liColor*=1.-liUpper*uLUpperShade*.14+(1.-liUpper)*.022;
  // U5's full mucosa tint. Coverage belongs to liWeight, not the target colour.
  liColor=mix(liColor,liColor*vec3(.83,.67,.68),.72);
  liColor=mix(liColor,pcBase*1.04,clamp(vL19State.w*.25,0.,.3));
  psBase=mix(psBase,liColor,liWeight);
  diffuseColor.rgb=psBase;
  float liRough=clamp(mix(uL19Rough.x,uL19Rough.y,liUpper)+(uLRough-.53)*.65+(csRoughness-.62)*.30-liWetGain*.21,.28,.79);
  psR=mix(psR,liRough,liWeight);
  // R07's follicle/skin height has no oral ownership. Fade that shader field
  // out continuously; preserve mesh normals and all native geometric folds.
  // The inherited dFdx/dFdy normal evaluation still has its usual quad support.
  psH*=1.-liWeight;
 }
 roughnessFactor=psR;
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
   fbGeomN=normal;vec3 psDx=dFdx(-vViewPosition),psDy=dFdy(-vViewPosition),psR1=cross(psDy,normal),psR2=cross(normal,psDx);float psDet=dot(psDx,psR1);
   if(abs(psDet)>1e-14){vec3 slope=sign(psDet)*(dFdx(psH)*psR1+dFdy(psH)*psR2)/abs(psDet);slope*=min(1.,.26/max(length(slope),.0001));normal=normalize(normal-slope);}
  
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
   material.clearcoat=clamp(.006+.038*psOil*psT+.055*psWet*psL,0.,.12);material.clearcoatRoughness=mix(.48,.35,psL);material.clearcoat=mix(pcCoat,material.clearcoat,pcBlend);material.clearcoatRoughness=mix(pcCoatR,material.clearcoatRoughness,pcBlend);material.specularColor*=mix(.52/.80,1.,pcBlend);material.specularF90*=mix(.52/.80,1.,pcBlend);clearcoatNormal=normal;
 if(lrEnabled>.5&&lrMask>0.){
  material.clearcoat=mix(material.clearcoat,.010+.20*lrWetness*lrWet,lrMask);
  material.clearcoatRoughness=mix(material.clearcoatRoughness,.34-.12*lrWetness*lrWet,lrMask);
 }
  
	
 #ifdef USE_CLEARCOAT
 if(liWeight>0.){
  material.clearcoat=mix(material.clearcoat,.010+csOil*.025+liWetGain*.32,liWeight);
  material.clearcoatRoughness=mix(material.clearcoatRoughness,.43-liWetGain*.24,liWeight);
 }
 #endif
 #include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	
   
 // Preserve U5's bounded visibility approximation only on the oral-skin domain.
 // Do this before every existing diagnostic override, not after those views.
 if(liWeight>0.){
  float liVisibility=.12+.88*exp(-max(0.,vL19Detail.w)*120.);
  outgoingLight*=mix(1.,liVisibility,liWeight);
 }
 if(psView>.5&&psView<1.5)outgoingLight=psBase;
   if(psView>1.5&&psView<2.5)outgoingLight=vec3(psR);
   if(psView>2.5&&psView<3.5)outgoingLight=normal*.5+.5;
   if(psView>3.5&&psView<4.5)outgoingLight=vec3(clamp(.5+psH*20000.,0.,1.));
   if(psView>4.5)outgoingLight=vec3(psT,psThinMask,psL);
   
   if(fbEnabled>.5&&fbAudit>.5&&fbAudit<1.5)outgoingLight=vec3(fbBloodMask,fbGlabrous,fbNeck);
   if(fbEnabled>.5&&fbAudit>1.5&&fbAudit<2.5)outgoingLight=mix(vec3(.035),vec3(exp(-clamp(vETissue.x,.15,35.)*.30),clamp(vETissue.y,0.,1.),0.),psE);
   if(fbEnabled>.5&&fbAudit>2.5&&fbAudit<3.5)outgoingLight=vec3(.15,.60,.32);
   if(fbEnabled>.5&&fbAudit>3.5)outgoingLight=psBase;
   
 if(lrDiagnostic>.5&&lrDiagnostic<1.5)outgoingLight=vec3(step(.000005,lrScope)*8.);
 if(lrDiagnostic>1.5&&lrDiagnostic<2.5)outgoingLight=psBase;
 if(lrDiagnostic>2.5&&lrDiagnostic<3.5)outgoingLight=vec3(psR);
 if(lrDiagnostic>3.5)outgoingLight=normal*.5+.5;
 
 // Identity remains available in both R04 and R02 comparison modes.
 // Purple identifies continuous oral SKIN; unchanged native teeth are not it.
 // Fixed native debug colours keep this view independent of beauty settings.
 if(liDiagnostic>.5)outgoingLight=mix(vec3(.35,.40,.45),vec3(.22,.08,.46),liOral);
 #include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}