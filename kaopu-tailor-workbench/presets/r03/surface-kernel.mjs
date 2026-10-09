/** R03: authored garment surfaces, NOT a drape solver. Source designs are immutable. */
import * as T from '../../garments-r04/vendor/three.module.js';
const PI=Math.PI,TAU=PI*2;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
const V=(x,y,z)=>new T.Vector3(x,y,z);
const lerp3=(a,b,t)=>a.clone().lerp(b,t);
export const get=(row,key,fallback)=>row?.values?.[key]??row?.overrides?.[key]??fallback;
const num=(r,k,d)=>Number(get(r,k,d));
let BODY=null;
export function setAnatomy(body){BODY=body;}
function sample(y){const a=BODY.sections;let i=0;while(i<a.length-2&&a[i+1][0]<y)i++;const p=a[i],q=a[i+1],t=clamp((y-p[0])/(q[0]-p[0]));return[mix(p[1],q[1],t),mix(p[2],q[2],t),mix(p[3],q[3],t)];}
const palette=['#6b7567','#b1a08b','#4d5b69','#7e6470','#c4b89c','#747b84','#a18e7d','#4d6260'];
export function shade(row){return row.color||palette[(parseInt(row.id.slice(1),10)-1+(row.category==='连衣裙'?3:row.category==='连体裤'?1:0))%palette.length]}
function cloth(color,type='woven'){
 const m=new T.MeshPhysicalMaterial({color,roughness:type==='satin'?.42:.73,metalness:0,side:T.DoubleSide,sheen:.4,sheenRoughness:.72,sheenColor:new T.Color(color).lerp(new T.Color('#ffffff'),.28),clearcoat:0});
 m.onBeforeCompile=s=>{
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWeavePosition;');
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWeavePosition=position;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWeavePosition;');
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    float warp=sin(vWeavePosition.x*5200.0)*sin(vWeavePosition.y*5200.0);
    float grain=sin(vWeavePosition.z*4310.0+vWeavePosition.x*3200.0);
    vec3 grad=vec3(dFdx(warp+grain*.3),dFdy(warp+grain*.3),0.0);
    float aa=1.0-smoothstep(.002,.009,length(fwidth(vWeavePosition)));
    normal=normalize(normal+grad*.035*aa);
  `);
 };
 m.customProgramCacheKey=()=> 'kaopu-woven-r03-v1';return m;
}
function plain(c,r=.7){return new T.MeshStandardMaterial({color:c,roughness:r,side:T.DoubleSide})}
function dispose(root){const gs=new Set(),ms=new Set();root.traverse(o=>{if(o.geometry&&!o.userData.shared)gs.add(o.geometry);if(o.material&&!o.userData.shared)for(const m of Array.isArray(o.material)?o.material:[o.material])ms.add(m)});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());root.clear();}
function patch(group,name,fn,nu,nv,material,reverse=false,mask=null){
 const p=[],uv=[],idx=[];
 for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){const v=fn(i/nu,j/nv);if(!v.every(Number.isFinite))throw Error('Invalid surface: '+name);p.push(...v);uv.push(i/nu,j/nv)}
 for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){if(mask&&!mask((i+.5)/nu,(j+.5)/nv))continue;const a=j*(nu+1)+i,b=a+1,c=a+nu+1,d=c+1;if(reverse)idx.push(a,c,b,b,c,d);else idx.push(a,b,c,b,d,c);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();const m=new T.Mesh(g,material);m.name=name;m.castShadow=true;m.receiveShadow=true;group.add(m);return m;
}
function line(group,points,mat,radius=.00085,name='seam'){if(points.length<2)return;const curve=new T.CatmullRomCurve3(points.map(p=>Array.isArray(p)?V(...p):p));const mesh=new T.Mesh(new T.TubeGeometry(curve,Math.max(16,points.length*2),radius,4,false),mat);mesh.name=name;mesh.userData.structureLine=true;mesh.castShadow=false;group.add(mesh);return mesh;}
function trace(fn,n=60){return Array.from({length:n+1},(_,i)=>fn(i/n))}
function hem(group,fn,material,inset=.0015,name='folded-open-hem'){patch(group,name,(u,v)=>{const p=fn(u);return[p[0]*(1-v*.006),p[1]+v*inset,p[2]*(1-v*.008)]},80,2,material);line(group,trace(fn),material,.0011,name+'-edge');}
function band(group,row,color,y,width=null){
 const curved=get(row,'meta.wb',null)==='FittedWB'||row.style==='FittedWB';const h=width??(.018+num(row,'waistband.width',.25)*.08),mat=cloth(color),[bx,bf,bb]=sample(y);
 const ring=(a,t)=>{let yy=y+(t-.5)*h;const w=(curved?sample(yy)[0]:bx)+.015;return[w*Math.sin(a),yy,(a<PI/2||a>PI*1.5?bf:Math.abs(bb))*Math.cos(a)*1.08]};
 patch(group,'waistband',(u,v)=>ring(u*TAU,v),80,6,mat);hem(group,u=>ring(u*TAU,1),mat,.002,'waistband-open-top');line(group,trace(u=>ring(u*TAU,0)),plain(new T.Color(color).multiplyScalar(.82)),.0007,'waistband-stitch');
}
export {T,PI,TAU,clamp,mix,smooth,V,lerp3,num,BODY,sample,cloth,plain,dispose,patch,line,trace,hem,band};
