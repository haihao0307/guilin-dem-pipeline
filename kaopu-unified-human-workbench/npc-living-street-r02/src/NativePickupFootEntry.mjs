/** Measured shoe-envelope routing for the short walk -> capture transition.
 * The original displayed shoe is never replaced. Its complete fitted vertices
 * supply a conservative convex prism used only to plan a separated foot path.
 */
const SIDES=['L','R'];
const STEP_SECONDS=.28,SHOE_CLEARANCE_M=.001;
const dot2=(a,b)=>a[0]*b[0]+a[1]*b[1];
const unit2=a=>{const n=Math.hypot(...a);return n>1e-12?a.map(x=>x/n):[1,0];};
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*x*(x*(x*6-15)+10);};
const lerp=(a,b,t)=>a.map((x,k)=>x+(b[k]-x)*t);
const rotate=(R,p)=>[R[0]*p[0]+R[1]*p[1]+R[2]*p[2],R[3]*p[0]+R[4]*p[1]+R[5]*p[2],R[6]*p[0]+R[7]*p[1]+R[8]*p[2]];
function hull(points){
 const P=points.map(p=>p.slice()).sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),half=[];
 for(const p of P){while(half.length>1&&cross(half.at(-2),half.at(-1),p)<=0)half.pop();half.push(p);}
 const lower=half.slice();half.length=0;for(let i=P.length-1;i>=0;i--){const p=P[i];while(half.length>1&&cross(half.at(-2),half.at(-1),p)<=0)half.pop();half.push(p);}
 return lower.slice(0,-1).concat(half.slice(0,-1));
}
function axes(A,B){
 const out=[];for(const P of[A,B])for(let i=0;i<P.length;i++){const d=[P[(i+1)%P.length][0]-P[i][0],P[(i+1)%P.length][1]-P[i][1]],n=unit2([-d[1],d[0]]);out.push(n,n.map(x=>-x));}return out;
}
function separatingNormal(moving,fixed){
 let best={gap:-Infinity,normal:[1,0]};
 for(const n of axes(moving,fixed)){const gap=Math.min(...moving.map(p=>dot2(p,n)))-Math.max(...fixed.map(p=>dot2(p,n)));if(gap>best.gap)best={gap,normal:n};}
 return best;
}

export function nativeShoePrism(record){
 const E=record?.footLocalEnvelope;if(!E?.hullRF?.length||!E.heightRangeM)throw Error('Pickup entry requires the measured complete original shoe envelope');
 return E.hullRF.flatMap(([r,f])=>E.heightRangeM.map(h=>[
  E.originNative[0]+E.rightNative[0]*r+E.forwardNative[0]*f,
  E.originNative[1]+E.rightNative[1]*r+E.forwardNative[1]*f,
  E.originNative[2]+h]));
}
export function nativeEntryAnchor(motion,side){
 const r=motion.rig,j=r.limbs['leg'+side].c,S=r.skinMatrices[j],p=motion.tools.sampleVertex(motion.footDefs[side].id),d=[p[0]-S[3],p[1]-S[7],p[2]-S[11]];
 // All calibrated sole anchors are native foot/toe descendants. Express the
 // current full-CSR point in the current rigid foot frame, retaining toe pose.
 return[S[0]*d[0]+S[4]*d[1]+S[8]*d[2],S[1]*d[0]+S[5]*d[1]+S[9]*d[2],S[2]*d[0]+S[6]*d[1]+S[10]*d[2]];
}
export function projectedShoe(prism,anchor,foot,worldDirection){
 return hull(prism.map(p=>{const d=worldDirection(rotate(foot.rotation,p.map((v,k)=>v-anchor[k])));return[foot.position[0]+d[0],foot.position[2]+d[2]];}));
}

