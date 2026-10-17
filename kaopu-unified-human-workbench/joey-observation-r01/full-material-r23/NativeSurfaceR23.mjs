/** R23 bounded native material migration. Original immutable geometry and semantic masks. */
import {attachLipFinish as attachBaseLipFinish} from '../appearance-r65/LipFinish.mjs';
const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('R23 shader anchor changed: '+a);return s.replace(a,()=>b);};
const declaration=`uniform float psSeed,lrSeed,r23LipY;
float psHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33+psSeed*.001);return fract((p.x+p.y)*p.z);}
float psNoise(vec3 p){vec3 c=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(psHash(c),psHash(c+vec3(1,0,0)),f.x),mix(psHash(c+vec3(0,1,0)),psHash(c+vec3(1,1,0)),f.x),f.y),mix(mix(psHash(c+vec3(0,0,1)),psHash(c+vec3(1,0,1)),f.x),mix(psHash(c+vec3(0,1,1)),psHash(c+vec3(1,1,1)),f.x),f.y),f.z);}
float psRegion(vec3 p,vec3 c,vec3 scale){vec3 q=(vec3(abs(p.x),p.y,p.z)-c)/scale;return exp(-dot(q,q)*1.5);}
// Filtered jittered follicle bowls: radius and depth independent, weak positive rim.
vec2 psPoreChart(vec2 q,float chart,float radius,float spacing,float footprint){
 vec2 cell=floor(q/spacing);float height=0.,pigment=0.;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  vec2 id=cell+vec2(float(x),float(y));vec3 key=vec3(id,chart);
  vec2 jitter=vec2(psHash(key),psHash(key+vec3(19.1,73.7,2.1)));
  vec2 delta=q-(id+.14+.72*jitter)*spacing;
  float rr=radius*mix(.62,1.35,psHash(key+4.3));float r2=rr*rr;
  float filteredArea=r2+footprint*footprint*.24;
  float d2=dot(delta,delta);float bowl=exp(-d2/filteredArea)*r2/filteredArea;
  float rim=exp(-d2/(filteredArea*3.8))*r2/filteredArea;
  float presence=smoothstep(.12,.30,psHash(key+12.4));
  height+=(-bowl+.085*rim)*presence;pigment+=bowl*.12*presence;
 }
 return vec2(height,pigment);
}
vec2 psPoreSurface(vec3 mm,vec3 weights,float radius,float spacing,float footprint){
 vec3 warp=vec3(psNoise(mm*.10+11.7),psNoise(mm*.10+33.1),psNoise(mm*.10+78.2))-.5;mm+=warp*.20;
 return psPoreChart(mm.yz,7.,radius,spacing,footprint)*weights.x+psPoreChart(mm.xz,31.,radius,spacing,footprint)*weights.y+psPoreChart(mm.xy,61.,radius,spacing,footprint)*weights.z;
}
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
  float tangent=(a-.5)*.34+(root/25.0)*.20;
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

`;
export function patchSurface(shader,U){let f=shader.fragmentShader;Object.assign(shader.uniforms,U);
 f=once(f,'uniform vec3 csTone,csLipColor;',declaration+'\nuniform vec3 csTone,csLipColor;');
 f=once(f,'csBase=mix(csBase,csLipColor*(1.+csMacro*.06),r65Lip*csLipMix);',`
 float r23Upper=smoothstep(r23LipY-.00035,r23LipY+.00035,vCSRest.y);
 float r23Tissue=(lrNoise(vCSRest.xy*410.+vec2(31.,r23Upper*7.))-.5);
 vec3 r23LipColor=csLipColor*exp(-vec3(.15,.13,.09)*.28*r23Upper);
 r23LipColor*=1.+r23Tissue*.15;
 r23LipColor+=csLipColor*vec3(.07,-.04,-.03)*r23Tissue;
 csBase=mix(csBase,r23LipColor,r65Lip*csLipMix);
 `);
 f=once(f,'float csPores=csNoise(vCSRest*1650.)-.5,csFine=csNoise(vCSRest*4900.+vec3(11.7))-.5;',`
 vec3 r23MM=vCSRest*1000.;float r23Foot=max(length(dFdx(r23MM)),length(dFdy(r23MM)));
 vec3 r23RN=normalize(cross(dFdx(r23MM),dFdy(r23MM))),r23W=pow(abs(r23RN),vec3(8.));r23W/=max(dot(r23W,vec3(1.)),.00001);
 vec2 r23Pores=psPoreSurface(r23MM,r23W,.075,.58,r23Foot);
 float csPores=r23Pores.x*.62,csFine=(csNoise(vCSRest*4900.+vec3(11.7))-.5)*(1.-smoothstep(.055,.34,r23Foot));
 `);
 f=once(f,'float csGrooves=sin(vCSRest.x*12300.+csNoise(vCSRest*310.)*3.)*.5;',`
 float r23Depth=clamp(abs(vCSRest.y-r23LipY)/.0055,0.,1.);
 float csGrooves=lrFolds(r23MM.xy,r23Depth,r23Upper,r23Foot)/.0000045*.55;
 `);
 f=once(f,'csSurface=mix(csSurface,csGrooves*.0000045+csMeso*.000007,csLip);','csSurface=mix(csSurface,csGrooves*.0000045+csMeso*.000002,csLip);');
 shader.fragmentShader=f;
}
export function attachLipFinish(skin,p={}){
 const base=attachBaseLipFinish(skin,p),mat=skin.material,before=mat.onBeforeCompile,key=mat.customProgramCacheKey,m=skin.viewer.model,g=m.gnm;
 const landmark=id=>{let y=0;for(let j=0;j<3;j++)y+=g.template[g.landmarkIndices[id*3+j]*3+1]*g.landmarkWeights[id*3+j];return y+m.canonical.headTransform.translation[2];};
 const lipY=(landmark(62)+landmark(66))*.5,U={psSeed:{value:731},lrSeed:{value:731},r23LipY:{value:lipY}};
 if(!Number.isFinite(lipY))throw Error('Native lip center missing');let compiles=0,disposed=false;
 const compile=function(s,...args){before.call(this,s,...args);patchSurface(s,U);compiles++;};
 mat.onBeforeCompile=compile;mat.customProgramCacheKey=function(){return key.call(this)+'/r23-filtered-skin-native-lip';};mat.needsUpdate=true;
 return{set:p=>base.set(p),report:()=>({...base.report(),migration:'R23-native-bounded/1',surfaceCompiles:compiles,lipY,skinDonor:'50f9dd769893584dedb62f0bc62db07ebcb1dcc0',lipDonor:'544ec81bcef6185a553df138585c7059e832a122',filteredPores:true,upperLowerColorDifference:true,irregularFilteredGrooves:true,geometryChanged:false,highDensityLipRailsImported:false,volumeScattering:false}),dispose(){if(disposed)return;if(mat.onBeforeCompile!==compile)throw Error('Dispose newer material first');mat.onBeforeCompile=before;mat.customProgramCacheKey=key;disposed=true;base.dispose();}};
}
