/** R03b: 4,000 m² clear warehouse, actual quarter-turn racks and west entry. */
export const SCENE=Object.freeze({version:'bureau-r03b-right-entry-01',units:'metres',building:[84,80],oldBuilding:[44,38],previousBuilding:[72,64],clearWarehouse:{min:[-28,-28],max:[36,34.5],size:[64,62.5],area:4000},hall:{side:'west x-negative',depth:14},office:{side:'south z-negative',depth:12},receiving:{min:[-28,34.5],max:[36,40]},banks:2,rowsPerBank:16,bays:20,levels:6,regularSlots:4800,smallSlots:17280,capacityIs:'mixed-size addresses, not actual inventory',fiction:true});
export const DOMAIN=String.raw`
struct Field { d:f32, mat:u32, local:vec3<f32>, seed:f32, age:f32, wet:f32 };
fn box(p:vec3<f32>,b:vec3<f32>)->f32 {let q=abs(p)-b;return length(max(q,vec3<f32>(0.)))+min(max(q.x,max(q.y,q.z)),0.);}
fn cylinder(p:vec3<f32>,r:f32,h:f32)->f32 {let q=vec2<f32>(length(p.xz)-r,abs(p.y)-h);return min(max(q.x,q.y),0.)+length(max(q,vec2<f32>(0.)));}
fn capsule(p:vec3<f32>,a:vec3<f32>,b:vec3<f32>,r:f32)->f32 {let q=p-a;let v=b-a;return length(q-v*clamp(dot(q,v)/dot(v,v),0.,1.))-r;}
fn shell(d:f32,p:vec3<f32>)->f32 {if(u.options.x>.5){return max(d,p.y-1.1);}return d;}
fn field(d:f32,mat:u32,p:vec3<f32>,seed:f32)->Field {let rain=(1.-smoothstep(.15,.8,abs(fract((p.x+2.)/8.)-.5)*8.))*(.25+.75*smoothstep(0.,9.,p.y));let damp=(1.-smoothstep(.1,1.6,p.y))*.55;return Field(d,mat,p,seed,u.options.y,clamp(.10+rain*.45+damp,0.,1.));}
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
let title=array<u32,37>(72u,79u,78u,71u,32u,75u,79u,78u,71u,32u,71u,69u,78u,69u,82u,65u,76u,32u,76u,79u,83u,84u,32u,38u,32u,70u,79u,85u,78u,68u,32u,79u,70u,70u,73u,67u,69u);
let year=array<u32,9>(65u,46u,68u,46u,32u,49u,57u,49u,49u);
let scale=select(.049,.043,line==1u);let count=select(37. ,9. ,line==1u);let baseline=select(10.39,9.97,line==1u);let q=vec3<f32>(p.x+count*scale*3.,baseline-p.y,p.z+29.785);var d=100.;let cell=i32(floor(q.x/(scale*6.)));for(var g=-1;g<=1;g++){let index=cell+g;if(index<0||f32(index)>=count){continue;}var code=0u;if(line==0u){code=title[u32(index)];}else{code=year[u32(index)];}let mask=glyph(code);let local=vec2<f32>(q.x-f32(index)*scale*6.,q.y+2.5*scale);let ix=i32(floor(local.x/scale));let iy=i32(floor(local.y/scale));for(var dy=-1;dy<=1;dy++){for(var dx=-1;dx<=1;dx++){let xx=ix+dx;let yy=iy+dy;if(xx<0||xx>4||yy<0||yy>4){continue;}if((mask&(1u<<u32(yy*5+xx)))!=0u){let r=vec3<f32>(local.x-(f32(xx)+.5)*scale,local.y-(f32(yy)+.5)*scale,q.z);d=min(d,box(r,vec3<f32>(scale*.43,scale*.43,.017)));}}}}return d;}
fn entranceText(p:vec3<f32>)->f32 {let bound=box(p-vec3<f32>(0.,10.2,-29.8),vec3<f32>(6.2,.5,.05));if(bound>.1){return 100.;}return min(textRow(p,0u),textRow(p,1u));}
fn architecture(p:vec3<f32>)->Field {
 var f=field(box(p-vec3<f32>(0.,-.24,0.),vec3<f32>(42.,.24,40.)),3u,p,1.);
 // Main public face has genuinely moved to x-negative. South is offices only.
 let wz=repeatX(p.z,4.4,8.);let westQ=vec3<f32>(wz,p.y,p.x+38.8);
 var west=box(p-vec3<f32>(-38.8,5.,0.),vec3<f32>(.38,5.,40.));
 let westWindows=min(box(westQ-vec3<f32>(0.,2.4,0.),vec3<f32>(.8,1.3,1.)),box(westQ-vec3<f32>(0.,7.2,0.),vec3<f32>(.72,1.3,1.)));
 west=max(west,-westWindows);west=max(west,-box(p-vec3<f32>(-38.8,2.6,-18.),vec3<f32>(1.,2.65,3.3)));
 f=take(f,field(shell(west,p),1u,p,1.));
 let wxFrame=max(box(westQ-vec3<f32>(0.,7.2,-.42),vec3<f32>(.86,1.45,.13)),-box(westQ-vec3<f32>(0.,7.2,-.42),vec3<f32>(.7,1.28,.3)));
 f=take(f,field(shell(wxFrame,p),3u,p,1.));
 f=take(f,field(shell(box(westQ-vec3<f32>(0.,7.2,-.05),vec3<f32>(.69,1.27,.02)),p),8u,p,1.));
 let cz=repeatX(p.z-2.2,4.4,8.);var columns=cylinder(vec3<f32>(p.x+41.2,p.y-2.35,cz),.3,2.2);
 columns=min(columns,box(vec3<f32>(p.x+41.2,p.y-.24,cz),vec3<f32>(.44,.24,.44)));
 columns=min(columns,box(vec3<f32>(p.x+41.2,p.y-4.5,cz),vec3<f32>(.44,.18,.44)));
 columns=max(columns,-box(p-vec3<f32>(-41.2,2.5,-18.),vec3<f32>(1.,3.,4.)));
 f=take(f,field(shell(columns,p),3u,p,1.));
 f=take(f,field(shell(box(p-vec3<f32>(-40.,4.9,0.),vec3<f32>(2.,.27,40.4)),p),3u,p,1.));
 f=take(f,field(shell(box(p-vec3<f32>(-38.95,9.8,0.),vec3<f32>(.75,.24,40.4)),p),3u,p,1.));
 // An emphatic entrance pavilion at the right end. No second main south door.
 var portal=box(p-vec3<f32>(-40.6,6.5,-18.),vec3<f32>(1.7,6.5,7.8));
 portal=max(portal,-box(p-vec3<f32>(-40.6,2.65,-18.),vec3<f32>(2.2,2.7,3.3)));
 portal=max(portal,-box(p-vec3<f32>(-40.6,8.1,-18.),vec3<f32>(2.2,1.35,2.25)));
 f=take(f,field(shell(portal,p),3u,p,7.));
 let gatePostZ=abs(p.z+18.)-3.7;f=take(f,field(shell(box(vec3<f32>(p.x+42.25,p.y-3.3,gatePostZ),vec3<f32>(.45,3.3,.35)),p),3u,p,9.));
 if(u.options.x<.5){let pediment=max(abs(p.y-(15.9-abs(p.z+18.)*.28))-.18,box(p-vec3<f32>(-37.5,14.8,-18.),vec3<f32>(5.5,2.,8.4)));f=take(f,field(pediment,7u,p,1.));
 f=take(f,field(box(p-vec3<f32>(-42.19,11.65,-18.),vec3<f32>(.13,.58,6.6)),12u,p,1.));
 f=take(f,field(entranceText(vec3<f32>(p.z+18.,p.y-1.4,p.x+12.57)),13u,p,1.));}
 // South street office frontage, both stories with tall windows and stone piers.
 let sx=repeatX(p.x-7.,4.4,7.);var south=box(p-vec3<f32>(7.,4.9,-39.7),vec3<f32>(35.,4.9,.3));
 let sy=select(2.3,7.1,p.y>4.7);let sw=box(vec3<f32>(sx,p.y-sy,p.z+39.7),vec3<f32>(.85,1.25,.8));south=max(south,-sw);
 f=take(f,field(shell(south,p),1u,p,2.));
 let sf=max(box(vec3<f32>(sx,p.y-sy,p.z+40.05),vec3<f32>(1.,1.4,.14)),-box(vec3<f32>(sx,p.y-sy,p.z+40.05),vec3<f32>(.82,1.22,.3)));
 f=take(f,field(shell(sf,p),3u,p,2.));
 f=take(f,field(shell(box(vec3<f32>(sx,p.y-sy,p.z+39.7),vec3<f32>(.81,1.21,.025)),p),8u,p,2.));
 f=take(f,field(shell(box(p-vec3<f32>(7.,4.8,-39.75),vec3<f32>(35.4,.24,.75)),p),3u,p,2.));
 // Explicit east/rear walls do not recreate a hidden front wall behind windows.
 let rz=repeatX(p.z-2.,6.,6.);var east=box(p-vec3<f32>(41.75,4.8,0.),vec3<f32>(.25,4.8,40.));east=max(east,-box(vec3<f32>(p.x-41.75,p.y-5.7,rz),vec3<f32>(.8,1.7,.85)));
 f=take(f,field(shell(east,p),2u,p,3.));
 let gateX=repeatX(p.x-4.,20.,1.);let freightDoor=box(vec3<f32>(gateX,p.y-2.1,p.z-39.75),vec3<f32>(2.5,2.2,1.));var rear=box(p-vec3<f32>(0.,4.8,39.75),vec3<f32>(42.,4.8,.25));rear=max(rear,-freightDoor);f=take(f,field(shell(rear,p),2u,p,3.));
 // Warehouse clear rectangle is 64 x 62.5 m. All partitions lie OUTSIDE it.
 var westPartition=box(p-vec3<f32>(-28.3,3.8,3.25),vec3<f32>(.2,3.8,31.75));westPartition=max(westPartition,-box(vec3<f32>(p.x+28.3,p.y-1.65,repeatX(p.z,20.,1.)),vec3<f32>(1.,1.7,1.75)));
 f=take(f,field(shell(westPartition,p),1u,p,4.));
 f=take(f,field(shell(box(p-vec3<f32>(4.,4.7,-28.3),vec3<f32>(32.5,4.7,.2)),p),1u,p,4.));
 var rearPartition=box(p-vec3<f32>(4.,3.5,34.8),vec3<f32>(32.5,3.5,.2));rearPartition=max(rearPartition,-box(vec3<f32>(gateX,p.y-1.65,p.z-34.8),vec3<f32>(1.75,1.7,1.)));
 f=take(f,field(shell(rearPartition,p),1u,p,4.));
 // Office upper floor is removed by cutaway; it never hides the hall below.
 var westFloor=box(p-vec3<f32>(-33.65,4.82,0.),vec3<f32>(5.1,.12,39.4));westFloor=max(westFloor,-box(p-vec3<f32>(-33.7,4.82,-18.),vec3<f32>(5.8,.4,7.)));
 f=take(f,field(shell(westFloor,p),3u,p,1.));f=take(f,field(shell(box(p-vec3<f32>(7.,4.82,-34.1),vec3<f32>(34.4,.12,5.6)),p),3u,p,1.));
 // Ridges now run along x: the warehouse and the cupboard axes really turn.
 if(u.options.x<.5){let roofZ=repeatX(p.z-3.25,20.833333,1.);let warehouseRoof=max(abs(p.y-(12.5-abs(roofZ)*.25))-.14,box(p-vec3<f32>(4.,11.,3.25),vec3<f32>(32.6,3.,31.85)));f=take(f,field(warehouseRoof,7u,p,3.));
 let light=max(abs(p.y-(13.05-abs(roofZ)*.43))-.075,box(vec3<f32>(p.x-4.,p.y-12.6,roofZ),vec3<f32>(27.,1.5,2.1)));f=take(f,field(light,8u,p,3.));
 let wr=max(abs(p.y-(12.25-abs(p.x+35.2)*.35))-.14,box(p-vec3<f32>(-35.2,11.,0.),vec3<f32>(7.4,3.,40.6)));f=take(f,field(wr,7u,p,1.));
 let sr=max(abs(p.y-(11.75-abs(p.z+34.2)*.30))-.14,box(p-vec3<f32>(7.,11.,-34.2),vec3<f32>(35.5,2.,6.2)));f=take(f,field(sr,7u,p,2.));
 f=take(f,field(box(p-vec3<f32>(4.,9.7,37.5),vec3<f32>(32.5,.16,3.)),7u,p,2.));
 f=take(f,field(box(p-vec3<f32>(39.,9.7,3.25),vec3<f32>(3.5,.16,31.8)),7u,p,2.));}
 // Right hall counters run along z, with a clear controlled gate beyond each.
 let counterZ=repeatX(p.z+2.6,4.4,4.);f=take(f,field(box(vec3<f32>(p.x+33.,p.y-.65,counterZ),vec3<f32>(.7,.65,1.35)),4u,p.zyx,2.));
 f=take(f,field(box(vec3<f32>(p.x+36.,p.y-.46,counterZ),vec3<f32>(.43,.11,1.2)),4u,p.zyx,3.));
 // Ordinary desks behind the south office windows; not extra reception gates.
 let deskX=repeatX(p.x-7.,8.,4.);f=take(f,field(box(vec3<f32>(deskX,p.y-.72,p.z+35.),vec3<f32>(1.35,.12,.7)),4u,p,3.));
 return f;
}
fn rackField(p:vec3<f32>)->Field {
 let bank=select(0.,1.,p.x>3.5);let startX=select(-25.,8.,bank>.5);let row=clamp(round((p.z+23.5)/3.5),0.,15.);let rz=p.z-(-23.5+row*3.5);let bay=clamp(floor((p.x-startX)/1.2),0.,19.);let qx=p.x-(startX+(bay+.5)*1.2);
 let level=clamp(round((p.y-.3)/1.15),0.,5.);let ly=p.y-(.3+level*1.15);let bound=box(p-vec3<f32>(startX+12.,3.5,-23.5+row*3.5),vec3<f32>(12.05,3.5,.96));
 var d=min(box(vec3<f32>(abs(qx)-.55,p.y-3.5,abs(rz)-.90),vec3<f32>(.045,3.5,.045)),box(vec3<f32>(p.x-startX-12.,ly,rz),vec3<f32>(12.05,.045,.96)));
 if(row>9.5){let sx=abs(qx)-.2;d=min(d,box(vec3<f32>(sx,p.y-3.5,rz),vec3<f32>(.018,3.5,.9)));let halfLevel=p.y-(.3+clamp(round((p.y-.3)/.575),0.,11.)*.575);d=min(d,box(vec3<f32>(p.x-startX-12.,halfLevel,rz),vec3<f32>(12.,.018,.9)));}
 return field(max(d,bound),5u,vec3<f32>(qx,p.y,rz),row+bank*16.);
}
fn machineField(p:vec3<f32>)->Field {
 var f=field(box(p-vec3<f32>(50.,-.15,44.),vec3<f32>(6.3,.15,9.3)),3u,p,1.);
 var house=max(box(p-vec3<f32>(50.,3.2,44.),vec3<f32>(6.,3.2,9.)),-box(p-vec3<f32>(50.,3.4,44.),vec3<f32>(5.6,3.3,8.6)));
 house=max(house,-box(p-vec3<f32>(50.,1.7,35.),vec3<f32>(1.5,1.8,1.)));f=take(f,field(shell(house,p),2u,p,7.));
 if(u.options.x<.5){f=take(f,field(box(p-vec3<f32>(50.,6.5,44.),vec3<f32>(6.3,.18,9.3)),7u,p,1.));}
 f=take(f,field(cylinder(p-vec3<f32>(55.,9.,51.),1.,9.),2u,p,9.));
 f=take(f,field(cylinder((p-vec3<f32>(49.,2.2,45.)).xzy,1.45,3.5),5u,p,8.));
 f=take(f,field(box(p-vec3<f32>(49.,1.2,41.45),vec3<f32>(.7,.6,.045)),11u,p,1.));
 // Boiler -> east service spine -> front drive; supply and return are connected.
 var pipe=capsule(p,vec3<f32>(49.,4.1,43.),vec3<f32>(39.,4.1,43.),.18);
 pipe=min(pipe,capsule(p,vec3<f32>(39.,4.1,43.),vec3<f32>(39.,4.1,-26.),.18));
 pipe=min(pipe,capsule(p,vec3<f32>(39.,4.1,-26.),vec3<f32>(-24.,4.1,-26.),.18));
 pipe=min(pipe,capsule(p,vec3<f32>(-24.,4.1,-26.),vec3<f32>(-24.,1.45,-26.),.18));
 pipe=min(pipe,capsule(p,vec3<f32>(39.,4.1,32.),vec3<f32>(.5,4.1,32.),.12));
 pipe=min(pipe,capsule(p,vec3<f32>(.5,4.1,32.),vec3<f32>(.5,1.45,32.),.12));
 pipe=min(pipe,capsule(p,vec3<f32>(39.,4.1,37.),vec3<f32>(24.,4.1,37.),.12));
 pipe=min(pipe,capsule(p,vec3<f32>(24.,4.1,37.),vec3<f32>(24.,.65,37.),.12));f=take(f,field(pipe,9u,p,1.));
 var ret=capsule(p,vec3<f32>(-24.,.45,-26.),vec3<f32>(38.,.45,-26.),.1);
 ret=min(ret,capsule(p,vec3<f32>(38.,.45,-26.),vec3<f32>(38.,.45,46.),.1));ret=min(ret,capsule(p,vec3<f32>(38.,.45,46.),vec3<f32>(49.,.45,46.),.1));
 ret=min(ret,capsule(p,vec3<f32>(.5,.45,32.),vec3<f32>(38.,.45,32.),.09));ret=min(ret,capsule(p,vec3<f32>(24.,.45,37.),vec3<f32>(38.,.45,37.),.09));f=take(f,field(ret,5u,p,1.));
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
 f=take(f,field(box(p-vec3<f32>(0.,-.1,-44.),vec3<f32>(47.,.1,4.)),3u,p,1.));
 f=take(f,field(box(p-vec3<f32>(-46.,-.1,0.),vec3<f32>(4.,.1,44.)),3u,p,1.));
 f=take(f,field(box(p-vec3<f32>(0.,-.02,42.5),vec3<f32>(42.,.25,2.5)),3u,p,1.));
 let trackZ=46.+round(clamp((p.z-46.)/5.,0.,1.))*5.;let railDist=abs(abs(p.z-trackZ)-.72);f=take(f,field(box(vec3<f32>(p.x+20.,p.y-.05,railDist),vec3<f32>(60.,.10,.07)),5u,p,1.));
 let tx=repeatX(p.x+20.,.85,70.);f=take(f,field(box(vec3<f32>(tx,p.y+.14,p.z-trackZ),vec3<f32>(.16,.13,1.1)),4u,p,5.));
 let wx=repeatX(p.x+5.,13.,1.);f=take(f,field(box(vec3<f32>(wx,p.y-1.9,p.z-51.),vec3<f32>(5.5,1.4,1.25)),4u,p,8.));
 let axle=abs(wx)-3.5;f=take(f,field(cylinder(vec3<f32>(axle,p.z-51.,p.y-.55),.48,1.3),5u,p,9.));return f;
}
fn sceneField(p:vec3<f32>)->Field {
 var f=outsideField(p);f=take(f,architecture(p));
 if(box(p-vec3<f32>(3.5,3.5,2.75),vec3<f32>(29.5,4.,28.))<max(1.,f.d)){f=take(f,rackField(p));}
 f=take(f,machineField(p));
 for(var i=0u;i<u.counts.x;i++){let r=items[i];let q=p-r.position.xyz;let dd=box(q,r.size.xyz)-.025;if(dd<f.d){f=field(dd,4u,q,r.position.w);}}
 if(abs(f.d)<.025&&u.options.z>.5){let grain=br_noise3(f.local*3.+vec3<f32>(f.seed));f.d+=(grain-.5)*.006*f.age*f.wet;}return f;
}
`;
