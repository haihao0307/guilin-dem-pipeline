/** Continuous nonnegative posed-body affine reference for the intact source
 * garment. This local adapter retains every native CSR contribution. It uses
 * the original ReducedCloth 75 mm support scale and positive compact kernel;
 * it is not claimed to be that source's single-nearest-triangle reference.
 */
const SUPPORT=.075;
const positiveKernel=u=>u>=1?0:(1-u)**4*(1+4*u);

function seamDistances(metric,regions){
  const distance=new Float64Array(metric.count).fill(Infinity),adj=Array.from({length:metric.count},()=>[]),heap=[];
  function push(i,d){let k=heap.length;heap.push([i,d]);while(k>0){const parent=(k-1)>>1;if(heap[parent][1]<=d)break;heap[k]=heap[parent];k=parent;}heap[k]=[i,d];}
  function pop(){const first=heap[0],last=heap.pop();if(heap.length){let k=0;while(k*2+1<heap.length){let child=k*2+1;if(child+1<heap.length&&heap[child+1][1]<heap[child][1])child++;if(heap[child][1]>=last[1])break;heap[k]=heap[child];k=child;}heap[k]=last;}return first;}
  for(let k=0;k<metric.sourceEdges.length;k++){const e=metric.sourceEdges[k],length=metric.wearerEdges[k];adj[e.a].push([e.b,length]);adj[e.b].push([e.a,length]);}
  for(let i=0;i<regions.length;i++)if(regions[i]==='lower'){distance[i]=0;push(i,0);}
  while(heap.length){const [i,d]=pop();if(d!==distance[i]||d>=SUPPORT)continue;for(const [j,l]of adj[i]){const next=d+l;if(next<distance[j]&&next<SUPPORT){distance[j]=next;push(j,next);}}}
  return distance;
}

function supportAt(P,ids,x,y,z){
  let nearest=Infinity;
  for(const i of ids){const k=i*3,d2=(P[k]-x)**2+(P[k+1]-y)**2+(P[k+2]-z)**2;if(d2<nearest)nearest=d2;}
  const radius=Math.max(SUPPORT,Math.sqrt(nearest)*1.25+.000001),out=[];let sum=0;
  for(const i of ids){const k=i*3,d=Math.hypot(P[k]-x,P[k+1]-y,P[k+2]-z);if(d>=radius)continue;const w=positiveKernel(d/radius);if(w>0){out.push([i,w]);sum+=w;}}
  if(!(sum>0))throw Error('EMPTY_CONTINUOUS_POSE_SUPPORT');for(const pair of out)pair[1]/=sum;return out;
}

export function compileContinuousGarmentReference(metric,target,source,regions){
  const P=target.positions,W=target.packet?.weights??target.rig?.weights;if(!W)throw Error('CONTINUOUS_REFERENCE_REQUIRES_COMPLETE_CSR');
  const distances=metric.role==='bottom'?seamDistances(metric,regions):new Float64Array(metric.count).fill(Infinity),rows=[];
  let minimumSupport=Infinity,maximumSupport=0,totalSupports=0,maximumBones=0,transitionSites=0,identityErrorM=0;
  for(let i=0;i<metric.count;i++){
    const k=i*3,x=metric.fittedNative[k],y=metric.fittedNative[k+1],z=metric.fittedNative[k+2],region=regions[i],combined=new Map();
    const sideBlend=region==='lower'?0:(region==='left'||region==='right')?1-positiveKernel(Math.min(1,distances[i]/SUPPORT)):1;
    if(sideBlend<1){
      // A shared left/right material seam has both owners. Normalize their
      // complete body supports separately, then give each owner equal share;
      // a sub-mm x drift must not reassign most common support to one thigh.
      // Adjacent one-leg sites inherit this SAME common field continuously.
      transitionSites++;
      for(const side of ['left','right'])for(const [j,w]of supportAt(P,source.vertices[side],x,y,z))combined.set(j,(combined.get(j)??0)+w*(1-sideBlend)*.5);
    }
    if(sideBlend>0)for(const [j,w]of supportAt(P,source.vertices[region],x,y,z))combined.set(j,(combined.get(j)??0)+w*sideBlend);
    const ids=Int32Array.from(combined.keys()),weights=Float64Array.from(combined.values()),moments=new Map();let sum=0,identityX=0,identityY=0,identityZ=0;
    for(let a=0;a<ids.length;a++){
      const j=ids[a],q=j*3,alpha=weights[a],dx=x-P[q],dy=y-P[q+1],dz=z-P[q+2];sum+=alpha;
      identityX+=alpha*P[q];identityY+=alpha*P[q+1];identityZ+=alpha*P[q+2];
      for(let n=W.ptr[j];n<W.ptr[j+1];n++){
        const joint=W.joints[n],w=alpha*W.values[n];if(w<0)throw Error('NEGATIVE_CONTINUOUS_NATIVE_CSR');if(w===0)continue;
        let offset=moments.get(joint);if(!offset){offset=[0,0,0];moments.set(joint,offset);}offset[0]+=dx*w;offset[1]+=dy*w;offset[2]+=dz*w;
      }
    }
    if(Math.abs(sum-1)>1e-12)throw Error('CONTINUOUS_REFERENCE_NONUNIT_POSITIVE_FIELD');
    const joints=Int32Array.from(moments.keys()),offsets=Float64Array.from([...moments.values()].flat());
    for(const v of moments.values()){identityX+=v[0];identityY+=v[1];identityZ+=v[2];}
    identityErrorM=Math.max(identityErrorM,Math.hypot(identityX-x,identityY-y,identityZ-z));
    minimumSupport=Math.min(minimumSupport,ids.length);maximumSupport=Math.max(maximumSupport,ids.length);totalSupports+=ids.length;maximumBones=Math.max(maximumBones,joints.length);
    rows.push({ids,weights,joints,offsets,region,sideBlend,seamDistanceM:distances[i]});
  }
  return {rows,report:{method:'continuous positive actual-body affine reference; full CSR offset moments',sourceSupportScaleM:SUPPORT,sourceKernel:'(1-u)^4 * (1+4u)',commonDomain:'equal positive left/right material ownership with separately normalized complete supports',sewnTransition:'original complete sewn-edge physical distance to common lower seam',minimumSupport,maximumSupport,totalSupports,maximumBones,transitionSites,identityErrorM,nativeWeightsTruncated:false,bodyGeometryChanged:false},
    sample(posedBody,skinMatrices,out){
      for(let i=0;i<rows.length;i++){
        const row=rows[i];let x=0,y=0,z=0;
        for(let a=0;a<row.ids.length;a++){const k=row.ids[a]*3,w=row.weights[a];x+=w*posedBody[k];y+=w*posedBody[k+1];z+=w*posedBody[k+2];}
        for(let a=0;a<row.joints.length;a++){const m=skinMatrices[row.joints[a]],k=a*3,u=row.offsets[k],v=row.offsets[k+1],w=row.offsets[k+2];x+=m[0]*u+m[1]*v+m[2]*w;y+=m[4]*u+m[5]*v+m[6]*w;z+=m[8]*u+m[9]*v+m[10]*w;}
        out[i*3]=x;out[i*3+1]=y;out[i*3+2]=z;
      }return out;
    }
  };
}
