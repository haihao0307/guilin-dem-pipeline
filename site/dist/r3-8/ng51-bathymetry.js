import * as THREE from 'three';

const FLAG=Symbol.for('wenzhou.ng51-bathymetry-r1-installed');
const META_URL='./data/bathymetry/ng51-etopo2022-15s.json';
const DATA_URL='./data/bathymetry/ng51-etopo2022-15s.i16';
const EXPECTED_SOURCE_SHA='5b46d290694fb0b5019b800334c6eb42157fe4fea0bc0b253c54424db924bb70';
const BUILD_BUDGET_MS=8;
const DEPTH_STOPS=[[-240,0x0c2742],[-120,0x164c68],[-60,0x246d7b],[-25,0x3d8b88],[-8,0x68a69a],[0,0x8ab9a2]].map(([h,c])=>[h,new THREE.Color(c)]);

function sha(buffer){
  return crypto.subtle.digest('SHA-256',buffer).then(b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join(''));
}
async function fetchJson(url){
  const r=await fetch(url);
  if(!r.ok)throw Error(`NG51 bathymetry JSON读取失败 (${r.status})`);
  return r.json();
}
async function fetchBytes(url,bytes,expectedSha){
  const r=await fetch(url);
  if(!r.ok)throw Error(`NG51 bathymetry 数据读取失败 (${r.status})`);
  const b=await r.arrayBuffer();
  if(b.byteLength!==bytes)throw Error(`NG51 bathymetry 长度不符 ${b.byteLength} != ${bytes}`);
  if(await sha(b)!==expectedSha)throw Error('NG51 bathymetry SHA-256 不一致');
  return b;
}
function littleEndianInt16(buffer){
  const little=new Uint16Array(new Uint8Array([1,0]).buffer)[0]===1;
  if(little)return new Int16Array(buffer);
  const v=new DataView(buffer),out=new Int16Array(buffer.byteLength/2);
  for(let i=0;i<out.length;i++)out[i]=v.getInt16(i*2,true);
  return out;
}
const payloadPromise=(async()=>{
  const meta=await fetchJson(META_URL);
  if(meta.schema!=='wenzhou-ng51-bathymetry-basis/v1'||meta.sourceSha256!==EXPECTED_SOURCE_SHA||meta.sourceCrs!=='EPSG:9518')throw Error('NG51 bathymetry 元数据身份不符');
  const b=await fetchBytes(DATA_URL,meta.payloadBytes,meta.payloadSha256);
  const values=littleEndianInt16(b),[rows,columns]=meta.shape;
  if(values.length!==rows*columns)throw Error('NG51 bathymetry 栅格尺寸不符');
  return{meta,values};
})();

