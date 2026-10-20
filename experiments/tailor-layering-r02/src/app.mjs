import {loadNativeHost} from './native-host.mjs';
import {prepareGarment} from './garment-prep.mjs';
import {nativeGarmentMesh} from './upstream/outfits-r043.mjs';
import {mapPanelUV} from './upstream/panel-grain.mjs';
import {buildContinuousSolid} from './upstream/continuous-solid.mjs';
import {installRenderBackpressure} from './upstream/render-backpressure.mjs';

const $ = id => document.querySelector('#layer-app #' + CSS.escape(id)) || document.getElementById(id);
const root = $('layer-app');
const definitions = {
  inner: {presetId: 'T08', kind: 'inner', name: '高领内搭', note: '内层 · T08 · 原实体针织', order: 1},
  outer: {presetId: 'T03', kind: 'outer', name: 'V领外层', note: '外层 · T03 · 原实体针织', order: 2},
  pants: {presetId: 'P02', kind: 'pants', name: '原款短裤', note: '下装 · P02 · 原实体牛仔', order: 0}
};
let host, bridge, selected = 'outer', ready = false, busy = false, playing = false;
let failure = null, isolated = false, latest = null, ray, pointer, dragPlane, dragged = null;
let loopGeneration = 0, frameStamp = 0, lastPresentation = null, initialSampling = null, lastSamplingPreparation = null;
const items = new Map();
const templates = new Map();
const state = {friction: .3, wind: 0, contactEnabled: true};
const started = performance.now();

class ClothBridge {
  constructor() {
    this.worker = new Worker(new URL('./layer-worker.mjs', import.meta.url), {type: 'module'});
    this.nextID = 1;
    this.pending = new Map();
    this.worker.onmessage = ({data}) => {
      const pending = this.pending.get(data.id);
      if (!pending) return;
      this.pending.delete(data.id);
      clearTimeout(pending.timer);
      if (data.error) pending.reject(new Error(data.error)); else pending.resolve(data);
    };
    this.worker.onerror = event => {
      const error = new Error(event.message || '布料工作线程运行失败。');
      for (const request of this.pending.values()) {clearTimeout(request.timer); request.reject(error);}
      this.pending.clear();
      fail(error);
    };
  }
  call(type, payload = {}) {
    const id = this.nextID++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {this.pending.delete(id); reject(new Error('本次布料计算超过 90 秒。'));}, 90000);
      this.pending.set(id, {resolve, reject, timer});
      this.worker.postMessage({id, type, ...payload});
    });
  }
}

function status(text, bad = false) {
  $('layer-status').textContent = text;
  $('layer-status').classList.toggle('error', bad);
  root.dataset.status = bad ? 'error' : ready ? 'ready' : 'loading';
}

function progress(value) {
  const text = typeof value === 'string' ? value : value.phase;
  if (!ready) $('load-text').textContent = text || '正在准备人物与衣物…';
  if (!ready || busy) status(text || '正在计算');
}

function controls() {
  const disabled = !ready || busy;
  for (const input of root.querySelectorAll('button,input')) input.disabled = disabled;
  for (const kind of Object.keys(definitions)) if ($('add-' + kind)) $('add-' + kind).disabled = disabled || items.has(kind);
  for (const id of ['remove-selected','isolate-selected','color','thickness','tug','view-detail']) $(id).disabled = disabled || !items.has(selected);
  $('push').disabled = disabled || !items.has('outer');
  $('step').disabled = disabled || playing || !!failure;
  $('play').disabled = disabled || !items.size || !!failure;
  $('play').textContent = playing ? '暂停布料模拟' : '开始布料模拟';
  $('play').setAttribute('aria-pressed', String(playing));
  $('reset').disabled = disabled || !items.size;
}

function list() {
  $('layer-list').replaceChildren();
  for (const it of [...items.values()].sort((a,b) => definitions[b.id].order - definitions[a.id].order)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'garment-item' + (selected === it.id ? ' selected' : '');
    button.dataset.garment = it.id;
    button.setAttribute('aria-pressed', String(selected === it.id));
    const swatch = document.createElement('span'); swatch.className = 'swatch'; swatch.style.background = it.color;
    const meta = document.createElement('span'); meta.className = 'garment-meta';
    const name = document.createElement('span'); name.className = 'garment-name'; name.textContent = it.name;
    const note = document.createElement('span'); note.className = 'garment-note'; note.textContent = definitions[it.id].note;
    meta.append(name, note); button.append(swatch, meta);
    button.onclick = () => {selected = it.id; list(); selection(); visibility();};
    $('layer-list').append(button);
  }
  $('metric-layers').textContent = String(items.size);
}

