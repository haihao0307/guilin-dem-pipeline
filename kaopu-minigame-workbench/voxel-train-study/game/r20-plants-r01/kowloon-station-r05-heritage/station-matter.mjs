// One physical-material evaluation shared by intersection and shading.
// Source mother functions are unchanged. History mappings below are new authored
// station adapters, not calibrated erosion laws or recovered historical facts.
export const STATION_MATTER_WGSL=String.raw`
struct StationState{age:f32,wet:f32,repair:f32,retained:f32,}
struct StationMatter{d:f32,surface:KpSurface,metal:f32,cavity:f32,specular:f32,microHeight:f32,layer:u32,clearcoat:f32,clearcoatRoughness:f32,parallaxHeight01:f32,}
fn resolveStationState(p:vec3<f32>)->StationState{let repair=repairAt(p);return StationState(u.age,stateWet(p),repair,u.age*(1.-repair));}
// Shore exposure is construction semantics. Water height is station-local,
// never a centered member coordinate. Authored capillary fade is not calibration.
// Conservation is a material/member property, not a global "make it new" mask.
// Tower and above-ground main-hall fabric only; platform/ground remain unchanged.
fn stationHeritageMember(h:HitField)->bool{return h.seed==71.||h.seed==171.||h.seed==172.||h.seed==173.||h.seed==174.||h.seed==175.||(h.seed==191.&&h.id!=17u&&h.id!=3u);}
fn stationHeritageExposure(h:HitField,p:vec3<f32>)->vec3<f32>{
 // Interior lining is sheltered from facade run-off; handled edges retain wear.
 if(h.seed==174.){return vec3<f32>(0.,.55,1.-smoothstep(1.2,2.,p.y));}
 let tower=h.seed==71.||h.seed==171.||h.seed==172.||h.seed==173.||h.seed==175.;
 let q=select(p,p-vec3<f32>(24.,0.,4.),tower);
 let belowCornice=select(12.-q.y,min(abs(q.y-28.60+.22),min(abs(q.y-37.55+.20),abs(q.y-8.10+.20))),tower);
 let sheltered=(1.-smoothstep(.08,.40,abs(belowCornice)))*(1.-smoothstep(.4,1.,abs(q.y-12.))*.1);
 let edge=select(abs(rep(p.x,7.5,-4.,4.)),abs(min(abs(q.x),abs(q.z))-.87),tower);
 let rain=(1.-smoothstep(.035,.17,edge))*(.35+.65*smoothstep(1.5,3.,q.y));
 let touch=(1.-smoothstep(1.2,2.0,q.y))*(1.-smoothstep(.15,.65,edge));
 return vec3<f32>(rain,sheltered,touch);
}
fn stationMemberState(h:HitField,p:vec3<f32>,state:StationState)->StationState{var st=state;
 if(stationHeritageMember(h)){let e=stationHeritageExposure(h,p);st.age=min(1.,.32+state.age*.78);st.repair=max(st.repair,.38);st.wet=min(.12,state.wet*.35+e.x*.035);st.retained=st.age*(1.-st.repair*.35);}
if(h.seed==186.){let contact=stationWaterfrontWaterContact(h.sourceSeed);st.wet=max(st.wet,contact*(1.-smoothstep(-.52,.65,p.y)));}return st;}
fn stationWoodParams(h:HitField,st:StationState)->KpWoodParams{var wp=kpWoodDefaultParams();if(h.seed==38.||h.seed==39.||h.seed==138.||h.seed==139.||h.seed==148.||h.seed==149.){wp.textureScale=BENCH_WOOD_SCALE;wp.grainContrast=BENCH_WOOD_CONTRAST;}let stockSeed=select(h.sourceSeed,floor(h.sourceSeed/8.),h.seed==138.||h.seed==139.||h.seed==148.||h.seed==149.);wp.seed=fract(wp.seed+stockSeed*.61803398875);wp.reliefScale*=.35+.85*st.retained;wp.roughness=clamp(wp.roughness+.07*st.retained-.12*st.repair,.2,.98);wp.agedSurfaceColor=mix(wp.freshCutColor,wp.agedSurfaceColor,.4+.6*st.retained);wp.clearcoat=.12*st.repair;return wp;}
// The complete material direction frame matches the position construction.
// Platform slats use zxy; hall rows use an explicit signed Z reflection.
fn stationMaterialDirection(h:HitField,p:vec3<f32>,d:vec3<f32>)->vec3<f32>{if(h.seed==172.){return heritageTimberDirection(h.sourceSeed,d);}if(h.seed==174.){return heritagePlasterDirection(h.sourceSeed,d);}if(h.id==4u&&(h.seed==138.||h.seed==139.)){return vec3<f32>(-d.z,d.y,d.x);}if(h.id==4u&&(h.seed==148.||h.seed==149.)){let side=select(-1.,1.,p.z>=0.);return vec3<f32>(d.x*side,d.y,d.z*side);}if(h.id==4u&&h.seed==38.){return d.zxy;}if(h.id==4u&&h.seed==39.){return vec3<f32>(d.x,d.y,d.z*select(-1.,1.,p.z>=0.));}return d;}
// q/extents remain each real slat for end/side classification. Mother sampling
// adds the recovered offset in its common stock, in both geometry and shading.
fn stationWoodCoordinates(h:HitField)->vec3<f32>{let k=h.sourceSeed-floor(h.sourceSeed/8.)*8.;if(h.seed==138.||h.seed==148.){return h.q+vec3<f32>(0.,0.,k*.115);}if(h.seed==139.||h.seed==149.){return h.q+vec3<f32>(0.,k*.10,0.);}return h.q;}
fn stationWoodClass(h:HitField)->f32{let face=abs(h.q)-h.extent;return select(0.,1.,face.x>=max(face.y,face.z));}
// Geometry-only closure of the SAME original matter signals. Avoid evaluating
// pigment/filtered microscopy at every ray step. Shading calls this closure too.
struct StationGeometry{d:f32,loss:f32,thickness:f32,brickWeight:f32,}
fn stationStoneHeight(qM:vec3<f32>)->f32{let pos=qM/KP_STONE_SCALE_M;let seed=st_seedVector(KP_STONE_COLOR_SEED,.071);let q=st_warp(pos,seed);let broad=st_sf(q*1.35+seed);let region=st_sf(q*3.2+seed+vec3<f32>(11.));let vein=(1.-smoothstep(.028,.072,st_line(q,seed)))*smoothstep(.34,.63,region);let pits=pow(max(0.,(st_sf(q*19.+st_seedVector(KP_STONE_PORE_SEED,.061))-.57)/.43),2.);return ((broad-.5)*.018+(region-.5)*.007+vein*.004-pits*.025)*KP_STONE_SCALE_M;}
fn stationConcreteHeight(p:vec3<f32>,age:f32)->f32{let q=p+vec3<f32>(19.,19.*.71,19.*.37);let meso=mt_kn(q*3.7);let fine=mt_kn(q*127.);let chip=smoothstep(.64,.81,mt_kn(q*23.))*smoothstep(.46,.76,meso)*age;return(fine-.5)*.00042-chip*.0007;}
fn stationCoatingThickness(h:HitField,p:vec3<f32>,st:StationState)->f32{let a=stationPlasterParams(h.extent);let macroSignal=kpPlasterMacro(h.q,a);let sourceThickness=clamp(a.thicknessM+a.reliefM*macroSignal,a.minThicknessM,a.maxThicknessM);let exposure=clamp(st.wet*2.8+(1.-smoothstep(.2,1.8,p.y))*.18,0.,1.);let decay=clamp(st.retained*exposure,0.,1.);let defect=macroSignal*.5+.5;let coverage=smoothstep(decay*.9-.03,decay*.9+.04,defect);return sourceThickness*coverage;}
// Source iron noise remains metric; contact height uses the actual station
// datum rather than an arbitrary member centre. Rail crown maps to source 1.07m.
fn stationMetalCoordinates(h:HitField,p:vec3<f32>)->vec3<f32>{let rail=h.id==3u&&h.seed==55.;return vec3<f32>(h.q.x,select(p.y,p.y+(1.07-RAIL_CROWN),rail),h.q.z);}
// A specified charcoal roof finish is a finite paint ingredient of the steel
// assembly. The same corrosion event removes its 60um thickness and reveals rust.
fn isStationRoof(h:HitField)->bool{return h.id==15u||(h.id==3u&&(h.seed==8.||h.seed==94.||h.seed==96.));}
fn stationRoofPaintCoverage(h:HitField,p:vec3<f32>,st:StationState)->f32{return 1.-kpMetalCorrosion(stationMetalCoordinates(h,p),st.age,st.wet,st.repair)*.8;}
// R02 source parameter bindings, retaining the A4 kh/kn/kfb fields exactly.
// Seed181 is the old green-iron surrogate named roof-copper, not a validated
// copper mother. Seed182 is the actual original A4 brass parameter set. Neither
// is silently passed through the iron-rust chemistry adapter.
fn stationLegacyMetal(h:HitField,fp:f32)->KpSurface{let brass=h.seed==182.;let q=h.q+vec3<f32>(19.);let color=select(vec3<f32>(.1946178304415758,.3467040563550296,.2831487404299921),vec3<f32>(.4793201831008268,.3564001441459435,.14412847085805777),brass);let rough=select(.53,.31,brass);let height=(mt_kn(q*65.)-.5)*.00025*(1.-smoothstep(.4,1.6,fp*65.));return KpSurface(height,color*(.94+.09*mt_kfb(q*3.1)),clamp(rough+(mt_kn(q*9.)-.5)*.12,.08,.99));}
// Original A4 finish closure, using the already source-locked noise functions.
// These are named source parameter bindings, not replacement mother kernels.
fn stationOriginalFinish(q0:vec3<f32>,base:vec3<f32>,rough:f32,fp:f32)->KpSurface{let q=q0+vec3<f32>(19.);return KpSurface((mt_kn(q*65.)-.5)*.00025*(1.-smoothstep(.4,1.6,fp*65.)),base*(.94+.09*mt_kfb(q*3.1)),clamp(rough+(mt_kn(q*9.)-.5)*.12,.08,.99));}
fn stationLampEmission(h:HitField)->f32{return select(0.,2.2,h.id==7u&&h.seed==184.);}
// Exact accepted R02 cast/rolled member role parameters. The locked FH88
// corrosion/noise/height field remains one kernel; this binds its original
// constructor inputs instead of flattening every metal to the same green/dielectric.
fn stationIronRole(h:HitField)->vec4<f32>{let castRole=h.seed==56.||h.seed==38.||h.seed==39.||h.seed==184.;if(castRole){return vec4<f32>(.0953074666309647,.16826940018969075,.13563332965520566,.58);}if(h.seed==188.){return vec4<f32>(.0295568344378088,.05448027644244237,.04091519690685319,.53);}return vec4<f32>(.22696587351009836,.3049873140698863,.26225065752969623,.43);}
fn stationIronMetalness(h:HitField)->f32{if(h.seed==56.||h.seed==38.||h.seed==39.||h.seed==184.){return .10;}if(h.seed==188.){return .60;}return .40;}
// New finite diagonal lantern walls use true tangent metres for the unchanged
// brick mother. Existing members return the exact previous station point.
fn stationBrickPoint(h:HitField,p:vec3<f32>)->vec3<f32>{if(h.seed==175.){return vec3<f32>(h.q.x,p.y,h.q.z);}return p;}
fn evaluateStationGeometry(h:HitField,p:vec3<f32>,state:StationState)->StationGeometry{
 let st=stationMemberState(h,p,state);
 var g=StationGeometry(h.d,0.,0.,1.);
 if(h.id==1u||h.id==12u){let bp=stationBrickPoint(h,p);let q=brickQ(bp,h.id,h.d);let seed=19.+floor(bp.y/.073)*13.+floor((bp.x+bp.z)/.25);let variant=i32(abs(seed))%4;let native=kpBrickBaseDistance(q,seed,variant,.42);let macroSignal=native-kpBrickAnalyticBoundDistance(q);g.loss=clamp(st.retained*st.wet*(.0004+max(0.,macroSignal)*.6),0.,.0016);let mortarDistance=h.d+.006;let brickDistance=native+g.loss;g.brickWeight=select(0.,1.,brickDistance<=mortarDistance);g.d=min(mortarDistance,brickDistance);}
 if(h.id==2u){g.d=h.d-clamp(stationStoneHeight(h.q*.19)*(.25+.75*st.retained),-.004,.004);}
 if((h.id==3u||h.id==15u)&&h.seed!=181.&&h.seed!=182.){g.loss=kpMetalCorrosion(stationMetalCoordinates(h,p),st.age,st.wet,st.repair)*.0008;g.d=h.d+g.loss;if(isStationRoof(h)){g.thickness=.00006*stationRoofPaintCoverage(h,p,st);g.d-=g.thickness;}}
 if(h.id==4u){g.d=h.d-kpWoodMacroDisplacement(stationWoodCoordinates(h),stationWoodClass(h),stationWoodParams(h,st));}
 if(h.id==17u||h.id==19u){g.d=h.d-stationConcreteHeight(h.q,st.retained);}
 if(h.id==13u){g.thickness=stationCoatingThickness(h,p,st);g.d=h.d-clamp(stationStoneHeight(h.q*.19)*.25,-.001,.001)-g.thickness;}
 return g;
}
fn evaluateStationMatter(h:HitField,p:vec3<f32>,normal:vec3<f32>,fp:f32)->StationMatter{
 let state=resolveStationState(p);let st=stationMemberState(h,p,state);let g=evaluateStationGeometry(h,p,state);var m=StationMatter(g.d,KpSurface(0.,vec3<f32>(.34,.33,.28),.85),0.,1.,1.,0.,0u,0.,1.,0.);
 if(h.id==1u||h.id==12u){let bp=stationBrickPoint(h,p);let q=brickQ(bp,h.id,h.d);let seed=19.+floor(bp.y/.073)*13.+floor((bp.x+bp.z)/.25);let variant=i32(abs(seed))%4;let loss=g.loss;m.surface=kpBrickOriginalSurface(q,seed,variant,.42,fp);if(g.brickWeight==0.){m.surface=KpSurface(0.,vec3<f32>(.28,.26,.21),.94);}m.surface.albedo*=1.-st.wet*.18-loss*60.;m.surface.roughness=clamp(m.surface.roughness+loss*50.,.15,.98);m.microHeight=m.surface.height;m.layer=1u;}
 if(h.id==2u){let relief=.25+.75*st.retained;m.surface=kpStoneSurface(h.q*.19,st.age,st.wet,st.repair,fp*.19);m.surface.height*=relief;m.layer=2u;}
 if(h.id==3u||h.id==15u){let loss=g.loss;m.surface=kpMetalSurface(stationMetalCoordinates(h,p),st.age,st.wet,st.repair,fp);let corrosion=kpMetalCorrosion(stationMetalCoordinates(h,p),st.age,st.wet,st.repair);let role=stationIronRole(h);if(!isStationRoof(h)){m.surface.albedo+=(role.rgb-vec3<f32>(.17,.235,.20))*(.94+.09*mt_kfb((stationMetalCoordinates(h,p)+vec3<f32>(19.))*3.1))*(1.-corrosion*.80)*(1.-st.wet*.18);m.surface.roughness=clamp(m.surface.roughness+role.a-.53,.12,.97);}if(isStationRoof(h)){let mq=stationMetalCoordinates(h,p);let pigmentDelta=vec3<f32>(.066,.073,.078)-vec3<f32>(.17,.235,.20);m.surface.albedo+=pigmentDelta*(.94+.09*mt_kfb((mq+vec3<f32>(19.))*3.1))*stationRoofPaintCoverage(h,p,st)*(1.-st.wet*.18);}m.metal=select(stationIronMetalness(h)*(1.-corrosion),0.,isStationRoof(h));if(h.id==3u&&h.seed==55.){let contact=1.-smoothstep(.01,.035,abs(stationMetalCoordinates(h,p).y-1.07));m.metal=(.40+.48*contact)*(1.-corrosion);}m.microHeight=m.surface.height+loss;m.layer=3u;}
 // Explicit preservation binding; physical copper ageing remains a recorded
 // material gap. Source microheight is consumed by the original normal response.
 if(h.id==3u&&(h.seed==181.||h.seed==182.)){m.surface=stationLegacyMetal(h,fp);m.metal=select(.60,.78,h.seed==182.);m.microHeight=m.surface.height;m.layer=3u;}
 if(h.id==4u){let wp=stationWoodParams(h,st);let cls=stationWoodClass(h);let wn=stationMaterialDirection(h,p,normal);let source=kpWoodOriginalSample(stationWoodCoordinates(h),wn,cls,wp,fp,length(p-u.eye));m.surface=source.surface;m.cavity=source.cavity;m.specular=source.specularLevel;m.microHeight=source.surface.height;m.layer=4u;m.clearcoat=source.clearcoat;m.clearcoatRoughness=source.clearcoatRoughness;m.parallaxHeight01=source.parallaxHeight01;}
 if(h.id==17u||h.id==19u){m.surface=kpConcreteStation(h.q,st.retained,st.wet,st.repair,fp);m.layer=17u;}
 if(h.id==13u){let a=stationPlasterParams(h.extent);let thickness=g.thickness;m.surface=kpPlasterOriginalField(h.q,a,fp).surface;let revealed=1.-smoothstep(.0001,.001,thickness);if(revealed>0.){let exposed=kpStoneSurface(h.q*.19,st.age,st.wet,st.repair,fp*.19);m.surface.albedo=mix(m.surface.albedo,exposed.albedo,revealed);m.surface.roughness=mix(m.surface.roughness,exposed.roughness,revealed);}m.surface.albedo*=1.-st.wet*.18;m.microHeight=m.surface.height*(1.-revealed);m.layer=select(13u,2u,revealed>.5);}
 if(h.id==7u){let lamp=h.seed==184.;var base=select(vec3<f32>(.8148465722161012,.7529422167760779,.5520114015120001),vec3<f32>(1.,.7230551289219693,.3564001441459435),lamp);if(h.seed==187.){base=vec3<f32>(.7835377915261935,.7011018919329731,.5271151257058131);}m.surface=stationOriginalFinish(h.q,base,select(.34,.20,lamp),fp);m.metal=select(0.,.05,lamp);m.microHeight=m.surface.height;m.layer=7u;}
 if(h.id==8u){m.surface=stationOriginalFinish(h.q,vec3<f32>(.0295568344378088,.052860647023180246,.04091519690685319),.34,fp);m.microHeight=m.surface.height;m.layer=8u;}
 if(h.id==18u){m.surface=stationOriginalFinish(h.q,vec3<f32>(.13843161503245183,.16826940018969075,.14412847085805777),.92,fp);m.metal=.05;m.microHeight=m.surface.height;m.layer=18u;}
 if(h.id==9u){m.surface=stationOriginalFinish(h.q,vec3<f32>(.04518620438567554,.10224173308810132,.07227185068231748),.34,fp);m.microHeight=m.surface.height;m.layer=9u;}
 // The same substrate relief/erosion above remains responsible for geometry.
 // These conservation finish bindings consume the mother variation; no extra noise,
 // black grunge overlay, duplicate surface, or changed ground material is added.
 if(stationHeritageMember(h)){
  let e=stationHeritageExposure(h,p);let patina=st.retained*(.018+e.x*.045+e.y*.060);
  if(h.id==2u){let l=dot(m.surface.albedo,vec3<f32>(.2126,.7152,.0722));let grain=clamp(l/.18,.50,1.65);m.surface.albedo=vec3<f32>(.40,.385,.34)*(.84+.16*grain)*(1.-patina);m.surface.roughness=clamp(m.surface.roughness-.035*e.z,.48,.88);}
  if(h.id==13u){let l=dot(m.surface.albedo,vec3<f32>(.2126,.7152,.0722));m.surface.albedo=vec3<f32>(.62,.585,.50)*clamp(l/.72,.84,1.12)*(1.-patina);m.surface.roughness=clamp(m.surface.roughness,.59,.88);}
  if(h.id==1u||h.id==12u){m.surface.albedo*=vec3<f32>(1.04,.97,.91)*(1.-patina*.55);}
  if(h.id==19u){let l=dot(m.surface.albedo,vec3<f32>(.2126,.7152,.0722));m.surface.albedo=vec3<f32>(.67,.655,.60)*clamp(l/.40,.89,1.07)*(1.-patina*.6);m.surface.roughness=clamp(m.surface.roughness,.67,.90);m.metal=0.;m.layer=19u;}
 }
 return m;
}
`;

