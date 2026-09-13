/* Relative, uncalibrated karst process. No geological dates or field measurements. */
const LivingKarst=(()=>{
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
function ledger(t,rain=1,cutoff=1,degassing=1){
 for(const v of [t,rain,cutoff,degassing])if(!Number.isFinite(v)||v<0||v>1)throw Error('过程参数必须在 0—1');
 const total=(delay)=>rain*100*clamp(Math.min(t-delay,cutoff));
 const input=total(0),infiltrated=total(.025)*.82,dripped=total(.10)*.82;
 const dissolved=total(.05)*.82*.085,delivered=dripped*.085;
 const roof=delivered*.28*degassing,floor=(delivered-roof)*.36*degassing;
 return {phase:t,rain,cutoff,degassing,input,runoff:input*.18,infiltrated,waterStored:input*.82-dripped,dripped,waterOutlet:dripped,dissolved,mineralTransit:dissolved-delivered,roof,floor,mineralOutlet:delivered-roof-floor,
 active:rain>0&&t>.10&&t<cutoff+.10,wet:rain*clamp((t-.025)/.04)*clamp((cutoff+.12-t)/.025),units:'relative proxy units; uncalibrated',yearsCalibrated:false};
}
function surfaceSampler(parts){
 const tris=[],bins=new Map(),cell=2;
 for(const p of parts.filter(p=>!p.cap&&(p.kind===0||p.kind===3))){const v=p.vertices,s=p.stride||16,I=p.indices;
 for(let i=0;i<I.length;i+=3){const a=Array.from(v.slice(I[i]*s,I[i]*s+3)),b=Array.from(v.slice(I[i+1]*s,I[i+1]*s+3)),c=Array.from(v.slice(I[i+2]*s,I[i+2]*s+3));
 if(Math.max(a[0],b[0],c[0])< -13||Math.min(a[0],b[0],c[0])>3||Math.max(a[2],b[2],c[2])<4||Math.min(a[2],b[2],c[2])>17)continue;
 const den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(den)<1e-8)continue;
 const id=tris.length;tris.push({a,b,c,den,kind:p.kind});
 for(let x=Math.floor(Math.min(a[0],b[0],c[0])/cell);x<=Math.floor(Math.max(a[0],b[0],c[0])/cell);x++)for(let z=Math.floor(Math.min(a[2],b[2],c[2])/cell);z<=Math.floor(Math.max(a[2],b[2],c[2])/cell);z++){const k=x+','+z;if(!bins.has(k))bins.set(k,[]);bins.get(k).push(id);}
 }}
 return (x,z)=>{const hits=[];for(const id of bins.get(Math.floor(x/cell)+','+Math.floor(z/cell))||[]){const {a,b,c,den,kind}=tris[id],u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den;if(u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7)hits.push({y:u*a[1]+v*b[1]+(1-u-v)*c[1],up:den<0,kind,triangle:id});}return hits.sort((a,b)=>a.y-b.y).filter((h,i,a)=>!i||Math.abs(h.y-a[i-1].y)>1e-4);};
}
function anchors(parts){const sample=surfaceSampler(parts),candidates=[];
 for(let x=-11;x<=0;x+=.5)for(let z=6;z<=14;z+=.5){const h=sample(x,z);for(let i=0;i<h.length-2;i++){const floor=h[i],roof=h[i+1],top=h[i+2];if(!floor.up||roof.up||!top.up||roof.kind!==0||roof.y<4||roof.y>12||floor.y>5||roof.y-floor.y<3.5||top.y-roof.y<.8)continue;
 let safe=true;for(let j=0;j<16;j++){const a=j*Math.PI/8,hh=sample(x+.48*Math.cos(a),z+.48*Math.sin(a));if(!hh.some(q=>!q.up&&Math.abs(q.y-roof.y)<.6)||!hh.some(q=>q.up&&Math.abs(q.y-floor.y)<.6))safe=false;}if(safe)candidates.push({x,z,roof:roof.y,floor:floor.y,top:h[h.length-1].y,pathNodes:h.slice(i+1).reverse().map(q=>({y:q.y,up:q.up,triangle:q.triangle})),roofTriangle:roof.triangle,floorTriangle:floor.triangle});}}
 const result=[];for(const target of [[-9,12],[-5.5,11],[-2,10],[-7,7]]){const c=candidates.filter(c=>result.every(r=>Math.hypot(r.x-c.x,r.z-c.z)>2)).sort((a,b)=>Math.hypot(a.x-target[0],a.z-target[1])-Math.hypot(b.x-target[0],b.z-target[1]))[0];if(c)result.push({...c,id:result.length+1,weight:[.31,.26,.24,.19][result.length]});}
 if(result.length!==4)throw Error('冻结岩体中未找到四组安全的洞顶／洞底接触点');
 for(const a of result){a.roofRoot=a.roof;a.floorRoot=a.floor;for(let j=0;j<24;j++){const b=j*Math.PI/12,h=sample(a.x+.48*Math.cos(b),a.z+.48*Math.sin(b));a.roofRoot=Math.max(a.roofRoot,...h.filter(q=>!q.up&&Math.abs(q.y-a.roof)<.65).map(q=>q.y));a.floorRoot=Math.min(a.floorRoot,...h.filter(q=>q.up&&Math.abs(q.y-a.floor)<.65).map(q=>q.y));}a.roofRoot+=.035;a.floorRoot-=.035;}
 return result;
}
// Fixed topology, solid closed spindle. Size cubed follows the shared mineral account.
function solid(a,amount,ceiling){const V=[],N=24,R=20,idx=[],s=Math.cbrt(Math.max(0,amount)*.028),length=(ceiling?3.1:1.9)*s,rad=(ceiling?.43:.66)*s,root=ceiling?a.roofRoot:a.floorRoot,dir=ceiling?-1:1;
 for(let j=0;j<R;j++){const t=j/R;for(let k=0;k<N;k++){const ang=k*2*Math.PI/N,shape=ceiling?Math.pow(1-t,1.35):Math.pow(Math.max(0,1-t*t),.72),r=rad*shape*(1+.05*Math.cos(3*ang+a.id)+.025*Math.cos(7*ang+1.3));V.push(a.x+r*Math.cos(ang),root+dir*length*t,a.z+r*Math.sin(ang));}}
 for(let j=0;j<R-1;j++)for(let k=0;k<N;k++){let v=j*N+k,w=j*N+(k+1)%N;idx.push(v,w,v+N,w,w+N,v+N);}const tip=V.length/3;V.push(a.x,root+dir*length,a.z);for(let k=0;k<N;k++)idx.push((R-1)*N+k,(R-1)*N+(k+1)%N,tip);
 const center=V.length/3;V.push(a.x,root,a.z);for(let k=0;k<N;k++)idx.push(center,(k+1)%N,k);
 // Orient triangles outwards using direction; no camera-dependent geometry.
 if(ceiling)for(let i=0;i<idx.length;i+=3)[idx[i+1],idx[i+2]]=[idx[i+2],idx[i+1]];
 let vol=0;for(let i=0;i<idx.length;i+=3){let aa=idx[i]*3,bb=idx[i+1]*3,cc=idx[i+2]*3;const A=[V[aa]-a.x,V[aa+1]-root,V[aa+2]-a.z],B=[V[bb]-a.x,V[bb+1]-root,V[bb+2]-a.z],C=[V[cc]-a.x,V[cc+1]-root,V[cc+2]-a.z];vol+=(A[0]*(B[1]*C[2]-B[2]*C[1])+A[1]*(B[2]*C[0]-B[0]*C[2])+A[2]*(B[0]*C[1]-B[1]*C[0]))/6;}
 const factor=amount>0?Math.cbrt(amount*.025/Math.abs(vol)):1;
 for(let i=0;i<V.length;i+=3){V[i]=a.x+(V[i]-a.x)*factor;V[i+1]=root+(V[i+1]-root)*factor;V[i+2]=a.z+(V[i+2]-a.z)*factor;}
 if(vol<0)for(let i=0;i<idx.length;i+=3)[idx[i+1],idx[i+2]]=[idx[i+2],idx[i+1]];
 return {positions:V,indices:idx,length:length*factor,rad:rad*factor,root,tip:root+dir*length*factor,volume:amount*.025,visualVolumePerMineralUnit:.025};}
return {ledger,anchors,solid};})();
if(typeof module!=='undefined')module.exports=LivingKarst;
