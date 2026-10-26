// R06 thin waist + step-wedge + connected rail formulas, rotated to the blank
// left wall. Teaching geometry, not structural/code certification. No imports.
const PLAN=Object.freeze({endX:3.2,startZ:2.8,width:.9,gap:.16});
export const stairOpening=()=>[[.14,PLAN.startZ-.08],[PLAN.endX,PLAN.startZ-.08],[PLAN.endX,PLAN.startZ+2*PLAN.width+PLAN.gap+.08],[.14,PLAN.startZ+2*PLAN.width+PLAN.gap+.08]];
export function growStair(c, e) {
 const {id,lowerId,upperId,elevation=0,rise,roomWidth=4,roomDepth=5,finish=.012,waist=.14,slab=c.slabThickness??.16,railNoiseAmplitude=0,noiseSeed=1}=c;
 if(!id||!lowerId||!upperId||![elevation,rise,roomWidth,roomDepth,finish,waist,slab,railNoiseAmplitude,noiseSeed].every(Number.isFinite)||rise<2.8||rise>4.2||roomWidth<3.8||roomDepth<5||waist<.08||waist>.28||railNoiseAmplitude<0||railNoiseAmplitude>.002)throw Error('Stair parameters outside tested teaching bounds');
 const y=elevation+finish,h=rise/2,n=Math.ceil(h/.18),stepRise=h/n,run=2.4,tread=run/n,x0=PLAN.endX,x1=x0-run,z0=PLAN.startZ,width=PLAN.width,gap=PLAN.gap,z1=z0+width+gap,depth=waist*Math.hypot(1,h/run),railHeight=.95,railWidth=.05,postWidth=.035,inset=.08;
 const opts={owner:id,floorId:lowerId,stage:6},landingId=id+':landing',flights=[],rails=[],treadIds=[],route=[[3.45,y,z0+width/2],[x0,y,z0+width/2]],floorTop=y+rise;
 e.node(id,'stair_connection','两跑薄梯板楼梯',lowerId,{stage:6,fromFloorId:lowerId,toFloorId:upperId});e.edge(id,upperId,'connectsTo');
 const box=(key,type,lo,hi,label,supports=[],owner=id)=>e.box(key,type,lo,hi,{...opts,owner,label,supports});
 function flight(key,start,end,z,base,supports){
  const sign=Math.sign(end-start),wid=id+':'+key+':waist',frame={origin:[start,base,z],u:[sign,0,0],v:[0,1,0],w:[0,0,1]},ids=[];
  e.prism(wid,'stair',[[[0,-depth],[run,h-depth],[run,h],[0,0]]],[0,width],{...opts,...frame,floorId:key==='upper'?upperId:lowerId,label:'薄梯板（'+(key==='lower'?'下跑':'上跑')+'）',supports,partRole:'inclined_waist',normalThickness:waist});
  for(let k=0;k<n;k++){const a=k*tread,b=(k+1)*tread,v=k*stepRise,t=(k+1)*stepRise,sid=id+':'+key+':step:'+k;e.prism(sid,'stair',[[[a,v],[b,t],[a,t]]],[0,width],{...opts,...frame,floorId:key==='upper'?upperId:lowerId,label:(key==='lower'?'下跑':'上跑')+'踏步 '+(k+1),supports:[wid],partRole:'step_wedge'});ids.push(sid);treadIds.push(sid);route.push([start+sign*a,base+t,z+width/2],[start+sign*b,base+t,z+width/2]);}
  const f={id:id+':'+key,waistId:wid,treadIds:ids,start,end,z,base,sign,run,rise:h,width,waist,waistVerticalDepth:depth};flights.push(f);return f;
 }
 const low=flight('lower',x0,x1,z0,y,[lowerId+':slab']);
 box(landingId,'stair',[0,y+h-slab,z0],[x1,y+h,z1+width],'半层平台（梯板连续连接假定）',[low.waistId,id+':upper:waist']);
 // Extra half-storey beam removed. Slab-to-slab continuity is an explicit
 // unengineered assumption; only original floor frames remain.
 const innerBack=.64,outerBack=.14,turnX=(innerBack+outerBack)/2;
 route.push([turnX,y+h,z0+width/2],[turnX,y+h,z1+width/2],[x1,y+h,z1+width/2]);
 const high=flight('upper',x1,x0,z1,y+h,[upperId+':slab']);route.push([3.45,floorTop,z1+width/2]);
 const noise=k=>Math.sin((k+1)*12.9898+noiseSeed*78.233)*.5+Math.sin((k+1)*4.1414-noiseSeed*2.718)*.5;
 for(const [side,outer]of [['outer',true],['inner',false]]){
  const rid=id+':rail:'+side,a=outer?z0+inset:z0+width-inset,b=outer?z1+width-inset:z1+inset,back=outer?outerBack:innerBack,front=3.35,mid=y+h+railHeight;
  const path=[[front,y+railHeight,a],[x0,y+railHeight,a],[x1,mid,a],[back,mid,a],[back,mid,b],[x1,mid,b],[x0,floorTop+railHeight,b],[front,floorTop+railHeight,b]],pieceIds=[],jointIds=[],posts=[],widths=[];
  e.node(rid,'continuous_handrail',outer?'外侧连续扶手':'内侧连续扶手',id,{stage:6,noiseRole:'bounded_cross_section_only_centerline_unchanged'});
  for(let k=1;k<path.length;k++){const pid=rid+':piece:'+(k-1),w=railWidth+railNoiseAmplitude*noise(k+(outer?0:20));e.roundMember(pid,'handrail',path[k-1],path[k],w,{...opts,owner:rid,label:outer?'外侧扶手段':'内侧扶手段',partRole:'continuous_handrail_segment'});pieceIds.push(pid);widths.push(w);if(k>1)e.edge(pieceIds[k-2],pid,'continuousWith');}
  // Original finite-line swept tubes share their exact endpoints: round caps
  // intersect naturally, so no square joint blocks or separate joint solids.
  function post(key,top,anchor,surface){const pid=rid+':post:'+key,start=[anchor[0],anchor[1]-.03,anchor[2]];e.roundMember(pid,'handrail',start,top,postWidth,{...opts,owner:rid,floorId:surface===upperId+':slab'||high.treadIds.includes(surface)?upperId:lowerId,label:'扶手支承立杆',supports:[surface],partRole:'handrail_support_post'});posts.push({id:pid,anchor,start,end:top,surfaceId:surface});e.edge(rid,pid,'supportedBy');}
  post('lower-port',path[0],[front,y,a],lowerId+':slab');
  for(const [f,z]of [[low,a],[high,b]])for(const fraction of [.2,.5,.8]){const k=Math.min(n-1,Math.floor(n*fraction)),travel=(k+.5)*tread,x=f.start+f.sign*travel;post(f.id.split(':').at(-1)+'-'+k,[x,f.base+h*travel/run+railHeight,z],[x,f.base+(k+1)*stepRise,z],f.treadIds[k]);}
  for(const [key,x,z]of [['lower',(x1+back)/2,a],['turn',back,(a+b)/2],['upper',(x1+back)/2,b]])post('landing-'+key,[x,mid,z],[x,y+h,z],landingId);
  post('upper-port',path.at(-1),[front,floorTop,b],upperId+':slab');
  rails.push({id:rid,path,pieceIds,jointIds,jointMode:'shared_endpoint_round_caps',posts,widths,railHeight,maxWidth:railWidth+railNoiseAmplitude,centerlineUnchanged:true});
 }
 // Approach goes around the rail's end, not through its side.
 const approach=[[roomWidth/2,y,.5],[3.65,y,.5],[3.65,y,z0+width/2],route[0]];
 const routeId=id+':route';e.node(routeId,'walk_route','一层至二层通行路径',id,{stage:6});e.edge(routeId,lowerId,'startsAt');e.edge(routeId,upperId,'endsAt');for(const sid of [...treadIds,landingId])e.edge(routeId,sid,'walksOn');
 // The upper port ends exactly at the hole edge; extensions are on solid floor.
 const hole=stairOpening();
 return {id,hole,route:{id:routeId,waypoints:[...approach,...route.slice(1)],from:lowerId,to:upperId},entrance:route[0],approach,approachRoute:approach.slice(1),exit:route.at(-1),landingId,landingBeamId:null,flights,handrails:rails,treadIds,stepsPerFlight:n,stepRise,tread,waist,landingSupport:{mode:'assumed_continuous_stair_slabs',waistIds:[low.waistId,high.waistId],extraBeam:false,capacityVerified:false},noise:{amplitude:railNoiseAmplitude,seed:noiseSeed,maxAmplitude:.002,role:'diameter_detail_only_centerline_fixed',defaultReason:'Zero keeps structural teaching geometry clean; optional bounded detail never alters route.'},validationData:{bodyRadius:.2,bodyHeight:1.95,turnX,landingRailClearDepth:innerBack-outerBack-railWidth-railNoiseAmplitude,flightRailClearWidth:width-2*inset-railWidth-railNoiseAmplitude,upperConnectionX:x0,openPorts:true,structuralCertification:false}};
}
