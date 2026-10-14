// Project-authored RGB tissue appearance. No scan, photographic map or medical model.
// Surface microrelief, deep colour absorption and angular scattering stay separate.
const declarations=`
uniform float uDTScatter,uDTVeins,uDTMicro;
float sdHash(vec3 p);
float dtPores(vec3 p,float footprint){
 vec3 cell=floor(p/.18);float height=0.;
 for(int z=-1;z<=1;z++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  vec3 c=cell+vec3(float(x),float(y),float(z));
  vec3 jitter=vec3(sdHash(c+1.7),sdHash(c+19.3),sdHash(c+47.1));
  vec3 d=(c+jitter)*.18-p;float radius=mix(.024,.040,sdHash(c+83.));
  float r2=radius*radius,filtered=r2+footprint*footprint*.22,d2=dot(d,d);
  height+=(-exp(-d2/filtered)+.13*exp(-d2/(filtered*2.8)))*.000008*(r2/filtered);
 }return height;
}
float dtWindow(float x,float a,float b){return smoothstep(a,a+3.,x)*(1.-smoothstep(b-3.,b,x));}
float dtVessel(vec3 p,float side){
 float y=p.y-304.,asym=side*.9;
 float mainX=63.5+.18*y+1.8*sin(y*.115+asym),d=(p.x-mainX)/1.15;
 float main=exp(-d*d)*dtWindow(p.y,280.,344.);
 float branchX=59.+.42*(p.y-315.)+1.4*sin((p.y-315.)*.15+asym),b=(p.x-branchX)/.80;
 float branch=exp(-b*b)*dtWindow(p.y,306.,334.);
 float cheekX=48.5+.48*(p.y-284.)+1.1*sin((p.y-284.)*.16+asym),c=(p.x-cheekX)/.95;
 float cheek=exp(-c*c)*dtWindow(p.y,271.,296.)*.48;
 float sideDepth=exp(-pow((p.z-23.)/28.,2.)),cheekDepth=exp(-pow((p.z-52.)/23.,2.));
 return clamp((main+branch*.60)*sideDepth+cheek*cheekDepth,0.,1.);
}
`;
export function installDermalOptics({model,viewer}){
 const material=viewer.skin.material,prior=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
 const choices={natural:{scatter:.48,veins:.18,micro:1.05,diffusion:false},luminous:{scatter:.72,veins:.25,micro:1.18,diffusion:true},thin:{scatter:.64,veins:.60,micro:1.10,diffusion:true}};
 const U={uDTScatter:{value:.72},uDTVeins:{value:.23},uDTMicro:{value:1.18}};let selected='luminous';
 const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('Dermal material anchor changed: '+a.slice(0,90));return s.replace(a,()=>b);};
 material.onBeforeCompile=s=>{prior(s);Object.assign(s.uniforms,U);let f=declarations+'\n'+s.fragmentShader;
 f=once(f,'diffuseColor.rgb=mix(diffuseColor.rgb,sdAlbedo,sdCover*(1.-clamp(lpMask,0.,1.)));',`
 vec3 dtMM=vec3(abs(vFRest.x),vFRest.y,vFRest.z)*1000.;
 float dtV=dtVessel(dtMM,sign(vFRest.x))*uDTVeins*exp(-1.1-uSDMel*3.8)*sdSkin;
 // Soft depth-filtered absorption; this does not change normals or raise tubes.
 sdAlbedo*=exp(-vec3(.82,.23,.11)*dtV);
 float dtFlush=(.012*rfCheek+.010*rfThin)*uDTScatter*(1.-uSDMel*.65);
 sdAlbedo*=vec3(1.+dtFlush,1.-dtFlush*.48,1.-dtFlush*.34);
 diffuseColor.rgb=mix(diffuseColor.rgb,sdAlbedo,sdCover*(1.-clamp(lpMask,0.,1.)));
 `);
 f=once(f,'b.w*=uSDPores*mix(.62,1.22,sdHash(vec3(float(id),uSDSeed,19.)));','b.w*=uSDPores*mix(.62,1.22,sdHash(vec3(float(id),uSDSeed,19.)))*uDTMicro*1.35;');
 f=once(f,'rfH=rfPoreHeight(rfMM,uRFSize,rfFoot)*uRFGain*rfVisibility*rfArea;',`rfH=rfPoreHeight(rfMM,uRFSize,rfFoot)*uRFGain*rfVisibility*rfArea;
 float dtGrain=(sdNoise(rfMM*11.7)-.5)*.0000006;
 rfH+=dtGrain*uDTMicro*rfArea*(1.-smoothstep(.035,.105,rfFoot))*uSDOn;
 if(rfArea>.001&&rfFoot<.24&&uSDOn>.5)rfH+=dtPores(vFRest*1000.,rfFoot)*uDTMicro*rfArea*(1.-smoothstep(.10,.24,rfFoot))*uSDOn;
 `);
 f=once(f,'vec3 rfW=vec3(.28,.14,.075)*uRFScatter*mix(1.,.62*(1.-uSDMel*.48),uSDOn);',`float dtThin=clamp(.24+.42*clamp(vFA.z,0.,1.)+.30*rfG(vFRest,vec3(.036,.277,.055),vec3(.032,.028,.055))+.20*clamp(vFA.w,0.,1.),0.,1.);
 vec3 rfW=vec3(.28,.14,.075)*uRFScatter*mix(1.,.62*(1.-uSDMel*.48),uSDOn)+vec3(.38,.16,.075)*uDTScatter*dtThin*(1.-uSDMel*.58)*uSDOn;`);
 s.fragmentShader=f;};material.customProgramCacheKey=()=>key()+'/dermal-optics-r01-depth-filtered';material.needsUpdate=true;
 function select(id){const p=choices[id];if(!p)throw Error('Unknown tissue preset');selected=id;U.uDTScatter.value=p.scatter;U.uDTVeins.value=p.veins;U.uDTMicro.value=p.micro;const enabled=window.platformSkin?.archive().enabled??true;model.foldProfile.settings.diffusion=p.diffusion&&enabled;model.faceSurface.settings.diffusion=p.diffusion&&enabled?.25:0;model.faceSurface.settings.radius=.82;viewer.render();}
 const api={select,refresh:()=>select(selected),report:()=>({version:'DERMAL-OPTICS-R01',preset:selected,...choices[selected],surfacePores:'retained surface candidates plus original cellular microrelief, bounded micrometre relief and pixel-footprint filtering',vessels:'soft procedural intradermal colour absorption on temples and upper cheeks; stable rest-space curves',scattering:'RGB angular approximation plus retained diffuse-only face diffusion; no volume path tracing',extraTextureSamplers:0,medicalMeasurement:false})};select(selected);window.dermalOptics=api;return api;
}
