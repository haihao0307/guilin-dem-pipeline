// Native orbital tissue follows one continuous spatial field, including rim thickness.
// No front-normal membership cutoff and no separate pointwise triangle Z snapping.
export function applyOrbitalMorphology(model,p,eye,tools,s,mode='radial'){
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*t*(10+t*(-15+6*t));},point=i=>[p[i*3],p[i*3+1],p[i*3+2]],rows=[];
 for(const e of eye.eyes){const f=tools.frame(i=>tools.getLandmark(p,i),e.side),scale=clamp(f.width/.0255,.65,1.5),opening=smooth(.0006,.005,f.gap),v=e.vertices.map(i=>f.project(point(i))),c=[0,1,2].map(k=>(Math.min(...v.map(q=>q[k]))+Math.max(...v.map(q=>q[k])))*.5),radius=Math.max(...v.map(q=>Math.hypot(...q.map((x,k)=>x-c[k]))));let count=0,max=0,minimumBound=Infinity;
  for(let i=model.bodyCount;i<model.vertexCount;i++){if(!eye.skin[i])continue;const q=f.project(point(i)),t=q[0]/f.width,u=(t-.5)*2,tc=clamp(t),mid=(f.upper(tc)+f.lower(tc))*.5,y=q[1]-mid;
   const mask=smooth(-.42,-.06,t)*(1-smooth(1.06,1.42,t))*smooth(-.028*scale,-.010*scale,y)*(1-smooth(.014*scale,.035*scale,y))*smooth(-.025*scale,-.008*scale,q[2])*(1-smooth(.020*scale,.037*scale,q[2]));if(mask<1e-8)continue;
   const arc=Math.max(0,1-u*u),top=smooth(-.0015*scale,.0015*scale,y),near=1-smooth(.007*scale,.023*scale,Math.abs(y));
   const dx=(q[0]-f.width*.5)*.15*s.eyeWidth*mask;
   const dy=(y*.32*s.eyeOpening+.00110*scale*s.upperArch*arc*top-.00090*scale*s.lowerArch*arc*(1-top)+.00060*scale*s.eyeApex*arc*u*top)*opening*near*mask+.0026*scale*s.eyeTilt*u*mask;
   const hood=.00060*scale*s.eyeHood*Math.exp(-(((y-.007*scale)/(.006*scale))**2))*smooth(.0015*scale,.005*scale,y)*opening*arc*mask;
   let next;if(mode==='radial'){const a=q.map((x,k)=>x-c[k]),r=Math.hypot(...a),b=[a[0]+dx,a[1]+dy,a[2]],l=Math.hypot(...b),bound=Math.min(r,radius+.00010*scale),nr=Math.max(bound,r+hood);next=b.map((x,k)=>c[k]+x*nr/l);minimumBound=Math.min(minimumBound,nr-bound);}else next=[q[0]+dx,q[1]+dy,q[2]+hood];
   const d=next.map((x,k)=>x-q[k]),n=Math.hypot(...d);if(n<1e-10)continue;for(let k=0;k<3;k++)p[i*3+k]+=f.x[k]*d[0]+f.y[k]*d[1]+f.z[k]*d[2];count++;max=Math.max(max,n*1000);
  }
  const after=tools.frame(i=>tools.getLandmark(p,i),e.side);rows.push({side:e.side,changedVertices:count,widthMM:after.width*1000,openingMM:after.gap*1000,priorWidthMM:f.width*1000,priorOpeningMM:f.gap*1000,maxIncrementMM:max,closureGate:opening,minimumBaselineBoundMarginMM:Number.isFinite(minimumBound)?minimumBound*1000:null,contactMeaning:'coherent radial envelope: points originally inside the enclosing native-eye sphere keep their radius; outer points stay outside the envelope; not a triangle-intersection repair',sourceEyeballVerticesChanged:false});
 }
 return rows;
}