function selection() {
  const it = items.get(selected);
  $('selected-name').textContent = it?.name || '尚未选择衣物';
  if (it) {
    $('color').value = it.color;
    $('thickness').value = it.extraMM || 0;
    $('thickness-value').textContent = '+' + (it.extraMM || 0).toFixed(1) + ' mm';
    $('thickness').title = '纱线几何包络 ' + (it.baseThickness * 1000).toFixed(2) + ' mm；不是实测材料厚度';
  }
  controls();
}

function visibility() {
  const separated = $('exploded').checked;
  for (const it of items.values()) {
    if (!it.solid) continue;
    it.solid.group.visible = !isolated || it.id === selected;
    const offset = separated ? (it.id === 'inner' ? -.42 : it.id === 'outer' ? .42 : 0) : 0;
    it.solid.group.position.x = offset;
    it.mesh.position.x = offset;
    it.mesh.updateMatrixWorld(true);
  }
  if (host) {
    host.viewer.mesh.visible = !isolated;
    host.viewer.scene.traverse(node => {
      if (node.userData?.platformAppearance) node.visible = !isolated;
    });
    host.lighting.floor.visible = !isolated;
    host.lighting.dirty(); host.viewer.render();
  }
  root.dataset.inspectMode = isolated ? 'isolated' : separated ? 'separated' : 'outfit';
}

function uvFor(packet) {
  const uv = [];
  for (const panel of packet.spec.panels) for (const [x,y] of panel.uvMm) uv.push(...mapPanelUV(panel.id,x,y));
  return new Float32Array(uv);
}

function newItem(prepared) {
  const mesh = nativeGarmentMesh(host.THREE, prepared.packet, host.groundShift);
  mesh.geometry.setAttribute('uv', new host.THREE.BufferAttribute(uvFor(prepared.packet), 2));
  mesh.userData.garmentID = prepared.id;
  const it = {...prepared, name: definitions[prepared.id].name, mesh, plain: mesh.material, solid: null,
    baseThickness: prepared.thickness, extraMM: 0, color: prepared.color || '#b7c6cc'};
  items.set(it.id,it);
  return it;
}

function workerRow(it) {
  return {id: it.id, packet: it.packet, positions: it.positions, family: it.family,
    role: it.id === 'pants' ? 'bottom' : 'top', thickness: it.baseThickness + it.extraMM * .001};
}

function deform(it, row) {
  const g = it.mesh.geometry;
  if (!it.oriented) {
    g.setIndex(new host.THREE.BufferAttribute(row.indices, 1));
    it.oriented = true;
  }
  const p = g.attributes.position.array;
  const offset = it.renderOffsetMeters || 0;
  // The retained yarn shader offsets yarns from its carrier. Physics runs at
  // the yarn envelope's mid-surface; move only the invisible carrier back.
  for (let k = 0; k < p.length; k++) p[k] = row.positions[k] - row.normals[k] * offset;
  g.attributes.normal.array.set(row.normals);
  g.attributes.position.needsUpdate = g.attributes.normal.needsUpdate = true;
  g.computeBoundingBox(); g.computeBoundingSphere();
  it.current = row;
  it.solid?.deform();
}

let contactDots = null;
function updateContactDots(audit) {
  if (!host) return;
  if (contactDots) {host.viewer.scene.remove(contactDots); contactDots.geometry.dispose(); contactDots.material.dispose(); contactDots = null;}
  if (!$('contacts').checked || !state.contactEnabled) return;
  const points = audit?.contact?.sampleContactPoints || [];
  if (!points.length) return;
  const geometry = new host.THREE.BufferGeometry();
  geometry.setAttribute('position', new host.THREE.Float32BufferAttribute(points.flatMap(p => p.point),3));
  contactDots = new host.THREE.Points(geometry, new host.THREE.PointsMaterial({color:0xff744d,size:.007,depthTest:false,transparent:true,opacity:.9}));
  contactDots.renderOrder = 100;
  host.viewer.scene.add(contactDots);
}