function utm51(lonDeg,latDeg){
  const a=6378137,f=1/298.257223563,e2=f*(2-f),ep2=e2/(1-e2),k0=.9996,lon0=123*Math.PI/180;
  const lat=latDeg*Math.PI/180,lon=lonDeg*Math.PI/180,s=Math.sin(lat),c=Math.cos(lat),t=Math.tan(lat),N=a/Math.sqrt(1-e2*s*s),T=t*t,C=ep2*c*c,A=c*(lon-lon0),e4=e2*e2,e6=e4*e2;
  const M=a*((1-e2/4-3*e4/64-5*e6/256)*lat-(3*e2/8+3*e4/32+45*e6/1024)*Math.sin(2*lat)+(15*e4/256+45*e6/1024)*Math.sin(4*lat)-(35*e6/3072)*Math.sin(6*lat));
  return[500000+k0*N*(A+(1-T+C)*A**3/6+(5-18*T+T*T+72*C-58*ep2)*A**5/120),k0*(M+N*t*(A*A/2+(5-T+9*C+4*C*C)*A**4/24+(61-58*T+T*T+600*C-330*ep2)*A**6/720))];
}
function pixelMask(info){
  const image=info?.image;if(!image)return null;
  const c=document.createElement('canvas');c.width=image.width;c.height=image.height;
  const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(image,0,0);
  return{image,data:x.getImageData(0,0,c.width,c.height).data,width:c.width,height:c.height,box:info.box};
}
function waterAt(mask,e,n){
  const b=mask.box,px=Math.floor((e-b[0])/(b[2]-b[0])*mask.width),py=Math.floor((b[3]-n)/(b[3]-b[1])*mask.height);
  if(px<0||py<0||px>=mask.width||py>=mask.height)return false;
  return mask.data[(py*mask.width+px)*4+1]>=128;
}
function depthColor(h,out){
  const v=Math.min(0,h);let k=1;while(k<DEPTH_STOPS.length-1&&v>DEPTH_STOPS[k][0])k++;
  const a=DEPTH_STOPS[k-1],b=DEPTH_STOPS[k],t=THREE.MathUtils.clamp((v-a[0])/(b[0]-a[0]),0,1);
  return out.copy(a[1]).lerp(b[1],t);
}
function makeWaterTexture(info){
  const t=new THREE.CanvasTexture(info.image);
  t.minFilter=THREE.LinearFilter;t.magFilter=THREE.LinearFilter;t.generateMipmaps=false;t.needsUpdate=true;
  t.userData={wenzhouNg51HistoricalWaterMask:true};return t;
}
async function buildGeometry(payload,waterInfo,runIsCurrent){
  const started=performance.now(),{meta,values}=payload,[rows,columns]=meta.shape,tr=meta.transform,noData=meta.noData,mask=pixelMask(waterInfo);
  if(!mask)throw Error('NG51 bathymetry 缺少历史水域 mask');
  const box=waterInfo.box,centerE=(box[0]+box[2])*.5,centerN=(box[1]+box[3])*.5;
  const positions=new Float32Array(rows*columns*3),colors=new Float32Array(rows*columns*3),uvs=new Float32Array(rows*columns*2),valid=new Uint8Array(rows*columns),col=new THREE.Color();
  let vp=0,up=0,yieldCount=0,maxChunkMs=0,chunkStart=performance.now(),validVertices=0;
  for(let r=0;r<rows;r++){
    const lat=tr[5]+tr[4]*(r+.5);
    for(let c=0;c<columns;c++){
      const lon=tr[2]+tr[0]*(c+.5),q=r*columns+c,h=values[q],[e,n]=utm51(lon,lat);
      positions[vp]=(e-centerE)/1000;positions[vp+1]=(h===noData?0:h)/1000;positions[vp+2]=(centerN-n)/1000;
      depthColor(h===noData?0:h,col);colors[vp]=col.r;colors[vp+1]=col.g;colors[vp+2]=col.b;vp+=3;
      uvs[up]=(e-box[0])/(box[2]-box[0]);uvs[up+1]=(n-box[1])/(box[3]-box[1]);up+=2;
      if(h!==noData&&h<=0&&waterAt(mask,e,n)){valid[q]=1;validVertices++;}
    }
    if((r&7)===0){
      const elapsed=performance.now()-chunkStart;maxChunkMs=Math.max(maxChunkMs,elapsed);
      if(elapsed>=BUILD_BUDGET_MS){if(!runIsCurrent())throw Error('NG51 bathymetry 构建已被新地形替代');yieldCount++;await new Promise(x=>setTimeout(x,0));chunkStart=performance.now();}
    }
  }
  maxChunkMs=Math.max(maxChunkMs,performance.now()-chunkStart);
  const maxIndices=(rows-1)*(columns-1)*6,indices=new Uint32Array(maxIndices);let iw=0,waterCells=0;
  for(let r=0;r<rows-1;r++)for(let c=0;c<columns-1;c++){
    const a=r*columns+c,b=a+1,d=(r+1)*columns+c,e=d+1;
    if(!(valid[a]&&valid[b]&&valid[d]&&valid[e]))continue;
    indices[iw++]=a;indices[iw++]=d;indices[iw++]=b;indices[iw++]=b;indices[iw++]=d;indices[iw++]=e;waterCells++;
  }
  if(!waterCells)throw Error('NG51 bathymetry 未生成历史海域单元');
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.setAttribute('uv',new THREE.BufferAttribute(uvs,2));g.setIndex(new THREE.BufferAttribute(indices.subarray(0,iw),1));g.computeVertexNormals();g.computeBoundingSphere();
  return{geometry:g,waterCells,validVertices,triangles:iw/3,yieldCount,maxChunkMs:+maxChunkMs.toFixed(3),buildMs:+(performance.now()-started).toFixed(3)};
}

