/* Explicit recipe build. Camera, frame clock and material controls are absent. */
'use strict';
function generateScene(config,progress=()=>{}){
 const W=World,w=W.create(config),start=performance.now(),parts=[],step=.5;
 progress(.02,'构造原岩与有限裂隙');
 const fullMain=W.mesh(w.rock,[-33,-7,-25],[27,54,24],step,p=>progress(.02+p*.37,'由体积函数提取固定网格'));
 const mainGroups=W.splitComponents(fullMain),main=mainGroups[0],looseSources=mainGroups.slice(1).map(p=>({mesh:p,event:0}));
 const grid=fullMain.grid;main.name='主岩体';main.kind=0;main.event=0;main.rest=main.positions.slice();main.N=W.normals(main.positions,main.indices);parts.push(main);
 const eventRecords=[],fragmentFields=[];
 if(config.stage>=3)for(const e of w.events){
  let lo=e.center.map((v,i)=>Math.floor((v-e.half[i]-4)/step)*step),hi=e.center.map((v,i)=>Math.ceil((v+e.half[i]+4)/step)*step);
  const full=W.mesh((x,y,z)=>w.sourceFragment(e,x,y,z),lo,hi,step),groups=W.splitComponents(full),m=groups[0];for(let p of groups.slice(1))looseSources.push({mesh:p,event:e.id});m.rest=m.positions.slice();m.kind=1;m.name=e.name;m.event=e.id;
  let a=e.yaw,b=e.angle,ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b),R=e.id===2?[ca*cb,ca*sb,sa,-sb,cb,0,-sa*cb,-sa*sb,ca]:[ca*cb+sa*sb,ca*sb-sa*cb,0,0,0,1,-sa*cb+ca*sb,-sa*sb-ca*cb,0];
  let minGap=Infinity;for(let i=0;i<m.positions.length;i+=3){let q=[m.rest[i]-e.center[0],m.rest[i+1]-e.center[1],m.rest[i+2]-e.center[2]],p=[R[0]*q[0]+R[1]*q[1]+R[2]*q[2]+e.dest[0],R[3]*q[0]+R[4]*q[1]+R[5]*q[2],R[6]*q[0]+R[7]*q[1]+R[8]*q[2]+e.dest[2]];m.positions.set(p,i);minGap=Math.min(minGap,p[1]-w.ground(p[0],p[2]))}
  let dy=-minGap+.025;for(let i=1;i<m.positions.length;i+=3)m.positions[i]+=dy;
  m.N=W.normals(m.positions,m.indices);let gaps=[],inside=0;for(let i=0;i<m.positions.length;i+=3){let x=m.positions[i],y=m.positions[i+1],z=m.positions[i+2];gaps.push(y-w.ground(x,z));if(grid.at(x,y,z)<-.12)inside++}
  let vol=W.volume({positions:m.rest,indices:m.indices});eventRecords.push({...e,worldCenter:[e.dest[0],dy,e.dest[2]],rotation:R,volumeM3:vol,minGroundGapM:Math.min(...gaps),insideMotherSamples:inside,origin:'same implicit intersection',trajectory:'not_simulated',contact:'vertex to analytic surface; not stability proof'});fragmentFields.push({at:m.grid.at,R,sourceCenter:e.center,worldCenter:[e.dest[0],dy,e.dest[2]],half:e.half});parts.push(m)
 }
 const looseRecords=[];
 if(config.stage>=3){let totalP=[],totalQ=[],totalI=[];for(let li=0;li<looseSources.length;li++){let {mesh:m,event}=looseSources[li],P=m.positions,center=[0,0,0];for(let i=0;i<P.length;i+=3)for(let k=0;k<3;k++)center[k]+=P[i+k]/(P.length/3);let ext=[0,0,0];for(let i=0;i<P.length;i+=3)for(let k=0;k<3;k++)ext[k]=Math.max(ext[k],Math.abs(P[i+k]-center[k]));let thin=ext.indexOf(Math.min(...ext));let r=Math.hypot(center[0],center[2])||1,x=center[0]/r*32,z=center[2]/r*29;for(const e of eventRecords)if(Math.hypot(x-e.dest[0],z-e.dest[2])<8){x*=1.25;z*=1.25}let gap=Infinity,q=[];for(let i=0;i<P.length;i+=3){let u=P[i]-center[0],v=P[i+1]-center[1],t=P[i+2]-center[2],b=thin===0?[v,-u,t]:thin===2?[u,t,-v]:[u,v,t];let a=[b[0]+x,b[1],b[2]+z];q.push(...a);gap=Math.min(gap,a[1]-w.ground(a[0],a[2]))}for(let i=1;i<q.length;i+=3)q[i]-=gap-.015;let first=totalP.length/3;totalP.push(...q);totalQ.push(...P);for(let i of m.indices)totalI.push(i+first);looseRecords.push({id:'L'+li,event,source:center,placedAt:[x,-gap+.015,z],volumeM3:W.volume(m)})}
 if(totalP.length){let m={name:'裂隙分离的次级岩块',kind:2,event:0,positions:Float32Array.from(totalP),rest:Float32Array.from(totalQ),indices:Uint32Array.from(totalI)};m.N=W.normals(m.positions,m.indices);parts.push(m)}
 }
 progress(.45,'生成具有厚度的土体与坡积层');
 const soilField=(x,y,z)=>Math.max(y-w.ground(x,z),-7-y,w.perimeter(x,z)*40,-w.rock(x,y,z));
 const soil=W.mesh(soilField,[-55,-8,-46],[55,6,46],.75);soil.name='土体与风化基底';soil.kind=3;soil.event=0;soil.rest=soil.positions.slice();soil.N=W.normals(soil.positions,soil.indices);parts.push(soil);
 // Local soil pockets remain in upward-facing ledges; geometry is clipped outside rock.
 const pocketLocations=[];
 if(config.stage===4){let pp=[],ii=[],rr=[],off=0;for(let i=0;i<main.positions.length/3&&pocketLocations.length<18;i+=67){let k=i*3,x=main.positions[k],y=main.positions[k+1],z=main.positions[k+2];if(main.N[k+1]<.90||y<3||y>34||W.noise(x*.81,y*.77,z*.84,97)<.61)continue;if(pocketLocations.some(q=>Math.hypot(x-q[0],y-q[1],z-q[2])<5))continue;let rad=.52+W.noise(x,y,z,112)*.65,h=.12+W.noise(x,y,z,171)*.13;let support=0;for(let j=0;j<8;j++){let a=j*Math.PI/4;if(grid.at(x+Math.cos(a)*rad*.8,y-.22,z+Math.sin(a)*rad*.60)<-.05)support++}if(support<8||grid.at(x,y-.20,z)>-.05)continue;let field=(a,b,c)=>Math.max((Math.sqrt(((a-x)/rad)**2+((b-y-.08)/h)**2+((c-z)/(rad*.75))**2)-1)*h,-grid.at(a,b,c));let m=W.mesh(field,[x-rad-.3,y-h-.3,z-rad],[x+rad+.3,y+h+.4,z+rad],.22);if(!m.indices.length)continue;let first=pp.length/3;pp.push(...m.positions);rr.push(...m.positions);for(let v of m.indices)ii.push(v+first);pocketLocations.push([x,y,z,rad,h])}
 if(pp.length){let p={name:'岩阶上的积土囊',kind:3,event:0,pocket:true,positions:Float32Array.from(pp),rest:Float32Array.from(rr),indices:Uint32Array.from(ii)};p.N=W.normals(p.positions,p.indices);parts.push(p)}
 }
 // Stone-only transfer: actual source family fields, remeshed at one fixed sampling.
 // These are independent colluvial specimens, not asserted children of the three fracture events.
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
 progress(.55,'计算最终表面的遮挡与坡向');
 function sceneField(x,y,z){let v=grid.at(x,y,z);if(v<0)return v;for(const e of fragmentFields){let dx=x-e.worldCenter[0],dy=y-e.worldCenter[1],dz=z-e.worldCenter[2];if(Math.abs(dx)>11||Math.abs(dy)>11||Math.abs(dz)>11)continue;let r=e.R,q=e.sourceCenter;v=Math.min(v,e.at(r[0]*dx+r[3]*dy+r[6]*dz+q[0],r[1]*dx+r[4]*dy+r[7]*dz+q[1],r[2]*dx+r[5]*dy+r[8]*dz+q[2]))}return v}
 function shade(x,y,z,n){let ax=x+n[0]*.37,ay=y+n[1]*.37,az=z+n[2]*.37,sun=1;for(let s=.40;s<74;s+=Math.max(.6,s*.18)){let v=sceneField(ax+W.SUN[0]*s,ay+W.SUN[1]*s,az+W.SUN[2]*s);if(v<-.08){sun=.06;break}sun=Math.min(sun,W.clamp(.48+v/Math.max(.6,s*.10),.15,1))}
  let ao=1;for(let dist of [.6,1.5,3.3]){let v=sceneField(ax+n[0]*dist,ay+n[1]*dist,az+n[2]*dist);if(v<0)ao-=.19;if(n[1]<.1&&sceneField(ax,ay+dist,az)<-.05)ao-=.08}return[W.clamp(ao,.22,1),sun]}

 // Rain-area routing on the FINAL mesh. A diagnostic proxy, not a calibrated erosion solver.
 // Triangle projected areas supply exposed upper surfaces; routes strictly decrease height.
 const waterReports=[];
 function rainOnMesh(p){const P=p.positions,N=p.N,I=p.indices,count=P.length/3,source=new Float64Array(count),a=new Float64Array(count),down=new Int32Array(count).fill(-1),slope=new Float32Array(count);
  function route(i,j){const h=P[i*3+1]-P[j*3+1];if(h<=1e-6||N[i*3+1]<-.35)return;const d=Math.hypot(P[i*3]-P[j*3],h,P[i*3+2]-P[j*3+2]),s=h/Math.max(d,1e-6);if(s>slope[i]){slope[i]=s;down[i]=j;}}
  for(let k=0;k<I.length;k+=3){let i=I[k],j=I[k+1],l=I[k+2],x=i*3,y=j*3,z=l*3;
   let projected=Math.max(0,((P[y+2]-P[x+2])*(P[z]-P[x])-(P[y]-P[x])*(P[z+2]-P[x+2]))/6);
   source[i]+=projected;source[j]+=projected;source[l]+=projected;
   route(i,j);route(j,i);route(j,l);route(l,j);route(l,i);route(i,l);}
  let supply=0;for(let i=0;i<count;i++){if(source[i]===0)continue;const k=i*3,x=P[k]+N[k]*.31,y=P[k+1]+N[k+1]*.31,z=P[k+2]+N[k+2]*.31;
   let exposed=true;for(let h of [.6,2,6,16,40,62])if(sceneField(x,y+h,z)<-.05){exposed=false;break;}
   a[i]=exposed?source[i]:0;supply+=a[i];}
  const order=Array.from({length:count},(_,i)=>i).sort((i,j)=>P[j*3+1]-P[i*3+1]);let sinks=0,used=0;
  for(let i of order){if(down[i]>=0){a[down[i]]+=a[i];if(a[i]>0)used++;}else sinks+=a[i];}
  const output=Float32Array.from(a,v=>1-Math.exp(-v/7));
  // Moisture-display spreading only; does not change the directed catchment ledger above.
  for(let pass=0;pass<3;pass++){const sums=new Float32Array(output),weights=new Float32Array(count).fill(1);
   for(let k=0;k<I.length;k+=3)for(let e=0;e<3;e++){const i=I[k+e],j=I[k+(e+1)%3];const w=Math.max(0,N[i*3]*N[j*3]+N[i*3+1]*N[j*3+1]+N[i*3+2]*N[j*3+2])*.40;sums[i]+=output[j]*w;weights[i]+=w;sums[j]+=output[i]*w;weights[j]+=w;}
   for(let i=0;i<count;i++)output[i]=sums[i]/weights[i];}
  waterReports.push({part:p.name,sourceProjectedAreaM2:supply,terminalAreaM2:sinks,balanceErrorM2:Math.abs(sinks-supply),routedVertices:used,scope:'one final-surface projected-area proxy; sinks include breaks, not solved infiltration'});return output;
 }
 for(let pi=0;pi<parts.length;pi++){const p=parts[pi],P=p.positions,N=p.N,V=new Float32Array(P.length/3*16),water=p.kind<3?rainOnMesh(p):null;let over=0;
  for(let i=0;i<P.length/3;i++){let k=i*3,x=P[k],y=P[k+1],z=P[k+2],n=[N[k],N[k+1],N[k+2]],s=shade(x,y,z,n),j=i*16;V.set([x,y,z,...n,p.rest[k],p.rest[k+1],p.rest[k+2],p.kind,s[0],s[1],p.kind<3?(p.stoneShader||1):(p.pocket?.12:w.ground(x,z)-y),p.pocket?.45:w.soilThickness(x,z),p.event,water?water[i]:0],j);if(n[1]<-.18&&y>0)over++}
  p.vertices=V;p.overhangVertices=over;delete p.grid;progress(.55+.25*(pi+1)/parts.length,'表面与材料使用同一最终几何')
 }
 // Cross-section is actual filled negative-field intersection, clipped at z=0.
 function capMesh(field,lo,hi,h,kind){let P=[],I=[];function triangle(verts){let a=verts.map(v=>[...v,field(v[0],v[1],0)]),o=[];for(let k=0;k<3;k++){let u=a[k],v=a[(k+1)%3];if(u[2]<=0)o.push([u[0],u[1]]);if((u[2]<0)!==(v[2]<0)){let t=u[2]/(u[2]-v[2]);o.push([W.mix(u[0],v[0],t),W.mix(u[1],v[1],t)])}}if(o.length<3)return;let base=P.length/3;for(let v of o)P.push(v[0],v[1],.002);for(let k=1;k<o.length-1;k++)I.push(base,base+k,base+k+1)}
  for(let y=lo[1];y<hi[1];y+=h)for(let x=lo[0];x<hi[0];x+=h){triangle([[x,y],[x+h,y],[x,y+h]]);triangle([[x+h,y],[x+h,y+h],[x,y+h]])}
  let positions=Float32Array.from(P),indices=Uint32Array.from(I),V=new Float32Array(P.length/3*16);for(let i=0;i<P.length/3;i++){let x=P[i*3],y=P[i*3+1];V.set([x,y,.002,0,0,1,x,y,0,kind,.95,1,w.ground(x,0)-y,w.soilThickness(x,0),0,0],i*16)}return{name:kind===4?'岩体截面':'土壤截面',kind,event:0,positions,indices,vertices:V,cap:true};
 }
 parts.push(capMesh(w.rock,[-33,-7],[27,53],.5,4));
 // Soil cap excludes rock, so the two filled sections never falsely cover one another.
 parts.push(capMesh((x,y,z)=>Math.max(soilField(x,y,z),-w.rock(x,y,z)),[-54,-7],[54,5],.5,5));
 // Exact packing: static material coordinates alias positions. No quantization or face removal.
 let unpackedBytes=0;for(const p of parts){unpackedBytes+=p.vertices.byteLength+p.indices.byteLength;p.stride=16;
  if(p.kind===0||p.kind===3||p.kind===6){const old=p.vertices,n=old.length/16,v=new Float32Array(n*13);
   for(let i=0;i<n;i++){const a=i*16,b=i*13;v.set(old.subarray(a,a+6),b);v.set(old.subarray(a+9,a+16),b+6);}p.vertices=v;p.stride=13;}}
 const report={config:{...config},builtInMs:performance.now()-start,geometryGridM:step,mainVertices:main.positions.length/3,mainTriangles:main.indices.length/3,overhangVertices:main.overhangVertices,looseComponentCount:looseSources.length,looseComponentsPlaced:looseRecords,sourceGeography:'authored local specimen; not surveyed Putao',yearsCalibrated:false,events:eventRecords,soilPockets:pocketLocations,statisticalGravel:accepted,brickStoneTransfer:stoneRecords,materialSource:{repo:"haihao0307/HOUSE",commit:"53a4b0728678e31ba4ebf2a9267a213597d8f226",path:"experiments/atelier-r4/src/renderer.js",interpretation:"user-selected limestone-look candidate; source categories retain their original names"},parts:parts.map(p=>({name:p.name,kind:p.kind,vertices:p.positions.length/3,triangles:p.indices.length/3,signature:W.checksum(p.positions)+':'+W.checksum(p.indices)}))};
 let bytes=parts.reduce((s,p)=>s+p.vertices.byteLength+p.indices.byteLength,0);report.generatedRenderBytes=bytes;report.unpackedRenderBytes=unpackedBytes;report.waterRouting=waterReports;
 for(const p of parts){delete p.N;delete p.rest;delete p.positions}
 progress(1,'完成');return {parts,report};
}
if(typeof module!=='undefined')module.exports=generateScene;
