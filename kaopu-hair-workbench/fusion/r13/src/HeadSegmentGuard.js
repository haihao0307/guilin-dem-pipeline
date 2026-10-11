/** Exact neutral-head segment contact correction after guide interpolation.
 * Point clearance alone cannot rule out a chord crossing a curved solid.
 * The original root stays fixed. This is not continuous swept-radius dynamics.
 */
export class HeadSegmentGuard {
 constructor(bvh){this.bvh=bvh;this.totals={curvesChecked:0,triggeredCurves:0,correctedContacts:0,unresolvedSegments:0,maxDisplacement:0};}
 apply(points){
  this.totals.curvesChecked++;let changed=false,original;
  for(let pass=0;pass<6;pass++){
   let contacts=0;
   for(let j=1;j<points.length;j++){
    const a=points[j-1],b=points[j],hit=this.bvh.segmentHit(a,b);if(!hit)continue;
    if(!original)original=points.map(p=>p.slice());changed=true;contacts++;
    const n=hit.normal,side=p=>p.reduce((s,v,k)=>s+(v-hit.point[k])*n[k],0);
    const correction=Math.max(.0004,.0005-Math.min(side(a),side(b)));
    if(j>1)for(let k=0;k<3;k++)a[k]+=n[k]*correction;
    for(let k=0;k<3;k++)b[k]+=n[k]*correction;
    this.totals.correctedContacts++;
   }
   if(!contacts)break;
  }
  if(changed){this.totals.triggeredCurves++;for(let j=1;j<points.length;j++){this.totals.maxDisplacement=Math.max(this.totals.maxDisplacement,Math.hypot(...points[j].map((v,k)=>v-original[j][k])));if(this.bvh.segmentHit(points[j-1],points[j]))this.totals.unresolvedSegments++;}}
  return points;
 }
 diagnostics(){return{...this.totals,scope:'original neutral component-0 head; exact polyline contacts; root fixed; not swept-radius/body/dynamics certification'};}
}
