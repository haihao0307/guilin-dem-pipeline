/** Surface-connected optical prefilter. It prevents a low-order visibility
 * field from exposing individual mesh triangles. It never changes the surface,
 * pore normals or albedo, and never connects across separate sheets or scalp.
 * This is a finite-resolution penumbra approximation, not measured diffusion. */
export class PenumbraFilter{
 constructor(g,{sigmaMM=.65,passes=10}={}){
  this.geometry=g;this.sigmaMM=sigmaMM;this.passes=passes;const W=g.attributes.eWeight.array,I=g.index.array,adj=new Map();
  for(let k=0;k<I.length;k+=3)for(let e=0;e<3;e++){const a=I[k+e],b=I[k+(e+1)%3];if(W[a]<=0||W[b]<=0)continue;if(!adj.has(a))adj.set(a,new Set());if(!adj.has(b))adj.set(b,new Set());adj.get(a).add(b);adj.get(b).add(a);}
  this.rows=[...adj].map(([i,ns])=>({i,ns:Int32Array.from(ns),weights:new Float32Array(ns.size),sum:0}));this.scratch=new Float32Array(W.length*3);this.prepare();
 }
 prepare(){const P=this.geometry.attributes.position.array,s2=2*this.sigmaMM*this.sigmaMM;for(const r of this.rows){r.sum=0;for(let a=0;a<r.ns.length;a++){const j=r.ns[a],d2=((P[r.i*3]-P[j*3])**2+(P[r.i*3+1]-P[j*3+1])**2+(P[r.i*3+2]-P[j*3+2])**2)*1e6,w=Math.exp(-d2/s2);r.weights[a]=w;r.sum+=w;}}}
 apply(data){if(data.length!==this.scratch.length)throw Error('Penumbra field size mismatch');const src=this.scratch;for(let pass=0;pass<this.passes;pass++){src.set(data);for(const r of this.rows){if(r.sum<1e-9)continue;for(let k=0;k<3;k++){let sum=0;for(let a=0;a<r.ns.length;a++)sum+=src[r.ns[a]*3+k]*r.weights[a];data[r.i*3+k]=.35*src[r.i*3+k]+.65*sum/r.sum;}}}return data;}
 report(){return{method:'positive convex prefilter on connected current-space pinna edges; no screen blur',sigmaMM:this.sigmaMM,passes:this.passes,vertices:this.rows.length,protectedVerticesFiltered:0,scratchBytes:this.scratch.byteLength,geometryModified:false,poreNormalsModified:false};}
}
