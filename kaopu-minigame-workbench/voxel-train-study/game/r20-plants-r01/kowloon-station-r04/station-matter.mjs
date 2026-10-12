// One physical-material evaluation shared by intersection and shading.
// Source mother functions are unchanged. History mappings below are new authored
// station adapters, not calibrated erosion laws or recovered historical facts.
export const STATION_MATTER_WGSL=String.raw`
struct StationState{age:f32,wet:f32,repair:f32,retained:f32,}
struct StationMatter{d:f32,surface:KpSurface,metal:f32,cavity:f32,specular:f32,microHeight:f32,layer:u32,}
fn resolveStationState(p:vec3<f32>)->StationState{let repair=repairAt(p);return StationState(u.age,stateWet(p),repair,u.age*(1.-repair));}
fn stationWoodParams(st:StationState)->KpWoodParams{var wp=kpWoodDefaultParams();wp.reliefScale*=.35+.85*st.retained;wp.roughness=clamp(wp.roughness+.07*st.retained-.12*st.repair,.2,.98);wp.agedSurfaceColor=mix(wp.freshCutColor,wp.agedSurfaceColor,.4+.6*st.retained);wp.clearcoat=.12*st.repair;return wp;}
fn stationWoodClass(h:HitField)->f32{var end=1.69;if(h.seed==39.){end=1.79;}if(h.seed==30.){end=1.22;}return select(0.,1.,abs(h.q.x)>end);}
fn evaluateStationMatter(h:HitField,p:vec3<f32>,normal:vec3<f32>,fp:f32)->StationMatter{
 let st=resolveStationState(p);var m=StationMatter(h.d,KpSurface(0.,vec3<f32>(.34,.33,.28),.85),0.,1.,1.,0.,0u);
 if(h.id==1u||h.id==12u){let q=brickQ(p,h.id,h.d);let seed=19.+floor(p.y/.073)*13.+floor((p.x+p.z)/.25);let variant=i32(abs(seed))%4;let source=kpBrickOriginalSurface(q,seed,variant,.42,0.);let loss=clamp(st.retained*st.wet*(.0004+max(0.,-source.height)*.6),0.,.0016);m.d=min(h.d+.006,kpBrickBaseDistance(q,seed,variant,.42)+loss);m.surface=kpBrickOriginalSurface(q,seed,variant,.42,fp);let edge=min(.125-abs(q.x),.0365-abs(q.y));if(edge<.004){m.surface=KpSurface(0.,vec3<f32>(.28,.26,.21),.94);}m.surface.albedo*=1.-st.wet*.18-loss*60.;m.surface.roughness=clamp(m.surface.roughness+loss*50.,.15,.98);m.microHeight=m.surface.height;m.layer=1u;}
 if(h.id==2u){let source=kpStoneSurface(h.q*.19,st.age,st.wet,st.repair,0.);let relief=.25+.75*st.retained;m.d=h.d-clamp(source.height*relief,-.004,.004);m.surface=kpStoneSurface(h.q*.19,st.age,st.wet,st.repair,fp*.19);m.surface.height*=relief;m.layer=2u;}
 if(h.id==3u||h.id==15u){let loss=kpMetalCorrosion(h.q,st.age,st.wet,st.repair)*.0008;m.d=h.d+loss;m.surface=kpMetalSurface(h.q,st.age,st.wet,st.repair,fp);m.metal=.45;m.microHeight=m.surface.height+loss;m.layer=3u;}
 if(h.id==4u){let wp=stationWoodParams(st);let cls=stationWoodClass(h);let wn=select(normal,normal.zxy,h.seed==38.);m.d=h.d-kpWoodMacroDisplacement(h.q,cls,wp);let source=kpWoodOriginalSample(h.q,wn,cls,wp,fp,length(p-u.eye));m.surface=source.surface;m.cavity=source.cavity;m.specular=source.specularLevel;m.microHeight=source.surface.height;m.layer=4u;}
 if(h.id==17u){let source=kpConcreteStation(h.q,st.retained,st.wet,st.repair,0.);m.d=h.d-source.height;m.surface=kpConcreteStation(h.q,st.retained,st.wet,st.repair,fp);m.layer=17u;}
 if(h.id==13u){let a=stationPlasterParams();let source=kpPlasterOriginalField(h.q,a,0.);let exposure=clamp(st.wet*2.8+(1.-smoothstep(.2,1.8,p.y))*.18,0.,1.);let decay=clamp(st.retained*exposure,0.,1.);let defect=source.macroTone*.5+.5;let coverage=smoothstep(decay*.9-.03,decay*.9+.04,defect);let thickness=source.thicknessM*coverage;let substrate=kpStoneSurface(h.q*.19,st.age,st.wet,st.repair,0.);m.d=h.d-clamp(substrate.height*.25,-.001,.001)-thickness;m.surface=kpPlasterOriginalField(h.q,a,fp).surface;let revealed=1.-smoothstep(.0001,.001,thickness);let exposed=kpStoneSurface(h.q*.19,st.age,st.wet,st.repair,fp*.19);m.surface.albedo=mix(m.surface.albedo,exposed.albedo,revealed)*(1.-st.wet*.18);m.surface.roughness=mix(m.surface.roughness,exposed.roughness,revealed);m.microHeight=m.surface.height*(1.-revealed);m.layer=select(13u,2u,revealed>.5);}
 return m;
}
`;