function diagnostic() {
  const a = latest?.audit || {};
  const rows = [...items.values()].map(it => ({id:it.id,preset:it.presetId,
    displayVertices:it.mesh.geometry.attributes.position.count,solverParticles:it.current?.particles,
    solverTriangles:it.current?.triangles,sewnPairs:it.current?.seamPairs,
    envelopeMM:it.baseThickness * 1000,extraMM:it.extraMM,carrierOffsetMM:(it.renderOffsetMeters || 0) * 1000,
    material:it.info.id,representation:it.solid?.stats?.representation,
    opaqueBackingSheets:it.solid?.stats?.opaqueBackingSheets,
    fixedDistanceTiers:it.solid?.stats?.fixedDistanceTiers,
    yarnSpans:it.solid?.stats?.yarnSpans,placement:it.placementReport}));
  const value = {version:'TAILOR-LAYERING-R02',ready,playing,error:failure,
    nativePerson:{sameModel:host?.sameNativeModel,sameViewer:host?.sameNativeViewer,
      topology:host?.identity?.topologySHA256,revision:host?.sourceRevision,iframes:document.querySelectorAll('iframe').length},
    displayOnlySeparation:$('exploded').checked,displayOnlyIsolation:isolated,
    initializationOrder:['pants','inner','outer'],dynamicGarments:rows,
    physics:a,render:{calls:lastPresentation?.calls,triangles:lastPresentation?.triangles,
      counterScope:'Submitted work across the complete presentation: yarn preparation, shadows, native scene and skin composition; not unique mesh triangles',
      frameGate:host?.viewer.frameGate?.audit(),initialization:host?.renderAudit?.(),
      presentationQueue:host?.presentationQueue,initialSampling,lastSamplingPreparation},
    bootTimings:host?.bootTimings,
    elapsedLoadMS:frameStamp || Math.round(performance.now()-started)};
  $('diagnostics').textContent = JSON.stringify(value,null,2);
  return value;
}

function apply(data) {
  latest = data;
  for (const row of data.rows || []) {
    const it = items.get(row.id);
    if (it) deform(it,row);
  }
  const audit = data.audit || {};
  $('metric-layers').textContent = String(items.size);
  $('metric-contacts').textContent = state.contactEnabled ? (audit.contact ? String(audit.contact.contactCount ?? audit.contact.residualCount ?? 0) : '待求解') : '已关闭';
  $('metric-step').textContent = audit.completedSteps ? Number(audit.solverMS || 0).toFixed(0) + ' ms' : '待求解';
  updateContactDots(audit);
  if (ready && !busy && !failure) {
    const seconds = Number(audit.simulationSeconds || 0).toFixed(3);
    const residual = audit.contact?.residualMaxPenetration;
    status((playing ? '求解中' : '已暂停') + ' · 模拟 ' + seconds + ' 秒' +
      (audit.solverMS > 16.7 ? ' · 慢于实时' : '') +
      (Number.isFinite(residual) ? ' · 离散接触残余 ' + (residual * 1000).toFixed(2) + ' mm' : ''));
  }
  diagnostic();
  host?.lighting.dirty(); host?.viewer.render();
}

async function buildVisual(it) {
  it.solid = await buildContinuousSolid(it.mesh,it.packet,it.info,{
    renderer:host.viewer.renderer,
    onProgress:(fraction,panel) => progress('生成' + it.name + '的原实体材料 · ' + Math.round(fraction * 100) + '% · ' + panel),
    requestRender:() => host.viewer.render()
  });
  host.viewer.scene.add(it.solid.group);
  await host.viewer.renderer.compileAsync(it.solid.group,host.viewer.camera,host.viewer.scene);
  const failed = host.viewer.renderer.info.programs?.filter(p => p.diagnostics?.runnable === false) || [];
  if (failed.length) throw new Error('原实体材料着色器编译失败。');
}

async function waitForPreparedGPU() {
  const gl=host.viewer.renderer.getContext(), sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);
  if(!sync)throw new Error('实体材料准备无法建立 GPU 完成标记。');
  gl.flush();const began=performance.now();
  try {
    while(true){
      const value=gl.clientWaitSync(sync,0,0);
      if(value===gl.WAIT_FAILED || gl.isContextLost())throw new Error('实体材料准备时三维上下文失效。');
      if(value!==gl.TIMEOUT_EXPIRED)return performance.now()-began;
      if(performance.now()-began>180000)throw new Error('实体材料准备超过 180 秒。');
      await new Promise(resolve=>setTimeout(resolve,16));
    }
  }finally{gl.deleteSync(sync);}
}

