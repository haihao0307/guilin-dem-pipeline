import * as THREE from 'three';

const FLAG=Symbol.for('wenzhou.ng51-island-relief-r1-installed');
const META_URL='./data/ng51-relief/ng51-islands-50m.json';
const HEIGHT_URL='./data/ng51-relief/ng51-islands-50m.i16.gz';
const SUPPORT_URL='./data/ng51-relief/ng51-islands-50m.support.u8.gz';
const SOURCE_TRANSFORM=[12.5,0,190475,0,-12.5,3241862.5];
const EXPECTED_SOURCE='8800c053608c5fa74eeebd2ce0d06c1bed54fd65274ed059d6e84fc2ec82a1dc';

function sha(buffer){return crypto.subtle.digest('SHA-256',buffer).then(b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join(''));}
async function fetchJson(url){const r=await fetch(url);if(!r.ok)throw Error(`NG51 relief JSON读取失败 (${r.status})`);return r.json();}
async function fetchGzip(url,bytes,expectedSha){
  const r=await fetch(url);if(!r.ok)throw Error(`NG51 relief 数据读取失败 (${r.status})`);
  if(!r.body||typeof DecompressionStream==='undefined')throw Error('浏览器缺少 gzip 流解压能力');
  const b=await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  if(b.byteLength!==bytes)throw Error(`NG51 relief 解压长度不符 ${b.byteLength} != ${bytes}`);
  if(await sha(b)!==expectedSha)throw Error('NG51 relief SHA-256 不一致');
  return b;
}
const payloadPromise=(async()=>{
  const meta=await fetchJson(META_URL);
  if(meta.schema!=='wenzhou-ng51-canonical-relief/v1'||meta.canonicalArchiveSha256!==EXPECTED_SOURCE||meta.runtimeSpacingM!==50)throw Error('NG51 relief 元数据身份不符');
  const[hb,sb]=await Promise.all([fetchGzip(HEIGHT_URL,meta.heightRawBytes,meta.heightRawSha256),fetchGzip(SUPPORT_URL,meta.supportRawBytes,meta.supportRawSha256)]);
  const heights=new Int16Array(hb),support=new Uint8Array(sb),[nr,nc]=meta.shape;
  if(heights.length!==nr*nc||support.length!==(nr-1)*(nc-1))throw Error('NG51 relief 栅格尺寸不符');
  return{meta,heights,support};
})();

