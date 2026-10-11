/** R03b: 4,500 m² clear warehouse, actual quarter-turn racks and west entry. */
export const SCENE=Object.freeze({version:'bureau-r03c-arcaded-tower-01',units:'metres',building:[92,80],oldBuilding:[44,38],previousBuilding:[72,64],clearWarehouse:{min:[-28,-28],max:[44,34.5],size:[72,62.5],area:4500},hall:{side:'west x-negative',depth:14},office:{side:'south z-negative',depth:12},receiving:{min:[-28,34.5],max:[44,40]},arcade:{clearWidth:3.2,axisDepth:3.9,sides:['west','south']},tower:{storeys:4,roofHeight:23.5},chimney:{height:30,diameter:3.6},banks:2,rowsPerBank:16,bays:20,levels:6,regularSlots:4800,smallSlots:17280,capacityIs:'mixed-size addresses, not actual inventory',fiction:true});
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
fn architecture(p:vec3<f32>)->Field {
 var f=field(box(p-vec3<f32>(4.,-.24,0.),vec3<f32>(46.,.24,40.)),3u,p,1.);
 // Continuous L-shaped, 3.2m clear sheltered walk. The x-negative street is public entry.
 let westQ=vec3<f32>(p.z,p.y,p.x+42.6);let southQ=vec3<f32>(p.x-4.,p.y,p.z+40.5);
 var wa=arcade(westQ,40.7);wa.d=max(wa.d,-box(p-vec3<f32>(-42.6,3.,-18.),vec3<f32>(1.,3.1,4.0)));f=take(f,wa);
 f=take(f,arcade(southQ,46.6));
 f=take(f,field(shell(box(p-vec3<f32>(-40.7,5.42,0.),vec3<f32>(2.35,.18,40.9)),p),3u,p,1.));
 f=take(f,field(shell(box(p-vec3<f32>(4.,5.42,-38.7),vec3<f32>(46.8,.18,2.2)),p),3u,p,2.));
 // Recessed business hall and upper offices, coherent bays behind the arcade.
 let wz=repeatX(p.z,5.5,7.);var west=box(p-vec3<f32>(-38.7,5.2,0.),vec3<f32>(.3,5.2,40.));
 let winW=archWindow(vec3<f32>(wz,p.y-6.1,p.x+38.7),.87,1.35,.8);
 west=max(west,-winW);west=max(west,-box(p-vec3<f32>(-38.7,2.7,-18.),vec3<f32>(1.,2.8,3.5)));
 let groundW=box(vec3<f32>(wz,p.y-2.9,p.x+38.7),vec3<f32>(.8,1.35,.8));west=max(west,-groundW);
 f=take(f,field(shell(west,p),2u,p,1.));
 let rimW=max(archWindow(vec3<f32>(wz,p.y-6.1,p.x+39.02),1.06,1.35,.15),-archWindow(vec3<f32>(wz,p.y-6.1,p.x+39.02),.86,1.35,.3));f=take(f,field(shell(rimW,p),3u,p,1.));
 f=take(f,field(shell(max(winW,abs(p.x+38.7)-.025),p),8u,p,1.));
 let sx=repeatX(p.x-4.,5.5,8.);var south=box(p-vec3<f32>(4.,5.2,-36.6),vec3<f32>(46.,5.2,.3));
 let sw=archWindow(vec3<f32>(sx,p.y-6.1,p.z+36.6),.9,1.35,.8);let sg=box(vec3<f32>(sx,p.y-2.9,p.z+36.6),vec3<f32>(.9,1.4,.8));south=max(max(south,-sw),-sg);
 f=take(f,field(shell(south,p),2u,p,2.));
 let sf=max(archWindow(vec3<f32>(sx,p.y-6.1,p.z+36.95),1.08,1.35,.15),-archWindow(vec3<f32>(sx,p.y-6.1,p.z+36.95),.89,1.35,.3));f=take(f,field(shell(sf,p),3u,p,2.));
 f=take(f,field(shell(max(min(sw,sg),abs(p.z+36.6)-.025),p),8u,p,2.));
 // Continuous stone string courses and eave, derived from the same bay grammar.
 let bandY=select(5.6,10.35,p.y>8.);f=take(f,field(shell(box(p-vec3<f32>(-38.9,bandY,0.),vec3<f32>(.55,.18,40.5)),p),3u,p,1.));
 f=take(f,field(shell(box(p-vec3<f32>(4.,bandY,-36.8),vec3<f32>(46.5,.18,.55)),p),3u,p,2.));
 // Four occupied storeys above the right-street main portal, not a stack of solid boxes.
 let tc=vec3<f32>(-35.5,0.,-18.);let tq=p-tc;
 var tower=max(box(tq-vec3<f32>(0.,10.4,0.),vec3<f32>(7.10,10.4,8.2)),-box(tq-vec3<f32>(0.,10.4,0.),vec3<f32>(6.58,10.6,7.68)));
 let mainArch=archOpening(vec3<f32>(tq.z,p.y,tq.x+7.10),3.05,3.15,1.1);tower=max(tower,-mainArch);tower=max(tower,-box(p-vec3<f32>(-28.4,1.7,-20.),vec3<f32>(1.,1.75,1.75)));
 let floorIndex=clamp(round((p.y-9.)/4.6),0.,2.);let wy=p.y-(7.2+floorIndex*4.6);
 let frontU=repeatX(tq.z,4.9,1.);let sideU=repeatX(tq.x,4.6,1.);
 let twFront=archWindow(vec3<f32>(frontU,wy,abs(tq.x)-7.10),1.05,1.5,1.);
 let twSide=archWindow(vec3<f32>(sideU,wy,abs(tq.z)-8.2),1.05,1.5,1.);
 tower=max(max(tower,-twFront),-twSide);f=take(f,field(shell(tower,p),2u,p,7.));
 let tf=max(archWindow(vec3<f32>(frontU,wy,abs(tq.x)-7.17),1.25,1.5,.2),-twFront);
 let ts=max(archWindow(vec3<f32>(sideU,wy,abs(tq.z)-8.27),1.25,1.5,.2),-twSide);
 f=take(f,field(shell(min(tf,ts),p),3u,p,7.));
 let tg=min(max(twFront,abs(abs(tq.x)-6.95)-.025),max(twSide,abs(abs(tq.z)-8.05)-.025));f=take(f,field(shell(tg,p),8u,p,7.));
 let towerBand=6.55+clamp(round((p.y-6.55)/4.6),0.,3.)*4.6;let course=max(box(tq-vec3<f32>(0.,towerBand,0.),vec3<f32>(7.33,.20,8.43)),-box(tq-vec3<f32>(0.,towerBand,0.),vec3<f32>(6.53,.5,7.62)));f=take(f,field(shell(course,p),3u,p,7.));
 // Rusticated corner quoins and raised archivolt frame the entrance.
 let quoins=box(vec3<f32>(abs(tq.x)-7.10,p.y-10.3,abs(tq.z)-8.2),vec3<f32>(.35,10.3,.48));f=take(f,field(shell(quoins,p),3u,p,8.));
 let portalRing=max(archOpening(vec3<f32>(tq.z,p.y,tq.x+7.22),3.55,3.15,.28),-mainArch);f=take(f,field(shell(portalRing,p),3u,p,8.));
 // Upper floors, connected by the public wing stair; tower stairs have real treads.
 let tfloor=6.5+clamp(round((p.y-6.5)/4.6),0.,2.)*4.6;var floors=box(tq-vec3<f32>(0.,tfloor,0.),vec3<f32>(6.57,.13,7.10));floors=max(floors,-box(tq-vec3<f32>(4.8,tfloor,0.),vec3<f32>(1.4,.5,5.5)));f=take(f,field(shell(floors,p),3u,p,7.));
 let flight=clamp(floor(p.y/4.6),0.,3.);let stairZ=select(tq.z,-tq.z,i32(flight)%2==1);let riser=clamp(floor((stairZ+5.4)/.32),0.,25.);let treadY=flight*4.6+(riser+1.)*.177;let towerStair=box(vec3<f32>(tq.x-4.8,p.y-treadY+.09,stairZ-(-5.4+(riser+.5)*.32)),vec3<f32>(1.25,.09,.16));f=take(f,field(shell(towerStair,p),3u,p,7.));
 if(u.options.x<.5){
 let crown=max(abs(p.y-(23.5-abs(tq.z)*.40))-.18,box(tq-vec3<f32>(0.,21.7,0.),vec3<f32>(8.1,3.,8.7)));f=take(f,field(crown,7u,p,7.));
 let tympanum=max(box(tq-vec3<f32>(-7.7,21.,0.),vec3<f32>(.28,2.4,8.4)),p.y-(23.1-abs(tq.z)*.40));f=take(f,field(tympanum,3u,p,7.));
 f=take(f,field(box(p-vec3<f32>(-42.93,6.78,-18.),vec3<f32>(.12,.50,6.5)),12u,p,1.));
 // Two larger rows retain the full institutional title and A.D.1911.
 // Plaque front x=-43.05; letters x=-43.10 are 5 cm outward, never buried.
 f=take(f,field(entranceText(vec3<f32>(p.z+18.,p.y,p.x+43.10)),13u,p,1.));}
 // East and railway-facing walls; storage net boundary x44 is separate from service strip.
 let rz=repeatX(p.z-2.,6.,6.);var east=box(p-vec3<f32>(49.75,4.8,0.),vec3<f32>(.25,4.8,40.));east=max(east,-box(vec3<f32>(p.x-49.75,p.y-5.7,rz),vec3<f32>(.8,1.7,.85)));f=take(f,field(shell(east,p),2u,p,3.));
 let gateX=repeatX(p.x-4.,20.,1.);let freightDoor=box(vec3<f32>(gateX,p.y-2.1,p.z-39.75),vec3<f32>(2.5,2.2,1.));var rear=box(p-vec3<f32>(4.,4.8,39.75),vec3<f32>(46.,4.8,.25));rear=max(rear,-freightDoor);f=take(f,field(shell(rear,p),2u,p,3.));
 // Warehouse clear rectangle is 72 x 62.5 m. All partitions lie OUTSIDE it.
 var westPartition=box(p-vec3<f32>(-28.3,3.8,3.25),vec3<f32>(.2,3.8,31.75));westPartition=max(westPartition,-box(vec3<f32>(p.x+28.3,p.y-1.65,repeatX(p.z,20.,1.)),vec3<f32>(1.,1.7,1.75)));f=take(f,field(shell(westPartition,p),1u,p,4.));
 f=take(f,field(shell(box(p-vec3<f32>(8.,4.7,-28.3),vec3<f32>(36.5,4.7,.2)),p),1u,p,4.));
 var rearPartition=box(p-vec3<f32>(8.,3.5,34.8),vec3<f32>(36.5,3.5,.2));rearPartition=max(rearPartition,-box(vec3<f32>(gateX,p.y-1.65,p.z-34.8),vec3<f32>(1.75,1.7,1.)));f=take(f,field(shell(rearPartition,p),1u,p,4.));
 var westFloor=box(p-vec3<f32>(-33.65,5.32,0.),vec3<f32>(5.1,.12,39.4));westFloor=max(westFloor,-box(p-vec3<f32>(-33.7,5.32,-18.),vec3<f32>(5.8,.4,8.4)));westFloor=max(westFloor,-box(p-vec3<f32>(-33.,5.32,30.),vec3<f32>(1.6,.4,5.5)));f=take(f,field(shell(westFloor,p),3u,p,1.));
 f=take(f,field(shell(box(p-vec3<f32>(8.,5.32,-32.4),vec3<f32>(36.4,.12,3.7)),p),3u,p,2.));
 let step=clamp(floor((p.z-25.)/.32),0.,29.);let stair=max(box(p-vec3<f32>(-33.,(step+1.)*.09,25.+(step+.5)*.32),vec3<f32>(1.3,(step+1.)*.09,.16)),box(p-vec3<f32>(-33.,2.8,29.8),vec3<f32>(1.3,2.8,4.8)));f=take(f,field(shell(stair,p),3u,p,1.));
 if(u.options.x<.5){let roofZ=repeatX(p.z-3.25,20.833333,1.);let warehouseRoof=max(abs(p.y-(12.9-abs(roofZ)*.25))-.14,box(p-vec3<f32>(8.,11.,3.25),vec3<f32>(36.6,3.,31.85)));f=take(f,field(warehouseRoof,7u,p,3.));
 let light=max(abs(p.y-(13.45-abs(roofZ)*.43))-.075,box(vec3<f32>(p.x-8.,p.y-13.,roofZ),vec3<f32>(31.,1.5,2.1)));f=take(f,field(light,8u,p,3.));
 var wr=max(abs(p.y-(12.65-abs(p.x+35.2)*.35))-.14,box(p-vec3<f32>(-35.2,11.,0.),vec3<f32>(7.4,3.,40.6)));wr=max(wr,-box(p-tc-vec3<f32>(0.,12.,0.),vec3<f32>(8.,4.,8.5)));f=take(f,field(wr,7u,p,1.));
 let sr=max(abs(p.y-(11.9-abs(p.z+32.5)*.30))-.14,box(p-vec3<f32>(8.,11.,-32.5),vec3<f32>(42.5,2.,4.3)));f=take(f,field(sr,7u,p,2.));
 f=take(f,field(box(p-vec3<f32>(8.,9.7,37.5),vec3<f32>(36.5,.16,3.)),7u,p,2.));f=take(f,field(box(p-vec3<f32>(47.,9.7,3.25),vec3<f32>(3.5,.16,31.8)),7u,p,2.));}
 // Right hall remains connected to unchanged claim gates and real handover surfaces.
 let counterZ=repeatX(p.z+2.6,4.4,4.);f=take(f,field(box(vec3<f32>(p.x+33.,p.y-.65,counterZ),vec3<f32>(.7,.65,1.35)),4u,p.zyx,2.));
 f=take(f,field(box(vec3<f32>(p.x+36.,p.y-.46,counterZ),vec3<f32>(.43,.11,1.2)),4u,p.zyx,3.));
 let deskX=repeatX(p.x-8.,8.,4.);f=take(f,field(box(vec3<f32>(deskX,p.y-.72,p.z+33.5),vec3<f32>(1.35,.12,.7)),4u,p,3.));
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
 f=take(f,field(max(cylinder(p-vec3<f32>(61.,15.,55.),1.8,15.),-cylinder(p-vec3<f32>(61.,16.,55.),1.28,15.)),2u,p,9.));
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
 var f=outsideField(p);f=take(f,architecture(p));
 if(box(p-vec3<f32>(5.5,3.5,2.75),vec3<f32>(31.5,4.,28.))<max(1.,f.d)){f=take(f,rackField(p));}
 f=take(f,machineField(p));
 for(var i=0u;i<u.counts.x;i++){let r=items[i];let q=p-r.position.xyz;let dd=box(q,r.size.xyz)-.025;if(dd<f.d){f=field(dd,4u,q,r.position.w);}}
 if(abs(f.d)<.025&&u.options.z>.5){let envelope=1.-smoothstep(.005,.025,abs(f.d));let grain=br_noise3(f.local*3.+vec3<f32>(f.seed));f.d+=(grain-.5)*.006*f.age*f.wet*envelope;}return f;
}
`;
