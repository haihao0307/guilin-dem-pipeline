// QA-only: one same-process fixed-camera guard A/B. Runtime source is not edited.
export async function runGuardAB(s){
 await s.pause();const r=s.renderer,g=r.gl,guarded=r.apertureProgram;
 const source=g.getAttachedShaders(guarded).map(x=>[g.getShaderParameter(x,g.SHADER_TYPE),g.getShaderSource(x)]).find(x=>x[0]===g.FRAGMENT_SHADER)[1];
 const line=' if(!apertureGlassRecoveryIsolated(own,point,error,skipObjectId))return false;';
 if(source.split(line).length!==2)throw Error('Isolation guard must occur exactly once');
 const tBuild=performance.now(),without=source.replace(line,' // QA unguarded control: retained old overlap counterexample, never published.');
 const sourceBuildMs=performance.now()-tBuild,tCompile=performance.now(),unguarded=r.compile('QA-only-no-isolation',without),compileLinkCallMs=performance.now()-tCompile;
 const ext=g.getExtension('EXT_disjoint_timer_query_webgl2'),rows=[];const camera=JSON.stringify(r.options);let draws=0,apertureDraws=0,active=null;
 const use=g.useProgram.bind(g),draw=g.drawArrays.bind(g);g.useProgram=p=>{active=p;use(p);};g.drawArrays=(...args)=>{draws++;if(active===r.apertureProgram)apertureDraws++;return draw(...args);};
 const hash=async a=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',a))].map(x=>x.toString(16).padStart(2,'0')).join('');
 try{
  for(const [variant,phase] of [['guarded','warmup'],['unguarded','first-execution'],['guarded','measure-1'],['unguarded','measure-1'],['unguarded','measure-2'],['guarded','measure-2']]){
   r.apertureProgram=variant==='guarded'?guarded:unguarded;draws=apertureDraws=0;const q=ext?g.createQuery():null;if(q)g.beginQuery(ext.TIME_ELAPSED_EXT,q);
   const stats=await r.render({width:640,height:544,presentWidth:640,presentHeight:544,tileSize:96,source:true,design:true,dynamicFields:[]});if(q)g.endQuery(ext.TIME_ELAPSED_EXT);
   let gpuMs=null;if(q){for(let i=0;i<200&&!g.getQueryParameter(q,g.QUERY_RESULT_AVAILABLE);i++)await new Promise(a=>setTimeout(a,5));if(g.getQueryParameter(q,g.QUERY_RESULT_AVAILABLE)&&!g.getParameter(ext.GPU_DISJOINT_EXT))gpuMs=g.getQueryParameter(q,g.QUERY_RESULT)/1e6;g.deleteQuery(q);}
   const rgba=new Uint8Array(640*544*4);g.bindFramebuffer(g.FRAMEBUFFER,null);g.readPixels(0,0,640,544,g.RGBA,g.UNSIGNED_BYTE,rgba);
   const raw=new Uint8Array(640*544*16);let offset=0,hits=0;for(const tile of r.hitTiles){g.bindFramebuffer(g.FRAMEBUFFER,tile.target.fbo);g.readBuffer(g.COLOR_ATTACHMENT0);const a=new Float32Array(tile.width*tile.height*4);g.readPixels(tile.x,tile.y,tile.width,tile.height,g.RGBA,g.FLOAT,a);raw.set(new Uint8Array(a.buffer),offset);offset+=a.byteLength;for(let i=3;i<a.length;i+=4)hits+=a[i]===1;}
   g.bindFramebuffer(g.FRAMEBUFFER,null);if(camera!==JSON.stringify(r.options))throw Error('A/B camera or settings changed');if(stats.cancelled||g.getError())throw Error('A/B invalid GPU frame');
   rows.push({variant,phase,wallMs:stats.wallMs,gpuMs,gpuTimerValid:gpuMs!==null,draws,apertureDraws,rgbaSHA:await hash(rgba),rawHitSHA:await hash(raw),hitPixels:hits,stats});console.log('GUARD_AB',variant,phase,stats.wallMs,gpuMs);
  }
 }finally{r.apertureProgram=guarded;g.useProgram=use;g.drawArrays=draw;}
 const hashes=rows.map(x=>x.rgbaSHA+' '+x.rawHitSHA);if(new Set(hashes).size!==1)throw Error('Guard A/B changed representative view raw hits or RGBA');
 return {sourceBuildMs,compileLinkCallMs,guardedSourceCharacters:source.length,unguardedSourceCharacters:without.length,sourceChange:'Only remove invocation of apertureGlassRecoveryIsolated; unused helper remains for compiler DCE. This control has known overlap bug and is QA only.',guardScope:'On each failed old self-endpoint verification, convex-glass recovery checks every other active descriptor with its actual field. This may execute per ray candidate and applies primary/secondary through same aperture program; no all-pixel count inferred.',camera:JSON.parse(camera),gpu:r.gpu,rows,exactRepresentativeFrame:true,physicalPhoneTested:false};
}