function pixelMask(info){
  const image=info?.image;if(!image)return null;const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(image,0,0);return{data:x.getImageData(0,0,c.width,c.height).data,width:c.width,height:c.height,box:info.box};
}
function maskAt(mask,e,n){
  const b=mask.box,px=Math.floor((e-b[0])/(b[2]-b[0])*mask.width),py=Math.floor((b[3]-n)/(b[3]-b[1])*mask.height);
  if(px<0||py<0||px>=mask.width||py>=mask.height)return false;return mask.data[(py*mask.width+px)*4+1]>=128;
}
function heightColor(h,out){
  const stops=[[0,0x285d69],[150,0x438a70],[450,0x779d70],[800,0xaeb77e],[1150,0xc9b77e],[1510,0xe0d9b8]];
  const v=Math.max(0,h);let k=1;while(k<stops.length-1&&v>stops[k][0])k++;const a=stops[k-1],b=stops[k],t=THREE.MathUtils.clamp((v-a[0])/(b[0]-a[0]),0,1);
  return out.setHex(a[1]).lerp(new THREE.Color(b[1]),t);
}
function cutBaseIslands(terrain,islandInfo){
  const source=terrain.material?.alphaMap?.image;if(!source)return null;const w=source.width,h=source.height,c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(source,0,0,w,h);
  const m=document.createElement('canvas');m.width=w;m.height=h;const mx=m.getContext('2d',{willReadFrequently:true});mx.imageSmoothingEnabled=false;mx.drawImage(islandInfo.image,0,0,w,h);
  const frame=x.getImageData(0,0,w,h),mask=mx.getImageData(0,0,w,h).data,d=frame.data;let pixels=0;
  for(let i=0;i<d.length;i+=4)if(mask[i+1]>=128){d[i]=d[i+1]=d[i+2]=0;d[i+3]=255;pixels++;}
  x.putImageData(frame,0,0);const t=new THREE.CanvasTexture(c);t.minFilter=THREE.LinearFilter;t.magFilter=THREE.LinearFilter;t.generateMipmaps=false;t.needsUpdate=true;t.userData={wenzhouNg51IslandBaseCut:true};
  return{texture:t,pixels};
}
function buildIslandGeometry(active,payload,islandInfo,alphaMap){
  const{meta,heights,support}=payload,[nr,nc]=meta.shape,rows=meta.rowIndices,cols=meta.columnIndices,mask=pixelMask(islandInfo);if(!mask)throw Error('NG51 relief 缺少历史岛屿 mask');
  const b=islandInfo.box,centerE=(b[0]+b[2])*.5,centerN=(b[1]+b[3])*.5,east=col=>SOURCE_TRANSFORM[2]+SOURCE_TRANSFORM[0]*(col+.5),north=row=>SOURCE_TRANSFORM[5]+SOURCE_TRANSFORM[4]*(row+.5);
  const e0=east(cols[0]),n0=north(rows[0]),cw=nc-1,ch=nr-1,candidates=new Uint8Array(cw*ch),list=[];
  const pixelCellX=Math.ceil((b[2]-b[0])/mask.width/50)+1,pixelCellY=Math.ceil((b[3]-b[1])/mask.height/50)+1;
  for(let py=0;py<mask.height;py++)for(let px=0;px<mask.width;px++){const q=(py*mask.width+px)*4;if(mask.data[q+1]<128)continue;const e=b[0]+(px+.5)/mask.width*(b[2]-b[0]),n=b[3]-(py+.5)/mask.height*(b[3]-b[1]),ci=Math.floor((e-e0)/50),rj=Math.floor((n0-n)/50);for(let dj=-pixelCellY;dj<=pixelCellY;dj++)for(let di=-pixelCellX;di<=pixelCellX;di++){const i=ci+di,j=rj+dj;if(i<0||j<0||i>=cw||j>=ch)continue;const p=j*cw+i;if(!candidates[p]){candidates[p]=1;list.push(p);}}}
  const cells=[];for(const p of list){if(!support[p])continue;const j=Math.floor(p/cw),i=p-j*cw,e=(east(cols[i])+east(cols[i+1]))*.5,n=(north(rows[j])+north(rows[j+1]))*.5;if(maskAt(mask,e,n))cells.push(p);}
  const vc=cells.length*4,positions=new Float32Array(vc*3),colors=new Float32Array(vc*3),uvs=new Float32Array(vc*2),indices=new Uint32Array(cells.length*6),col=new THREE.Color();let vp=0,up=0,ip=0;
  function vertex(i,j,h){const e=east(cols[i]),n=north(rows[j]);positions[vp]=(e-centerE)/1000;positions[vp+1]=h/1000;positions[vp+2]=(centerN-n)/1000;heightColor(h,col);colors[vp]=col.r;colors[vp+1]=col.g;colors[vp+2]=col.b;vp+=3;uvs[up]=(e-b[0])/(b[2]-b[0]);uvs[up+1]=(n-b[1])/(b[3]-b[1]);up+=2;}
  let base=0;for(const p of cells){const j=Math.floor(p/cw),i=p-j*cw,a=heights[j*nc+i],bb=heights[j*nc+i+1],cc=heights[(j+1)*nc+i],d=heights[(j+1)*nc+i+1];vertex(i,j,a);vertex(i+1,j,bb);vertex(i,j+1,cc);vertex(i+1,j+1,d);indices[ip++]=base;indices[ip++]=base+2;indices[ip++]=base+1;indices[ip++]=base+1;indices[ip++]=base+2;indices[ip++]=base+3;base+=4;}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.setAttribute('uv',new THREE.BufferAttribute(uvs,2));g.setIndex(new THREE.BufferAttribute(indices,1));g.computeVertexNormals();g.computeBoundingSphere();
  const m=new THREE.MeshStandardMaterial({alphaMap,alphaTest:.5,vertexColors:true,roughness:1,metalness:0,side:THREE.FrontSide});const mesh=new THREE.Mesh(g,m);mesh.scale.y=active.terrain.scale?.y??1;mesh.renderOrder=1.15;mesh.userData={wenzhouNg51IslandRelief:true,source:'canonical-dem-r1',runtimeSpacingM:50,islandHoleCount:islandInfo.islandHoleCount};
  return{mesh,candidateCells:list.length,islandCells:cells.length,vertices:vc,triangles:cells.length*2};
}

