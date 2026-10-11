// Original compact ten-storey building, freely designed in metres.
// Section references inform adjacency/borrowing, never image-derived dimensions.
export function makeBuildingRecipe({seed=198107,levels=10,detailedLevels=[0,1,2,9]}={}){
 if(!Number.isInteger(levels)||levels<4||levels>12)throw Error('4..12 whole levels required');
 detailedLevels=detailedLevels.filter(x=>Number.isInteger(x)&&x>=0&&x<levels);
 const p={levelCount:levels,detailedLevels,schema:'walled-building/1',seed,units:[],walls:[],wood:[],metal:[],floors:[],doors:[],nodes:[],edges:[],systems:[],activities:[],notHistoricalReconstruction:true,declaredOmissions:['No unvalidated residents, garment, or bedding inserted','Fictional dimensions; structural/fire certification not claimed'],sourcePolicy:{brick:'R3.12 source field/templates',wood:'Library v3 original kernel',metal:'Existing FH88 material closure'}};
 const wood=(id,size,position,group='furniture',rotation=[0,0,0])=>p.wood.push({id,size,position,rotation,group,presetId:'yunnan_light_weathered_v2',seed});
 const metal=(id,kind,data,role='iron',color='#4c5852',group='services')=>p.metal.push({id,kind,...data,role,color,group});
 const floor=(id,box,y,material='wood')=>p.floors.push({id,x0:box[0],z0:box[1],x1:box[2],z1:box[3],y,thickness:.1,material});
 const node=(id,at)=>p.nodes.push({id,at}),edge=(from,to,points,door=null)=>p.edges.push({from,to,points,door,minWidth:door?.88:.94,minHeight:2.04});
 const rail=(id,A,B,y)=>{metal(id,'pipe',{points:[[A[0],y,A[1]],[B[0],y,B[1]]],radius:.018});const n=Math.ceil(Math.hypot(A[0]-B[0],A[1]-B[1])/.5);for(let i=0;i<=n;i++){const x=A[0]+(B[0]-A[0])*i/n,z=A[1]+(B[1]-A[1])*i/n;metal(id+'-post'+i,'pipe',{points:[[x,y-.98,z],[x,y,z]],radius:.012});}};
 const uses=[['小修理作坊','街边杂货店'],['诊所与候诊','家庭住户'],['家庭住户','借道住户'],['共用厨房洗涤','家庭住户'],['家庭住户','共享洗涤间'],['小修理作坊','家庭住户'],['家庭住户','家庭住户'],['公共休息间','家庭住户'],['家庭住户','共享厨房'],['家庭住户','屋顶管理员住户'],['家庭住户','家庭住户'],['共享洗涤间','家庭住户']];
 node('street',[-2,.04,4.9]);floor('ground',[-6.6,-3.95,4,5.3],0,'mortar');
 for(let level=0;level<levels;level++){
  const y=.04+level*2.75,landing='landing-'+level;node(landing,[-4.68,y,.65]);floor('landing-floor-'+level,[-6.38,.20,-4.15,1.60],y);floor('balcony-'+level,[-4.15,.30,3.88,1.42],y,level?'wood':'mortar');node('corridor-'+level,[-.05,y,.85]);edge(landing,'corridor-'+level,[[-4.68,y,.65],[-3.95,y,.85],[-.05,y,.85]]);if(level===0)edge('street',landing,[[-2,.04,4.9],[-.05,.04,4.9],[-.05,.04,.85],[-4.68,.04,.65]]);
  if(level)rail('balcony-front-'+level,[-4.15,1.42],[3.88,1.42],y+1.02);
  rail('landing-west-'+level,[-6.38,.20],[-6.38,1.60],y+1.02);
  rail('balcony-right-'+level,[3.88,.30],[3.88,1.42],y+1.02);
  for(const side of ['W','E']){
   const id=side+level,x0=side==='W'?-4:.15,x1=side==='W'?-.45:3.70,box=[x0,-3.6,x1,.30],center=(x0+x1)/2,use=uses[level][side==='W'?0:1],borrow=level===2;
   const unit={id,level,detailed:detailedLevels.includes(level),building:side,use,box,floor:y,height:2.60};p.units.push(unit);floor(id+'-floor',box,y,level?'wood':'mortar');node(id+'-home',[center,y,-.60]);
   for(const wallSide of ['front','back','left','right']){
    const alongX=wallSide==='front'||wallSide==='back',start=alongX?x0:-3.6,end=alongX?x1:.30,fixed=wallSide==='front'?.30:wallSide==='back'?-3.6:wallSide==='left'?x0:x1,openings=[];
    if(wallSide==='front'){
     if(!(borrow&&side==='E'))openings.push({id:id+'-entry',kind:'door',center:center+.60,width:1.12,height:2.18,bottom:0});
     openings.push({id:id+'-window',kind:'window',center:center-.78,width:.98,height:1.05,bottom:1.0});
    }
    if(wallSide==='back')openings.push({id:id+'-back-window',kind:'window',center:center,width:1.0,height:.82,bottom:1.15});
    if(borrow&&wallSide===(side==='W'?'right':'left'))openings.push({id:side==='W'?'borrowed-gate':'borrowed-receiver',kind:'door',center:-1.5,width:1.12,height:2.18,bottom:0});
    const w={id:id+'-'+wallSide,unit:id,side:wallSide,alongX,start,end,fixed,bottom:y,height:unit.height,openings,group:id+'-walls'};p.walls.push(w);
    for(const o of openings){const at=(u,h=0,d=0)=>alongX?[u,y+h,fixed+d]:[fixed+d,y+h,u],rot=alongX?[0,0,0]:[0,Math.PI/2,0];
     for(const sign of [-1,1])wood(o.id+'-frame'+sign,[.12,o.height,.17],at(o.center+sign*(o.width/2-.06),o.bottom+o.height/2),'frames',rot);
     wood(o.id+'-lintel',[o.width,.12,.17],at(o.center,o.bottom+o.height-.06),'frames',rot);
     if(o.kind==='door'&&o.id!=='borrowed-receiver')p.doors.push({id:o.id,wallId:w.id,hinge:at(o.center-o.width/2+.12,o.bottom),yaw:alongX?0:-Math.PI/2,width:.88,height:2.06,open:true,borrowed:o.id==='borrowed-gate'});
     if(o.kind==='window'){wood(o.id+'-sill',[o.width,.10,.25],at(o.center,o.bottom+.02),'frames',rot);const out=wallSide==='front'?.25:wallSide==='back'?-.25:wallSide==='left'?-.25:.25;
      for(let j=0;j<5;j++){const u=o.center-.40+j*.20;metal(o.id+'-bar'+j,'pipe',{points:[at(u,o.bottom+.08,out),at(u,o.bottom+o.height-.10,out)],radius:.009},'iron','#47534c','window-cages');}
      for(const h of [o.bottom+.08,o.bottom+o.height-.10])metal(o.id+'-rail'+h,'pipe',{points:[at(o.center-.40,h),at(o.center-.40,h,out),at(o.center+.40,h,out),at(o.center+.40,h)],radius:.012},'iron','#47534c','window-cages');}
    }
   }
   if(!(borrow&&side==='E'))edge('corridor-'+level,id+'-home',[[-.05,y,.85],[center+.60,y,.85],[center+.60,y,-.35],[center,y,-.60]],id+'-entry');
   // A simple functional inventory, all routed to original material factories.
   const table=(suffix,tx,tz)=>{wood(id+suffix+'-top',[1.05,.055,.55],[tx,y+.72,tz]);for(const a of [-.45,.45])for(const b of [-.20,.20])wood(id+suffix+'-leg'+a+b,[.045,.69,.045],[tx+a,y+.345,tz+b]);};
   if(unit.detailed){table('-table',center,-2.85);
   if(use.includes('住户')){wood(id+'-bed-base',[1.05,.10,1.88],[x0+.70,y+.41,-2.25]);for(const a of [-.48,.48])for(const b of [-.84,.84])wood(id+'-bed-post'+a+b,[.06,.68,.06],[x0+.70+a,y+.34,-2.25+b]);wood(id+'-bed-head',[1.05,.32,.06],[x0+.70,y+.62,-3.16]);}
   for(let k=0;k<3;k++){wood(id+'-shelf'+k,[.78,.04,.28],[x1-.52,y+.5+k*.38,-3.30]);for(let j=0;j<2;j++)metal(id+'-tin'+k+j,'cylinder',{radius:.064,height:.14,position:[x1-.75+j*.35,y+.60+k*.38,-3.28]},'steel',j?'#89907f':'#656e64','objects');}
   metal(id+'-basin','bowl',{radius:.16,height:.13,position:[center,y+.76,-2.84]},'paint','#b7c4b5','objects');
   if(use.includes('作坊'))for(let k=0;k<3;k++){wood(id+'-tool'+k,[.18,.03,.03],[center-.35+k*.30,y+.76,-2.77]);metal(id+'-tool-shaft'+k,'pipe',{points:[[center-.26+k*.30,y+.75,-2.77],[center-.06+k*.30,y+.75,-2.77]],radius:.005},'steel','#9ba79d','objects');}
   }
   p.activities.push({unit:id,role:use,openHour:use.includes('店')?7:use.includes('诊所')?9:0,closeHour:use.includes('店')?22:use.includes('诊所')?19:24});
   metal(id+'-window-light','box',{size:[.30,.20,.06],position:[center-.78,y+1.48,.19]},'light','#e0bb77','night-lights');
  }
  if(level===2){floor('borrow-bridge',[-.50,-2.03,.20,-.97],y);edge('W2-home','E2-home',[[-2.225,y,-.60],[-1,y,-1.5],[.68,y,-1.5],[1.925,y,-.60]],'borrowed-gate');rail('bridge-back',[-.49,-2.03],[.19,-2.03],y+1.02);rail('bridge-front',[-.49,-.97],[.19,-.97],y+1.02);}
  // Two real stair flights and mid landing per floor, including access to roof.
  const rise=2.75/16,mid=y+1.375,points=[[-4.68,y,.65],[-5.84,y,1.45]];
  for(let j=0;j<8;j++){const z=1.60+j*.25,h=y+(j+1)*rise;wood('stair-'+level+'-out'+j,[.94,.06,.255],[-5.84,h-.03,z],'stairs');p.floors.push({id:'stair-'+level+'-out'+j,x0:-6.31,x1:-5.37,z0:z-.1275,z1:z+.1275,y:h,thickness:.06,material:'existing-wood-step'});points.push([-5.84,h,z]);}
  floor('stair-mid-'+level,[-6.37,3.36,-4.15,4.32],mid);points.push([-5.84,mid,3.80],[-4.68,mid,3.80]);
  for(let j=0;j<8;j++){const z=3.35-j*.25,h=mid+(j+1)*rise;wood('stair-'+level+'-return'+j,[.94,.06,.255],[-4.68,h-.03,z],'stairs');p.floors.push({id:'stair-'+level+'-return'+j,x0:-5.15,x1:-4.21,z0:z-.1275,z1:z+.1275,y:h,thickness:.06,material:'existing-wood-step'});points.push([-4.68,h,z]);}
  points.push([-4.68,y+2.75,.65]);edge(landing,level===levels-1?'roof':'landing-'+(level+1),points);
  for(const [x,A,B]of [[-6.35,[y,1.35],[mid,3.60]],[-5.33,[y,1.35],[mid,3.60]],[-5.19,[mid,3.60],[y+2.75,1.35]],[-4.17,[mid,3.60],[y+2.75,1.35]]]){metal('stringer-'+level+'-'+x,'pipe',{points:[[x,A[0]-.04,A[1]],[x,B[0]-.04,B[1]]],radius:.045},'steel','#56645b','stairs');metal('flight-'+level+'-'+x,'pipe',{points:[[x,A[0]+1.0,A[1]],[x,B[0]+1.0,B[1]]],radius:.018});for(const t of [0,.5,1]){const h=A[0]+(B[0]-A[0])*t,z=A[1]+(B[1]-A[1])*t;metal('flight-post-'+level+x+t,'pipe',{points:[[x,h,z],[x,h+1,z]],radius:.013});}}
  rail('mid-west-'+level,[-6.37,3.60],[-6.37,4.32],mid+1.02);rail('mid-east-'+level,[-4.15,3.60],[-4.15,4.32],mid+1.02);rail('mid-outer-'+level,[-6.37,4.32],[-4.15,4.32],mid+1.02);
 }
 for(const x of [-6.35,-4.17])for(const z of [.20,4.32])wood('stair-tower-post-'+x+z,[.16,levels*2.75+.04,.16],[x,(levels*2.75+.04)/2,z],'structure');
 const roofY=.04+levels*2.75;node('roof',[-4.68,roofY,.65]);floor('terrace-roof',[-6.38,-3.75,3.9,1.60],roofY,'mortar');rail('roof-front',[-6.38,1.42],[3.9,1.42],roofY+1.05);rail('roof-back',[-6.38,-3.75],[3.9,-3.75],roofY+1.05);rail('roof-right',[3.9,-3.75],[3.9,1.42],roofY+1.05);
 metal('roof-water-tank','cylinder',{radius:.43,height:.95,position:[3.18,roofY+.52,-2.80]},'steel','#68766b');
 const supply=[[3.18,roofY+.25,-2.80],[3.95,roofY+.25,-2.80],[3.95,.55,-2.80]],waste=[[3.83,roofY-.5,-3.25],[3.83,-.08,-3.25],[3.83,-.08,3.85]];metal('water-riser','pipe',{points:supply,radius:.027},'iron','#677b70');metal('waste-riser','pipe',{points:waste,radius:.045},'iron','#45534b');
 for(const u of p.units){const x=(u.box[0]+u.box[2])/2;metal(u.id+'-supply-branch','pipe',{points:[[3.95,u.floor+.55,-2.8],[x,u.floor+.55,-2.8],[x,u.floor+.89,-2.8]],radius:.018});}
 for(const x of [-3.7,2.7]){metal('antenna-mast'+x,'pipe',{points:[[x,roofY,-3.1],[x,roofY+1.4,-3.1]],radius:.012},'steel','#7f8c80');for(let j=0;j<5;j++)metal('antenna-cross'+x+j,'pipe',{points:[[x-.34,roofY+.65+j*.14,-3.1],[x+.34,roofY+.65+j*.14,-3.1]],radius:.006},'steel','#7f8c80');}
 p.systems=[{id:'water',source:'roof-water-tank',route:supply,terminals:p.units.map(u=>u.id+'-basin')},{id:'waste',route:waste,terminals:['street-drain'],simulation:'traceable topology only'},{id:'access',root:'street',borrowedDoor:'borrowed-gate',blockedRoom:'E2-home'},{id:'lighting',clock:'shared elapsed seconds',schedules:p.activities}];
 return p;
}
