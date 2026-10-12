// Presentation is the actual FH88/r170 output transform and Fog convention.
// Mothers output linear material/light data. Fog blends in output colour space,
// after ACES/output encoding, and uses -view.z, never distance along an oblique ray.
export const HOST_PRESENTATION_GLSL=String.raw`
vec3 stationOutputSRGB(vec3 c){return mix(c*12.92,1.055*pow(max(c,vec3(0.)),vec3(1./2.4))-.055,step(vec3(.0031308),c));}
vec3 stationHostPresentation(vec3 linearRadiance,float viewDepth,vec3 outputFogColor,vec2 fogRange){
 vec3 outputColor=stationOutputSRGB(ACESFilmicToneMapping(linearRadiance));
 return mix(outputColor,outputFogColor,smoothstep(fogRange.x,fogRange.y,viewDepth));
}
`;
export const STATION_DIRECT_GLSL=String.raw`
vec3 stationDirectBRDF(vec3 n,vec3 v,vec3 l,vec3 albedo,float roughness,float metal,float specularLevel,vec2 finish){
 vec3 h=normalize(l+v);float nl=max(dot(n,l),0.),nv=max(dot(n,v),.001),nh=max(dot(n,h),0.),vh=max(dot(v,h),0.);
 float rough=clamp(roughness,.065,.98),alpha=rough*rough,aa=alpha*alpha,den=nh*nh*(aa-1.)+1.,D=aa/(3.14159265*den*den),k=(rough+1.)*(rough+1.)*.125,G=nl/(nl*(1.-k)+k)*nv/(nv*(1.-k)+k);
 vec3 F0=mix(vec3(.04),albedo,metal),F=F0+(1.-F0)*pow(1.-vh,5.),spec=D*G*F/max(.004,4.*nl*nv)*specularLevel,diff=(1.-F)*(1.-metal)*albedo/3.14159265;
 float cr=clamp(finish.y,.065,1.),ca=cr*cr,caa=ca*ca,cd=nh*nh*(caa-1.)+1.,cD=caa/(3.14159265*cd*cd),ck=(cr+1.)*(cr+1.)*.125,cG=nl/(nl*(1.-ck)+ck)*nv/(nv*(1.-ck)+ck),cF=.04+.96*pow(1.-vh,5.);
 return ((diff+spec)*(1.-finish.x*cF)+vec3(finish.x*cD*cG*cF/max(.004,4.*nl*nv)))*nl;
}
`;
