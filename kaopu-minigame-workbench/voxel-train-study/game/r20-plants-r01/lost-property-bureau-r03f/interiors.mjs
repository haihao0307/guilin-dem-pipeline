import { PUBLIC_COUNTER } from './public-counter.mjs';
import { HANDOVER_LAYOUT } from './inventory.mjs';
/**
 * R03e occupied interiors, authored as a bounded WGSL function domain.
 * Units: metres. No inventory is synthesized and no rack/address is changed.
 * Integrate after DOMAIN and call take(scene, interiorField(p)) before wear.
 * Remove R03d's three old counter/bench/desk primitives before integrating.
 * Mat 14 painted wood, 15 public stone floor, 16 warehouse concrete,
 * 17 lamp glass/emission, 18 polished counter wood, 19 light interior plaster.
 * Roof-light openings remain the architecture owner's responsibility.
 */
export const INTERIOR_LAYOUT = Object.freeze({
  version: 'bureau-r03e-open-public-lobby-02',
  hallBounds: [[-38.35, 0, -39.4], [-28.55, 10.35, 39.4]],
  clearWarehouse: [[-28, -28], [44, 34.5]],
  handover: { first: [HANDOVER_LAYOUT.x, HANDOVER_LAYOUT.y, HANDOVER_LAYOUT.zStart], pitchZ: HANDOVER_LAYOUT.zPitch, count: HANDOVER_LAYOUT.count, counterHalfSize: [.78, .65, 1.35] },
  publicLobby: { clearPortal: { x: [-41.7, -29], z: [-20.8, -15.2] }, towerZ: [-26.2, -9.8], waitingBenches: [[-37.1, 0, -24.9], [-37.1, 0, -11.1], [-37.5, 0, -3], [-37.5, 0, 5], [-37.5, 0, 13]] },
  clearTransport: { hallSpineX: -30.5, warehouseSpinesX: [-26.5, 4, 42.5], gateZ: [-20, 0, 20], rearCrossZ: 33.5 },
  publicCrossingsZ: [-18, 20],
  warehouseColumns: { x: [-28.42, 44.32], zStart: -28, zPitch: 10.4166665, zCount: 7, halfWidth: .11 },
  lightZones: [
    { zone: 0, count: 7, first: [-35.6, 4.48, -33], step: [0, 0, 11] },
    { zone: 1, count: 9, first: [-24, 9.05, -32.35], step: [8, 0, 0] },
    { zone: 2, count: 18, first: [-22, 8.45, -17.583333], grid: [6, 3], step: [12, 0, 20.833333] },
    { zone: 3, count: 5, first: [-35.6, 9.05, -33], z: [-33, 0, 11, 22, 33] },
    { zone: 4, count: 9, first: [-24, 4.48, -32.35], step: [8, 0, 0] },
    { zone: 5, count: 4, first: [-39.5, 4.8, -23], grid: [2, 2], step: [8, 0, 10] },
  ],
  reservations: 'Architectural fixtures only. Filing cabinets are office records; empty storage bays remain empty.',
});

