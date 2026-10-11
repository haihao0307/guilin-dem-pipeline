/** A whole building, queried as one bounded coordinate field.
 * Repetition resolves nearest local cells. There is no object/instance list. */
export const SCENE = Object.freeze({version:'bureau-r03-field-01',units:'metres',building:[72,64],oldBuilding:[44,38],hall:[72,12],warehouse:[72,42],receiving:[72,10],rows:16,bays:20,levels:6,regularSlots:2400,smallSlots:8640,capacityIs:'mixed-size addresses, not actual inventory',date:'1976-07-01',fiction:true});
export const DOMAIN = String.raw`
struct Field { d:f32, mat:u32, local:vec3<f32>, seed:f32, age:f32, wet:f32 };
fn box(p:vec3<f32>,b:vec3<f32>)->f32 {let q=abs(p)-b;return length(max(q,vec3<f32>(0.)))+min(max(q.x,max(q.y,q.z)),0.);}
fn cylinder(p:vec3<f32>,r:f32,h:f32)->f32 {let q=vec2<f32>(length(p.xz)-r,abs(p.y)-h);return min(max(q.x,q.y),0.)+length(max(q,vec2<f32>(0.)));}
fn capsule(p:vec3<f32>,a:vec3<f32>,b:vec3<f32>,r:f32)->f32 {let q=p-a;let v=b-a;return length(q-v*clamp(dot(q,v)/dot(v,v),0.,1.))-r;}
fn shell(d:f32,p:vec3<f32>)->f32 {if(u.options.x>.5){return max(d,p.y-select(1.1,4.6,u.options.x>1.5));}return d;}
fn field(d:f32,mat:u32,p:vec3<f32>,seed:f32)->Field {let rain=(1.-smoothstep(.15,.8,abs(fract((p.x+2.)/8.)-.5)*8.))*(.25+.75*smoothstep(0.,9.,p.y));let damp=(1.-smoothstep(.1,1.6,p.y))*.55;return Field(d,mat,p,seed,u.options.y,clamp(.10+rain*.45+damp,0.,1.));}
fn take(a:Field,b:Field)->Field {if(b.d<a.d){return b;}return a;}
fn repeatX(x:f32,pitch:f32,limit:f32)->f32 {return x-clamp(round(x/pitch),-limit,limit)*pitch;}
fn opening(p:vec3<f32>,w:f32,h:f32,depth:f32)->f32 {return min(box(p-vec3<f32>(0.,-.3,0.),vec3<f32>(w,h-.3,depth)),cylinder(p.xzy-vec3<f32>(0.,0.,h-.6),w,depth));}
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
 var f=field(box(p-vec3<f32>(0.,-.24,0.),vec3<f32>(36.5,.24,32.5)),3u,p,1.);
 // Three metres of street-facing arcade are part of the 72 x 64 footprint.
 let x=repeatX(p.x,4.4,7.);let bay=floor(p.x/4.4+.5);
 var front=box(p-vec3<f32>(0.,5.,-28.8),vec3<f32>(36.,5.,.42));
 let lowWindow=box(vec3<f32>(x,p.y-2.5,p.z+28.8),vec3<f32>(.83,1.55,.9));
 let highWindow=box(vec3<f32>(x,p.y-7.1,p.z+28.8),vec3<f32>(.68,1.25,.9));
 let door=box(p-vec3<f32>(0.,1.65,-28.8),vec3<f32>(2.2,1.7,1.));front=max(front,-min(door,min(lowWindow,highWindow)));
 f=take(f,field(shell(front,p),1u,p,bay));
 if(u.options.x<.5){f=take(f,field(box(p-vec3<f32>(0.,10.25,-29.63),vec3<f32>(6.6,.58,.13)),12u,p,1.));f=take(f,field(entranceText(p),13u,p,1.));}
 let windowFrame=max(box(vec3<f32>(x,p.y-7.1,p.z+29.26),vec3<f32>(.82,1.41,.16)),-box(vec3<f32>(x,p.y-7.1,p.z+29.26),vec3<f32>(.65,1.24,.3)));
 f=take(f,field(shell(windowFrame,p),3u,p,1.));
 // Recessed dark glass is a material surface; it is not an image texture.
 f=take(f,field(shell(box(vec3<f32>(x,p.y-7.1,p.z+28.83),vec3<f32>(.65,1.24,.025)),p),8u,p,1.));
 let mullion=min(box(vec3<f32>(x,p.y-7.1,p.z+29.),vec3<f32>(.045,1.25,.07)),box(vec3<f32>(x,p.y-7.1,p.z+29.),vec3<f32>(.7,.05,.07)));
 f=take(f,field(shell(mullion,p),5u,p,1.));
 // Front long colonnade, bases and capitals retain human-scale dimensions.
 let cx=repeatX(p.x-2.2,4.4,7.);var column=cylinder(vec3<f32>(cx,p.y-2.35,p.z+31.35),.28,2.2);
 column=min(column,box(vec3<f32>(cx,p.y-.24,p.z+31.35),vec3<f32>(.43,.24,.43)));
 column=min(column,box(vec3<f32>(cx,p.y-4.5,p.z+31.35),vec3<f32>(.43,.18,.43)));
 f=take(f,field(shell(column,p),3u,p,1.));
 let ledges=min(box(p-vec3<f32>(0.,4.9,-30.15),vec3<f32>(36.4,.28,1.95)),min(box(p-vec3<f32>(0.,9.8,-29.),vec3<f32>(36.4,.23,.78)),box(p-vec3<f32>(0.,.35,-29.2),vec3<f32>(36.2,.22,.7))));
 f=take(f,field(shell(ledges,p),3u,p,1.));
 let upperPilaster=box(vec3<f32>(cx,p.y-7.35,p.z+29.36),vec3<f32>(.22,2.25,.22));
 f=take(f,field(shell(upperPilaster,p),3u,p,1.));
 // Side and rear warehouse walls have real tall openings.
 let wz=repeatX(p.z-1.,6.,4.);var sides=min(box(vec3<f32>(abs(p.x)-35.75,p.y-4.8,p.z-1.6),vec3<f32>(.25,4.8,30.4)),box(p-vec3<f32>(0.,4.8,31.75),vec3<f32>(36.,4.8,.25)));
 sides=max(sides,-box(vec3<f32>(abs(p.x)-36.,p.y-5.5,wz),vec3<f32>(1.,1.8,.85)));
 sides=max(sides,-box(p-vec3<f32>(15.,2.1,31.8),vec3<f32>(3.4,2.2,1.)));
 sides=max(sides,-box(p-vec3<f32>(-15.,2.1,31.8),vec3<f32>(3.4,2.2,1.)));
 f=take(f,field(shell(sides,p),2u,p,3.));
 // Hall / warehouse and receiving / warehouse partitions with controlled gates.
 let part=min(box(p-vec3<f32>(0.,3.,-20.),vec3<f32>(35.6,3.,.2)),box(p-vec3<f32>(0.,3.,22.),vec3<f32>(35.6,3.,.2)));
 let gate=box(vec3<f32>(repeatX(p.x,16.,2.),p.y-1.6,p.z),vec3<f32>(1.75,1.7,45.));
 f=take(f,field(shell(max(part,-gate),p),1u,p,4.));
 // Three pitched roofs, repeated by coordinates, with raised glazed roof lights.
 if(u.options.x<.5){let rx=repeatX(p.x,24.,1.);let roofY=12.5-abs(rx)*.24;let roof=max(abs(p.y-roofY)-.13,box(p-vec3<f32>(0.,10.,6.),vec3<f32>(36.7,4.,26.8)));
 f=take(f,field(roof,7u,p,1.));
 let skyroof=max(abs(p.y-(13.05-abs(rx)*.42))-.07,box(vec3<f32>(rx,p.y-12.75,p.z-1.),vec3<f32>(2.2,1.5,19.)));
 f=take(f,field(skyroof,8u,p,1.));
 let frontRoof=max(abs(p.y-(12.2-abs(p.z+25.)*.3))-.14,box(p-vec3<f32>(0.,11.,-25.),vec3<f32>(36.7,2.,6.4)));
 f=take(f,field(frontRoof,7u,p,2.));}
 // Internal roof trusses: one nearest 6 m bay plus chord/strut distance fields.
 if(u.options.x<.5||u.options.x>1.5){let tz=repeatX(p.z-1.,6.,4.);let rx=repeatX(p.x,24.,1.);let bounds=box(p-vec3<f32>(0.,10.,1.),vec3<f32>(35.5,3.,24.));
 var truss=box(vec3<f32>(p.x,p.y-9.3,tz),vec3<f32>(35.5,.09,.085));
 truss=min(truss,max(abs(p.y-(12.1-abs(rx)*.24))-.08,abs(tz)-.09));
 let sx=repeatX(rx,3.,4.);truss=min(truss,box(vec3<f32>(sx,p.y-10.3,tz),vec3<f32>(.07,1.,.07)));
 f=take(f,field(max(truss,bounds),5u,p,1.));}
 // Public counters and benches are separate from the public lost-property window.
 let counterX=repeatX(p.x,10.,2.);var counter=box(vec3<f32>(counterX,p.y-.65,p.z+22.5),vec3<f32>(3.,.65,.7));
 f=take(f,field(counter,4u,vec3<f32>(p.x,p.z,p.y),1.));
 let benchX=repeatX(p.x,9.,3.);f=take(f,field(box(vec3<f32>(benchX,p.y-.46,p.z+26.),vec3<f32>(1.6,.11,.42)),4u,p,2.));
 return f;
}
fn rackField(p:vec3<f32>)->Field {
 let row=clamp(round((p.x+31.5)/4.2),0.,15.);let rx=p.x-(-31.5+row*4.2);let bz=clamp(floor((p.z+14.)/1.2),0.,19.);let qz=p.z-(-14.+(bz+.5)*1.2);
 let level=clamp(round((p.y-.3)/1.15),0.,5.);let ly=p.y-(.3+level*1.15);
 let bound=box(p-vec3<f32>(-31.5+row*4.2,3.28,-2.),vec3<f32>(.96,3.38,12.05));
 var d=min(box(vec3<f32>(abs(rx)-.90,p.y-3.28,abs(qz)-.55),vec3<f32>(.045,3.38,.045)),box(vec3<f32>(rx,ly,p.z+2.),vec3<f32>(.96,.045,12.05)));
 // Subdividers in the six small-item rows only; not 8,640 separate objects.
 if(row>9.5){let sz=repeatX(qz,.4,1.);d=min(d,box(vec3<f32>(rx,p.y-3.3,sz),vec3<f32>(.90,3.3,.018)));let halfLevel=p.y-(.3+clamp(round((p.y-.3)/.575),0.,11.)*.575);d=min(d,box(vec3<f32>(rx,halfLevel,p.z+2.),vec3<f32>(.9,.018,12.)));}
 return field(max(d,bound),5u,vec3<f32>(rx,p.y,qz),row);
}
fn machineField(p:vec3<f32>)->Field {
 // Boiler house is outside the measured main footprint, on the freight side.
 var f=field(box(p-vec3<f32>(44.,-.15,23.),vec3<f32>(6.3,.15,9.3)),3u,p,1.);
 var house=max(box(p-vec3<f32>(44.,3.2,23.),vec3<f32>(6.,3.2,9.)),-box(p-vec3<f32>(44.,3.4,23.),vec3<f32>(5.6,3.3,8.6)));
 house=max(house,-box(p-vec3<f32>(44.,1.7,14.),vec3<f32>(1.5,1.8,1.)));
 f=take(f,field(shell(house,p),2u,p,7.));
 if(u.options.x<.5){f=take(f,field(box(p-vec3<f32>(44.,6.5,23.),vec3<f32>(6.3,.18,9.3)),7u,p,1.));}
 let chimney=cylinder(p-vec3<f32>(49.,9.,30.),1.,9.);f=take(f,field(chimney,2u,p,9.));
 let boiler=cylinder((p-vec3<f32>(43.,2.2,24.)).xzy,1.45,3.5);f=take(f,field(boiler,5u,p,8.));
 let fire=box(p-vec3<f32>(43.,1.2,20.45),vec3<f32>(.7,.6,.045));f=take(f,field(fire,11u,p,1.));
 // A continuous supply header connects boiler -> warehouse line -> hall drive.
 var pipe=capsule(p,vec3<f32>(43.,4.1,22.),vec3<f32>(34.,4.1,22.),.18);
 pipe=min(pipe,capsule(p,vec3<f32>(34.,4.1,22.),vec3<f32>(34.,4.1,-18.),.18));
 pipe=min(pipe,capsule(p,vec3<f32>(34.,4.1,-18.),vec3<f32>(0.,4.1,-18.),.18));
 pipe=min(pipe,capsule(p,vec3<f32>(0.,4.1,-18.),vec3<f32>(0.,1.45,-18.),.18));
 pipe=min(pipe,capsule(p,vec3<f32>(34.,4.1,22.),vec3<f32>(15.,4.1,22.),.12));
 pipe=min(pipe,capsule(p,vec3<f32>(15.,4.1,22.),vec3<f32>(15.,4.1,27.),.12));
 pipe=min(pipe,capsule(p,vec3<f32>(15.,4.1,27.),vec3<f32>(15.,.65,27.),.12));
 pipe=min(pipe,capsule(p,vec3<f32>(34.,4.1,17.),vec3<f32>(34.,1.45,17.),.12));
 pipe=min(pipe,capsule(p,vec3<f32>(34.,1.45,17.),vec3<f32>(31.7,1.45,17.),.12));
 f=take(f,field(pipe,9u,p,1.));
 // Separate lower condensate return and feedwater tank; no disconnected pipes.
 var ret=capsule(p,vec3<f32>(0.,.65,-18.),vec3<f32>(33.,.65,-18.),.11);
 ret=min(ret,capsule(p,vec3<f32>(33.,.65,-18.),vec3<f32>(33.,.65,25.),.11));
 ret=min(ret,capsule(p,vec3<f32>(33.,.65,25.),vec3<f32>(43.,.65,25.),.11));
 ret=min(ret,capsule(p,vec3<f32>(15.,.65,27.),vec3<f32>(33.,.65,27.),.09));
 ret=min(ret,capsule(p,vec3<f32>(33.,.65,27.),vec3<f32>(33.,.65,25.),.09));
 ret=min(ret,capsule(p,vec3<f32>(31.7,.65,17.),vec3<f32>(33.,.65,17.),.09));
 f=take(f,field(ret,5u,p,1.));
 // Working cross conveyor: phase comes from the same persisted world clock.
 f=take(f,field(cylinder((p-vec3<f32>(32.,1.15,17.)).yxz,.37,.65),5u,p,4.));
 let conveyorBounds=box(p-vec3<f32>(0.,1.05,17.),vec3<f32>(31.5,.18,.65));
 f=take(f,field(conveyorBounds,5u,p,4.));
 let slatX=repeatX(p.x-u.clock.x*.4,.55,60.);let slats=max(box(vec3<f32>(slatX,p.y-1.24,p.z-17.),vec3<f32>(.20,.065,.61)),box(p-vec3<f32>(0.,1.25,17.),vec3<f32>(31.5,.2,.65)));
 f=take(f,field(slats,4u,p,2.));
 // Reciprocating drive and one limited handling arm have causal steam input.
 let phase=u.clock.x*1.8*u.clock.y;let wheelP=p-vec3<f32>(0.,1.45,-18.);let wheel=length(vec2<f32>(length(wheelP.xy)-.8,wheelP.z))-.095;
 f=take(f,field(wheel,5u,p,2.));
 let crank=vec3<f32>(.65*cos(phase),1.45+.65*sin(phase),-18.);
 f=take(f,field(capsule(p,crank,vec3<f32>(2.5,1.45,-18.),.07),9u,p,2.));
 f=take(f,field(box(p-vec3<f32>(2.8,1.45,-18.),vec3<f32>(.55,.25,.3)),5u,p,2.));
 let armBase=vec3<f32>(15.,.3,27.);let elbow=vec3<f32>(15.,3.4,27.);let hand=vec3<f32>(15.+2.*sin(phase*.25),2.2,24.6);
 f=take(f,field(capsule(p,armBase,elbow,.18),5u,p,3.));f=take(f,field(capsule(p,elbow,hand,.14),9u,p,3.));
 f=take(f,field(box(p-hand,vec3<f32>(.43,.13,.32)),5u,p,3.));
 return f;
}
fn outsideField(p:vec3<f32>)->Field {
 var f=field(box(p-vec3<f32>(0.,-.45,0.),vec3<f32>(85.,.2,63.)),10u,p,1.);
 // Front pavement and street; rear loading platform and two rail tracks.
 f=take(f,field(box(p-vec3<f32>(0.,-.10,-37.),vec3<f32>(41.,.1,4.)),3u,p,1.));
 f=take(f,field(box(p-vec3<f32>(0.,-.02,35.2),vec3<f32>(38.,.25,3.2)),3u,p,1.));
 let trackZ=39.+round(clamp((p.z-39.)/5.,0.,1.))*5.;let railDist=abs(abs(p.z-trackZ)-.72);
 f=take(f,field(box(vec3<f32>(p.x,p.y-.05,railDist),vec3<f32>(70.,.10,.07)),5u,p,1.));
 let tx=repeatX(p.x,.85,82.);f=take(f,field(box(vec3<f32>(tx,p.y+.14,p.z-trackZ),vec3<f32>(.16,.13,1.1)),4u,p,5.));
 // Two static freight wagons at rear. Their world placement is analytic too.
 let wx=repeatX(p.x-13.,13.,1.);let wagon=box(vec3<f32>(wx,p.y-1.9,p.z-44.),vec3<f32>(5.5,1.4,1.25));
 f=take(f,field(wagon,4u,p,8.));
 let wz=p.z-44.;let axle=repeatX(wx,7.,1.);f=take(f,field(cylinder(vec3<f32>(axle,wz,p.y-.55),.48,1.3),5u,p,9.));
 return f;
}
fn sceneField(p:vec3<f32>)->Field {
 var f=outsideField(p);f=take(f,architecture(p));
 if(box(p-vec3<f32>(0.,3.5,-2.),vec3<f32>(34.,4.,13.))<max(1.,f.d)){f=take(f,rackField(p));}
 if(box(p-vec3<f32>(15.,8.,6.),vec3<f32>(36.,11.,31.))<max(1.,f.d)){f=take(f,machineField(p));}
 // Only actual logical items are uploaded: positions and sizes, never vertices.
 for(var i=0u;i<u.counts.x;i++){let r=items[i];let q=p-r.position.xyz;let dd=box(q,r.size.xyz)-.025;if(dd<f.d){f=field(dd,4u,q,r.position.w);}}
 // Material-dependent physical loss is part of the same field, with a bounded
 // 4 mm relief. Local noise cannot make traversal skip the conservative shell.
 if(abs(f.d)<.025&&u.options.z>.5){let grain=br_noise3(f.local*3.+vec3<f32>(f.seed));f.d+=(grain-.5)*.006*f.age*f.wet;}
 return f;
}
`;
