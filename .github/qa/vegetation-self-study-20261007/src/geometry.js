import * as THREE from '../vendor/three.module.js';
export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
export function seeded(seed){let s=seed>>>0;return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
export function curve(points){return new THREE.CatmullRomCurve3(points.map(p=>p.isVector3?p:new THREE.Vector3(...p)),false,'centripetal');}
export function sweep(path,radius,{segments=60,sides=16,tip=.015,twist=0,lobes=.07,hollow=false,holes=[],broken=false,radiusProfile=null,lobeCount=5}={}){
 const frames=path.computeFrenetFrames(segments,false),p=[],uv=[],idx=[],junction=[],length=path.getLength(),stride=sides+1;
 const rings=segments+1;let minRadius=Infinity;
 for(let shell=0;shell<(hollow?2:1);shell++)for(let i=0;i<=segments;i++){
  const t=i/segments,c=path.getPointAt(t),r=radiusProfile?radiusProfile(t):radius*(Math.pow(1-t,.8)*(1-tip)+tip)*(1+.25*Math.exp(-t*28));minRadius=Math.min(minRadius,r);
  for(let j=0;j<=sides;j++){const u=j/sides,a=u*Math.PI*2+twist*t,bulge=1+lobes*Math.sin(a*lobeCount+5*t)+lobes*.4*Math.sin(a*11-19*t);let rr=r*bulge*(shell?.63:1);const v=c.clone().addScaledVector(frames.normals[i],Math.cos(a)*rr).addScaledVector(frames.binormals[i],Math.sin(a)*rr);if(broken&&i===segments)v.addScaledVector(frames.tangents[i],Math.sin(a*7+.8)*radius*.18);p.push(v.x,v.y,v.z);uv.push(u,t*length);junction.push(Math.exp(-t*20));}
 }
 const boundary=new Map();function edge(a,b){const k=Math.min(a,b)+','+Math.max(a,b);if(boundary.has(k))boundary.delete(k);else boundary.set(k,[a,b]);}
 for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const u=(j+.5)/sides,t=(i+.5)/segments;if(holes.some(h=>{let du=Math.abs(u-h.u);du=Math.min(du,1-du);return (du/h.w)**2+((t-h.t)/h.h)**2<1;}))continue;const a=i*stride+j,b=a+1,c=a+stride,d=c+1;idx.push(a,c,b,b,c,d);if(hollow){const n=rings*stride;idx.push(a+n,b+n,c+n,b+n,d+n,c+n);edge(a,b);edge(b,d);edge(d,c);edge(c,a);}}
 if(hollow){const n=rings*stride;for(const [a,b] of boundary.values())idx.push(a,b,a+n,b,b+n,a+n);}
 else {const b=p.length/3,c0=path.getPointAt(0),c1=path.getPointAt(1);p.push(c0.x,c0.y,c0.z,c1.x,c1.y,c1.z);uv.push(.5,0,.5,length);junction.push(1,0);for(let j=0;j<sides;j++){idx.push(b,j,j+1);const a=segments*stride+j;idx.push(b+1,a+1,a);}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('junction',new THREE.Float32BufferAttribute(junction,1));g.setIndex(idx);g.computeVertexNormals();g.computeBoundingSphere();g.userData={kind:'curve-sweep',length,radialUV:'u=turns v=arcLengthMeters',holes:holes.length,hollow,minRadius};return g;
}
export function branchMesh(path,radius,material,opts){const m=new THREE.Mesh(sweep(path,radius,opts),material);m.castShadow=m.receiveShadow=true;return m;}
export function disposeObject(obj){const geo=new Set(),mats=new Set(),textures=new Set();obj.traverse(o=>{if(o.geometry)geo.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m)mats.add(m);});for(const g of geo)g.dispose();for(const m of mats){for(const v of Object.values(m))if(v?.isTexture)textures.add(v);m.dispose();}for(const t of textures)t.dispose();}
export function mergeGeometryBatch(geometries){
 const total=geometries.reduce((n,g)=>n+g.attributes.position.count,0),indexCount=geometries.reduce((n,g)=>n+(g.index?.count??g.attributes.position.count),0),p=new Float32Array(total*3),n=new Float32Array(total*3),uv=new Float32Array(total*2),ix=new Uint32Array(indexCount);let vo=0,io=0;
 for(const g of geometries){p.set(g.attributes.position.array,vo*3);n.set(g.attributes.normal.array,vo*3);if(g.attributes.uv)uv.set(g.attributes.uv.array,vo*2);for(let j=0;j<(g.index?.count??g.attributes.position.count);j++)ix[io++]=vo+(g.index?.array[j]??j);vo+=g.attributes.position.count;}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('normal',new THREE.BufferAttribute(n,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setIndex(new THREE.BufferAttribute(ix,1));g.computeBoundingSphere();return g;
}
