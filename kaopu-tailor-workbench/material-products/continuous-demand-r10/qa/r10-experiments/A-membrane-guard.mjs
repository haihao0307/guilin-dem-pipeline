/** Engineering membrane bounds on the existing physical paper mesh.
 * Positions remain original material sites and welded seams; no added shell.
 * Not calibrated fabric or continuous collision certification. */
export class MembraneGuard{
 constructor(model){this.model=model;const s=model.source;this.edges=s.edges.map(e=>[e.a,e.b,e.targetRest||e.rest]);this.pinned=Uint8Array.from(s.w,x=>x===0?1:0);model.membraneOffset=new Float64Array(s.p.length);model.backup.membraneOffset=new Float64Array(s.p.length);this.base=new Float64Array(s.p.length);this.metrics={model:'physical material-edge strain projection with persistent fine correction',calibrated:false,passes:12,maxOffsetMM:0};}
 begin(p){this.base.set(p);const o=this.model.membraneOffset;for(let k=0;k<p.length;k++)p[k]+=o[k]*.96;}
 project(p){const pin=this.pinned,hi=this.model.source.family==='knit'?1.18:1.1,lo=.85;for(let pass=0;pass<12;pass++)for(const[a,b,rest]of this.edges){const ia=a*3,ib=b*3,dx=p[ia]-p[ib],dy=p[ia+1]-p[ib+1],dz=p[ia+2]-p[ib+2],L=Math.hypot(dx,dy,dz),wa=1-pin[a],wb=1-pin[b],den=wa+wb;if(L<1e-12||!den)continue;const target=Math.max(rest*lo,Math.min(rest*hi,L));if(target===L)continue;const f=Math.max(-.006,Math.min(.006,L-target))/(L*den);p[ia]-=wa*dx*f;p[ia+1]-=wa*dy*f;p[ia+2]-=wa*dz*f;p[ib]+=wb*dx*f;p[ib+1]+=wb*dy*f;p[ib+2]+=wb*dz*f;}}
 end(p){const o=this.model.membraneOffset;let max=0;for(let i=0;i<p.length;i+=3){const dx=p[i]-this.base[i],dy=p[i+1]-this.base[i+1],dz=p[i+2]-this.base[i+2],L=Math.hypot(dx,dy,dz);if(!Number.isFinite(L)||L>.25)throw Error('Material projection exceeded 250 mm');o[i]=dx;o[i+1]=dy;o[i+2]=dz;max=Math.max(max,L);}this.metrics.maxOffsetMM=max*1000;}
}
