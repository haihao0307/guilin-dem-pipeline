import {point,sub,dot,clamp,smooth} from '../face-transfer/FaceFields.mjs';
// Monolid-tendency authoring correction on the original indexed upper eyelid.
// Not a levator/fat anatomical reconstruction or a new blink simulation.
export function fairUpperLids(model,before,front,eyes,fields,scale,strength){
 const z=new Float64Array(model.vertexCount),original=new Float64Array(z.length),nodes=[];
 for(let i=model.bodyCount;i<z.length;i++)z[i]=original[i]=dot(point(before,i),front);
 for(let e=0;e<eyes.length;e++){
  const eye=eyes[e],source=model.eyeSurface.eyes[e],triangles=source.triangles.map(t=>t.map(i=>{const p=point(before,i);return[...eye.proj(p),dot(p,front)];}));
  function support(x,y){let result=-Infinity;for(const[a,b,c]of triangles){if(x<Math.min(a[0],b[0],c[0])||x>Math.max(a[0],b[0],c[0])||y<Math.min(a[1],b[1],c[1])||y>Math.max(a[1],b[1],c[1]))continue;const den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-15)continue;const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den,v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den,w=1-u-v;if(Math.min(u,v,w)<-1e-7)continue;result=Math.max(result,u*a[2]+v*b[2]+w*c[2]);}return Number.isFinite(result)?result:null;}
  for(let i=model.bodyCount;i<model.vertexCount;i++){
   if(fields.a[i*4+2]<.04||fields.a[i*4]<.05)continue;const p=point(before,i),q=eye.proj(p),s=q[0]/eye.width;if(s<.035||s>.965)continue;const d=(q[1]-eye.upper(s))/scale;
   const blend=smooth(.0009,.0022,d)*(1-smooth(.007,.009,d))*Math.pow(Math.sin(Math.PI*s),.55)*eye.gate;if(blend<.001)continue;
   const ns=[...fields.adjacency[i]];if(!ns.length)continue;const weights=ns.map(j=>1/Math.max(.00025,Math.hypot(...sub(p,point(before,j))))),floor=support(q[0],q[1]);
   nodes.push({i,ns,weights,blend,lower:floor===null?original[i]-.0012*scale:Math.min(original[i],floor+.000055*scale),floor});
  }
 }
 const next=z.slice();for(let iteration=0;iteration<36;iteration++){
  for(const n of nodes){let sum=0,den=0;for(let j=0;j<n.ns.length;j++){sum+=z[n.ns[j]]*n.weights[j];den+=n.weights[j];}next[n.i]=clamp(z[n.i]+(sum/den-z[n.i])*.55*n.blend,Math.max(n.lower,original[n.i]-.0012*scale),original[n.i]+.0018*scale);}
  for(const n of nodes)z[n.i]=next[n.i];
 }
 let changed=0,max=0,newPenetrations=0;for(const n of nodes){const d=(z[n.i]-original[n.i])*n.blend*strength;for(let k=0;k<3;k++)model.positions[n.i*3+k]+=front[k]*d;max=Math.max(max,Math.abs(d));if(Math.abs(d)>1e-8)changed++;if(n.floor!==null&&original[n.i]+d<Math.min(original[n.i],n.floor)-1e-7)newPenetrations++;}
 return {changed,maxMM:max*1000,vertices:nodes.length,newPenetratingVertices:newPenetrations,method:'bounded Jacobi depth fairing; fixed margin and outer band; native eye support tested at affected vertices'};
}
