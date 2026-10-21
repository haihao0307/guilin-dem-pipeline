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
 constructor(body,{maxCorrection=.001,sampleLimit=12,optimizationEnabled=true}={}) {
  if(!body?.p||!body?.faces||!body?.nodes?.length||!body?.tri||!body?.normals)throw Error('BodyEnvelope requires the retained actual body triangle BVH');
  this.body=body;this.maxCorrection=maxCorrection;this.sampleLimit=sampleLimit;
  if(!(maxCorrection>0&&Number.isFinite(maxCorrection)))throw Error('Body envelope correction must be positive and finite');
  if(typeof optimizationEnabled!=='boolean')throw Error('Body-envelope optimization switch must be boolean');
  this.optimizationEnabled=optimizationEnabled;this.cache=new WeakMap();
  this.totalWork={triangleQueries:0,cacheHits:0,bvhNodeVisits:0,bodyTriangleTests:0,vertexFaceCandidates:0,vertexFaceTests:0,edgeEdgeCandidates:0,edgeEdgeTests:0};
  this.clothEdgeBoxes=new Float64Array(18);
  this.invalidateBody();
  this.point=new Float64Array(7);this.segment=new Float64Array(6);this.box=new Float64Array(6);
 }
 /** Call after the caller has refitted the body BVH and normals. This only
  * invalidates exact-query acceleration; it does not implement body animation.
  * Unannounced body edits fail closed rather than reusing stale results. */
 invalidateBody() {
  const body=this.body,p=body.p,f=body.faces;this.boxes=new Float64Array(f.length*2);
  for(let face=0;face<f.length;face+=3)for(let d=0;d<3;d++){
   this.boxes[face*2+d]=Math.min(p[f[face]*3+d],p[f[face+1]*3+d],p[f[face+2]*3+d]);
   this.boxes[face*2+d+3]=Math.max(p[f[face]*3+d],p[f[face+1]*3+d],p[f[face+2]*3+d]);
  }
  // Static body's finite edge bounds are built once, outside the per-query
  // hot path. They retain Float64 extrema; no geometry is simplified.
  this.bodyEdgeBoxes=new Float64Array(f.length*6);
  for(let face=0;face<f.length;face+=3)for(let edge=0;edge<3;edge++){
   const a=f[face+edge]*3,b=f[face+(edge+1)%3]*3,offset=face*6+edge*6;
   for(let d=0;d<3;d++){this.bodyEdgeBoxes[offset+d]=Math.min(p[a+d],p[b+d]);this.bodyEdgeBoxes[offset+d+3]=Math.max(p[a+d],p[b+d]);}
  }
  this.bodySignature={positions:p.slice(),faces:f.slice(),normals:body.normals.slice()};
  this.bodyCoordinateScale=1;for(const value of p)this.bodyCoordinateScale=Math.max(this.bodyCoordinateScale,Math.abs(value));
  this.cache=new WeakMap();
 }
 setOptimizationEnabled(enabled) {
  if(typeof enabled!=='boolean')throw Error('Body-envelope optimization switch must be boolean');
  this.optimizationEnabled=enabled;this.cache=new WeakMap();
 }
 _checkBodySignature() {
  const pairs=[[this.body.p,this.bodySignature.positions],[this.body.faces,this.bodySignature.faces],[this.body.normals,this.bodySignature.normals]];
  for(const [a,b]of pairs){
   if(a.length!==b.length)throw Error('Body geometry changed: refit and explicitly invalidate BodyEnvelope before reuse');
   for(let i=0;i<a.length;i++)if(!Object.is(a[i],b[i]))throw Error('Body geometry changed: refit and explicitly invalidate BodyEnvelope before reuse');
  }
 }
 _cacheFor(positions,triangles) {
  let rows=this.cache.get(positions);if(!rows){rows=new WeakMap();this.cache.set(positions,rows);}
  let row=rows.get(triangles);
  if(!row){row={coordinates:new Float64Array(triangles.length*3),indices:new Int32Array(triangles.length),radii:new Float64Array(triangles.length/3),valid:new Uint8Array(triangles.length/3),contacts:new Array(triangles.length/3)};rows.set(triangles,row);}
  return row;
 }
 _nearest(positions,triangles,face,radius) {
  const work=this._work;work.triangleQueries++;
  if(!this.optimizationEnabled)return this._nearestFresh(positions,triangles,face,radius);
  const row=this._surfaceCache,index=face/3,start=face*3;
  let identical=Boolean(row.valid[index]&&row.radii[index]===radius);
  for(let j=0;j<3;j++){
   const vertex=triangles[face+j];if(row.indices[face+j]!==vertex)identical=false;
   for(let d=0;d<3;d++)if(!Object.is(row.coordinates[start+j*3+d],positions[vertex*3+d]))identical=false;
  }
  if(identical){work.cacheHits++;return row.contacts[index];}
  for(let j=0;j<3;j++){
   const vertex=triangles[face+j];row.indices[face+j]=vertex;
   for(let d=0;d<3;d++)row.coordinates[start+j*3+d]=positions[vertex*3+d];
  }
  const contact=this._nearestFresh(positions,triangles,face,radius);
  row.valid[index]=1;row.radii[index]=radius;row.contacts[index]=contact;return contact;
 }
 // These are mathematical lower bounds on the original finite feature
 // distances. Padding only makes the bounds more conservative; neither the
 // original feature test nor its order/strict winner update is changed.
 _pointBound(p,k,box,offset=0) {
  const pad=this.boundPadding;
  const dx=Math.max(box[offset]-p[k]-pad,p[k]-box[offset+3]-pad,0),dy=Math.max(box[offset+1]-p[k+1]-pad,p[k+1]-box[offset+4]-pad,0),dz=Math.max(box[offset+2]-p[k+2]-pad,p[k+2]-box[offset+5]-pad,0);
  return dx*dx+dy*dy+dz*dz;
 }
 _edgeBound(a,i,b,j) {
  const pad=this.boundPadding;
  const dx=Math.max(a[i]-b[j+3]-pad,b[j]-a[i+3]-pad,0),dy=Math.max(a[i+1]-b[j+4]-pad,b[j+1]-a[i+4]-pad,0),dz=Math.max(a[i+2]-b[j+5]-pad,b[j+2]-a[i+5]-pad,0);
  return dx*dx+dy*dy+dz*dz;
 }
 _edges(p,ids,out) {
  for(let i=0;i<3;i++){const a=ids[i]*3,b=ids[(i+1)%3]*3;for(let d=0;d<3;d++){out[i*6+d]=Math.min(p[a+d],p[b+d]);out[i*6+d+3]=Math.max(p[a+d],p[b+d]);}}
 }
 _lowerBound(box,other,offset=0) {
  let sum=0;for(let d=0;d<3;d++){const delta=Math.max(box[d]-other[offset+d+3],other[offset+d]-box[d+3],0);sum+=delta*delta;}return sum;
 }
 _nearestFresh(positions,triangles,face,radius) {
  const work=this._work,body=this.body,p=positions,q=body.p,bf=body.faces,ids=[triangles[face],triangles[face+1],triangles[face+2]],box=this.box;
  for(let d=0;d<3;d++){box[d]=Math.min(p[ids[0]*3+d],p[ids[1]*3+d],p[ids[2]*3+d]);box[d+3]=Math.max(p[ids[0]*3+d],p[ids[1]*3+d],p[ids[2]*3+d]);}
  if(this.optimizationEnabled){this._edges(p,ids,this.clothEdgeBoxes);this.boundPadding=1e-12+64*Number.EPSILON*Math.max(this.bodyCoordinateScale,Math.abs(box[0]),Math.abs(box[1]),Math.abs(box[2]),Math.abs(box[3]),Math.abs(box[4]),Math.abs(box[5]));}
  let best=radius*radius,found=null;const stack=[0],temp=this.point,segment=this.segment;
  const record=(distanceSquared,bodyFace,bary,bodyBary,kind)=>{
   if(!(distanceSquared<best))return;best=distanceSquared;found={distanceSquared,bodyFace,bary,bodyBary,kind,ids};
  };
  while(stack.length){work.bvhNodeVisits++;const node=body.nodes[stack.pop()];if(this._lowerBound(box,node.box)>best)continue;
   if(node.left>=0){const left=this._lowerBound(box,body.nodes[node.left].box),right=this._lowerBound(box,body.nodes[node.right].box);if(left<right){if(right<=best)stack.push(node.right);if(left<=best)stack.push(node.left);}else{if(left<=best)stack.push(node.left);if(right<=best)stack.push(node.right);}continue;}
   for(let offset=node.lo;offset<node.hi;offset++){
    const bodyFace=body.tri[offset];if(this._lowerBound(box,this.boxes,bodyFace*2)>best)continue;
    work.bodyTriangleTests++;const bodyIDs=[bf[bodyFace],bf[bodyFace+1],bf[bodyFace+2]];
    for(let j=0;j<3;j++){
     let k=ids[j]*3;work.vertexFaceCandidates++;
     if(!this.optimizationEnabled||this._pointBound(p,k,this.boxes,bodyFace*2)<=best){work.vertexFaceTests++;if(closestPoint(p[k],p[k+1],p[k+2],q,bf,bodyFace,temp)&&temp[6]<best){const bary=[0,0,0];bary[j]=1;record(temp[6],bodyFace,bary,[temp[3],temp[4],temp[5]],'cloth-vertex/body-face');}}
     k=bodyIDs[j]*3;work.vertexFaceCandidates++;
     if(!this.optimizationEnabled||this._pointBound(q,k,box)<=best){work.vertexFaceTests++;if(closestPoint(q[k],q[k+1],q[k+2],p,triangles,face,temp)&&temp[6]<best){const bary=[0,0,0];bary[j]=1;record(temp[6],bodyFace,[temp[3],temp[4],temp[5]],bary,'body-vertex/cloth-face');}}
    }
    for(let i=0;i<3;i++)for(let j=0;j<3;j++){
     work.edgeEdgeCandidates++;
     if(this.optimizationEnabled&&this._edgeBound(this.clothEdgeBoxes,i*6,this.bodyEdgeBoxes,bodyFace*6+j*6)>best)continue;
     work.edgeEdgeTests++;
     if(closestSegments(p,ids[i],ids[(i+1)%3],q,bodyIDs[j],bodyIDs[(j+1)%3],segment)&&segment[5]<best){const a=[0,0,0],b=[0,0,0];a[i]=1-segment[0];a[(i+1)%3]=segment[0];b[j]=1-segment[1];b[(j+1)%3]=segment[1];record(segment[5],bodyFace,a,b,'edge-edge');}
    }
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
  this._checkBodySignature();
  const work=Object.fromEntries(Object.keys(this.totalWork).map(key=>[key,0]));this._work=work;
  const {positions,triangles,inverseMass,thickness}=surface;
  this._surfaceCache=this.optimizationEnabled?this._cacheFor(positions,triangles):null;
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
   if(result.samples.length<this.sampleLimit)result.samples.push({garment:surface.id,clothTriangle:face/3,bodyTriangle:contact.bodyFace/3,kind:contact.kind,bary:contact.bary.slice(),distanceM:contact.distance,halfThicknessOverlapM:Math.max(0,half-contact.distance),point:contact.clothPoint.slice(),bodyPoint:contact.bodyPoint.slice()});
  }
  result.measurementOnly=!correct;result.residualMeasured=!correct;
  result.scope='finite-radius nearest actual body triangle features over all cloth triangles, both VF directions and EE; no continuous-time or intersection-untangling certificate';
  result.work={...work,optimizationEnabled:this.optimizationEnabled,prunedVertexFaceTests:work.vertexFaceCandidates-work.vertexFaceTests,prunedEdgeEdgeTests:work.edgeEdgeCandidates-work.edgeEdgeTests};
  for(const key of Object.keys(this.totalWork))this.totalWork[key]+=work[key];
  this.lastWork=result.work;this._work=null;this._surfaceCache=null;return result;
 }
 solve(surface,options={}) {return this._visit(surface,{...options,correct:true});}
 measure(surface,options={}) {return this._visit(surface,{...options,correct:false});}
}
