// Diagnostic only. The frozen renderer/shaders are not changed. No skipped draw.
export function attachPassProfiler(renderer){
 const g=renderer.gl,ext=g.getExtension('EXT_disjoint_timer_query_webgl2'),original={},uniforms=new WeakMap(),values=new Map();
 let active=null,program=null;
 for(const name of ['useProgram','getUniformLocation','uniform1i','drawArrays'])original[name]=g[name].bind(g);
 const label=()=>{const name=renderer.compileStats[renderer.programs.indexOf(program)]?.name??'unknown';return name+((values.get(program)?.uRayMode??0)?':secondary':':primary');};
 g.useProgram=p=>{program=p;return original.useProgram(p);};
 g.getUniformLocation=(p,name)=>{const loc=original.getUniformLocation(p,name);if(loc)uniforms.set(loc,{p,name});return loc;};
 g.uniform1i=(loc,value)=>{const q=loc&&uniforms.get(loc);if(q){if(!values.has(q.p))values.set(q.p,{});values.get(q.p)[q.name]=value;}return original.uniform1i(loc,value);};
 g.drawArrays=(...args)=>{
  if(!active)return original.drawArrays(...args);
  const event={label:label(),draw:active.events.length,wallMs:0},t=performance.now();
  if(active.mode==='gpu-query'){event.query=g.createQuery();g.beginQuery(ext.TIME_ELAPSED_EXT,event.query);original.drawArrays(...args);g.endQuery(ext.TIME_ELAPSED_EXT);}
  else{original.drawArrays(...args);g.finish();}
  event.wallMs=performance.now()-t;active.events.push(event);
 };
 return{
  supportedGpuTimer:Boolean(ext),
  begin(mode='gpu-query'){if(active)throw Error('Profiling already active');if(mode==='gpu-query'&&!ext)throw Error('GPU timer unavailable');active={mode,start:performance.now(),events:[]};},
  async end(){if(!active)throw Error('No profile');const a=active;active=null;const expired=performance.now()+10000;
   if(a.mode==='gpu-query')while(a.events.some(e=>!g.getQueryParameter(e.query,g.QUERY_RESULT_AVAILABLE))){if(performance.now()>expired)throw Error('GPU timer result unavailable after bounded wait');await new Promise(r=>setTimeout(r,8));}
   const disjoint=a.mode==='gpu-query'?Boolean(g.getParameter(ext.GPU_DISJOINT_EXT)):null,groups={};
   for(const e of a.events){if(a.mode==='gpu-query'){e.gpuMs=disjoint?null:g.getQueryParameter(e.query,g.QUERY_RESULT)/1e6;g.deleteQuery(e.query);delete e.query;}const v=groups[e.label]??={draws:0,submitOrFinishWallMs:0,gpuMs:disjoint?null:0};v.draws++;v.submitOrFinishWallMs+=e.wallMs;if(a.mode==='gpu-query'&&!disjoint)v.gpuMs+=e.gpuMs;else if(a.mode!=='gpu-query')v.gpuMs=null;}
   return{mode:a.mode,disjoint,wallMs:performance.now()-a.start,groups,events:a.events,meaning:a.mode==='gpu-query'?'available non-disjoint timer-query result; software GPU is not phone hardware':'serial draw+finish wall duration; perturbs queue scheduling, not labeled GPU time'};
  },
  detach(){if(active)throw Error('Cannot detach active profile');for(const n in original)g[n]=original[n];}
 };
}
