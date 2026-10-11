const overlap=(a,b)=>[0,1,2].every(i=>a.min[i]<b.max[i]-1e-7&&a.max[i]>b.min[i]+1e-7);
const includes=(b,p)=>p.every((v,i)=>v>=b.min[i]-1e-7&&v<=b.max[i]+1e-7);
/** Analytic design checks. No claim of full swept physics/navmesh certification. */
export function inspectStationClearances(recipe,{consistBounds={min:[-60,.2985,-1.75],max:[5.5,4.65,1.75]},walkwayWidth=1.4}={}){
 const p=recipe.plan,s=p.score,errors=[],checks=[];
 const check=(id,pass,detail)=>{checks.push({id,pass,...detail});if(!pass)errors.push(id);};
 const active=p.tracks.filter(t=>t.active);check('one-existing-live-track',active.length===1&&active[0].centerZ===0,{activeCount:active.length,sideTrackOperation:'not-implemented'});
 const running={min:[p.back,s.tracks.railHead-.1,-s.tracks.vehicleWidth/2],max:[p.front,s.tracks.vehicleHeight,s.tracks.vehicleWidth/2]};
 const collisions=recipe.colliders.filter(c=>overlap(c.bounds,running));check('active-train-vs-structure',collisions.length===0,{collisionIds:collisions.map(c=>c.id)});
 const pf=p.platforms.find(pf=>pf.trackIndices.includes(s.tracks.activeIndex));check('original-consist-longitudinal-fit',consistBounds.min[0]>=p.back&&consistBounds.max[0]<p.front,{frontReserve:p.front-consistBounds.max[0],rearReserve:consistBounds.min[0]-p.back});
 const edgeGap=pf.bounds.min[2]-consistBounds.max[2];check('original-consist-platform-clearance',edgeGap>=.08,{clearanceMetres:edgeGap});
 const bridgeGap=p.bridge?p.bridge.bounds.min[1]-consistBounds.max[1]:Infinity;check('bridge-over-original-consist',bridgeGap>=.8,{clearanceMetres:Number.isFinite(bridgeGap)?bridgeGap:null});
 const walkingStrips=[];
 for(const pf of p.platforms){const z0=pf.bounds.min[2],z1=pf.bounds.max[2],sides=pf.index===0?[1]:pf.index===3?[-1]:[-1,1];
  for(const side of sides){const a=side<0?z0+.12:z1-.12-walkwayWidth,b=a+walkwayWidth,walk={min:[p.back,s.platform.top+.03,a],max:[p.front,s.platform.top+2.15,b]},conflicts=recipe.colliders.filter(c=>overlap(c.bounds,walk));
   if(p.bridge){const st=p.bridge.stairFlights[pf.index],bounds={min:[st.start[0],st.start[1],st.start[2]-st.width/2],max:[st.end[0],st.end[1]+1.08,st.end[2]+st.width/2]};if(overlap(bounds,walk))conflicts.push({id:st.id});}
   walkingStrips.push({id:pf.id+'-track-walk-'+side,bounds:walk,width:walkwayWidth});check(pf.id+'-walkway-'+side,conflicts.length===0,{width:walkwayWidth,collisionIds:conflicts.map(c=>c.id)});
  }
 }
 if(p.bridge){const bridgeWalk={min:[p.bridge.bounds.min[0]+.2,s.bridge.deckY+.02,p.bridge.bounds.min[2]],max:[p.bridge.bounds.max[0]-.2,s.bridge.deckY+2.1,p.bridge.bounds.max[2]]},hits=recipe.colliders.filter(c=>overlap(c.bounds,bridgeWalk));check('footbridge-continuous-walkway',hits.length===0,{width:bridgeWalk.max[0]-bridgeWalk.min[0],collisionIds:hits.map(c=>c.id)});}
 if(p.bridge)for(const st of p.bridge.stairFlights){const pf=p.platforms.find(q=>q.id===st.platformId),foot={min:[st.start[0],s.platform.top+.05,st.start[2]-st.width/2-.05],max:[st.end[0],s.bridge.deckY+1.05,st.end[2]+st.width/2+.05]},hits=recipe.colliders.filter(c=>c.kind==='structural-column'&&overlap(c.bounds,foot));check(st.id+'-column-clearance',hits.length===0,{collisionIds:hits.map(c=>c.id)});check(st.id+'-within-platform',st.start[0]>=p.back&&st.start[2]-st.width/2>=pf.bounds.min[2]&&st.start[2]+st.width/2<=pf.bounds.max[2],{riser:st.rise,tread:st.tread,steps:st.steps});}
 check('hotel-has-no-high-rise',p.hotel.highRiseTower===false,{hotelScope:'spatial-relationship-only'});
 check('clock-tower-seaward-of-shed',p.tower.max[0]>p.front,{harbourDirection:p.water.harbourDirection});
 return{schema:'kaopu.station.clearance-report/1',pass:errors.length===0,errors,checks,walkingStrips,scope:'static-metre-envelope-and-planned-walking-strips;no-dynamic-crowds-or-train-dispatch',gpu:false};
}