export function installNg51Bathymetry(){
  if(window[FLAG])return;window[FLAG]=true;
  let active=null,layer=null,token=0;const canvas=()=>document.getElementById('terrain');
  function dispose(){if(!layer)return;layer.mesh?.parent?.remove(layer.mesh);layer.mesh?.geometry?.dispose();layer.mesh?.material?.dispose();layer.waterTexture?.dispose();layer=null;}
  window.addEventListener('wenzhou:terrain-added',e=>{const{scene,terrain,patchId}=e.detail||{};if(scene?.isScene&&terrain?.isMesh&&patchId){token++;dispose();active={scene,terrain,patchId};}});
  window.addEventListener('wenzhou:map-mother-1940s-refined',async e=>{
    const run=++token,runIsCurrent=()=>run===token&&active?.patchId===e.detail?.patchId;
    try{
      if(!active||active.patchId!==e.detail?.patchId)return;
      const waterInfo=active.terrain.userData?.wenzhouMapMotherStrictHistoricalWater;if(!waterInfo?.image)return;
      const payload=await payloadPromise;if(!runIsCurrent())return;dispose();
      const built=await buildGeometry(payload,waterInfo,runIsCurrent);if(!runIsCurrent()){built.geometry.dispose();return;}
      const waterTexture=makeWaterTexture(waterInfo),material=new THREE.MeshStandardMaterial({alphaTest:.5,vertexColors:true,roughness:1,metalness:0,side:THREE.FrontSide});
      const mesh=new THREE.Mesh(built.geometry,material);mesh.renderOrder=.8;mesh.userData={wenzhouNg51Bathymetry:true,source:'NOAA ETOPO 2022 v1 15 arc-second',sourceCrs:payload.meta.sourceCrs,verticalReference:payload.meta.sourceVerticalReference,truthBoundary:payload.meta.truthBoundary};
      active.scene.add(mesh);mesh.material.alphaMap=waterTexture;mesh.material.needsUpdate=true;layer={mesh,waterTexture};
      const state={schema:'wenzhou-ng51-bathymetry-runtime/v1',ready:true,patchId:active.patchId,source:payload.meta.source,sourceSha256:payload.meta.sourceSha256,sourceCrs:payload.meta.sourceCrs,sourceVerticalReference:payload.meta.sourceVerticalReference,shape:payload.meta.shape,heightRangeM:payload.meta.heightRangeM,waterCells:built.waterCells,validVertices:built.validVertices,triangles:built.triangles,buildMs:built.buildMs,yieldCount:built.yieldCount,maxChunkMs:built.maxChunkMs,truthBoundary:payload.meta.truthBoundary,registrationGuard:'alpha map attached only after scene registration; this derived seabed mesh cannot emit a terrain-added event',cellPolicy:'all four ETOPO corners must be at or below 0 m and inside strict historical water; uncertain shoreline cells remain unrendered',role:'derived broad seabed basis under historical water; independent of the dynamic sea surface'};
      window.__wenzhouNg51Bathymetry=state;const c=canvas();if(c){delete c.dataset.ng51BathymetryError;c.dataset.ng51Bathymetry='true';c.dataset.ng51BathymetryCells=String(built.waterCells);c.dataset.ng51BathymetryTriangles=String(built.triangles);c.dataset.ng51BathymetryBuildMs=String(built.buildMs);}
      window.dispatchEvent(new CustomEvent('wenzhou:ng51-bathymetry-ready',{detail:state}));
    }catch(error){window.__wenzhouNg51Bathymetry={ready:false,error:String(error?.message||error)};const c=canvas();if(c)c.dataset.ng51BathymetryError=String(error?.message||error);console.error(error);}
  });
}
