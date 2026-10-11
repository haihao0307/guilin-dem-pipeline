import { WINDOWS, ENTRY_JOINERY } from './windows.mjs';
import { INTERIORS } from './interiors.mjs';
/** R03b: 4,500 m² clear warehouse, actual quarter-turn racks and west entry. */
export const SCENE=Object.freeze({version:'bureau-r03e-arcaded-tower-01',units:'metres',building:[92,80],oldBuilding:[44,38],previousBuilding:[72,64],clearWarehouse:{min:[-28,-28],max:[44,34.5],size:[72,62.5],area:4500},hall:{side:'west x-negative',depth:14},office:{side:'south z-negative',depth:12},receiving:{min:[-28,34.5],max:[44,40]},arcade:{clearWidth:3.2,axisDepth:3.9,sides:['west','south']},tower:{storeys:4,roofHeight:28,halfWidthsXZ:[[7.1,8.2],[6.35,7.1],[5.05,5.4],[3.8,3.8]],transitionsY:[[7.2,8.4],[12.3,13.7],[18.2,19.4]]},chimney:{height:31,baseRadius:2.45,topRadius:1.18,basePlinthRadius:3.0},banks:2,rowsPerBank:16,bays:20,levels:6,regularSlots:4800,smallSlots:17280,capacityIs:'mixed-size addresses, not actual inventory',fiction:true});
export const DOMAIN=String.raw`
struct Field { d:f32, mat:u32, local:vec3<f32>, seed:f32, age:f32, wet:f32 };
fn box(p:vec3<f32>,b:vec3<f32>)->f32 {let q=abs(p)-b;return length(max(q,vec3<f32>(0.)))+min(max(q.x,max(q.y,q.z)),0.);}
fn cylinder(p:vec3<f32>,r:f32,h:f32)->f32 {let q=vec2<f32>(length(p.xz)-r,abs(p.y)-h);return min(max(q.x,q.y),0.)+length(max(q,vec2<f32>(0.)));}
fn capsule(p:vec3<f32>,a:vec3<f32>,b:vec3<f32>,r:f32)->f32 {let q=p-a;let v=b-a;return length(q-v*clamp(dot(q,v)/dot(v,v),0.,1.))-r;}
fn shell(d:f32,p:vec3<f32>)->f32 {if(u.options.x>.5){return max(d,p.y-1.1);}return d;}
fn field(d:f32,mat:u32,p:vec3<f32>,seed:f32)->Field {
 let outside=select(0.,1.,p.x< -42.9||p.x>49.8||p.z< -40.8||p.z>40.||p.y>11.7);
 let runoff=1.-smoothstep(.04,.28,abs(fract((p.x+p.z*.13)/5.5)-.06)*5.5);
 let splash=(1.-smoothstep(.05,1.1,p.y))*.38;
 let wet=clamp(.025+outside*(.08+runoff*.34+splash),0.,.85);
 return Field(d,mat,p,seed,u.options.y,wet);
}
fn receiverPlasterParams()->KpPlasterParams {return KpPlasterParams(vec2<f32>(0.,5.),vec2<f32>(36.,5.),.0165,.0085,0.,.008,.025,.0002,vec3<f32>(.43,.425,.395),vec3<f32>(.64,.625,.57),.0008,.000008,.018);}
fn plasterCoordinates(p:vec3<f32>)->vec3<f32> {return select(p,p.zyx,p.x< -27.8&&p.z> -28.8);}
fn take(a:Field,b:Field)->Field {if(b.d<a.d){return b;}return a;}
fn repeatX(x:f32,pitch:f32,limit:f32)->f32 {return x-clamp(round(x/pitch),-limit,limit)*pitch;}
fn glyph(code:u32)->u32 {switch(code){
case 65u:{return 18415150u;}
case 66u:{return 16301615u;}
case 68u:{return 16303663u;}
case 69u:{return 32554047u;}
case 70u:{return 1096767u;}
case 71u:{return 32044094u;}
case 72u:{return 18415153u;}
case 73u:{return 32641183u;}
case 75u:{return 18128177u;}
case 76u:{return 32539681u;}
case 78u:{return 18667121u;}
case 79u:{return 15255086u;}
case 82u:{return 18136623u;}
case 83u:{return 16267326u;}
case 84u:{return 4329631u;}
case 85u:{return 15255089u;}
case 67u:{return 31491134u;}
case 38u:{return 23894310u;}
case 49u:{return 14815428u;}
case 57u:{return 15235630u;}
case 46u:{return 4194304u;}
default:{return 0u;}}}
fn textRow(p:vec3<f32>,line:u32)->f32 {
let place=array<u32,18>(72u,79u,78u,71u,32u,75u,79u,78u,71u,32u,65u,46u,68u,46u,49u,57u,49u,49u);
let office=array<u32,27>(71u,69u,78u,69u,82u,65u,76u,32u,76u,79u,83u,84u,32u,38u,32u,70u,79u,85u,78u,68u,32u,79u,70u,70u,73u,67u,69u);
let scale=select(.088,.073,line==1u);let count=select(18.,27.,line==1u);let baseline=select(7.00,6.53,line==1u);
let q=vec3<f32>(p.x+count*scale*3.,baseline-p.y,p.z);var d=100.;let cell=i32(floor(q.x/(scale*6.)));
for(var g=-1;g<=1;g++){let index=cell+g;if(index<0||f32(index)>=count){continue;}var code=0u;if(line==0u){code=place[u32(index)];}else{code=office[u32(index)];}let mask=glyph(code);let local=vec2<f32>(q.x-f32(index)*scale*6.,q.y+2.5*scale);let ix=i32(floor(local.x/scale));let iy=i32(floor(local.y/scale));for(var dy=-1;dy<=1;dy++){for(var dx=-1;dx<=1;dx++){let xx=ix+dx;let yy=iy+dy;if(xx<0||xx>4||yy<0||yy>4){continue;}if((mask&(1u<<u32(yy*5+xx)))!=0u){let r=vec3<f32>(local.x-(f32(xx)+.5)*scale,local.y-(f32(yy)+.5)*scale,q.z);d=min(d,box(r,vec3<f32>(scale*.43,scale*.43,.017)));}}}}return d;}
fn entranceText(p:vec3<f32>)->f32 {let bound=box(p-vec3<f32>(0.,6.78,0.),vec3<f32>(6.6,.51,.04));if(bound>.1){return 100.;}return min(textRow(p,0u),textRow(p,1u));}
// Round-headed openings and their stone archivolts share the same field.
fn archOpening(q:vec3<f32>,radius:f32,spring:f32,depth:f32)->f32 {
 let plan=min(max(abs(q.x)-radius,max(-q.y,q.y-spring)),length(vec2<f32>(q.x,q.y-spring))-radius);
 return max(plan,abs(q.z)-depth);
}
${WINDOWS}
${ENTRY_JOINERY}
${INTERIORS}
fn archWindow(q:vec3<f32>,radius:f32,spring:f32,depth:f32)->f32 {return archOpening(q,radius,spring,depth);}
fn arcade(q:vec3<f32>,span:f32)->Field {
 let u0=repeatX(q.x,5.5,20.);let opening=archOpening(vec3<f32>(u0,q.y,q.z),2.14,2.75,1.);
 let wall=max(box(q-vec3<f32>(0.,2.68,0.),vec3<f32>(span,2.68,.32)),-opening);
 let band=max(archOpening(vec3<f32>(u0,q.y,q.z),2.48,2.75,.39),-opening);
 var f=field(shell(max(wall,box(q-vec3<f32>(0.,2.7,0.),vec3<f32>(span,2.7,.4))),q),2u,q,4.);
 f=take(f,field(shell(max(band,box(q-vec3<f32>(0.,2.7,0.),vec3<f32>(span,2.7,.42))),q),3u,q,4.));
 let pier=abs(u0)-2.75;let foot=box(vec3<f32>(pier,q.y-.18,q.z),vec3<f32>(.55,.18,.48));
 let cap=box(vec3<f32>(pier,q.y-2.7,q.z),vec3<f32>(.48,.16,.46));
 f=take(f,field(shell(max(min(foot,cap),box(q-vec3<f32>(0.,2.7,0.),vec3<f32>(span,2.7,.5))),q),3u,q,4.));return f;
}
// Upper and lower loggias share a bay axis and outer bearing line.
fn upperLoggia(q:vec3<f32>,span:f32)->Field {
 let u0=repeatX(q.x,5.5,20.);let opening=archOpening(vec3<f32>(u0,q.y-5.6,q.z),1.92,2.55,1.);
 var wall=max(box(q-vec3<f32>(0.,8.36,0.),vec3<f32>(span,2.84,.34)),-opening);
 let rim=max(archOpening(vec3<f32>(u0,q.y-5.6,q.z),2.14,2.55,.43),-opening);
 var f=field(shell(wall,q),2u,q,6.);f=take(f,field(shell(max(rim,box(q-vec3<f32>(0.,8.36,0.),vec3<f32>(span,2.84,.46))),q),3u,q,6.));
 // Open stone balustrades close the gallery edge, not a bare projecting slab.
 let bx=repeatX(q.x,.55,100.);var bal=cylinder(vec3<f32>(bx,q.y-6.08,q.z+.10),.065,.28);
 bal=min(bal,length(vec3<f32>(bx,q.y-6.1,q.z+.10))-.11);
 bal=min(bal,box(q-vec3<f32>(0.,6.43,-.10),vec3<f32>(span,.095,.25)));
 bal=min(bal,box(q-vec3<f32>(0.,5.75,-.10),vec3<f32>(span,.095,.25)));
 f=take(f,field(shell(max(bal,box(q-vec3<f32>(0.,6.08,0.),vec3<f32>(span,.50,.45))),q),3u,q,6.));
 // Layered bearing cornice with a restrained tooth rhythm.
 let cornice=min(box(q-vec3<f32>(0.,11.18,0.),vec3<f32>(span+.16,.14,.48)),box(q-vec3<f32>(0.,11.48,-.04),vec3<f32>(span+.3,.13,.66)));
 let tooth=max(box(vec3<f32>(repeatX(q.x,.55,100.),q.y-11.30,q.z+.28),vec3<f32>(.13,.13,.29)),box(q-vec3<f32>(0.,11.3,0.),vec3<f32>(span,.3,.8)));
 f=take(f,field(shell(min(cornice,tooth),q),3u,q,6.));return f;
}
fn publicGable(q:vec3<f32>)->Field {
 let tri=max(box(q-vec3<f32>(0.,13.35,0.),vec3<f32>(5.65,2.15,.32)),q.y-(15.6-abs(q.x)*.72));
 let ux=abs(q.x)-.85;let window=archOpening(vec3<f32>(ux,q.y-11.85,q.z),.47,1.15,1.);
 var f=field(shell(max(tri,-window),q),2u,q,12.);
 var rake=capsule(q,vec3<f32>(-5.75,11.47,-.1),vec3<f32>(0.,15.75,-.1),.15);
 rake=min(rake,capsule(q,vec3<f32>(0.,15.75,-.1),vec3<f32>(5.75,11.47,-.1),.15));
 rake=min(rake,box(q-vec3<f32>(0.,11.65,-.05),vec3<f32>(5.9,.12,.43)));
 let frame=max(archOpening(vec3<f32>(ux,q.y-11.85,q.z+.1),.63,1.15,.4),-window);f=take(f,field(shell(min(rake,frame),q),3u,q,12.));
 var gw=sashWindow(vec3<f32>(ux,q.y-11.85,q.z),.47,1.15,12.);gw.d=shell(gw.d,q);f=take(f,gw);
 let finial=min(cylinder(q-vec3<f32>(0.,16.,0.),.11,.25),length(q-vec3<f32>(0.,16.25,0.))-.17);f=take(f,field(shell(finial,q),3u,q,12.));return f;
}
fn towerHalf(y:f32)->vec2<f32> {
 return vec2<f32>(7.1,8.2)-vec2<f32>(.75,1.1)*smoothstep(7.2,8.4,y)-vec2<f32>(1.3,1.7)*smoothstep(12.3,13.7,y)-vec2<f32>(1.25,1.6)*smoothstep(18.2,19.4,y);
}
fn chamferPlan(q:vec2<f32>,h:vec2<f32>,bevel:f32)->f32 {let a=abs(q);return max(max(a.x-h.x,a.y-h.y),(a.x+a.y-h.x-h.y+bevel)*.70710678);}
fn taperedTower(p:vec3<f32>)->Field {
 let tq=p-vec3<f32>(-35.5,0.,-18.);let h=towerHalf(p.y);
 // Continuous curved setbacks, chamfered corners and conservative distance bound.
 let outer=max(chamferPlan(tq.xz,h,.65)/2.3,max(-p.y,p.y-23.8));
 let inner=max(chamferPlan(tq.xz,h-vec2<f32>(.48),.42)/2.3,max(.15-p.y,p.y-24.1));var wall=max(outer,-inner);
 let mainArch=archOpening(vec3<f32>(tq.z,p.y,tq.x+7.10),3.05,3.15,1.1);wall=max(wall,-mainArch);
 wall=max(wall,-box(p-vec3<f32>(-28.4,1.7,-20.),vec3<f32>(1.,1.75,1.75)));
 // Axial public arches join the vestibule to both lengths of the west hall.
 // Preserve the tower corners while releasing the public and custody aisles.
 let hallArch=archOpening(vec3<f32>(p.x+33.6,p.y,abs(tq.z)-8.2),3.95,1.55,1.1);wall=max(wall,-hallArch);
 // The upper office connects by a short stair to the first tower floor.
 let towerBridgePortal=box(p-vec3<f32>(-31.4,7.25,-10.1),vec3<f32>(1.03,1.90,1.65));wall=max(wall,-towerBridgePortal);
 let tier=select(select(0.,1.,p.y>12.5),2.,p.y>18.5);let baseline=select(select(8.45,14.0,tier>.5),19.6,tier>1.5);
 let pitch=select(select(4.25,3.0,tier>.5),2.25,tier>1.5);let radius=select(.95,.72,tier>1.5);
 let u0=repeatX(tq.z,pitch,1.);let v0=repeatX(tq.x,pitch*.8,1.);
 let front=archOpening(vec3<f32>(u0,p.y-baseline,abs(tq.x)-h.x),radius,1.35,1.1);
 let side=archOpening(vec3<f32>(v0,p.y-baseline,abs(tq.z)-h.y),radius,1.35,1.1);
 wall=max(max(wall,-front),-side);var f=field(shell(wall,p),2u,p,7.);
 let hallRing=max(archOpening(vec3<f32>(p.x+33.6,p.y,abs(tq.z)-8.2),4.18,1.55,.58),-hallArch);f=take(f,field(shell(hallRing,p),3u,p,20.));
 var fw=sashWindow(vec3<f32>(u0,p.y-baseline,h.x-abs(tq.x)),radius,1.35,7.);
 var sw=sashWindow(vec3<f32>(v0,p.y-baseline,h.y-abs(tq.z)),radius,1.35,8.);
 fw.d=shell(max(fw.d,box(tq-vec3<f32>(0.,15.5,0.),vec3<f32>(7.4,8.3,8.5))),p);
 sw.d=shell(max(sw.d,box(tq-vec3<f32>(0.,15.5,0.),vec3<f32>(7.4,8.3,8.5))),p);
 fw.d=max(fw.d,-towerBridgePortal);sw.d=max(sw.d,-towerBridgePortal);f=take(f,fw);f=take(f,sw);
 // Continuous stone corner pilasters follow the inward curve rather than standing free.
 let corner=abs(abs(tq.x)+abs(tq.z)-h.x-h.y+.65)*.70710678-.16;
 let cornerBound=max(max(abs(tq.x)-h.x-.05,abs(tq.z)-h.y-.05),max(-p.y,p.y-23.8));
 f=take(f,field(shell(max(corner,cornerBound),p),3u,p,8.));
 for(var n=0;n<4;n++){let ys=array<f32,4>(7.12,12.26,18.16,23.78);let yy=ys[u32(n)];let hh=towerHalf(yy)+vec2<f32>(.32);var course=max(chamferPlan(tq.xz,hh,.7),abs(p.y-yy)-.17);course=max(course,-chamferPlan(tq.xz,hh-vec2<f32>(.58),.5));course=max(course,-towerBridgePortal);f=take(f,field(shell(course,p),3u,p,8.));}
 let portalRing=max(archOpening(vec3<f32>(tq.z,p.y,tq.x+7.22),3.55,3.15,.28),-mainArch);f=take(f,field(shell(portalRing,p),3u,p,8.));
 // Eight real treads bridge office floor 5.44m to tower finished floor 6.63m.
 let bridgeStep=clamp(floor((-p.z-8.8)/.30),0.,7.);let bridgeTop=5.44+(bridgeStep+1.)*.14875;
 let bridge=box(p-vec3<f32>(-31.4,bridgeTop-.074375,-8.8-(bridgeStep+.5)*.30),vec3<f32>(.92,.074375,.15));
 f=take(f,field(shell(bridge,p),4u,p,21.));
 f=take(f,field(shell(box(p-vec3<f32>(-31.4,6.55,-11.62),vec3<f32>(.92,.08,.45)),p),3u,p,21.));
 // Floor plates and two dogleg flights link the occupied upper tower levels.
 for(var n=0;n<3;n++){let ys=array<f32,3>(6.5,12.3,18.2);let yy=ys[u32(n)];let hh=towerHalf(yy)-vec2<f32>(.5);var slab=max(chamferPlan(tq.xz,hh,.5),abs(p.y-yy)-.13);slab=max(slab,-box(tq-vec3<f32>(0.,yy,0.),vec3<f32>(1.95,.4,3.1)));f=take(f,field(shell(slab,p),3u,p,7.));}
 for(var n=0;n<2;n++){let y0=select(6.5,12.3,n==1);let rise=select(5.8,5.9,n==1);let back=p.y>y0+rise*.5;let zz=select(tq.z,-tq.z,back);let step=clamp(floor((zz+2.4)/.3),0.,15.);let yy=y0+select(0.,rise*.5,back)+(step+1.)*rise/32.;let xx=select(-1.05,1.05,back);let tread=box(vec3<f32>(tq.x-xx,p.y-yy+.075,zz-(-2.4+(step+.5)*.3)),vec3<f32>(.68,.075,.15));f=take(f,field(shell(tread,p),3u,p,7.));f=take(f,field(shell(box(tq-vec3<f32>(0.,y0+rise*.5,2.65),vec3<f32>(1.75,.1,.4)),p),3u,p,7.));}
 if(u.options.x<.5){let hip=max(abs(p.y-(27.5-max(abs(tq.x),abs(tq.z))*.85))-.16,box(tq-vec3<f32>(0.,25.5,0.),vec3<f32>(4.35,2.5,4.35)));f=take(f,field(hip,7u,p,7.));
 let finial=min(cylinder(tq-vec3<f32>(0.,27.7,0.),.08,.3),length(tq-vec3<f32>(0.,28.,0.))-.14);f=take(f,field(finial,3u,p,7.));
 f=take(f,field(box(p-vec3<f32>(-42.93,6.78,-18.),vec3<f32>(.12,.50,6.5)),12u,p,1.));f=take(f,field(entranceText(vec3<f32>(p.z+18.,p.y,p.x+43.10)),13u,p,1.));}
 return f;
}
fn taperedChimney(p:vec3<f32>)->Field {
 let q=p-vec3<f32>(61.,0.,55.);let t=clamp((p.y-3.)/27.,0.,1.);let radius=mix(2.45,1.18,t);
 let shaft=max((length(q.xz)-radius)/1.01,max(2.8-p.y,p.y-30.));
 let flue=max(length(q.xz)-max(.74,radius-.48),max(3.2-p.y,p.y-31.4));
 var d=max(shaft,-flue);var f=field(d,2u,p,9.);
 let base=max(cylinder(q-vec3<f32>(0.,1.5,0.),3.,1.5),-cylinder(q-vec3<f32>(0.,2.,0.),1.5,1.6));f=take(f,field(base,2u,p,9.));
 let plinth=max(cylinder(q-vec3<f32>(0.,.28,0.),3.24,.28),-cylinder(q-vec3<f32>(0.,1.,0.),1.5,1.));
 let collar=max(cylinder(q-vec3<f32>(0.,3.,0.),2.7,.18),-cylinder(q-vec3<f32>(0.,3.,0.),1.85,.5));f=take(f,field(min(plinth,collar),3u,p,9.));
 // Slightly corbelled lip is proportionate to the slender throat and remains open.
 let cap=max(cylinder(q-vec3<f32>(0.,30.55,0.),1.39,.45),-cylinder(q-vec3<f32>(0.,30.55,0.),.75,.8));f=take(f,field(cap,2u,p,9.));
 let rim=max(cylinder(q-vec3<f32>(0.,30.96,0.),1.49,.10),-cylinder(q-vec3<f32>(0.,30.96,0.),.75,.3));f=take(f,field(rim,3u,p,9.));return f;
}
fn architecture(p:vec3<f32>)->Field {
 var f=field(box(p-vec3<f32>(4.,-.24,0.),vec3<f32>(46.,.24,40.)),3u,p,1.);
 // Continuous L-shaped, 3.2m clear sheltered walk. The x-negative street is public entry.
 let westQ=vec3<f32>(p.z,p.y,p.x+42.6);let southQ=vec3<f32>(p.x-4.,p.y,p.z+40.5);
 var wa=arcade(westQ,40.7);wa.d=max(wa.d,-box(p-vec3<f32>(-42.6,3.,-18.),vec3<f32>(1.,3.1,4.0)));f=take(f,wa);
 f=take(f,arcade(southQ,46.6));
 f=take(f,field(shell(box(p-vec3<f32>(-40.7,5.42,0.),vec3<f32>(2.35,.18,40.9)),p),3u,p,1.));
 f=take(f,field(shell(box(p-vec3<f32>(4.,5.42,-38.7),vec3<f32>(46.8,.18,2.2)),p),3u,p,2.));
 let upperWest=upperLoggia(westQ,40.7);let towerVoid=box(p-vec3<f32>(-40.5,9.,-18.),vec3<f32>(3.,5.,8.7));var uw=upperWest;uw.d=max(uw.d,-towerVoid);f=take(f,uw);f=take(f,upperLoggia(southQ,46.6));
 // Recessed business hall and upper offices, coherent bays behind the arcade.
 let towerUpperVoid=box(p-vec3<f32>(-35.5,9.,-18.),vec3<f32>(7.5,3.55,8.5));let wz=repeatX(p.z,5.5,7.);var west=box(p-vec3<f32>(-38.7,5.2,0.),vec3<f32>(.3,5.2,40.));
 let winW=archWindow(vec3<f32>(wz,p.y-6.1,p.x+38.7),.87,1.35,.8);
 west=max(west,-winW);west=max(west,-archOpening(vec3<f32>(p.z+18.,p.y,p.x+38.7),3.4,2.2,1.));
 let groundW=archWindow(vec3<f32>(wz,p.y-1.25,p.x+38.7),.8,1.85,.8);west=max(west,-groundW);
 west=max(west,-towerUpperVoid);f=take(f,field(shell(west,p),2u,p,1.));
 var ww=sashWindow(vec3<f32>(wz,p.y-6.1,p.x+38.7),.87,1.35,1.);ww.d=shell(max(ww.d,-towerUpperVoid),p);f=take(f,ww);
 if(abs(p.z+18.)>4.){var wg=sashWindow(vec3<f32>(wz,p.y-1.25,p.x+38.7),.8,1.85,2.);wg.d=shell(wg.d,p);f=take(f,wg);}
 let sx=repeatX(p.x-4.,5.5,8.);var south=box(p-vec3<f32>(4.,5.2,-36.6),vec3<f32>(46.,5.2,.3));
 let sw=archWindow(vec3<f32>(sx,p.y-6.1,p.z+36.6),.9,1.35,.8);let sg=archWindow(vec3<f32>(sx,p.y-1.2,p.z+36.6),.9,1.85,.8);south=max(max(south,-sw),-sg);
 f=take(f,field(shell(south,p),2u,p,2.));
 var su=sashWindow(vec3<f32>(sx,p.y-6.1,p.z+36.6),.9,1.35,2.);su.d=shell(su.d,p);f=take(f,su);
 var sl=sashWindow(vec3<f32>(sx,p.y-1.2,p.z+36.6),.9,1.85,3.);sl.d=shell(sl.d,p);f=take(f,sl);
 // Continuous stone string courses and eave, derived from the same bay grammar.
 let bandY=select(5.6,10.35,p.y>8.);f=take(f,field(shell(max(box(p-vec3<f32>(-38.9,bandY,0.),vec3<f32>(.55,.18,40.5)),-towerUpperVoid),p),3u,p,1.));
 f=take(f,field(shell(box(p-vec3<f32>(4.,bandY,-36.8),vec3<f32>(46.5,.18,.55)),p),3u,p,2.));
 // Four occupied storeys form a continuous tapered civic tower above the west entry.
 let tc=vec3<f32>(-35.5,0.,-18.);f=take(f,taperedTower(p));
 // East and railway-facing walls; storage net boundary x44 is separate from service strip.
 let rz=repeatX(p.z-2.,6.,6.);var east=box(p-vec3<f32>(49.75,4.8,0.),vec3<f32>(.25,4.8,40.));east=max(east,-archWindow(vec3<f32>(rz,p.y-4.,49.75-p.x),.85,2.4,.8));f=take(f,field(shell(east,p),2u,p,3.));var ew=sashWindow(vec3<f32>(rz,p.y-4.0,49.75-p.x),.85,2.4,10.);ew.d=shell(ew.d,p);f=take(f,ew);
 let gateX=repeatX(p.x-4.,20.,1.);let freightDoor=box(vec3<f32>(gateX,p.y-2.1,p.z-39.75),vec3<f32>(2.5,2.2,1.));var rear=box(p-vec3<f32>(4.,4.8,39.75),vec3<f32>(46.,4.8,.25));rear=max(rear,-freightDoor);f=take(f,field(shell(rear,p),2u,p,3.));
 // Warehouse clear rectangle is 72 x 62.5 m. All partitions lie OUTSIDE it.
 var westPartition=box(p-vec3<f32>(-28.3,5.9,3.25),vec3<f32>(.2,5.9,31.75));westPartition=max(westPartition,-box(vec3<f32>(p.x+28.3,p.y-1.65,repeatX(p.z,20.,1.)),vec3<f32>(1.,1.7,1.75)));f=take(f,field(shell(westPartition,p),1u,p,4.));
 f=take(f,field(shell(box(p-vec3<f32>(8.,5.9,-28.3),vec3<f32>(36.5,5.9,.2)),p),1u,p,4.));
 var rearPartition=box(p-vec3<f32>(8.,3.5,34.8),vec3<f32>(36.5,3.5,.2));rearPartition=max(rearPartition,-box(vec3<f32>(gateX,p.y-1.65,p.z-34.8),vec3<f32>(1.75,1.7,1.)));f=take(f,field(shell(rearPartition,p),1u,p,4.));
 var westFloor=box(p-vec3<f32>(-33.65,5.32,0.),vec3<f32>(5.1,.12,39.4));westFloor=max(westFloor,-box(p-vec3<f32>(-33.7,5.32,-18.),vec3<f32>(5.8,.4,8.4)));westFloor=max(westFloor,-box(p-vec3<f32>(-33.,5.32,30.),vec3<f32>(1.6,.4,5.5)));f=take(f,field(shell(westFloor,p),3u,p,1.));
 f=take(f,field(shell(box(p-vec3<f32>(8.,5.32,-32.4),vec3<f32>(36.4,.12,3.7)),p),3u,p,2.));
 let step=clamp(floor((p.z-25.)/.32),0.,29.);let stair=max(box(p-vec3<f32>(-33.,(step+1.)*.09,25.+(step+.5)*.32),vec3<f32>(1.3,(step+1.)*.09,.16)),box(p-vec3<f32>(-33.,2.8,29.8),vec3<f32>(1.3,2.8,4.8)));f=take(f,field(shell(stair,p),3u,p,1.));f=take(f,field(shell(box(p-vec3<f32>(-33.,5.36,35.13),vec3<f32>(1.3,.08,.61)),p),3u,p,1.));
 if(u.options.x<.5){let roofZ=repeatX(p.z-3.25,20.833333,1.);var warehouseRoof=max(abs(p.y-(12.9-abs(roofZ)*.25))-.14,box(p-vec3<f32>(8.,11.,3.25),vec3<f32>(36.6,3.,31.85)));let lightWell=box(vec3<f32>(p.x-8.,p.y-12.8,roofZ),vec3<f32>(30.9,2.,1.92));warehouseRoof=max(warehouseRoof,-lightWell);f=take(f,field(warehouseRoof,7u,p,3.));
 let light=max(abs(p.y-(13.45-abs(roofZ)*.43))-.006,box(vec3<f32>(p.x-8.,p.y-13.,roofZ),vec3<f32>(31.,1.5,2.1)));f=take(f,field(light,8u,p,3.));let endX=abs(p.x-8.)-31.08;let endGlass=max(abs(endX)-.006,max(abs(roofZ)-2.10,max((12.9-abs(roofZ)*.25+.12)-p.y,p.y-(13.45-abs(roofZ)*.43))));f=take(f,field(endGlass,8u,p,3.));
 // A single L-shaped hipped roof envelope: union volumes, subtract their inset union.
 let hyW=14.7-.44*max(abs(p.x+35.5),max(abs(p.z)-33.3,0.));
 let hyS=14.48-.44*max(abs(p.z+34.),max(abs(p.x-3.7)-39.5,0.));
 let bw=box(p-vec3<f32>(-35.5,11.,0.),vec3<f32>(7.8,5.,41.1));let bs=box(p-vec3<f32>(3.7,11.,-34.),vec3<f32>(47.,5.,7.5));
 let biw=box(p-vec3<f32>(-35.5,11.,0.),vec3<f32>(8.1,5.3,41.4));let bis=box(p-vec3<f32>(3.7,11.,-34.),vec3<f32>(47.3,5.3,7.8));
 let outerRoof=min(max((p.y-hyW)*.90,bw),max((p.y-hyS)*.90,bs));
 let innerRoof=min(max((p.y-hyW+.20)*.90,biw),max((p.y-hyS+.20)*.90,bis));
 // Each street gable has a full two-pitch roof extending inward to the main ridge.
 let gx=repeatX(p.x-4.,33.,1.);let gz=repeatX(p.z,27.5,1.);
 let gs=vec3<f32>(gx,p.y,p.z+40.5);let roofWestQ=vec3<f32>(gz,p.y,p.x+42.6);
 let gsh=15.91-abs(gs.x)*.72-max(gs.z,0.)*.24;
 let gwh=15.91-abs(roofWestQ.x)*.72-max(roofWestQ.z,0.)*.24;
 let gsBound=box(gs-vec3<f32>(0.,13.5,3.1),vec3<f32>(5.99,3.,3.75));
 let gwBound=box(roofWestQ-vec3<f32>(0.,13.5,3.1),vec3<f32>(5.99,3.,3.75));
 let towerGap=-box(p-tc-vec3<f32>(0.,14.,0.),vec3<f32>(8.,6.,8.8));
 let dormerOuter=min(max((p.y-gsh)*.81,gsBound),max(max((p.y-gwh)*.81,gwBound),towerGap));
 let dormerInner=min(max((p.y-gsh+.19)*.81,gsBound-.24),max(max((p.y-gwh+.19)*.81,gwBound-.24),towerGap));
 var publicRoof=max(min(outerRoof,dormerOuter),-min(innerRoof,dormerInner));let towerCut=max(chamferPlan((p-tc).xz,towerHalf(p.y)+vec2<f32>(.08),.6)/2.3,max(-p.y,p.y-23.8));publicRoof=max(publicRoof,-towerCut);f=take(f,field(publicRoof,7u,p,1.));
 let gableX=repeatX(p.x-4.,33.,1.);f=take(f,publicGable(vec3<f32>(gableX,p.y,p.z+40.5)));
 let gableZ=repeatX(p.z,27.5,1.);var gw=publicGable(vec3<f32>(gableZ,p.y,p.x+42.6));gw.d=max(gw.d,-box(p-tc-vec3<f32>(0.,14.,0.),vec3<f32>(8.,6.,8.8)));f=take(f,gw);
 f=take(f,field(box(p-vec3<f32>(8.,9.7,37.5),vec3<f32>(36.5,.16,3.)),7u,p,2.));f=take(f,field(box(p-vec3<f32>(47.,9.7,3.25),vec3<f32>(3.5,.16,31.8)),7u,p,2.));}
 return f;
}
fn rackField(p:vec3<f32>)->Field {
 let bank=select(0.,1.,p.x>5.5);let startX=select(-25.,12.,bank>.5);let row=clamp(round((p.z+23.5)/3.5),0.,15.);let rz=p.z-(-23.5+row*3.5);let bay=clamp(floor((p.x-startX)/1.2),0.,19.);let qx=p.x-(startX+(bay+.5)*1.2);
 let level=clamp(round((p.y-.3)/1.15),0.,5.);let ly=p.y-(.3+level*1.15);let bound=box(p-vec3<f32>(startX+12.,3.5,-23.5+row*3.5),vec3<f32>(12.05,3.5,.96));
 var d=min(box(vec3<f32>(abs(qx)-.55,p.y-3.5,abs(rz)-.90),vec3<f32>(.045,3.5,.045)),box(vec3<f32>(p.x-startX-12.,ly,rz),vec3<f32>(12.05,.045,.96)));
 if(row>9.5){let sx=abs(qx)-.2;d=min(d,box(vec3<f32>(sx,p.y-3.5,rz),vec3<f32>(.018,3.5,.9)));let halfLevel=p.y-(.3+clamp(round((p.y-.3)/.575),0.,11.)*.575);d=min(d,box(vec3<f32>(p.x-startX-12.,halfLevel,rz),vec3<f32>(12.,.018,.9)));}
 return field(max(d,bound),5u,vec3<f32>(qx,p.y,rz),row+bank*16.);
}
fn machineField(p:vec3<f32>)->Field {
 var f=field(box(p-vec3<f32>(58.,-.15,48.),vec3<f32>(6.3,.15,9.3)),3u,p,1.);
 var house=max(box(p-vec3<f32>(58.,3.2,48.),vec3<f32>(6.,3.2,9.)),-box(p-vec3<f32>(58.,3.4,48.),vec3<f32>(5.6,3.3,8.6)));
 house=max(house,-box(p-vec3<f32>(58.,1.7,39.),vec3<f32>(1.5,1.8,1.)));f=take(f,field(shell(house,p),2u,p,7.));
 if(u.options.x<.5){f=take(f,field(box(p-vec3<f32>(58.,6.5,48.),vec3<f32>(6.3,.18,9.3)),7u,p,1.));}
 f=take(f,taperedChimney(p));
 f=take(f,field(cylinder((p-vec3<f32>(57.,2.2,49.)).xzy,1.45,3.5),5u,p,8.));
 f=take(f,field(box(p-vec3<f32>(57.,1.2,45.45),vec3<f32>(.7,.6,.045)),11u,p,1.));
 // Boiler -> east service spine -> front drive; supply and return are connected.
 var pipe=capsule(p,vec3<f32>(57.,4.1,47.),vec3<f32>(47.,4.1,47.),.18);
 pipe=min(pipe,capsule(p,vec3<f32>(47.,4.1,47.),vec3<f32>(47.,4.1,-26.),.18));
 pipe=min(pipe,capsule(p,vec3<f32>(47.,4.1,-26.),vec3<f32>(-24.,4.1,-26.),.18));
 pipe=min(pipe,capsule(p,vec3<f32>(-24.,4.1,-26.),vec3<f32>(-24.,1.45,-26.),.18));
 pipe=min(pipe,capsule(p,vec3<f32>(47.,4.1,32.),vec3<f32>(.5,4.1,32.),.12));
 pipe=min(pipe,capsule(p,vec3<f32>(.5,4.1,32.),vec3<f32>(.5,1.45,32.),.12));
 pipe=min(pipe,capsule(p,vec3<f32>(47.,4.1,37.),vec3<f32>(24.,4.1,37.),.12));
 pipe=min(pipe,capsule(p,vec3<f32>(24.,4.1,37.),vec3<f32>(24.,.65,37.),.12));f=take(f,field(pipe,9u,p,1.));
 var ret=capsule(p,vec3<f32>(-24.,.45,-26.),vec3<f32>(46.,.45,-26.),.1);
 ret=min(ret,capsule(p,vec3<f32>(46.,.45,-26.),vec3<f32>(46.,.45,50.),.1));ret=min(ret,capsule(p,vec3<f32>(46.,.45,50.),vec3<f32>(57.,.45,50.),.1));
 ret=min(ret,capsule(p,vec3<f32>(.5,.45,32.),vec3<f32>(46.,.45,32.),.09));ret=min(ret,capsule(p,vec3<f32>(24.,.45,37.),vec3<f32>(46.,.45,37.),.09));f=take(f,field(ret,5u,p,1.));
 // Central conveyor and adjacent x=4 transport lane are deliberately separate.
 f=take(f,field(box(p-vec3<f32>(.5,1.05,3.5),vec3<f32>(.65,.18,27.5)),5u,p,4.));
 let slatZ=repeatX(p.z-u.clock.x*.4,.55,60.);let slats=max(box(vec3<f32>(p.x-.5,p.y-1.24,slatZ),vec3<f32>(.61,.065,.20)),box(p-vec3<f32>(.5,1.25,3.5),vec3<f32>(.65,.2,27.5)));f=take(f,field(slats,4u,p,2.));
 f=take(f,field(cylinder((p-vec3<f32>(.5,1.15,32.)).xzy,.37,.65),5u,p,4.));
 let phase=u.clock.x*1.8;let wheelP=p-vec3<f32>(-24.,1.45,-26.);f=take(f,field(length(vec2<f32>(length(wheelP.xy)-.8,wheelP.z))-.095,5u,p,2.));
 let crank=vec3<f32>(-24.+.65*cos(phase),1.45+.65*sin(phase),-26.);f=take(f,field(capsule(p,crank,vec3<f32>(-21.5,1.45,-26.),.07),9u,p,2.));
 f=take(f,field(box(p-vec3<f32>(-21.2,1.45,-26.),vec3<f32>(.55,.25,.3)),5u,p,2.));
 let elbow=vec3<f32>(24.,3.4,37.);let hand=vec3<f32>(24.+2.*sin(phase*.25),2.2,34.6);f=take(f,field(capsule(p,vec3<f32>(24.,.3,37.),elbow,.18),5u,p,3.));f=take(f,field(capsule(p,elbow,hand,.14),9u,p,3.));f=take(f,field(box(p-hand,vec3<f32>(.43,.13,.32)),5u,p,3.));
 return f;
}
fn outsideField(p:vec3<f32>)->Field {
 var f=field(box(p-vec3<f32>(0.,-.45,0.),vec3<f32>(90.,.2,75.)),10u,p,1.);
 f=take(f,field(box(p-vec3<f32>(4.,-.1,-44.),vec3<f32>(50.,.1,4.)),3u,p,1.));
 f=take(f,field(box(p-vec3<f32>(-46.,-.1,0.),vec3<f32>(4.,.1,44.)),3u,p,1.));
 f=take(f,field(box(p-vec3<f32>(4.,-.02,42.5),vec3<f32>(46.,.25,2.5)),3u,p,1.));
 let trackZ=46.+round(clamp((p.z-46.)/5.,0.,1.))*5.;let railDist=abs(abs(p.z-trackZ)-.72);f=take(f,field(box(vec3<f32>(p.x+20.,p.y-.05,railDist),vec3<f32>(60.,.10,.07)),5u,p,1.));
 let tx=repeatX(p.x+20.,.85,70.);f=take(f,field(box(vec3<f32>(tx,p.y+.14,p.z-trackZ),vec3<f32>(.16,.13,1.1)),4u,p,5.));
 let wx=repeatX(p.x+5.,13.,1.);f=take(f,field(box(vec3<f32>(wx,p.y-1.9,p.z-51.),vec3<f32>(5.5,1.4,1.25)),4u,p,8.));
 let axle=abs(wx)-3.5;f=take(f,field(cylinder(vec3<f32>(axle,p.z-51.,p.y-.55),.48,1.3),5u,p,9.));return f;
}
fn sceneField(p:vec3<f32>)->Field {
 var f=outsideField(p);f=take(f,architecture(p));f=take(f,interiorField(p));f=take(f,entryJoinery(p));
 if(box(p-vec3<f32>(5.5,3.5,2.75),vec3<f32>(31.5,4.,28.))<max(1.,f.d)){f=take(f,rackField(p));}
 f=take(f,machineField(p));
 for(var i=0u;i<u.counts.x;i++){let r=items[i];let q=p-r.position.xyz;let dd=box(q,r.size.xyz)-.025;if(dd<f.d){f=field(dd,4u,q,r.position.w);}}
 let exposure=field(f.d,f.mat,p,f.seed);f.wet=exposure.wet;
 if((f.mat==1u||f.mat==19u)&&abs(f.d)<.045){let pp=receiverPlasterParams();let cp=plasterCoordinates(p);let coatMacro=kpPlasterMacro(cp,pp);let micro=kpPlasterMicro(cp,pp);let originalThickness=clamp(pp.thicknessM+pp.reliefM*coatMacro+pp.geometryMicroM*micro,pp.minThicknessM,pp.maxThicknessM);let state=kpFabricState(f.age,f.wet,f.wet,coatMacro,.42,.08,coatMacro,micro,originalThickness,.004,.025);let gate=1.-smoothstep(.015,.045,abs(f.d));f.d-=(state.thicknessM-.0165)*gate;}
 if(abs(f.d)<.025&&u.options.z>.5){let envelope=1.-smoothstep(.005,.025,abs(f.d));let grain=br_noise3(f.local*3.+vec3<f32>(f.seed));f.d+=(grain-.5)*.006*f.age*f.wet*envelope;}return f;
}
`;
