// Authored reference-led service furniture. All coordinates are metres.
// Reference pixels, historic company names and period people are not shipped.
export const PUBLIC_COUNTER_LAYOUT = Object.freeze({
 version: 'bureau-r03f-continuous-service-counter-01',
 handoverSurfaceY: 1.30,
 writingSurfaceY: .84,
 writingClearanceY: .79,
 writingHalfWidthZ: .64,
 writingFrontX: -33.72,
 bodyFrontX: -33.06,
 continuousTop: { x: [-33.18, -31.82], z: [-7.35, 17.75], y: 1.30, radius: .13 },
 protectedHandoverHalfZ: .90,
 staffFixtures: [{id:"number-sign", center:[.38,1.47,-1.23], half:[.05,.14,.22]}, {id:"folio", center:[.24,1.325,1.31], half:[.20,.025,.20]}],
 publicCrossingsZ: [-18, 20],
 staffSpineX: -30.5,
 staffSpineHalfWidth: .65,
 staffStandingEnvelope: {x: -31.48, halfWidthX: .30, designOnly: true},
 caseworkOnly: true,
});

export const PUBLIC_COUNTER = String.raw`
// A slab is a rounded plan extruded through its actual thickness. Its form is
// the ray-intersection field, not a painted rounded rectangle on a box.
fn publicRoundedSlab(q:vec3<f32>,half:vec3<f32>,radius:f32)->f32 {
 let plan=abs(q.xz)-(half.xz-vec2<f32>(radius));
 let rounded=length(max(plan,vec2<f32>(0.)))+min(max(plan.x,plan.y),0.)-radius;
 return max(rounded,abs(q.y)-half.y);
}
fn publicCounterWood(d:f32,mat:u32,local:vec3<f32>,half:vec3<f32>,seed:f32,p:vec3<f32>)->Field {
 var f=interiorPart(d,mat,local.zyx,seed,p);
 // The same rigid coordinates feed mother normal, grain and footprint. Bounds
 // describe this specific member, not the complete building or a generic box.
 f.component=MaterialFrame(rigidWest(),-half.zyx,half.zyx,1.);return f;
}
// Thin paper packets use a new, explicit authored cellulose approximation.
// It is not plaster, brass or a claimed recovered material mother. The same
// bounded fibre-height function drives its solid and surface micro-normal.
fn publicPaperSurface(q:vec3<f32>,seed:f32,age:f32,footprint:f32)->KpSurface {
 let fibre=(br_noise3(q*vec3<f32>(1800.,1.,550.)+vec3<f32>(seed))-.5)*(1.-smoothstep(.0002,.002,footprint));
 let stain=br_noise3(q*7.+vec3<f32>(seed))*.025*age;
 return KpSurface(fibre*.000018,vec3<f32>(.69,.675,.60)*(1.-stain),.92);
}
fn publicPaperPacket(q:vec3<f32>,half:vec3<f32>,seed:f32,p:vec3<f32>)->Field {
 let paper=publicPaperSurface(q,seed,u.options.y,0.);
 return interiorPart(box(q,half)-paper.height,20u,q,seed,p);
}
fn interiorCounter(p:vec3<f32>)->Field {
 let bay=clamp(round((p.z+6.)/3.2),0.,7.);let q=p-vec3<f32>(-32.4,0.,-6.+3.2*bay);
 let whole=box(p-vec3<f32>(-32.4,.83,5.2),vec3<f32>(1.33,.87,12.65));
 if(whole>.65){return interiorEmpty(whole,p);}
 // One continuous construction, retaining all eight existing handover points.
 // The staff edge retracts 0.20m inside the old footprint so a 0.60m design
 // stance envelope fits before the unchanged 1.30m transport corridor.
 // Its ends stop before both the tower lobby and the public north crossing.
 let run=p-vec3<f32>(-32.5,1.245,5.2);let topHalf=vec3<f32>(.68,.055,12.55);
 var f=publicCounterWood(publicRoundedSlab(run,topHalf,.13),18u,run,topHalf,11.,p);
 let body=p-vec3<f32>(-32.5,.68,5.2);let bodyHalf=vec3<f32>(.56,.56,12.42);
 f=take(f,publicCounterWood(publicRoundedSlab(body,bodyHalf,.10),4u,body,bodyHalf,11.,p));
 let plinth=p-vec3<f32>(-32.5,.10,5.2);let plinthHalf=vec3<f32>(.50,.10,12.35);
 f=take(f,publicCounterWood(publicRoundedSlab(plinth,plinthHalf,.08),4u,plinth,plinthHalf,11.,p));
 // Framed front panels and engaged stiles retain metric thickness and shadow.
 let panel=vec3<f32>(q.x+.683,q.y-.72,abs(q.z)-.66);
 let rim=max(box(panel,vec3<f32>(.027,.39,.57)),-box(panel,vec3<f32>(.08,.335,.515)));
 f=take(f,publicCounterWood(rim,18u,panel,vec3<f32>(.027,.39,.57),bay+11.,p));
 let stile=vec3<f32>(q.x+.69,q.y-.69,abs(q.z)-1.57);
 let stileD=max(box(stile,vec3<f32>(.032,.54,.043)),abs(p.z-5.2)-12.30);
 f=take(f,publicCounterWood(stileD,18u,stile,vec3<f32>(.032,.54,.043),bay+11.,p));
 // A separate lower writing ledge is 0.84m high, with open knee room below.
 // It is not a lower custody slot and never changes the 1.30m handover anchor.
 let writing=q-vec3<f32>(-1.04,.815,.80);let wh=vec3<f32>(.28,.025,.64);
 f=take(f,publicCounterWood(publicRoundedSlab(writing,wh,.07),18u,writing,wh,bay+101.,p));
 var brackets=capsule(q,vec3<f32>(-.72,.79,.27),vec3<f32>(-.72,.51,.27),.022);
 brackets=min(brackets,capsule(q,vec3<f32>(-.72,.51,.27),vec3<f32>(-1.23,.79,.27),.022));
 brackets=min(brackets,capsule(q,vec3<f32>(-.72,.79,1.33),vec3<f32>(-.72,.51,1.33),.022));
 brackets=min(brackets,capsule(q,vec3<f32>(-.72,.51,1.33),vec3<f32>(-1.23,.79,1.33),.022));
 f=take(f,interiorPart(brackets,9u,q,bay,p));
 // Low number plate on staff edge; the person's reach and eye line stay open.
 let sign=vec3<f32>(q.z+1.23,q.y-1.47,q.x-.38);
 var metal=box(sign,vec3<f32>(.22,.115,.022));
 metal=min(metal,box(q-vec3<f32>(.38,1.315,-1.23),vec3<f32>(.14,.015,.22)));
 f=take(f,interiorPart(metal,9u,sign,bay,p));
 f=take(f,interiorPart(interiorNumber(sign-vec3<f32>(0.,0.,-.028),u32(bay)+1u,.065),13u,sign,bay,p));
 // Administrative paperwork only. All small fixtures stay outside the central
 // ±0.90m transfer strip and do not create, occupy or claim any inventory item.
 let paper=q-vec3<f32>(-1.03,.846,.88);
 f=take(f,publicPaperPacket(paper,vec3<f32>(.17,.004,.22),bay,p));
 let pen=capsule(q,vec3<f32>(-1.17,.852,.58),vec3<f32>(-.99,.852,.65),.006);
 f=take(f,interiorPart(pen,9u,q,bay,p));
 let folio=q-vec3<f32>(.24,1.325,1.31);
 f=take(f,interiorPart(box(folio,vec3<f32>(.20,.025,.20)),14u,folio,bay,p));
 return f;
}
`;