async function prepareSampling(scope, visibleOnly = true) {
  // Keep the source's actual camera, per-update budget, temporal hysteresis and
  // 180 ms morph. Explicit view commands can prepare those same samples before
  // submitting a complete native skin/outfit frame for every atlas update.
  const active=[...items.values()].filter(it=>!visibleOnly || it.solid?.group.visible);
  const began=performance.now();let rounds=0,stableSince=null,signature=null,gpuWaitMS=0,settled=false;
  let updateCPUMS=0,maximumUpdateCPUMS=0;
  while(active.length && rounds<100 && performance.now()-began<12000){
    const updateBegan=performance.now();
    for(const it of active){it.solid.motion(false);it.solid.update(host.viewer.camera);}
    const duration=performance.now()-updateBegan;updateCPUMS+=duration;maximumUpdateCPUMS=Math.max(maximumUpdateCPUMS,duration);
    gpuWaitMS+=await waitForPreparedGPU();rounds++;
    const current=active.map(it=>({id:it.id,resamples:it.solid.stats.resamples,
      demandQuality:Math.round((it.solid.resources().continuousDemand.output?.qVisual||0)*1000)/1000,
      queue:it.solid.stats.queuedResamples,chunks:(it.solid.chunks||[]).map(c=>({
        segments:c.current.segments,sides:c.current.sides,atlas:!!c.current.atlas,
        previous:!!c.previous,wake:Number.isFinite(c.samplingWakeAt),deferred:!!c.deferred}))}));
    const next=JSON.stringify(current);
    const outstanding=current.some(row=>row.queue || row.chunks.some(c=>c.previous||c.wake||c.deferred));
    if(next!==signature || outstanding)stableSince=null;
    else stableSince??=performance.now();
    signature=next;
    progress('按当前视角准备原实体纱线 · '+rounds+' 轮');
    if(stableSince!==null && performance.now()-stableSince>=500 && performance.now()-began>=1200){settled=true;break;}
    await new Promise(resolve=>setTimeout(resolve,34));
  }
  return {scope,method:'Unmodified continuous source sampler, actual camera and viewport, real elapsed time, before the requested complete presentation',
    rounds,elapsedMS:performance.now()-began,gpuWaitMS,updateCPUMS,maximumUpdateCPUMS,settledAtObservedTargets:settled,
    stoppedByBudget:!settled,continuousSamplingRemainsActive:true,geometryOrQualityPolicyReplaced:false,
    garments:active.map(it=>({id:it.id,submittedYarnTriangles:it.solid.stats.submittedYarnTriangles,
      resamples:it.solid.stats.resamples,queuedResamples:it.solid.stats.queuedResamples,
      uncachedNativeChunks:it.solid.stats.uncachedNativeChunks,frameAtlasBytes:it.solid.stats.frameAtlasBytes,
      deferredChunks:(it.solid.chunks||[]).filter(c=>c.deferred).length,
      sourceDemand:it.solid.resources().continuousDemand,globalAtlasMemory:it.solid.stats.globalAtlasMemory}))};
}

async function waitForCurrentPresentation() {
  // During an operation, pending snapshots remain coalesced. Let the one
  // already submitted frame complete before issuing atlas preparation work.
  const began=performance.now();
  while(host.presentationQueue?.inFlight){
    if(failure)throw new Error(failure);
    if(performance.now()-began>180000)throw new Error('上一幅三维画面尚未完成。');
    await new Promise(resolve=>setTimeout(resolve,16));
  }
}

