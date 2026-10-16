import {unit,dot,sub} from './NativeHeadBinding.mjs';
export const GUIDE_COUNT=96,NODES=25,NODE_POWER=1.3,COUNT=64000,SEGMENTS=96;
export const STYLES={medium:{name:'偏分中长发',length:.20,part:.022},long:{name:'中分披肩长发',length:.43,part:0}};
export function random(seed=30417){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const mix=(a,b,t)=>a+(b-a)*t,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function roots(binding,count,style,seed){const result=[],rng=random(seed),part=STYLES[style].part;let i=0;while(result.length<count){let phi=(i*.61803398875+rng()*.002)*Math.PI*2,front=Math.max(0,Math.cos(phi)),back=Math.max(0,-Math.cos(phi)),max=1.8-.75*front**3+.20*back**2-.40*Math.sin(phi)**4,theta=Math.acos(mix(1,Math.cos(max),rng()));i++;
 // More guide resolution around the part, without deleting a single follicle
 // or increasing the physics budget. The remaining guides cover the whole scalp.
 if(count===GUIDE_COUNT&&result.length<40){const k=result.length,side=k%2?1:-1,z=mix(.010,-.15,Math.floor(k/2)/19),x=part+side*.0015,zz=(z-binding.center[2])/binding.radii[2],xx=x/binding.radii[0],y=binding.center[1]+binding.radii[1]*Math.sqrt(Math.max(.06,1-zz*zz-xx*xx)),dx=x-binding.center[0],dy=y-binding.center[1],dz=z-binding.center[2];theta=Math.acos(dy/Math.hypot(dx,dy,dz));phi=Math.atan2(dx,dz);}
 const root=binding.sample(theta,phi);if(!root)continue;root.seed=rng();const seam=part+.0006*Math.sin((root.p[2]+.02)*63)+.0003*Math.sin(root.seed*17);const combJitter=count===COUNT?(root.seed-.5)*.010:0;root.side=Math.tanh((root.p[0]-seam+combJitter)/.0012);root.route=clamp((Math.cos(phi)+.10)/.85,0,1);root.route=root.route*root.route*(3-2*root.route);root.bodySide=root.route>.5?1:-1;result.push(root);}return result;}

function guideCurve(binding,root,style,fullness=1){const cfg=STYLES[style],ny=Math.max(0,root.n[1]),front=Math.max(0,Math.cos(root.phi)),length=style==='medium'?.060+.14*ny**.7+.025*front:.29+.145*ny**.7+.015*front,ds=length/128,points=[root.p.slice()],phase=root.seed*Math.PI*2;let p=root.p.slice(),direction=null,released=false,releaseAt=0;const frontLock=root.route;const turnWidth=.115;
 for(let i=1;i<=128;i++){
  const s=i*ds;let d;
  if(!released){const nearest=binding.bvh.nearest(p),n=dot(nearest.n,sub(nearest.p,binding.center))<0?nearest.n.map(v=>-v):nearest.n,upper=clamp((p[1]-.005)/.085,0,1),fw=clamp((n[2]-.05)/.8,0,1),backBlend=clamp((binding.center[2]+.045-p[2])/turnWidth,0,1),turn=backBlend*backBlend*(3-2*backBlend),driver=[root.side*(.82*(1-turn)+.055),-.82+.90*fw+.29*upper,-.22-.57*turn-.09*front];const parallel=dot(driver,n);d=unit(driver.map((v,k)=>v-n[k]*parallel));const candidate=p.map((v,k)=>v+d[k]*ds),q=binding.bvh.nearest(candidate),nn=dot(q.n,sub(q.p,binding.center))<0?q.n.map(v=>-v):q.n,loft=(style==='medium'?.009:.005)*fullness*(.10+.90*clamp(Math.abs(root.p[0]-cfg.part)/.022,0,1))*(1-Math.exp(-s/.012))*(.75+.25*Math.sin(phase)),clear=dot(sub(candidate,q.p),nn);
   p=candidate.map((v,k)=>v+nn[k]*(Math.max(loft,clear)-clear));direction=d;
   if(p[1]<(style==='long'?mix(-.040,.006,frontLock):-.040)||s>Math.min(.19,length*.84)){released=true;releaseAt=s;}
  }else{const u=1-Math.exp(-(s-releaseAt)/.026),fall=[root.side*(style==='long'?.14:.025)*fullness,-1,style==='long'?mix(-.12,.18,frontLock):-.04];d=unit(direction.map((v,k)=>mix(v,fall[k],u)));p=p.map((v,k)=>v+d[k]*ds);const tip=clamp((s/length-.65)/.35,0,1);p[0]+=.00006*root.side*Math.sin(phase+s*32)*tip;p[2]+=.00007*Math.sin(s*37+phase)*tip;}

  points.push(p.slice());
 }
 const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths.at(-1)+Math.hypot(...sub(points[i],points[i-1])));const total=lengths.at(-1),out=new Float64Array(NODES*3);let idx=0;
 for(let n=0;n<NODES;n++){const target=total*(n/(NODES-1))**NODE_POWER;while(idx<127&&lengths[idx+1]<target)idx++;const t=(target-lengths[idx])/Math.max(1e-9,lengths[idx+1]-lengths[idx]);out.set(points[idx].map((v,k)=>mix(v,points[idx+1][k],t)),n*3);}return{points:out,length:total};
}
export function makeGroom(binding,style,fullness=1){const started=performance.now(),guides=roots(binding,GUIDE_COUNT,style,71417),hairs=roots(binding,COUNT,style,38471),curves=guides.map(r=>guideCurve(binding,r,style,fullness)),indices=new Float32Array(COUNT*4),weights=indices.slice(),rootData=new Float32Array(COUNT*3),traits=new Float32Array(COUNT*4),normals=rootData.slice();
 for(let i=0;i<COUNT;i++){const r=hairs[i],best=[];for(let g=0;g<GUIDE_COUNT;g++){const distance=guides[g].p.reduce((v,x,k)=>v+(x-r.p[k])**2,0),partPenalty=1+100*Math.max(0,-guides[g].side*r.side)*Math.exp(-Math.abs(r.p[0]-STYLES[style].part)/.035),d=distance*partPenalty+.00020*(guides[g].route-r.route)**2;if(best.length<4||d<best.at(-1).d){best.push({g,d});best.sort((a,b)=>a.d-b.d);if(best.length>4)best.pop();}}const w=best.map(x=>1/(x.d+.000025)),sum=w.reduce((a,b)=>a+b,0);indices.set(best.map(x=>x.g),i*4);weights.set(w.map(x=>x/sum),i*4);rootData.set(r.p,i*3);normals.set(r.n,i*3);traits.set([.86+.14*r.seed,.85+.30*((Math.sin(i*17.7)*43758.5+1e5)%1),r.seed*6.2831853,(i%73===0)?1:0],i*4);}
 return{style,fullness,binding,continuousFlow:true,excludedPartStrip:false,guides,hairs,curves,indices,weights,roots:rootData,normals,traits,buildMS:performance.now()-started};
}
