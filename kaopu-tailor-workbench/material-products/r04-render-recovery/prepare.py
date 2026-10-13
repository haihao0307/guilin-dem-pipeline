from pathlib import Path
import shutil,sys,json,hashlib
r=Path(sys.argv[1]);here=Path(__file__).resolve().parent
shutil.copyfile(here/'render-backpressure.mjs',r/'render-backpressure.mjs');shutil.copyfile(here/'test-render.mjs',r/'test-render.mjs')
s=(r/'app.mjs').read_text();assert "version:'MP04.4'" in s
s="import {installRenderBackpressure} from './render-backpressure.mjs';\n"+s
s=s.replace('originalRender();};viewer.orbit.minDistance','originalRender();};installRenderBackpressure(viewer);viewer.orbit.minDistance')
s=s.replace('lighting?.dirty();viewer?.render();}}','lighting?.dirty();return viewer?.render();}}')
s=s.replace("version:'MP04.4'","version:'MP04.4.1'")
s=s.replace('lighting:lighting?.audit(),','lighting:lighting?.audit(),renderBackpressure:viewer?.frameGate?.audit(),')
s=s.replace('async function screenshot(){viewer.render();return','async function screenshot(){await viewer.render();return')
assert 'installRenderBackpressure(viewer)' in s and 'return viewer?.render();}}' in s
(r/'app.mjs').write_text(s)
s=(r/'cloth-controller.mjs').read_text();s=s.replace('this.onFrame?.(rows,this.frame);return this.frame.audit;','this.presentationReady=Promise.resolve(this.onFrame?.(rows,this.frame));return this.frame.audit;')
old=""" const tick=now=>{if(!this.running||this.dead||token!==this.playToken)return;
 const frame=this.clock.advance(now);if(frame!==previous){this.presentMotionFrame(frame);previous=frame;}
 if(!this.clock.finished)this.raf=requestAnimationFrame(tick);else{this.running=false;this.onProgress?.(1,'人物动作播放完成');}};"""
new=""" const tick=async now=>{if(!this.running||this.dead||token!==this.playToken)return;
 try{
 if(await this.presentationReady===false)throw Error('画面提交未完成，人物动作已暂停');
 if(!this.running||this.dead||token!==this.playToken)return;
 const frame=this.clock.advance(performance.now());if(frame!==previous){this.presentMotionFrame(frame);previous=frame;if(await this.presentationReady===false)throw Error('画面提交未完成，人物动作已暂停');}
 if(!this.running||this.dead||token!==this.playToken)return;
 if(!this.clock.finished)this.raf=requestAnimationFrame(tick);else{this.running=false;this.onProgress?.(1,'人物动作播放完成');}
 }catch(error){this.pause();this.onError?.(error);}};"""
assert old in s;s=s.replace(old,new);(r/'cloth-controller.mjs').write_text(s)
s=(r/'lighting.mjs').read_text().replace('const tick=now=>{if(!this.running)','const tick=async now=>{if(!this.running)')
s=s.replace('this.position();this.viewer.render();draw=now;}','this.position();await this.viewer.render();draw=now;}if(!this.running)return;');(r/'lighting.mjs').write_text(s)
s=(r/'visible-transport.mjs').read_text().replace("const focus=()=>stage.scrollIntoView({behavior:'instant',block:'center'});","const focus=()=>{const r=stage.getBoundingClientRect();if(r.bottom<80||r.top>innerHeight-80)stage.scrollIntoView({behavior:'instant',block:'center'});};");(r/'visible-transport.mjs').write_text(s)
s=(r/'motion-transport.mjs').read_text();assert '!!window.__MP04__?.audit().pending' in s
s=s.replace('!!window.__MP04__?.audit().pending',"!!document.getElementById('top-material')?.disabled").replace("version:'MP04.4'","version:'MP04.4.1'");(r/'motion-transport.mjs').write_text(s)
s=(r/'index.html').read_text().replace('MP04.4 ·','MP04.4.1 ·').replace('播放可能慢于钟表时间','画面提交按完成状态节流，不积压绘制；播放可能慢于钟表时间');(r/'index.html').write_text(s)
s=(r/'qa-case.cjs').read_text().replace("assert.equal(a.version,'MP04.4')","assert.equal(a.version,'MP04.4.1')")
s=s.replace("const shot=async name=>{await p.evaluate", "const shot=async name=>{await p.evaluate(()=>window.__MP04__.debug().viewer.frameGate.idle());await p.evaluate")
s=s.replace('orig(rows,f);};','return orig(rows,f);};')
s=s.replace("await p.locator('#motion-pause').click();", "{const started=Date.now();await p.locator('#motion-pause').click({timeout:20000});report.rows.push({case:'real-mouse-pause-latency',wallMS:Date.now()-started});}")
s=s.replace('assert.equal(report.errors.length,0);',"const gate=await p.evaluate(()=>window.__MP04__.debug().viewer.frameGate.audit());assert.equal(gate.maxInFlight,1);assert.equal(gate.failed,false);report.renderBackpressure=gate;assert.equal(report.errors.length,0);")
assert 'return orig(rows,f)' in s and 'maxInFlight,1' in s;(r/'qa-case.cjs').write_text(s)
s=(r/'_build/publish-snapshot.py').read_text().replace('MP04.4','MP04.4.1').replace('mp04.4','mp04.4.1').replace('mp04-r4-','mp04-r4-1-').replace("prefix='kaopu-tailor-workbench/material-products/r04-4'","prefix='kaopu-tailor-workbench/material-products/r04-4-1'");(r/'_build/publish-snapshot.py').write_text(s)
state={'version':'MP04.4.1','parentSource':'9668ad66633390d44609b8ac4c40db0a6e9285c0','newChanges':['remove 5Hz control polling through synchronous gl.getError','one in-flight GPU submission with zero-timeout sync polling','motion and orbit light wait for actual render completion','do not force-scroll an already-visible pause button'],'notChanged':['material geometry','shaders','shadow resolution 2048','native person','cloth solver','nine solved clips','12 thumbnails'],'fullUserTaskComplete':False,'remaining':['full R15 knit fuzz/distance integration','R12 independent damaged-yarn force integration','all material/garment combinations','real-device performance certification'],'priorRun':38362561568,'priorFailuresRetained':True,'userAccepted':False}
(r/'RENDER_RECOVERY_SCOPE.json').write_text(json.dumps(state,ensure_ascii=False,indent=2))
(r/'README.md').write_text((r/'README.md').read_text()+'\n\n## MP04.4.1 中断接续\n移除动作控制条每200ms触发的完整audit/GL错误读取；绘制改为最多一帧在GPU提交中，零超时查询完成状态。动作和单灯继续真实更新，画质、分辨率与求解内容不变。已显示的按钮不强制滚动。不能将此修复理解为用户显卡FPS认证。旧失败报告保留；当前PUBLIC_DELIVERY以这次新固定网页实测为准。\n')
print('Prepared MP04.4.1; source metrics and physical states unchanged')
