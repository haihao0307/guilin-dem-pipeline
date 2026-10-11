import {clamp,smooth,gauss,dot,point,currentLipFrame} from './LipMath.mjs';
/** Reduced geometric constraints. NOT a finite-element muscle solver.
 * Contact is paired lip-section Y separation + actual dental/tongue front
 * envelope projection. It is not arbitrary-direction continuous collision. */
class OralEnvelope{
 constructor(geometry,frame,scale){this.n=112;this.frame=frame;this.x=.046*scale;this.y=.033*scale;this.z=new Float32Array(this.n*this.n).fill(-Infinity);this.triangles=0;
  const P=geometry.attributes.position.array,T=geometry.attributes.csType.array,F=geometry.index.array,cache=new Map(),local=i=>{if(cache.has(i))return cache.get(i);const p=point(P,i).map((v,k)=>v-frame.center[k]),a=[(dot(p,frame.x)/this.x*.5+.5)*(this.n-1),(dot(p,frame.up)/this.y*.5+.5)*(this.n-1),dot(p,frame.front)];cache.set(i,a);return a;};
  for(let k=0;k<F.length;k+=3){const ids=[F[k],F[k+1],F[k+2]];if(!ids.every(i=>T[i]>.5&&T[i]<3.5))continue;const[a,b,c]=ids.map(local),den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-7)continue;this.triangles++;
   const x0=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),x1=Math.min(this.n-1,Math.ceil(Math.max(a[0],b[0],c[0]))),y0=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),y1=Math.min(this.n-1,Math.ceil(Math.max(a[1],b[1],c[1])));
   for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den,v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den,w=1-u-v;if(u>=-.015&&v>=-.015&&w>=-.015){const z=u*a[2]+v*b[2]+w*c[2],j=y*this.n+x;if(z>this.z[j])this.z[j]=z;}}
  }
 }
 sample(p){const f=this.frame,d=p.map((v,k)=>v-f.center[k]),x=(dot(d,f.x)/this.x*.5+.5)*(this.n-1),y=(dot(d,f.up)/this.y*.5+.5)*(this.n-1);if(x<0||y<0||x>=this.n-1||y>=this.n-1)return-Infinity;const i=Math.floor(x),j=Math.floor(y);return Math.max(this.z[j*this.n+i],this.z[j*this.n+i+1],this.z[(j+1)*this.n+i],this.z[(j+1)*this.n+i+1]);}
}
export function sampleLipHeight(atlas,u,v,upper,band=0){if(!atlas)return 0;const x=clamp(u*.5+.5)*(atlas.width-1),y=clamp(((upper?1:0)+.06+.88*clamp(v))*.5*atlas.height-.5,0,atlas.height-1),ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,read=(a,b)=>atlas.data[(Math.min(atlas.height-1,b)*atlas.width+Math.min(atlas.width-1,a))*4+band];return ((read(ix,iy)*(1-fx)+read(ix+1,iy)*fx)*(1-fy)+(read(ix,iy+1)*(1-fx)+read(ix+1,iy+1)*fx)*fy-128)/255*(band===0?.00025:.00010);}
export class LipBiomechanics{
 constructor(topology){this.topology=topology;this.reference=null;this.lastKey=null;}
 apply(model,api){const topo=this.topology,g=topo.geometry,P=g.attributes.position.array,N=g.attributes.normal.array,p=api.performance.settings,s=api.settings,dna=api.anatomy.settings,frame=currentLipFrame(model),scale=api.anatomy.scale(frame.width),base=this.base||(this.base=new Float32Array(P.length)),origin=frame.center;base.set(P);
  const key=JSON.stringify([model.state.gnm.identity,model.state.anny.phenotypes,model.state.anny.localChanges,model.identityLab?.settings?.shape]);
  // Identity-neutral calibration is recorded only when the original jaw and
  // native expression are neutral. Non-neutral first loads are explicitly marked.
  const neutral=api.performance.jawOpen<.002&&model.state.gnm.expression.every(v=>Math.abs(v)<1e-5);
  if(key!==this.lastKey){this.reference=null;this.lastKey=key;}
  if(!this.reference&&neutral){this.reference=new Float32Array(topo.count);for(const i of topo.active){let sum=0;for(const j of topo.neighbors[i])sum+=Math.hypot(base[i*3]-base[j*3],base[i*3+1]-base[j*3+1],base[i*3+2]-base[j*3+2]);this.reference[i]=sum/Math.max(1,topo.neighbors[i].length);}}
  let maxMove=0;const add=(i,dx,dy,dz)=>{for(let k=0;k<3;k++)P[i*3+k]+=frame.x[k]*dx+frame.up[k]*dy+frame.front[k]*dz;};
  for(const i of topo.active){const q=topo.samples[i],v=point(base,i).map((v,k)=>v-origin[k]),x=dot(v,frame.x),y=dot(v,frame.up),side=smooth(-.16,.16,q.u),stretch=p.stretchLeft*(1-side)+p.stretchRight*side,corner=p.cornerLeft*(1-side)+p.cornerRight*side,w=q.weight,inside=q.inner;
   const hScale=1-.23*p.pucker-.12*p.funnel+.18*stretch,transverse=Math.min(1.18,1/Math.sqrt(Math.max(.65,hScale))),roll=p.rollOut-p.rollIn,lipOnly=gauss(q.v-.35,.85)*(1-inside*.8),cornerW=gauss(Math.abs(q.u)-.82,.33);
   let dx=x*(hScale-1),dy=y*(transverse-1)-y*.33*p.press,dz=(.0036*p.pucker+.0025*p.funnel)*gauss(q.u,.85)-.0008*stretch*lipOnly;
   dy+=(q.upper?.0018*p.upperRaise:-.0024*p.lowerDepress)*gauss(q.u,.9);dy+=.0028*corner*cornerW;
   dy+=(q.upper?1:-1)*.0017*p.funnel*gauss(q.u,.85)*gauss(q.v,.8);
   dy+=(q.upper?-1:1)*.00125*roll*gauss(q.v-.20,.75);dz+=.00115*roll*lipOnly+.00065*p.press*lipOnly;
   dz+=(dna.tissueDepth-1)*.0011*lipOnly;
   dx*=w;dy*=w;dz*=w;add(i,dx,dy,dz);maxMove=Math.max(maxMove,Math.hypot(dx,dy,dz));
  }
  const yAt=i=>{let y=0;for(let k=0;k<3;k++)y+=(P[i*3+k]-origin[k])*frame.up[k];return y;};
  const sections=topo.pairs.map(pair=>{const gap=yAt(pair.upper)-yAt(pair.lower),threshold=.12+.58*Math.abs(pair.u)+.04*Math.sin(pair.u*7),stuck=p.adhesion*(1-smooth(threshold,threshold+.19,p.release+api.performance.jawOpen*.76)),closure=Math.max(p.seal,p.press*.45,stuck),target=Math.max(.00009*scale,gap*(1-closure)),delta=clamp((target-gap)*.5,-.006*scale,.006*scale);return{...pair,gap,closure,delta};});
  function section(u){if(!sections.length)return{delta:0,closure:0};const pos=clamp((u+.94)/1.88)*(sections.length-1),a=sections[Math.floor(pos)],b=sections[Math.min(sections.length-1,Math.floor(pos)+1)],t=pos-Math.floor(pos);return{delta:a.delta+(b.delta-a.delta)*t,closure:a.closure+(b.closure-a.closure)*t};}
  for(const i of topo.active){const q=topo.samples[i],c=section(q.u),rimWeight=gauss(Math.max(0,q.v),.92)*(1-smooth(.94,1.14,Math.abs(q.u)))*Math.max(q.front,q.inner*.7);add(i,0,(q.upper?1:-1)*c.delta*rimWeight,0);topo.fields[i*4+3]=c.closure*gauss(q.v,.55)*q.front;}
  // Project against the actual moving native dental and tongue triangles.
  const env=new OralEnvelope(g,frame,scale);let contacts=0,maxProjection=0,remaining=0;
  for(const i of topo.lips){const q=topo.samples[i];if(q.v<.05||q.v>1.05)continue;const pt=point(P,i),z=dot(pt.map((v,k)=>v-origin[k]),frame.front),boundary=env.sample(pt),depth=boundary+.00016*scale-z;if(depth>0&&Number.isFinite(boundary)){const correction=Math.min(depth,.004*scale);add(i,0,0,correction);contacts++;maxProjection=Math.max(maxProjection,correction);remaining=Math.max(remaining,depth-correction);}}
  g.computeVertexNormals();let minStrain=Infinity,maxStrain=0,sumStrain=0,count=0,maxRelief=0;const dynN=g.attributes.normal.array;
  for(const i of topo.active){const q=topo.samples[i],ns=topo.neighbors[i];let sum=0;for(const j of ns)sum+=Math.hypot(P[i*3]-P[j*3],P[i*3+1]-P[j*3+1],P[i*3+2]-P[j*3+2]);const length=sum/Math.max(1,ns.length),reference=this.reference?.[i]||topo.restLength[i]*scale,strain=clamp(length/Math.max(1e-7,reference),.55,1.85),gain=clamp(Math.pow(1/strain,1.55),.40,2.1);
   const relief=sampleLipHeight(api.atlasData,q.u,q.v,q.upper)*s.furrows*dna.microGeometry*q.red*gain*(1-q.inner*.85);
   for(let k=0;k<3;k++)P[i*3+k]+=dynN[i*3+k]*relief;maxRelief=Math.max(maxRelief,Math.abs(relief));
   const j=i*4;topo.fields[j]=q.inner;topo.fields[j+1]=strain;topo.fields[j+2]=q.red;topo.detail[j]=gain;topo.detail[j+1]=relief*1000;topo.detail[j+2]=q.upper?1:0;topo.detail[j+3]=q.skin?1:0;
   if(q.red>.15){minStrain=Math.min(minStrain,strain);maxStrain=Math.max(maxStrain,strain);sumStrain+=strain;count++;}
  }
  let minGap=Infinity,closed=0;for(const pair of topo.pairs){const gap=yAt(pair.upper)-yAt(pair.lower);minGap=Math.min(minGap,gap);if(gap<.00035*scale)closed++;}
  g.attributes.position.needsUpdate=true;g.attributes.l19State.needsUpdate=true;g.attributes.l19Detail.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();
  this.report={kind:'native jaw + reduced geometric lip constraints; not FEM',...topo.audit,referenceCalibration:this.reference?'identity-neutral native surface':'template fallback (non-neutral first load)',localStretch:{min:Number.isFinite(minStrain)?minStrain:1,max:maxStrain,mean:sumStrain/Math.max(1,count)},maxGeometryFurrowMicrons:maxRelief*1e6,maxPerformanceDisplacementMM:maxMove*1000,minimumPairedGapMM:minGap*1000,closedSections:closed,totalSections:topo.pairs.length,dentalEnvelopeTriangles:env.triangles,dentalEnvelopeContacts:contacts,maxDentalProjectionMM:maxProjection*1000,remainingFrontalEnvelopePenetrationMM:remaining*1000,contactScope:'fixed opposing rim samples and frontal dental/gum/tongue triangle envelope; not whole-mesh CCD',volumeStatus:'reciprocal transverse compensation; enclosed lip volume is NOT verified',salivaSimulation:false};
  api.biomechanicsReport=this.report;return this.report;
 }
}
