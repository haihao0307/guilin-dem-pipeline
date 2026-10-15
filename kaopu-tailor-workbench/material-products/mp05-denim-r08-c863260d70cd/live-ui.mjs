// Diagnostics only. The application owns playback, error and preview status.
const details=document.createElement('details');
details.id='live-diagnostics';
details.innerHTML='<summary>开发诊断 · 时钟与资源</summary><pre></pre>';
document.querySelector('.physics-box').appendChild(details);
const timer=setInterval(()=>{
 if(!details.open)return;
 const p=window.__MP05__?.debug().physics;if(!p?.frame)return;
 const a=p.audit(),r=p.frame.audit;
 details.querySelector('pre').textContent=JSON.stringify({physicsSource:a.physicsSource,testing:a.testing,testProgress:a.testProgress,wallSeconds:a.wallTimeSeconds,simulationSeconds:a.simulationTimeSeconds,lagMS:a.simLagMs,solverMS:r.solverMs,mainUpdateMS:a.mainUpdateMS,pipeline:r.pipeline,bytes:r.transferredBytes,lastError:a.lastError,pendingCommands:a.pendingCommands,demand:__MP05__.audit().continuousDemand},null,2);
},500);
addEventListener('pagehide',()=>clearInterval(timer),{once:true});
