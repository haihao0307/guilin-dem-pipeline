// Authored continuous station domain. No component vertex/index buffers.
export const STATION_FIELD_WGSL=String.raw`
struct HitField { d:f32, id:u32, q:vec3<f32>, seed:f32, baseD:f32, extent:vec3<f32>, }
fn box(p:vec3<f32>,b:vec3<f32>)->f32{let q=abs(p)-b;return length(max(q,vec3<f32>(0.)))+min(max(q.x,max(q.y,q.z)),0.);}
fn cyl(p:vec3<f32>,r:f32,h:f32)->f32{let q=vec2<f32>(length(p.xz)-r,abs(p.y)-h);return min(max(q.x,q.y),0.)+length(max(q,vec2<f32>(0.)));}
fn segment(p:vec3<f32>,a:vec3<f32>,b:vec3<f32>,r:f32)->f32{let v=b-a;return length(p-a-v*clamp(dot(p-a,v)/dot(v,v),0.,1.))-r;}
// Candidate list is procedural construction metadata, not geometry vertices.
// A single dynamic material call prevents per-part compiler expansion while all
// candidates receive material displacement BEFORE the final nearest selection.
struct StationCandidates {count:u32,items:array<HitField,80>,}
fn recordPart(list:ptr<function,StationCandidates>,p:vec3<f32>,d:f32,id:u32,q:vec3<f32>,seed:f32){(*list).items[(*list).count]=HitField(d,id,q,seed,d,vec3<f32>(1.));(*list).count+=1u;}
fn recordCoated(list:ptr<function,StationCandidates>,p:vec3<f32>,d:f32,q:vec3<f32>,extent:vec3<f32>,seed:f32){(*list).items[(*list).count]=HitField(d,13u,q,seed,d,extent);(*list).count+=1u;}
fn resolveCandidates(list:ptr<function,StationCandidates>,p:vec3<f32>)->HitField{var h=HitField(10000.,0u,p,0.,10000.,vec3<f32>(1.));let st=resolveStationState(p);for(var i=0u;i<(*list).count;i++){var candidate=(*list).items[i];let d=candidate.d;let id=candidate.id;let native=id==1u||id==2u||id==3u||id==4u||id==12u||id==13u||id==15u||id==17u;if(native&&d-.03<h.d){if(abs(d)<.045){candidate.d=evaluateStationGeometry(candidate,p,st).d;}else{candidate.d=sign(d)*max(abs(d)-.03,0.);}}if(candidate.d<h.d){h=candidate;}}return h;}

fn rep(x:f32,pitch:f32,lo:f32,hi:f32)->f32{return x-clamp(round(x/pitch),lo,hi)*pitch;}
fn archHole(x:f32,y:f32,r:f32,spring:f32)->f32{return max(abs(x)-r,select(y-(spring+r),length(vec2<f32>(x,y-spring))-r,y>spring));}
fn stateWet(p:vec3<f32>)->f32{let drain=1.-smoothstep(.12,.75,abs(rep(p.x,7.5,-4.,4.)));let rain=(1.-smoothstep(7.5,12.,p.y))*smoothstep(.1,.4,p.y);return u.age*.12*(.15+drain*rain)+(1.-smoothstep(.2,1.8,p.y))*.15;}
fn repairAt(p:vec3<f32>)->f32{return .08+.65*(1.-smoothstep(.9,1.4,abs(p.x-15.)))*(1.-smoothstep(1.1,2.2,p.y));}
fn brickQ(p:vec3<f32>,axis:u32,d:f32)->vec3<f32>{let row=floor(p.y/.073);let shift=select(0.,.125,(i32(row)&1)==1);let face=select(p.x,p.z,axis==12u);return vec3<f32>(fract((face+shift)/.25)*.25-.125,fract(p.y/.073)*.073-.0365,.055384615+d);}
fn stationDomain(p:vec3<f32>,skipRoof:bool)->HitField{
 var list:StationCandidates;list.count=0u;
 // Promenade and hall threshold share the platform datum, with real entrance steps.
 recordPart(&list,p,box(p-vec3<f32>(0,.15,0),vec3<f32>(31.2,.7,8.8)),17u,p,1.);
 for(var i=0;i<4;i++){let z=8.9+f32(i)*.4;recordPart(&list,p,box(p-vec3<f32>(0,.55-f32(i)*.18,z),vec3<f32>(4.7,.16,.22)),2u,p,1.);}
 // Long hall, arched openings cut through both external walls. Openings are real air.
 let hallBound=box(p-vec3<f32>(0,7,0),vec3<f32>(31.5,8.2,10.5));
 if(hallBound<2.){
  let bay=rep(p.x,7.5,-3.,3.);let q=vec3<f32>(p.x,p.y-6.4,abs(p.z)-8.);
  var wall=box(q,vec3<f32>(30.,5.55,.32));let opening=archHole(bay,p.y-.85,2.3,6.1);wall=max(wall,-opening);
  recordPart(&list,p,wall,1u,q,19.);
  // The opaque side walls, distinct from the open room interior.
  let side=vec3<f32>(abs(p.x)-30.,p.y-6.4,p.z);recordPart(&list,p,box(side,vec3<f32>(.32,5.55,8.)),12u,side,31.);
  // Original quarry stone binds column body, base, capitals and bands.
  let cx=rep(p.x-3.75,7.5,-4.,3.);let col=vec3<f32>(cx,p.y-5.5,abs(p.z)-8.65);let theta=atan2(col.z,col.x);let flute=.014*(.5+.5*cos(theta*16.));
  recordCoated(&list,p,cyl(col,.43-flute,4.4),col,vec3<f32>(.43,4.4,.43),4.);recordCoated(&list,p,box(vec3<f32>(cx,p.y-1.12,abs(p.z)-8.65),vec3<f32>(.64,.28,.64)),vec3<f32>(cx,p.y-1.12,abs(p.z)-8.65),vec3<f32>(.64,.28,.64),4.);
  recordCoated(&list,p,cyl(vec3<f32>(cx,p.y-10.,abs(p.z)-8.65),.63,.24),vec3<f32>(cx,p.y-10.,abs(p.z)-8.65),vec3<f32>(.63,.24,.63),4.);
  for(var j=0;j<3;j++){let yy=10.3+f32(j)*.31;recordCoated(&list,p,box(vec3<f32>(p.x,p.y-yy,abs(p.z)-8.3),vec3<f32>(30.7,.13,.64)),vec3<f32>(p.x,p.y-yy,abs(p.z)-8.3),vec3<f32>(30.7,.13,.64),4.);}
  recordCoated(&list,p,box(vec3<f32>(p.x,p.y-12.15,abs(p.z)-8.1),vec3<f32>(30.7,.13,.3)),vec3<f32>(p.x,p.y-12.15,abs(p.z)-8.1),vec3<f32>(30.7,.13,.3),4.);
  recordCoated(&list,p,box(vec3<f32>(rep(p.x,.6,-50.,50.),p.y-11.65,abs(p.z)-8.1),vec3<f32>(.07,.4,.19)),vec3<f32>(rep(p.x,.6,-50.,50.),p.y-11.65,abs(p.z)-8.1),vec3<f32>(.07,.4,.19),4.);
  // Ring arches and keystones over every real opening.
  let ar=abs(length(vec2<f32>(bay,p.y-6.95))-2.46)-.15;recordCoated(&list,p,max(max(ar,6.95-p.y),abs(abs(p.z)-8.38)-.24),vec3<f32>(bay,p.y-8.255,abs(p.z)-8.38),vec3<f32>(2.61,1.305,.24),4.);
  recordCoated(&list,p,box(vec3<f32>(bay,p.y-9.6,abs(p.z)-8.5),vec3<f32>(.2,.38,.27)),vec3<f32>(bay,p.y-9.6,abs(p.z)-8.5),vec3<f32>(.2,.38,.27),4.);
  // Pitched hall roof and central pediment are extruded functions, not planes.
  let roof=abs(p.y-(14.3-abs(p.z)*.25))-.07;recordPart(&list,p,max(roof,max(abs(p.x)-30.1,abs(p.z)-8.2)),3u,p,8.);
  let ped=max(abs(p.x)-6.4,max(10.7-p.y,(p.y+abs(p.x)*.53-14.15)/1.14));recordPart(&list,p,max(ped,abs(p.z-8.75)-.35),1u,vec3<f32>(p.x,p.y,1.),22.);
  let rim=abs((p.y+abs(p.x)*.53-14.15)/1.14)-.11;recordCoated(&list,p,max(rim,max(abs(p.x)-6.55,abs(p.z-8.95)-.39)),vec3<f32>(p.x,p.y-12.4,p.z-8.95),vec3<f32>(6.55,2.,.39),4.);
  let oculus=abs(length(vec2<f32>(p.x,p.y-12.5))-.52)-.105;recordCoated(&list,p,max(oculus,abs(p.z-9.15)-.12),vec3<f32>(p.x,p.y-12.5,p.z-9.15),vec3<f32>(.625,.625,.12),4.);
  // Shelter benches sit against room sides, long axial grain preserved.
  let bq=vec3<f32>(rep(p.x,10.,-2.,2.),p.y-1.35,abs(p.z)-4.5);let slat=vec3<f32>(bq.x,bq.y,rep(bq.z,.13,-2.,2.));recordPart(&list,p,box(slat,vec3<f32>(1.8,.045,.051)),4u,bq,39.);
  recordPart(&list,p,box(vec3<f32>(bq.x,rep(bq.y-.5,.13,-2.,2.),bq.z-.33),vec3<f32>(1.8,.048,.039)),4u,bq,39.);
 }
 else{recordPart(&list,p,hallBound,0u,p,0.);}
 // Tower is attached to the sea end of the hall. Clock faces on four sides.
 let tq=p-vec3<f32>(24,0,4);let tb=box(tq-vec3<f32>(0,23,0),vec3<f32>(4.8,23,4.8));
 if(tb<2.){
  let front=abs(tq.z)>abs(tq.x);let fq=select(vec3<f32>(tq.z,tq.y,abs(tq.x)),vec3<f32>(tq.x,tq.y,abs(tq.z)),front);
  var towerCore=box(tq-vec3<f32>(0,17.2,0),vec3<f32>(3.7,16.35,3.7));
  for(var wi=0;wi<2;wi++){let wy=select(22.3,31.,wi==1);let wx=select(fq.x,rep(fq.x,.9,-1.,1.),wi==1);let ww=select(.57,.30,wi==1);let wq=vec3<f32>(wx,fq.y-wy,fq.z-3.7);let hole=box(wq,vec3<f32>(ww,.85,.36));towerCore=max(towerCore,-hole);let frame=max(box(wq-vec3<f32>(0.,0.,.02),vec3<f32>(ww+.11,.97,.13)),-box(wq,vec3<f32>(ww,.85,.3)));recordCoated(&list,p,frame,wq-vec3<f32>(0.,0.,.02),vec3<f32>(ww+.11,.97,.13),84.);recordPart(&list,p,box(wq-vec3<f32>(0.,0.,.002),vec3<f32>(.022,.85,.034)),3u,wq,84.);recordPart(&list,p,box(wq-vec3<f32>(0.,0.,.002),vec3<f32>(ww,.022,.034)),3u,wq,84.);}
  recordPart(&list,p,towerCore,select(1u,12u,abs(tq.x)>abs(tq.z)),tq,71.);
  let corner=vec3<f32>(abs(tq.x)-3.35,tq.y-17.2,abs(tq.z)-3.35);recordCoated(&list,p,box(corner,vec3<f32>(.44,16.35,.44)),corner,vec3<f32>(.44,16.35,.44),5.);
  for(var j=0;j<5;j++){let yy=select(14.+f32(j)*5.,1.3,j==0);recordCoated(&list,p,box(tq-vec3<f32>(0,yy,0),vec3<f32>(3.98,.2,3.98)),tq-vec3<f32>(0,yy,0),vec3<f32>(3.98,.2,3.98),5.);}
  let dial=vec3<f32>(fq.x,fq.y-27.,fq.z-3.76);recordPart(&list,p,max(length(dial.xy)-1.46,abs(dial.z)-.07),7u,dial,0.);
  recordCoated(&list,p,max(abs(length(dial.xy)-1.47)-.085,abs(dial.z-.07)-.045),dial-vec3<f32>(0.,0.,.07),vec3<f32>(1.555,1.555,.045),0.);
  let angle=atan2(dial.y,dial.x);let tick=abs(sin(angle*6.))*length(dial.xy);let ticks=max(max((tick-.045)/6.,1.12-length(dial.xy)),length(dial.xy)-1.34);recordPart(&list,p,max(ticks,abs(dial.z-.1)-.026),8u,dial,0.);
  recordPart(&list,p,segment(dial,vec3<f32>(0.,0.,.13),vec3<f32>(.72,.45,.13),.055),8u,dial,0.);recordPart(&list,p,segment(dial,vec3<f32>(0.,0.,.15),vec3<f32>(-.35,1.03,.15),.035),8u,dial,0.);
  // Open belfry, four pairs of vertical piers. No solid upper box.
  let bq=tq-vec3<f32>(0,36.7,0);recordCoated(&list,p,box(vec3<f32>(abs(bq.x)-2.45,bq.y,abs(bq.z)-2.45),vec3<f32>(.38,3.1,.38)),vec3<f32>(abs(bq.x)-2.45,bq.y,abs(bq.z)-2.45),vec3<f32>(.38,3.1,.38),5.);
  for(var j=0;j<2;j++){recordCoated(&list,p,box(tq-vec3<f32>(0,33.6+f32(j)*6.2,0),vec3<f32>(3.1,.27,3.1)),tq-vec3<f32>(0,33.6+f32(j)*6.2,0),vec3<f32>(3.1,.27,3.1),5.);}
  let dome=tq-vec3<f32>(0,39.85,0);recordCoated(&list,p,max(abs(length(dome)-2.63)-.055,-dome.y),dome-vec3<f32>(0.,1.315,0.),vec3<f32>(2.685,1.37,2.685),4.);
  recordPart(&list,p,cyl(tq-vec3<f32>(0,43.1,0),.07,1.1),3u,tq,4.);
 }
 else{recordPart(&list,p,tb,0u,p,0.);}
 // Three continuous barrel canopies with actual daylight slots and open trusses.
 let shedBox=box(p-vec3<f32>(0,7,-55),vec3<f32>(34,8,47.2));
 if(shedBox<2.){
  let xi=clamp(round(p.x/20.),-1.,1.);let x=p.x-xi*20.;let z=rep(p.z+10.,7.5,-12.,0.);let radial=length(vec2<f32>(x,p.y-1.2));let bounded=max(max(abs(x)-10.,abs(p.z+55.)-45.),9.-p.y);
  var panel=max(abs(radial-12.8)-.055,bounded);panel=max(panel,.55-abs(x));if(!skipRoof){recordPart(&list,p,panel,15u,vec3<f32>(x,p.y,p.z),55.+xi);}
  for(var j=0;j<2;j++){let r=12.8-f32(j)*.5;recordPart(&list,p,max(max(abs(radial-r)-.08,bounded),abs(z)-.11),3u,p,52.);}
  let a=atan2(x,p.y-1.2);let web=abs(sin(a*16.))*radial;recordPart(&list,p,max(max(max((web-.034)/16.,abs(radial-12.55)-.24),abs(z)-.055),bounded),3u,p,52.);
  let support=rep(p.x-10.,20.,-2.,1.);let cq=vec3<f32>(support,p.y-5.,z);recordPart(&list,p,cyl(cq,.20-.009*cos(atan2(cq.z,cq.x)*12.),4.15),3u,cq,56.);
  recordPart(&list,p,box(vec3<f32>(support,p.y-1.05,z),vec3<f32>(.42,.2,.42)),3u,cq,56.);recordPart(&list,p,cyl(vec3<f32>(support,p.y-8.93,z),.43,.2),3u,cq,56.);
  recordPart(&list,p,box(vec3<f32>(support,p.y-9.25,p.z+55.),vec3<f32>(.13,.17,45.)),3u,p,56.);
  // Four islands, mineral copings, with twin steel rails and actual sleeper gaps.
  let pq=vec3<f32>(support,p.y-.35,p.z+55.);recordPart(&list,p,box(pq,vec3<f32>(3.4,.5,46.3)),17u,pq,77.);
  let coping=vec3<f32>(abs(support)-3.23,p.y-.84,rep(p.z,1.2,-84.,-7.));recordPart(&list,p,box(coping,vec3<f32>(.18,.07,.595)),2u,coping,79.);
  let railX=rep(p.x-5.,10.,-3.,2.);let rail=vec3<f32>(abs(railX)-.7175,p.y-.02,p.z+62.);recordPart(&list,p,box(rail,vec3<f32>(.034,.066,54.)),3u,rail,55.);
  recordPart(&list,p,box(vec3<f32>(railX,p.y+.11,rep(p.z,.65,-175.,-13.)),vec3<f32>(1.23,.055,.13)),4u,vec3<f32>(railX,p.y+.11,p.z),30.);
  let bz=rep(p.z+13.75,22.5,-3.,0.);let bq=vec3<f32>(support,p.y-1.35,bz);recordPart(&list,p,box(vec3<f32>(rep(bq.x,.13,-2.,2.),bq.y,bq.z),vec3<f32>(.05,.04,1.7)),4u,bq.zxy,38.);
  recordPart(&list,p,box(vec3<f32>(bq.x+.32,rep(bq.y-.5,.13,-2.,2.),bq.z),vec3<f32>(.04,.048,1.7)),4u,bq.zxy,38.);
  recordPart(&list,p,box(vec3<f32>(bq.x,p.y-1.08,abs(bq.z)-1.15),vec3<f32>(.3,.28,.045)),3u,bq,38.);
  // Signboard and hanging lamp remain physical authored objects.
  recordPart(&list,p,box(vec3<f32>(support,p.y-3.5,z+.3),vec3<f32>(.78,.31,.035)),9u,p,2.);
  recordPart(&list,p,cyl(vec3<f32>(support+.65,p.y-4.9,z),.025,.5),3u,p,2.);recordPart(&list,p,cyl(vec3<f32>(support+.65,p.y-4.39,z),.20,.065),7u,p,2.);
 }
 else{recordPart(&list,p,shedBox,0u,p,0.);}
 // Landward running tracks continue outside the train shed.
 if(p.z< -100.){let x=rep(p.x-5.,10.,-3.,2.);recordPart(&list,p,box(vec3<f32>(abs(x)-.7175,p.y-.02,p.z+146.),vec3<f32>(.034,.066,46.)),3u,p,55.);recordPart(&list,p,box(vec3<f32>(x,p.y+.11,rep(p.z,.65,-295.,-153.)),vec3<f32>(1.23,.055,.13)),4u,vec3<f32>(x,p.y+.11,p.z),30.);}
 // Stone quay and sea occupy distinct domains; no cropped station island.
 recordPart(&list,p,box(p-vec3<f32>(0,-.65,26.),vec3<f32>(150.,.43,1.2)),2u,p,82.);

 return resolveCandidates(&list,p);
}
// Every native component receives physical matter BEFORE the union chooses the
// nearest member. This prevents a farther coating being skipped behind a nearer
// nominal core. No later geometric shell or second coplanar surface is emitted.
fn stationField(p:vec3<f32>)->HitField{return stationDomain(p,false);}
`;
