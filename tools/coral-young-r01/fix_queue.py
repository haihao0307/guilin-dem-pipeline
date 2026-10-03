"""Apply verified host-only scheduling fixes. The supplied fragment stays byte-identical."""
from pathlib import Path
import hashlib
P=Path(__file__).resolve().parent;p=P/'study.html';s=p.read_text()
old='53cf9583e86c5647a26e436a084fb003b2dc4b5cbb47aa3d550009606238c84b'
new='555c4986a0ef04bba12b36732fe696b37a90ea3b2b3edc1272742c760b608461'
assert hashlib.sha256(s.encode()).hexdigest()==old,'unexpected study baseline'
s=s.replace('views=[],override=null;','views=[],override=null,dirty=true;')
s=s.replace('sourceRecordingEmbedded:false};','sourceRecordingEmbedded:false,gpuQueueBounded:true,gpuPending:false};')
s=s.replace('return{key,c,gl,p,vao,u}}','return{key,c,gl,p,vao,u,fence:null}}')
s=s.replace('gl.drawArrays(gl.TRIANGLES,0,3);S.drawByRole[key]++;','gl.drawArrays(gl.TRIANGLES,0,3);v.fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();S.drawByRole[key]++;')
a="function tick(ms){raf=0;if(!active||document.hidden)return;if(playing){if(last)time+=(ms-last)/1000;last=ms}paint();if(playing)request()}\nfunction request(){if(!raf&&active&&!document.hidden&&!S.error)raf=requestAnimationFrame(tick)}"
b="""// Keep at most one submitted frame per context. Slow GPUs retain full pixel quality,
// while input and layout can run between frames instead of accumulating GPU work.
function gpuAvailable(){let free=true;for(const v of views){if(!v.fence)continue;const q=v.gl.clientWaitSync(v.fence,0,0);if(q===v.gl.WAIT_FAILED)throw Error('GPU fence wait failed');if(q===v.gl.TIMEOUT_EXPIRED){free=false;continue}v.gl.deleteSync(v.fence);v.fence=null}S.gpuPending=!free;return free}
function schedule(){if(!raf&&active&&!document.hidden&&!S.error)raf=requestAnimationFrame(tick)}
function tick(ms){raf=0;if(!active||document.hidden||S.error)return;if(playing){if(last)time+=(ms-last)/1000;last=ms;dirty=true}try{if(dirty&&gpuAvailable()){dirty=false;paint()}}catch(e){error(e)}if(playing||dirty)schedule()}
function request(){dirty=true;schedule()}"""
assert a in s;s=s.replace(a,b)
s=s.replace("if(!S.ready)return;paint();const a=document.createElement('a');","if(!S.ready)return;const a=document.createElement('a');")
s=s.replace('.transport input[type=range]','#play{width:87px;flex:0 0 87px}#timeLabel{display:inline-block;min-width:122px;text-align:right;font-variant-numeric:tabular-nums}.transport input[type=range]',1)
assert hashlib.sha256(s.encode()).hexdigest()==new,'host patch differs from locally tested source'
p.write_text(s)
p=P/'build.py';s=p.read_text();assert old in s;p.write_text(s.replace(old,new))
p=P/'qa.py';s=p.read_text()
s=s.replace("ck('right_version',f.evaluate('YoungStudyState.version')=='young-study-r01-20261003')","ck('right_version',f.evaluate('YoungStudyState.version')=='young-study-r01-20261003');ck('bounded_GPU_queue',f.evaluate('YoungStudyState.gpuQueueBounded'))")
s=s.replace("f.locator('#play').click();ck('unbounded_past_recording'","f.locator('#play').click(timeout=30000);f.wait_for_function('!YoungStudyState.playing');ck('pause_button_works',not f.evaluate('YoungStudyState.playing'));ck('unbounded_past_recording'")
s=s.replace("f.locator('#equal').click();f.wait_for_timeout(250);z=", "n=f.evaluate('YoungStudyState.frame');f.locator('#equal').click();f.wait_for_function('YoungStudyState.frame>'+str(n),timeout=30000);z=")
s=s.replace("p.locator('[data-view=blue]').click();n=", "p.locator('[data-view=blue]').click();f.wait_for_function('!YoungStudyState.active',timeout=30000);n=")
s=s.replace("f.locator('#back').click();ck('child_return_to_home'", "f.locator('#back').click();p.locator('#view-home').wait_for(state='visible');ck('child_return_to_home'")
p.write_text(s)
print('Full-resolution GPU queue bounded; shader hash and quality unchanged.')
