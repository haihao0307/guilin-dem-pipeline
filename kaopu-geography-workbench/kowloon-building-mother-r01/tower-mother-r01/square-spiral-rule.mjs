// One square turn = four quarter flights = one storey. Not a circular helix.
export const squareStairOpening=()=>[[1,1],[5,1],[5,5],[1,5]];
const starts=[[2,1],[5,2],[4,5],[1,4]],dirs=[[1,0],[0,1],[-1,0],[0,-1]],corners=[[1,1],[4,1],[4,4],[1,4]];
export function growSquareSpiral(c,e){
 const {id,lowerId,upperId,elevation=0,rise,finish=.012,waist=.14,slab=.16,emitBaseLanding=false,railNoiseAmplitude=0,noiseSeed=1}=c;
 if(typeof emitBaseLanding!=='boolean'||!id||!lowerId||!upperId||![elevation,rise,finish,waist,slab,railNoiseAmplitude,noiseSeed].every(Number.isFinite)||rise<3||rise>4.2||waist<.08||waist>.2||slab<.12||slab>.22||railNoiseAmplitude<0||railNoiseAmplitude>.002)throw Error('Square stair outside tested teaching parameters');
 const y=elevation+finish,q=rise/4,n=Math.ceil(q/.18),stepRise=q/n,tread=2/n,depth=waist*Math.hypot(1,q/2),opts={owner:id,floorId:lowerId,stage:6},flights=[],handrails=[],landingIds=[],treadIds=[],route=[[1.5,y,.5],[1.5,y,1.5],[2,y,1.5]];
 // First-storey approach begins inside the actual front door, not outdoors.
 if(elevation===0)route.unshift([3,y,.14],[3,y,.5]);
 const baseLanding=c.baseLandingId??(emitBaseLanding?id+':landing:0':lowerId+':slab'),landing=k=>k===0?baseLanding:id+':landing:'+k;
 e.node(id,'stair_connection','方形旋转楼梯 · 四跑一圈升一层',lowerId,{stage:6,fromFloorId:lowerId,toFloorId:upperId,supportAssumption:'unverified_continuous_slab'});e.edge(id,upperId,'connectsTo');
 function platform(k){const a=corners[k%4],pid=landing(k),top=y+k*q;e.box(pid,'stair',[a[0],top-slab,a[1]],[a[0]+1,top,a[1]+1],{...opts,floorId:k===4?upperId:lowerId,label:k===0?'首层楼梯入口平台':k===4?'整层楼梯到达平台':'转角平台（连续梯板假定）',supports:k===0?[lowerId+':slab']:k===4?[upperId+':slab']:[],partRole:'square_turn_landing',supportAssumption:'unverified_continuous_slab'});landingIds.push(pid);}
 if(emitBaseLanding)platform(0);for(let k=1;k<=4;k++)platform(k);
 const at=(k,t,v,height)=>{const a=starts[k],d=dirs[k];return[a[0]+d[0]*t-d[1]*v,height,a[1]+d[1]*t+d[0]*v];};
 for(let k=0;k<4;k++){
  const d=dirs[k],wid=id+':flight:'+k+':waist',base=y+k*q,frame={origin:at(k,0,0,base),u:[d[0],0,d[1]],v:[0,1,0],w:[-d[1],0,d[0]]},steps=[];
  e.prism(wid,'stair',[[[0,-depth],[2,q-depth],[2,q],[0,0]]],[0,1],{...opts,...frame,label:'第'+(k+1)+'跑薄梯板',partRole:'inclined_waist',normalThickness:waist,supportAssumption:'unverified_continuous_slab'});e.edge(wid,landing(k),'continuousWith');e.edge(wid,landing(k+1),'continuousWith');
  for(let j=0;j<n;j++){const a=j*tread,b=(j+1)*tread,v=j*stepRise,t=(j+1)*stepRise,sid=id+':flight:'+k+':step:'+j;e.prism(sid,'stair',[[[a,v],[b,t],[a,t]]],[0,1],{...opts,...frame,label:'第'+(k+1)+'跑踏步 '+(j+1),supports:[wid],partRole:'step_wedge'});steps.push(sid);treadIds.push(sid);route.push(at(k,a,.5,base+t),at(k,b,.5,base+t));}
  const corner=corners[(k+1)%4];route.push([corner[0]+.5,base+q,corner[1]+.5]);if(k<3)route.push(at(k+1,0,.5,base+q));
  flights.push({id:id+':flight:'+k,waistId:wid,treadIds:steps,start:at(k,0,.5,base),end:at(k,2,.5,base+q),rise:q,run:2,width:1,stepRise,tread,waist,waistVerticalDepth:depth});
 }
 route.push([1.5,y+rise,.5]);
 const noise=k=>.5*Math.sin((k+1)*12.9898+noiseSeed*78.233)+.5*Math.sin((k+1)*4.1414-noiseSeed*2.718);
 for(const inner of[false,true]){
  const rid=id+':rail:'+(inner?'inner':'outer'),v=inner?.92:.08,path=[],posts=[],pieceIds=[],widths=[];e.node(rid,'continuous_handrail',inner?'内侧连续圆扶手':'外侧圆扶手（整层入口留通道）',id,{stage:6,noiseRole:'diameter_only'});
  const add=p=>{if(!path.length||p.some((v,k)=>Math.abs(v-path.at(-1)[k])>1e-9))path.push(p);};
  if(inner)add([1.92,y+.95,1.92]);
  for(let k=0;k<4;k++){const top=y+k*q+.95;add(at(k,0,v,top));add(at(k,2,v,top+q));const a=corners[(k+1)%4],corner=inner?[a[0]+(a[0]===1?.92:.08),top+q,a[1]+(a[1]===1?.92:.08)]:[a[0]+(a[0]===1?.08:.92),top+q,a[1]+(a[1]===1?.08:.92)];add(corner);if(k<3)add(at(k+1,0,v,top+q));}
  for(let j=1;j<path.length;j++){const pid=rid+':piece:'+(j-1),diameter=.05+railNoiseAmplitude*noise(j+(inner?32:0));e.roundMember(pid,'handrail',path[j-1],path[j],diameter,{...opts,owner:rid,label:'圆扶手连续段',partRole:'continuous_handrail_segment'});pieceIds.push(pid);widths.push(diameter);if(j>1)e.edge(pieceIds[j-2],pid,'continuousWith');}
  function post(key,anchor,top,surface,upper=false){const pid=rid+':post:'+key,start=[anchor[0],anchor[1]-.03,anchor[2]];e.roundMember(pid,'handrail',start,top,.035,{...opts,owner:rid,floorId:upper?upperId:lowerId,label:'扶手支承立杆',supports:[surface],partRole:'handrail_support_post'});e.edge(rid,pid,'supportedBy');posts.push({id:pid,start,end:top,anchor,surfaceId:surface});}
  for(let k=0;k<4;k++)for(const f of[.25,.75]){const j=Math.min(n-1,Math.floor(n*f)),t=(j+.5)*tread;post(k+'-'+j,at(k,t,v,y+k*q+(j+1)*stepRise),at(k,t,v,y+k*q+q*t/2+.95),flights[k].treadIds[j]);}
  for(let k=1;k<=4;k++){const a=corners[k%4],p=inner?[a[0]+(a[0]===1?.92:.08),y+k*q,a[1]+(a[1]===1?.92:.08)]:[a[0]+(a[0]===1?.08:.92),y+k*q,a[1]+(a[1]===1?.08:.92)];post('turn-'+k,p,[p[0],p[1]+.95,p[2]],landing(k),k===4);}
  handrails.push({id:rid,path,pieceIds,posts,widths,railHeight:.95,maxWidth:.052,jointMode:'shared_endpoint_round_caps',entryGap:!inner});
 }
 const routeId=id+':route';e.node(routeId,'walk_route','整圈楼梯通达路径',id,{stage:6});e.edge(routeId,lowerId,'startsAt');e.edge(routeId,upperId,'endsAt');for(const sid of [...treadIds,...landingIds])e.edge(routeId,sid,'walksOn');
 return{id,hole:squareStairOpening(),route:{id:routeId,waypoints:route,from:lowerId,to:upperId},entrance:[1.5,y,.5],exit:[1.5,y+rise,.5],baseLandingId:baseLanding,topLandingId:landing(4),landingIds,flights,handrails,treadIds,stepsPerFlight:n,stepRise,tread,waist,quarterTurns:4,totalRise:rise,noise:{amplitude:railNoiseAmplitude,seed:noiseSeed,role:'diameter_only'},supportAssumption:{mode:'unverified_continuous_slab',extraBeam:false,capacityVerified:false},validationData:{bodyRadius:.2,bodyHeight:1.95,flightRailClearWidth:.84-.052,repeatHeadroom:rise-Math.max(depth,slab),openFloorPorts:true}};
}
