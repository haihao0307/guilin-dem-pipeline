/** Entire room/brick arrangement is a compact function domain. No brick list,
 * mesh, instance matrices, tessellator, marching-cubes or appearance textures. */
export const ROOM_SCORE=Object.freeze({schema:'kaopu.implicit-room/1',units:'metre',seed:19,room:{width:6,height:3.4,depth:3.8,wallThickness:.24},brick:{pitch:[.25,.07],stagger:.5,variation:.42},fabric:{age:.64,wetness:.18,repair:.75},rain:{source:[-2.35,3.32,-.13],fallLength:3.3},repairRegion:{center:[1.65,1.3],radius:[.58,.55]},physicalFootprintM:.0003,materials:'locked existing mothers; no unbound fallback'});
export const DOMAIN_WGSL=String.raw`
struct RoomField { d:f32, id:i32, q:vec3<f32>, seed:f32, variant:i32, wet:f32, repair:f32, age:f32 };
fn boxD(p:vec3<f32>,b:vec3<f32>)->f32{let q=abs(p)-b;return length(max(q,vec3<f32>(0.)))+min(max(q.x,max(q.y,q.z)),0.);}
fn roundedD(p:vec3<f32>,b:vec3<f32>,r:f32)->f32{return boxD(p,b-vec3<f32>(r))-r;}
fn capsuleD(p:vec3<f32>,a:vec3<f32>,b:vec3<f32>,r:f32)->f32{let q=p-a;let v=b-a;return length(q-v*clamp(dot(q,v)/dot(v,v),0.,1.))-r;}
fn chooseField(a:RoomField,b:RoomField)->RoomField{if(b.d<a.d){return b;}return a;}
fn rawField(d:f32,id:i32,q:vec3<f32>)->RoomField{return RoomField(d,id,q,19.,0,0.,0.,u.age);}
fn woodField(d:f32,q:vec3<f32>,variant:i32)->RoomField{var f=rawField(d,4,q);f.variant=variant;return f;}
fn repairAt(p:vec3<f32>)->f32{let q=(p.xy-vec2<f32>(1.65,1.3))/vec2<f32>(.58,.55);return (1.-smoothstep(.72,1.,length(q)))*.75;}
fn historyAt(p:vec3<f32>)->f32{let runoff=(1.-smoothstep(.04,.36,abs(p.x+2.35)))*(1.-smoothstep(2.6,3.32,3.32-p.y));let base=(1.-smoothstep(.10,.65,p.y))*.65;return clamp(runoff*.8+base+.08,0.,1.);}
fn pierceFront(p:vec3<f32>,d:f32)->f32{let door=boxD(p-vec3<f32>(-.85,1.18,0.),vec3<f32>(.57,1.28,.55));let window=boxD(p-vec3<f32>(1.35,1.97,0.),vec3<f32>(.72,.72,.55));return max(d,max(-door,-window));}
fn plasterParams()->KpPlasterParams{return KpPlasterParams(vec2<f32>(0,1.7),vec2<f32>(3,1.7),.0165,.0085,0.,.008,.025,.0002,vec3<f32>(.43,.425,.395),vec3<f32>(.64,.625,.57),.0008,.000008,.018);}
fn woodLocalNormal(f:RoomField)->vec3<f32>{let b=select(vec3<f32>(1.20,.11,.75),vec3<f32>(.25,.075,.075),f.variant==1);let v=abs(f.q)/b;if(v.x>v.y&&v.x>v.z){return vec3<f32>(sign(f.q.x),0,0);}if(v.y>v.z){return vec3<f32>(0,sign(f.q.y),0);}return vec3<f32>(0,0,sign(f.q.z));}
fn wallState(p:vec3<f32>)->KpFabricState{let original=kpV26WaterWeather(p/4.,vec3<f32>(0,0,-1),p-vec3<f32>(0,1.7,0),vec3<f32>(6,3.4,.24),19.,67.);let causal=historyAt(p);let runoff=clamp(causal*(.75+original.x*.25)*u.wetness,0.,1.);let a=plasterParams();let pm=kpPlasterMacro(p,a);let pu=kpPlasterMicro(p,a);let thickness=clamp(a.thicknessM+a.reliefM*pm+a.geometryMicroM*pu,a.minThicknessM,a.maxThicknessM);return kpFabricState(u.age,.88,runoff,original.y,0.,repairAt(p),pm,pu,thickness,.001,.025);}
fn wallDomain(p:vec3<f32>)->RoomField{
 let rep=repairAt(p);let state=wallState(p);let age=u.age;let wet=state.moisture;
 var result=rawField(pierceFront(p,boxD(p-vec3<f32>(0.,1.7,.037),vec3<f32>(3.,1.7,.133))),1,p);result.age=age;result.wet=wet;result.repair=rep;
 // Query only local neighbours; each query has its own fixed native mother tuple.
 let row=i32(floor(p.y/.07));var nearest=1e4;var nq=p;var ns=19.;var nv=0;
 for(var dy=-1;dy<=1;dy++){let ry=row+dy;let shift=f32(ry&1)*.125;let column=i32(floor((p.x-shift)/.25));for(var dx=-1;dx<=1;dx++){let cx=column+dx;let c=vec3<f32>((f32(cx)+.5)*.25+shift,(f32(ry)+.5)*.07,-.065);let q=vec3<f32>(p.x-c.x,p.y-c.y,-(p.z-c.z));let seed=19.+f32(cx)*13.7+f32(ry)*41.3;let variant=i32(floor(kpIdentityHash(seed)*4.));let broad=roundedD(q,vec3<f32>(.12,.030576923,.055384615),.0013);if(broad<nearest){nearest=broad;nq=q;ns=seed;nv=variant;}}}
 if(nearest<.012 && abs(p.z+.12)<.026){nearest=kpBrickBaseDistance(nq,ns,nv,.42);let surf=kpBrickOriginalSurface(nq,ns,nv,.42,.0003);nearest-=surf.height*u.microscope;}
 nearest=max(nearest,boxD(p-vec3<f32>(0.,1.7,0.),vec3<f32>(3.,1.7,.4)));nearest=pierceFront(p,nearest);if(nearest<result.d){result=RoomField(nearest,2,nq,ns,nv,wet,rep,age);}
 // A finite retained plaster thickness from the same causal ageing state.
 let remain=state.thicknessM*smoothstep(-.075,.08,state.retention);
 if(remain>.0003){let micro=kpPlasterOriginalField(p,plasterParams(),.0003).surface.height*u.microscope;let coat=max(-p.z-.12-remain-micro,p.z+.12);let bounded=max(coat,boxD(p-vec3<f32>(0.,1.7,0.),vec3<f32>(3.,1.7,.5)));let d=pierceFront(p,bounded);if(d<result.d){result=RoomField(d,1,p,19.,0,wet,rep,age);}}
 return result;
}
fn sceneField(p:vec3<f32>)->RoomField{
 var f=wallDomain(p);
 f=chooseField(f,rawField(boxD(p-vec3<f32>(0.,-.09,1.45),vec3<f32>(3.45,.09,2.85)),3,p));
 // Finite rear/side envelope leaves the room genuinely open through its door.
 f=chooseField(f,rawField(boxD(p-vec3<f32>(-3.08,1.7,1.9),vec3<f32>(.08,1.7,1.9)),1,p));
 f=chooseField(f,rawField(boxD(p-vec3<f32>(0.,1.7,3.86),vec3<f32>(3.,1.7,.06)),1,p));
 // Door frame consists of analytic solids, not a ring of little boxes.
 let frameOuter=boxD(p-vec3<f32>(-.85,1.23,-.15),vec3<f32>(.67,1.30,.085));let frameInner=boxD(p-vec3<f32>(-.85,1.18,-.15),vec3<f32>(.55,1.25,.20));f=chooseField(f,rawField(max(frameOuter,-frameInner),3,p));
 let wo=boxD(p-vec3<f32>(1.35,1.97,-.10),vec3<f32>(.76,.76,.055));let wi=boxD(p-vec3<f32>(1.35,1.97,-.10),vec3<f32>(.685,.685,.12));f=chooseField(f,rawField(max(wo,-wi),5,p));
 f=chooseField(f,rawField(boxD(p-vec3<f32>(1.35,1.97,-.065),vec3<f32>(.682,.682,.004)),6,p));
 // Separate rail sections preserve a real pedestrian gap at the doorway.
 for(var side=0;side<2;side++){let lo=select(-2.75,-.14,side==1);let hi=select(-1.57,2.75,side==1);let x=clamp(round((p.x-lo)/.34)*.34+lo,lo,hi);f=chooseField(f,rawField(capsuleD(p,vec3<f32>(x,.05,-.82),vec3<f32>(x,1.05,-.82),.018),5,p));f=chooseField(f,rawField(capsuleD(p,vec3<f32>(lo,1.07,-.82),vec3<f32>(hi,1.07,-.82),.027),5,p));}
 // Single analytic sagging cable domain; no segment vertex buffer.
 let tx=clamp(p.x,-2.8,2.8);let cy=3.03-.10*(1.-tx*tx/7.84);let cable=length(p-vec3<f32>(tx,cy,-.22))-.013;f=chooseField(f,rawField(cable,7,p));
 // A timber bed, kept large-scale and readable through the opening.
 f=chooseField(f,woodField(boxD(p-vec3<f32>(-1.62,.52,2.18),vec3<f32>(.75,.11,1.20)),vec3<f32>(p.z-2.18,p.y-.52,p.x+1.62),0));for(var sx=-1;sx<=1;sx+=2){for(var sz=-1;sz<=1;sz+=2){let q=p-vec3<f32>(-1.62+f32(sx)*.66,.25,2.18+f32(sz)*1.1);f=chooseField(f,woodField(boxD(q,vec3<f32>(.075,.25,.075)),q.yxz,1));}}

 // Rail and a single bounded hanging cloth height domain, no tessellated garment.
 f=chooseField(f,rawField(capsuleD(p,vec3<f32>(-.1,2.85,2.15),vec3<f32>(2.45,2.85,2.15),.018),5,p));
 let cq=p-vec3<f32>(1.2,2.08,2.15);let sheet=.045*sin(cq.x*8.)+.018*sin(cq.y*5.+cq.x*3.);let q=vec3<f32>(cq.x,cq.y,cq.z-sheet);var cloth=boxD(q,vec3<f32>(.46,.67,.0006));if(abs(q.z)<.002&&abs(q.x)<.47&&abs(q.y)<.68){cloth=max(clothNative(q).d,boxD(q,vec3<f32>(.46,.67,.02)));}f=chooseField(f,rawField(cloth,8,q));
 if(abs(f.d)<.012){if(f.id==3){f.d-=kpStoneSurface(p,u.age,u.wetness*.12,0.,.0003).height*u.microscope;}if(f.id==4){let wn=woodLocalNormal(f);let wc=select(0.,1.,abs(wn.x)>.72);f.d-=kpWoodMacroDisplacement(f.q,wc,kpWoodDefaultParams())+kpWoodOriginalSurface(f.q,wn,wc,kpWoodDefaultParams(),.0003,0.).height*u.microscope;}if(f.id==5){f.d-=kpMetalSurface(p,u.age,historyAt(p)*u.wetness,repairAt(p),.0003).height*u.microscope;}if(f.id==7){f.d-=kpCableSurface(p,.0003).height*u.microscope;}}
 return f;
}
`;
