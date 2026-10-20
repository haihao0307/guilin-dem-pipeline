import {MeshContact} from './mesh-contact.mjs';

/** Discrete contacts against the actual lower-body triangles. Only cloth
 * controls around declared trouser seams receive the fine contact pass.
 * Rendering continues to use those same physical panel triangles. */
export class LowerBodyContact{
 constructor(world,model){
  this.world=world;this.model=model;const solver=model.source,actor=world.actor,packet=solver.originalPacket;
  let ymax=-Infinity;for(let i=1;i<solver.p.length;i+=3)ymax=Math.max(ymax,solver.p[i]);
  const faces=[],native=actor.positions,all=actor.faces||world.body.faces;
  for(let f=0;f<all.length;f+=3){const a=all[f],b=all[f+1],c=all[f+2];if(a>=actor.bodyCount||b>=actor.bodyCount||c>=actor.bodyCount)continue;if(Math.min(native[a*3+1],native[b*3+1],native[c*3+1])<=ymax+.15)faces.push(a,b,c);}
  this.surface=new MeshContact(native,faces);this.bodyVertices=Int32Array.from(new Set(faces));this.previousBody=native.slice();this.bodyMotionClock=0;this.coarseCache=this.cache(model.count);this.q=new Float64Array(4);
  const offsets=new Map();let offset=0;for(const panel of packet.spec.panels){offsets.set(panel.id,offset);offset+=panel.uvMm.length;}
  const active=new Set(packet.record.activeSeams),seamGroups=new Set();
  for(const seam of packet.spec.seams)if(active.has(seam.id)&&/^pant_/.test(seam.a.panelId)&&/^pant_/.test(seam.b.panelId)&&seam.a.panelId!==seam.b.panelId)for(const pair of seam.stitchVertexPairs){seamGroups.add(solver.map[offsets.get(seam.a.panelId)+pair[0]]);seamGroups.add(solver.map[offsets.get(seam.b.panelId)+pair[1]]);}
  for(const site of packet.record.contactRefinement?.inserted||[])seamGroups.add(solver.map[offsets.get(site.panel)+site.index]);
  const triangles=[],vertices=new Set(seamGroups),F=solver.faces;
  for(let f=0;f<F.length;f+=3)if(seamGroups.has(F[f])||seamGroups.has(F[f+1])||seamGroups.has(F[f+2])){triangles.push(f);vertices.add(F[f]);vertices.add(F[f+1]);vertices.add(F[f+2]);}
  this.vertices=Int32Array.from(vertices);this.triangles=Int32Array.from(triangles);this.vertexCache=this.cache(solver.count);this.triangleCache=this.cache(triangles.length);this.direction=new Float64Array(3);this.rest=solver.p.slice();
  this.vertexSide=new Int16Array(solver.count);const faceSides=[];let panelOffset=0;
  for(const panel of packet.spec.panels){const side=/^pant_f_|front/.test(panel.id)?1:/^pant_b_|back/.test(panel.id)?-1:0;for(let i=0;i<panel.uvMm.length;i++)this.vertexSide[solver.map[panelOffset+i]]+=side;for(const tri of panel.triangles)if(new Set(tri.map(i=>solver.map[panelOffset+i])).size===3)faceSides.push(side);panelOffset+=panel.uvMm.length;}
  this.faceSide=Int8Array.from(faceSides);const names=actor.rig.names;this.pelvisBone=names.indexOf('pelvis');if(this.pelvisBone<0)this.pelvisBone=names.indexOf('spine05');if(this.pelvisBone<0)this.pelvisBone=0;
  this.metrics={model:'current native lower-body triangles; seam-neighborhood physical control projection',queryReuse:'skip only for exactly unchanged posed body and exactly unchanged sample coordinates with satisfied clearance',bodyTriangles:faces.length/3,nativeBodyTriangles:all.length/3,coarseControls:model.count,fineVertices:vertices.size,fineTriangles:triangles.length,continuousCollision:false,clothSelfCollision:false,contacts:0,maxCorrectionMM:0,refitMS:0,coarseMS:0,fineMS:0,queries:0,safelySkippedQueries:0};
 }
 cache(n){return{faces:new Int32Array(n).fill(-1),points:new Float64Array(n*3),distance:new Float64Array(n),clock:new Float64Array(n)};}
 refit(){const start=performance.now(),now=this.world.actor.positions,previous=this.previousBody;let movement2=0;for(const i of this.bodyVertices){const k=i*3,dx=now[k]-previous[k],dy=now[k+1]-previous[k+1],dz=now[k+2]-previous[k+2];movement2=Math.max(movement2,dx*dx+dy*dy+dz*dz);previous[k]=now[k];previous[k+1]=now[k+1];previous[k+2]=now[k+2];}this.bodyMotionClock+=Math.sqrt(movement2);if(movement2>0)this.surface.refit(now);this.metrics.refitMS=performance.now()-start;this.metrics.contacts=0;this.metrics.guidedCrotchContacts=0;this.metrics.maxCorrectionMM=0;this.metrics.queries=0;this.metrics.safelySkippedQueries=0;}
 query(x,y,z,cache,id,margin){
  const k=id*3;if(this.world.acceleration?.config?.contactReuse!==false&&cache.faces[id]>=0&&this.bodyMotionClock===cache.clock[id]&&x===cache.points[k]&&y===cache.points[k+1]&&z===cache.points[k+2]&&cache.distance[id]>=margin-.00001){this.metrics.safelySkippedQueries++;return null;}
  const f=this.surface.nearest(x,y,z,Infinity,cache.faces[id]);cache.faces[id]=f;const q=this.surface.evaluate(f,x,y,z,this.q);cache.points[k]=x;cache.points[k+1]=y;cache.points[k+2]=z;cache.distance[id]=q[0];cache.clock[id]=this.bodyMotionClock;this.metrics.queries++;return q;
 }
 projectCoarse(dt){const start=performance.now(),m=this.model,margin=m.source.settings.clearanceMM*.001;
  for(let i=0;i<m.count;i++){if(m.weight[i]<.02)continue;const k=i*3,q=this.query(m.ref[k]+m.delta[k],m.ref[k+1]+m.delta[k+1],m.ref[k+2]+m.delta[k+2],this.coarseCache,i,margin);if(!q)continue;const depth=Math.min(.06,margin-q[0]);if(depth<=.00001)continue;for(let j=0;j<3;j++){const correction=q[j+1]*depth;m.delta[k+j]+=correction;m.velocity[k+j]+=correction/dt;}this.metrics.contacts++;this.metrics.maxCorrectionMM=Math.max(this.metrics.maxCorrectionMM,depth*1000);}
  this.metrics.coarseMS=performance.now()-start;
 }
 crotchEscape(x,y,z,ids,margin,side=0){
  const rest=this.rest;let rx=0,ry=0,rz=0;for(const i of ids){rx+=rest[i*3]/ids.length;ry+=rest[i*3+1]/ids.length;rz+=rest[i*3+2]/ids.length;}
  if(Math.abs(rx)>.075||ry<-.36||ry>.02)return null;
  // A nearest-surface gradient can point into the closing gap between thighs.
  // Preserve the material front/back side in the transported pelvis frame and
  // find an actual collision-free point along that direction on the native mesh.
  // Every crotch panel uses the same pelvis frame. Independent thigh frames
  // rotate apart during a stride and can drive neighboring cloth in opposition.
  // Front/back identity belongs to the original material panel, not fitted z.
  const M=this.world.actor.skin[this.pelvisBone],d=this.direction,sign=side?Math.sign(side):rz>=0?1:-1;d[0]=-M[1]*sign;d[1]=-M[9]*sign;d[2]=M[5]*sign;
  const length=Math.hypot(...d)||1;for(let j=0;j<3;j++)d[j]/=length;
  const q=this.q;let lo=0,hi=.002,found=false;for(;hi<=.080001;hi+=.002){this.surface.sample(x+d[0]*hi,y+d[1]*hi,z+d[2]*hi,q);this.metrics.queries++;if(q[0]>=margin){found=true;break;}lo=hi;}
  if(!found)return null;
  for(let k=0;k<7;k++){const mid=(lo+hi)*.5;this.surface.sample(x+d[0]*mid,y+d[1]*mid,z+d[2]*mid,q);this.metrics.queries++;if(q[0]>=margin)hi=mid;else lo=mid;}
  this.metrics.guidedCrotchContacts=(this.metrics.guidedCrotchContacts||0)+1;return[d[0]*hi,d[1]*hi,d[2]*hi];
 }
 projectFine(){const start=performance.now(),s=this.model.source,p=s.p,F=s.faces,w=s.w,nominalMargin=s.settings.clearanceMM*.001;
  // The closing thigh gap can be narrower than twice the nominal clearance.
  // Preserve its 4 mm fit target first, then resolve residual penetration with
  // a 1 mm local contact margin rather than opposing impossible 4 mm offsets.
  let passes=0;for(let pass=0;pass<32;pass++){const margin=pass<16?nominalMargin:Math.min(nominalMargin,.001);let maximum=0;passes++;
   for(const i of this.vertices){if(w[i]===0)continue;const k=i*3,q=this.query(p[k],p[k+1],p[k+2],this.vertexCache,i,margin);if(!q)continue;const depth=Math.min(.06,margin-q[0]);if(depth<=.00001)continue;maximum=Math.max(maximum,depth);const normal=[q[1]*depth,q[2]*depth,q[3]*depth],escape=pass>=31&&q[0]<0?this.crotchEscape(p[k],p[k+1],p[k+2],[i],margin,this.vertexSide[i]):null,correction=escape||normal;for(let j=0;j<3;j++)p[k+j]+=correction[j];this.metrics.contacts++;this.metrics.maxCorrectionMM=Math.max(this.metrics.maxCorrectionMM,Math.hypot(...correction)*1000);}
   for(let n=0;n<this.triangles.length;n++){
    const f=this.triangles[n],a=F[f],b=F[f+1],c=F[f+2],den=(w[a]+w[b]+w[c])/9;if(!den)continue;
    const x=(p[a*3]+p[b*3]+p[c*3])/3,y=(p[a*3+1]+p[b*3+1]+p[c*3+1])/3,z=(p[a*3+2]+p[b*3+2]+p[c*3+2])/3,q=this.query(x,y,z,this.triangleCache,n,margin);if(!q)continue;const depth=Math.min(.06,margin-q[0]);if(depth<=.00001)continue;maximum=Math.max(maximum,depth);
    const normal=[q[1]*depth,q[2]*depth,q[3]*depth],escape=pass>=31&&q[0]<0?this.crotchEscape(x,y,z,[a,b,c],margin,this.faceSide[f/3]):null,correction=escape||normal;
    // Contact reconstruction translates a material triangle coherently. Using
    // inverse vertex lumped masses here amplifies tiny seam-split triangles and
    // creates spikes; dynamics and its mass matrix remain on the coarse model.
    const movable=[a,b,c].filter(i=>w[i]>0),scale=3/movable.length;
    for(const i of movable)for(let j=0;j<3;j++)p[i*3+j]+=scale*correction[j];this.metrics.contacts++;this.metrics.maxCorrectionMM=Math.max(this.metrics.maxCorrectionMM,Math.hypot(...correction)*1000);
   }if(maximum<.00005)break;
  }
  let maxFineOffset=0;for(const i of this.vertices){const k=i*3,d=Math.hypot(p[k]-this.model.fineRef[k],p[k+1]-this.model.fineRef[k+1],p[k+2]-this.model.fineRef[k+2]);if(!Number.isFinite(d)||d>.3)throw Error('裤装区域接触状态越界 '+i+' '+(d*1000).toFixed(2)+' mm; guided '+this.metrics.guidedCrotchContacts+' max correction '+this.metrics.maxCorrectionMM);maxFineOffset=Math.max(maxFineOffset,d);}
  this.metrics.maxFineOffsetMM=maxFineOffset*1000;this.metrics.passes=passes;this.metrics.fineMS=performance.now()-start;
 }
}
