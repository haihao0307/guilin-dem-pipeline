/** GNM-specific scalp sampling and geodesic guide binding.
 * Every sample binds to the original model.triangles order and barycentrics.
 * No ellipsoid, replacement head, regionId=255 assumption, or baked head mesh.
 * Hairline is a documented grooming selection in the neutral template, not an
 * anatomical label supplied by GNM. Units are the model's native coordinates.
 */
import {createRng} from './SemanticSampler.js';
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const normalize=v=>{const n=Math.hypot(...v)||1;return v.map(x=>x/n);};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class ScalpBinding{
 constructor(model,{count=5400,segments=18,seed=724,sweep=.43,length=.085}={}){
  this.model=model;this.count=count;this.segments=segments;this.seed=seed;this.sweep=sweep;this.length=length;
  this.triangleIndices=new Int32Array(count*(segments+1));this.barycentrics=new Float32Array(count*(segments+1)*3);this.random=new Float32Array(count*4);this.regions=new Uint8Array(count);this.templateNormals=this.buildVertexNormals();this.adjacency=this.buildAdjacency();this.bind();
 }
 vertex(index,positions=this.model.template){return Array.from(positions.subarray(index*3,index*3+3));}
 face(t,positions=this.model.template){return [0,1,2].map(k=>this.vertex(this.model.triangles[t*3+k],positions));}
 point(t,b,positions=this.model.template){const f=this.face(t,positions);return [0,1,2].map(k=>f[0][k]*b[0]+f[1][k]*b[1]+f[2][k]*b[2]);}
 faceNormal(t){const [a,b,c]=this.face(t);return normalize(cross(sub(b,a),sub(c,a)));}
 barycentric(t,p){const [a,b,c]=this.face(t),v0=sub(b,a),v1=sub(c,a),v2=sub(p,a),d00=dot(v0,v0),d01=dot(v0,v1),d11=dot(v1,v1),d20=dot(v2,v0),d21=dot(v2,v1),den=d00*d11-d01*d01;if(Math.abs(den)<1e-18)return [1,0,0];const v=(d11*d20-d01*d21)/den,w=(d00*d21-d01*d20)/den;return [1-v-w,v,w];}
 buildVertexNormals(){const n=new Float32Array(this.model.numVertices*3);for(let t=0;t<this.model.triangles.length/3;t++){const [a,b,c]=this.face(t),normal=cross(sub(b,a),sub(c,a));for(let k=0;k<3;k++){const v=this.model.triangles[t*3+k]*3;for(let j=0;j<3;j++)n[v+j]+=normal[j];}}for(let v=0;v<n.length;v+=3){const d=Math.hypot(n[v],n[v+1],n[v+2])||1;n[v]/=d;n[v+1]/=d;n[v+2]/=d;}return n;}
 buildAdjacency(){const a=new Int32Array(this.model.triangles.length).fill(-1),edges=new Map(),tr=this.model.triangles;for(let t=0;t<tr.length/3;t++){if(this.model.componentId[tr[t*3]]!==0)continue;for(let k=0;k<3;k++){const v=tr[t*3+(k+1)%3],w=tr[t*3+(k+2)%3],key=Math.min(v,w)*this.model.numVertices+Math.max(v,w);if(edges.has(key)){const other=edges.get(key);a[t*3+k]=Math.floor(other/3);a[other]=t;}else edges.set(key,t*3+k);}}return a;}
 scalp(p){const [x,y,z]=p;const front=clamp((z-.025)/.08,0,1);const base=.264+front*.089+Math.max(0,Math.abs(x)-.050)*.23;return y>base&&y>.257;}
 selectFaces(){const tr=this.model.triangles,items=[];let sum=0;for(let t=0;t<tr.length/3;t++){if(this.model.componentId[tr[t*3]]!==0)continue;const [a,b,c]=this.face(t);if(!this.scalp(a)||!this.scalp(b)||!this.scalp(c))continue;const area=Math.hypot(...cross(sub(b,a),sub(c,a)))/2;if(area<1e-12)continue;sum+=area;items.push({t,cumulative:sum});}if(!items.length)throw Error('No scalp triangles selected');return {items,sum};}
 advance(t,b,distance,direction){let p=this.point(t,b),remain=distance;for(let iteration=0;iteration<14&&remain>1e-8;iteration++){const normal=this.faceNormal(t),d=dot(direction,normal),tan=normalize(direction.map((x,k)=>x-normal[k]*d)),target=p.map((x,k)=>x+tan[k]*remain),end=this.barycentric(t,target);if(end.every(x=>x>=-1e-7)){const clamped=end.map(x=>Math.max(0,x)),s=clamped.reduce((a,x)=>a+x,0);return {t,b:clamped.map(x=>x/s)};}let alpha=1,opposite=-1;for(let k=0;k<3;k++)if(end[k]<0){const value=b[k]/(b[k]-end[k]);if(value<alpha){alpha=Math.max(0,value);opposite=k;}}const edge=b.map((x,k)=>x+(end[k]-x)*alpha);p=this.point(t,edge);remain*=1-alpha;const next=opposite<0?-1:this.adjacency[t*3+opposite];if(next<0)return {t,b:edge};t=next;b=this.barycentric(t,p).map(x=>Math.max(1e-8,x));const sum=b.reduce((a,x)=>a+x,0);b=b.map(x=>x/sum);p=this.point(t,b);}return {t,b};}
 bind(){const {items,sum}=this.selectFaces(),rng=createRng(this.seed);this.scalpTriangleCount=items.length;this.scalpArea=sum;const per=this.segments+1;
  for(let i=0;i<this.count;i++){const area=rng()*sum;let lo=0,hi=items.length-1;while(lo<hi){const m=(lo+hi)>>1;if(items[m].cumulative<area)lo=m+1;else hi=m;}let t=items[lo].t;const u=Math.sqrt(rng()),v=rng();let b=[1-u,u*(1-v),u*v];const root=this.point(t,b);for(let k=0;k<4;k++)this.random[i*4+k]=rng();const front=clamp((root[2]+.025)/.12,0,1),top=clamp((root[1]-.30)/.085,0,1);this.regions[i]=top>.25?0:1;const part=root[0]<-.025?-.38:this.sweep;const direction=normalize([part,-.24,-1]);const strandLength=this.length*(.37+.63*top)*(.86+.28*this.random[i*4+3]);
   for(let j=0;j<per;j++){const q=i*per+j;this.triangleIndices[q]=t;this.barycentrics.set(b,q*3);if(j<this.segments){const step=this.advance(t,b,strandLength/this.segments,direction);t=step.t;b=step.b;}}
  }
 }
 sample(positions,vertexNormals,{volume=.012,frizz=.00045}={}){const per=this.segments+1,out=new Float32Array(this.count*per*3),tr=this.model.triangles;for(let i=0;i<this.count;i++)for(let j=0;j<per;j++){const q=i*per+j,t=this.triangleIndices[q],b=this.barycentrics.subarray(q*3,q*3+3),s=j/this.segments;let p=[0,0,0],normal=[0,0,0];for(let k=0;k<3;k++){const v=tr[t*3+k]*3;for(let a=0;a<3;a++){p[a]+=positions[v+a]*b[k];normal[a]+=vertexNormals[v+a]*b[k];}}normal=normalize(normal);const lift=.00035+volume*Math.sin(Math.PI*s)*(.75+.25*this.random[i*4+2]);const noise=frizz*s*s;for(let a=0;a<3;a++)out[q*3+a]=p[a]+normal[a]*lift+noise*Math.sin(s*(19+a*7)+this.random[i*4+a]*23);}return out;}
 serialize(){return {kind:'gnm-scalp-binding',version:1,topology:'gnm-v3-web-35324-triangles',count:this.count,segments:this.segments,seed:this.seed,sweep:this.sweep,length:this.length,triangleIndices:Array.from(this.triangleIndices),barycentrics:Array.from(this.barycentrics),selection:'componentId=0 plus neutral-template grooming hairline; not an anatomical scalp label'};}
 diagnostics(){let invalid=0,min=1,max=0,maxSumError=0;for(let q=0;q<this.triangleIndices.length;q++){const b=this.barycentrics.subarray(q*3,q*3+3),t=this.triangleIndices[q];if(t<0||t>=this.model.triangles.length/3||this.model.componentId[this.model.triangles[t*3]]!==0)invalid++;maxSumError=Math.max(maxSumError,Math.abs(b[0]+b[1]+b[2]-1));for(const x of b){min=Math.min(min,x);max=Math.max(max,x);}}return {count:this.count,segments:this.segments,scalpTriangleCount:this.scalpTriangleCount,scalpArea:this.scalpArea,invalidTriangles:invalid,minWeight:min,maxWeight:max,maxSumError};}
}
