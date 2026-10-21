/** QA only. Optional real GPU queries; never relabel JS submission time as GPU time. */
export function installStageProfiler(renderer){
 const gl=renderer.gl,ext=gl.getExtension('EXT_disjoint_timer_query_webgl2'),original={useProgram:gl.useProgram,getUniformLocation:gl.getUniformLocation,uniform1i:gl.uniform1i,drawArrays:gl.drawArrays};
 const names=new Map([['source',renderer.sourceProgram],['assembly',renderer.assemblyProgram],['aperture',renderer.apertureProgram],['rail',renderer.railProgram],['shade',renderer.shadeProgram],['optical-ray',renderer.opticalRayProgram],['present',renderer.presentProgram],['empty',renderer.emptyProgram]].filter(x=>x[1]).map(([n,p])=>[p,n])),locations=new Map(),modes=new Map();let program=null,records=[],enabled=false;
 gl.useProgram=function(p){program=p;return original.useProgram.call(gl,p);};
 gl.getUniformLocation=function(p,n){const l=original.getUniformLocation.call(gl,p,n);if(l)locations.set(l,{p,n});return l;};
 gl.uniform1i=function(l,v){const d=locations.get(l);if(d?.n==='uRayMode')modes.set(d.p,v);return original.uniform1i.call(gl,l,v);};
 gl.drawArrays=function(...args){if(!enabled)return original.drawArrays.apply(gl,args);const stage=(modes.get(program)>0?'secondary:':'primary:')+(names.get(program)??'unknown'),q=ext?gl.createQuery():null;const start=performance.now();if(q)gl.beginQuery(ext.TIME_ELAPSED_EXT,q);try{return original.drawArrays.apply(gl,args);}finally{if(q)gl.endQuery(ext.TIME_ELAPSED_EXT);records.push({stage,query:q,submissionWallMs:performance.now()-start});}};
 return{
  begin(){if(enabled||records.length)throw Error('Profiler must resolve prior frame');enabled=true;},
  async end(){enabled=false;let disjoint=ext?!!gl.getParameter(ext.GPU_DISJOINT_EXT):false,complete=!ext;const deadline=performance.now()+5000;while(ext&&performance.now()<deadline){disjoint ||= !!gl.getParameter(ext.GPU_DISJOINT_EXT);complete=records.every(r=>!r.query||gl.getQueryParameter(r.query,gl.QUERY_RESULT_AVAILABLE));if(disjoint||complete)break;await new Promise(r=>setTimeout(r,10));}const stages={};for(const r of records){const s=stages[r.stage]??={draws:0,submissionWallMs:0,gpuMs:null};s.draws++;s.submissionWallMs+=r.submissionWallMs;if(ext&&!disjoint&&complete&&r.query){s.gpuMs??=0;s.gpuMs+=gl.getQueryParameter(r.query,gl.QUERY_RESULT)/1e6;}if(r.query)gl.deleteQuery(r.query);}const report={extensionAvailable:!!ext,disjoint,queryResultsComplete:complete,gpuTimeValid:!!ext&&!disjoint&&complete,stages,note:'Submission wall time is not GPU execution time; query frame is diagnostic, not uninstrumented throughput.'};records=[];return report;},
  restore(){if(enabled||records.length)throw Error('Resolve profiler before restore');for(const [n,f]of Object.entries(original))gl[n]=f;}
 };
}
