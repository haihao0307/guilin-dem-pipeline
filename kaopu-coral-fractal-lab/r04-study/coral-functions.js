/* KAOPU Coral Instrument R01. New operators supplement the preserved Tree Wave
   anchor; this file contains no species presets, meshes, textures or model assets.
   All generated positions are transient renderer samples, never Score content. */
(function(root){
'use strict';
const T=2*Math.PI;
const V={add:(a,b)=>a.map((v,i)=>v+b[i]),sub:(a,b)=>a.map((v,i)=>v-b[i]),mul:(a,s)=>a.map(v=>v*s),dot:(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm:a=>{let l=Math.hypot(...a);return l>1e-12?a.map(v=>v/l):[0,1,0]}};
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
function hash(a,b=0){let x=(Math.imul(a|0,374761393)+Math.imul(b|0,668265263))|0;x=Math.imul(x^(x>>>13),1274126177);return((x^(x>>>16))>>>0)/4294967296;}
function validate(s){
 if(!s||s.schema!=='KAOPU.coral-growth.score/1'||s.units!=='m'||s.up!=='Y')throw Error('不是兼容的珊瑚谱（schema / m / Y）');
 if(!['branch','radial','sheet','massive'].includes(s.operator))throw Error('未实现的生长算子');
 if(!Number.isSafeInteger(s.seed))throw Error('seed 必须是整数');
 const walk=(x,d=0)=>{if(d>8)throw Error('谱嵌套过深');if(typeof x==='number'&&!Number.isFinite(x))throw Error('谱含非有限数');if(Array.isArray(x)){if(x.length>128)throw Error('谱数组超限');x.forEach(v=>walk(v,d+1));}else if(x&&typeof x==='object'){for(const [k,v] of Object.entries(x)){if(['vertices','indices','mesh','texture','positions'].includes(k))throw Error('谱不能保存展开网格');walk(v,d+1);}}};walk(s);
 if(s.radius<.0005||s.radius>.15||s.trunkLength<.03||s.trunkLength>3||s.depth<1||s.depth>4||s.wave<0||s.wave>1)throw Error('分枝参数超出安全预算');
 if(s.branchCounts&&s.branchCounts.some(n=>!Number.isInteger(n)||n<1||n>10))throw Error('分叉数超出预算');
 if(s.radial&&(s.radial.count<8||s.radial.count>120||s.radial.discRadius<=0||s.radial.discRadius>1||s.radial.length<=0||s.radial.length>1))throw Error('触手参数超出预算');
 if(s.sheet&&(s.sheet.layers<1||s.sheet.layers>8||s.sheet.radius<=0||s.sheet.radius>1.5||s.sheet.thickness<=0||s.sheet.thickness>.02))throw Error('薄层参数超出预算');
 if(s.massive&&(s.massive.radius<=0||s.massive.radius>1.5||s.massive.ridgeHeight<0||s.massive.ridgeHeight>.1||s.massive.frequency<1||s.massive.frequency>20))throw Error('团块参数超出预算');
 return s;
}
function direction(s,pos,dir,depth,u){
 const f=s.directionField;if(!f)return dir;
 if(depth===0)return dir;
 let radial=V.norm([pos[0],0,pos[2]]);if(Math.hypot(pos[0],pos[2])<.008)radial=V.norm([dir[0],0,dir[2]]);
 const y=depth>=f.terminalDepth?f.terminalRise:clamp((f.canopyY-pos[1])*f.verticalGain,-.5,.5);
 let target=V.norm(V.add(V.mul(dir,1-f.strength),V.mul([radial[0],y,radial[2]],f.strength)));
 if(f.planeAxis==='Z'){target=V.norm([target[0],target[1],target[2]*(1-(f.planeStrength||0))]);}
 if(f.planeAxis==='X'){target=V.norm([target[0]*(1-(f.planeStrength||0)),target[1],target[2]]);}
 return target;
}
function generate(s,anchor){
 validate(s);
 if(s.operator==='branch'){const a=anchor(s);a.parts=a.branches.length;a.operator=s.operator;return a;}
 const out={operator:s.operator,branches:[],patches:[],landmarks:[],parts:0,stopReasons:{operator:0},score:s};
 if(s.operator==='radial'){
  const q=s.radial, h=q.bodyHeight, rd=q.discRadius;
  out.patches.push({nu:72,nv:18,closedU:true,flip:true,fn:(u,v)=>{let a=u*T,r=rd*(.57+.43*Math.sin(v*Math.PI/2));return[r*Math.cos(a),h*v,r*Math.sin(a)];},growth:(u,v)=>v*.15});
  out.patches.push({nu:96,nv:24,closedU:true,fn:(u,v)=>{let a=u*T,r=rd*(.095+.905*v);let y=h+Math.sin(v*Math.PI)*.016-Math.exp(-v*9)*.035;return[r*Math.cos(a),y,r*Math.sin(a)];},growth:(u,v)=>.15+v*.08});
  for(let k=0;k<q.count;k++){
   let ring=k%3,a=T*(k/q.count)+ring*.21,r=rd*(.47+.23*ring),l=q.length*(.72+.30*hash(s.seed,k)),rr=q.thickness*(.8+.3*hash(s.seed+7,k));
   let origin=[r*Math.cos(a),h+.006,r*Math.sin(a)],points=[];
   for(let j=0;j<=28;j++){let u=j/28,spread=q.spread*(.7+.4*hash(k,s.seed));let bend=spread*u*u+.01*Math.sin(u*4+hash(k,3)*T)*u*u;
    points.push([origin[0]+Math.cos(a)*bend+.018*Math.sin(u*3+k)*u*u,origin[1]+l*(u-.1*u*u),origin[2]+Math.sin(a)*bend+.013*Math.cos(u*4+k)*u*u]);}
   out.branches.push({id:k,parent:-1,join:0,key:k,depth:1,r0:rr,length:l,birth:.23+.10*hash(k,s.seed),duration:.66,points,terminal:true,radiusProfile:'tentacle'});
  }
  out.landmarks=[[0,0,0]];out.parts=q.count+2;
 }else if(s.operator==='sheet'){
  const q=s.sheet;
  for(let k=0;k<q.layers;k++){
   const shift=k*2.399963+hash(s.seed,k)*.5,phase=hash(s.seed+17,k)*T,rad=q.radius*(1-k/(q.layers+2)*.6),lift=.025+k*q.layerRise;
   out.patches.push({nu:108,nv:32,thickness:q.thickness,closedU:true,fn:(u,v)=>{
    let a=T*u+shift,r=.018+rad*v*(1+.07*Math.sin(a*3+phase));let fold=q.fold*Math.sin(a*6+phase)*Math.pow(v,3);
    let y=lift+q.curl*v*v+fold+.018*Math.sin(a*2+phase)*v;
    return[r*Math.cos(a),y,r*Math.sin(a)];},growth:(u,v)=>clamp(k*.095+v*(1-(q.layers-1)*.095))});
  }
  out.patches.push({nu:40,nv:12,closedU:true,flip:true,fn:(u,v)=>{let a=T*u,r=.034*(1-.5*v);return[r*Math.cos(a),v*(.03+(q.layers-1)*q.layerRise),r*Math.sin(a)];},growth:()=>0});
  out.landmarks=[[0,0,0]];out.parts=q.layers+1;
 }else if(s.operator==='massive'){
  const q=s.massive,phase=hash(s.seed,1)*T;
  const evalFn=(u,v)=>{
   let a=u*T,t=v*Math.PI,n=[Math.sin(t)*Math.cos(a),Math.cos(t),Math.sin(t)*Math.sin(a)];
   let x=n[0]*q.frequency,y=n[1]*q.frequency,z=n[2]*q.frequency;
   let wx=x+.65*Math.sin(y*.77+phase)+.22*Math.sin(z*1.9),wy=y+.62*Math.sin(z*.84+1.3),wz=z+.65*Math.sin(x*.81+2.7);
   let field=Math.sin(wx)*Math.cos(wy)+Math.sin(wy)*Math.cos(wz)+Math.sin(wz)*Math.cos(wx);
   let ridge=Math.exp(-field*field/Math.pow(q.ridgeWidth,2));
   let local=q.radius*(1+.027*Math.sin(x*.53+phase)*Math.cos(z*.69)) + q.ridgeHeight*ridge;
   return[n[0]*local,n[1]*local*q.aspect+q.radius*q.aspect+q.ridgeHeight*q.aspect,n[2]*local*.94];
  };
  out.patches.push({nu:192,nv:112,closedU:true,fn:evalFn,growth:(u,v)=>clamp(1-v)});
  out.landmarks=[[0,0,0]];out.parts=1;
 }
 return out;
}
function geometry(data,anchorGeometry,s){
 const g=anchorGeometry(data.branches),surf=[],lines=[];
 const push=(a)=>surf.push(...a.p,...a.n,a.g);
 const tri=(a,b,c)=>{push(a);push(b);push(c);};
 function sample(p,u,v){
  let eps=1e-4,uv=x=>p.closedU?((x%1)+1)%1:clamp(x),pos=p.fn(uv(u),clamp(v));
  const pu=V.sub(p.fn(uv(u+eps),clamp(v)),p.fn(uv(u-eps),clamp(v))),pv=V.sub(p.fn(uv(u),clamp(v+eps)),p.fn(uv(u),clamp(v-eps)));
  return{p:pos,n:V.mul(V.norm(V.cross(pu,pv)),p.flip?-1:1),g:p.growth(u,v)};
 }
 for(const p of data.patches||[]){
  const grid=[];for(let j=0;j<=p.nv;j++){let row=[];for(let i=0;i<=p.nu;i++)row.push(sample(p,i/p.nu,j/p.nv));grid.push(row);}
  const off=(a,f)=>({p:V.add(a.p,V.mul(a.n,f)),n:f<0?V.mul(a.n,-1):a.n,g:a.g});
  for(let j=0;j<p.nv;j++)for(let i=0;i<p.nu;i++){
   const a=grid[j][i],b=grid[j][i+1],c=grid[j+1][i],d=grid[j+1][i+1];
   const emit=(a,b,c)=>p.flip?tri(a,c,b):tri(a,b,c);
   if(p.thickness){let h=p.thickness/2;emit(off(a,h),off(b,h),off(c,h));emit(off(b,h),off(d,h),off(c,h));emit(off(a,-h),off(c,-h),off(b,-h));emit(off(b,-h),off(c,-h),off(d,-h));
    if(j===p.nv-1||j===0){let x=j===0?a:c,y=j===0?b:d;tri(off(x,h),off(y,h),off(x,-h));tri(off(y,h),off(y,-h),off(x,-h));}
   }else{emit(a,b,c);emit(b,d,c);}
   if(i%8===0)lines.push(...a.p,...a.n,a.g,...c.p,...c.n,c.g);
   if(j%6===0)lines.push(...a.p,...a.n,a.g,...b.p,...b.n,b.g);
  }
 }
 const merge=(a,b)=>{let r=new Float32Array(a.length+b.length);r.set(a);r.set(b,a.length);return r;};
 const out={surface:merge(g.surface,surf),lines:merge(g.lines,lines)};
 let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<out.surface.length;i+=7)for(let k=0;k<3;k++){const x=out.surface[i+k];if(!Number.isFinite(x))throw Error('函数产生非有限坐标');min[k]=Math.min(min[k],x);max[k]=Math.max(max[k],x);}
 data.bounds={min,max,center:min.map((v,k)=>(v+max[k])/2),radius:Math.hypot(...min.map((v,k)=>(max[k]-v)/2))};
 data.landmarks=(data.landmarks||[]).concat([min,max]);
 if(out.surface.length/21>260000)throw Error('超出本研究台三角预算');
 return out;
}
root.CoralFunctions={version:'R04-study',validate,direction,generate,geometry};
})(globalThis);