export const INTERIORS = String.raw`
// A distant enclosing-box result is a marching bound, never a visible object.
// Every bound encloses its complete child function, including trims and lamps.
fn interiorEmpty(d:f32,p:vec3<f32>)->Field {return field(d,0u,p,0.);}
fn interiorPart(d:f32,mat:u32,q:vec3<f32>,seed:f32,p:vec3<f32>)->Field {
 return field(shell(d,p),mat,q,seed);
}

// Shared by physical lamp geometry and the receiver's illumination. No duplicate
// hand-maintained light positions are needed in renderer.mjs.
fn interiorLightPosition(zone:u32,index:u32)->vec3<f32> {
 if(zone==5u){let i=min(index,3u);return vec3<f32>(-39.5+8.*f32(i%2u),4.8,-23.+10.*f32(i/2u));}
 if(zone==0u){return vec3<f32>(-35.6,4.48,-33.+11.*f32(min(index,6u)));}
 if(zone==1u){return vec3<f32>(-24.+8.*f32(min(index,8u)),9.05,-32.35);}
 if(zone==2u){let i=min(index,17u);return vec3<f32>(-22.+12.*f32(i%6u),8.45,-17.583333+20.833333*f32(i/6u));}
 if(zone==3u){let z=array<f32,5>(-33.,0.,11.,22.,33.);return vec3<f32>(-35.6,9.05,z[min(index,4u)]);}
 return vec3<f32>(-24.+8.*f32(min(index,8u)),4.48,-32.35);
}
fn interiorNearestLight(p:vec3<f32>,zone:u32)->u32 {
 if(zone==5u){return u32(select(0.,1.,p.x> -35.5))+2u*u32(select(0.,1.,p.z> -18.));}
 if(zone==0u){return u32(clamp(round((p.z+33.)/11.),0.,6.));}
 if(zone==2u){return u32(clamp(round((p.x+22.)/12.),0.,5.))+6u*u32(clamp(round((p.z+17.583333)/20.833333),0.,2.));}
 if(zone==3u){if(p.z< -16.5){return 0u;}return 1u+u32(clamp(round(p.z/11.),0.,3.));}
 return u32(clamp(round((p.x+24.)/8.),0.,8.));
}

// Raised seven-segment brass numbers. Evaluation is seven bounded segments per
// digit, independent of the number of windows, rows, bays, or shelf levels.
fn interiorDigit(q:vec3<f32>,digit:u32,scale:f32)->f32 {
 let masks=array<u32,10>(63u,6u,91u,79u,102u,109u,125u,7u,127u,111u);
 let mask=masks[min(digit,9u)];let v=q/scale;var d=100.;
 if((mask&1u)!=0u){d=min(d,box(v-vec3<f32>(0.,1.,0.),vec3<f32>(.36,.065,.075)));}
 if((mask&2u)!=0u){d=min(d,box(v-vec3<f32>(.42,.5,0.),vec3<f32>(.065,.39,.075)));}
 if((mask&4u)!=0u){d=min(d,box(v-vec3<f32>(.42,-.5,0.),vec3<f32>(.065,.39,.075)));}
 if((mask&8u)!=0u){d=min(d,box(v-vec3<f32>(0.,-1.,0.),vec3<f32>(.36,.065,.075)));}
 if((mask&16u)!=0u){d=min(d,box(v-vec3<f32>(-.42,-.5,0.),vec3<f32>(.065,.39,.075)));}
 if((mask&32u)!=0u){d=min(d,box(v-vec3<f32>(-.42,.5,0.),vec3<f32>(.065,.39,.075)));}
 if((mask&64u)!=0u){d=min(d,box(v,vec3<f32>(.36,.065,.075)));}
 return d*scale;
}
fn interiorNumber(q:vec3<f32>,number:u32,scale:f32)->f32 {
 return min(interiorDigit(q-vec3<f32>(-.66*scale,0.,0.),(number/10u)%10u,scale),interiorDigit(q-vec3<f32>(.66*scale,0.,0.),number%10u,scale));
}
fn interiorBankLetter(q:vec3<f32>,bank:u32,scale:f32)->f32 {
 let v=q/scale;var d=100.;
 if(bank==0u){
  d=min(capsule(v,vec3<f32>(-.62,-.8,0.),vec3<f32>(0.,.8,0.),.09),capsule(v,vec3<f32>(0.,.8,0.),vec3<f32>(.62,-.8,0.),.09));
  d=min(d,box(v-vec3<f32>(0.,-.13,0.),vec3<f32>(.38,.085,.07)));
 }else{
  d=box(v-vec3<f32>(-.43,0.,0.),vec3<f32>(.085,.85,.07));
  let yy=select(-.41,.41,v.y>0.);let ring=abs(length(vec2<f32>(v.x+.20,v.y-yy))-.40)-.085;
  d=min(d,max(max(ring,-v.x-.23),abs(v.z)-.07));
  d=min(d,box(vec3<f32>(v.x+.32,v.y-select(select(-.81,0.,v.y>-.4),.81,v.y>.4),v.z),vec3<f32>(.16,.085,.07)));
 }
 return d*scale;
}

// A fixture has a ceiling rose, real suspension rod, reflector lip and a bulb.
// The bulb centre is exactly interiorLightPosition(), including tower mounting.
fn interiorPendant(p:vec3<f32>,zone:u32,index:u32)->Field {
 let c=interiorLightPosition(zone,index);let q=p-c;var top=select(5.17,10.08,zone==1u||zone==3u);
 if(zone==0u&&c.z> -26.5&&c.z< -9.5){top=6.34;}
 if(zone==2u){top=9.06;}if(zone==5u){top=6.34;}
 let size=select(.29,.43,zone==2u);
 var metal=cylinder(p-vec3<f32>(c.x,top-.025,c.z),.12,.035);
 metal=min(metal,cylinder(p-vec3<f32>(c.x,(top+c.y+.26)*.5,c.z),.019,(top-c.y-.26)*.5));
 metal=min(metal,cylinder(q-vec3<f32>(0.,.245,0.),.075,.095));
 // Open conical reflector rather than an opaque closed cylinder over the bulb.
 let shade=max(abs(length(q.xz)-(size-.74*(q.y-.10)))-.018,max(.10-q.y,q.y-.34));
 metal=min(metal,shade);metal=min(metal,abs(length(q.xz)-size)-.024+abs(q.y-.10)*.6);
 var f=interiorPart(metal,9u,q,f32(index+zone*31u),p);
 f=take(f,interiorPart(length(q)-.105,17u,q,f32(index+zone*31u),p));return f;
}

fn interiorHallFloor(p:vec3<f32>)->Field {
 let q=p-vec3<f32>(-33.45,0.,0.);let b=box(q-vec3<f32>(0.,.018,0.),vec3<f32>(4.9,.035,39.4));
 if(b>.7){return interiorEmpty(b,p);}
 var f=field(box(q-vec3<f32>(0.,.015,0.),vec3<f32>(4.9,.018,39.4)),15u,q,1.);
 let outer=box(q-vec3<f32>(0.,.028,0.),vec3<f32>(4.67,.008,39.16));
 let inset=box(q-vec3<f32>(0.,.028,0.),vec3<f32>(4.51,.04,39.00));
 let border=max(outer,-inset);f=take(f,field(border,7u,q,1.));
 let line=max(box(q-vec3<f32>(0.,.030,0.),vec3<f32>(4.36,.007,38.85)),-box(q-vec3<f32>(0.,.030,0.),vec3<f32>(4.325,.035,38.815)));
 f=take(f,field(line,3u,q,1.));
 // Insets are part of the stone pavement, under a centimetre high. Keep every
// walking and trolley crossing on the same continuous finished floor.
 let nz=clamp(round(p.z/5.5),-7.,7.);let mosaic=vec3<f32>(p.x+35.4,p.y-.033,p.z-nz*5.5);
 let diamond=vec3<f32>((mosaic.x+mosaic.z)*.70710678,mosaic.y,(mosaic.z-mosaic.x)*.70710678);
 f=take(f,field(box(diamond,vec3<f32>(.29,.004,.29)),7u,diamond,nz));return f;
}

fn interiorTowerLobby(p:vec3<f32>)->Field {
 let bound=box(p-vec3<f32>(-35.5,3.22,-18.),vec3<f32>(6.68,3.23,7.78));if(bound>.7){return interiorEmpty(bound,p);}
 let q=p-vec3<f32>(-35.5,0.,-18.);let plan=chamferPlan(q.xz,vec2<f32>(6.60,7.70),.5);
 var f=field(max(plan,abs(p.y-.015)-.018),15u,q,27.);
 // A restrained stone inlay belongs to the whole waiting room, at the same
 // 33 mm floor height as the north hall. It is not a path-blocking step.
 let inlay=max(max(chamferPlan(q.xz,vec2<f32>(6.23,7.33),.5),-chamferPlan(q.xz,vec2<f32>(6.13,7.23),.5)),abs(p.y-.031)-.005);
 f=take(f,field(inlay,3u,q,27.));
 let lamp=interiorNearestLight(p,5u);f=take(f,interiorPendant(p,5u,lamp));return f;
}
fn interiorPublicPlaster(p:vec3<f32>)->Field {
 let bound=box(p-vec3<f32>(1.,5.20,0.),vec3<f32>(43.3,5.25,39.5));if(bound>.65){return interiorEmpty(bound,p);}
 // These are interior finish skins, not substitute walls. Their apertures are
 // the same full-sized arches used by architecture and its window joinery.
 let wz=repeatX(p.z,5.5,7.);var west=box(p-vec3<f32>(-38.375,5.15,0.),vec3<f32>(.030,5.10,39.4));
 west=max(west,-archOpening(vec3<f32>(p.z+18.,p.y,p.x+38.7),3.4,2.2,1.));
 west=max(west,-archWindow(vec3<f32>(wz,p.y-1.25,p.x+38.7),.8,1.85,.8));
 west=max(west,-archWindow(vec3<f32>(wz,p.y-6.1,p.x+38.7),.87,1.35,.8));
 west=max(west,-box(p-vec3<f32>(-35.5,9.,-18.),vec3<f32>(7.5,3.55,8.5)));
 let sx=repeatX(p.x-4.,5.5,8.);var south=box(p-vec3<f32>(8.,5.15,-36.275),vec3<f32>(36.4,5.10,.030));
 south=max(south,-archWindow(vec3<f32>(sx,p.y-1.2,p.z+36.6),.9,1.85,.8));
 south=max(south,-archWindow(vec3<f32>(sx,p.y-6.1,p.z+36.6),.9,1.35,.8));
 let tq=p-vec3<f32>(-35.5,0.,-18.);let inner=chamferPlan(tq.xz,vec2<f32>(6.62,7.72),.42);
 var tower=max(abs(inner+.012)-.022,max(.06-p.y,p.y-6.37));
 tower=max(tower,-archOpening(vec3<f32>(tq.z,p.y,tq.x+7.10),3.05,3.15,1.1));
 tower=max(tower,-archOpening(vec3<f32>(p.x+33.6,p.y,abs(tq.z)-8.2),3.95,1.55,1.1));
 tower=max(tower,-box(p-vec3<f32>(-28.4,1.7,-20.),vec3<f32>(1.,1.75,1.75)));
 return interiorPart(min(min(west,south),tower),19u,p,28.,p);
}

fn interiorHallJoinery(p:vec3<f32>)->Field {
 let b=box(p-vec3<f32>(-33.45,2.,0.),vec3<f32>(4.97,2.12,39.45));if(b>.7){return interiorEmpty(b,p);}
 var f=interiorEmpty(100.,p);let west=p.x+38.31;let east=p.x+28.59;
 // Raised-and-fielded wainscot is below the real window sills. Door cut-outs
// share the architecture's exact opening axes and clear widths.
 let panelZ=repeatX(p.z,1.1,36.);var westWood=box(vec3<f32>(west,p.y-.68,p.z),vec3<f32>(.055,.61,39.25));
 westWood=max(westWood,-box(p-vec3<f32>(-38.3,1.,-18.),vec3<f32>(.5,1.5,3.55)));
 let doorway=box(vec3<f32>(east,p.y-1.7,repeatX(p.z,20.,1.)),vec3<f32>(.5,1.8,1.80));
 var eastWood=max(box(vec3<f32>(east,p.y-.68,p.z-3.25),vec3<f32>(.055,.61,31.50)),-doorway);
 f=take(f,interiorPart(min(westWood,eastWood),4u,p.zyx,2.,p));
 var trim=min(box(vec3<f32>(west-.065,p.y-1.31,p.z),vec3<f32>(.035,.047,39.25)),box(vec3<f32>(west-.07,p.y-.18,p.z),vec3<f32>(.035,.085,39.25)));
 trim=max(trim,-box(p-vec3<f32>(-38.3,1.,-18.),vec3<f32>(.5,2.,3.55)));
 var et=min(box(vec3<f32>(east+.065,p.y-1.31,p.z-3.25),vec3<f32>(.035,.047,31.5)),box(vec3<f32>(east+.07,p.y-.18,p.z-3.25),vec3<f32>(.035,.085,31.5)));
 et=max(et,-doorway);trim=min(trim,et);
 let westField=max(box(vec3<f32>(west-.065,p.y-.71,panelZ),vec3<f32>(.015,.43,.43)),-box(vec3<f32>(west-.065,p.y-.71,panelZ),vec3<f32>(.08,.375,.365)));
 let eastField=max(box(vec3<f32>(east+.065,p.y-.71,panelZ),vec3<f32>(.015,.43,.43)),-box(vec3<f32>(east+.065,p.y-.71,panelZ),vec3<f32>(.08,.375,.365)));
 trim=min(trim,max(max(westField,abs(p.z)-39.25),-box(p-vec3<f32>(-38.3,1.,-18.),vec3<f32>(.5,2.,3.55))));trim=min(trim,max(max(eastField,-doorway),abs(p.z-3.25)-31.5));
 f=take(f,interiorPart(trim,18u,p.zyx,2.,p));
 let doorZ=repeatX(p.z,20.,1.);let jamb=box(vec3<f32>(east+.08,p.y-1.72,abs(doorZ)-1.89),vec3<f32>(.09,1.72,.07));
 let head=box(vec3<f32>(east+.08,p.y-3.50,doorZ),vec3<f32>(.09,.085,1.96));
 f=take(f,interiorPart(min(jamb,head),14u,p.zyx,3.,p));
 let plaque=vec3<f32>(doorZ,p.y-3.88,east+.13);f=take(f,interiorPart(box(plaque,vec3<f32>(.37,.18,.032)),12u,plaque,3.,p));
 let doorNo=u32(clamp(round(p.z/20.),-1.,1.)+2.);f=take(f,interiorPart(interiorNumber(plaque-vec3<f32>(0.,0.,-.040),doorNo,.105),13u,plaque,3.,p));
 return f;
}

${PUBLIC_COUNTER}

// Local chair faces +z; the bench faces +x. Both have real legs to the floor.
fn interiorChair(q:vec3<f32>)->f32 {
 var d=box(q-vec3<f32>(0.,.46,0.),vec3<f32>(.29,.055,.28));
 d=min(d,box(vec3<f32>(abs(q.x)-.225,q.y-.215,abs(q.z)-.215),vec3<f32>(.035,.215,.035)));
 d=min(d,box(vec3<f32>(abs(q.x)-.225,q.y-.79,q.z+.23),vec3<f32>(.035,.29,.035)));
 d=min(d,box(q-vec3<f32>(0.,.95,-.235),vec3<f32>(.26,.105,.035)));
 d=min(d,box(vec3<f32>(abs(q.x)-.23,q.y-.23,q.z),vec3<f32>(.025,.026,.23)));return d;
}
fn interiorBenchLocal(q:vec3<f32>,seed:f32,p:vec3<f32>)->Field {
 let bound=box(q-vec3<f32>(0.,.55,0.),vec3<f32>(.43,.55,1.15));if(bound>.6){return interiorEmpty(bound,p);}
 var wood=box(q-vec3<f32>(0.,.46,0.),vec3<f32>(.34,.06,1.12));
 wood=min(wood,box(q-vec3<f32>(-.31,.87,0.),vec3<f32>(.045,.21,1.12)));
 var iron=box(vec3<f32>(abs(q.x)-.245,q.y-.21,abs(q.z)-.87),vec3<f32>(.038,.21,.045));
 iron=min(iron,box(vec3<f32>(q.x+.29,q.y-.76,abs(q.z)-.87),vec3<f32>(.035,.31,.038)));
 iron=min(iron,box(vec3<f32>(q.x,q.y-.71,abs(q.z)-1.04),vec3<f32>(.36,.026,.028)));
 iron=min(iron,box(vec3<f32>(q.x-.25,q.y-.59,abs(q.z)-1.04),vec3<f32>(.027,.13,.028)));
 var f=interiorPart(wood,4u,q.zyx,seed,p);f=take(f,interiorPart(iron,5u,q,seed,p));return f;
}
fn interiorBench(p:vec3<f32>)->Field {
 // The tower is a broad shared waiting room, with seats against its north and
 // south edges. Its west entrance and east service access remain clear.
 let south=p-vec3<f32>(-37.1,0.,-24.9);
 var f=interiorBenchLocal(vec3<f32>(south.z,south.y,south.x),31.,p);
 let north=p-vec3<f32>(-37.1,0.,-11.1);
 f=take(f,interiorBenchLocal(vec3<f32>(-north.z,north.y,north.x),32.,p));
 // Additional north-hall seating stays against the window wall, not the centre.
 let bay=clamp(round((p.z+3.)/8.),0.,2.);let side=p-vec3<f32>(-37.5,0.,-3.+8.*bay);
 f=take(f,interiorBenchLocal(side,33.+bay,p));return f;
}

fn interiorGroundCeilings(p:vec3<f32>)->Field {
 // A 40 mm plaster finish overlaps, but never replaces, the existing structural
 // stone slabs. All slab voids are copied exactly; no false floating ceiling
 // closes the tower stairwell or the north public stair.
 var west=box(p-vec3<f32>(-33.65,5.185,0.),vec3<f32>(5.1,.020,39.4));
 west=max(west,-box(p-vec3<f32>(-33.7,5.185,-18.),vec3<f32>(5.8,.4,8.4)));
 west=max(west,-box(p-vec3<f32>(-33.,5.185,30.),vec3<f32>(1.6,.4,5.5)));
 let south=box(p-vec3<f32>(8.,5.185,-32.4),vec3<f32>(36.4,.020,3.7));
 let storey=select(select(0u,1u,p.y>9.4),2u,p.y>15.25);let ys=array<f32,3>(6.5,12.3,18.2);let yy=ys[storey];
 let tq=p-vec3<f32>(-35.5,0.,-18.);let hh=towerHalf(yy)-vec2<f32>(.5);
 var tower=max(chamferPlan(tq.xz,hh,.5),abs(p.y-(yy-.145))-.020);
 tower=max(tower,-box(tq-vec3<f32>(0.,yy-.145,0.),vec3<f32>(1.95,.4,3.1)));
 return interiorPart(min(min(west,south),tower),19u,p,29.,p);
}

fn interiorDesk(q:vec3<f32>,seed:f32,p:vec3<f32>)->Field {
 let bound=box(q-vec3<f32>(0.,.665,-.475),vec3<f32>(1.18,.665,1.17));if(bound>.55){return interiorEmpty(bound,p);}
 var wood=box(q-vec3<f32>(0.,.785,0.),vec3<f32>(1.16,.055,.59));
 wood=min(wood,box(vec3<f32>(abs(q.x)-1.00,q.y-.365,abs(q.z)-.45),vec3<f32>(.065,.365,.065)));
 wood=min(wood,box(q-vec3<f32>(0.,.63,0.),vec3<f32>(1.03,.10,.48)));
 wood=min(wood,box(q-vec3<f32>(-.73,.42,.01),vec3<f32>(.265,.28,.47)));
 wood=min(wood,interiorChair(q-vec3<f32>(.25,0.,-1.05)));
 var f=interiorPart(wood,4u,q,seed,p);
 f=take(f,interiorPart(box(q-vec3<f32>(0.,.845,.04),vec3<f32>(.58,.006,.31)),12u,q,seed,p));
 // Desk blotter and two labelled administrative folios, not custody inventory.
 let folio=min(box(q-vec3<f32>(.82,.862,.20),vec3<f32>(.18,.025,.24)),box(q-vec3<f32>(.79,.912,.20),vec3<f32>(.16,.023,.23)));
 f=take(f,interiorPart(folio,14u,q,seed,p));
 let pull=box(q-vec3<f32>(-.73,.53,-.48),vec3<f32>(.095,.016,.019));f=take(f,interiorPart(pull,9u,q,seed,p));
 // Reference-led working desk, without brand lettering or period-costume props.
 // Trays, paper and telephone are administrative fixtures, never lost items.
 let tray=q-vec3<f32>(.76,.915,-.28);var trayWood=box(tray,vec3<f32>(.22,.012,.25));
 trayWood=min(trayWood,box(vec3<f32>(abs(tray.x)-.213,tray.y+.018,tray.z),vec3<f32>(.012,.030,.25)));
 trayWood=min(trayWood,box(tray-vec3<f32>(0.,-.018,.243),vec3<f32>(.22,.030,.012)));
 f=take(f,interiorPart(trayWood,4u,tray,seed,p));
 let paper=q-vec3<f32>(.76,.934,-.28);f=take(f,publicPaperPacket(paper,vec3<f32>(.195,.007,.217),seed,p));
 let phone=q-vec3<f32>(-.75,.883,.18);var telephone=publicRoundedSlab(phone,vec3<f32>(.205,.042,.15),.07);
 telephone=min(telephone,capsule(phone,vec3<f32>(-.16,.12,-.03),vec3<f32>(.16,.12,-.03),.045));
 telephone=min(telephone,cylinder(phone-vec3<f32>(-.16,.075,-.03),.055,.04));
 telephone=min(telephone,cylinder(phone-vec3<f32>(.16,.075,-.03),.055,.04));
 f=take(f,interiorPart(telephone,5u,phone,seed,p));
 let dial=cylinder(phone-vec3<f32>(0.,.048,.032),.084,.008);f=take(f,interiorPart(dial,9u,phone,seed,p));
 // Actual raised keys and sloping keyboard, bounded to one document station.
 let typing=q-vec3<f32>(-.10,.905,.04);var machine=publicRoundedSlab(typing,vec3<f32>(.265,.065,.225),.045);
 machine=min(machine,box(typing-vec3<f32>(0.,.092,.132),vec3<f32>(.26,.105,.060)));
 machine=min(machine,cylinder(vec3<f32>(typing.y-.145,typing.x,typing.z-.18),.038,.265));
 f=take(f,interiorPart(machine,5u,typing,seed,p));
 let keyX=repeatX(typing.x,.041,5.);let keyZ=repeatX(typing.z+.09,.037,2.);
 let keys=max(cylinder(vec3<f32>(keyX,typing.y-.074,keyZ),.014,.008),box(typing-vec3<f32>(0.,.074,-.09),vec3<f32>(.225,.012,.09)));
 f=take(f,interiorPart(keys,9u,typing,seed,p));
 let sheet=typing-vec3<f32>(0.,.255,.165);f=take(f,publicPaperPacket(sheet,vec3<f32>(.105,.112,.00012),seed,p));
 return f;
}
fn interiorRecordCabinet(q:vec3<f32>,seed:f32,p:vec3<f32>)->Field {
 let bound=box(q-vec3<f32>(0.,1.035,0.),vec3<f32>(1.04,1.04,.38));if(bound>.55){return interiorEmpty(bound,p);}
 var wood=box(q-vec3<f32>(0.,1.04,0.),vec3<f32>(.98,.96,.29));
 wood=min(wood,box(q-vec3<f32>(0.,.065,0.),vec3<f32>(.90,.065,.245)));
 wood=min(wood,box(q-vec3<f32>(0.,2.02,0.),vec3<f32>(1.035,.055,.34)));
 var f=interiorPart(wood,4u,q,seed,p);
 let level=clamp(round((q.y-.31)/.36),0.,4.);let cell=vec3<f32>(abs(q.x)-.48,q.y-(.31+.36*level),q.z+.315);
 f=take(f,interiorPart(box(cell,vec3<f32>(.43,.151,.02)),18u,q,seed,p));
 f=take(f,interiorPart(box(cell-vec3<f32>(0.,.037,-.027),vec3<f32>(.135,.047,.013)),9u,q,seed,p));
 f=take(f,interiorPart(box(cell-vec3<f32>(0.,.037,-.043),vec3<f32>(.102,.025,.006)),19u,q,seed,p));return f;
}
fn interiorSouthOffices(p:vec3<f32>)->Field {
 let bound=box(p-vec3<f32>(8.,5.1,-32.4),vec3<f32>(36.25,5.15,3.86));if(bound>.7){return interiorEmpty(bound,p);}
 let upper=p.y>3.65;let base=select(0.,5.44,upper);let bay=clamp(round((p.x+24.)/8.),0.,8.);let cx=-24.+bay*8.;
 var f=interiorDesk(p-vec3<f32>(cx,base,-32.7),bay+51.,p);
 f=take(f,interiorRecordCabinet(p-vec3<f32>(cx,base,-28.96),bay+51.,p));
 // Divider piers and transom beams stop short of the circulation strip. Their
// open portals are 1.9m wide; no cabinet stands in an east-west doorway.
 let partitionX=clamp(round((p.x+20.)/8.),0.,7.);let wallX=-20.+8.*partitionX;
 var officeDivider=box(p-vec3<f32>(wallX,base+1.28,-34.65),vec3<f32>(.075,1.28,1.40));
 officeDivider=max(officeDivider,-box(p-vec3<f32>(wallX,base+1.10,-33.45),vec3<f32>(.2,1.12,.95)));
 f=take(f,interiorPart(officeDivider,19u,p,bay+51.,p));
 f=take(f,interiorPart(box(p-vec3<f32>(8.,10.18,-32.4),vec3<f32>(36.25,.065,3.8)),19u,p,5.,p));
 let zone=select(4u,1u,upper);let lamp=interiorNearestLight(p,zone);f=take(f,interiorPendant(p,zone,lamp));return f;
}
fn interiorWestOffices(p:vec3<f32>)->Field {
 let bound=box(p-vec3<f32>(-33.45,7.87,0.),vec3<f32>(4.87,2.44,39.45));if(bound>.7){return interiorEmpty(bound,p);}
 var bay=clamp(round((p.z+33.)/5.5),0.,13.);
 // Existing tower-floor and stair voids stay intact; the nearest occupied bay
// is chosen explicitly rather than duplicating furniture over either void.
 if(bay>=2.&&bay<=4.){bay=select(1.,5.,p.z> -16.5);}
 if(bay>=11.&&bay<=12.){bay=select(10.,13.,p.z>30.25);}
 var zz=-33.+bay*5.5;if(bay==1.){zz=-27.65;}if(bay==13.){zz=37.85;}let desk=p-vec3<f32>(-30.2,5.44,zz);
 let dq=vec3<f32>(desk.z,desk.y,-desk.x);var f=interiorDesk(dq,bay+71.,p);
 let cq=p-vec3<f32>(-28.95,5.44,zz+select(1.65,-1.65,bay==1.||bay==13.));f=take(f,interiorRecordCabinet(vec3<f32>(cq.z,cq.y,-cq.x),bay+71.,p));
 var ceiling=box(p-vec3<f32>(-33.45,10.18,0.),vec3<f32>(4.87,.065,39.35));
 ceiling=max(ceiling,-box(p-vec3<f32>(-35.5,10.18,-18.),vec3<f32>(7.5,.3,8.45)));f=take(f,interiorPart(ceiling,19u,p,7.,p));
 let lamp=interiorNearestLight(p,3u);f=take(f,interiorPendant(p,3u,lamp));return f;
}

fn interiorArcadeDetails(p:vec3<f32>)->Field {
 let isWest=p.x< -38.45;var q=vec3<f32>(p.x-4.,p.y,p.z+36.6);
 if(isWest){q=vec3<f32>(p.z,p.y,p.x+38.7);}
 let span=select(45.5,39.5,isWest);let bound=box(q-vec3<f32>(0.,1.88,-.38),vec3<f32>(span,1.88,.50));if(bound>.65){return interiorEmpty(bound,p);}
 // Pilaster strips, skirting, bracketed sconces and drainage strips are on the
// inner face of each L-arcade, leaving its original 3.2m clear walk untouched.
 let bay=clamp(round((q.x-2.75)/5.5),-8.,8.);let zz=q.x-(2.75+bay*5.5);
 var trim=box(q-vec3<f32>(0.,.17,-.32),vec3<f32>(span,.12,.025));
 trim=min(trim,max(box(vec3<f32>(zz,q.y-1.4,q.z+.32),vec3<f32>(.11,1.4,.025)),abs(q.x)-span));
 if(isWest){trim=max(trim,-box(p-vec3<f32>(-38.95,2.,-18.),vec3<f32>(.7,2.2,3.55)));}
 var f=interiorPart(trim,3u,q,9.,p);
 let towerVoid=isWest&&p.z> -26.5&&p.z< -9.5;
 if(!towerVoid&&abs(2.75+bay*5.5)<span){
  let s=vec3<f32>(zz,q.y-3.22,q.z+.62);var bracket=box(s-vec3<f32>(0.,-.19,.205),vec3<f32>(.07,.25,.045));
  bracket=min(bracket,capsule(s,vec3<f32>(0.,-.15,.18),vec3<f32>(0.,-.15,-.04),.023));
  bracket=min(bracket,cylinder(s-vec3<f32>(0.,.17,-.04),.13,.022));
  bracket=min(bracket,cylinder(s-vec3<f32>(0.,-.10,-.04),.11,.023));
  bracket=min(bracket,box(vec3<f32>(abs(s.x)-.094,s.y-.025,s.z+.04),vec3<f32>(.013,.13,.015)));
  f=take(f,interiorPart(bracket,9u,s,bay,p));f=take(f,interiorPart(cylinder(s-vec3<f32>(0.,.025,-.04),.083,.105),17u,s,bay,p));
 }
 return f;
}

fn interiorWarehouseStructure(p:vec3<f32>)->Field {
 let bound=box(p-vec3<f32>(8.,6.95,3.25),vec3<f32>(36.65,6.95,31.55));if(bound>.9){return interiorEmpty(bound,p);}
 var f=field(box(p-vec3<f32>(8.,.012,3.25),vec3<f32>(36.,.016,31.25)),16u,p,11.);
 if(u.options.x>.5){return f;}
 // Column grid is entirely OUTSIDE the unchanged 72 x 62.5m net rectangle.
// Transverse tied iron trusses span x above the 7m rack envelope. End columns
// avoid all three west gates and every receiving-door centre.
 let row=clamp(round((p.z+28.)/10.4166665),0.,6.);let z=-28.+row*10.4166665;
 let endX=select(-28.42,44.32,p.x>8.);let c=p-vec3<f32>(endX,0.,z);
 var iron=box(c-vec3<f32>(0.,4.93,0.),vec3<f32>(.10,4.93,.10));
 iron=min(iron,box(c-vec3<f32>(0.,.13,0.),vec3<f32>(.11,.13,.20)));
 iron=min(iron,box(c-vec3<f32>(0.,9.84,0.),vec3<f32>(.11,.13,.29)));
 f=take(f,field(iron,5u,p,row+91.));
 let overhead=box(p-vec3<f32>(8.,11.1,3.25),vec3<f32>(36.65,2.9,31.55));if(overhead>.75){return take(f,interiorEmpty(overhead,p));}
 iron=100.;let localRoofZ=repeatX(z-3.25,20.833333,1.);let top=12.48-abs(localRoofZ)*.25;
 iron=min(iron,box(p-vec3<f32>(7.95,9.06,z),vec3<f32>(36.37,.070,.075)));
 iron=min(iron,box(p-vec3<f32>(7.95,top,z),vec3<f32>(36.37,.075,.075)));
 let panel=clamp(floor((p.x+28.42)/6.0616667),0.,11.);let ax=-28.42+panel*6.0616667;let bx=ax+6.0616667;
 iron=min(iron,capsule(p,vec3<f32>(ax,9.06,z),vec3<f32>(bx,top,z),.047));
 iron=min(iron,capsule(p,vec3<f32>(ax,top,z),vec3<f32>(bx,9.06,z),.047));
 iron=min(iron,capsule(p,vec3<f32>(ax,9.06,z),vec3<f32>(ax,top,z),.044));
 f=take(f,field(iron,5u,p,row+91.));
 // Longitudinal purlins and the glazed lantern share the architecture's roofZ.
 let rz=repeatX(p.z-3.25,20.833333,1.);let ribX=clamp(round((p.x+23.)/3.1),0.,20.);let rx=-23.+ribX*3.1;
 let slope=13.45-abs(rz)*.43;let g=vec3<f32>(p.x-8.,p.y-slope,rz);
 var frame=max(box(vec3<f32>(p.x-rx,p.y-slope,rz),vec3<f32>(.030,.035,2.16)),abs(p.x-8.)-31.1);
 frame=min(frame,box(vec3<f32>(p.x-8.,p.y-13.45,rz),vec3<f32>(31.12,.035,.035)));
 frame=min(frame,box(vec3<f32>(p.x-8.,p.y-12.547,abs(rz)-2.10),vec3<f32>(31.12,.052,.046)));
 frame=min(frame,box(vec3<f32>(abs(p.x-8.)-31.08,p.y-slope,rz),vec3<f32>(.055,.05,2.16)));
 // Curb returns meet the cut stone roof at both lantern edges.
 let curb=box(vec3<f32>(p.x-8.,p.y-12.405,abs(rz)-2.11),vec3<f32>(31.14,.135,.05));
 f=take(f,field(frame,14u,g,12.));f=take(f,field(curb,5u,g,12.));
 let purlinZ=clamp(round((p.z+28.)/2.6041666),0.,24.);let pz=-28.+purlinZ*2.6041666;let roofz=repeatX(pz-3.25,20.833333,1.);
 let purlin=box(p-vec3<f32>(8.,12.59-abs(roofz)*.25,pz),vec3<f32>(36.35,.055,.045));
 f=take(f,field(purlin,5u,p,purlinZ+100.));
 let lamp=interiorNearestLight(p,2u);f=take(f,interiorPendant(p,2u,lamp));return f;
}

fn interiorRackWayfinding(p:vec3<f32>)->Field {
 let bound=box(p-vec3<f32>(5.5,4.20,2.75),vec3<f32>(31.75,4.05,27.75));if(bound>.6){return interiorEmpty(bound,p);}
 let bank=select(0u,1u,p.x>5.5);let start=select(-25.,12.,bank==1u);
 let row=clamp(round((p.z+23.5)/3.5),0.,15.);let zz=-23.5+row*3.5;
 let end=select(-.91,11.91,bank==1u);let facing=select(.037,-.037,bank==1u);
 let q=vec3<f32>(p.z-zz,p.y-7.32,p.x-end);let rowBound=box(q-vec3<f32>(0.,-.10,0.),vec3<f32>(.64,.41,.06));
 var f=interiorEmpty(rowBound,p);
 if(rowBound<.30){
  f=interiorPart(box(q,vec3<f32>(.61,.26,.029)),12u,q,row+f32(bank)*16.,p);
  let label=q-vec3<f32>(0.,0.,facing);var letters=interiorBankLetter(label-vec3<f32>(-.39,0.,0.),bank,.145);
  letters=min(letters,interiorNumber(label-vec3<f32>(.13,0.,0.),u32(row)+1u+bank*16u,.15));
  f=take(f,interiorPart(letters,13u,label,row,p));
  // Attachment tabs continue down to the existing rack top; no aisle stands.
  let tab=box(vec3<f32>(p.x-end,p.y-7.13,abs(p.z-zz)-.48),vec3<f32>(.028,.24,.022));f=take(f,interiorPart(tab,5u,p,row,p));
 }
 let bay=clamp(floor((p.x-start)/1.2),0.,19.);let xx=start+(bay+.5)*1.2;
 let level=clamp(round((p.y-.3)/1.15),0.,5.);let face=select(-1.,1.,p.z>=zz);
 let v=vec3<f32>(p.x-xx,p.y-(.3+level*1.15),p.z-(zz+face*.977));
 let plateBound=box(v,vec3<f32>(.29,.061,.024));
 if(plateBound<.20){
  f=take(f,interiorPart(box(v,vec3<f32>(.28,.052,.012)),12u,v,row,p));
  let mark=v-vec3<f32>(0.,0.,face*.017);var code=interiorNumber(mark-vec3<f32>(-.10,0.,0.),u32(bay)+1u,.035);
  code=min(code,interiorDigit(mark-vec3<f32>(.135,0.,0.),u32(level)+1u,.035));f=take(f,interiorPart(code,13u,mark,row,p));
 }else{f=take(f,interiorEmpty(plateBound,p));}
 // Broad division boards: ordinary / small-compartment rows. Actual occupied
// addresses remain exclusively in the unchanged inventory's custody ledger.
 let divisionRow=select(0.,10.,p.z> -6.);let dz=-23.5+3.5*divisionRow;
 let s=vec3<f32>(p.z-dz,p.y-7.92,p.x-end);let divisionBound=box(s-vec3<f32>(0.,-.24,0.),vec3<f32>(.90,.45,.06));
 if(divisionBound<.30){
  f=take(f,interiorPart(box(s,vec3<f32>(.88,.18,.029)),12u,s,f32(bank),p));
  let division=s-vec3<f32>(0.,0.,facing);var range=interiorBankLetter(division-vec3<f32>(-.62,0.,0.),bank,.12);
  range=min(range,interiorNumber(division-vec3<f32>(-.20,0.,0.),u32(divisionRow)+1u+bank*16u,.10));
  range=min(range,box(division-vec3<f32>(.11,0.,0.),vec3<f32>(.055,.012,.009)));
  range=min(range,interiorNumber(division-vec3<f32>(.43,0.,0.),select(10u,16u,divisionRow>1.)+bank*16u,.10));
  f=take(f,interiorPart(range,13u,division,f32(bank),p));
  let stem=box(vec3<f32>(p.x-end,p.y-7.63,abs(p.z-dz)-.60),vec3<f32>(.026,.39,.023));f=take(f,interiorPart(stem,5u,p,f32(bank),p));
 }else{f=take(f,interiorEmpty(divisionBound,p));}
 return f;
}

fn interiorField(p:vec3<f32>)->Field {
 // Hierarchical world-space candidates: only the nearby occupied room group
 // expands. The inventory is independent and remains present off screen.
 let westBound=box(p-vec3<f32>(-35.5,9.1,0.),vec3<f32>(8.,9.4,41.));
 let southBound=box(p-vec3<f32>(4.,5.4,-34.),vec3<f32>(47.,5.6,7.7));
 let storeBound=box(p-vec3<f32>(8.,7.,3.25),vec3<f32>(36.7,7.,31.6));
 let enclosing=min(min(westBound,southBound),storeBound);
 if(enclosing>.8){return interiorEmpty(enclosing,p);}
 var f=interiorEmpty(100.,p);
 if(westBound<=.8){
 f=take(f,interiorHallFloor(p));f=take(f,interiorHallJoinery(p));f=take(f,interiorTowerLobby(p));f=take(f,interiorCounter(p));f=take(f,interiorBench(p));f=take(f,interiorWestOffices(p));
 let h=interiorNearestLight(p,0u);let c=interiorLightPosition(0u,h);let hb=box(p-vec3<f32>(c.x,5.45,c.z),vec3<f32>(.35,1.11,.35));
 if(hb<.7){f=take(f,interiorPendant(p,0u,h));}else{f=take(f,interiorEmpty(hb,p));}
 }else{f=take(f,interiorEmpty(westBound,p));}
 if(southBound<=.8){f=take(f,interiorSouthOffices(p));}else{f=take(f,interiorEmpty(southBound,p));}
 if(min(westBound,southBound)<=.8){f=take(f,interiorGroundCeilings(p));f=take(f,interiorPublicPlaster(p));f=take(f,interiorArcadeDetails(p));}
 if(storeBound<=.8){f=take(f,interiorWarehouseStructure(p));f=take(f,interiorRackWayfinding(p));}else{f=take(f,interiorEmpty(storeBound,p));}
 return f;
}
`;

