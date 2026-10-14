/* A shader-build callback can precede the deferred native first draw. Check the
 * actual linked program after native startup; never infer rendering from a hook. */
(()=>{'use strict';let wired=false,priorReport,health={verified:false,linked:false};const started=performance.now();
 const timer=setInterval(()=>{const status=window.__HEAD_PROC__,api=window.headProceduralSkin,v=window.__IDENTITY_QA__?.viewer?.();if(!status)return;
 if(status.errors.length){clearInterval(timer);return;}
 if(performance.now()-started>300000){status.errors.push('头部材质未取得实际GPU链接回执');clearInterval(timer);return;}
 if(!api||!v?.renderer||!v.startupFinalFrame)return;
 if(!wired){priorReport=api.report;api.report=()=>{const r=priorReport();r.shaderBuildCallbacks=r.fragmentShaderCompiles;delete r.fragmentShaderCompiles;return{...r,ready:health.verified,gpu:{...health}};};wired=true;}
 try{const gl=v.renderer.getContext(),props=v.renderer.properties.get(api.material()),p=props.currentProgram||(props.programs&&[...props.programs.values()].at(-1));if(!p?.program)return;
  const linked=gl.getProgramParameter(p.program,gl.LINK_STATUS);health={verified:!!linked,linked:!!linked,programId:p.id,fragmentUnitLimit:gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),nativeFinalFrame:!!v.startupFinalFrame,elapsedMS:performance.now()-started};
  status.ready=!!linked;status.gpuVerified=!!linked;status.gpu={...health};status.report=api.report();
  if(!linked)status.errors.push('头部GPU链接失败：'+gl.getProgramInfoLog(p.program));
  clearInterval(timer);
 }catch(e){status.errors.push(String(e));clearInterval(timer);}
 },100);addEventListener('pagehide',()=>clearInterval(timer),{once:true});})();
