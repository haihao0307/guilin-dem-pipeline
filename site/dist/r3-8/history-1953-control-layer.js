import * as THREE from 'three';

const FLAG=Symbol.for('wenzhou.r3.10.history-1953-control-layer-installed');
const TERRAIN_URL='../r3-1/data/terrain.json';
const CONTROLS=[
  {sheet:'NH51-13',bounds:[120,28,121.5,29],urls:[
    '../../../records/R3_10/HISTORICAL_1953_WATER_CONTROL_NH51_13_P1.geojson',
    '../../../records/R3_10/HISTORICAL_1953_WATER_CONTROL_NH51_13_P2.geojson',
    '../../../records/R3_10/HISTORICAL_1953_WATER_CONTROL_NH51_13_P3.geojson',
  ]},
  {sheet:'NG51-1',bounds:[120,27,121.5,28],urls:['../../../records/R3_10/HISTORICAL_1953_WATER_CONTROL_NG51_1.geojson']},
  {sheet:'NH51-14',bounds:[121.5,28,123,29],urls:['../../../records/R3_10/HISTORICAL_1953_WATER_CONTROL_NH51_14.geojson']},
];
const LIFT_M=.12;
const REFERENCE_PLANE_M=.12;

function fetchJson(url){return fetch(url).then(r=>{if(!r.ok)throw Error(`1953 控制层读取失败 (${r.status})`);return r.json();});}
function isTerrainCandidate(object){return !!(object?.isMesh&&!object.userData?.wenzhouSeaDemo&&!object.userData?.wenzhouSurfaceEvidence&&!object.userData?.wenzhouLandcoverEvidence&&!object.userData?.wenzhouOsmEvidence&&!object.userData?.wenzhouSoilContextEvidence&&!object.userData?.wenzhouHistory1953&&object.material?.alphaMap&&object.geometry?.attributes?.uv&&object.geometry?.attributes?.position);}
function terrainOrigin(contract,patch){const t=contract.source.transform,east=col=>t[2]+t[0]*(col+.5),north=row=>t[5]+t[4]*(row+.5);const e0=east(patch.columnIndices[0]),e1=east(patch.columnIndices.at(-1)),n0=north(patch.rowIndices[0]),n1=north(patch.rowIndices.at(-1));return[(e0+e1)/2,(n0+n1)/2];}
function lowerCell(values,v){if(values.length<2||v<values[0]||v>values.at(-1))return-1;let lo=0,hi=values.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(values[m]<=v)lo=m;else hi=m;}return Math.min(values.length-2,Math.max(0,lo));}
function terrainSampler(terrain){
  const pos=terrain.geometry?.attributes?.position,index=terrain.geometry?.index;if(!pos||!index)throw Error('1953 控制层无法锚定：地形缺少 position/index');
  const count=pos.count,z0=pos.getZ(0);let nc=1;while(nc<count&&Math.abs(pos.getZ(nc)-z0)<1e-8)nc++;if(nc<2||count%nc!==0)throw Error('1953 控制层无法识别规则地形网格');
  const nr=count/nc,xs=Array.from({length:nc},(_,i)=>pos.getX(i)),zs=Array.from({length:nr},(_,j)=>pos.getZ(j*nc)),valid=new Uint8Array((nr-1)*(nc-1)),ia=index.array;
  for(let k=0;k+5<ia.length;k+=6){const a=Number(ia[k]),j=Math.floor(a/nc),i=a-j*nc;if(i>=0&&i<nc-1&&j>=0&&j<nr-1)valid[j*(nc-1)+i]=1;}
  const sy=terrain.scale?.y??1;
  return{bounds:[xs[0],zs[0],xs.at(-1),zs.at(-1)],sample(x,z){const i=lowerCell(xs,x),j=lowerCell(zs,z);if(i<0||j<0||!valid[j*(nc-1)+i])return null;const x0=xs[i],x1=xs[i+1],z0v=zs[j],z1=zs[j+1];if(x1===x0||z1===z0v)return null;const u=(x-x0)/(x1-x0),v=(z-z0v)/(z1-z0v),a=pos.getY(j*nc+i)*sy,b=pos.getY(j*nc+i+1)*sy,c=pos.getY((j+1)*nc+i)*sy,d=pos.getY((j+1)*nc+i+1)*sy;return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);}};
}
function utm51(lonDeg,latDeg){
  const a=6378137,f=1/298.257223563,e2=f*(2-f),ep2=e2/(1-e2),k0=.9996,lon0=123*Math.PI/180,lat=latDeg*Math.PI/180,lon=lonDeg*Math.PI/180,s=Math.sin(lat),c=Math.cos(lat),t=Math.tan(lat),N=a/Math.sqrt(1-e2*s*s),T=t*t,C=ep2*c*c,A=c*(lon-lon0),e4=e2*e2,e6=e4*e2;
  const M=a*((1-e2/4-3*e4/64-5*e6/256)*lat-(3*e2/8+3*e4/32+45*e6/1024)*Math.sin(2*lat)+(15*e4/256+45*e6/1024)*Math.sin(4*lat)-(35*e6/3072)*Math.sin(6*lat));
  return[500000+k0*N*(A+(1-T+C)*A**3/6+(5-18*T+T*T+72*C-58*ep2)*A**5/120),k0*(M+N*t*(A*A/2+(5-T+9*C+4*C*C)*A**4/24+(61-58*T+T*T+600*C-330*ep2)*A**6/720))];
}
function near(a,b,eps=2e-5){return Math.abs(a-b)<=eps;}
function isNeatline(a,b,bounds){const[w,s,e,n]=bounds;return(near(a[0],w)&&near(b[0],w))||(near(a[0],e)&&near(b[0],e))||(near(a[1],s)&&near(b[1],s))||(near(a[1],n)&&near(b[1],n));}
function rings(geo){const out=[];for(const f of geo.features||[]){const g=f.geometry;if(!g)continue;if(g.type==='Polygon')for(const r of g.coordinates||[])out.push(r);else if(g.type==='MultiPolygon')for(const p of g.coordinates||[])for(const r of p)out.push(r);}return out;}
function inHorizontalBounds(x,z,b){const xmin=Math.min(b[0],b[2]),xmax=Math.max(b[0],b[2]),zmin=Math.min(b[1],b[3]),zmax=Math.max(b[1],b[3]);return x>=xmin&&x<=xmax&&z>=zmin&&z<=zmax;}
function ensureUi(){
  if(document.getElementById('history-1953-toggle'))return;
  const views=document.querySelector('.view-switch');if(views){const b=document.createElement('button');b.id='history-1953-toggle';b.type='button';b.textContent='1953层';b.setAttribute('aria-pressed','false');b.title='显示/隐藏 1953 历史水域与岸线控制';views.append(b);}
  const panel=document.querySelector('.focus-panel');if(panel&&!document.getElementById('history-1953-layer-card')){const card=document.createElement('div');card.id='history-1953-layer-card';card.className='osm-card';card.hidden=true;card.innerHTML='<strong>1953 历史控制层</strong><span id="history-1953-layer-status">等待地形…</span><small>陆地区段贴当前显示地形；DEM 海域缺测区仅落到参考平面表达二维历史位置。该层用于大尺度海岸、开阔水域、岛屿、围垦/水库冲突判断，不代表历史海拔或测绘级岸线。</small>';panel.prepend(card);}
  if(!document.getElementById('history-1953-style')){const s=document.createElement('style');s.id='history-1953-style';s.textContent='#history-1953-toggle[aria-pressed="true"]{background:#214966;border-color:#6ebef0}';document.head.append(s);}
}
export function installHistorical1953ControlLayer(){
  if(THREE.Object3D.prototype[FLAG])return;THREE.Object3D.prototype[FLAG]=true;
  const originalAdd=THREE.Object3D.prototype.add,contractPromise=fetchJson(TERRAIN_URL),controlPromise=Promise.all(CONTROLS.map(async c=>({...c,geos:await Promise.all(c.urls.map(fetchJson))})));
  let active=null,buildToken=0,renderer=null,camera=null,sceneRef=null;
  function forceRender(){if(renderer&&camera&&sceneRef)renderer.render(sceneRef,camera);}
  function setVisible(value){if(!active)return;const button=document.getElementById('history-1953-toggle'),on=value??button?.getAttribute('aria-pressed')!=='true';if(button)button.setAttribute('aria-pressed',String(on));active.line.visible=on;const card=document.getElementById('history-1953-layer-card');if(card)card.hidden=!on;forceRender();}
  function captureRenderer(terrain,scene){const prior=terrain.onAfterRender;terrain.onAfterRender=function(r,renderScene,c,...rest){renderer=r;camera=c;sceneRef=scene;if(typeof prior==='function')prior.call(this,r,renderScene,c,...rest);};}
  async function build(scene,terrain){
    const token=++buildToken;captureRenderer(terrain,scene);await new Promise(resolve=>requestAnimationFrame(resolve));const patchId=document.getElementById('location')?.value||document.getElementById('terrain')?.dataset.patch||'';
    try{
      const[contract,controls]=await Promise.all([contractPromise,controlPromise]);if(token!==buildToken)return;const patch=contract.patches.find(p=>p.id===patchId);if(!patch)return;
      const origin=terrainOrigin(contract,patch),sampler=terrainSampler(terrain),positions=[];let accepted=0,terrainAnchored=0,referenceAnchored=0,rejectedOutside=0,frameSegments=0;
      for(const control of controls)for(const geo of control.geos)for(const ring of rings(geo))for(let i=0;i+1<ring.length;i++){
        const a=ring[i],b=ring[i+1];if(isNeatline(a,b,control.bounds)){frameSegments++;continue;}
        const[e0,n0]=utm51(a[0],a[1]),[e1,n1]=utm51(b[0],b[1]),x0=(e0-origin[0])/1000,z0=(origin[1]-n0)/1000,x1=(e1-origin[0])/1000,z1=(origin[1]-n1)/1000;
        if(!inHorizontalBounds(x0,z0,sampler.bounds)||!inHorizontalBounds(x1,z1,sampler.bounds)){rejectedOutside++;continue;}
        const h0=sampler.sample(x0,z0),h1=sampler.sample(x1,z1),y0=(h0===null?REFERENCE_PLANE_M:h0+LIFT_M)/1000,y1=(h1===null?REFERENCE_PLANE_M:h1+LIFT_M)/1000;
        if(h0===null||h1===null)referenceAnchored++;else terrainAnchored++;positions.push(x0,y0,z0,x1,y1,z1);accepted++;
      }
      if(token!==buildToken)return;if(active){active.scene.remove(active.line);active.line.geometry.dispose();active.line.material.dispose();}
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));if(positions.length)g.computeBoundingSphere();const m=new THREE.LineBasicMaterial({color:0x4fb6ff,transparent:true,opacity:.84,depthWrite:false});const line=new THREE.LineSegments(g,m);line.renderOrder=3.1;line.userData.wenzhouHistory1953=true;line.userData.kind='1953-coarse-water-coast-control';line.userData.verticalClaim='terrain-anchor-where-known-reference-plane-where-dem-missing';line.visible=false;originalAdd.call(scene,line);active={scene,line,patchId,accepted,terrainAnchored,referenceAnchored,rejectedOutside,frameSegments};
      const canvas=document.getElementById('terrain');if(canvas){canvas.dataset.history1953ControlSegments=String(accepted);canvas.dataset.history1953TerrainAnchored=String(terrainAnchored);canvas.dataset.history1953ReferenceAnchored=String(referenceAnchored);canvas.dataset.history1953FrameSegmentsRejected=String(frameSegments);canvas.dataset.history1953RejectedOutsidePatch=String(rejectedOutside);}
      const status=document.getElementById('history-1953-layer-status');if(status)status.textContent=`${patchId} · 控制线段 ${accepted.toLocaleString()} · 地形锚定 ${terrainAnchored.toLocaleString()} · 海域参考平面 ${referenceAnchored.toLocaleString()}`;setVisible(false);forceRender();
    }catch(error){console.error(error);const status=document.getElementById('history-1953-layer-status');if(status)status.textContent=`1953 控制层失败：${error.message||error}`;}
  }
  THREE.Object3D.prototype.add=function(...objects){const result=originalAdd.apply(this,objects);if(this.isScene)for(const object of objects)if(isTerrainCandidate(object)){ensureUi();queueMicrotask(()=>build(this,object));}return result;};
  const bind=()=>{ensureUi();document.getElementById('history-1953-toggle')?.addEventListener('click',()=>setVisible());};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
}
