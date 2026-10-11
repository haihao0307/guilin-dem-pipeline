// Original metre-scale accreted building. Shared topology precedes appearance.
// Dimensions are designed, never measured from the user's section drawings.
export function makeBuildingRecipe({seed=198107,levels=10,detailedLevels=[0,1,2,9]}={}){
 if(!Number.isInteger(levels)||levels<4||levels>12)throw Error('4..12 whole levels required');
 const detailed=detailedLevels.filter(x=>Number.isInteger(x)&&x>=0&&x<levels),H=2.75,half=H/2,upperBorrowLevel=Math.min(7,levels-1);
 const p={schema:'walled-building/2',levelCount:levels,detailedLevels:detailed,seed,units:[],walls:[],wood:[],metal:[],floors:[],doors:[],nodes:[],edges:[],systems:[],activities:[],phases:[],notHistoricalReconstruction:true,declaredOmissions:['No unvalidated residents, garments or bedding','Designed dimensions; structural/fire certification not claimed','Shared services are connected geometry, not thermodynamic or hydraulic simulation'],sourcePolicy:{brick:'R3.12 source field/templates',wood:'Library v3 original kernel',metal:'Existing FH88 material closure'}};
 const wood=(id,size,position,group='furniture',rotation=[0,0,0])=>p.wood.push({id,size,position,rotation,group,presetId:'yunnan_light_weathered_v2',seed});
 const metal=(id,kind,data,role='iron',color='#566258',group='services')=>p.metal.push({id,kind,...data,role,color,group});
 const floor=(id,box,y,material='wood',thickness=.1)=>p.floors.push({id,x0:box[0],z0:box[1],x1:box[2],z1:box[3],y,thickness,material});
 const node=(id,at)=>p.nodes.push({id,at});
 const edge=(from,to,points,door=null)=>p.edges.push({from,to,points,door,minWidth:door?.88:.94,minHeight:2.04});
 function rail(id,A,B,y){metal(id,'pipe',{points:[[A[0],y,A[1]],[B[0],y,B[1]]],radius:.018});const n=Math.ceil(Math.hypot(A[0]-B[0],A[1]-B[1])/.48);for(let i=0;i<=n;i++){const x=A[0]+(B[0]-A[0])*i/n,z=A[1]+(B[1]-A[1])*i/n;metal(id+'-post'+i,'pipe',{points:[[x,y-.98,z],[x,y,z]],radius:.011});}}
 function table(id,x,y,z,length=1){wood(id+'-top',[length,.055,.56],[x,y+.72,z]);for(const a of [-length/2+.065,length/2-.065])for(const b of [-.22,.22])wood(id+'-leg'+a+b,[.045,.69,.045],[x+a,y+.345,z+b]);}
 const uses=[['小修理作坊','街边杂货店'],['家庭住户','诊所与候诊'],['家庭住户','借道住户'],['家庭住户','家庭住户'],['家庭住户','小修理作坊'],['家庭住户','家庭住户'],['家庭住户','家庭住户'],['家庭住户','家庭住户'],['家庭住户','家庭住户'],['家庭住户','屋顶管理员住户'],['家庭住户','家庭住户'],['家庭住户','家庭住户']];
 const W=[[-5.55,-4.65,-1.25,.55],[-5.90,-4.35,-1.25,.18],[-5.40,-4.90,-1.25,.86],[-5.62,-4.30,-1.25,.15]],E=[[1.25,-5.0,5.30,-.15],[1.25,-4.60,4.98,.68],[1.25,-5.15,5.65,.30],[1.25,-4.50,5.08,.85]];
 function addUnit({id,level,building,box,y,use,isDetailed=false,entrySide,entryCenter,entryId=id+'-entry',entryNode=id+'-home',shared=false}){
  const [x0,z0,x1,z1]=box,cx=(x0+x1)/2,cz=(z0+z1)/2,u={id,level,building,box,floor:y,height:2.60,use,detailed:isDetailed,shared,phase:Math.floor(level/3)};p.units.push(u);floor(id+'-floor',box,y,shared||level===0?'mortar':'wood');node(entryNode,[cx,y,cz]);
  for(const side of ['front','back','left','right']){
   const alongX=side==='front'||side==='back',start=alongX?x0:z0,end=alongX?x1:z1,fixed=side==='front'?z1:side==='back'?z0:side==='left'?x0:x1,openings=[];
   if(side===entrySide)openings.push({id:entryId,kind:'door',center:entryCenter,width:1.12,height:2.18,bottom:0});
   if(id==='W0'&&side==='front')openings.push({id:'ground-street-entry',kind:'door',center:-2.20,width:1.12,height:2.18,bottom:0});
   if(id==='S0'&&side==='back')openings.push({id:'ground-rear-entry',kind:'door',center:.35,width:1.12,height:2.18,bottom:0});
   if(!shared&&side==='front'){const center=cx+(building==='E'?.75:-.48),width=level%3===1?.86:1.10;openings.push({id:id+'-window',kind:'window',center,width,height:level%3===0?1.04:.88,bottom:level%3===0?1.0:1.15});}
   if(!shared&&side===(building==='W'?'left':'right'))openings.push({id:id+'-side-window',kind:'window',center:cz-.35,width:.80,height:.86,bottom:1.1});
   if(shared&&id!=='S0'&&side==='back')openings.push({id:id+'-vent',kind:'window',center:0,width:.64,height:.45,bottom:1.75});
   if(id==='W2'&&side==='back')openings.push({id:'borrowed-gate',kind:'door',center:-2.2,width:1.12,height:2.18,bottom:0});
   if(id==='W'+upperBorrowLevel&&side==='back')openings.push({id:'upper-borrowed-gate',kind:'door',center:-2.2,width:1.12,height:2.18,bottom:0});
   if(id==='E'+upperBorrowLevel&&side==='back')openings.push({id:'upper-borrowed-receiver',kind:'door',center:2.2,width:1.12,height:2.18,bottom:0});
   const w={id:id+'-'+side,unit:id,side,alongX,start,end,fixed,bottom:y,height:u.height,openings,group:id+'-walls'};p.walls.push(w);
   for(const o of openings){const at=(q,h=0,d=0)=>alongX?[q,y+h,fixed+d]:[fixed+d,y+h,q],rot=alongX?[0,0,0]:[0,Math.PI/2,0];
    for(const s of [-1,1])wood(o.id+'-frame'+s,[.12,o.height,.17],at(o.center+s*(o.width/2-.06),o.bottom+o.height/2),'frames',rot);wood(o.id+'-lintel',[o.width,.12,.17],at(o.center,o.bottom+o.height-.06),'frames',rot);
    if(o.kind==='door'&&id!=='E2'&&o.id!=='upper-borrowed-receiver')p.doors.push({id:o.id,wallId:w.id,hinge:at(o.center-o.width/2+.12,o.bottom),yaw:alongX?0:-Math.PI/2,width:.88,height:2.06,open:true,borrowed:o.id==='borrowed-gate'});
    else if(o.kind==='window'){wood(o.id+'-sill',[o.width,.10,.27],at(o.center,o.bottom+.02),'frames',rot);const out=side==='front'||side==='right'?.26:-.26;
     for(let j=0;j<5;j++){const q=o.center-o.width*.40+j*o.width*.20;metal(o.id+'-bar'+j,'pipe',{points:[at(q,o.bottom+.08,out),at(q,o.bottom+o.height-.08,out)],radius:.009},'iron','#4d5c50','window-cages');}
     for(const h of [o.bottom+.08,o.bottom+o.height-.08])metal(o.id+'-rail'+h,'pipe',{points:[at(o.center-o.width*.4,h),at(o.center-o.width*.4,h,out),at(o.center+o.width*.4,h,out),at(o.center+o.width*.4,h)],radius:.012},'iron','#4d5c50','window-cages');
    }
   }
  }
  if(isDetailed){table(id+'-table',cx,y,z0+(shared?.50:.72),shared?.8:1.05);if(use.includes('住户')){wood(id+'-bed-base',[1.05,.10,1.88],[x0+.70,y+.41,z0+1.12]);for(const a of [-.48,.48])for(const b of [-.84,.84])wood(id+'-bed-post'+a+b,[.06,.68,.06],[x0+.70+a,y+.34,z0+1.12+b]);wood(id+'-bed-head',[1.05,.32,.06],[x0+.70,y+.62,z0+.19]);}
   for(let k=0;k<3;k++){wood(id+'-shelf'+k,[.78,.04,.28],[x1-.5,y+.5+k*.38,z0+.20]);for(let j=0;j<2;j++)metal(id+'-tin'+k+j,'cylinder',{radius:.064,height:.14,position:[x1-.75+j*.35,y+.60+k*.38,z0+.22]},'steel',j?'#89907f':'#656e64','objects');}
   metal(id+'-basin','bowl',{radius:.16,height:.13,position:[cx,y+.76,z0+(shared?.48:.70)]},'paint','#b7c4b5','objects');
   if(use.includes('作坊'))for(let k=0;k<3;k++){wood(id+'-tool'+k,[.18,.03,.03],[cx-.35+k*.30,y+.76,z0+.78]);metal(id+'-tool-shaft'+k,'pipe',{points:[[cx-.26+k*.30,y+.75,z0+.78],[cx-.06+k*.30,y+.75,z0+.78]],radius:.005},'steel','#9ba79d','objects');}}
  p.activities.push({unit:id,role:use,openHour:use.includes('店')?7:use.includes('诊所')?9:0,closeHour:use.includes('店')?22:use.includes('诊所')?19:24});
  metal(id+'-window-light','box',{size:[.25,.18,.05],position:[cx,y+1.50,z1-.08]},'light','#dfc08a','night-lights');return u;
 }
 node('street',[0,.04,4.8]);floor('ground',[-6.4,-7.7,6.15,5.5],0,'mortar');
 for(let l=0;l<levels;l++){
  const y=.04+l*H,band=Math.min(3,Math.floor(l/3)),wbox=W[band],ebox=E[band];
  const w=addUnit({id:'W'+l,level:l,building:'W',box:wbox,y,use:uses[l][0],isDetailed:detailed.includes(l),entrySide:'right',entryCenter:-.50});
  const e=addUnit({id:'E'+l,level:l,building:'E',box:ebox,y:y+half,use:uses[l][1],isDetailed:detailed.includes(l),entrySide:l===2?'back':'front',entryCenter:l===2?2.20:2.0});
  const s=addUnit({id:'S'+l,level:l,building:'S',box:[-1.20,-5.55,1.20,-3.15],y,use:l===0?'锅炉检修间':l%2?'共享厨房':'共享洗涤间',isDetailed:true,entrySide:'front',entryCenter:0,shared:true});
  node('landing-'+l,[-.58,y,-.10]);node('half-'+l,[.58,y+half,2.65]);floor('landing-floor-'+l,[-1.18,-.90,1.18,.50],y);floor('service-passage-'+l,[-.55,-3.2,.55,-.85],y,'mortar');if(wbox[3]<.50)rail('landing-west-edge-'+l,[-1.18,wbox[3]],[-1.18,.50],y+1.02);if(ebox[3]<.50)rail('landing-east-edge-'+l,[1.18,ebox[3]],[1.18,.50],y+1.02);for(const xx of [-.55,.55])rail('service-walk-guard-'+l,[xx,-3.15],[xx,-.90],y+1.02);
  edge('landing-'+l,'W'+l+'-home',[[-.58,y,-.10],[-.58,y,-.50],[-1.85,y,-.50],[(wbox[0]+wbox[2])/2,y,-.50],[(wbox[0]+wbox[2])/2,y,(wbox[1]+wbox[3])/2]],'W'+l+'-entry');
  edge('landing-'+l,'S'+l+'-home',[[-.58,y,-.10],[0,y,-.55],[0,y,-3.75],[0,y,-4.35]],'S'+l+'-entry');
  if(l===0){edge('street','W0-home',[[0,.04,4.8],[-2.20,.04,4.8],[-2.20,.04,-.45],[-3.40,.04,-2.05]],'ground-street-entry');edge('street','S0-home',[[0,.04,4.8],[5.95,.04,4.8],[5.95,.04,-7.5],[.35,.04,-7.5],[.35,.04,-4.35],[0,.04,-4.35]],'ground-rear-entry');}
  // E half-level balcony leaves the main landing opening unobstructed.
  const front=ebox[3];floor('E-balcony-'+l,[1.18,front,ebox[2],2.95],y+half);floor('half-platform-'+l,[-1.18,2.40,1.25,3.20],y+half);
  rail('E-balcony-front-'+l,[1.25,2.95],[ebox[2],2.95],y+half+1.02);rail('E-balcony-east-'+l,[ebox[2],front],[ebox[2],2.95],y+half+1.02);
  if(l!==2)edge('half-'+l,'E'+l+'-home',[[.58,y+half,2.65],[2,y+half,2.65],[2,y+half,front-.5],[(ebox[0]+ebox[2])/2,y+half,(ebox[1]+ebox[3])/2]],'E'+l+'-entry');
  // Original U stair, now contained in the inter-building light well.
  const rise=H/16,out=[[-.58,y,-.10],[-.58,y,.38]],back=[[.58,y+half,2.65]];
  for(let j=0;j<8;j++){const z=.65+j*.25,h=y+(j+1)*rise;wood('stair-'+l+'-out'+j,[.94,.06,.255],[-.58,h-.03,z],'stairs');p.floors.push({id:'stair-'+l+'-out'+j,x0:-1.05,x1:-.11,z0:z-.1275,z1:z+.1275,y:h,thickness:.06,material:'existing-wood-step'});out.push([-.58,h,z]);}
  out.push([-.58,y+half,2.75],[.58,y+half,2.65]);edge('landing-'+l,'half-'+l,out);
  for(let j=0;j<8;j++){const z=2.40-j*.25,h=y+half+(j+1)*rise;wood('stair-'+l+'-return'+j,[.94,.06,.255],[.58,h-.03,z],'stairs');p.floors.push({id:'stair-'+l+'-return'+j,x0:.11,x1:1.05,z0:z-.1275,z1:z+.1275,y:h,thickness:.06,material:'existing-wood-step'});back.push([.58,h,z]);}
  back.push([.58,y+H,.05],[-.58,y+H,-.10]);edge('half-'+l,l===levels-1?'roof':'landing-'+(l+1),back);
  for(const [x,a,b]of [[-1.07,[y,.4],[y+half,2.65]],[-.09,[y,.4],[y+half,2.65]],[.09,[y+half,2.65],[y+H,.4]],[1.07,[y+half,2.65],[y+H,.4]]]){metal('stair-stringer-'+l+x,'pipe',{points:[[x,a[0]-.04,a[1]],[x,b[0]-.04,b[1]]],radius:.04},'steel','#566358','stairs');metal('stair-hand-'+l+x,'pipe',{points:[[x,a[0]+1,a[1]],[x,b[0]+1,b[1]]],radius:.018});for(const t of [0,.5,1])metal('stair-post-'+l+x+t,'pipe',{points:[[x,a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],[x,a[0]+(b[0]-a[0])*t+1,a[1]+(b[1]-a[1])*t]],radius:.012});}
  rail('half-outer-'+l,[-1.18,3.20],[1.25,3.20],y+half+1.02);rail('half-west-'+l,[-1.18,2.4],[-1.18,3.20],y+half+1.02);
  // Visible beams/struts explain limited phase overhangs; no unsupported floating box.
  if(l===3||l===6||l===9){p.phases.push({level:l,reason:'separate later extension',W:wbox,E:ebox,bearing:'continuous inner masonry lines plus explicit outward bracket members'});for(const u of [w,e]){const x=(u.box[0]+u.box[2])/2;wood(u.id+'-phase-beam',[u.box[2]-u.box[0]+.12,.15,.18],[x,u.floor-.12,u.box[3]-.06],'structure');const prior=p.units.find(q=>q.id===u.building+(l-1));for(const sx of [u.box[0]+.2,u.box[2]-.2]){const ax=Math.max(prior.box[0],Math.min(prior.box[2],sx)),az=ax===sx?prior.box[3]:Math.min(u.box[3]-.3,prior.box[3]-.2);metal(u.id+'-bracket'+sx,'pipe',{points:[[ax,u.floor-.85,az],[sx,u.floor-.12,u.box[3]]],radius:.034},'iron','#4c5b50','structure');}}}
 }
 // Two genuine half-level borrowed connections, not every household interlinked.
 for(const level of [2,upperBorrowLevel]){const y=.04+level*H,w=p.units.find(u=>u.id==='W'+level),e=p.units.find(u=>u.id==='E'+level),z=-6.90,prefix='borrow-'+level,gate=level===2?'borrowed-gate':'upper-borrowed-gate';
  floor(prefix+'-W-rear',[-2.76,z-.55,-1.07,w.box[1]+.08],y);floor(prefix+'-E-rear',[1.07,z-.55,2.76,e.box[1]+.08],y+half);
  const points=[[(w.box[0]+w.box[2])/2,y,(w.box[1]+w.box[3])/2],[-2.20,y,w.box[1]+.70],[-2.20,y,z],[-1.05,y,z]];
  for(let j=0;j<8;j++){const x=-.875+j*.25,h=y+(j+1)*H/16;wood(prefix+'-step'+j,[.255,.06,1.0],[x,h-.03,z],'stairs');p.floors.push({id:prefix+'-step'+j,x0:x-.1275,x1:x+.1275,z0:z-.50,z1:z+.50,y:h,thickness:.06,material:'existing-wood-step'});points.push([x,h,z]);}
  points.push([2.20,y+half,z],[2.20,y+half,e.box[1]+.70],[(e.box[0]+e.box[2])/2,y+half,(e.box[1]+e.box[3])/2]);edge('W'+level+'-home','E'+level+'-home',points,gate);
  for(const zz of [z-.54,z+.54]){metal(prefix+'-rail'+zz,'pipe',{points:[[-2.72,y+1,zz],[-1.0,y+1,zz],[1.0,y+half+1,zz],[2.72,y+half+1,zz]],radius:.018});for(const xx of [-2.7,-1,1,2.7]){const yy=xx<0?y:y+half;metal(prefix+'-post'+zz+xx,'pipe',{points:[[xx,yy,zz],[xx,yy+1,zz]],radius:.012});}}}
 const roofY=.04+levels*H,topW=p.units.find(u=>u.id==='W'+(levels-1)),topE=p.units.find(u=>u.id==='E'+(levels-1));node('roof',[-.58,roofY,-.10]);floor('W-roof',[topW.box[0],topW.box[1],1.18,.50],roofY,'mortar');floor('S-roof',[-1.20,-5.55,1.20,-3.15],roofY,'mortar');floor('roof-service-link',[-.55,-3.20,.55,-.85],roofY,'mortar');floor('E-roof',topE.box,roofY+half,'mortar');floor('roof-half-platform',[-1.18,2.4,topE.box[2],3.20],roofY+half);floor('E-roof-bridge',[1.18,topE.box[3],topE.box[2],2.95],roofY+half);
 node('high-roof',[3.2,roofY+half,-1.7]);const roofRoute=[[-.58,roofY,-.10],[-.58,roofY,.38]];for(let j=0;j<8;j++){const z=.65+j*.25,h=roofY+(j+1)*H/16;wood('roof-step'+j,[.94,.06,.255],[-.58,h-.03,z],'stairs');p.floors.push({id:'roof-step'+j,x0:-1.05,x1:-.11,z0:z-.1275,z1:z+.1275,y:h,thickness:.06,material:'existing-wood-step'});roofRoute.push([-.58,h,z]);}roofRoute.push([-.58,roofY+half,2.75],[3.2,roofY+half,2.75],[3.2,roofY+half,-1.7]);edge('roof','high-roof',roofRoute);
 for(const u of [topW,topE]){const y=u===topE?roofY+half:roofY,b=u.box;rail(u.id+'-roof-outer',[b[0],b[1]],[b[2],b[1]],y+1.05);rail(u.id+'-roof-side',[u.building==='W'?b[0]:b[2],b[1]],[u.building==='W'?b[0]:b[2],b[3]],y+1.05);}
 rail('roof-half-front',[-1.18,3.2],[topE.box[2],3.2],roofY+half+1.05);for(const xx of [-1.07,-.09]){metal('roof-flight-rail'+xx,'pipe',{points:[[xx,roofY+1,.4],[xx,roofY+half+1,2.65]],radius:.018});for(const t of [0,.5,1])metal('roof-flight-post'+xx+t,'pipe',{points:[[xx,roofY+half*t,.4+2.25*t],[xx,roofY+half*t+1,.4+2.25*t]],radius:.012});}rail('roof-half-west',[-1.18,2.4],[-1.18,3.2],roofY+half+1.05);
 // Shared services use actual terminals, not names of absent household props.
 metal('roof-water-tank','cylinder',{radius:.48,height:1.1,position:[.15,roofY+.60,-4.75]},'steel','#6b7b6c');
 metal('shared-boiler','cylinder',{radius:.27,height:1.50,position:[-.82,.80,-4.05]},'iron','#49534b');
 const terminals=p.units.filter(u=>u.shared).map(u=>u.id+'-basin'),supply=[[.15,roofY+.25,-4.75],[.93,roofY+.25,-4.75],[.93,.65,-4.75]],waste=[[1.10,roofY-.5,-5.30],[1.10,.05,-5.30],[1.10,.05,-7.5]],steam=[[-.82,1.50,-4.05],[-.90,1.9,-4.75],[-.90,roofY+.4,-4.75]];
 metal('water-riser','pipe',{points:supply,radius:.029});metal('waste-riser','pipe',{points:waste,radius:.047});metal('steam-riser','pipe',{points:steam,radius:.038},'steel','#5b6659');
 for(const u of p.units.filter(u=>u.shared)){const basin=p.metal.find(o=>o.id===u.id+'-basin').position;metal(u.id+'-supply-branch','pipe',{points:[[.93,u.floor+.90,-4.75],[0,u.floor+.90,basin[2]],[0,u.floor+.87,basin[2]]],radius:.017});metal(u.id+'-waste-branch','pipe',{points:[[0,u.floor+.76,basin[2]],[1.10,u.floor+.55,basin[2]],[1.10,u.floor+.55,-5.30]],radius:.027});}
 for(const x of [topW.box[0]+.5,topE.box[2]-.4]){const y=x<0?roofY:roofY+half;metal('antenna-mast'+x,'pipe',{points:[[x,y,-3.5],[x,y+1.4,-3.5]],radius:.012},'steel','#7f8c80');for(let j=0;j<5;j++)metal('antenna-cross'+x+j,'pipe',{points:[[x-.34,y+.65+j*.14,-3.5],[x+.34,y+.65+j*.14,-3.5]],radius:.006},'steel','#7f8c80');}
 p.systems=[{id:'water',source:'roof-water-tank',route:supply,terminals},{id:'waste',route:waste,terminals,simulation:'traceable topology only'},{id:'steam',source:'shared-boiler',route:steam,terminals:['S1-basin','S3-basin'],simulation:'fictional route only; return/valves/pressure not simulated'},{id:'access',root:'street',borrowedDoor:'borrowed-gate',blockedRoom:'E2-home'},{id:'lighting',clock:'shared elapsed seconds',schedules:p.activities}];
 const refugeUnit=p.units.find(u=>u.id==='W5')||p.units.find(u=>u.id==='W2');
 p.rescue={setting:'城寨高低平台救援',physicsImplemented:false,anchors:[{id:'upper-roof-staging',node:'high-roof',kind:'staging'},{id:'lower-roof-transfer',node:'roof',kind:'transfer'},{id:'half-level-transfer',node:'half-'+Math.min(5,levels-1),kind:'platform'},{id:'borrowed-dependent-room',node:'E2-home',kind:'door-dependent-room'},{id:'upper-borrowed-room',node:'E'+upperBorrowLevel+'-home',kind:'alternate-door-room'},{id:'window-lookout',node:refugeUnit.id+'-home',wallId:refugeUnit.id+'-front',openingId:refugeUnit.id+'-window',kind:'window-observation'}],conditionalVerticalLinks:[{from:'upper-roof-staging',to:'window-lookout',requires:'explicitly placed and validated rescue equipment',ordinaryWalkEdge:false}],directorIntent:'reveal trapped location, the constrained route, then the changing danger; no simulated fire or automatic fatal task'};
 return p;
}
