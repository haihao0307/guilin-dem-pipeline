/* R01-C2: linear colour interpolation and continuous native/procedural neck.
 * The boundary equations below are the retained platform's own numerical body
 * material, not image data or reference sampling. No model/attribute edits. */
(()=>{'use strict';
const boundary=`
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
`;
function once(s,a,b){if(s.split(a).length!==2)throw Error('R01-C2 shader contract '+a);return s.replace(a,()=>b);}
window.__installHeadCalibration=function(api,v){
 const panel=document.querySelector('#ps-controls'),shell=document.querySelector('#control-shell');if(!panel||!shell)throw Error('皮肤面板主入口缺失');shell.prepend(panel);shell.style.display='block';shell.style.overflowY='auto';shell.style.overflowX='hidden';panel.style.flexShrink='0';
 const style=document.createElement('style');style.textContent='#control-shell>.preset-host{height:auto;min-height:280px}#ps-controls{max-width:100%;box-sizing:border-box}';document.head.append(style);
 const mat=api.material(),prior=mat.onBeforeCompile,oldKey=mat.customProgramCacheKey;
 mat.onBeforeCompile=s=>{prior(s);s.fragmentShader=once(s.fragmentShader,'vec3 psBase=vec3(0.);',boundary+'\nvec3 psBase=vec3(0.);');
  s.fragmentShader=once(s.fragmentShader,'vec3 psSrgb=mix(vec3(.30,.19,.135),vec3(.82,.65,.54),psTone);','vec3 psSrgb=pcToSRGB(mix(psToLinear(vec3(.32,.20,.14)),psToLinear(vec3(.86,.715,.625)),psTone));');
  s.fragmentShader=once(s.fragmentShader,'psBase=psToLinear(clamp(psSrgb,.008,.94));diffuseColor.rgb=psBase;','pcBlend=smoothstep(.190,.234,psP.y);vec3 pcBase=pcBoundary();psBase=mix(pcBase,psToLinear(clamp(psSrgb,.008,.94)),pcBlend);diffuseColor.rgb=psBase;');
  s.fragmentShader=once(s.fragmentShader,'psH+=psLipH*psLipFeather;psH*=psResolve;','psH+=psLipH*psLipFeather;psH*=psResolve;psH=mix(pcH,psH,pcBlend);');
  s.fragmentShader=once(s.fragmentShader,'psR=mix(psR,.44-.13*psWet,psLipFeather);','psR=mix(psR,.44-.13*psWet,psLipFeather);psR=mix(pcR,psR,pcBlend);');
  s.fragmentShader=once(s.fragmentShader,'*BRDF_Lambert(material.diffuseColor)*.46;','*BRDF_Lambert(material.diffuseColor)*.46*pcBlend;');
  s.fragmentShader=once(s.fragmentShader,'material.clearcoatRoughness=mix(.48,.35,psL);','material.clearcoatRoughness=mix(.48,.35,psL);material.clearcoat=mix(pcCoat,material.clearcoat,pcBlend);material.clearcoatRoughness=mix(pcCoatR,material.clearcoatRoughness,pcBlend);material.specularColor*=mix(.52/.68,1.,pcBlend);material.specularF90*=mix(.52/.68,1.,pcBlend);clearcoatNormal=normal;');
  api.calibratedFragment=s.fragmentShader;
 };
 mat.customProgramCacheKey=()=>oldKey()+'/C2-continuity';mat.needsUpdate=true;api.calibration={version:'R01-C2',linearColourInterpolation:true,boundaryMetres:[.190,.234],bodyMaterialChanged:false,visiblePanel:true};
 v.render();
};
})();
