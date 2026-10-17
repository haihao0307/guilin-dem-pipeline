/* Original graph microrelief kernel. All distances are millimetres.
 * Research: Weiss et al., Graph-Based Synthesis for Skin Micro Wrinkles, 2023.
 * No author code, reference pixels, captured geometry or learned assets used.
 * Our periodic CPU simulation and C2 profiles are a browser implementation;
 * they are not the paper's CUDA / UV-geodesic / reconstruction pipeline. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SkinGraphKernel=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const TAU=Math.PI*2,clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),wrap=(x,L)=>(x%L+L)%L;
 function random(seed){let n=seed>>>0;return()=>{n+=0x6D2B79F5;let t=Math.imul(n^n>>>15,1|n);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};}
 function delta(a,b,L){let d=b-a;return d-L*Math.round(d/L);}
 function smooth(t){t=clamp(t,0,1);return t*t*t*(10+t*(-15+6*t));}
 // Authored finite profiles: C2 centre, shoulders and support boundary.
 function profile(r,bulge=.13){r=Math.abs(r);if(r>=3)return 0;if(r<=1)return -(1-smooth(r));const t=(r-1)*.5;return bulge*64*t*t*t*(1-t)*(1-t)*(1-t);}
 function poreProfile(r){return profile(r,.055);}
 function orientation(angle,target,base=.18,spread=.32){let d=angle-target;d=Math.atan2(Math.sin(d*2),Math.cos(d*2))*.5;return base+Math.exp(-d*d/(spread*spread));}
 function sampleNodes({period=12,spacing=.65,seed=731,initial=[]}){
  const rng=random(seed),nodes=initial.map(p=>({x:p.x,y:p.y})),min=spacing*.72,nGrid=Math.max(1,Math.floor(period/min)),cell=period/nGrid,buckets=Array.from({length:nGrid*nGrid},()=>[]);
  const index=(x,y)=>wrap(Math.floor(y/cell),nGrid)*nGrid+wrap(Math.floor(x/cell),nGrid);
  nodes.forEach((p,i)=>buckets[index(p.x,p.y)].push(i));
  const target=Math.round(period*period/(spacing*spacing));let fails=0;
  while(nodes.length<target&&fails<target*65){const x=rng()*period,y=rng()*period,gx=Math.floor(x/cell),gy=Math.floor(y/cell);let ok=true;
   for(let j=-1;j<=1&&ok;j++)for(let i=-1;i<=1&&ok;i++)for(const id of buckets[wrap(gy+j,nGrid)*nGrid+wrap(gx+i,nGrid)]){const p=nodes[id];if(delta(x,p.x,period)**2+delta(y,p.y,period)**2<min*min){ok=false;break;}}
   if(ok){const id=nodes.length;nodes.push({x,y});buckets[index(x,y)].push(id);fails=0;}else fails++;
  }return nodes;
 }
 function makeGraph(nodes,{period=12,spacing=.65,neighbors=6}){
  const edges=[],adj=nodes.map(()=>[]),seen=new Set(),nGrid=Math.max(1,Math.floor(period/(spacing*1.6))),cell=period/nGrid,buckets=Array.from({length:nGrid*nGrid},()=>[]);
  nodes.forEach((p,i)=>buckets[wrap(Math.floor(p.y/cell),nGrid)*nGrid+wrap(Math.floor(p.x/cell),nGrid)].push(i));
  for(let i=0;i<nodes.length;i++){const p=nodes[i],gx=Math.floor(p.x/cell),gy=Math.floor(p.y/cell),candidates=new Map();
   for(let y=-2;y<=2;y++)for(let x=-2;x<=2;x++)for(const j of buckets[wrap(gy+y,nGrid)*nGrid+wrap(gx+x,nGrid)])if(j!==i){const dx=delta(p.x,nodes[j].x,period),dy=delta(p.y,nodes[j].y,period);candidates.set(j,{j,dx,dy,d:Math.hypot(dx,dy)});}
   const near=[...candidates.values()].sort((a,b)=>a.d-b.d).slice(0,neighbors);
   for(const n of near){const key=Math.min(i,n.j)+':'+Math.max(i,n.j);if(seen.has(key))continue;seen.add(key);const e={a:i,b:n.j,dx:n.dx,dy:n.dy,d:n.d,theta:Math.atan2(n.dy,n.dx),w:0,cross:[]};const id=edges.length;edges.push(e);adj[i].push({id,angle:e.theta,to:n.j});adj[n.j].push({id,angle:e.theta+Math.PI,to:i});}
  }
  // Spatially hashed, periodic segment intersections; shared endpoints are junctions.
  const crossBuckets=new Map(),crossSeen=new Set(),crossCell=spacing*2;
  const orient=(ax,ay,bx,by,cx,cy)=>(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
  for(let id=0;id<edges.length;id++){const e=edges[id],a=nodes[e.a];
   for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){const ax=a.x+ox*period,ay=a.y+oy*period,bx=ax+e.dx,by=ay+e.dy;
    const loX=Math.floor(Math.min(ax,bx)/crossCell),hiX=Math.floor(Math.max(ax,bx)/crossCell),loY=Math.floor(Math.min(ay,by)/crossCell),hiY=Math.floor(Math.max(ay,by)/crossCell);
    for(let y=loY;y<=hiY;y++)for(let x=loX;x<=hiX;x++){const key=x+','+y,list=crossBuckets.get(key)||[];
     for(const q of list){const f=edges[q.id];if(f.a===e.a||f.a===e.b||f.b===e.a||f.b===e.b)continue;const pair=Math.min(id,q.id)+':'+Math.max(id,q.id);if(crossSeen.has(pair))continue;
      if(orient(ax,ay,bx,by,q.ax,q.ay)*orient(ax,ay,bx,by,q.bx,q.by)<-1e-12&&orient(q.ax,q.ay,q.bx,q.by,ax,ay)*orient(q.ax,q.ay,q.bx,q.by,bx,by)<-1e-12){crossSeen.add(pair);e.cross.push(q.id);f.cross.push(id);}}
     list.push({id,ax,ay,bx,by});crossBuckets.set(key,list);
    }
   }
  }return{nodes,edges,adj,period,spacing};
 }
 function simulate(graph,{seed=731,angle=0,uniformity=.18,continuation=.28,similarity=.12,crossing=.65,distance=1.2,deposit=.65,decay=.35,epochs=55,visits=0,competitionSpread=.38,persistence=0,flowVariation=0}={}){
  const rng=random(seed),{nodes,edges,adj,spacing}=graph,dt=.06,batch=visits||Math.max(edges.length,1000),scores=[];
  const gauss=a=>Math.exp(-((Math.atan2(Math.sin(a),Math.cos(a))/.38)**2));
  for(let epoch=0;epoch<epochs;epoch++){
   for(let t=0;t<batch;t++){const node=Math.floor(rng()*nodes.length),fan=adj[node];let sum=0;
    for(let j=0;j<fan.length;j++){const h=fan[j],e=edges[h.id];let reward=0,penalty=0;for(const other of fan)if(other.id!==h.id){const w=edges[other.id].w;reward+=w*continuation*gauss(h.angle-other.angle-Math.PI);penalty+=w*similarity*Math.exp(-((Math.atan2(Math.sin(h.angle-other.angle),Math.cos(h.angle-other.angle))/competitionSpread)**2));}
     let cross=0;for(const id of e.cross)cross+=edges[id].w;
     const p=nodes[node],localAngle=angle+flowVariation*(Math.sin(TAU*p.x/graph.period+.73)+.65*Math.sin(TAU*p.y/graph.period+1.61));
     const pref=orientation(h.angle,localAngle,uniformity),score=Math.max(0,((1-continuation)*pref+reward-penalty-crossing*cross)/Math.pow(e.d/spacing,distance))*Math.pow(.05+e.w,persistence);scores[j]=score;sum+=score;
    }
    if(sum>0){let pick=rng()*sum;for(let j=0;j<fan.length;j++)if((pick-=scores[j])<=0){const e=edges[fan[j].id];e.w+=dt*deposit*(1-e.w);break;}}
   }
   const fade=Math.max(0,1-dt*decay*batch/Math.max(1,edges.length));for(const e of edges)e.w*=fade;
  }return graph;
 }
 function drawField(graph,{resolution=1024,kind='wrinkles',depth=.020,width=.045,bulge=.12,cushion=.15,poreWidth=.055,poreDepth=.030,seed=1,poreSkew=0,poreStart=0,flowAngle=0,cellVolume=0}={}){
  const N=resolution,L=graph.period,step=L/N,beta=20,expected=24,negative=new Float32Array(N*N),positive=new Float32Array(N*N),counts=new Uint16Array(N*N),rng=random(seed),{nodes,edges,adj}=graph;
  const accumulate=(ix,iy,s)=>{const i=wrap(iy,N)*N+wrap(ix,N);negative[i]+=Math.expm1(beta*Math.max(0,-s));positive[i]+=Math.expm1(beta*Math.max(0,s));counts[i]++;};
  if(kind==='wrinkles')for(let eid=0;eid<edges.length;eid++){const e=edges[eid];if(e.w<.015)continue;const a=nodes[e.a],w=width*(.65+.65*e.w),extent=3*w,amplitude=e.w*(.88+rng()*.24),perturb=(rng()-.5)*graph.spacing*.10;
   const endpoint=(node,baseAngle,reverse)=>{let vx=0,vy=0,total=0;for(const h of adj[node])if(h.id!==eid){const q=edges[h.id],d=Math.atan2(Math.sin(h.angle-baseAngle-Math.PI),Math.cos(h.angle-baseAngle-Math.PI)),v=q.w*q.w*Math.exp(-((d/.65)**2));vx+=Math.cos(h.angle)*v;vy+=Math.sin(h.angle)*v;total+=v;}if(total<.015)return 0;const sign=reverse?1:-1,tx=e.dx/e.d+sign*vx/total,ty=e.dy/e.d+sign*vy/total;return clamp((tx*e.dy-ty*e.dx)/Math.max(.05,tx*e.dx+ty*e.dy)*e.d,-e.d*.30,e.d*.30);};
   const m0=endpoint(e.a,e.theta,false),m1=endpoint(e.b,e.theta+Math.PI,true),padding=Math.max(Math.abs(m0),Math.abs(m1))*.3+Math.abs(perturb);
   const x0=Math.floor((Math.min(a.x,a.x+e.dx)-extent-padding)/step),x1=Math.ceil((Math.max(a.x,a.x+e.dx)+extent+padding)/step),y0=Math.floor((Math.min(a.y,a.y+e.dy)-extent-padding)/step),y1=Math.ceil((Math.max(a.y,a.y+e.dy)+extent+padding)/step);
   for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const px=(x+.5)*step-a.x,py=(y+.5)*step-a.y,t=clamp((px*e.dx+py*e.dy)/(e.d*e.d),0,1),bend=m0*t*(1-t)*(1-t)-m1*t*t*(1-t)+16*t*t*(1-t)*(1-t)*perturb;
    const signed=(px*e.dy-py*e.dx)/e.d-bend,along=(px*e.dx+py*e.dy)/e.d,extra=along<0?-along:along>e.d?along-e.d:0,r=Math.hypot(signed,extra)/w;if(r>=3)continue;
    const near=Math.pow(Math.abs(t*2-1),4),strength=amplitude*(1+cushion*near);accumulate(x,y,profile(r,bulge)*strength);}
  }
  else for(let k=poreStart;k<nodes.length;k++){const p=nodes[k],fan=adj[k],weights=fan.map(h=>edges[h.id].w),max=Math.max(0,...weights),sum=weights.reduce((a,b)=>a+b,0),strength=Math.min(1.05,Math.max(max+.12,max+.12*(sum-max))),radius=poreWidth*(.70+rng()*.60);
   // An undirected structure tensor aligns the mouth with reinforced creases.
   // Area is preserved as the mouth elongates; mild skew avoids stamped circles.
   let tx=0,ty=0,tw=0;for(const h of fan){const w=edges[h.id].w**2;tx+=w*Math.cos(2*h.angle);ty+=w*Math.sin(2*h.angle);tw+=w;}
   const coherence=Math.hypot(tx,ty)/Math.max(1e-8,tw),angle=tw>1e-7?.5*Math.atan2(ty,tx):flowAngle,c=Math.cos(angle),s=Math.sin(angle),elongation=1+poreSkew*(.3+.7*coherence),aspect=Math.sqrt(elongation),extent=3*radius*aspect,skew=(rng()-.5)*.28*poreSkew;
   for(let y=Math.floor((p.y-extent)/step);y<=Math.ceil((p.y+extent)/step);y++)for(let x=Math.floor((p.x-extent)/step);x<=Math.ceil((p.x+extent)/step);x++){const dx=(x+.5)*step-p.x,dy=(y+.5)*step-p.y,u=(dx*c+dy*s)/(radius*aspect),v=(-dx*s+dy*c)*aspect/radius,r=Math.hypot(u,v)*(1+skew*Math.tanh(u));if(r<3)accumulate(x,y,poreProfile(r)*strength);}
  }
  const field=new Float32Array(N*N),scale=kind==='pores'?poreDepth:depth;
  for(let i=0;i<field.length;i++){const denom=Math.max(expected,counts[i]);field[i]=(Math.log1p(positive[i]/denom)-Math.log1p(negative[i]/denom))/beta*scale;}
  if(kind==='wrinkles'&&cellVolume>0){
   // Smooth cell fullness from a periodic distance transform of reinforced
   // primary creases. This is surface relief, never a colour outline.
   const dist=new Float32Array(N*N).fill(1e6),limit=.30,diag=Math.SQRT2;
   for(let i=0;i<field.length;i++)if(field[i]<-depth*.12)dist[i]=0;
   for(let pass=0;pass<3;pass++)for(const dir of [1,-1])for(let yy=0;yy<N;yy++)for(let xx=0;xx<N;xx++){const x=dir>0?xx:N-1-xx,y=dir>0?yy:N-1-yy,i=y*N+x;dist[i]=Math.min(dist[i],dist[y*N+wrap(x-dir,N)]+1,dist[wrap(y-dir,N)*N+x]+1,dist[wrap(y-dir,N)*N+wrap(x-dir,N)]+diag);}
   for(let i=0;i<field.length;i++)field[i]+=cellVolume*smooth(Math.min(1,dist[i]*step/limit));
  }return field;
 }
 function mergeFields(fields){const out=new Float32Array(fields[0].length);for(const f of fields)for(let i=0;i<out.length;i++)out[i]+=f[i];return out;}
 // Store mean slopes and their second moment; averaging mips preserves variance.
 // RG = signed slopes, B = |slope|², A = signed height in millimetres.
 function moments(field,N,period){const s=period/N,out=new Float32Array(N*N*4);for(let y=0;y<N;y++)for(let x=0;x<N;x++){const i=y*N+x,j=i*4,dx=(field[y*N+wrap(x+1,N)]-field[y*N+wrap(x-1,N)])/(2*s),dy=(field[wrap(y+1,N)*N+x]-field[wrap(y-1,N)*N+x])/(2*s);out[j]=dx;out[j+1]=dy;out[j+2]=dx*dx+dy*dy;out[j+3]=field[i];}return out;}
 function half(x){if(!Number.isFinite(x))throw Error('Nonfinite microrelief');const sign=x<0?32768:0;x=Math.abs(x);if(x<2**-24)return sign;if(x<2**-14)return sign+Math.round(x*2**24);let e=Math.floor(Math.log2(x)),m=Math.round((x/2**e-1)*1024);if(m===1024){e++;m=0;}return sign+((e+15)<<10)+m;}
 function mipChain(field,N,period){let floats=moments(field,N,period),n=N;const mips=[];let clipped=0;while(true){const data=new Uint16Array(n*n*4);for(let i=0;i<data.length;i++)data[i]=half(floats[i]);mips.push({data,width:n,height:n});if(n===1)break;
   const next=new Float32Array(n*n);for(let y=0;y<n/2;y++)for(let x=0;x<n/2;x++)for(let k=0;k<4;k++)next[(y*n/2+x)*4+k]=(floats[(y*2*n+x*2)*4+k]+floats[(y*2*n+x*2+1)*4+k]+floats[((y*2+1)*n+x*2)*4+k]+floats[((y*2+1)*n+x*2+1)*4+k])*.25;floats=next;n/=2;
  }return{mips,clipped};}
 function stats(field){let min=Infinity,max=-Infinity,sum=0,sum2=0;for(const x of field){min=Math.min(min,x);max=Math.max(max,x);sum+=x;sum2+=x*x;}return{minMM:min,maxMM:max,meanMM:sum/field.length,rmsMM:Math.sqrt(sum2/field.length)};}
 function build(options={}){
  const start=Date.now(),{seed=731,resolution=1024,period=12,density=1,width=1,poreWidth=1}=options;
  if(!Number.isInteger(seed)||!Number.isInteger(resolution)||resolution<64||resolution>2048||(resolution&(resolution-1))||!Number.isFinite(period)||period<=0||![density,width].every(x=>Number.isFinite(x)&&x>=.5&&x<=2)||!Number.isFinite(poreWidth)||poreWidth<.25||poreWidth>2)throw Error('Invalid graph generation options');
  const layers=[],pores=[],wrinkles=[];let initial=[];
  const configs=[{spacing:.78,depth:.020,width:.047,poreWidth:.058,poreDepth:.024,uniformity:.08,angle:0,continuation:.75,similarity:1.2,competitionSpread:1,crossing:1.8,cellVolume:.0025}, {spacing:.39,depth:.008,width:.023,poreWidth:.027,poreDepth:.007,uniformity:.24,angle:.65,continuation:.65,similarity:.9,competitionSpread:1,crossing:1.5}, {spacing:.195,depth:.0028,width:.013,poreWidth:.013,poreDepth:.0018,uniformity:.65,angle:1.25,continuation:.5,similarity:.65,competitionSpread:.9,crossing:1.3}];
  for(let level=0;level<configs.length;level++){const c=configs[level],spacing=c.spacing/density,nodes=sampleNodes({period,spacing,seed:seed+level*101,initial}),graph=makeGraph(nodes,{period,spacing,neighbors:6});simulate(graph,{seed:seed+level*701,...c,deposit:.35,decay:.8,epochs:140,flowVariation:.17});
   const draw={resolution,depth:c.depth,width:c.width*width,poreWidth:c.poreWidth*poreWidth,poreDepth:c.poreDepth,seed:seed+level*31,bulge:level===2?0:.045,poreSkew:.75,poreStart:initial.length,flowAngle:c.angle,cellVolume:c.cellVolume||0};pores.push(drawField(graph,{...draw,kind:'pores'}));wrinkles.push(drawField(graph,{...draw,kind:'wrinkles'}));
   layers.push({level,nodes:nodes.length,inheritedNodes:initial.length,edges:graph.edges.length,spacingMM:spacing,depthMM:c.depth,widthMM:draw.width,meanWeight:graph.edges.reduce((s,e)=>s+e.w,0)/graph.edges.length,orientation:graph.edges.reduce((s,e)=>s+Math.cos(2*(e.theta-c.angle))*e.w,0)/Math.max(1e-9,graph.edges.reduce((s,e)=>s+e.w,0)),graph});initial=nodes;
  }
  const poreField=mergeFields(pores),wrinkleField=mergeFields(wrinkles),poreMap=mipChain(poreField,resolution,period),wrinkleMap=mipChain(wrinkleField,resolution,period);
  return{version:'SKIN-GRAPH-KERNEL-R02',seed,resolution,period,layers,poreField,wrinkleField,poreMap,wrinkleMap,summary:{seed,resolution,periodMM:period,generationMS:Date.now()-start,layers:layers.map(({graph,...l})=>l),pores:stats(poreField),wrinkles:stats(wrinkleField),slopeClipped:poreMap.clipped+wrinkleMap.clipped,authored:true,importedSkinAssets:0,metric:'periodic reference-space millimetres',dynamicStressSimulation:false,poreOrientation:'incident-edge tensor; area-preserving skew',cellVolumeMM:.0025}};
 }
 return{random,delta,profile,poreProfile,orientation,sampleNodes,makeGraph,simulate,drawField,moments,mipChain,stats,half,build};
});
