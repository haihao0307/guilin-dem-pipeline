import {sewnEdgeGapAudit} from './seam-refinement.mjs';

/** On-demand diagnostics on the current physical surface, without altering it. */
export function auditSeamRegions(world){
 world.body.refit(world.actor.positions);
 return world.solvers.map((solver,role)=>{
  const packet=solver.originalPacket,offsets=new Map();let offset=0;
  for(const panel of packet.spec.panels){offsets.set(panel.id,offset);offset+=panel.uvMm.length;}
  const ids=new Set(packet.record.meshRefinement?.seams.map(row=>row.id)||[]),active=new Set(packet.record.activeSeams),groups=new Set();
  for(const seam of packet.spec.seams)if(active.has(seam.id)){
   const a=seam.a.panelId,b=seam.b.panelId;
   if(ids.has(seam.id)||(/^pant_/.test(a)&&/^pant_/.test(b)&&(/_l$/.test(a)!==/_l$/.test(b)))){
    ids.add(seam.id);for(const pair of seam.stitchVertexPairs){groups.add(solver.map[offsets.get(a)+pair[0]]);groups.add(solver.map[offsets.get(b)+pair[1]]);}
   }
  }
  let vertexMinimum=Infinity,centroidMinimum=Infinity,insideVertices=0,insideCentroids=0,triangles=0,vertexProbe=null,centroidProbe=null;const q=new Float64Array(4),p=solver.p,F=solver.faces;
  for(const site of packet.record.contactRefinement?.inserted||[])groups.add(solver.map[offsets.get(site.panel)+site.index]);
  for(const i of groups){const face=world.body.nearest(p[i*3],p[i*3+1],p[i*3+2]),d=world.body.evaluate(face,p[i*3],p[i*3+1],p[i*3+2],q)[0]*1000;if(d<vertexMinimum){vertexMinimum=d;vertexProbe={group:i,position:Array.from(p.subarray(i*3,i*3+3)),bodyFace:face,bodyVertices:Array.from(world.body.faces.subarray(face,face+3)),regionalDistanceMM:role===1?world.acceleration.lowerBodyContact?.surface.sample(p[i*3],p[i*3+1],p[i*3+2],q)[0]*1000:null};}if(d<-.01)insideVertices++;}
  for(let f=0;f<F.length;f+=3){if(!groups.has(F[f])&&!groups.has(F[f+1])&&!groups.has(F[f+2]))continue;triangles++;let x=0,y=0,z=0;for(let j=0;j<3;j++){const k=F[f+j]*3;x+=p[k]/3;y+=p[k+1]/3;z+=p[k+2]/3;}const d=world.body.sample(x,y,z,q)[0]*1000;if(d<centroidMinimum){centroidMinimum=d;centroidProbe={face:f,groups:Array.from(F.subarray(f,f+3)),vertices:Array.from(F.subarray(f,f+3),id=>Array.from(p.subarray(id*3,id*3+3))),regionDistanceMM:role===1?world.acceleration.lowerBodyContact?.surface.sample(x,y,z,q)[0]*1000:null,inContactPass:role===1?Array.from(world.acceleration.lowerBodyContact?.triangles||[]).includes(f):null};}if(d<-.01)insideCentroids++;}
  return{role:role?'bottom':'top',seams:[...ids],sewnBoundary:sewnEdgeGapAudit(packet,solver.output),sampledVertices:groups.size,sampledTriangles:triangles,minBodyVertexDistanceMM:Number.isFinite(vertexMinimum)?vertexMinimum:null,minBodyTriangleCentroidDistanceMM:Number.isFinite(centroidMinimum)?centroidMinimum:null,verticesInsideBody:insideVertices,triangleCentroidsInsideBody:insideCentroids,minimumVertexProbe:vertexProbe,minimumCentroidProbe:centroidProbe,measurement:'current body triangles and physical cloth vertices/triangle centroids in the declared rise and side-seam neighborhood; discrete samples, not continuous collision certification'};
 });
}
