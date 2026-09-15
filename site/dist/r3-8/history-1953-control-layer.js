const FLAG=Symbol.for('wenzhou.r3.10.history-1953-control-index-installed');
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

function fetchJson(url){return fetch(url).then(r=>{if(!r.ok)throw Error(`1953 历史控制资料读取失败 (${r.status})`);return r.json();});}
function currentPatchId(){return document.getElementById('location')?.value||document.getElementById('terrain')?.dataset.patch||'';}
function utm51(lonDeg,latDeg){
  const a=6378137,f=1/298.257223563,e2=f*(2-f),ep2=e2/(1-e2),k0=.9996,lon0=123*Math.PI/180,lat=latDeg*Math.PI/180,lon=lonDeg*Math.PI/180,s=Math.sin(lat),c=Math.cos(lat),t=Math.tan(lat),N=a/Math.sqrt(1-e2*s*s),T=t*t,C=ep2*c*c,A=c*(lon-lon0),e4=e2*e2,e6=e4*e2;
  const M=a*((1-e2/4-3*e4/64-5*e6/256)*lat-(3*e2/8+3*e4/32+45*e6/1024)*Math.sin(2*lat)+(15*e4/256+45*e6/1024)*Math.sin(4*lat)-(35*e6/3072)*Math.sin(6*lat));
  return[500000+k0*N*(A+(1-T+C)*A**3/6+(5-18*T+T*T+72*C-58*ep2)*A**5/120),k0*(M+N*t*(A*A/2+(5-T+9*C+4*C*C)*A**4/24+(61-58*T+T*T+600*C-330*ep2)*A**6/720))];
}
function near(a,b,eps=2e-5){return Math.abs(a-b)<=eps;}
function isNeatline(a,b,bounds){const[w,s,e,n]=bounds;return(near(a[0],w)&&near(b[0],w))||(near(a[0],e)&&near(b[0],e))||(near(a[1],s)&&near(b[1],s))||(near(a[1],n)&&near(b[1],n));}
function rings(geo){const out=[];for(const f of geo.features||[]){const g=f.geometry;if(!g)continue;if(g.type==='Polygon')for(const r of g.coordinates||[])out.push(r);else if(g.type==='MultiPolygon')for(const p of g.coordinates||[])for(const r of p)out.push(r);}return out;}
function patchBounds(contract,patch){
  const t=contract.source.transform,east=col=>t[2]+t[0]*(col+.5),north=row=>t[5]+t[4]*(row+.5),e0=east(patch.columnIndices[0]),e1=east(patch.columnIndices.at(-1)),n0=north(patch.rowIndices[0]),n1=north(patch.rowIndices.at(-1));
  return[Math.min(e0,e1),Math.min(n0,n1),Math.max(e0,e1),Math.max(n0,n1)];
}
function intersects(a,b,box){const minE=Math.min(a[0],b[0]),maxE=Math.max(a[0],b[0]),minN=Math.min(a[1],b[1]),maxN=Math.max(a[1],b[1]);return !(maxE<box[0]||minE>box[2]||maxN<box[1]||minN>box[3]);}
function removeLegacyVisualUi(){
  document.getElementById('history-1953-toggle')?.remove();
  document.getElementById('history-1953-layer-card')?.remove();
  document.getElementById('history-1953-style')?.remove();
}
export function installHistorical1953ControlLayer(){
  if(window[FLAG])return;window[FLAG]=true;removeLegacyVisualUi();
  const contractPromise=fetchJson(TERRAIN_URL),controlPromise=Promise.all(CONTROLS.map(async c=>({...c,geos:await Promise.all(c.urls.map(fetchJson))})));
  let buildToken=0,terrainEvents=0,staleEvents=0;
  const canvas=()=>document.getElementById('terrain');
  function diag(values){const c=canvas();if(!c)return;for(const[k,v]of Object.entries(values))c.dataset[k]=String(v);}
  async function build(patchId){
    const token=++buildToken;diag({history1953LastPatch:patchId,history1953LastError:'',history1953Visualized:false});
    try{
      const[contract,controls]=await Promise.all([contractPromise,controlPromise]);if(token!==buildToken||currentPatchId()!==patchId){staleEvents++;diag({history1953StaleEvents:staleEvents});return;}
      const patch=contract.patches.find(p=>p.id===patchId);if(!patch)throw Error(`1953 历史控制缺少地形 patch ${patchId}`);
      const box=patchBounds(contract,patch),segments=[];let frameRejected=0,outsideRejected=0;
      for(const control of controls)for(const geo of control.geos)for(const ring of rings(geo))for(let i=0;i+1<ring.length;i++){
        const a=ring[i],b=ring[i+1];if(isNeatline(a,b,control.bounds)){frameRejected++;continue;}
        const p0=utm51(a[0],a[1]),p1=utm51(b[0],b[1]);if(!intersects(p0,p1,box)){outsideRejected++;continue;}
        segments.push({sheet:control.sheet,a:p0,b:p1});
      }
      if(token!==buildToken||currentPatchId()!==patchId){staleEvents++;diag({history1953StaleEvents:staleEvents});return;}
      window.__wenzhouHistoricalControl1953={schema:'wenzhou-historical-control-index/1953-v1',patchId,crs:'EPSG:32651',visualized:false,segmentCount:segments.length,segments,sourceSheets:CONTROLS.map(x=>x.sheet),truthBoundary:'2D historical control only; no historical elevation claim'};
      diag({history1953ControlSegments:segments.length,history1953FrameSegmentsRejected:frameRejected,history1953RejectedOutsidePatch:outsideRejected,history1953CommittedPatch:patchId,history1953Visualized:false,history1953LastError:''});
    }catch(error){diag({history1953LastError:error.message||error});console.error(error);}
  }
  window.addEventListener('wenzhou:terrain-added',event=>{
    const patchId=event.detail?.patchId;if(!patchId)return;terrainEvents++;diag({history1953TerrainEvents:terrainEvents,history1953LastEventPatch:patchId,history1953Visualized:false});
    if(currentPatchId()!==patchId){staleEvents++;diag({history1953StaleEvents:staleEvents});return;}
    queueMicrotask(()=>build(patchId));
  });
  document.documentElement.dataset.wenzhouHistory1953ControlIndex='true';
  document.documentElement.dataset.wenzhouHistory1953Visual='false';
}
