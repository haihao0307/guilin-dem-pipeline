import {closestPoint,closestSegments} from './layer-contact.mjs';

/**
 * Original static-body thickness constraints on actual triangle features.
 *
 * The native body BVH and positions are retained without simplification. For
 * each cloth triangle, its finite-radius closest body feature is found from
 * both vertex/face directions and all nine edge pairs. A body vertex can thus
 * constrain an interior cloth point missed by vertices, midpoints or centroid.
 * The body is the original fixed boundary (zero inverse mass); the cloth point
 * is corrected with sum(barycentricWeight^2 * inverseMass).
 *
 * This supplements the native signed vertex/body projection. It is a discrete
 * proximity constraint, not continuous collision detection, a triangle
 * intersection untangler, or a certificate for an already inside garment.
 * Whole triangle intersections are checked independently by the replay tests.
 */
export class BodyEnvelope {
 constructor(body,{maxCorrection=.001,sampleLimit=12}={}) {
  if(!body?.p||!body?.faces||!body?.nodes?.length||!body?.tri||!body?.normals)throw Error('BodyEnvelope requires the retained actual body triangle BVH');
  this.body=body;this.maxCorrection=maxCorrection;this.sampleLimit=sampleLimit;
  if(!(maxCorrection>0&&Number.isFinite(maxCorrection)))throw Error('Body envelope correction must be positive and finite');
  const p=body.p,f=body.faces;this.boxes=new Float64Array(f.length*2);
  for(let face=0;face<f.length;face+=3)for(let d=0;d<3;d++){
   this.boxes[face*2+d]=Math.min(p[f[face]*3+d],p[f[face+1]*3+d],p[f[face+2]*3+d]);
   this.boxes[face*2+d+3]=Math.max(p[f[face]*3+d],p[f[face+1]*3+d],p[f[face+2]*3+d]);
  }
  this.point=new Float64Array(7);this.segment=new Float64Array(6);this.box=new Float64Array(6);
 }
 _lowerBound(box,other,offset=0) {
  let sum=0;for(let d=0;d<3;d++){const delta=Math.max(box[d]-other[offset+d+3],other[offset+d]-box[d+3],0);sum+=delta*delta;}return sum;
 }
 _nearest(positions,triangles,face,radius) {
  const body=this.body,p=positions,q=body.p,bf=body.faces,ids=[triangles[face],triangles[face+1],triangles[face+2]],box=this.box;
  for(let d=0;d<3;d++){box[d]=Math.min(...ids.map(id=>p[id*3+d]));box[d+3]=Math.max(...ids.map(id=>p[id*3+d]));}
  let best=radius*radius,found=null;const stack=[0],temp=this.point,segment=this.segment;
  const record=(distanceSquared,bodyFace,bary,bodyBary,kind)=>{
   if(!(distanceSquared<best))return;best=distanceSquared;found={distanceSquared,bodyFace,bary,bodyBary,kind,ids};
  };
  while(stack.length){const node=body.nodes[stack.pop()];if(this._lowerBound(box,node.box)>best)continue;
   if(node.left>=0){const left=this._lowerBound(box,body.nodes[node.left].box),right=this._lowerBound(box,body.nodes[node.right].box);if(left<right){if(right<=best)stack.push(node.right);if(left<=best)stack.push(node.left);}else{if(left<=best)stack.push(node.left);if(right<=best)stack.push(node.right);}continue;}
   for(let offset=node.lo;offset<node.hi;offset++){
    const bodyFace=body.tri[offset];if(this._lowerBound(box,this.boxes,bodyFace*2)>best)continue;
    const bodyIDs=[bf[bodyFace],bf[bodyFace+1],bf[bodyFace+2]];
    for(let j=0;j<3;j++){
     let k=ids[j]*3;if(closestPoint(p[k],p[k+1],p[k+2],q,bf,bodyFace,temp)&&temp[6]<best){const bary=[0,0,0];bary[j]=1;record(temp[6],bodyFace,bary,[temp[3],temp[4],temp[5]],'cloth-vertex/body-face');}
     k=bodyIDs[j]*3;if(closestPoint(q[k],q[k+1],q[k+2],p,triangles,face,temp)&&temp[6]<best){const bary=[0,0,0];bary[j]=1;record(temp[6],bodyFace,[temp[3],temp[4],temp[5]],bary,'body-vertex/cloth-face');}
    }
    for(let i=0;i<3;i++)for(let j=0;j<3;j++)if(closestSegments(p,ids[i],ids[(i+1)%3],q,bodyIDs[j],bodyIDs[(j+1)%3],segment)&&segment[5]<best){const a=[0,0,0],b=[0,0,0];a[i]=1-segment[0];a[(i+1)%3]=segment[0];b[j]=1-segment[1];b[(j+1)%3]=segment[1];record(segment[5],bodyFace,a,b,'edge-edge');}
   }
  }
  if(!found)return null;
  const clothPoint=[0,0,0],bodyPoint=[0,0,0],bodyNormal=[0,0,0];
  for(let d=0;d<3;d++)for(let j=0;j<3;j++){clothPoint[d]+=found.bary[j]*p[ids[j]*3+d];const k=bf[found.bodyFace+j]*3+d;bodyPoint[d]+=found.bodyBary[j]*q[k];bodyNormal[d]+=found.bodyBary[j]*body.normals[k];}
  const difference=clothPoint.map((x,d)=>x-bodyPoint[d]),length=Math.sqrt(found.distanceSquared),orientation=difference.reduce((sum,x,d)=>sum+x*bodyNormal[d],0)<0?-1:1;
  let normal;if(length>1e-12)normal=difference.map(x=>x*orientation/length);else{const norm=Math.hypot(...bodyNormal);if(!(norm>1e-12))return null;normal=bodyNormal.map(x=>x/norm);}
  return{...found,distance:length*orientation,clothPoint,bodyPoint,normal};
 }
 _visit(surface,{clearance,correct=false}={}) {
  const {positions,triangles,inverseMass,thickness}=surface;
  const half=thickness*.5,target=clearance??half+.0005;
  if(!(target>=half&&Number.isFinite(target)))throw Error('Body envelope clearance must cover cloth half thickness');
  const result={triangles:triangles.length/3,nearTriangles:0,violatingTriangles:0,correctionCount:0,immovableViolations:0,maxClearanceDeficitM:0,maxHalfThicknessOverlapM:0,minimumDistanceM:null,samples:[]};
  for(let face=0;face<triangles.length;face+=3){
   const contact=this._nearest(positions,triangles,face,target);if(!contact)continue;result.nearTriangles++;
   const deficit=target-contact.distance;if(!(deficit>1e-9))continue;
   result.violatingTriangles++;result.maxClearanceDeficitM=Math.max(result.maxClearanceDeficitM,deficit);result.maxHalfThicknessOverlapM=Math.max(result.maxHalfThicknessOverlapM,half-contact.distance);
   result.minimumDistanceM=result.minimumDistanceM===null?contact.distance:Math.min(result.minimumDistanceM,contact.distance);
   const effective=contact.bary.reduce((sum,b,j)=>sum+b*b*(inverseMass?inverseMass[contact.ids[j]]:1),0);
   if(!(effective>0))result.immovableViolations++;
   else if(correct){const lambda=Math.min(deficit,this.maxCorrection)/effective;for(let j=0;j<3;j++){const k=contact.ids[j]*3,scale=(inverseMass?inverseMass[contact.ids[j]]:1)*contact.bary[j]*lambda;for(let d=0;d<3;d++)positions[k+d]+=scale*contact.normal[d];}result.correctionCount++;}
   if(result.samples.length<this.sampleLimit)result.samples.push({garment:surface.id,clothTriangle:face/3,bodyTriangle:contact.bodyFace/3,kind:contact.kind,bary:contact.bary,distanceM:contact.distance,halfThicknessOverlapM:Math.max(0,half-contact.distance),point:contact.clothPoint,bodyPoint:contact.bodyPoint});
  }
  result.measurementOnly=!correct;result.residualMeasured=!correct;
  result.scope='finite-radius nearest actual body triangle features over all cloth triangles, both VF directions and EE; no continuous-time or intersection-untangling certificate';
  return result;
 }
 solve(surface,options={}) {return this._visit(surface,{...options,correct:true});}
 measure(surface,options={}) {return this._visit(surface,{...options,correct:false});}
}
