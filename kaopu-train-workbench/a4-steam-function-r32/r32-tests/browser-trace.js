/* Test-only transparent GL call instrumentation. No renderer, sandbox or geometry changes. */
(()=>{
 const T=window.__A4_TRACE={drawCalls:0,phase:'page-start',source:null,partId:null};
 const emit=()=>{window.reportA4Trace({...T,ms:performance.now()}).catch(()=>{});};
 const prototype=WebGL2RenderingContext.prototype,names=new WeakMap(),shaderBytes=new WeakMap();
 const wrap=(name,fn)=>{const old=prototype[name];prototype[name]=function(...args){return fn.call(this,old,args);};};
 wrap('shaderSource',function(old,a){shaderBytes.set(a[0],a[1].length);return old.apply(this,a);});
 wrap('compileShader',function(old,a){T.phase='compile-begin';T.shaderBytes=shaderBytes.get(a[0]);emit();const r=old.apply(this,a);T.phase='compile-returned';emit();return r;});
 wrap('linkProgram',function(old,a){T.phase='link-begin';emit();const r=old.apply(this,a);T.phase='link-returned';emit();return r;});
 wrap('getUniformLocation',function(old,a){const l=old.apply(this,a);if(l)names.set(l,a[1]);return l;});
 wrap('useProgram',function(old,a){if(typeof programs!=='undefined'){const entry=Object.entries(programs).find(([,v])=>v.p===a[0]);T.source=entry?.[0]||'unknown';}T.phase='source-use';T.partId=null;emit();return old.apply(this,a);});
 wrap('uniform1i',function(old,a){if(a[0]&&names.get(a[0])==='id'&&typeof programs!=='undefined'){T.partIndex=a[1];T.partId=programs[T.source]?.ps[a[1]]?.id||null;}return old.apply(this,a);});
 wrap('uniform1f',function(old,a){if(a[0]&&names.get(a[0])==='lip')T.fieldType=a[1]>0?'bounded-distance':'interval-subdivision';return old.apply(this,a);});
 wrap('scissor',function(old,a){T.scissor=a.slice();return old.apply(this,a);});
 wrap('drawArrays',function(old,a){T.drawCalls++;T.phase='draw-call';if(T.drawCalls%25===1)emit();const r=old.apply(this,a);T.phase='draw-returned';return r;});
 wrap('finish',function(old,a){T.phase='finish-begin';emit();const r=old.apply(this,a);T.phase='finish-returned';emit();return r;});
 const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(...args){const g=get.apply(this,args);if(g&&args[0]==='webgl2'){const ext=g.getExtension('WEBGL_debug_renderer_info');T.backend={vendor:g.getParameter(ext?ext.UNMASKED_VENDOR_WEBGL:g.VENDOR),renderer:g.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:g.RENDERER),version:g.getParameter(g.VERSION)};T.phase='context-created';emit();}return g;};
 document.addEventListener('webglcontextlost',()=>{T.phase='contextlost';emit();},true);
})();
