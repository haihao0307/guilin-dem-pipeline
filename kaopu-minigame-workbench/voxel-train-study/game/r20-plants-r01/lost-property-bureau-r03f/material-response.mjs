// Response-only candidate. Original material parameters, geometry, light sources
// and display transform remain fixed. References: frozen room-slice receiver's
// shadeOpaqueCore, plus https://google.github.io/filament/main/filament.html#materialsystem/clearcoatmodel
export const MATERIAL_RESPONSE=String.raw`
fn receiverWoodSample(f:Field,n:vec3<f32>,fp:f32)->KpWoodSample {
 var wp=kpWoodDefaultParams();wp.seed+=f.seed*.013;wp.textureScale=.70;wp.roughness=select(.63,.31,f.mat==18u);wp.clearcoat=select(.08,.48,f.mat==18u);
 let localNormal=componentVector(f,n);var ws=kpWoodOriginalSample(f.local,localNormal,select(0.,1.,abs(localNormal.x)>.7),wp,fp,0.);
 if(f.mat==14u){let wear=smoothstep(.52,.77,br_noise3(f.local*9.+vec3<f32>(f.seed)))*f.age*.20;ws.surface.albedo=mix(vec3<f32>(.19,.23,.18)*(1.+ws.surface.height*120.),ws.surface.albedo,wear);if(u.clock.w<.5){ws.surface.roughness=.46+wear*.15;}}
 ws.surface.albedo*=1.-f.age*f.wet*.12;return ws;
}
struct ReceiverResponse { surface:KpSurface,cavity:f32,specularLevel:f32,clearcoat:f32,clearcoatRoughness:f32,macroHeightM:f32,parallaxHeight01:f32 };
fn receiverResponse(f:Field,p:vec3<f32>,n:vec3<f32>,fp:f32,dx:vec3<f32>,dy:vec3<f32>)->ReceiverResponse {
 if(f.mat==4u||f.mat==14u||f.mat==18u){let ws=receiverWoodSample(f,n,fp);return ReceiverResponse(ws.surface,ws.cavity,ws.specularLevel,ws.clearcoat,ws.clearcoatRoughness,ws.macroHeightM,ws.parallaxHeight01);}
 return ReceiverResponse(surface(f,p,n,fp,dx,dy),1.,1.,0.,1.,0.,0.);
}
struct ResponseParts { diffuse:vec3<f32>,baseSpecular:vec3<f32>,coatSpecular:vec3<f32>,roughness:f32,cavity:f32,coat:f32 };
// Original frozen room-slice GGX/Schlick/Smith response, using the CURRENT bureau
// sun/ambient/fixtures instead of copying the older receiver's light constants.
fn responseParts(f:Field,p:vec3<f32>,ng:vec3<f32>,rd:vec3<f32>,fp:f32,dx:vec3<f32>,dy:vec3<f32>,ao:f32,sh:f32)->ResponseParts {
 let tangentFp=componentFootprint(f,fp,dx,dy);let rr=receiverResponse(f,p,ng,tangentFp,dx,dy);let n=materialNormal(f,p,ng,tangentFp);let m=resolvedWeather(f,p,n,rr.surface);
 let light=normalize(vec3<f32>(-3.,7.,-4.));let nl=max(dot(n,light),0.);let nv=max(dot(n,-rd),.001);let h=normalize(light-rd);let nh=max(dot(n,h),0.);let vh=max(dot(-rd,h),0.);
 let inTower=p.x> -42.2&&p.x< -28.7&&p.z> -25.8&&p.z< -10.2&&p.y<6.4;
 let inHall=p.x> -38.45&&p.x< -28.1&&p.z> -39.5&&p.z<39.5&&p.y<11.3;
 let inStore=p.x> -28.1&&p.x<44.5&&p.z> -28.2&&p.z<34.7&&p.y<12.3;
 var ambient=vec3<f32>(.19,.245,.30)*(.65+.35*max(n.y,0.))*ao;
 if(inHall||inTower){ambient=vec3<f32>(.22,.23,.215)*(.50+.50*exp(-abs(p.x+38.4)*.13))*ao;}
 if(inStore){let ridge=abs(repeatX(p.z-3.25,20.833333,1.));ambient=vec3<f32>(.14,.18,.20)*(.55+.45*exp(-ridge*.16))*ao;}
 let rough=clamp(m.roughness,.08,1.);let alpha=rough*rough;let a2=alpha*alpha;let den=nh*nh*(a2-1.)+1.;let D=a2/max(3.14159265*den*den,.0001);
 let k=(rough+1.)*(rough+1.)/8.;let G=nl/max(nl*(1.-k)+k,.001)*nv/max(nv*(1.-k)+k,.001);let F=.04+.96*pow(1.-vh,5.);let spec=D*G*F/max(4.*nl*nv,.001)*rr.specularLevel;
 let coatR=clamp(rr.clearcoatRoughness,.08,1.);let ca=coatR*coatR;let cden=nh*nh*(ca*ca-1.)+1.;let coatD=ca*ca/max(3.14159265*cden*cden,.0001);
 let ck=(coatR+1.)*(coatR+1.)/8.;let coatG=nl/max(nl*(1.-ck)+ck,.001)*nv/max(nv*(1.-ck)+ck,.001);let coatF=rr.clearcoat*(.04+.96*pow(1.-vh,5.));let coatSpec=coatD*coatG*coatF/max(4.*nl*nv,.001);let viewCoatF=rr.clearcoat*(.04+.96*pow(1.-nv,5.));
 // Preserve the original diffuse calibration: irradiance / pi equals the old
 // diffuse radiance. No new lamp, environment reflection or exposure change.
 let sun=vec3<f32>(1.10,1.01,.83)*1.48;let direct=nl*sh;
 var diffuse=m.albedo*(ambient*(1.-viewCoatF)+sun*direct*(1.-coatF))*rr.cavity;
 if(inHall||inStore||inTower){let zone=select(select(0u,2u,inStore),5u,inTower);let lp=interiorLightPosition(zone,interiorNearestLight(p,zone))-p;let ld=length(lp);diffuse+=m.albedo*vec3<f32>(1.,.76,.46)*max(dot(n,normalize(lp)),0.)*1.15/(1.+ld*ld*.13)*rr.cavity*(1.-viewCoatF);}
 if(f.mat==11u||f.mat==17u){diffuse=m.albedo*select(1.8,2.4,f.mat==17u);}
 return ResponseParts(diffuse,sun*3.14159265*direct*spec*(1.-coatF),sun*3.14159265*direct*coatSpec,m.roughness,rr.cavity,rr.clearcoat);
}
fn litSurface(f:Field,p:vec3<f32>,n:vec3<f32>,rd:vec3<f32>,fp:f32,dx:vec3<f32>,dy:vec3<f32>,ao:f32,sh:f32)->vec3<f32>{
 if(u.clock.w<.5||!(f.mat==4u||f.mat==14u||f.mat==18u)){return litSurfaceLegacy(f,p,n,rd,fp,dx,dy,ao,sh);}
 let parts=responseParts(f,p,n,rd,fp,dx,dy,ao,sh);return parts.diffuse+parts.baseSpecular+parts.coatSpecular;
}
`;
