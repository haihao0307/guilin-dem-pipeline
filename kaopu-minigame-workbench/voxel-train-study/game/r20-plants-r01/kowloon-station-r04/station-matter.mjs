// One physical-material evaluation shared by intersection and shading.
// Source mother functions are unchanged. History mappings below are new authored
// station adapters, not calibrated erosion laws or recovered historical facts.
export const STATION_MATTER_WGSL=String.raw`
struct StationState{age:f32,wet:f32,repair:f32,retained:f32,}
struct StationMatter{d:f32,surface:KpSurface,metal:f32,cavity:f32,specular:f32,microHeight:f32,layer:u32,}
fn resolveStationState(p:vec3<f32>)->StationState{let repair=repairAt(p);return StationState(u.age,stateWet(p),repair,u.age*(1.-repair));}
fn stationWoodParams(h:HitField,st:StationState)->KpWoodParams{var wp=kpWoodDefaultParams();wp.seed=fract(wp.seed+h.sourceSeed*.61803398875);wp.reliefScale*=.35+.85*st.retained;wp.roughness=clamp(wp.roughness+.07*st.retained-.12*st.repair,.2,.98);wp.agedSurfaceColor=mix(wp.freshCutColor,wp.agedSurfaceColor,.4+.6*st.retained);wp.clearcoat=.12*st.repair;return wp;}
fn stationWoodClass(h:HitField)->f32{let face=abs(h.q)-h.extent;return select(0.,1.,face.x>=max(face.y,face.z));}
// Geometry-only closure of the SAME original matter signals. Avoid evaluating
// pigment/filtered microscopy at every ray step. Shading calls this closure too.
struct StationGeometry{d:f32,loss:f32,thickness:f32,}
fn stationStoneHeight(qM:vec3<f32>)->f32{let pos=qM/KP_STONE_SCALE_M;let seed=st_seedVector(KP_STONE_COLOR_SEED,.071);let q=st_warp(pos,seed);let broad=st_sf(q*1.35+seed);let region=st_sf(q*3.2+seed+vec3<f32>(11.));let vein=(1.-smoothstep(.028,.072,st_line(q,seed)))*smoothstep(.34,.63,region);let pits=pow(max(0.,(st_sf(q*19.+st_seedVector(KP_STONE_PORE_SEED,.061))-.57)/.43),2.);return ((broad-.5)*.018+(region-.5)*.007+vein*.004-pits*.025)*KP_STONE_SCALE_M;}
fn stationConcreteHeight(p:vec3<f32>,age:f32)->f32{let q=p+vec3<f32>(19.,19.*.71,19.*.37);let meso=mt_kn(q*3.7);let fine=mt_kn(q*127.);let chip=smoothstep(.64,.81,mt_kn(q*23.))*smoothstep(.46,.76,meso)*age;return(fine-.5)*.00042-chip*.0007;}
fn stationCoatingThickness(h:HitField,p:vec3<f32>,st:StationState)->f32{let a=stationPlasterParams(h.extent);let macroSignal=kpPlasterMacro(h.q,a);let sourceThickness=clamp(a.thicknessM+a.reliefM*macroSignal,a.minThicknessM,a.maxThicknessM);let exposure=clamp(st.wet*2.8+(1.-smoothstep(.2,1.8,p.y))*.18,0.,1.);let decay=clamp(st.retained*exposure,0.,1.);let defect=macroSignal*.5+.5;let coverage=smoothstep(decay*.9-.03,decay*.9+.04,defect);return sourceThickness*coverage;}
// Source iron noise remains metric; contact height uses the actual station
// datum rather than an arbitrary member centre. Rail crown maps to source 1.07m.
fn stationMetalCoordinates(h:HitField,p:vec3<f32>)->vec3<f32>{let rail=h.id==3u&&h.seed==55.;return vec3<f32>(h.q.x,select(p.y,p.y+.984,rail),h.q.z);}
fn evaluateStationGeometry(h:HitField,p:vec3<f32>,st:StationState)->StationGeometry{
 var g=StationGeometry(h.d,0.,0.);
 if(h.id==1u||h.id==12u){let q=brickQ(p,h.id,h.d);let seed=19.+floor(p.y/.073)*13.+floor((p.x+p.z)/.25);let variant=i32(abs(seed))%4;let native=kpBrickBaseDistance(q,seed,variant,.42);let macroSignal=native-kpBrickAnalyticBoundDistance(q);g.loss=clamp(st.retained*st.wet*(.0004+max(0.,macroSignal)*.6),0.,.0016);g.d=min(h.d+.006,native+g.loss);}
 if(h.id==2u){g.d=h.d-clamp(stationStoneHeight(h.q*.19)*(.25+.75*st.retained),-.004,.004);}
 if(h.id==3u||h.id==15u){g.loss=kpMetalCorrosion(stationMetalCoordinates(h,p),st.age,st.wet,st.repair)*.0008;g.d=h.d+g.loss;}
 if(h.id==4u){g.d=h.d-kpWoodMacroDisplacement(h.q,stationWoodClass(h),stationWoodParams(h,st));}
 if(h.id==17u){g.d=h.d-stationConcreteHeight(h.q,st.retained);}
 if(h.id==13u){g.thickness=stationCoatingThickness(h,p,st);g.d=h.d-clamp(stationStoneHeight(h.q*.19)*.25,-.001,.001)-g.thickness;}
 return g;
}
fn evaluateStationMatter(h:HitField,p:vec3<f32>,normal:vec3<f32>,fp:f32)->StationMatter{
 let st=resolveStationState(p);let g=evaluateStationGeometry(h,p,st);var m=StationMatter(g.d,KpSurface(0.,vec3<f32>(.34,.33,.28),.85),0.,1.,1.,0.,0u);
 if(h.id==1u||h.id==12u){let q=brickQ(p,h.id,h.d);let seed=19.+floor(p.y/.073)*13.+floor((p.x+p.z)/.25);let variant=i32(abs(seed))%4;let loss=g.loss;m.surface=kpBrickOriginalSurface(q,seed,variant,.42,fp);let edge=min(.125-abs(q.x),.0365-abs(q.y));if(edge<.004){m.surface=KpSurface(0.,vec3<f32>(.28,.26,.21),.94);}m.surface.albedo*=1.-st.wet*.18-loss*60.;m.surface.roughness=clamp(m.surface.roughness+loss*50.,.15,.98);m.microHeight=m.surface.height;m.layer=1u;}
 if(h.id==2u){let relief=.25+.75*st.retained;m.surface=kpStoneSurface(h.q*.19,st.age,st.wet,st.repair,fp*.19);m.surface.height*=relief;m.layer=2u;}
 if(h.id==3u||h.id==15u){let loss=g.loss;m.surface=kpMetalSurface(stationMetalCoordinates(h,p),st.age,st.wet,st.repair,fp);m.metal=.45;m.microHeight=m.surface.height+loss;m.layer=3u;}
 if(h.id==4u){let wp=stationWoodParams(h,st);let cls=stationWoodClass(h);let wn=select(normal,normal.zxy,h.seed==38.);let source=kpWoodOriginalSample(h.q,wn,cls,wp,fp,length(p-u.eye));m.surface=source.surface;m.cavity=source.cavity;m.specular=source.specularLevel;m.microHeight=source.surface.height;m.layer=4u;}
 if(h.id==17u){m.surface=kpConcreteStation(h.q,st.retained,st.wet,st.repair,fp);m.layer=17u;}
 if(h.id==13u){let a=stationPlasterParams(h.extent);let thickness=g.thickness;m.surface=kpPlasterOriginalField(h.q,a,fp).surface;let revealed=1.-smoothstep(.0001,.001,thickness);if(revealed>0.){let exposed=kpStoneSurface(h.q*.19,st.age,st.wet,st.repair,fp*.19);m.surface.albedo=mix(m.surface.albedo,exposed.albedo,revealed);m.surface.roughness=mix(m.surface.roughness,exposed.roughness,revealed);}m.surface.albedo*=1.-st.wet*.18;m.microHeight=m.surface.height*(1.-revealed);m.layer=select(13u,2u,revealed>.5);}
 return m;
}
`;
