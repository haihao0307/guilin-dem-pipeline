import * as THREE from 'three';
import {OrbitControls} from '/vendor/OrbitControls.js';

const $ = id => document.getElementById(id);
const canvas=$('terrain');
const scene=new THREE.Scene();
scene.background=new THREE.Color('#101b27');
const camera=new THREE.PerspectiveCamera(40,1,.01,2000);
let renderer,controls,contract,patch,mesh,wireBase,markers,origin,extent,land,rivers,hydro,landCanvas,landPixels;
let landBounds,maskSize,renderSkip=1;const riverLabels=[];
let currentId='overview',exaggeration=1,requestId=0,framePending=false,motionFrames=0;
let samples,cellSupport,rows,cols,worldOrigin,defaultCamera;
const cache=new Map();
const state={version:'R3.1',ready:false,patch:'mountains',exaggeration:1,camera:[],target:[],vertices:0,triangles:0,excludedCells:0,displayStepM:0};

function status(){
 if(!patch) return;
 const ratio=exaggeration===1?'真实比例':`起伏增强 ${exaggeration}×`;
 $('render-status').textContent=`${ratio} · ${state.displayStepM} 米显示采样 · 海域已裁除 · 河道为地图线位`;
 const bound=patch.displayApproximation?.[String(state.displayStepM/patch.stepM)]?.canonicalToDisplayHeightBoundM;
 if(bound===undefined)$('approximation-info').textContent='当前显示层的近似高度界尚未核定；不代表实测精度。';
 if(bound!==undefined)$('approximation-info').textContent=`当前保留区域在理想数值坐标下的显示近似高度界为 ${(Math.ceil(bound*exaggeration*10)/10).toFixed(1)} 米（包含当前增强，未计 GPU 舍入）。它比较显示近似与原格网曲面，不代表实测误差；裁掉的缺测边界不在此界内。`;
}
function render(){
 framePending=false;
 if(!renderer) return;
 controls.update();
 renderer.render(scene,camera);
 const placed=[];
 for(const a of riverLabels){
   const v=a.point.clone().project(camera),hidden=!$('show-rivers').checked||v.z>1||v.z< -1||Math.abs(v.x)>.95||Math.abs(v.y)>.9;
   a.el.hidden=hidden;a.leader.style.display=hidden?'none':'';if(hidden)continue;
   const x=(v.x+1)*canvas.clientWidth/2,anchorY=(1-v.y)*canvas.clientHeight/2;let y=anchorY+(window.innerWidth<760?23:-23);
   while(placed.some(b=>Math.abs(b[0]-x)<62&&Math.abs(b[1]-y)<29))y+=30;
   placed.push([x,y]);a.el.style.left=x+'px';a.el.style.top=y+'px';
   for(const [k,val] of Object.entries({x1:x,y1:anchorY,x2:x,y2:y+(y>anchorY?-12:12)}))a.leader.setAttribute(k,String(val));
 }
 state.camera=camera.position.toArray().map(v=>+v.toFixed(6));
 state.target=controls.target.toArray().map(v=>+v.toFixed(6));
 $('north-arrow').style.transform=`rotate(${-controls.getAzimuthalAngle()*180/Math.PI}deg)`;
 canvas.dataset.camera=state.camera.join(',');
 if(motionFrames>0){motionFrames--;requestRender();}
}
function requestRender(frames=0){
 motionFrames=Math.max(motionFrames,frames);
 if(!framePending){framePending=true;requestAnimationFrame(render);}
}
function resize(){
 const w=canvas.clientWidth,h=canvas.clientHeight;
 if(!w||!h||!renderer)return;
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
 renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();requestRender();
}
function fetchChecked(url){return fetch(url).then(r=>{if(!r.ok)throw Error(`资料读取失败 (${r.status})`);return r;});}
async function checkedBytes(path,expected){
 const b=await (await fetchChecked(path.startsWith('/')?path:'/r3-1/data/'+path)).arrayBuffer();
 if(crypto.subtle){
   const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');
   if(actual!==expected)throw Error('资料校验不一致，请重试');
 }
 return b;
}
function clearObject(object){
 if(!object)return;
 scene.remove(object);object.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of(Array.isArray(o.material)?o.material:[o.material])){m.map?.dispose();m.alphaMap?.dispose();m.dispose();}}});
}
function surfaceHeight(e,n){
 if(!patch)return null;
 const source=contract.source.transform;
 const c=(e-source[2])/source[0]-.5,r=(n-source[5])/source[4]-.5;
 if(c<patch.columnIndices[0]||c>patch.columnIndices.at(-1)||r<patch.rowIndices[0]||r>patch.rowIndices.at(-1))return null;
 const j=Math.min(rows.length-2,Math.max(0,Math.floor((r-patch.rowIndices[0])/(patch.rowIndices[1]-patch.rowIndices[0])/renderSkip)));
 const i=Math.min(cols.length-2,Math.max(0,Math.floor((c-patch.columnIndices[0])/(patch.columnIndices[1]-patch.columnIndices[0])/renderSkip)));
 const r0=rows[j],r1=rows[j+1],c0=cols[i],c1=cols[i+1];
 for(let rr=r0;rr<r1;rr++)for(let cc=c0;cc<c1;cc++)if(!cellSupport[rr*(patch.columns-1)+cc])return null;
 const u=(c-patch.columnIndices[c0])/(patch.columnIndices[c1]-patch.columnIndices[c0]);
 const v=(r-patch.rowIndices[r0])/(patch.rowIndices[r1]-patch.rowIndices[r0]);
 const a=samples[r0*patch.columns+c0],b=samples[r0*patch.columns+c1],d=samples[r1*patch.columns+c0],e1=samples[r1*patch.columns+c1];
 // Visual anchor uses the same disposable triangles as the screen. Canonical
 // bilinear query is stored separately, so no visual contact is called measured.
 return u+v<=1?a+(b-a)*u+(d-a)*v:e1+(d-e1)*(1-u)+(b-e1)*(1-v);
}
const colorStops=[[0,'#285d69'],[150,'#438a70'],[450,'#779d70'],[800,'#aeb77e'],[1150,'#c9b77e'],[1510,'#e0d9b8']].map(([h,c])=>[h,new THREE.Color(c)]);
function elevationColor(h,out){
 const value=Math.max(0,h);
 let i=1;while(i<colorStops.length-1&&value>colorStops[i][0])i++;
 const a=colorStops[i-1],b=colorStops[i];return out.copy(a[1]).lerp(b[1],THREE.MathUtils.clamp((value-a[0])/(b[0]-a[0]),0,1));
}
function makeTerrain(){
 clearObject(mesh);clearObject(wireBase);clearObject(markers);clearObject(hydro);
 const mobile=window.innerWidth<760;
 const skip=mobile&&patch.rows*patch.columns>180000?2:1;renderSkip=skip;
 const indexList=(length)=>{const a=[];for(let i=0;i<length;i+=skip)a.push(i);if(a.at(-1)!==length-1)a.push(length-1);return a;};
 rows=indexList(patch.rows);cols=indexList(patch.columns);
 const nr=rows.length,nc=cols.length;
 const t=contract.source.transform;
 const east=col=>t[2]+t[0]*(col+.5),north=row=>t[5]+t[4]*(row+.5);
 const e0=east(patch.columnIndices[0]),e1=east(patch.columnIndices.at(-1));
 const n0=north(patch.rowIndices[0]),n1=north(patch.rowIndices.at(-1));
 origin=[(e0+e1)/2,(n0+n1)/2];worldOrigin=origin;
 extent=[(e1-e0)/1000,(n0-n1)/1000];
 const uv=new Float32Array(nr*nc*2);
 const positions=new Float32Array(nr*nc*3),colors=new Float32Array(nr*nc*3),col=new THREE.Color();
 for(let j=0;j<nr;j++)for(let i=0;i<nc;i++){
   uv[(j*nc+i)*2]=(patch.columnIndices[cols[i]]-patch.columnIndices[0])/(patch.columnIndices.at(-1)-patch.columnIndices[0]);uv[(j*nc+i)*2+1]=1-(patch.rowIndices[rows[j]]-patch.rowIndices[0])/(patch.rowIndices.at(-1)-patch.rowIndices[0]);
   const r=rows[j],c=cols[i],h=samples[r*patch.columns+c],v=(j*nc+i)*3;
   positions[v]=(east(patch.columnIndices[c])-origin[0])/1000;
   positions[v+1]=(h===contract.source.noData?0:h)/1000;
   positions[v+2]=(origin[1]-north(patch.rowIndices[r]))/1000;
   elevationColor(h,col);colors[v]=col.r;colors[v+1]=col.g;colors[v+2]=col.b;
 }
 const indices=[];let excluded=0;
 for(let j=0;j<nr-1;j++)for(let i=0;i<nc-1;i++){
   let ok=true;
   for(let r=rows[j];r<rows[j+1]&&ok;r++)for(let c=cols[i];c<cols[i+1];c++)if(!cellSupport[r*(patch.columns-1)+c]){ok=false;break;}
   if(!ok){excluded++;continue;}
   const a=j*nc+i,b=a+1,c=a+nc,d=c+1;indices.push(a,c,b,b,c,d);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();
 const mask=makeLandMask([e0,n1,e1,n0],mobile);
 mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({alphaMap:mask,alphaTest:.5,vertexColors:true,roughness:1,metalness:0,side:THREE.FrontSide}));
 mesh.scale.y=exaggeration;scene.add(mesh);
 // Dashed perimeter denotes the selected data window, not a physical wall.
 const outline=new THREE.BufferGeometry().setFromPoints([
 new THREE.Vector3(-extent[0]/2,-.04,-extent[1]/2),new THREE.Vector3(extent[0]/2,-.04,-extent[1]/2),
 new THREE.Vector3(extent[0]/2,-.04,extent[1]/2),new THREE.Vector3(-extent[0]/2,-.04,extent[1]/2),new THREE.Vector3(-extent[0]/2,-.04,-extent[1]/2)]);
 wireBase=new THREE.Line(outline,new THREE.LineDashedMaterial({color:'#536b7b',dashSize:extent[0]/70,gapSize:extent[0]/100,transparent:true,opacity:.5}));wireBase.computeLineDistances();wireBase.visible=false;scene.add(wireBase);
 markers=new THREE.Group();scene.add(markers);
 const selected=contract.queries.find(q=>q.patch===currentId);
 if(selected){
   const [e,n]=selected.position.coordinates,hh=surfaceHeight(e,n);
   if(hh!==null){
      const radius=Math.max(extent[0],extent[1])*.007;
      const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,radius*.15,8,32),new THREE.MeshBasicMaterial({color:'#f3faf5',depthTest:false}));
      ring.rotation.x=-Math.PI/2;ring.position.set((e-origin[0])/1000,hh/1000*exaggeration+radius*.08,(origin[1]-n)/1000);ring.renderOrder=2;markers.add(ring);
      const poleG=new THREE.BufferGeometry().setFromPoints([ring.position.clone(),ring.position.clone().add(new THREE.Vector3(0,radius*5,0))]);
      const pole=new THREE.Line(poleG,new THREE.LineBasicMaterial({color:'#f3faf5',depthTest:false}));pole.renderOrder=2;markers.add(pole);
   }
   $('query-title').textContent=selected.label;$('query-elevation').textContent=`原像元 ${selected.elevation.value} 米`;
   $('query-surface').textContent=selected.canonicalSurface.heightM===null?'曲面求值：缺少有效支撑':`曲面求值 ${selected.canonicalSurface.heightM.toFixed(1)} 米`;
   $('query-anchor').textContent=hh===null?'此显示层缺少有效支撑，保留查询位置，不造落点。':'白色标记为显示锚定，不是物理连接。';
   $('query-card').hidden=false;
 }else $('query-card').hidden=true;
 state.vertices=nr*nc;state.triangles=indices.length/3;state.excludedCells=excluded;state.displayStepM=patch.stepM*skip;
 canvas.dataset.triangles=String(state.triangles);canvas.dataset.patch=currentId;
 makeHydro();fitCamera();status();
}
function fitCamera(){
 const size=Math.max(...extent);
 const centerHeight=(patch.heightRangeM[0]+patch.heightRangeM[1])*.0005*exaggeration;
 controls.target.set(0,centerHeight,0);
 const direction=new THREE.Vector3(.62,.70,.94).normalize();
 const right=new THREE.Vector3(direction.z,0,-direction.x).normalize();
 const up=new THREE.Vector3().crossVectors(direction,right).normalize();
 const tanV=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),tanH=tanV*camera.aspect;
 const halfHeight=(patch.heightRangeM[1]-patch.heightRangeM[0])*.0005*exaggeration;
 let distance=0;
 for(const x of [-extent[0]/2,extent[0]/2])for(const y of [-halfHeight,halfHeight])for(const z of [-extent[1]/2,extent[1]/2]){
   const corner=new THREE.Vector3(x,y,z);
   distance=Math.max(distance,corner.dot(direction)+Math.max(Math.abs(corner.dot(right))/(tanH*.9),Math.abs(corner.dot(up))/(tanV*.82)));
 }
 camera.position.copy(controls.target).addScaledVector(direction,distance);
 controls.minDistance=size*.06;controls.maxDistance=size*5;
 camera.near=Math.max(.002,size/10000);camera.far=size*30;camera.updateProjectionMatrix();
 controls.update();defaultCamera={position:camera.position.clone(),target:controls.target.clone()};requestRender(2);
}
async function selectPatch(id){
 const candidate=contract.patches.find(p=>p.id===id);if(!candidate)throw Error('未知地形范围');
 const token=++requestId;state.ready=false;
 $('loading').hidden=false;$('loading-text').textContent='正在读取真实地形…';$('retry').hidden=true;
 try{
   let data=cache.get(id);
   if(!data){const [a,b]=await Promise.all([checkedBytes(candidate.measurementFile,candidate.measurementSha256),checkedBytes(candidate.validCellFile,candidate.validCellSha256)]);data={samples:new Int16Array(a),support:new Uint8Array(b)};cache.set(id,data);}
   if(token!==requestId)return;
   if(data.samples.length!==candidate.rows*candidate.columns||data.support.length!==(candidate.rows-1)*(candidate.columns-1))throw Error('地形尺寸不一致');
   patch=candidate;samples=data.samples;cellSupport=data.support;currentId=id;
   state.patch=id;makeTerrain();
   $('location').value=id;$('view-title').textContent=patch.label;
   for(const key of ['mountains','overview']){$(key).classList.toggle('active',key===id);$(key).setAttribute('aria-pressed',String(key===id));}
   $('loading').hidden=true;state.ready=true;canvas.dataset.ready='true';requestRender();
 }catch(error){if(token!==requestId)return;showError(error);throw error;}
}
function showError(error){$('loading').hidden=false;$('loading-text').textContent=error.message||'地形加载失败';$('retry').hidden=false;canvas.dataset.ready='false';}
function zoom(factor){camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);controls.update();requestRender(2);}
function rotate(angle){const offset=camera.position.clone().sub(controls.target);offset.applyAxisAngle(new THREE.Vector3(0,1,0),angle);camera.position.copy(controls.target).add(offset);controls.update();requestRender(2);}
function setExaggeration(value){if(![1,3,6].includes(value))throw Error('起伏比例只能为 1、3 或 6');exaggeration=value;state.exaggeration=value;$('exaggeration').value=String(value);if(patch)makeTerrain();}
function resetCamera(){if(!defaultCamera)return;if(exaggeration!==1){setExaggeration(1);return;}camera.position.copy(defaultCamera.position);controls.target.copy(defaultCamera.target);controls.update();requestRender(2);}
function info(open){$('info').hidden=!open;$('info-button').setAttribute('aria-expanded',String(open));}

