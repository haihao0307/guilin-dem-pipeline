/* KAOPU Coral R03: same copied Tree Wave lineage (967f975e2f).
   Inherited: seeded hash, forward/wave integration, parent/join, curve sampling.
   Added: substrate attachment, local deposition, flattened branch cross-sections,
   transient implicit union. This is an engineering form study, not a calibrated
   biological growth simulator. No root, wood-ring, external mesh or species lookup. */
'use strict';
(()=>{
const TAU=2*Math.PI,clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const V={add:(a,b)=>a.map((v,i)=>v+b[i]),sub:(a,b)=>a.map((v,i)=>v-b[i]),mul:(a,s)=>a.map(v=>v*s),dot:(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm:a=>{let l=Math.hypot(...a);return l>1e-10?a.map(v=>v/l):[0,1,0]},mix:(a,b,t)=>a.map((v,i)=>v*(1-t)+b[i]*t)};
function hash(a,b=0){let x=(Math.imul(a|0,374761393)+Math.imul(b|0,668265263))|0;x=Math.imul(x^(x>>>13),1274126177);return((x^(x>>>16))>>>0)/4294967296;}
function frame(d){let n=V.norm(V.cross(Math.abs(d[1])>.9?[1,0,0]:[0,1,0],d));return[n,V.norm(V.cross(d,n))];}
function point(b,u){let x=clamp(u)*(b.points.length-1),i=Math.min(b.points.length-2,Math.floor(x));return V.mix(b.points[i],b.points[i+1],x-i);}
function tangent(b,u){return V.norm(V.sub(point(b,u+.008),point(b,u-.008)));}
const limits={branch:{height:[.25,.72],radius:[.016,.04],forkHeight:[.035,.22],angle:[25,72],depth:[2,3],count:[3,6],wave:[0,.22],deposition:[0,.5]},palmate:{height:[.3,.7],width:[.18,.42],thickness:[.018,.055],fingers:[3,7],spread:[.08,.48],wave:[0,.18],deposition:[0,.5]}};
function validate(s){
 if(!s||s.schema!=='KAOPU.coral.form/3'||s.units!=='m'||s.up!=='Y'||!limits[s.operator])throw Error('需要 KAOPU.coral.form/3、m、Y 的形态谱');
 if(!Number.isSafeInteger(s.seed)||s.seed<0||s.seed>4294967295)throw Error('种子必须是 32 位非负整数');
 if(!s.parameters||Object.keys(s.parameters).length!==Object.keys(limits[s.operator]).length)throw Error('谱参数缺失或多余');
 for(const [k,[lo,hi]]of Object.entries(limits[s.operator])){const v=s.parameters[k];if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)throw Error(k+' 超出安全范围');if(['depth','count','fingers'].includes(k)&&!Number.isInteger(v))throw Error(k+' 必须为整数');}
 if(Object.keys(s).some(k=>!['schema','id','units','up','seed','operator','parameters','evidence'].includes(k)))throw Error('不接收几何、代码或未声明字段');
 if(JSON.stringify(s).length>5000)throw Error('谱超出 5KB 限制');return s;
}
function generate(s){
 validate(s);let p=s.parameters,bs=[],seed=s.seed;
 function axis(o,initial,desired,len,r0,depth,key,birth,duration,parent=-1,join=0,taper=.38,wave=.06,flat=1,normal=null,profile='taper'){
  if(bs.length>160)throw Error('分枝超过本版预算');let b={id:bs.length,parent,join,depth,r0,birth,duration,taper,flat,normal,profile,points:[]},pos=o.slice(),dir=V.norm(initial),ph=TAU*hash(key,18),ph2=TAU*hash(key,27),n=24;bs.push(b);b.points.push(pos.slice());
  for(let i=1;i<=n;i++){let u=i/n,[f,g]=frame(desired),e=smooth(u/.27),w1=Math.sin(u*5.1+ph)-Math.sin(ph),w2=.52*(Math.sin(u*9.7+ph2)-Math.sin(ph2));let target=V.norm(V.add(desired,V.add(V.mul(f,wave*(w1+w2)),V.mul(g,wave*.65*Math.sin(u*6.3+ph2)*e))));target=V.norm(V.mix(initial,target,e));dir=V.norm(V.mix(dir,target,.24));pos=V.add(pos,V.mul(dir,len/n));b.points.push(pos.slice());}return b;
 }
 if(s.operator==='branch'){
  function grow(o,initial,aim,len,r,depth,key,birth,parent=-1,join=0){
   if(depth>p.depth||r<.0085||len<.036)return;
   let dur=.34*Math.pow(.64,depth),b=axis(o,initial,aim,len,r,depth,key,birth,dur,parent,join,.18,p.wave),n=depth===0?p.count:depth===1?3:2;
   if(depth===p.depth)return;
   for(let k=0;k<n;k++){let ck=(Math.imul(key,31)+k*7919+13)|0,start=depth===0?clamp(p.forkHeight/p.height,.06,.76):.32,u=start+(.86-start)*k/(n-1);u=clamp(u+(hash(ck,3)-.5)*.038,.05,.91);let t=tangent(b,u),[f,g]=frame(t),az=k*2.399963+hash(key,9)*TAU,lateral=V.add(V.mul(f,Math.cos(az)),V.mul(g,Math.sin(az))),a=p.angle*Math.PI/180*(.86+.25*hash(ck,2)),d=V.norm(V.add(V.add(V.mul(t,Math.cos(a)),V.mul(lateral,Math.sin(a))),[0,.30,0])),ratio=depth===0?.78-.17*k/(n-1):.65;
    grow(point(b,u),t,d,len*ratio*(.89+.18*hash(ck,4)),r*(1-.18*u)*.84,depth+1,ck,birth+dur*u,b.id,u);
   }
  }
  grow([0,.014,0],[0,1,0],V.norm([.04,1,.015]),p.height,p.radius,0,seed,.035);
 }else{
  // Broad shared blade with finger margins; NOT a recoloured circular tube tree.
  for(let layer=0;layer<2;layer++){
   let ang=layer*1.42+.12,normal=[Math.cos(ang),0,Math.sin(ang)],side=[-Math.sin(ang),0,Math.cos(ang)],f=layer===0?1:.77;
   let o=V.mul(side,layer*.052),main=axis(V.add(o,[0,.013,0]),[0,1,0],V.norm(V.add([0,1,0],V.mul(side,.16))),p.height*.43*f,p.width*.43*f,0,seed+layer*151,.025+layer*.045,.32,-1,0,.25,p.wave*.35,p.thickness/(p.width*.43),normal,'palm');
   for(let k=0;k<p.fingers;k++){
    let v=k/(p.fingers-1),x=(v-.5)*p.width*.92*f,join=.67+.22*(1-Math.abs(v-.5)*2),o2=V.add(point(main,join),V.mul(normal,x*.65)),aim=V.norm(V.add([0,1,0],V.add(V.mul(normal,(v-.5)*p.spread*2),V.mul(side,(hash(seed+k,layer)-.5)*.28))));
    let len=p.height*(.24+.28*hash(seed+k*27,11)+.07*Math.sin(v*Math.PI))*f,r=p.width/(p.fingers+1)*(.69+.11*hash(seed,k))*f;
    axis(o2,aim,aim,len,r,1,seed+layer*577+k*79,.025+layer*.045+.32*join,.43,main.id,join,.28,p.wave*.32,Math.min(.8,p.thickness*.85/r),normal);
   }
  }
 }
 let end=Math.max(...bs.map(b=>b.birth+b.duration));bs.forEach(b=>{b.birth/=end;b.duration/=end;});
 let out={branches:bs,operator:s.operator,deposition:p.deposition,attachment:Math.max(.041,s.operator==='branch'?p.radius*1.55:p.width*.17)};out.bounds=estimateBounds(out);return out;
}
function radiusAt(b,u){return b.profile==='palm'?b.r0*(.21+.79*Math.pow(Math.sin(Math.PI*clamp(u)*.88),.75)):b.r0*(1-b.taper*u);}
function estimateBounds(d){let min=[-.20,-.105,-.17],max=[.20,.025,.17];for(const b of d.branches)for(let j=0;j<b.points.length;j++){let r=radiusAt(b,j/(b.points.length-1));for(let k=0;k<3;k++){min[k]=Math.min(min[k],b.points[j][k]-r);max[k]=Math.max(max[k],b.points[j][k]+r);}}return{min,max,center:min.map((x,k)=>(x+max[k])/2),radius:Math.hypot(...min.map((x,k)=>(max[k]-x)/2))};}
function geometry(data,progress=1,quality=136){
 progress=clamp(progress);const bounds=data.bounds,span=bounds.min.map((x,k)=>bounds.max[k]-x),h=Math.max(...span)/quality,lo=bounds.min.map(v=>v-4*h),N=span.map(v=>Math.ceil(v/h)+9),[nx,ny,nz]=N,xy=nx*ny,total=xy*nz,band=h*4;
 if(total>4500000)throw Error('显示采样超出内存预算');let field=new Float32Array(total);field.fill(band);
 const lines=[];let visible=0;
 function raster(a,b,ra,rb,flat=1,normal=null){
  const ab=V.sub(b,a),len=Math.hypot(...ab),d=V.norm(ab),n=normal?V.norm(V.sub(normal,V.mul(d,V.dot(normal,d)))):frame(d)[0],bin=V.norm(V.cross(d,n)),r=Math.max(ra,rb),ext=[0,1,2].map(k=>r*Math.sqrt(n[k]*n[k]+d[k]*d[k]+flat*flat*bin[k]*bin[k])+band);
  let I=a.map((v,k)=>Math.max(1,Math.floor((Math.min(v,b[k])-ext[k]-lo[k])/h))),J=a.map((v,k)=>Math.min(N[k]-2,Math.ceil((Math.max(v,b[k])+ext[k]-lo[k])/h)));
  for(let z=I[2];z<=J[2];z++){let dz=lo[2]+z*h-a[2];for(let y=I[1];y<=J[1];y++){let dy=lo[1]+y*h-a[1],idx=z*xy+y*nx+I[0];for(let x=I[0];x<=J[0];x++,idx++){
   let dx=lo[0]+x*h-a[0],q=clamp((dx*d[0]+dy*d[1]+dz*d[2])/(len||1)),along=q*len,ex=dx-d[0]*along,ey=dy-d[1]*along,ez=dz-d[2]*along,radius=ra*(1-q)+rb*q,nn=ex*n[0]+ey*n[1]+ez*n[2],bb=(ex*bin[0]+ey*bin[1]+ez*bin[2])/flat,dd=ex*d[0]+ey*d[1]+ez*d[2],s=(Math.sqrt(nn*nn+bb*bb+dd*dd)-radius)*Math.min(1,flat);
   if(s<field[idx])field[idx]=s;
  }}}
 }
 // One shallow encrusting attachment, not branching botanical roots.
 if(progress>0){let r=data.attachment*(.18+.82*smooth(progress/.23));raster([-.08*r,.003,-.09*r],[.12*r,.003,.1*r],r*.92,r,.17,[1,0,0]);raster([r*.32,.002,r*.18],[r*.36,.002,r*.20],r*.67,r*.67,.16,[1,0,0]);}
 for(const b of data.branches){let g=clamp((progress-b.birth)/b.duration);if(g<=.001)continue;visible++;
  const steps=24;let prev=point(b,0),rPrev=0;
  for(let j=0;j<=Math.ceil(g*steps);j++){let u=Math.min(g,j/steps),c=point(b,u),localAge=Math.max(0,progress-(b.birth+b.duration*u)),deposit=1-data.deposition*Math.exp(-localAge*7),r=radiusAt(b,u)*deposit*Math.min(1,g*20);
   if(j>0){raster(prev,c,rPrev,r,b.flat,b.normal);lines.push(...prev,0,1,0,...c,0,1,0);}prev=c;rPrev=r;
  }
 }
 // A compact, symmetric filter smooths meeting surfaces, not the growth paths.
 let filtered=new Float32Array(total);filtered.set(field);
 for(let z=1;z<nz-1;z++)for(let y=1;y<ny-1;y++){let i=z*xy+y*nx+1;for(let x=1;x<nx-1;x++,i++)filtered[i]=field[i]*.8+(field[i-1]+field[i+1]+field[i-nx]+field[i+nx]+field[i-xy]+field[i+xy])/30;}
 field=filtered;const surface=[],offset=[0,1,1+nx,nx,xy,xy+1,xy+nx+1,xy+nx],local=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]],tets=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]],grad=new Map();
 function normal(i){let n=grad.get(i);if(!n){n=[field[i+1]-field[i-1],field[i+nx]-field[i-nx],field[i+xy]-field[i-xy]];grad.set(i,n);}return n;}
 function edge(a,b,base,x,y,z){let ia=base+offset[a],ib=base+offset[b],va=field[ia],vb=field[ib],t=clamp(va/(va-vb)),A=local[a],B=local[b],na=normal(ia),nb=normal(ib);return{p:[lo[0]+(x+A[0]+(B[0]-A[0])*t)*h,lo[1]+(y+A[1]+(B[1]-A[1])*t)*h,lo[2]+(z+A[2]+(B[2]-A[2])*t)*h],n:V.norm(V.mix(na,nb,t))};}
 function tri(a,b,c){const cross=V.cross(V.sub(b.p,a.p),V.sub(c.p,a.p));if(V.dot(cross,V.add(V.add(a.n,b.n),c.n))<0)[b,c]=[c,b];surface.push(...a.p,...a.n,...b.p,...b.n,...c.p,...c.n);}
 for(let z=1;z<nz-2;z++)for(let y=1;y<ny-2;y++){let base=z*xy+y*nx+1;for(let x=1;x<nx-2;x++,base++){
  let code=0;for(let k=0;k<8;k++)if(field[base+offset[k]]<0)code|=1<<k;if(code===0||code===255)continue;
  for(const tet of tets){let inside=[],outside=[];for(const k of tet)(code&(1<<k)?inside:outside).push(k);if(!inside.length||!outside.length)continue;
   const e=(a,b)=>edge(a,b,base,x,y,z);
   if(inside.length===1){let a=inside[0];tri(e(a,outside[0]),e(a,outside[1]),e(a,outside[2]));}
   else if(inside.length===3){let a=outside[0];tri(e(a,inside[0]),e(a,inside[1]),e(a,inside[2]));}
   else{let a=e(inside[0],outside[0]),b=e(inside[0],outside[1]),c=e(inside[1],outside[0]),d=e(inside[1],outside[1]);tri(a,b,c);tri(b,d,c);}
  }
 }}
 if(surface.length/18>350000)throw Error('显示表面超出本版预算');
 return{surface:new Float32Array(surface),lines:new Float32Array(lines),bounds,triangles:surface.length/18,visible,cell:h,temporaryGrid:total};
}
function rockGeometry(){
 const arr=[],nu=72,nv=22;
 function pos(u,v){let a=u*TAU,t=v*Math.PI,r=Math.sin(t),shape=1+.1*Math.sin(a*3+.7)+.055*Math.sin(7*a-1.1),x=.205*r*shape*Math.cos(a),z=.168*r*shape*Math.sin(a),y=-.052+.047*Math.cos(t);y+=r*r*(.003*Math.sin(a*9+t*7)+.003*Math.cos(a*5-t*8));return[x,y,z];}
 function sample(u,v){let p=pos(u,v),du=V.sub(pos(u+.0001,v),pos(u-.0001,v)),dv=V.sub(pos(u,v+.0001),pos(u,v-.0001));return{p,n:V.norm(V.cross(dv,du))};}
 function tri(a,b,c){if(V.dot(V.cross(V.sub(b.p,a.p),V.sub(c.p,a.p)),V.add(V.add(a.n,b.n),c.n))<0)[b,c]=[c,b];arr.push(...a.p,...a.n,...b.p,...b.n,...c.p,...c.n);}
 for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){let a=sample(i/nu,j/nv),b=sample((i+1)/nu,j/nv),c=sample(i/nu,(j+1)/nv),d=sample((i+1)/nu,(j+1)/nv);tri(a,b,c);tri(b,d,c);}return new Float32Array(arr);
}
globalThis.CoralCore={V,clamp,hash,frame,point,tangent,validate,generate,geometry,estimateBounds,radiusAt,rockGeometry,limits};
})();
