/** Reference-space vermilion boundaries, aperiodic branching furrows and a
 * narrow moist inner band. Original skin tone/lip color/detail remain masters.
 * Artist-authored real-time approximation, not scanned reflectance or tissue. */
function railGLSL(name,points){
 const f=v=>Number(v).toFixed(9);let text=`float ${name}(float x){`;
 text+=`if(x<=${f(points[0][0])})return ${f(points[0][1])};`;
 for(let i=0;i<points.length-1;i++){const p=points[i],q=points[i+1],l=points[Math.max(0,i-1)],r=points[Math.min(points.length-1,i+2)],h=q[0]-p[0],m=(q[1]-l[1])/(q[0]-l[0]),n=(r[1]-p[1])/(r[0]-p[0]);text+=`if(x<=${f(q[0])}){float t=clamp((x-(${f(p[0])}))/${f(h)},0.,1.);return (2.*t*t*t-3.*t*t+1.)*${f(p[1])}+(t*t*t-2.*t*t+t)*${f(h*m)}+(-2.*t*t*t+3.*t*t)*${f(q[1])}+(t*t*t-t*t)*${f(h*n)};}`;}
 return text+`return ${f(points.at(-1)[1])};}`;
}
export function attachLipMaterial(skin,api){
 if(skin.lipExtension)return;
 const previous=skin.material.onBeforeCompile,key=skin.material.customProgramCacheKey.bind(skin.material),U={uLEnabled:{value:1},uLFurrows:{value:.65},uLPigment:{value:.68},uLWet:{value:.35},uLRough:{value:.53},uLSoft:{value:.48}};
 const r=api.rails;const declarations=`
 uniform float uLEnabled,uLFurrows,uLPigment,uLWet,uLRough,uLSoft;
 ${railGLSL('lpTop',r.top)} ${railGLSL('lpBottom',r.bottom)} ${railGLSL('lpInTop',r.innerTop)} ${railGLSL('lpInBottom',r.innerBottom)}
 float lpHash(float n){return fract(sin(n*127.1+311.7)*43758.5453123);}
 float lpFurrows(vec2 mm,float v,float upper,float footprint){
  float spacing=.63,x=mm.x+.09*sin(mm.y*.73)+.045*sin(mm.y*1.93),cell=floor(x/spacing),h=0.;
  for(int j=-2;j<=2;j++){float id=cell+float(j),a=lpHash(id+upper*137.),b=lpHash(id+72.9),c=lpHash(id+17.5),bend=.10*sin(mm.y*(.34+b*.34)+a*6.283)+.034*sin(mm.y*1.5+c*6.28);
   float center=(id+.19+.62*a)*spacing+bend+(b-.5)*mm.y*.036,d=x-center,width=.025+.038*c,w2=width*width+footprint*footprint*.65;
   float taper=smoothstep(-.08,.18+c*.22,v)*(1.-smoothstep(.53+.19*b,1.05,v));
   h-=exp(-d*d/max(w2,.0001))*(.52+.48*b)*taper;
   float branch=d-(.13+.06*sin(mm.y*.9+a*7.))*(.6+v);h-=exp(-branch*branch/max(w2*.46,.0001))*.30*smoothstep(.25,.5,v)*(1.-smoothstep(.63,.82,v))*taper;
  }
  return h;
 }
 `;
 const patch=(s,a,b)=>{if(!s.includes(a))throw Error('Lip shader anchor changed: '+a);return s.replace(a,()=>b);};
 skin.material.onBeforeCompile=shader=>{
  previous(shader);Object.assign(shader.uniforms,U);skin.lipExtension.shaderCompiles++;
  shader.fragmentShader=patch(shader.fragmentShader,'#include <common>','#include <common>\n'+declarations);
  shader.fragmentShader=patch(shader.fragmentShader,'float csMacro=',`
   float lpTopY=lpTop(vFRest.x),lpBotY=lpBottom(vFRest.x),lpIT=lpInTop(vFRest.x),lpIB=lpInBottom(vFRest.x);
   float lpUpper=step((lpIT+lpIB)*.5,vFRest.y),lpV=mix((lpIB-vFRest.y)/max(.001,lpIB-lpBotY),(vFRest.y-lpIT)/max(.001,lpTopY-lpIT),lpUpper);
   float lpBorderNoise=(sin(vFRest.x*1401.)*.52+sin(vFRest.x*3077.+1.3)*.24)*.000045;
   float lpAA=max(fwidth(vFRest.y)*.8,mix(.00015,.00065,uLSoft));
   float lpMask=smoothstep(lpBotY-lpAA,lpBotY+lpAA,vFRest.y+lpBorderNoise)*(1.-smoothstep(lpTopY-lpAA,lpTopY+lpAA,vFRest.y+lpBorderNoise));
   lpMask*=smoothstep(${r.front.toFixed(9)},${(r.front+.006).toFixed(9)},vFRest.z)*csCover*uLEnabled;
   csLip=mix(csLip,lpMask,uLEnabled);
   vec2 lpMM=(vFRest.xy-vec2(${r.cx.toFixed(9)},${r.cy.toFixed(9)}))*1000.;
   float lpFoot=max(length(dFdx(lpMM)),length(dFdy(lpMM))),lpFine=lpFurrows(lpMM,lpV,lpUpper,lpFoot);
   float lpVisible=1.-smoothstep(.22,.65,lpFoot),lpMoist=(1.-smoothstep(.03,.26,lpV))*lpMask;
   float csMacro=`);
  shader.fragmentShader=patch(shader.fragmentShader,'csBase=mix(csBase,csLipColor*(1.+csMacro*.06),csLip*csLipMix);',`
   vec3 lpColor=mix(csBase,csLipColor,clamp(csLipMix*(.90+uLPigment*.30),0.,1.));
   lpColor*=1.+csMacro*.045+lpFine*.018*lpVisible;
   csBase=mix(csBase,mix(csLipColor*(1.+csMacro*.06),lpColor,uLEnabled),csLip*mix(csLipMix,1.,uLEnabled));
  `);
  shader.fragmentShader=patch(shader.fragmentShader,'csSurface=mix(csSurface,csGrooves*.0000045+csMeso*.000007,csLip);','csSurface=mix(csSurface,csGrooves*.0000045+csMeso*.000007,csLip*(1.-uLEnabled));csSurface*=1.-lpMask;');
  shader.fragmentShader=patch(shader.fragmentShader,'#include <clearcoat_normal_fragment_maps>',`
   float lpHeight=lpFine*.000029*uLFurrows*lpVisible*lpMask*clamp(csDetail/.72,0.,2.1);
   vec3 lpDX=dFdx(-vViewPosition),lpDY=dFdy(-vViewPosition),lpR1=cross(lpDY,normal),lpR2=cross(normal,lpDX);float lpDet=dot(lpDX,lpR1);
   if(abs(lpDet)>1e-14)normal=normalize(abs(lpDet)*normal-sign(lpDet)*(dFdx(lpHeight)*lpR1+dFdy(lpHeight)*lpR2));
   roughnessFactor=mix(roughnessFactor,clamp(uLRough+(csRoughness-.62)*.38-lpMoist*uLWet*.18-lpFine*.022,.30,.78),lpMask);
   #include <clearcoat_normal_fragment_maps>
  `);
  const a='material.clearcoatRoughness=clamp(material.clearcoatRoughness-(.045*vFA.y+.015*vFA.w)*fMask,.23,.55);';
  shader.fragmentShader=patch(shader.fragmentShader,a,a+`
   material.clearcoat=mix(material.clearcoat,.015+csOil*.035+lpMoist*uLWet*.28,lpMask);
   material.clearcoatRoughness=mix(material.clearcoatRoughness,.42-lpMoist*uLWet*.16,lpMask);
  `);
 };
 skin.material.customProgramCacheKey=()=>key()+'/ET17-native-lip-rails-aperiodic-v1';skin.lipExtension={version:'ET17-L1',shaderCompiles:0,kind:'new analytic lip surface, not a scanned map',sourceHeadReplaced:false,oldSkinMastersRetained:true,distanceFiltering:true};api.skins.add(skin);
 const update=skin.updateFace?.bind(skin),dispose=skin.dispose.bind(skin);skin.updateLips=()=>{const s=api.settings;U.uLEnabled.value=s.enabled?1:0;for(const[k,n]of Object.entries({furrows:'uLFurrows',pigment:'uLPigment',wetness:'uLWet',dryRoughness:'uLRough',borderSoftness:'uLSoft'}))U[n].value=s[k];};skin.updateFace=()=>{update?.();skin.updateLips();};skin.dispose=()=>{api.skins.delete(skin);dispose();};skin.updateLips();skin.material.needsUpdate=true;
}
