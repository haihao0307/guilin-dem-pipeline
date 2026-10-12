/** Exact R14.2 root sampler excerpt from HairLayer.js; no old shader or hair mesh. */
import {sampleTriangle} from './StrandCore.js';
import {fusion,regionalDensity,shortDirection} from './FusionFields.js';
import {scalpMargin,scalpDensity} from './RegionFields.js';
import {ScalpBinding} from './ScalpBinding.js';
import {createRng} from './SemanticSampler.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
const normalized=v=>{const d=Math.hypot(...v)||1;return v.map(x=>x/d);};
export class FullerScalpBinding extends ScalpBinding{
 bind(){
  const tr=this.model.triangles,p=this.model.template;this.triangleFrames=new Float64Array(tr.length/3*16);
  for(let t=0;t<tr.length/3;t++){const a=tr[t*3]*3,b=tr[t*3+1]*3,c=tr[t*3+2]*3,o=t*16,f=this.triangleFrames;for(let k=0;k<3;k++){f[o+k]=p[a+k];f[o+3+k]=p[b+k]-p[a+k];f[o+6+k]=p[c+k]-p[a+k];}let d00=0,d01=0,d11=0;for(let k=0;k<3;k++){d00+=f[o+3+k]**2;d01+=f[o+3+k]*f[o+6+k];d11+=f[o+6+k]**2;}f[o+9]=d00;f[o+10]=d01;f[o+11]=d11;f[o+12]=d00*d11-d01*d01;let nx=f[o+4]*f[o+8]-f[o+5]*f[o+7],ny=f[o+5]*f[o+6]-f[o+3]*f[o+8],nz=f[o+3]*f[o+7]-f[o+4]*f[o+6],d=Math.hypot(nx,ny,nz)||1;f[o+13]=nx/d;f[o+14]=ny/d;f[o+15]=nz/d;}
  const {items,sum}=this.selectFaces(),rng=createRng(this.seed),per=this.segments+1;
  this.scalpTriangleCount=items.length;this.scalpArea=this.rootSurfaceArea=sum;
  this.rootTriangles=new Int32Array(this.count);this.rootBarycentrics=new Float32Array(this.count*3);this.templateRoots=new Float32Array(this.count*3);this.regionWeights=new Float32Array(this.count*3);this.selectionRandom=new Float32Array(this.count);this.guideCache=new Map();this.guideBuilds=0;this.unitIds=new Uint32Array(this.count);this.unitCount=0;let remaining=0,anchor=null;const unitGrid=new Map(),cellSize=.00105*Math.min(1,Math.sqrt(36000/this.count));const key=(x,y,z)=>x+","+y+","+z;const nearUnit=p=>{const c=p.map(v=>Math.floor(v/cellSize));for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)for(const q of unitGrid.get(key(c[0]+x,c[1]+y,c[2]+z))||[])if(Math.hypot(...p.map((v,k)=>v-q[k]))<cellSize)return true;return false;};
  for(let i=0;i<this.count;i++){
   let t,b,root;let attempts=0;
   if(remaining>0){const angle=rng()*Math.PI*2,step=.00018+rng()*.00036,next=this.advance(anchor.t,anchor.b,step,[Math.cos(angle),.25*Math.sin(angle*2),Math.sin(angle)]);t=next.t;b=next.b;root=this.point(t,b);remaining--;if(scalpMargin(root)<=.0002)root=null;}
   if(!root){do{const target=rng()*sum;let lo=0,hi=items.length-1;while(lo<hi){const m=(lo+hi)>>1;if(items[m].cumulative<target)lo=m+1;else hi=m;}t=items[lo].t;b=sampleTriangle(rng);root=this.point(t,b);if(++attempts>2000)throw Error('Scalp unit rejection exhausted');}while(scalpMargin(root)<=.0002||rng()>scalpDensity(root)/1.3||nearUnit(root));anchor={t,b:[...b]};this.unitCount++;remaining=scalpMargin(root)<.004?0:(rng()<.22?0:rng()<.65?1:2);const c=root.map(v=>Math.floor(v/cellSize)),k=key(...c);if(!unitGrid.has(k))unitGrid.set(k,[]);unitGrid.get(k).push([...root]);}
   this.unitIds[i]=this.unitCount-1;
   const front=smooth(.015,.08,root[2]),back=1-smooth(-.055,.005,root[2]),side=smooth(.04,.075,Math.abs(root[0]))*(1-front*.6)*(1-back*.6),total=Math.max(1,front+back+side);
   this.rootTriangles[i]=t;this.rootBarycentrics.set(b,i*3);this.templateRoots.set(root,i*3);this.regionWeights.set([front/total,back/total,side/total],i*3);this.selectionRandom[i]=rng();
   for(let k=0;k<4;k++)this.random[i*4+k]=rng();this.regions[i]=root[1]>.325?0:1;
  }
  this.setStyle('side-sweep');
 }
 point(t,b,positions=this.model.template){const tr=this.model.triangles,a=tr[t*3]*3,c=tr[t*3+1]*3,d=tr[t*3+2]*3;return [positions[a]*b[0]+positions[c]*b[1]+positions[d]*b[2],positions[a+1]*b[0]+positions[c+1]*b[1]+positions[d+1]*b[2],positions[a+2]*b[0]+positions[c+2]*b[1]+positions[d+2]*b[2]];}
 faceNormal(t){const f=this.triangleFrames,o=t*16;return [f[o+13],f[o+14],f[o+15]];}
 barycentric(t,p){const f=this.triangleFrames,o=t*16,det=f[o+12];if(Math.abs(det)<1e-18)return [1,0,0];let d20=0,d21=0;for(let k=0;k<3;k++){const v=p[k]-f[o+k];d20+=v*f[o+3+k];d21+=v*f[o+6+k];}const v=(f[o+11]*d20-f[o+10]*d21)/det,w=(f[o+9]*d21-f[o+10]*d20)/det;return [1-v-w,v,w];}
 frontWeight([x,y,z]){return smooth(.025,.1,z)*(1-.28*smooth(.035,.075,Math.abs(x)));}
 hairlineMargin(p,height=0){const [x,y,z]=p,ax=Math.abs(x),front=clamp((z-.025)/.08,0,1),temple=.0025*Math.sin(ax*52)*front;return y-(.273+front*.074+Math.max(0,ax-.05)*.2+temple+height*.01*this.frontWeight(p));}
 safetyMargin(p){return scalpMargin(p);}
 selectFaces(){const tr=this.model.triangles,items=[];let sum=0;for(let t=0;t<tr.length/3;t++){if([0,1,2].some(k=>this.model.componentId[tr[t*3+k]]!==0))continue;const f=this.face(t),center=f[0].map((v,k)=>(v+f[1][k]+f[2][k])/3);if(!f.some(p=>scalpMargin(p)>-.002)&&scalpMargin(center)<=-.002)continue;const a=f[1].map((v,k)=>v-f[0][k]),b=f[2].map((v,k)=>v-f[0][k]),area=Math.hypot(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])/2;if(area<1e-12)continue;sum+=area;items.push({t,cumulative:sum});}return{items,sum};}

 scalp(p){return this.safetyMargin(p)>.0002;}
 selectionWeight(i,options){const p=this.templateRoots.subarray(i*3,i*3+3),w=this.regionWeights,q=i*3;
  const edge=regionalDensity(p,this.safetyMargin(p)-options.hairlineHeight*.006*this.frontWeight(p));
  return edge*clamp(1-w[q]*(1-options.frontCoverage)-w[q+1]*(1-options.backCoverage)-w[q+2]*(1-options.sideCoverage),0,1);
 }
 /** Update direction along the surface, including its side/back orientation.
  * There is no common world-space vector or hard left/right part seam. */
 flow(p,i,style,progress=0){
  const [x,y,z]=p,side=smooth(.045,.085,Math.abs(x)),rear=1-smooth(-.052,-.015,z),front=smooth(.02,.09,z),r=this.random[i*4],near=1-smooth(.002,.015,this.safetyMargin(p));let direction;
  if(style==='short-crop')return shortDirection(p,progress,r);
  if(style==='swept-back')direction=[x*.7,-.12-side*rear*.72,-1];
  else if(style==='short-crop')direction=[x*1.8,-.2-side*rear*.55,.7*front-.6*(1-front)];
  else{const rootX=this.templateRoots[i*3],rootZ=this.templateRoots[i*3+2],part=-.027+fusion.hairPart*.0003+.045*rootZ+.007*Math.sin((rootZ+.01)*18),partStrength=smooth(-.035,.045,rootZ)*smooth(.31,.36,this.templateRoots[i*3+1]),partSide=1+(Math.tanh((rootX-part)/.0018)-1)*partStrength;direction=[partSide*(.78*(1-side*.75))+x*2,-.12-side*rear*.6,-.65-side*.6];}
  const lower=1-smooth(.311,.350,y),rearFlow=1-smooth(-.035,.014,z),sideFlow=smooth(.045,.073,Math.abs(x));const regional=Math.max(rearFlow,sideFlow)*lower;direction=direction.map((v,k)=>v*(1-regional)+[x*.5,-1,-.18][k]*regional);
  // Group nearby roots into 12 mm guide cells, then converge gently along
  // each supported strand. The grouping controls coherent bundles, not noise.
  const root=this.templateRoots.subarray(i*3,i*3+3),cell=.012;
  const dx=(Math.round(root[0]/cell)*cell-root[0])/cell,dz=(Math.round(root[2]/cell)*cell-root[2])/cell;
  const gather=Math.sin(Math.PI*progress)*fusion.hairClump/100;
  direction[0]+=dx*gather;direction[2]+=dz*gather;
  const wx=x-(.018+fusion.hairWhorlX*.00025),wz=z-(-.028+fusion.hairWhorlZ*.00025),wd=Math.hypot(wx,wz),whorl=fusion.hairWhorl/100*smooth(.343,.367,y)*(1-smooth(.012,.048,wd))*(.45+.55*Math.exp(-progress*8));const spin=normalized([-.32*wz+wx,.02,.32*wx+wz]);direction=direction.map((v,k)=>v*(1-whorl)+spin[k]*whorl);direction[0]+=(r-.5)*.06;direction[1]+=near*.3;return normalized(direction);
 }
 setStyle(style){
  if(this.guideCache.has(style)){const cached=this.guideCache.get(style);this.triangleIndices=cached.triangles;this.barycentrics=cached.barycentrics;this.guideEnds=cached.ends;this.style=style;return;}
  const per=this.segments+1,triangles=new Int32Array(this.count*per),barycentrics=new Float32Array(this.count*per*3),ends=new Uint8Array(this.count).fill(this.segments);let clipped=0;
  for(let i=0;i<this.count;i++){
   let t=this.rootTriangles[i],b=Array.from(this.rootBarycentrics.subarray(i*3,i*3+3)),stopped=false;const p=this.templateRoots.subarray(i*3,i*3+3),top=smooth(.30,.385,p[1]),margin=Math.max(0,this.safetyMargin(p)),transition=.18+.82*smooth(.001,.018,margin),strandLength=this.length*transition*(.32+.68*top)*(.66+.54*this.random[i*4+3])*(style==='short-crop'?.34:style==='swept-back'?.95:1),distance=strandLength/this.segments;
   for(let j=0;j<per;j++){
    const q=i*per+j;triangles[q]=t;barycentrics.set(b,q*3);if(j===this.segments||stopped)continue;
    const direction=this.flow(this.point(t,b),i,style,j/this.segments);let next=this.advance(t,b,distance,direction);
    if(this.safetyMargin(this.point(next.t,next.b))<.0002){let lo=0,hi=distance;next={t,b};for(let k=0;k<7;k++){const mid=(lo+hi)/2,probe=this.advance(t,b,mid,direction);if(this.safetyMargin(this.point(probe.t,probe.b))>=.0002){lo=mid;next=probe;}else hi=mid;}stopped=true;ends[i]=j+1;clipped++;}
    t=next.t;b=next.b;
   }
  }
  this.guideCache.clear();this.guideCache.set(style,{triangles,barycentrics,ends,clipped});this.triangleIndices=triangles;this.barycentrics=barycentrics;this.guideEnds=ends;this.style=style;this.guideBuilds++;
 }
}

