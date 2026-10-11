// New implicit closest-section receiver around the unchanged MP02-S1 woven
// equations. No yarn vertex arrays. Nearby warp/weft sections are queried.
export const TEXTILE_DOMAIN_WGSL=String.raw`
struct ClothSample {d:f32,albedo:vec3<f32>,roughness:f32,};
fn clothParams(kind:f32)->KpWovenParams{return KpWovenParams(kind,.42,.64,.70,0.,.25,0.,.78,0.,vec3<f32>(.008023193,.035601315,.086500462),vec3<f32>(.479320183,.456411023,.376262123));}
fn flatClothChart(mm:vec2<f32>)->KpFabricChartSample{return KpFabricChartSample(vec3<f32>(mm*.001,0.),vec3<f32>(0,0,1));}
fn clothNative(q:vec3<f32>)->ClothSample{
 var best=ClothSample(1e4,vec3<f32>(0.),.95);
 for(var k=0;k<2;k++){let p=clothParams(f32(k));let travel=select(q.y,q.x,k==1)*1000.;let lane0=floor(select(q.x/p.pitchMM,q.y/p.weftPitchMM,k==1)*1000.-.5);
 for(var j=-1;j<=1;j++){let lane=lane0+f32(j);let queries=kpFabricChartQueries(travel,lane,p);let rest=kpFabricRestYarnMM(travel,lane,p);let center=flatClothChart(queries.centerMM);let plus=flatClothChart(queries.plusMM);let minus=flatClothChart(queries.minusMM);let relative=q-kpFabricYarnCentreM(rest,center,p);
 let crossAxis=select(relative.x,-relative.y,k==1);let ra=select(p.pitchMM*.49,p.weftPitchMM*.235,k==1)*.001;let rz=p.thicknessMM*.235*select(1.,.68,k==1)*.001;let theta=atan2(relative.z/max(rz,1e-7),crossAxis/max(ra,1e-7));let point=kpFabricWovenVertex(travel,lane,theta,0.,0.,vec2<f32>(1.),center,plus,minus,p);let d=dot(q-point.positionM,point.normal);if(d<best.d){best=ClothSample(d,point.albedo,point.roughness);}}
 }
 return best;
}
fn kpFabricSurface(uvM:vec2<f32>,age:f32,wet:f32,footprintM:f32)->KpSurface{let f=clothNative(vec3<f32>(uvM,.0006));return KpSurface(0.,f.albedo*(1.-clamp(wet,0.,1.)*.15),f.roughness);}
`;
