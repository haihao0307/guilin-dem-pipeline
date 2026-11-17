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
const WEAVE_TEXTURES=new Map();
function weaveTextures(type='woven'){
 if(WEAVE_TEXTURES.has(type))return WEAVE_TEXTURES.get(type);
 const w=256,h=256,period=type==='knit'?12:8;
 const color=new Uint8Array(w*h*4),normal=new Uint8Array(w*h*4),rough=new Uint8Array(w*h*4);
 const heightAt=(x,y)=>{
  const px=((x%period)+period)%period/period,py=((y%period)+period)%period/period;
  if(type==='satin')return Math.sin(px*TAU)*.014+Math.sin(px*TAU*2)*.003;
  if(type==='knit')return Math.sin((px+py)*TAU)*.018+Math.cos((px-py)*TAU)*.010;
  const warp=Math.sin(px*TAU),weft=Math.sin(py*TAU);
  const crossing=((Math.floor(x/period)+Math.floor(y/period))&1)===0;
  return (crossing?warp:weft)*.016+(crossing?weft:warp)*.005;
 };
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4;
  const hL=heightAt(x-1,y),hR=heightAt(x+1,y),hU=heightAt(x,y-1),hD=heightAt(x,y+1);
  let nx=-(hR-hL)*3.2,ny=-(hD-hU)*3.2,nz=1;
  const inv=1/Math.sqrt(nx*nx+ny*ny+nz*nz);nx*=inv;ny*=inv;nz*=inv;
  const grain=Math.sin(x*.73+y*.21)*1.25+Math.sin(y*.49-x*.17)*.8;
  const thread=type==='satin'?Math.sin(x/period*TAU)*1.2:Math.sin(x/period*TAU)*1.0+Math.cos(y/period*TAU)*.8;
  const lum=Math.max(228,Math.min(255,244+grain+thread));
  color[i]=color[i+1]=color[i+2]=Math.round(lum);color[i+3]=255;
  normal[i]=Math.round((nx*.5+.5)*255);normal[i+1]=Math.round((ny*.5+.5)*255);normal[i+2]=Math.round((nz*.5+.5)*255);normal[i+3]=255;
  const rv=type==='satin'?202+grain:226+grain*.7;
  rough[i]=rough[i+1]=rough[i+2]=Math.max(0,Math.min(255,Math.round(rv)));rough[i+3]=255;
 }
 const make=(data,space)=>{const t=new T.DataTexture(data,w,h,T.RGBAFormat);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(type==='satin'?18:22,type==='satin'?22:28);t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=8;if(space)t.colorSpace=space;t.needsUpdate=true;return t};
 const textures={map:make(color,T.SRGBColorSpace),normal:make(normal),roughness:make(rough)};
 WEAVE_TEXTURES.set(type,textures);return textures;
}
function cloth(color,type='woven'){
 const tex=weaveTextures(type);
 const m=new T.MeshPhysicalMaterial({
  color:new T.Color(color),map:tex.map,normalMap:tex.normal,roughnessMap:tex.roughness,
  roughness:type==='satin'?.46:type==='knit'?.86:.79,metalness:0,side:T.DoubleSide,
  sheen:type==='satin'?.56:.38,sheenRoughness:type==='satin'?.64:.88,
  sheenColor:new T.Color(color).lerp(new T.Color('#ffffff'),.22),
  clearcoat:type==='satin'?.14:.025,clearcoatRoughness:.74
 });
 m.normalScale.set(type==='satin'?.045:type==='knit'?.12:.085,type==='satin'?.045:type==='knit'?.12:.085);
 m.customProgramCacheKey=()=> 'kaopu-atelier-fabric-r01-'+type;
 return m;
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
 const curved=get(row,'meta.wb',null)==='FittedWB'||row.style==='FittedWB';
 const h=width??(.018+num(row,'waistband.width',.25)*.08),mat=cloth(color),edge=plain(new T.Color(color).multiplyScalar(.84));
 const ring=(u,v)=>{const yy=y+(v-.5)*h,p=bodyRing(curved?yy:y,u*TAU,.034);p[1]=yy;return p;};
 patch(group,'anatomically-fitted-waistband',ring,96,8,mat);hem(group,u=>ring(u,1),mat,.0015,'open-waistband-facing');line(group,trace(u=>ring(u,.12),90),edge,.00065,'waistband-stitch');
}
export {T,PI,TAU,clamp,mix,smooth,V,lerp3,num,BODY,sample,cloth,plain,dispose,patch,line,trace,hem,band};

// Garment fitting changes clothing only, never mannequin vertices.
export function fitProfile(y,a,region='torso'){
 const p=BODY.fitProfiles[region],t=clamp((y-p.minY)/p.stepY,0,p.countY-1),i=Math.min(p.countY-2,Math.floor(t)),f=t-i;
 const k=((a/TAU)%1+1)%1*p.countA,j=Math.floor(k),g=k-j,j1=(j+1)%p.countA;
 const r=mix(mix(p.radii[i*p.countA+j],p.radii[i*p.countA+j1],g),mix(p.radii[(i+1)*p.countA+j],p.radii[(i+1)*p.countA+j1],g),f);
 return {r,cx:mix(p.centres[i][0],p.centres[i+1][0],f),cz:mix(p.centres[i][1],p.centres[i+1][1],f)};
}
export function bodyRing(y,a,ease=.025){const f=fitProfile(y,a);return[(f.r+ease)*Math.sin(a),y,f.cz+(f.r+ease)*Math.cos(a)];}
