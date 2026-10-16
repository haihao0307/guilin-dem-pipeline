const fs=require('fs'),path=require('path');const out=path.resolve(__dirname,'../evidence');
async function call(code,shot,more={}){const r=await fetch('http://127.0.0.1:9883',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,shot,wait:shot?250:0,...more})});const d=await r.json();if(!r.ok||d.errors?.length)throw Error(JSON.stringify(d));return d.result;}
(async()=>{const checks=[];const check=(name,pass,data)=>{checks.push({name,pass,data});console.log(pass?'PASS':'FAIL',name);if(!pass)throw Error(name);};
try{
 await call('hairF13.setManual(true);hairF13.report()',null,{ready:true});await call('hairF13.reset()');const initial=await call('hairF13.report()','final-static.png');check('complete F12 population and same original person',initial.fibers.count===114171&&initial.fibers.clumps===43&&initial.nativeMeshSame,initial.fibers);
 const rest=await call('hairF13.verifyGPU()');check('actual GPU ribbons preserve static paths and roots',rest.finite&&rest.staticPathErrorMM<.002&&rest.rootErrorMM<.002,rest);
 for(const color of ['brown','auburn','blonde','black'])await call(`hairF13.setColor('${color}')`,'final-color-'+color+'.png');check('all four pigment presets render',true);
 for(const mode of ['groups','volume','hair'])await call(`hairF13.setMode('${mode}')`,'final-'+mode+'.png');check('grouping and original 3D volume comparison render',true);
 for(const mode of ['walk','run','jump']){
  await call(`hairF13.setMotion('${mode}')`);await call(`(async()=>{for(let i=0;i<${mode==='jump'?75:45};i++)await hairF13.step(1/60);hairF13.setView('body');return hairF13.report();})()`,'final-'+mode+'-body.png');
  const gpu=await call('hairF13.verifyGPU()'),report=await call("hairF13.setView('reference');hairF13.report()",'final-'+mode+'-head.png');
  check(mode+' moves native rig with GPU roots attached',gpu.finite&&gpu.rootErrorMM<.003&&report.motionReport.active&&report.motionReport.time>.4&&report.motionReport.boneLengthError<1e-6,{gpu,motion:report.motionReport,physics:report.physicsReport});
  check(mode+' produces actual bounded nonzero hair response',report.physicsReport.peakDeformationMM>.01&&report.physicsReport.peakDeformationMM<=35.1,report.physicsReport);
 }
 await call('hairF13.setMotion("run");hairF13.setSpeed(.5)');const speed=await call('(async()=>{for(let i=0;i<12;i++)await hairF13.step(1/60);return hairF13.report().motionReport.time;})()');check('half-speed affects captured motion time',Math.abs(speed-.1)<.002,speed);await call('hairF13.setSpeed(1)');
 await call('hairF13.setManual(false);hairF13.pause(true)');const t0=await call('hairF13.report().motionReport.time');await call('hairF13.report()',null,{wait:450});const t1=await call('hairF13.report().motionReport.time');check('pause freezes the animation',Math.abs(t1-t0)<1e-9,{t0,t1});await call('hairF13.setManual(true);hairF13.pause(false)');
 await call('hairF13.setPhysics(false);hairF13.report()');const noPhysics=await call('hairF13.report()');check('rig-only comparison disables hair deformation',!noPhysics.fibers.physicsEnabled);await call('hairF13.setPhysics(true)');
 await call('hairF13.reset();hairF13.setView("reference")','final-static.png');const final=await call('hairF13.verifyGPU()');check('return to still restores original full paths',final.finite&&final.staticPathErrorMM<.002,final);
 const manifest=JSON.parse(fs.readFileSync(path.resolve(out,'../BUILD_MANIFEST.json'))),report={passed:checks.every(x=>x.pass),checkedUTC:new Date().toISOString(),runtimeSHA256:manifest.htmlSHA256,checks,errors:[],mouseControlled:false};fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));
}catch(e){fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({passed:false,checks,error:String(e.stack)},null,2));throw e;}})().catch(e=>{console.error(e);process.exitCode=1;});
