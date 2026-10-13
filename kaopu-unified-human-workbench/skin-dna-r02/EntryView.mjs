export function mountReviewEntry({api,viewer,model,host,apply}){
 const R=globalThis.__SKIN_REVIEW__,shell=document.getElementById('control-shell'),stage=document.querySelector('.model-stage');
 document.body.classList.add('sd-review');
 const old=document.createElement('details');old.id='sd-legacy-controls';old.innerHTML='<summary>展开原人物与专项参数（保留，未替换）</summary>';
 for(const el of [...shell.children])if(el!==host)old.append(el);shell.append(old);
 const title=document.createElement('section');title.id='sd-view-heading';title.innerHTML='<div><small>SKIN / NATURE RULES · R02</small><strong id="sd-now">正在准备本版肤质</strong><span id="sd-now-note">同一个人 · 同一灯光 · 不新增皱纹几何</span></div><button id="sd-recover">显示新肤质 / 复位取景</button>';
 stage.prepend(title);const source=document.createElement('details');source.id='sd-rule-summary';source.innerHTML='<summary>本版依据与固定规则</summary><p>肤色使用 Meta BioSkin 官方模型的离线查找表，不是自拟染色公式。颜色、局部反光、微表面分别控制；切换肤质不改变人物形体。</p><p>已停用 R01 新加的噪声刻纹、随机雀斑与年龄云斑；继承的额外几何折纹默认强度为零。没有参考支持的细节先不生成。原生细节与毛孔候选仍是继承近似，不能称为实测皮肤。</p><p>Disney 的方向相关拉伸/压缩与扫描风格迁移已纳入规则，但本版未实现完整动态皱纹。静态纹理不冒充实体褶皱。</p><p>详细来源、实施状态和拒绝条件见仓库 NATURAL_SKIN_RULES.md。</p>';
 host.append(source);
 const tools=document.createElement('div');tools.className='sd-toolbar';tools.innerHTML='<button id="sd-native">按需准备原生待机</button><button id="sd-all-tools">原总台导航</button>';host.append(tools);
 document.querySelector('header strong').textContent='皮肤自然规律 · R02';
 function label(record){const p=api.presets.find(x=>x.id===record.preset);document.getElementById('sd-now').textContent=record.enabled?'正在看：'+(p?.name||'自定义肤质'):'正在看：原 R04 材质对照';document.getElementById('sd-now-note').textContent=record.enabled?(p?.note||'本版参考配方 · 不改人物形体'):'同一个人、同一灯光；点右侧按钮返回本版';}
 R.updateLabel=label;api.opening=()=>({version:R.version,ready:R.ready,phase:R.phase,readyMS:R.readyMS,firstFrame:R.firstFrame,coalescedRecoveryDraws:R.coalescedRecoveryDraws||0,errors:[...R.errors],idleDeferred:!window.lifelikeIdle?.runtime?.()?.reviewActivated,materialVersion:api.report().material.version,preset:api.archive().preset,enabled:api.archive().enabled});
 function recover(){
  const idle=window.lifelikeIdle?.runtime?.(),vr=viewer.render,ir=idle?.originalRender;let suppressed=0;const hold=()=>{suppressed++;};viewer.render=hold;if(idle)idle.originalRender=hold;
  try{if(!api.archive().enabled)api.compare();api.channel(0);document.getElementById('sd-channel').value='0';model.regionalFace.settings.diagnostic=0;viewer.regionalSkin.update(model.regionalFace.settings);api.view('face');}
  finally{viewer.render=vr;if(idle)idle.originalRender=ir;}
  if(ir)ir();else vr.call(viewer);R.coalescedRecoveryDraws=(R.coalescedRecoveryDraws||0)+suppressed;label(api.archive());shell.scrollTop=0;window.scrollTo(0,0);
 }
 document.getElementById('sd-recover').onclick=recover;
 document.getElementById('sd-native').onclick=()=>{const r=window.lifelikeIdle?.runtime?.();if(!r)return;document.body.classList.add('sd-show-idle');r.pause(!r.playing?false:true);document.getElementById('sd-native').textContent=r.playing?'暂停原生待机':'继续原生待机';};
 document.getElementById('sd-all-tools').onclick=()=>{document.body.classList.toggle('sd-show-navigation');viewer.resize();};
 label(api.archive());
 let stopped=false;const start=performance.now();const timer=setInterval(()=>{
  if(stopped)return;if(performance.now()-start>180000){stopped=true;clearInterval(timer);R.errors.push('等待本版肤质超时');R.phase='显示未完成，请复制皮肤诊断';window.__LIP_P3__?.fail?.(R.phase);document.getElementById('sd-now').textContent=R.phase;return;}try{const d=window.fullCommonWorkbench?.diagnostics?.();
   if(!d?.ready||d.busy||!viewer.skin.faceExtension?.ready||!viewer.skin.naturalEyeExtension?.ready||!viewer.startupFinalFrame)return;
   // The page lifecycle owns its first frame. QA does not initialize it.
   recover();const gl=viewer.renderer.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,a=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,a);
   let min=255,max=0,n=0;for(let y=Math.floor(h*.18);y<Math.floor(h*.82);y+=7)for(let x=Math.floor(w*.28);x<Math.floor(w*.72);x+=7){const k=(y*w+x)*4;min=Math.min(min,a[k]);max=Math.max(max,a[k]);n+=a[k]>5?1:0;}
   if(gl.getError()!==0||max-min<15||n<80||!api.report().material.compiles)throw Error('新皮肤首帧校验未通过，未标记完成');
   R.firstFrame={width:w,height:h,range:[min,max],visibleSamples:n,materialCompiled:true};R.ready=true;R.readyMS=performance.now()-R.started;R.phase='本版肤质已绘制';const caption=document.getElementById('model-caption');if(caption)caption.textContent='同一人物 · 显示 '+viewer.geometry.attributes.position.count.toLocaleString()+' 顶点 · '+(viewer.geometry.index.count/3).toLocaleString()+' 面';label(api.archive());stopped=true;clearInterval(timer);
  }catch(e){R.errors.push(String(e));R.phase='皮肤显示未完成';window.__LIP_P3__?.fail?.(e.message);stopped=true;clearInterval(timer);document.getElementById('sd-now').textContent=R.phase+'：'+e.message;}
 },180);
 const dispose=model.skinDNA.disposeUI;model.skinDNA.disposeUI=()=>{stopped=true;clearInterval(timer);delete R.updateLabel;title.remove();dispose?.();};
}
