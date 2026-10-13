from pathlib import Path
p=Path(__file__).with_name('qa-release.cjs');s=p.read_text()
old="const shot=async name=>{const clip=await p.locator('#stage').boundingBox();await p.screenshot({path:path.join(out,name+'.png'),clip,timeout:240000});"
new="const shot=async name=>{await p.locator('#stage').scrollIntoViewIfNeeded();await p.locator('#stage').screenshot({path:path.join(out,name+'.png'),timeout:240000});"
assert s.count(old)==1,'Frozen capture helper changed';s=s.replace(old,new)
s=s.replace("realPublicNetwork:true", "realPublicNetwork:true,captureScrollCorrected:true,previousCaptureFailureRun:38352922606")
old="   await p.locator('[data-motion=\"'+motion+'\"]').click();"
new="""   await p.evaluate(()=>{window.__liveFrames=[];window.__observePlayback=true;const d=window.__MP04__.debug(),base=Array.from(d.model.positions);const observe=()=>{if(!window.__observePlayback)return;const f=d.physics.frame?.audit;if(f?.cachedPhysicalReplay&&window.__liveFrames.at(-1)?.frame!==f.frameSequence){let change=0;for(let i=0;i<base.length;i++)change=Math.max(change,Math.abs(d.model.positions[i]-base[i]));window.__liveFrames.push({frame:f.frameSequence,time:f.motionTime,maximumBodyChangeM:change,sameBodyAndClothFrame:f.bodyFrameMatchesCloth});}requestAnimationFrame(observe);};requestAnimationFrame(observe);});
   await p.locator('[data-motion="'+motion+'"]').click();"""
assert s.count(old)==1;s=s.replace(old,new)
old="   await p.locator('#motion-pause').click();await p.evaluate(i=>window.__MP04__.seekMotionFrame(i),frame);"
new="""   await p.waitForFunction(()=>window.__liveFrames.length>=2,{},{timeout:60000});
   await p.locator('#motion-pause').click();
   const naturalFrames=await p.evaluate(()=>{window.__observePlayback=false;return window.__liveFrames;});
   assert(naturalFrames.length>=2&&naturalFrames.at(-1).frame>naturalFrames[0].frame);assert(naturalFrames.every(f=>f.sameBodyAndClothFrame));
   const stopped=await p.evaluate(()=>window.__MP04__.debug().physics.frame.audit.frameSequence);await p.waitForTimeout(250);assert.equal(await p.evaluate(()=>window.__MP04__.debug().physics.frame.audit.frameSequence),stopped);
   report.rows.push({case:id+'-'+motion+'-natural-playback',naturalFrames,pauseStable:true,realDeviceFPSClaimed:false});save();
   await p.evaluate(i=>window.__MP04__.seekMotionFrame(i),frame);"""
assert s.count(old)==1;s=s.replace(old,new)
s=s.replace("await p.setViewportSize({width:390,height:844});", "await p.evaluate(()=>window.scrollTo(0,0));await p.setViewportSize({width:390,height:844});")
p.write_text(s)
print('Capture scroll coordinates corrected; all original assertions retained, natural playback observation added. No runtime modified.')