function serializePresentation() {
  // The retained gate proves GPU completion. Keep only one native frame in
  // flight so synchronous driver queries in the next skin pass cannot block
  // the UI behind a previous full frame on a slow renderer.
  const submit=host.viewer.render.bind(host.viewer),waiters=[];
  const queue={requested:0,completed:0,presentingThrough:0,inFlight:false,pending:false,coalesced:0,
    policy:'One native presentation in flight; requests retain the newest state; the source frame gate verifies completion'};
  host.presentationQueue=queue;
  host.markPresentationStart=()=>{queue.presentingThrough=queue.requested;queue.pending=false;};
  function dispatch(){
    if(queue.inFlight||!queue.pending||busy)return;
    queue.pending=false;queue.inFlight=true;
    submit().then(ok=>{
      const through=queue.presentingThrough;
      queue.inFlight=false;queue.completed=through;
      for(let i=waiters.length-1;i>=0;i--)if(waiters[i].id<=through){waiters[i].resolve(ok);waiters.splice(i,1);}
      if(queue.pending)dispatch();
      diagnostic();
    }).catch(error=>{
      queue.inFlight=false;queue.pending=false;
      for(const waiter of waiters.splice(0))waiter.reject(error);
      fail(error);
    });
  }
  host.viewer.render=()=>{
    const id=++queue.requested;
    if(queue.inFlight||queue.pending)queue.coalesced++;
    queue.pending=true;
    const result=new Promise((resolve,reject)=>waiters.push({id,resolve,reject}));
    dispatch();diagnostic();return result;
  };
}

function disposeItem(it) {
  if (it.solid) host.viewer.scene.remove(it.solid.group);
  it.solid?.dispose(); it.mesh.geometry.dispose();
  for (const material of Array.isArray(it.plain) ? it.plain : [it.plain]) material.dispose();
}

function frame(angle = 'front', detail = false) {
  if (!host) return;
  const {THREE,viewer} = host;
  const meshes = detail && items.has(selected) ? [items.get(selected).mesh] : [viewer.mesh,...[...items.values()].map(it=>it.mesh)];
  const box = new THREE.Box3();
  for (const mesh of meshes) {mesh.updateMatrixWorld(true); box.union(new THREE.Box3().setFromObject(mesh));}
  const center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  const a = angle === 'side' ? Math.PI/2 : angle === 'back' ? Math.PI : .10;
  const fit = Math.max(size.y,(Math.abs(Math.cos(a))*size.x+Math.abs(Math.sin(a))*size.z)/viewer.camera.aspect);
  const distance = fit/(2*Math.tan(viewer.camera.fov*Math.PI/360)) * (detail ? .91 : 1.09) + size.z*.55;
  viewer.camera.position.copy(center).add(new THREE.Vector3(Math.sin(a)*distance,0,Math.cos(a)*distance));
  viewer.orbit.target.copy(center); viewer.orbit.minDistance = .025; viewer.orbit.maxDistance = 15;
  viewer.camera.near = .002; viewer.camera.updateProjectionMatrix(); viewer.orbit.update();
  for (const it of items.values()) it.solid?.detail(detail && it.id === selected);
  host.lighting.dirty(); viewer.render();
}

function stop() {playing=false;loopGeneration++;controls();diagnostic();}
function fail(error) {
  failure = error?.message || String(error); stop();
  status(failure,true);
  if (!ready) {
    $('layer-loading').hidden = false; $('load-text').textContent = failure;
    const note = $('layer-loading').querySelector('.layer-loading-card > span:last-child');
    if (note) note.textContent = '本页需要 WebGL 2。请使用支持三维显示的浏览器重新载入；研究说明仍可阅读。';
  }
  diagnostic(); controls(); console.error(error);
}

