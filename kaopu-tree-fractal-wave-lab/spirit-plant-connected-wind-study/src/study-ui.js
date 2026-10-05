// Additive pose layer: shared geometry/instance buffers and immutable R03 graph.
const restLines=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xc1c8c4,transparent:true,opacity:.23,depthWrite:false}));scene.add(restLines);
const frameLines=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.8,depthWrite:false}));scene.add(frameLines);
const windLines=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x779db5,transparent:true,opacity:.48,depthWrite:false}));scene.add(windLines);
const windOrigins=[];for(let y=-3;y<=5;y+=1)for(let x=-4;x<=4;x+=1)windOrigins.push(new THREE.Vector3(x,y,-1.8));
windLines.geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(windOrigins.length*6),3));
let frameIndices=[],lastMetricTick=-1;
const frameTemp=new THREE.Vector3(),windTemp=new THREE.Vector3(),sampleTemp=new THREE.Vector3();
function initStudyGraph(){
  const rest=[];for(const n of windRig.nodes)rest.push(...n.restA.toArray(),...n.restB.toArray());
  restLines.geometry.dispose();restLines.geometry=new THREE.BufferGeometry();restLines.geometry.setAttribute('position',new THREE.Float32BufferAttribute(rest,3));
  const step=Math.max(1,Math.ceil(windRig.nodes.length/48));frameIndices=windRig.nodes.map((_,i)=>i).filter(i=>i%step===0);
  const colors=[];for(const i of frameIndices)colors.push(1,.25,.25,1,.25,.25,.25,1,.3,.25,1,.3,.3,.5,1,.3,.5,1);
  frameLines.geometry.dispose();frameLines.geometry=new THREE.BufferGeometry();frameLines.geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(frameIndices.length*18),3));frameLines.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  $('studyIdentity').textContent=`ID ${windRig.identity.seed} / ${windRig.identity.topologyHash} · 枝段 ${windRig.nodes.length} · 芽 ${windRig.buds.length}`;
  lastMetricTick=-1;updateStudyPose();
}
function updateStudyPose(){
  if(!windRig)return;
  windRig.pose(motion.time,{...motion,strength:motion.enabled?motion.strength:0});
  for(let i=0;i<windRig.nodes.length;i++){
    const n=windRig.nodes[i],r=clamp(.012+.0058*Math.pow(n.support,.43),.014,.145)*(1-.055*Math.min(n.order,5));
    setCylinder(i,n.a,n.b,r);setSphere(jointMesh,i,n.a,r*1.06);
  }
  const end=windRig.nodes.at(-1);if(end)setSphere(jointMesh,windRig.nodes.length,end.b,.018);
  let ai=0,di=0;for(const b of windRig.buds){if(b.state==='active'&&ai<MAX_BUDS)setSphere(activeBudMesh,ai++,b.pos,b.type==='leader'?.038:.030);else if(b.state==='dormant'&&di<MAX_BUDS)setSphere(dormantBudMesh,di++,b.pos,.019);}
  for(const m of [branchMesh,jointMesh,activeBudMesh,dormantBudMesh]){m.instanceMatrix.needsUpdate=true;m.frustumCulled=false;}
  restLines.visible=motion.rest;frameLines.visible=motion.frames;windLines.visible=motion.field;
  if(motion.frames){let k=0;const arr=frameLines.geometry.attributes.position.array;for(const i of frameIndices){const n=windRig.nodes[i];for(const axis of [n.T,n.N,n.B]){frameTemp.copy(axis).applyQuaternion(n.rotation).multiplyScalar(Math.min(.22,n.length*.6)).add(n.a);for(const v of [n.a,frameTemp]){arr[k++]=v.x;arr[k++]=v.y;arr[k++]=v.z;}}}frameLines.geometry.attributes.position.needsUpdate=true;frameLines.frustumCulled=false;}
  if(motion.field){let k=0;const arr=windLines.geometry.attributes.position.array;for(const p of windOrigins){sampleTemp.copy(p);sampleTemp.x+=motion.offsetX;sampleTemp.z+=motion.offsetZ;windRig.field(sampleTemp,motion.time,motion.enabled?motion.strength:0,motion.azimuth,windTemp);windTemp.multiplyScalar(.7).add(p);for(const v of [p,windTemp]){arr[k++]=v.x;arr[k++]=v.y;arr[k++]=v.z;}}windLines.geometry.attributes.position.needsUpdate=true;windLines.frustumCulled=false;}
  const tick=Math.floor(motion.time*4);if(tick!==lastMetricTick||!motion.playing){lastMetricTick=tick;const m=windRig.metrics();$('studyMetrics').textContent=`连接误差 ${m.connectionError.toExponential(1)} / 枝长误差 ${m.lengthError.toExponential(1)} / 根端 ${m.rootError.toExponential(1)}`;}
  $('windTimeO').textContent=motion.time.toFixed(2)+' s';$('windTime').value=String(motion.time%30);
}
for(const [id,key] of [['windStrength','strength'],['windAz','azimuth'],['worldOffset','offsetX']])$(id).addEventListener('input',e=>{motion[key]=Number(e.target.value);$('windStrengthO').textContent=motion.strength.toFixed(2);$('windAzO').textContent=motion.azimuth+'°';$('worldOffsetO').textContent=motion.offsetX.toFixed(1);lastMetricTick=-1;updateStudyPose();});
$('windTime').addEventListener('input',e=>{motion.playing=false;motion.time=Number(e.target.value);$('windPlay').textContent='播放风';$('windPlay').classList.remove('on');updateStudyPose();});
$('windOn').addEventListener('click',()=>{motion.enabled=!motion.enabled;$('windOn').textContent='风响应：'+(motion.enabled?'开':'关');$('windOn').classList.toggle('on',motion.enabled);lastMetricTick=-1;updateStudyPose();});
$('windPlay').addEventListener('click',()=>{motion.playing=!motion.playing;$('windPlay').textContent=motion.playing?'暂停风':'播放风';$('windPlay').classList.toggle('on',motion.playing);});
$('windReset').addEventListener('click',()=>{motion.time=0;lastMetricTick=-1;updateStudyPose();});
for(const [id,key] of [['restOverlay','rest'],['localFrames','frames'],['windField','field']])$(id).addEventListener('click',()=>{motion[key]=!motion[key];$(id).classList.toggle('on',motion[key]);updateStudyPose();});
$('applySeed').addEventListener('click',()=>{const v=Number($('plantSeed').value);if(!Number.isSafeInteger(v)||v<0||v>2147483647)return;seed=v;rebuild();});
$('originalSeed').addEventListener('click',()=>{seed=123303;$('plantSeed').value=String(seed);rebuild();});
$('saveIdentity').addEventListener('click',()=>{const record={...windRig.identity,baseline:'95ac11fe07b7940818321fc6be8b56778c3389de',growth:{...P},motion:{...motion}};const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));a.download=`R03-individual-${seed}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);});
window.SpiritR03Study={getState:()=>({identity:windRig?.identity,motion:{...motion},growth:{...P},metrics:windRig?.metrics(),geometryCount:renderer.info.memory.geometries}),rule:RULE_VERSION};