export function planNativePickupEntry(entry,motion,yaw){
 const prism=Object.fromEntries(SIDES.map(s=>[s,nativeShoePrism(motion.actor.footwear.perSide[s])]));
 const direction=v=>motion._direction(v,yaw),from=entry.feet,to=entry.destinationFeet;
 const routes=first=>{
  const order=[first,first==='L'?'R':'L'],out=[];
  for(const [i,side]of order.entries()){
   const other=side==='L'?'R':'L',fixed=i===0?from[other]:to[other];
   const fixedPolygon=projectedShoe(prism[other],fixed.anchorNative,fixed,direction),start=separatingNormal(projectedShoe(prism[side],from[side].anchorNative,from[side],direction),fixedPolygon),end=separatingNormal(projectedShoe(prism[side],to[side].anchorNative,to[side],direction),fixedPolygon);
   let angle=Math.atan2(end.normal[1],end.normal[0])-Math.atan2(start.normal[1],start.normal[0]);angle=Math.atan2(Math.sin(angle),Math.cos(angle));
   out.push({side,other,start:i*STEP_SECONDS,duration:STEP_SECONDS,startNormal:start.normal,turn:angle,startGapM:start.gap,endGapM:end.gap,fixed});
  }
  return out;
 };
 const swinging=SIDES.filter(s=>!from[s].planted),preferred=swinging.length===1?swinging[0]:SIDES.reduce((a,b)=>from[a].sole>=from[b].sole?a:b);
 const chosen=routes(preferred),alternative=routes(preferred==='L'?'R':'L');
 const endpointScore=R=>Math.min(...R.flatMap(r=>[r.startGapM,r.endGapM]));
 const selected=endpointScore(chosen)>=SHOE_CLEARANCE_M?chosen:endpointScore(alternative)>endpointScore(chosen)?alternative:chosen;
 return{schema:'native-shoe-separated-entry/1',prism,steps:selected,duration:STEP_SECONDS*2,clearanceM:SHOE_CLEARANCE_M,
  actualPreviousSupport:Object.fromEntries(SIDES.map(s=>[s,from[s].planted])),preferredFirst:preferred,order:selected.map(r=>r.side),
  endpointMinimumGapM:endpointScore(selected),endpointsSeparated:endpointScore(selected)>=0,
  basis:'All fitted original shoe parts -> exact rest footprint hull and full height range; one moving foot, the other preserves actual support.'};
}

/** A separating support plane for the two complete convex prisms exists at
 * every returned pose, not only at sampled collision times. The plane normal
 * turns continuously between the measured separating endpoint normals. */
export function routeNativePickupFoot(plan,entry,motion,side,elapsed,yaw,blendRotation){
 const step=plan.steps.find(r=>r.side===side),q=Math.max(0,Math.min(1,(elapsed-step.start)/step.duration)),u=smooth(q),from=entry.feet[side],to=entry.destinationFeet[side];
 const current={position:lerp(from.position,to.position,u),rotation:blendRotation(from.rotation,to.rotation,u)};
 const a=Math.atan2(step.startNormal[1],step.startNormal[0])+step.turn*u,n=[Math.cos(a),Math.sin(a)],direction=v=>motion._direction(v,yaw);
 const anchor=nativeEntryAnchor(motion,side),otherAnchor=nativeEntryAnchor(motion,step.other);
 const moving=projectedShoe(plan.prism[side],anchor,current,direction),fixed=projectedShoe(plan.prism[step.other],otherAnchor,step.fixed,direction);
 const gap=Math.min(...moving.map(p=>dot2(p,n)))-Math.max(...fixed.map(p=>dot2(p,n))),offset=Math.max(0,plan.clearanceM-gap);
 // Only the active step follows the routed path. A supporting foot is never
 // slid sideways by a changing reference frame or by the other foot's route.
 if(q>0&&q<1){current.position[0]+=n[0]*offset;current.position[2]+=n[1]*offset;}
 const lift=Math.sin(Math.PI*q)*motion.height*.028;
 current.position[1]+=lift;
 return{...current,q,planted:q===0?from.planted:q===1,soleHeight:q===0?Math.max(0,from.sole):q===1?0:(1-u)*Math.max(0,from.sole)+u*Math.max(0,to.sole)+lift,
  routing:{side,other:step.other,q,normal:n,unroutedGapM:gap,lateralOffsetM:q>0&&q<1?offset:0,separationGuaranteeM:gap+(q>0&&q<1?offset:0)}};
}