async function stepOnce() {apply(await bridge.call('step',{dt:1/120}));}
async function play() {
  if (playing) {stop(); apply(latest); return;}
  if (!ready || busy || failure) return;
  playing=true; const generation=++loopGeneration; controls();
  try {
    while (playing && generation===loopGeneration) {
      await stepOnce();
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
  } catch(error) {fail(error);}
}

async function operation(action) {
  stop(); busy=true;controls();
  try {await action(); failure=null;}
  catch(error) {fail(error);}
  finally {busy=false;list();selection();if(latest && !failure) apply(latest);}
}

async function inspectView(action) {
  await operation(async()=>{
    await waitForCurrentPresentation();
    action();
    lastSamplingPreparation=await prepareSampling('explicit-inspection-view');
  });
}

async function add(kind) {
  if (items.has(kind)) return;
  await operation(async () => {
    await waitForCurrentPresentation();
    progress('准备独立衣物 · '+definitions[kind].name);
    let prepared = templates.get(kind);
    if (!prepared) {prepared = await prepareGarment({host,...definitions[kind],progress});templates.set(kind,prepared);}
    const it = newItem(structuredClone(prepared));
    try {apply(await bridge.call('add',{row:workerRow(it)}));await buildVisual(it);}
    catch(error) {await bridge.call('remove',{garmentId:it.id});items.delete(it.id);disposeItem(it);throw error;}
    selected=kind;isolated=false;visibility();frame('front');
    lastSamplingPreparation=await prepareSampling('added-independent-garment');
  });
}

async function removeSelected() {
  const it = items.get(selected);if(!it)return;
  await operation(async () => {
    const data=await bridge.call('remove',{garmentId:it.id});
    items.delete(it.id);disposeItem(it);selected=items.has('outer')?'outer':items.keys().next().value;
    isolated=false;apply(data);visibility();
  });
}

function recolor(it,color) {
  it.color=color;
  if (it.info.family==='knit') it.info.parameters['base-dye']=color;
  else if (it.info.geometry) it.info.geometry.warpDye=color;
  for (const chunk of it.solid?.chunks || []) {
    if(chunk.uniforms?.uDye) chunk.uniforms.uDye.value.set(color);
    for (const material of new Set([chunk.material,chunk.directMaterial,chunk.mesh?.material])) {
      material?.sheenColor?.set(color).multiplyScalar(1.5);
    }
  }
  if (it.info.family==='knit') it.solid?.group.traverse(node => {
    if (node.name!=='native-continuous-thread') return;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) material?.color?.set(color);
  });
  list();host.viewer.render();diagnostic();
}

function bind() {
  $('play').onclick=play;
  $('step').onclick=()=>operation(stepOnce);
  $('reset').onclick=()=>operation(async()=>{apply(await bridge.call('reset'));failure=null;});
  for(const kind of Object.keys(definitions)) $('add-'+kind).onclick=()=>add(kind);
  $('remove-selected').onclick=removeSelected;
  $('isolate-selected').onclick=()=>{isolated=true;visibility();diagnostic();};
  $('all-visible').onclick=()=>inspectView(()=>{isolated=false;$('exploded').checked=false;visibility();frame('front');});
  $('exploded').onchange=()=>{visibility();diagnostic();};
  $('contacts').onchange=()=>{updateContactDots(latest?.audit);host.viewer.render();};
  $('color').oninput=e=>{const it=items.get(selected);if(it)recolor(it,e.target.value);};
  $('thickness').oninput=e=>{$('thickness-value').textContent='+'+Number(e.target.value).toFixed(1)+' mm';};
  $('thickness').onchange=e=>operation(async()=>{const it=items.get(selected);if(!it)return;it.extraMM=Number(e.target.value);apply(await bridge.call('thickness',{garmentId:it.id,value:it.baseThickness+it.extraMM*.001}));});
  $('friction').oninput=e=>{$('friction-value').textContent=Number(e.target.value).toFixed(2);};
  $('wind').oninput=e=>{$('wind-value').textContent=Number(e.target.value).toFixed(1);};
  for(const [id,key]of [['friction','friction'],['wind','wind'],['cloth-contact','contactEnabled']]){
    $(id).onchange=e=>{state[key]=e.target.type==='checkbox'?e.target.checked:Number(e.target.value);bridge.call('settings',{options:state}).then(apply).catch(fail);};
  }
  for(const angle of ['front','side','back'])$('view-'+angle).onclick=()=>inspectView(()=>frame(angle));
  $('view-detail').onclick=()=>inspectView(()=>frame('front',true));
  for(const [id,kind]of [['tug','tug'],['push','push']])$(id).onclick=()=>operation(async()=>{
    apply(await bridge.call('perturb',{garmentId:kind==='push'?'outer':selected,kind}));await stepOnce();
  });
  const canvas=host.viewer.canvas;
  ray=new host.THREE.Raycaster();pointer=new host.THREE.Vector2();dragPlane=new host.THREE.Plane();
  const updatePointer=e=>{const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2);ray.setFromCamera(pointer,host.viewer.camera);};
  canvas.addEventListener('pointerdown',e=>{
    if(!e.shiftKey || !ready || busy)return;
    updatePointer(e);
    const visible=[...items.values()].filter(it=>it.solid.group.visible);
    const hit=ray.intersectObjects(visible.map(it=>it.mesh),false)[0];if(!hit)return;
    e.stopImmediatePropagation();e.preventDefault();host.viewer.orbit.enabled=false;
    selected=hit.object.userData.garmentID;list();selection();
    const it=items.get(selected);const indices=[hit.face.a,hit.face.b,hit.face.c];
    let vertex=indices[0],distance=Infinity;const p=it.mesh.geometry.attributes.position;
    for(const index of indices){const v=new host.THREE.Vector3().fromBufferAttribute(p,index).add(it.mesh.position);const d=v.distanceToSquared(hit.point);if(d<distance){distance=d;vertex=index;}}
    dragPlane.setFromNormalAndCoplanarPoint(host.viewer.camera.getWorldDirection(new host.THREE.Vector3()),hit.point);
    dragged={id:it.id,vertex,target:hit.point.clone().sub(it.mesh.position).toArray()};
    canvas.setPointerCapture(e.pointerId);
    bridge.call('drag',{drag:dragged}).then(()=>{if(!playing)play();}).catch(fail);
  },true);
  let dragPending=false;
  canvas.addEventListener('pointermove',e=>{
    if(!dragged || dragPending)return;updatePointer(e);const point=new host.THREE.Vector3();if(!ray.ray.intersectPlane(dragPlane,point))return;
    const it=items.get(dragged.id);dragged.target=point.sub(it.mesh.position).toArray();dragPending=true;
    bridge.call('drag',{drag:dragged}).catch(fail).finally(()=>{dragPending=false;});
  });
  const release=()=>{if(!dragged)return;dragged=null;host.viewer.orbit.enabled=true;bridge.call('drag',{drag:null}).catch(fail);};
  canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fail(new Error('WebGL 显示上下文已丢失，请重新载入网页。'));});
}

