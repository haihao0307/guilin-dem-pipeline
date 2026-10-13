from pathlib import Path
import sys,shutil
root=Path(sys.argv[1]).resolve();new=root/'new';here=Path(__file__).resolve().parent
shutil.copyfile(here/'SourceCache.mjs',new/'SourceCache.mjs')
p=new/'app.mjs';s=p.read_text();s="import {SourceCache,sha as sourceSHA} from './SourceCache.mjs';\n"+s
s=s.replace("const start=performance.now();", "const start=performance.now(),sourceCache=new SourceCache(root);let actorHash='',sourceIndex=null,solvedClip=null,decodedRows=null,playAnchor=0,playTime=0,rootPrevious=null,transportStarts=0,sourceOnly=false;\nconst mode=document.createElement('label');mode.innerHTML='<input id=\"mp-source-only\" type=\"checkbox\"> 只核对原动作（隐藏衣物，不算物理）';$('mp-controls').prepend(mode);\n")
a=s.index('function controls()');b=s.index('async function bytes',a)
s=s[:a]+'''function controls(){const disabled=!ready||busy;for(const b of document.querySelectorAll('[data-source-motion]')){const valid=sourceOnly||sourceIndex?.clips.some(c=>c.look===look?.id&&c.action===b.dataset.sourceMotion);b.disabled=disabled||!valid;b.title=valid?'原动作来源已锁定': '当前成衣物理未通过或未完成；勾选只核对原动作可看真实人物动作';} $('mp-look').disabled=disabled; $('mp-play').disabled=disabled||!clip||(!sourceOnly&&!solvedClip);$('mp-reset').disabled=disabled;}
'''+s[b:]
a=s.index('async function selectLook');b=s.index('function frameFromPose',a)
s=s[:a]+'''async function selectLook(id){pause();busy=true;controls();physicsReady=false;const ticket=++serial;try{look=LOOKS.find(l=>l.id===id);if(!look)throw Error('未知成衣');message('载入 R05 专属适体衣形，不在打开页面时重新求解。');const boot=await sourceCache.boot(id,actorHash);if(ticket!==serial)return;
 native.atRest();sourceFrame=null;showProp(null);clip=null;solvedClip=null;decodedRows=null;frames=[];time=0;recording=false;preRoll=0;rootPrevious=null;
 for(const it of items){it.solid?.group.removeFromParent();it.solid?.dispose();it.mesh.geometry.dispose();it.plain.forEach(m=>m.dispose());}items=[];
 for(let i=0;i<boot.fitRows.length;i++){const r=boot.fitRows[i],mesh=nativeGarmentMesh(T,r.packet,lock.person.groundShiftM),uv=[];for(const panel of r.packet.spec.panels)for(const[x,y]of panel.uvMm)uv.push(...mapPanelUV(panel.id,x,y));mesh.geometry.setAttribute('uv',new T.BufferAttribute(Float32Array.from(uv),2));mesh.userData.role=i?'bottom':'top';items.push({mesh,packet:r.packet,info:r.info,plain:mesh.material});}
 applyRows(boot.rows);for(const it of items){it.solid=await buildAdaptiveSolid(it.mesh,it.packet,it.info,{renderer:viewer.renderer});it.solid.group.visible=!sourceOnly;viewer.scene.add(it.solid.group);}physicsReady=true;look.input=boot.fitRows;look.initialRows=boot.rows;look.boot=boot;fitAudit=boot.paperFit;lastAudit=boot.proof;$('mp-look').value=id;view();message('R05 最新人物、EB1 用户灯光、适体成衣已就绪。选择已通过的原动作，直接读取新物理帧。');
 }catch(e){errors.push(e.message);message('新人物衣形接入未完成：'+e.message,true);}finally{busy=false;controls();}}
async function selectAction(id){pause();busy=true;controls();const ticket=++serial;try{const t=performance.now();clip=await native.clip(id);if(ticket!==serial)return;solvedClip=sourceOnly?null:await sourceCache.motion(look.id,id,actorHash);if(solvedClip&&Math.abs(solvedClip.header.sourceDuration-clip.duration)>1e-7)throw Error('原动作时长与新物理帧不一致');time=0;decodedRows=null;rootPrevious=null;recording=false;for(const b of document.querySelectorAll('[data-source-motion]'))b.setAttribute('aria-current',String(b.dataset.sourceMotion===id));
 presentAt(0);$('mp-timeline').max=solvedClip?solvedClip.header.frameCount-1:Math.ceil(clip.duration*120);$('mp-timeline').disabled=false;switches.push({id,sourceKind:clip.row.kind,activationMS:performance.now()-t,physicsBakes:0,sourceOnly,reusedPhysicalFrames:!!solvedClip});message(clip.row.label+(sourceOnly?' · 仅核对原动作，衣物已隐藏':' · R05 同帧真实物理结果，点击即播，无逐动作重新运算'));view();
 }catch(e){clip=null;solvedClip=null;message(e.message,true);errors.push(e.message);}finally{busy=false;controls();}}
function rootOffset(){const j=native.binding.rig.parents.findIndex(p=>p<0),m=native.sampler.world[j],r=native.sampler.rest[j],a=new T.Vector3().setFromMatrixPosition(m),b=new T.Vector3().setFromMatrixPosition(r);return new T.Vector3(a.x-b.x,0,-a.y+b.y);}
function presentAt(t){if(!clip)return;let frame,tSample;if(solvedClip){frame=t>=clip.duration-1e-8?solvedClip.header.frameCount-1:Math.min(solvedClip.header.frameCount-1,Math.floor(Math.max(0,t)*30+1e-6));tSample=Math.min(clip.duration,frame/30);decodedRows=sourceCache.rows(solvedClip,frame,decodedRows);lastAudit={...solvedClip.header.proof,sourceAction:clip.id,sourceTime:tSample,bodyAndClothTime:tSample,cachedActualPhysics:true,paperFit:look.boot.paperFit.method,oldActorCacheUsed:false};}
 else tSample=Math.max(0,Math.min(clip.duration,t));const f=native.sample(clip,tSample);native.binding.animate(f.skin);sourceFrame=f;showProp(f.object);if(decodedRows&&!sourceOnly)applyRows(decodedRows);for(const it of items)it.solid.group.visible=!sourceOnly;
 const r=rootOffset();if(rootPrevious){const delta=r.clone().sub(rootPrevious);viewer.camera.position.add(delta);viewer.orbit.target.add(delta);}rootPrevious=r;if(r.length()>.03)eb?.setBounds([r.x,0,r.z],1.2);time=tSample;viewer.renderer.shadowMap.needsUpdate=true;viewer.render();$('mp-time').textContent=time.toFixed(2)+' / '+clip.duration.toFixed(2)+' 秒';$('mp-timeline').value=solvedClip?frame:Math.round(time*120);
}
'''+s[b:]
a=s.index('async function advance()');b=s.index('function report()',a)
s=s[:a]+'''async function advance(){if(!playing||busy||!clip)return;const t=playTime+(performance.now()-playAnchor)/1000*Number($('mp-speed').value);presentAt(Math.min(t,clip.duration));counter++;if(t>=clip.duration){presentAt(clip.duration);pause();message(clip.row.label+' 已结束；可直接重播或切换其他原动作。');}}
'''+s[b:]
s=s.replace("function report(){return{", "function report(){return{playing,actorHash,cache:sourceCache.stats,sourceOnly,sourceCacheCoverage:sourceIndex?.clips.map(c=>({look:c.look,action:c.action})),sourceSolveFailures:sourceIndex?.failures,physicsBakes:0,transportStarts,solvedFrameCount:solvedClip?.header.frameCount,")
s=s.replace("bodyAndClothPresentedTogether:true", "bodyAndClothPresentedTogether:!sourceOnly")
s=s.replace("referencePhysics:true,realtimeCertified:false", "referencePhysics:!sourceOnly,sourceRuntimePhysicsExecuted:false,realtimeCertified:false")
s=s.replace("cacheEntries:[...cache.keys()]", "cacheEntries:[...sourceCache.pending.keys()]")
s=s.replace("play:()=>{if(!clip||!physicsReady)throw Error('未准备原动作与布料');playing=true;$('mp-play').textContent='暂停';}", "play:()=>{if(!clip||!physicsReady||(!sourceOnly&&!solvedClip))throw Error('未准备原动作与匹配物理');if(time>=clip.duration-1/120)presentAt(0);playTime=time;playAnchor=performance.now();transportStarts++;playing=true;$('mp-play').textContent='暂停';}")
s=s.replace("step:async()=>{playing=true;await advance();pause();return report();}", "step:async()=>{pause();presentAt(time+1/30);return report();},seek:t=>{pause();presentAt(t);return report();}")
s=s.replace("debug:()=>({native,viewer,model,items,worker,sourcePacket,look,clip,frames})", "debug:()=>({native,viewer,model,items,worker,sourcePacket,look,clip,frames,solvedClip,sourceCache})")
a=s.index("$('mp-timeline').oninput=");b=s.index("$('mp-export').onclick=",a)
s=s[:a]+"$('mp-timeline').oninput=e=>{pause();presentAt(Number(e.target.value)/(solvedClip?30:120));};$('mp-source-only').onchange=e=>{pause();sourceOnly=e.target.checked;clip=null;solvedClip=null;decodedRows=null;native.atRest();sourceFrame=null;showProp(null);for(const it of items)it.solid.group.visible=!sourceOnly;applyRows(look.initialRows);rootPrevious=null;time=0;view();controls();message(sourceOnly?'衣物已隐藏：此模式只核对总台原动作，不是衣物物理验收。':'成衣物理模式：仅启用新人物接触检查通过的源动作。');};$('mp-speed').onchange=()=>{playTime=time;playAnchor=performance.now();};"+s[b:]
a=s.index(" const [m,l,p]=await Promise.all");b=s.index(" const original=viewer.render.bind(viewer)",a)
s=s[:a]+" actorHash=await sourceSHA(JSON.stringify(sourcePacket));sourceIndex=await sourceCache.index();lock=await json('SOURCE_LOCK.json');restBody=sourcePacket.positions;for(const opt of $('mp-look').options){const ok=sourceIndex.boots.some(x=>x.look===opt.value);opt.disabled=!ok;if(!ok)opt.textContent+='（新体型待适配，旧版保留）';}\n"+s[b:]
s=s.replace("target=new T.Vector3(0,b+h*.53,0);", "target=new T.Vector3(0,b+h*.53,0).add(rootOffset());rootPrevious=rootOffset();")
s=s.replace('换人物后重新绑定原纸样与真实身体接触；旧 MP05 三个自编动作及其布料回放已停用。','保留原裁片和缝合关系，按 R05 新体型适配平面尺寸。未通过的新物理组合不会用旧缓存冒充。')
s=s.replace('来源更换候选：布料使用原距离／弯曲／衣物互碰撞求解器逐步解算。未经当前人物重新验证的旧动作缓存不会使用；实时流畅度尚未认证。','新人物同帧实际解算回放：准备过程在发布前完成，切换动作不重新运算。并非任意参数自由实时布料；未通过条目在成衣模式禁用，可单独核对原动作。')
s=s.replace("viewer.camera.zoom=1;viewer.camera.updateProjectionMatrix();viewer.orbit.update();viewer.render();}","viewer.camera.zoom=1;viewer.camera.updateProjectionMatrix();viewer.orbit.update();const rr=rootOffset();eb?.setBounds([rr.x,0,rr.z],1.2);viewer.render();}")
p.write_text(s)
print('Prepared release transport with strict R05 actor keys and no on-click cloth solves')
