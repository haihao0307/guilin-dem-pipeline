import pathlib,sys,json,hashlib,shutil
r=pathlib.Path(sys.argv[1]).resolve()
def patch(name,old,new):
 p=r/name;s=p.read_text();assert s.count(old)==1,(name,old[:60],s.count(old));p.write_text(s.replace(old,new))
# Stop doing CPU skin/cloth updates for frames which cannot be presented yet.
patch('render-backpressure.mjs','viewer.frameGate={idle,audit:', 'viewer.frameGate={idle,isBusy:()=>pending||inFlight,audit:')
p=r/'fast-motion-controller.mjs';s=p.read_text();a=s.index(' resumeMotion(){');b=s.index(' setPlaybackSpeed(',a)
s=s[:a]+''' resumeMotion(){
 if(!this.activeClip||this.dead)return false;
 this.pause();const token=this.playToken,h=this.activeClip.header,end=(h.frameCount-1)/h.fps;
 if((this.time||0)>=end)this.time=0;
 this.running=true;let previous=this.frame?.audit?.frameSequence??-1;
 this.started=performance.now()-(this.time||0)*1000/(this.playbackSpeed||1);
 const tick=now=>{
  if(!this.running||this.dead||token!==this.playToken)return;
  if(this.canPresent&&!this.canPresent()){this.stats.unpresentableUpdatesAvoided=(this.stats.unpresentableUpdatesAvoided||0)+1;this.raf=requestAnimationFrame(tick);return;}
  this.time=Math.min(end,(now-this.started)/1000*(this.playbackSpeed||1));
  const frame=Math.min(h.frameCount-1,Math.floor(this.time*h.fps+1e-7));
  if(frame!==previous){const t=performance.now();this.presentMotionFrame(frame);this.stats.lastCPUFrameMS=performance.now()-t;previous=frame;}
  if(this.time<end)this.raf=requestAnimationFrame(tick);
  else Promise.resolve(this.presentationReady).then(ok=>{if(token!==this.playToken||this.dead)return;this.running=false;if(ok===false)this.onError?.(Error('最终画面未完成'));else this.onProgress?.(1,'动作完成 · 复用已验证物理帧');});
 };
 this.raf=requestAnimationFrame(tick);return true;
 }
 adopt(other){
  if(!other?.fromCache||!other.activeClip||other.key!==this.key)return false;
  this.activeClip=other.activeClip;this.time=other.frame.audit.motionTime;
  this.playbackSpeed=other.playbackSpeed||1;this.fromCache=true;this.replayRows=null;
  this.presentMotionFrame(other.frame.audit.frameSequence);this.stats.appearancePreservedFrame=true;return true;
 }
''' + s[b:]
s=s.replace('return this.onFrame?.(rows,this.frame);','this.presentationReady=Promise.resolve(this.onFrame?.(rows,this.frame));return this.presentationReady;')
s=s.replace("this.presentMotionFrame(0);this.stats.actionSwitchMS.push", "this.presentMotionFrame(0);await this.presentationReady;if(token!==this.playToken||this.dead)return false;this.stats.actionSwitchMS.push")
s=s.replace("for(const entry of this.entries)void getClip(entry).catch(()=>{});", "return Promise.all(this.entries.map(entry=>getClip(entry).catch(()=>null)));")
s=s.replace("setTimeout(()=>{if(!this.dead)this.prime();},200);", "setTimeout(()=>{if(!this.dead)this.prefetchReady=this.prime();},200);")
p.write_text(s)
patch('app.mjs','const priorPhysics=physics;priorPhysics?.pause();','const priorPhysics=physics,wasPlaying=!!physics?.running;priorPhysics?.pause();')
patch('app.mjs','newPhysics=new ClothController({onFrame:', 'newPhysics=new ClothController({canPresent:()=>!viewer.frameGate.isBusy(),onFrame:')
patch('app.mjs','source.person,physicsSettings,actor,{look:id});','source.person,physicsSettings,actor,{look:id});\n  const adopted=newPhysics.adopt(priorPhysics);')
patch('app.mjs','for(const it of next)viewer.renderer.compile(it.solid.group,viewer.camera,viewer.scene);','for(const it of next)await viewer.renderer.compileAsync(it.solid.group,viewer.camera,viewer.scene);if(token!==request){newPhysics.dispose();disposeItems(next);return false;}')
patch('app.mjs','controls();updatePhysics(physics.rows,items,physics.frame);message(', 'controls();await updatePhysics(physics.rows,items,physics.frame);if(adopted&&wasPlaying)physics.resumeMotion();message(')
patch('app.mjs',"async function boot(){try{source=await json('SOURCE_LOCK.json');materials=await json('materials.json');", "async function boot(){try{const personPromise=loadPerson(p=>message('载入原人物 · '+Math.round(p.fraction*100)+'%'));[source,materials]=await Promise.all([json('SOURCE_LOCK.json'),json('materials.json')]);")
patch('app.mjs',"const loaded=await loadPerson(p=>message('连接同一个原共同人物 · '+Math.round(p.fraction*100)+'%'));",'const loaded=await personPromise;')
patch('app.mjs',"playMotion:id=>physics?.playMotion(id)","playMotion:id=>{lighting?.studio();viewer.mesh.visible=true;$('body-visible').checked=true;frame('whole','three');return physics?.playMotion(id);}")
# A rejected catalog/texture promise must not poison subsequent retry attempts.
patch('fast-motion-controller.mjs',"async function index(){return catalog??=loadJSON(new URL('./motion-index-v2.json',import.meta.url));}","async function index(){if(!catalog)catalog=loadJSON(new URL('./motion-index-v2.json',import.meta.url)).catch(e=>{catalog=null;throw e;});return catalog;}")
patch('adaptive-solid.mjs','return {meta,maps};})());', 'return {meta,maps};})().catch(e=>{tiles.delete(info.id);throw e;}));')
patch('fast-assets.mjs','let b=await disk(key);if(b){cacheStats.diskHits++;return b;}',"let b=await disk(key);if(b&&hash){const actual=[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('');if(actual!==hash){b=null;cacheStats.corruptDiskReads=(cacheStats.corruptDiskReads||0)+1;const d=await db();try{d?.transaction('bytes','readwrite').objectStore('bytes').delete(key);}catch{}}}if(b){cacheStats.diskHits++;return b;}")
# Explicitly expose honest display timings without high-frequency gl.getError calls.
p=r/'index.html';s=p.read_text().replace('MP05-R1','MP05-R2');s=s.replace('</header>','</header><p id="runtime-note" style="margin:8px 22px;color:#4b5356;font-size:13px">标准动作不会重新解算；正在载入已验证衣形。</p>');p.write_text(s)
p=r/'app.mjs';s=p.read_text().replace('MP05-R1','MP05-R2');s+='''\nlet perfPrevious=null;const perfTimer=setInterval(()=>{if(!viewer)return;const now=performance.now(),g=viewer.frameGate.audit(),n=document.getElementById('runtime-note');if(perfPrevious&&n){const fps=(g.completed-perfPrevious.frames)/((now-perfPrevious.time)/1000);n.textContent=`首幅 ${bootReadyMS===null?'待测':(bootReadyMS/1000).toFixed(2)+' 秒'} · ${physics?.running?'已完成绘制 '+fps.toFixed(1)+' 帧/秒':'已暂停'} · 标准动作不重算 · 特写按需展开原纱线`; }perfPrevious={time:now,frames:g.completed};},1000);addEventListener('pagehide',()=>clearInterval(perfTimer),{once:true});\n''';p.write_text(s)
p=r/'motion-transport.mjs';p.write_text(p.read_text().replace('MP05-R1','MP05-R2'))
p=r/'_build/publish-snapshot.py';s=p.read_text().replace("prefix='kaopu-tailor-workbench/material-products/r05'","prefix='kaopu-tailor-workbench/material-products/r05-2'").replace('MP05-R1','MP05-R2').replace('mp05-r1','mp05-r2');p.write_text(s)
for n in ['CURRENT_HANDOFF.md','RECOVERY_RECEIPT.json','RECOVERY_EVIDENCE_HASHES.json','PROFILE.json']:(r/n).unlink(missing_ok=True)
shutil.rmtree(r/'recovery-evidence',ignore_errors=True)
state={'version':'MP05-R2','continuedSource':'12557b931cfe7ea6da4f4ef65fffaa8577530093','newFixes':['skip CPU deformation for unpresentable frames without slowing animation time','preserve physical pose on appearance-only changes','parallel startup loads','asynchronous shader warmup','wait for final actual frame before marking playback complete','display actual completed-render cadence'],'inherited':['precomputed default clothes','persistent content-addressed action cache','original body and physical solver','screen-scale surface and native yarn microscope'],'fullUserTaskComplete':False,'realDevice60fpsVerified':False,'freePhysicsRealtime':False,'userAccepted':False,'publication':'candidate until public checks'}
(r/'MP05_SCOPE.json').write_text(json.dumps(state,ensure_ascii=False,indent=2))
(r/'README.md').write_text('# MP05-R2 成衣快速运行候选\n\n从已保存MP05接续，不再从MP03重做。默认衣形在发布前计算；标准动作复用持久化真实物理缓存，正常播放不启动bake，不载入SDF。\n\n新增：并行加载、异步着色器预热、图形忙时不重复CPU变形、外观变化保留同物理配方的动作帧、最后实际画面完成才结束动作。显示实际完成绘制频率，不用动画时间充当FPS。\n\n标准远景采用同一曲面厚度上的材料属性近似，不是与逐纱特写像素等价；特写按需展开原生纱线。原人体、衣形、物理内核与缓存不降低约束；仍非完整自碰撞/CCD和任意参数在线实时布料。K04/L04/D01/D04支持三动作，其余默认款式为静态试穿。未通过实际设备60FPS验收，所有未完成项必须随交付说明。\n')
print('MP05-R2 patch applied; physical and shading kernels unchanged')