async function start(){
 try{
   renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
   renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
   scene.add(new THREE.HemisphereLight('#d8edf1','#1d2730',2));
   const sun=new THREE.DirectionalLight('#fff1cf',3.2);sun.position.set(-10,14,-6);scene.add(sun);
   const fill=new THREE.DirectionalLight('#a4c5dd',.65);fill.position.set(8,6,12);scene.add(fill);
   controls=new OrbitControls(camera,canvas);controls.enableDamping=false;controls.maxPolarAngle=Math.PI*.49;controls.minPolarAngle=.03;controls.screenSpacePanning=true;controls.zoomSpeed=.85;controls.rotateSpeed=.7;
   controls.addEventListener('change',()=>requestRender());
   resize();new ResizeObserver(resize).observe(canvas);
   canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();showError(Error('三维显示暂时中断，请重试'));});
   contract=await(await fetchChecked('/r3-1/data/terrain.json')).json();
   const decode=b=>JSON.parse(new TextDecoder().decode(b));
   [land,rivers]=await Promise.all([checkedBytes(contract.hydrography.landFile,contract.hydrography.landSha256).then(decode),checkedBytes(contract.hydrography.riversFile,contract.hydrography.riversSha256).then(decode)]);
   for(const p of contract.patches.filter(p=>!['mountains','overview'].includes(p.id))){const option=document.createElement('option');option.value=p.id;option.textContent=p.label;$('location').append(option);}
   $('mountains').onclick=()=>void selectPatch('mountains').catch(()=>{});$('overview').onclick=()=>void selectPatch('overview').catch(()=>{});
   $('location').onchange=e=>void selectPatch(e.target.value).catch(()=>{});
   $('exaggeration').onchange=e=>setExaggeration(Number(e.target.value));
   $('zoom-in').onclick=()=>zoom(.78);$('zoom-out').onclick=()=>zoom(1.28);
   $('turn-left').onclick=()=>rotate(-Math.PI/8);$('turn-right').onclick=()=>rotate(Math.PI/8);
   $('reset').onclick=resetCamera;
   $('top-view').onclick=()=>{const distance=camera.position.distanceTo(controls.target);camera.position.copy(controls.target).add(new THREE.Vector3(0,distance,.001));controls.update();requestRender(2);};
   $('info-button').onclick=()=>info($('info').hidden);$('close-info').onclick=()=>info(false);$('retry').onclick=()=>location.reload();
   canvas.addEventListener('keydown',e=>{const actions={ArrowLeft:()=>rotate(-.12),ArrowRight:()=>rotate(.12),'+':()=>zoom(.85),'=':()=>zoom(.85),'-':()=>zoom(1.15),'r':resetCamera,'R':resetCamera};if(actions[e.key]){e.preventDefault();actions[e.key]();}});
   document.addEventListener('keydown',e=>{if(e.key==='Escape')info(false);});
   $('show-rivers').onchange=()=>{hydro.children.filter(o=>o.userData.layer==='river').forEach(o=>o.visible=$('show-rivers').checked);requestRender();};
   $('show-coast').onchange=()=>{hydro.children.filter(o=>o.userData.layer==='coast').forEach(o=>o.visible=$('show-coast').checked);requestRender();};
   await selectPatch('overview');
   const context=document.modelContext;
   if(context?.registerTool){
      const lifecycle=new AbortController();
      const tool={name:'set_wenzhou_terrain_view',title:'查看温州三维地形',description:'Switch the visible terrain range and explicitly labelled display exaggeration, or reset its camera. Does not modify source measurements.',inputSchema:{type:'object',properties:{patch:{type:'string',enum:contract.patches.map(p=>p.id)},exaggeration:{type:'number',enum:[1,3,6]},reset:{type:'boolean'}},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},async execute(input){if(!input||typeof input!=='object'||Object.keys(input).some(k=>!['patch','exaggeration','reset'].includes(k)))throw Error('Invalid view options');if(input.patch!==undefined&&!contract.patches.some(p=>p.id===input.patch))throw Error('Unknown patch');if(input.exaggeration!==undefined&&![1,3,6].includes(input.exaggeration))throw Error('Invalid exaggeration');if(input.reset!==undefined&&typeof input.reset!=='boolean')throw Error('Invalid reset');if(input.patch&&input.patch!==currentId)await selectPatch(input.patch);if(input.exaggeration!==undefined)setExaggeration(input.exaggeration);if(input.reset)resetCamera();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return {...state};}};
      try{await context.registerTool(tool,{signal:lifecycle.signal});}catch(error){console.warn('Optional view tool unavailable',error.message);}
      window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
   }
 }catch(error){showError(error);}
}