async function boot() {
  controls();
  try {
    host=await loadNativeHost({stage:$('layer-stage'),progress});
    host.viewer.canvas.style.visibility='hidden';
    for (const node of document.body.children) {
      if (node === root || ['SCRIPT','STYLE','LINK'].includes(node.tagName)) continue;
      node.inert = true; node.setAttribute('aria-hidden','true');
    }
    const nativeRender=host.viewer.render.bind(host.viewer);
    // Native face diffusion finishes with a fullscreen composition pass.
    // Count the complete presentation instead of only that final two-triangle
    // quad; this changes renderer statistics, not any submitted geometry.
    host.viewer.renderer.info.autoReset=false;
    host.viewer.render=()=>{
      // Atlas preparation also submits WebGL work, so hold it together with
      // the native draw until the complete first outfit has been assembled.
      if(host.renderSuspended())return false;
      host.markPresentationStart?.();
      host.viewer.renderer.info.reset();
      for(const it of items.values())if(it.solid?.group.visible){it.solid.motion(playing);it.solid.update(host.viewer.camera);}
      const result=nativeRender();
      const submitted=host.viewer.renderer.info.render;
      lastPresentation={calls:submitted.calls,triangles:submitted.triangles,points:submitted.points,lines:submitted.lines};
      return result;
    };
    bridge=new ClothBridge();
    for(const kind of ['pants','inner','outer']){
      const prepared=await prepareGarment({host,...definitions[kind],progress});templates.set(kind,prepared);newItem(structuredClone(prepared));
    }
    progress('组装各件独立裁片、接缝与共享接触求解器');
    apply(await bridge.call('init',{body:{positions:host.bodyPositions,faces:host.bodyFaces},rows:[...items.values()].map(workerRow),options:state}));
    for(const it of items.values())await buildVisual(it);
    frame('front');
    initialSampling=await prepareSampling('initial-complete-outfit',false);
    host.releaseRender();
    installRenderBackpressure(host.viewer);
    serializePresentation();
    progress('绘制原生人物与三件独立实体衣物');
    host.viewer.canvas.style.visibility='visible';
    bind();list();selection();visibility();frame('front');
    if(!await host.viewer.render())throw new Error('原生人物与衣物的首帧绘制失败。');
    ready=true;frameStamp=Math.round(performance.now()-started);failure=null;
    $('layer-loading').hidden=true;selection();
    status('穿着结构已载入 · 3 件独立衣物 · 联合沉降待检查');diagnostic();
    root.dataset.ready='true';
  }catch(error){fail(error);}
}
boot();
