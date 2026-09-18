// Injected in the existing R01 workbench closure. Original generators and .kaopu reader are retained.
const phaseFrames=24,poseCarrier=FishMother.createCarrier(),motionPoses=[];
for(let i=0;i<phaseFrames;i++){
 const d=poseCarrier.deform({time:0,phaseOffset:i*TAU/phaseFrames,amplitude:.82,motionMode:'native'});
 const copy={...d,positions:new Float32Array(d.positions),normals:new Float32Array(d.normals)};
 motionPoses.push({data:copy,mesh:new GPUMesh(copy)});
}
const colonyMeshes=HabitatLife.colonies.map((c,i)=>{
 const raw=c.form==='branching'?CoralMother.build({seed:17+i,generations:4,density:.78,growth:1,polypDensity:.3}):CoralForms.build(c.form);
 return{c,mesh:new GPUMesh(CoralForms.fit(raw,c.r,c.h))};
});
const observationNotes=[];let viewFocus='overview',selectedForm='branching',journalSerial=0;
const isolatedCorals={table:new GPUMesh(CoralForms.build('table')),massive:new GPUMesh(CoralForms.build('massive'))};
function poseFor(q){const f=((q.phase/TAU)%1+1)%1*phaseFrames,i=Math.floor(f);return{a:motionPoses[i],b:motionPoses[(i+1)%phaseFrames],blend:f-i}}
function inspectPose(q){const b=poseFor(q),p=new Float32Array(b.a.data.positions.length);for(let i=0;i<p.length;i++)p[i]=b.a.data.positions[i]*(1-b.blend)+b.b.data.positions[i]*b.blend;return{positions:p}}
function drawFishSchool(VP,eye){for(const q of fishSchool){if(!q.alive)continue;const b=poseFor(q);b.a.mesh.draw(VP,eye,model(q.x,q.y,q.z,q.yaw,q.scale),{next:b.b.mesh,blend:b.blend,white:state.white,wire:state.wire,fog:[.23,.51,.56]})}}
function drawScene(){
 resize();gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
 const night=HabitatLife.clock.hour<6||HabitatLife.clock.hour>=19;gl.clearColor(night?.08:.49,night?.17:.71,night?.24:.77,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 const{eye,VP}=view();drawEnvironment(VP,eye);
 if(state.mode==='assembly'){
  if(state.showCoral)for(const {c,mesh}of colonyMeshes)mesh.draw(VP,eye,model(c.x,c.y,c.z),{white:state.white,wire:state.wire});
  if(state.showFish)drawFishSchool(VP,eye);
  if(state.showBird){for(const q of groundBirds)drawBird(q,VP,eye);if(!night)for(const q of airBirds)drawBird(q,VP,eye)}
 }else if(state.mode==='fish')fishMesh.draw(VP,eye,model(0,-1,9),{white:state.white,wire:state.wire});
 else if(state.mode==='bird')birdMesh.draw(VP,eye,model(isolatedBird.x,isolatedBird.y,isolatedBird.z,isolatedBird.yaw),{white:state.white,wire:state.wire});
 else if(state.mode==='coral')(isolatedCorals[selectedForm]||coralMesh).draw(VP,eye,model(0,HabitatLife.bed(0,9),9),{white:state.white,wire:state.wire});
 drawWaterLast(VP,eye);fpsFrames++;if(performance.now()-fpsAt>1000){fps=fpsFrames*1000/(performance.now()-fpsAt);fpsFrames=0;fpsAt=performance.now()}
}
function animateLife(){} // Assembly uses smooth GPU interpolation of native periodic poses, tied to each actor's travel speed.
function checkBodies(){let a=Infinity,b=Infinity,hits=0,alive=0;for(const fish of fishSchool){if(!fish.alive)continue;alive++;const q=HabitatLife.inspectBody(fish,inspectPose(fish),state.time,state.waveHeight);a=Math.min(a,q.minBedClearanceM);b=Math.min(b,q.minSurfaceClearanceM);hits+=q.colliderHits;if(!q.pass)bodyViolations++}qaFrames++;minClearance=Math.min(minClearance,a);minSurface=Math.min(minSurface,b);return{fish:alive,sampledFrames:qaFrames,bodyViolations,coralVertexHits:hits,minBedClearanceM:a,minSurfaceClearanceM:b,minimumObservedBedM:minClearance,minimumObservedSurfaceM:minSurface}}
function updateStatus(){
 const counts=['resident','bait','predator'].map(role=>HabitatLife.roles[role].zh+' '+fishSchool.filter(q=>q.alive&&q.role===role).length);
 $('panelTitle').textContent=modeTitle();$('densityNote').textContent=counts.join(' · ');
 let text='R02 · '+fishSchool.filter(q=>q.alive).length+' 条存活实验鱼 · '+fps.toFixed(0)+' FPS';
 if(state.mode==='fish')text='原生鱼形 A · 9 节定长骨链 · 非物种验收\n'+(state.motionMode==='reference-study'?'非商业参考拟合研究':'独立编写的程序化运动');
 if(state.mode==='bird')text='苍鹭 H5B · '+state.birdAction+' · 保留原载体\n飞行仍为形态研究，未通过自然度验收';
 text+='\n捕食接触 '+HabitatLife.qa.captures+' · 受惊 '+HabitatLife.qa.flees+' · 返回 '+HabitatLife.qa.returns+' · 净空异常 '+bodyViolations;
 text+='\n'+HabitatLife.clock.hour.toFixed(1)+' 时 / 演示潮位 '+HabitatLife.tide(state.time).toFixed(2)+' m · 非实测海况';$('status').textContent=text;
 if($('eventLog'))$('eventLog').textContent=HabitatLife.events.slice(-3).map(e=>e.timeS.toFixed(1)+'s '+({'flee':'避让','return-home':'返回栖息点','predation-contact':'捕食接触'}[e.type]||e.type)+' #'+(e.actor??e.predator)).join('\n')||'尚无行为事件。不同角色使用不同空间与速度。';
 window.__OCEAN_LIFE_QA__={revision:'R02',fish:fishData.metrics,bird:birdData.metrics,collision:{...HabitatLife.qa,bodyViolations,sampledFrames:qaFrames,minBedClearanceM:minClearance,minSurfaceClearanceM:minSurface},counts,fps,visualAcceptance:false,productionReady:false,siteCalibrated:false};
}
function addZone(zone){if(state.schoolCount>=48)return;const role=['resident','bait','predator'][zone],all=HabitatLife.createSchool(48),q={...all.find(x=>x.role===role)};q.id=fishSchool.reduce((m,x)=>Math.max(m,x.id),-1)+1;q.phase+=q.id*.93;fishSchool.push(q);state.schoolCount=fishSchool.length;$('schoolCount').value=state.schoolCount;$('schoolCountOut').textContent=state.schoolCount;updateStatus()}
function focusLife(kind='overview'){
 setMode('assembly');viewFocus=kind;
 if(kind==='reef'){const q=fishSchool.find(q=>q.alive&&q.role==='resident');if(q)camera={target:[q.home[0],q.home[1]-.1,q.home[2]],yaw:.72,pitch:.16,dist:3.6};}
 if(kind==='foodweb')camera={target:[8,-1.3,24],yaw:.55,pitch:.33,dist:16};
 if(kind==='birds')camera={target:[.5,HabitatLife.bed(.5,.6)+.65,.6],yaw:.7,pitch:.2,dist:7.5};
 if(kind==='overview')resetCamera('three');
}
function approach(){focusLife('reef');const q=fishSchool.find(q=>q.alive&&q.role==='resident');if(q)HabitatLife.setObserver([q.x+.75,q.y,q.z+.75]);$('observeNote').textContent='玩家接近测试已开启。鱼先避让，离开后等待安全再回到原栖息点。';updateStatus()}
function retreat(){HabitatLife.setObserver(null);$('observeNote').textContent='玩家已经离开。继续观察返回过程；不会把鱼瞬移回原地。';updateStatus()}
function recordObservation(){
 const {eye,VP}=view(),origin={x:eye[0],y:eye[1],z:eye[2]},visible=p=>{const q=[p[0],p[1],p[2],1],r=[0,0,0,0];for(let row=0;row<4;row++)for(let k=0;k<4;k++)r[row]+=VP[k*4+row]*q[k];return r[3]>0&&Math.abs(r[0])<r[3]&&Math.abs(r[1])<r[3]&&Math.abs(r[2])<r[3]};
 const seen=state.mode==='assembly'&&state.showFish?HabitatLife.journalSnapshot(fishSchool,origin,state.time,12).filter(q=>visible(q.positionM)):[];
 if(!seen.length){$('observeNote').textContent='当前近景没有可记录的可见鱼。先选“礁边近看”或“通道鱼群”。';return null;}
 const n={entryId:++journalSerial,simulationTimeS:state.time,hour:HabitatLife.clock.hour,tideM:HabitatLife.tide(state.time),observations:seen};observationNotes.push(n);if(observationNotes.length>200)observationNotes.shift();
 $('observeNote').textContent='观察簿第 '+n.entryId+' 页：记录 '+seen.length+' 条视野内实验鱼的行为、水深、位置与潮位。没有自动识别成真实物种。';return n;
}
function advance(seconds){if(!Number.isFinite(seconds)||seconds<0||seconds>180)throw Error('QA advance must be 0..180 seconds');state.paused=true;for(let i=0;i<Math.ceil(seconds*60);i++){state.time+=1/60;HabitatLife.step(fishSchool,1/60,state.time,state)}animateBirds();updateWater();updateStatus();return checkBodies()}
for(const b of document.querySelectorAll('[data-focus-life]'))b.onclick=()=>focusLife(b.dataset.focusLife);
$('reefView').onclick=()=>focusLife('reef');$('foodwebView').onclick=()=>focusLife('foodweb');$('overviewView').onclick=()=>focusLife('overview');$('shoreView').onclick=()=>focusLife('birds');$('approach').onclick=approach;$('retreat').onclick=retreat;$('recordObservation').onclick=recordObservation;
$('hour').oninput=e=>{HabitatLife.clock.hour=Number(e.target.value);$('hourOut').textContent=HabitatLife.clock.hour+':00';updateStatus()};
$('tidePhase').oninput=e=>{HabitatLife.clock.tideOffset=Number(e.target.value)*TAU/100;updateWater();updateStatus()};
for(const b of document.querySelectorAll('[data-coral-form]'))b.onclick=()=>{selectedForm=b.dataset.coralForm;setMode('coral');document.querySelectorAll('[data-coral-form]').forEach(x=>x.classList.toggle('on',x===b))};
$('downloadJournal').onclick=()=>{const blob=new Blob([JSON.stringify({schema:'ocean-life-observation-candidate/0.1',world:'synthetic-80x96m',fieldEvidence:false,entries:observationNotes},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='OCEAN_LIFE_OBSERVATIONS.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
window.OceanLifeR02={focusLife,approach,retreat,advance,checkBodies,recordObservation,getJournal:()=>structuredClone(observationNotes),getEvents:()=>structuredClone(HabitatLife.events),getAgents:()=>fishSchool.map(q=>({...q})),getCatalogue:()=>structuredClone(OceanLifeCatalogue),getClock:()=>({...HabitatLife.clock}),setObserver:HabitatLife.setObserver,sample:HabitatLife.sample,pollNarrative:HabitatLife.pollNarrative,gates:{visualAcceptance:false,speciesAcceptance:false,gameIntegrationAcceptance:false,siteCalibrated:false}};