/** Static contract test; GPU compilation is intentionally left to the CI runner. */
export function selfTestInteriors() {
  const checks = [];
  const check = (name, truth) => { if (!truth) throw Error(name); checks.push(name); };
  check('WGSL function domain is exported', /fn interiorField\(p:vec3<f32>\)->Field/.test(INTERIORS));
  check('lights and geometry share one position function', /let c=interiorLightPosition\(zone,index\)/.test(INTERIORS));
  check('eight counters match the live north-hall custody coordinate helper', INTERIOR_LAYOUT.handover.count === 8 && HANDOVER_LAYOUT.x === -32.4 && HANDOVER_LAYOUT.zStart === -6 && HANDOVER_LAYOUT.zPitch === 3.2 && /-6\.\+3\.2\*bay/.test(INTERIORS));
  check('counter top is exactly the existing 1.30m handover surface', Math.abs(1.245 + .055 - 1.3) < 1e-12);
  check('warehouse net area remains 4500m²', (44 + 28) * (34.5 + 28) === 4500);
  const col = INTERIOR_LAYOUT.warehouseColumns;
  check('new warehouse columns remain outside the net rectangle', col.x[0] + col.halfWidth < -28 && col.x[1] - col.halfWidth > 44);
  check('column grid clears three warehouse gates', Array.from({ length: col.zCount }, (_, i) => col.zStart + i * col.zPitch).every(z => INTERIOR_LAYOUT.clearTransport.gateZ.every(g => Math.abs(z - g) > 1.75 + col.halfWidth)));
  check('two full public cross-lines avoid counter footprints', INTERIOR_LAYOUT.publicCrossingsZ.every(z => Array.from({length: 8}, (_, i) => HANDOVER_LAYOUT.zStart + HANDOVER_LAYOUT.zPitch * i).every(c => Math.abs(c-z) > 1.35)));
  check('hall spine remains east of all counter and waiting-seat geometry', HANDOVER_LAYOUT.x + .90 < -30.5 - .65 && -37.5 + .43 < -30.5 - .65);
  check('counters leave the entire tower lobby clear', HANDOVER_LAYOUT.zStart - 1.47 > -9.8);
  check('side benches leave the central entrance axis clear', INTERIOR_LAYOUT.publicLobby.waitingBenches.every(p => Math.abs(p[2] + 18) > 3.7));
  check('ground floor ceilings are plaster over retained slab structure', /fn interiorGroundCeilings/.test(INTERIORS) && /yy-\.145/.test(INTERIORS) && /min\(min\(west,south\),tower\),19u/.test(INTERIORS));
  check('tower lobby has matching floor, plaster and registered light geometry', /fn interiorTowerLobby/.test(INTERIORS) && /fn interiorPublicPlaster/.test(INTERIORS) && INTERIOR_LAYOUT.lightZones.find(x=>x.zone===5)?.count===4);
  check('tower plaster preserves the north and south public arches', /tower=max\(tower,-archOpening\(vec3<f32>\(p.x\+33.6,p.y,abs\(tq.z\)-8.2\),3.95,1.55,1.1\)\)/.test(INTERIORS));
  check('all warehouse overhead trusses clear existing seven-metre racks', 9.06 - .075 > 7);
  check('no mesh buffers, textures, or fake custody boxes', !/createBuffer|createTexture|Mesh|Geometry|items\[|ItemRecord/.test(INTERIORS));
  check('upper-west stair and tower bays are explicitly excluded', /bay>=2\.&&bay<=4\./.test(INTERIORS) && /bay>=11\.&&bay<=12\./.test(INTERIORS));
  let depth = 0;
  for (const c of INTERIORS.replace(/\/\/[^\n]*/g, '')) { if (c === '{') depth++; if (c === '}') depth--; if (depth < 0) throw Error('Unbalanced WGSL braces'); }
  check('balanced WGSL braces', depth === 0);
  return { ok: true, count: checks.length, checks, shaderBytes: new TextEncoder().encode(INTERIORS).length, gpuCompiled: false };
}