export function installNg51IslandRelief(){
  if(window[FLAG])return;window[FLAG]=true;let active=null,layer=null,token=0;const canvas=()=>document.getElementById('terrain');
  function dispose(){if(!layer)return;if(layer.terrain?.material?.alphaMap===layer.cutTexture){layer.terrain.material.alphaMap=layer.originalAlpha;layer.terrain.material.needsUpdate=true;}layer.mesh?.parent?.remove(layer.mesh);layer.mesh?.geometry?.dispose();layer.mesh?.material?.dispose();layer.cutTexture?.dispose();layer=null;}
  window.addEventListener('wenzhou:terrain-added',e=>{const{scene,terrain,patchId}=e.detail||{};if(scene?.isScene&&terrain?.isMesh&&patchId){dispose();active={scene,terrain,patchId};}});
  window.addEventListener('wenzhou:map-mother-1940s-refined',async e=>{const run=++token;try{if(!active||active.patchId!==e.detail?.patchId)return;const islandInfo=active.terrain.userData?.wenzhouMapMotherStrictHistoricalIslands;if(!islandInfo?.image||!islandInfo.islandHoleCount)return;const payload=await payloadPromise;if(run!==token)return;dispose();const originalAlpha=active.terrain.material.alphaMap,cut=cutBaseIslands(active.terrain,islandInfo);if(!cut)throw Error('NG51 relief 无法切除 200m 岛体底层');const built=buildIslandGeometry(active,payload,islandInfo,originalAlpha);active.terrain.material.alphaMap=cut.texture;active.terrain.material.needsUpdate=true;active.scene.add(built.mesh);layer={terrain:active.terrain,mesh:built.mesh,originalAlpha,cutTexture:cut.texture};const state={schema:'wenzhou-ng51-island-relief-runtime/v1',ready:true,patchId:active.patchId,source:'canonical-dem-r1',canonicalArchiveSha256:payload.meta.canonicalArchiveSha256,sourceSpacingM:12.5,runtimeSpacingM:50,islandHoleCount:islandInfo.islandHoleCount,baseIslandMaskPixelsCut:cut.pixels,candidateCells:built.candidateCells,islandCells:built.islandCells,vertices:built.vertices,triangles:built.triangles,heightRangeM:payload.meta.heightRangeM};window.__wenzhouNg51IslandRelief=state;const c=canvas();if(c){delete c.dataset.ng51IslandReliefError;c.dataset.ng51IslandRelief='true';c.dataset.ng51IslandReliefCells=String(built.islandCells);c.dataset.ng51IslandReliefTriangles=String(built.triangles);c.dataset.ng51IslandReliefSpacingM='50';c.dataset.ng51IslandReliefSource='canonical-dem-r1';}window.dispatchEvent(new CustomEvent('wenzhou:ng51-island-relief-ready',{detail:state}));}catch(error){window.__wenzhouNg51IslandRelief={ready:false,error:String(error?.message||error)};const c=canvas();if(c)c.dataset.ng51IslandReliefError=String(error?.message||error);console.error(error);}});
}
