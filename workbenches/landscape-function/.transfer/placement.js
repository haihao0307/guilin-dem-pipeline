 function orientStone(m){const I=m.indices,nf=I.length/3,n=m.positions.length/3,adj=new Int32Array(I.length).fill(-1),same=new Uint8Array(I.length),edge=new Map();for(let f=0;f<nf;f++)for(let e=0;e<3;e++){let k=f*3+e,a=I[k],b=I[f*3+(e+1)%3],key=Math.min(a,b)*n+Math.max(a,b);if(edge.has(key)){let j=edge.get(key),g=Math.floor(j/3);adj[k]=g;adj[j]=f;same[k]=same[j]=+(I[j]===a);edge.delete(key);}else edge.set(key,k);}const mark=new Int8Array(nf).fill(-1),queue=new Int32Array(nf);for(let start=0;start<nf;start++){if(mark[start]>=0)continue;let read=0,write=1;queue[0]=start;mark[start]=0;while(read<write){let f=queue[read++];for(let e=0;e<3;e++){let k=f*3+e,g=adj[k];if(g<0)continue;let want=mark[f]^same[k];if(mark[g]<0){mark[g]=want;queue[write++]=g;}else if(mark[g]!==want)throw Error('Stone orientation conflict');}}}let changed=0;for(let f=0;f<nf;f++)if(mark[f]){let k=f*3,t=I[k+1];I[k+1]=I[k+2];I[k+2]=t;changed++;}if(W.volume(m)<0)for(let k=0;k<I.length;k+=3){let t=I[k+1];I[k+1]=I[k+2];I[k+2]=t;}return changed;}
 const stoneRecords=[],placed=[],families=['stone','rubble','dressed','pebble'];let accepted=0;
 const sampler=BrickStone.rng(config.seed+47031);
 if(config.stage>=3)for(let attempt=0;attempt<260&&accepted<24;attempt++){
  let family=families[accepted%4],id=accepted,angle=sampler()*Math.PI*2,r=24+sampler()*18;
  let x=Math.cos(angle)*r,z=Math.sin(angle)*r*.79,scale=.26+sampler()**2*1.0;
  if(id<4){const front=[[-6,26],[-15,24],[-24,23],[7,28]][id];x=front[0];z=front[1];scale=id===3?.90:1.35;}
  let radius=scale*1.7;
  if(w.perimeter(x,z)>-.09||grid.at(x,w.ground(x,z)+scale,z)<radius*.85)continue;
  if(eventRecords.some(e=>Math.hypot(x-e.dest[0],z-e.dest[2])<7.0+radius))continue;
  if(placed.some(v=>Math.hypot(x-v.x,z-v.z)<radius+v.r+.30))continue;
  const seed=id<4?BrickStone.profiles[family].seed:BrickStone.derive(config.seed,'stone-'+id),shape=id<4?'sample':['sample','half','thin','long','wedge'][id%5];
  const src=BrickStone.field(family,shape,seed),raw=W.mesh(src.sample,src.bounds[0],src.bounds[1],.10),groups=W.splitComponents(raw),m=groups[0];if(!m?.indices.length)continue;
  const orientationRepairs=orientStone(m);
  const sourceSignature=W.checksum(m.positions)+':'+W.checksum(m.indices),sourceP=m.positions.slice(),yaw=sampler()*6.283185,ca=Math.cos(yaw),sa=Math.sin(yaw);
  const p=m.positions;let gap=Infinity;
  for(let k=0;k<p.length;k+=3){let u=sourceP[k]*scale,v=sourceP[k+2]*scale,t=-sourceP[k+1]*scale;p[k]=x+ca*u-sa*t;p[k+1]=v;p[k+2]=z+sa*u+ca*t;gap=Math.min(gap,p[k+1]-w.ground(p[k],p[k+2]));}
  // Include interior triangle samples in the analytic-ground support test.
  for(let k=0;k<m.indices.length;k+=3){let ids=[m.indices[k]*3,m.indices[k+1]*3,m.indices[k+2]*3];for(let wt of [[1/3,1/3,1/3],[.5,.5,0],[.5,0,.5],[0,.5,.5]]){let q=[0,0,0];for(let a=0;a<3;a++)for(let b=0;b<3;b++)q[b]+=wt[a]*p[ids[a]+b];gap=Math.min(gap,q[1]-w.ground(q[0],q[2]));}}
  const lift=-gap+.012;for(let k=1;k<p.length;k+=3)p[k]+=lift;
  m.rest=Float32Array.from(sourceP,v=>v/.13);m.N=W.normals(p,m.indices);m.kind=2;m.event=0;m.stoneShader=src.profile.shader;m.name=src.profile.name+' '+(id+1);m.brickSpecimen=true;
  // Interior original rock and large falling blocks must remain clear.
  let collision=false;for(let k=0;k<p.length;k+=3){if(grid.at(p[k],p[k+1],p[k+2])<-.01){collision=true;break}}
  if(collision)continue;
  parts.push(m);placed.push({x,z,r:radius});stoneRecords.push({id:'BM'+(id+1),family,name:src.profile.name,shape,seed,sourceSignature,source:'HOUSE@53a4b072/atelier-r4/kernel.js',scaleMetres:scale,position:[x,lift,z],yaw,gridSourceUnits:.10,orientationRepairs,triangles:m.indices.length/3,minAnalyticGroundGap:.012,contactScope:'vertices, edge midpoints and face centroids; not dynamic or full stability proof',materialCoordinate:'original specimen volume retained through rigid placement'});accepted++;
 }
