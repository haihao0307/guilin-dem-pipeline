/* Coral Branch Study — independent visual reconstruction of the USER VIDEO.
   Inferred curved branching graph -> local capsule field -> connected isosurface.
   No claim that these are the original Cinema 4D rules or biological growth rates. */
function coralWorkerMain(){
'use strict';
const V={add:(a,b)=>a.map((v,i)=>v+b[i]),sub:(a,b)=>a.map((v,i)=>v-b[i]),mul:(a,s)=>a.map(v=>v*s),mix:(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t),length:a=>Math.hypot(...a)};
const unit=a=>V.mul(a,1/(V.length(a)||1)),smooth=t=>t*t*(3-2*t);
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function visualFanGraph(){
 const bs=[];const bz=(b,t)=>b.a.map((v,i)=>(1-t)*(1-t)*v+2*t*(1-t)*b.b[i]+t*t*b.c[i]);
 const add=(a,b,c,r,parent=-1,birth=0,end=.28,terminal=false,flare=0)=>{const id=bs.length;bs.push({id,parent,a,b,c,radius:r,gen:parent<0?0:bs[parent].gen+1,colony:parent<0?id:bs[parent].colony,birth,end,terminal,depthScale:1.4,flare});return id};
 const leaf=(parent,t,dest,width,spread,birth,side=0)=>{
   const a=bz(bs[parent],t),dir=unit(V.sub(dest,a)),b=V.mix(a,dest,.53);b[2]+=.035;
   const start=Math.max(birth,bs[parent].birth+t*(bs[parent].end-bs[parent].birth)),end=start+.20;
   const id=add(a,b,dest,width*.70,parent,start,end,false,.50);bs[id].depthScale=2.2;bs[id].attachmentFraction=t;
   for(let n=-1;n<=1;n++){
    const perpendicular=[-dir[1],dir[0],0];const tip=V.add(V.add(dest,V.mul(dir,.20+(n===0?.065:0))),V.mul(perpendicular,n*spread));tip[2]+=.022*n;
    add(dest,V.mix(dest,tip,.55),tip,width*.46,id,end,end+.12,true,.25);
   }
   return id;
 };
 const right=add([.43,-.35,-.015],[.42,.29,-.03],[.58,.86,.015],.067,-1,0,.48,false,.05);
 leaf(right,.28,[1.30,.12,-.025],.078,.115,.23);
 leaf(right,.62,[.99,.65,-.015],.082,.10,.33);
 leaf(right,.91,[.87,1.02,.005],.083,.10,.43);
 leaf(right,1,[.53,1.16,.01],.082,.092,.48);
 const left=add([-.18,-.34,.015],[-.27,.30,.035],[-.25,.98,.035],.074,-1,0,.49,false,.13);
 leaf(left,.16,[-.55,-.08,.09],.076,.086,.13);
 leaf(left,.38,[-.65,.32,.04],.088,.10,.24);
 leaf(left,.62,[-.58,.71,.09],.089,.104,.34);
 leaf(left,.88,[-.40,1.01,.03],.087,.12,.44);
 leaf(left,1,[-.08,1.25,.025],.084,.12,.49);
 // Surface-facing buds visible between the broad fans.
 leaf(left,.26,[-.01,-.07,.25],.042,.055,.33);
 leaf(left,.63,[-.10,.57,.25],.045,.05,.45);
 const lower=add([-.15,-.51,.06],[-.03,-.73,.11],[.12,-1.04,.10],.078,-1,0,.37,false,.22);
 leaf(lower,.05,[-.47,-.40,.15],.064,.081,.14);
 leaf(lower,.18,[-.43,-.69,.18],.076,.073,.18);
 leaf(lower,.31,[-.07,-.34,.18],.063,.071,.25);
 leaf(lower,.54,[.29,-.65,.20],.067,.075,.27);
 leaf(lower,.77,[-.21,-.94,.16],.061,.074,.33);
 leaf(lower,1,[.19,-1.10,.10],.067,.072,.37);
 const maximum=Math.max(...bs.map(b=>b.end));for(const b of bs){b.birth/=maximum;b.end/=maximum}
 return bs;
}
function graph(mode,seed,spread=1){
 if(mode===2)return visualFanGraph();
 const random=rng(seed),branches=[],colonies=mode===1?[
 {p:[-.12,-.52,.04],a:.40,s:.91,z:-.05}, {p:[-.41,-.46,.01],a:-.65,s:.73,z:.10}, {p:[-.45,-.69,.06],a:-2.35,s:.38,z:.28}]:[
 {p:[.02,-.42,.04],a:.38,s:.99,z:-.09}, {p:[-.41,-.49,.08],a:-.62,s:.81,z:.20}, {p:[-.38,-.76,.08],a:-2.22,s:.44,z:.42}];
 const order=mode===1?5:4,lens=[.27,.34,.32,.29,.26,.23];
 const orient=(p,c)=>[c.p[0]+c.s*(p[0]*Math.cos(c.a)+p[1]*Math.sin(c.a)),c.p[1]+c.s*(-p[0]*Math.sin(c.a)+p[1]*Math.cos(c.a)),c.p[2]+c.s*(p[2]+c.z*p[0])];
 function grow(c,base,ang,arc,gen,rad,parent,born,phase){
  const length=lens[gen]*(.73+.51*random());const R=rad+length;
  const target=[Math.sin(ang)*R,Math.cos(ang)*R,(Math.sin(ang*3+phase)*.10+Math.sin(phase+gen)*.04)*Math.min(1,R)];
  const control=V.mix(base,target,.45);control[0]+=.028*(random()-.5);control[2]+=.03*Math.sin(phase);
  const id=branches.length;let dur=.11+(order-gen)*.008;let end=born+dur;
  const radius=Math.max(mode===1?.027:.028,(mode===1?.058:.066)*(1-gen*.054)*c.s);
  branches.push({id,parent,gen,colony:colonies.indexOf(c),a:orient(base,c),b:orient(control,c),c:orient(target,c),radius,birth:born,end,terminal:gen===order,depthScale:mode===1?1:1.25});
  if(gen>=2&&gen<=3){
    // Small surface-facing branchlets are visible inside the silhouette, not only on the rim.
    const B=branches[id];
    for(let spur=0;spur<(gen===2?2:1);spur++){
      const attach=.48+spur*.24,aa=(1-attach)*(1-attach),bb=2*attach*(1-attach),P0=B.a.map((v,i)=>aa*v+bb*B.b[i]+attach*attach*B.c[i]);
      const side=(random()>.5?1:-1),P1=[P0[0]+side*(.04+.035*random())*c.s,P0[1]+(.07+.05*random())*c.s,P0[2]+(.12+.07*random())*c.s];
      branches.push({id:branches.length,parent:id,gen:6,colony:colonies.indexOf(c),a:P0,b:V.mix(P0,P1,.4),c:P1,radius:Math.max(.022,radius*.61),birth:born+(end-born)*attach,end:end+.10,terminal:true,depthScale:1,attachmentFraction:attach});
    }
  }
  if(gen<order){const childBirth=end;
   for(let side of [-1,1])grow(c,target,ang+side*arc*.51*spread+.05*(random()-.5),arc*.53,gen+1,R,id,childBirth,phase+side*1.6);
   // Sparse short off-plane shoots provide genuine depth, not a flat paper fern.
   if(mode===2&&(gen===2||gen===3)&&random()>.34){
    let tip=target.slice();tip[1]+=.14;tip[0]+=.07*Math.sin(phase);tip[2]+=(random()>.30?1:-1)*.21;
    branches.push({id:branches.length,parent:id,gen:6,colony:colonies.indexOf(c),a:orient(target,c),b:orient(V.mix(target,tip,.5),c),c:orient(tip,c),radius:Math.max(.025,radius*.72),birth:childBirth+.025,end:childBirth+.18,terminal:true,depthScale:1});
   }
  } else if(mode===2){
    // Reconstructed lobed fanlets seen on F0688: three rounded fingers per end.
    branches[id].terminal=false;
    for(let finger=-1;finger<=1;finger++){
      const theta=ang+finger*.38, len=(.15+.055*random());
      const dest=[target[0]+Math.sin(theta)*len+finger*.035,target[1]+Math.cos(theta)*len,target[2]+.035*Math.sin(phase+finger)];
      branches.push({id:branches.length,parent:id,gen:5,colony:colonies.indexOf(c),a:orient(target,c),b:orient(V.mix(target,dest,.4),c),c:orient(dest,c),radius:Math.max(.025,radius*.58),birth:end,end:end+.12,terminal:true,depthScale:1.5});
    }
  }
 }
 for(let k=0;k<colonies.length;k++)grow(colonies[k],[0,0,0],0,.99,0,0,-1,k*.017,k*1.8+.2);
 const maxEnd=Math.max(...branches.map(b=>b.end));for(const b of branches){b.birth/=maxEnd;b.end/=maxEnd}
 return branches;
}
function mesh(opts){
 const started=performance.now(),branches=graph(opts.mode,opts.seed,opts.spread),growth=Math.max(0,Math.min(1,opts.growth)),N=opts.resolution||128;
 const nx=N,ny=N,nz=Math.round(N*.61),min=[-1.95,-1.60,-.65],max=[1.95,2.30,.85],dx=(max[0]-min[0])/(nx-1),dy=(max[1]-min[1])/(ny-1),dz=(max[2]-min[2])/(nz-1),total=nx*ny*nz;
 const field=new Float32Array(total).fill(1),tip=new Float32Array(total),hue=new Float32Array(total),birth=new Float32Array(total);const segments=[];let active=0;
 function bez(b,t){const a=(1-t)*(1-t),d=2*t*(1-t);return b.a.map((v,i)=>a*v+d*b.b[i]+t*t*b.c[i])}
 for(const b of branches){if(growth<b.birth)continue;let t=Math.min(1,(growth-b.birth)/(b.end-b.birth));if(t<=0&&growth>0)continue;
  active++;const samples=6,boost=opts.mode===2?1.30:1;
  for(let j=0;j<samples;j++){
   const a=j/samples*t,c=(j+1)/samples*t,A=bez(b,a),B=bez(b,c),mid=(a+c)/2;
   let rad=b.radius*(1+(b.flare||0)*Math.pow(mid,.9))*(1-.20*mid)*(b.terminal?(1+.32*Math.sin(mid*Math.PI*.85)):1)*boost;
   // Tip swelling during extension; never scale an entire finished colony.
   rad*=.74+.26*Math.min(1,(growth-b.birth)*8);const endTip=b.terminal?Math.pow(mid,2.8):.06;
   segments.push({a:A,b:B,r:rad,tip:endTip,depth:b.depthScale,birth:b.birth,gen:b.gen});
  }
 }
 if(!segments.length){for(const c of branches.filter(b=>b.parent<0))segments.push({a:c.a,b:V.add(c.a,[0,.012,0]),r:.026,tip:1,depth:1,birth:0,gen:0})}
 for(const s of segments){
  const rr=s.r,k=rr*.45,pad=rr+k+2*Math.max(dx,dy,dz),lo=s.a.map((x,i)=>Math.min(x,s.b[i])-pad),hi=s.a.map((x,i)=>Math.max(x,s.b[i])+pad),iz0=Math.max(0,Math.floor((lo[2]-min[2])/dz)),iz1=Math.min(nz-1,Math.ceil((hi[2]-min[2])/dz)),iy0=Math.max(0,Math.floor((lo[1]-min[1])/dy)),iy1=Math.min(ny-1,Math.ceil((hi[1]-min[1])/dy)),ix0=Math.max(0,Math.floor((lo[0]-min[0])/dx)),ix1=Math.min(nx-1,Math.ceil((hi[0]-min[0])/dx));
  const ab=V.sub(s.b,s.a),den=ab[0]*ab[0]+ab[1]*ab[1]+ab[2]*ab[2]*s.depth*s.depth||1e-8;
  for(let z=iz0;z<=iz1;z++)for(let y=iy0;y<=iy1;y++)for(let x=ix0;x<=ix1;x++){
   const px=min[0]+x*dx-s.a[0],py=min[1]+y*dy-s.a[1],pz=min[2]+z*dz-s.a[2];
   const t=Math.max(0,Math.min(1,(px*ab[0]+py*ab[1]+pz*ab[2]*s.depth*s.depth)/den));
   const d=Math.hypot(px-ab[0]*t,py-ab[1]*t,(pz-ab[2]*t)*s.depth)-rr;const i=x+nx*(y+ny*z),old=field[i];
   const h=Math.max(k-Math.abs(old-d),0)/k;field[i]=Math.min(old,d)-h*h*k*.25;
   if(d<old){tip[i]=s.tip;hue[i]=s.gen/6;birth[i]=s.birth}
  }
 }
 // Smooth gradient normals and edge-interpolated attributes; tetrahedra only rasterize the field.
 const positions=[],normals=[],attrs=[];const plane=nx*ny;
 const gradient=i=>[(field[i+1]-field[i-1])/(2*dx),(field[i+nx]-field[i-nx])/(2*dy),(field[i+plane]-field[i-plane])/(2*dz)];
 const tet=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]],offs=[0,1,1+nx,nx,plane,plane+1,plane+nx+1,plane+nx];
 const corner=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
 function vertex(i,j,pa,pb){const t=field[i]/(field[i]-field[j]),pos=V.mix(pa,pb,t),n=unit(V.mix(gradient(i),gradient(j),t));return{p:pos,n,a:[tip[i]+(tip[j]-tip[i])*t,hue[i]+(hue[j]-hue[i])*t,birth[i]+(birth[j]-birth[i])*t]}}
 function tri(a,b,c){const e=V.sub(b.p,a.p),f=V.sub(c.p,a.p),g=[e[1]*f[2]-e[2]*f[1],e[2]*f[0]-e[0]*f[2],e[0]*f[1]-e[1]*f[0]];if(g.reduce((sum,v,i)=>sum+v*(a.n[i]+b.n[i]+c.n[i]),0)<0)[b,c]=[c,b];for(const v of [a,b,c]){positions.push(...v.p);normals.push(...v.n);attrs.push(...v.a)}}
 for(let z=1;z<nz-2;z++)for(let y=1;y<ny-2;y++)for(let x=1;x<nx-2;x++){
  const start=x+nx*y+plane*z,ids=offs.map(v=>v+start);let flag=0;for(let c=0;c<8;c++)if(field[ids[c]]<0)flag|=1<<c;if(flag===0||flag===255)continue;
  const ps=corner.map(c=>[min[0]+(x+c[0])*dx,min[1]+(y+c[1])*dy,min[2]+(z+c[2])*dz]);
  for(const t of tet){const inside=t.filter(c=>field[ids[c]]<0),outside=t.filter(c=>field[ids[c]]>=0);if(!inside.length||!outside.length)continue;
   const e=(i,j)=>vertex(ids[i],ids[j],ps[i],ps[j]);
   if(inside.length===1)tri(e(inside[0],outside[0]),e(inside[0],outside[1]),e(inside[0],outside[2]));
   else if(inside.length===3)tri(e(outside[0],inside[0]),e(outside[0],inside[1]),e(outside[0],inside[2]));
   else{const a=e(inside[0],outside[0]),b=e(inside[0],outside[1]),c=e(inside[1],outside[0]),d=e(inside[1],outside[1]);tri(a,b,c);tri(b,d,c)}
  }
 }
 const lines=[];for(const b of branches){if(growth<b.birth)continue;let t=Math.min(1,(growth-b.birth)/(b.end-b.birth));for(let i=0;i<8;i++)lines.push(...bez(b,i/8*t),...bez(b,(i+1)/8*t))}
 return{positions:new Float32Array(positions),normals:new Float32Array(normals),attrs:new Float32Array(attrs),lines:new Float32Array(lines),graph:branches,stats:{activeBranches:active,totalBranches:branches.length,triangles:positions.length/9,segments:segments.length,buildMs:Math.round(performance.now()-started),growth,resolution:[nx,ny,nz],mode:opts.mode,seed:opts.seed,sourceReconstruction:true,originalRulesKnown:false}};
}
onmessage=e=>{try{const r=mesh(e.data);postMessage({...r,requestId:e.data.requestId,key:e.data.key},[r.positions.buffer,r.normals.buffer,r.attrs.buffer,r.lines.buffer])}catch(error){postMessage({error:String(error.stack||error),requestId:e.data.requestId})}};
}
