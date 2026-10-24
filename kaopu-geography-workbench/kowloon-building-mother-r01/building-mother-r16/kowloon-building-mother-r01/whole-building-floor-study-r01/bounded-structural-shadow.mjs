/** Original finite-distance structural visibility study, not sunlight or full-scene shadows.
 * Descriptors are exact existing rectangular wall fields, not rendering meshes.
 * No camera-dependent culling is used, including for secondary rays. */
export const SHADOW_SCOPE=Object.freeze({maxDistance:2,fadeStart:1.6,bias:.0002,minT:.00001,maximumWalls:64});
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),sub=(a,b)=>a.map((v,k)=>v-b[k]);
export function shadowWeight(t){if(!Number.isFinite(t)||t>=2)return 0;if(t<=1.6)return 1;const x=(t-1.6)/.4;return 1-x*x*(3-2*x);}
export function intervalInBox(origin,direction,min,max,{minT=SHADOW_SCOPE.minT,maxT=2}={}){let lo=minT,hi=maxT;for(let k=0;k<3;k++){if(Math.abs(direction[k])<1e-12){if(origin[k]<min[k]||origin[k]>max[k])return null;}else{let a=(min[k]-origin[k])/direction[k],b=(max[k]-origin[k])/direction[k];if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);if(lo>hi)return null;}}return lo<=hi?[lo,hi]:null;}
export function rayWall(wall,point,direction,maxT=2){const delta=sub(point,wall.origin);return intervalInBox(wall.axes.map(a=>dot(delta,a)),wall.axes.map(a=>dot(direction,a)),wall.min,wall.max,{maxT});}
export function visibilityAt(packed,point,normal,direction,receiverId=-1){const length=Math.hypot(...direction);if(Math.abs(length-1)>1e-7)throw Error('Normalized light direction required');const p=point.map((v,k)=>v+normal[k]*SHADOW_SCOPE.bias);let t=Infinity,id=null;for(const wall of packed.walls){if(wall.objectId===receiverId)continue;const hit=rayWall(wall,p,direction,Math.min(t,2));if(hit&&hit[0]<t){t=hit[0];id=wall.objectId;}}return{visibility:1-shadowWeight(t),distance:t,objectId:id};}
function rectangularWall(p,translation,objectId){
 if(p.loops?.length!==1||p.loops[0].length!==4||!p.loops[0].every(q=>q.length===2&&q.every(Number.isFinite)))throw Error('Shadow supports only existing four-corner wall fields');
 const frame=p.frame??p;const axes=[frame.u,frame.v,frame.w];if(!axes.every(a=>a?.length===3&&a.every(Number.isFinite))||frame.origin?.length!==3||!frame.origin.every(Number.isFinite)||translation?.length!==3||!translation.every(Number.isFinite))throw Error('Finite rigid frame required');
 for(let a=0;a<3;a++)for(let b=0;b<3;b++)if(Math.abs(dot(axes[a],axes[b])-(a===b?1:0))>1e-7)throw Error('Nonorthogonal shadow frame');
 const xs=[...new Set(p.loops[0].map(q=>q[0]))].sort((a,b)=>a-b),ys=[...new Set(p.loops[0].map(q=>q[1]))].sort((a,b)=>a-b);
 if(xs.length!==2||ys.length!==2||!xs.every(Number.isFinite)||!ys.every(Number.isFinite)||p.range?.length!==2||new Set(p.loops[0].map(q=>q.join(','))).size!==4||!p.range?.every(Number.isFinite)||p.range[1]<=p.range[0]||xs[1]<=xs[0]||ys[1]<=ys[0])throw Error('Not an exact nondegenerate rectangle');
 for(let k=0;k<4;k++){const a=p.loops[0][k],b=p.loops[0][(k+1)%4];if((a[0]===b[0])===(a[1]===b[1]))throw Error('Rectangle edges must be cyclic, not a bow tie');}
 const min=[xs[0],ys[0],p.range[0]],max=[xs[1],ys[1],p.range[1]];if(Math.min(...max.map((v,k)=>v-min[k]))<=SHADOW_SCOPE.bias*10)throw Error('Shadow bias too large for thin host');
 return{nodeId:p.nodeId,objectId,origin:frame.origin.map((v,k)=>v+translation[k]),axes,min,max};
}
export function packStructuralShadow(model){
 if(model.placementMode!=='UNREGISTERED_evidence_plan_NOT_part_of_measured_mother')return null;
 const walls=[],receivers=[];
 for(const [instanceIndex,instance]of model.instances.entries()){
  const archetype=model.archetypes.find(a=>a.id===instance.archetypeId),spec=archetype?.spec??archetype;if(!spec)throw Error('Shadow model instance missing archetype');
  for(const p of spec.primitives){const id=p.objectId+(instance.objectIdOffset??10000*(instanceIndex+1));if(!Number.isSafeInteger(id)||id<0||id>16777215)throw Error('Shadow ID cannot round-trip Float32');
   if(p.nodeId.startsWith('study-floor:')||p.nodeId.startsWith('study-wall:'))receivers.push(id);
   if(p.nodeId.startsWith('study-wall:'))walls.push(rectangularWall(p,instance.translation,id));
  }
 }
 if(!walls.length||walls.length>SHADOW_SCOPE.maximumWalls)throw Error('Bounded structural shadow wall capacity exceeded');
 const ids=[...new Set(receivers)].sort((a,b)=>a-b),ranges=[];for(const id of ids){const last=ranges.at(-1);if(last&&id===last[1]+1)last[1]=id;else ranges.push([id,id]);}if(ranges.length>64)throw Error('Shadow receiver range capacity');
 const records=1+walls.length*5+ranges.length,width=Math.min(256,records),height=Math.ceil(records/width),data=new Float32Array(width*height*4);data.set([walls.length,ranges.length,1+walls.length*5,records]);
 walls.forEach((w,i)=>{const o=(1+i*5)*4;data.set([...w.origin,w.objectId,...w.axes[0],w.min[0],...w.axes[1],w.max[0],...w.axes[2],w.min[1],w.max[1],w.min[2],w.max[2],0],o);});ranges.forEach((r,i)=>data.set([...r,0,0],(1+walls.length*5+i)*4));
 return{width,height,data,walls,receiverRanges:ranges,receiverIds:ids,scope:{...SHADOW_SCOPE,description:'Finite-distance structural shadow; only existing Unit A rectangular wall fields, not full scene or sunlight.'}};
}
export const BOUNDED_SHADOW_GLSL=`
uniform sampler2D uStructuralDescriptors;uniform sampler2D uHit;uniform sampler2D uNormal;out vec4 outVisibility;
vec4 shadowRecord(int i){int w=textureSize(uStructuralDescriptors,0).x;return texelFetch(uStructuralDescriptors,ivec2(i%w,i/w),0);}
bool shadowInterval(vec3 p,vec3 d,vec3 mn,vec3 mx,inout float lo,inout float hi){for(int axis=0;axis<3;axis++){if(abs(d[axis])<1e-12){if(p[axis]<mn[axis]||p[axis]>mx[axis])return false;}else{float a=(mn[axis]-p[axis])/d[axis],b=(mx[axis]-p[axis])/d[axis];lo=max(lo,min(a,b));hi=min(hi,max(a,b));if(lo>hi)return false;}}return lo<=hi;}
float structuralVisibility(vec3 p,vec3 normal,float receiver){vec4 meta=shadowRecord(0);bool selected=false;for(int i=0;i<64;i++){if(i>=int(meta.y))break;vec2 r=shadowRecord(int(meta.z)+i).xy;if(receiver>=r.x&&receiver<=r.y){selected=true;break;}}if(!selected)return 1.;
 vec3 light=normalize(vec3(-.6,1.,-.7));if(dot(normal,light)<=0.)return 1.;p+=normal*.0002;float nearest=2.;bool found=false;
 for(int i=0;i<64;i++){if(i>=int(meta.x))break;int offset=1+i*5;vec4 origin=shadowRecord(offset);if(receiver==origin.w)continue;vec4 u=shadowRecord(offset+1),v=shadowRecord(offset+2),w=shadowRecord(offset+3),limits=shadowRecord(offset+4);vec3 q=p-origin.xyz;vec3 local=vec3(dot(q,u.xyz),dot(q,v.xyz),dot(q,w.xyz)),direction=vec3(dot(light,u.xyz),dot(light,v.xyz),dot(light,w.xyz));float lo=.00001,hi=nearest;if(shadowInterval(local,direction,vec3(u.w,w.w,limits.y),vec3(v.w,limits.x,limits.z),lo,hi)){nearest=min(nearest,lo);found=true;}}
 return found?smoothstep(1.6,2.,nearest):1.;}
void main(){ivec2 px=ivec2(gl_FragCoord.xy);vec4 hit=texelFetch(uHit,px,0);if(hit.w<.5||hit.w>2.5){outVisibility=vec4(1);return;}vec3 rd=rayDirection(),n=normalize(texelFetch(uNormal,px,0).xyz);if(dot(n,rd)>0.)n=-n;vec3 p=rayOrigin()+rd*hit.x;outVisibility=vec4(structuralVisibility(p,n,hit.y),0,0,1);}
`;
export function linearToSrgb(x){return x<=.0031308?12.92*Math.max(x,0):1.055*Math.pow(x,1/2.4)-.055;}
export function smithGeometry(roughness,nl,nv){const k=(roughness+1)**2/8;return(nl/(nl*(1-k)+k))*(nv/(nv*(1-k)+k));}
export const COLOR_CONTROL_GLSL=`
float coatGeometry(float coatRoughness,float nl,float nv){float k=(coatRoughness+1.);k=k*k/8.;return(nl/(nl*(1.-k)+k))*(nv/(nv*(1.-k)+k));}
vec3 encodeLinearSrgb(vec3 c){return mix(1.055*pow(max(c,vec3(0)),vec3(1./2.4))-.055,12.92*max(c,vec3(0)),lessThanEqual(c,vec3(.0031308)));}
`;