// Polygon rings and map curves are persistent evidence. This alpha texture and
// draped buffers are disposable display products, never measurement objects.
function makeLandMask(bounds,mobile){
 landBounds=bounds;const [w,s,e,n]=bounds;
 const limit=Math.min(renderer.capabilities.maxTextureSize,mobile?2048:4096);
 maskSize=[Math.min(limit,Math.max(256,Math.ceil((e-w)/25))),Math.min(limit,Math.max(256,Math.ceil((n-s)/25)))];
 landCanvas=document.createElement('canvas');[landCanvas.width,landCanvas.height]=maskSize;
 const ctx=landCanvas.getContext('2d',{willReadFrequently:true});
 ctx.fillStyle='black';ctx.fillRect(0,0,...maskSize);ctx.fillStyle='white';
 for(const polygon of land.polygons){
   ctx.beginPath();
   for(const ring of polygon){ring.forEach(([x,y],i)=>{const xx=(x-w)/(e-w)*maskSize[0],yy=(n-y)/(n-s)*maskSize[1];if(i===0)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy);});ctx.closePath();}
   ctx.fill('evenodd');
 }
 landPixels=ctx.getImageData(0,0,...maskSize).data;
 const texture=new THREE.CanvasTexture(landCanvas);texture.minFilter=THREE.NearestFilter;texture.magFilter=THREE.NearestFilter;texture.generateMipmaps=false;
 state.coastMask={size:maskSize,texelM:[(e-w)/maskSize[0],(n-s)/maskSize[1]],kind:'temporary display mask',gpuUncompressedBytes:maskSize[0]*maskSize[1]*4};
 return texture;
}
function onDisplayedLand(e,n){
 const [w,s,ee,nn]=landBounds;if(e<w||e>ee||n<s||n>nn)return false;
 const x=Math.min(maskSize[0]-1,Math.floor((e-w)/(ee-w)*maskSize[0])),y=Math.min(maskSize[1]-1,Math.floor((nn-n)/(nn-s)*maskSize[1]));
 return landPixels[(y*maskSize[0]+x)*4+1]>=128;
}
function makeHydro(){
 hydro=new THREE.Group();scene.add(hydro);let count=0;
 const lift=Math.max(...extent)*.000015; // kilometres, display-only offset
 const step=state.displayStepM*.5;
 function draw(lines,color,layer,opacity){
   const points=[];
   for(const line of lines)for(let k=1;k<line.length;k++){
     const a=line[k-1],b=line[k];
     if(Math.max(a[0],b[0])<landBounds[0]||Math.min(a[0],b[0])>landBounds[2]||Math.max(a[1],b[1])<landBounds[1]||Math.min(a[1],b[1])>landBounds[3])continue;
     const parts=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/step));let previous=null;
     for(let j=0;j<=parts;j++){
       const t=j/parts,e=a[0]+(b[0]-a[0])*t,n=a[1]+(b[1]-a[1])*t,h=surfaceHeight(e,n);
       const valid=h!==null&&(layer==='coast'||onDisplayedLand(e,n));
       const next=valid?[(e-origin[0])/1000,h/1000*exaggeration+lift,(origin[1]-n)/1000]:null;
       if(previous&&next){const midE=a[0]+(b[0]-a[0])*(j-.5)/parts,midN=a[1]+(b[1]-a[1])*(j-.5)/parts;
         if(surfaceHeight(midE,midN)!==null&&(layer==='coast'||onDisplayedLand(midE,midN)))points.push(...previous,...next);}
       previous=next;
     }
   }
   if(!points.length)return;
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
   const line=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false}));line.userData.layer=layer;line.visible=$(layer==='coast'?'show-coast':'show-rivers').checked;hydro.add(line);count+=points.length/6;
 }
 for(const [kind,color,opacity] of [['river','#67dcff',1],['canal','#4ca9e7',.8],['stream','#4c91b2',.6],['tidal_channel','#baa5ff',.9]])draw(rivers.features.filter(f=>f.kind===kind).flatMap(f=>f.landDisplayLines),color,'river',opacity);
 draw(land.coastlines,'#c7e7d0','coast',.72);
 for(const a of riverLabels){a.el.remove();a.leader.remove();}riverLabels.length=0;
 for(const focus of contract.hydrography.riverFocus){
   let best=null,distance=Infinity;
   for(const f of rivers.features.filter(f=>focus.sourceWayIds.includes(f.osmWayId)))for(const line of f.landDisplayLines)for(const [e,n] of line){
     if(!onDisplayedLand(e,n))continue;const h=surfaceHeight(e,n);if(h===null)continue;
     const d=Math.hypot(e-focus.position[0],n-focus.position[1]);if(d<distance){distance=d;best=[e,n,h];}
   }
   if(best){const el=document.createElement('button');el.className='river-name';el.textContent=focus.name;el.title='查看'+focus.name+'近景（地图标注）';el.onclick=()=>void selectPatch(focus.patch).catch(()=>{});$('stage').append(el);const leader=document.createElementNS('http://www.w3.org/2000/svg','line');$('river-leaders').append(leader);riverLabels.push({el,leader,point:new THREE.Vector3((best[0]-origin[0])/1000,best[2]/1000*exaggeration+lift,(origin[1]-best[1])/1000)});}
 }
 state.hydroSegments=count;state.waterLevel=null;state.visualLineLiftM=lift*1000;
 state.seaSurfaceCreated=false;state.dataWindowOutlineVisible=false;
 canvas.dataset.hydroSegments=String(count);
}
start();

