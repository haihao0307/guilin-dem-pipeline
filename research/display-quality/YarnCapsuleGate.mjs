import {CONTROLS} from '../../fixtures/local-knit-r03/p02-curve.mjs';
const mid=(a,b)=>a.map((v,k)=>(v+b[k])*.5);
function split(p){const a=mid(p[0],p[1]),b=mid(p[1],p[2]),c=mid(p[2],p[3]),d=mid(a,b),e=mid(b,c),f=mid(d,e);return[[p[0],a,d,f],[f,e,c,p[3]]];}
function distance(point,a,b){const d=b.map((v,k)=>v-a[k]),q=point.map((v,k)=>v-a[k]),n=d.reduce((s,v)=>s+v*v,0),t=n?Math.max(0,Math.min(1,q.reduce((s,v,k)=>s+v*d[k],0)/n)):0;return Math.hypot(...q.map((v,k)=>v-d[k]*t));}
export function yarnCapsuleUniforms(pitch,radius,parts=2){
 const low=[],high=[];for(let i=0;i<10;i++){const a=CONTROLS[Math.max(0,i-1)],b=CONTROLS[i],c=CONTROLS[i+1],d=CONTROLS[Math.min(10,i+2)],bezier=[b,b.map((v,k)=>v+(-a[k]+c[k])/6),c.map((v,k)=>v-(d[k]-b[k])/6),c].map(p=>p.map((v,k)=>(v+(k===0?.5:0))*pitch)),pieces=parts===2?split(bezier):[bezier,bezier];for(const p of pieces){const bound=Math.max(...p.map(q=>distance(q,p[0],p[3])))+radius*1.1427+.01;low.push(...p[0],bound);high.push(...p[3],bound);}}
 return{low:new Float32Array(low),high:new Float32Array(high)};
}
export function yarnCapsuleSource(source){
 const anchor='box.x>best)continue;';if(source.split(anchor).length!==3)throw Error('Primary/shadow segment gate anchors changed');
 const gate=`uniform vec4 uYarnCapsA[20],uYarnCapsB[20];uniform int uYarnCapsuleParts;
 bool yarnCapsuleMayHit(vec3 ro,vec3 rd,vec3 offset,int seg){for(int part=0;part<2;part++){if(part>=uYarnCapsuleParts)break;vec4 ca=uYarnCapsA[seg*2+part],cb=uYarnCapsB[seg*2+part];vec3 a=offset+ca.xyz-ro,b=offset+cb.xyz-ro;float margin=max(.001,1.e-5*max(length(a),length(b)));a-=rd*dot(a,rd);b-=rd*dot(b,rd);vec3 d=b-a;float t=clamp(-dot(a,d)/max(1.e-18,dot(d,d)),0.,1.);vec3 q=a+d*t;float bound=ca.w+margin;if(dot(q,q)<=bound*bound)return true;}return false;}
 `;
 return gate+source.replaceAll(anchor,anchor+'if(!yarnCapsuleMayHit(ro,rd,offset,seg))continue;');
}
