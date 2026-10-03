/* Diagnostic only: fixed legal geometry, light and exposure; isolate shadow blockers.
 * Never use blocker-removal frames as production or appearance acceptance. */
module.exports=async function(page,{sample,check,output,fs,path}){
 await page.evaluate(()=>{anemone.pause();anemone.setOptics({palette:'wootton-olive-ivory',frontReturn:.65,frontReturnView:'beauty',transmission:1,debug:'beauty',lighting:'front'});});
 const full=await sample(page,'legal-180-01-overview-full');await page.locator('#anemoneMacroCamera').click();const macro=await sample(page,'legal-180-02-macro-full');
 check('legal180 macro retains certified geometry',macro.geometry===full.geometry&&macro.metrics.tentacles===180&&macro.metrics.camera.target?.length===3);
 await page.evaluate(()=>anemone.setOptics({frontReturn:0,transmission:0}));await sample(page,'legal-180-03-macro-mechanisms-off');
 await page.evaluate(()=>anemone.setOptics({frontReturn:.65,transmission:1,lighting:'beauty'}));await sample(page,'legal-180-04-high-side-back-full');
 await page.evaluate(()=>anemone.setOptics({frontReturnView:'return-only'}));await sample(page,'legal-180-05-front-return-contribution');
 await page.evaluate(()=>anemone.setOptics({frontReturnView:'beauty',debug:'transmission'}));await sample(page,'legal-180-06-transmitted-contribution');
 const guard=await page.evaluate(()=>{const r=anemone.renderer,g=r.gl,O=AnemoneOptics,oldPrograms=[r.program,r.bodyProgram],oldDraw=g.drawElements.bind(g),oldInstanced=g.drawElementsInstanced.bind(g),oldLocation=g.getUniformLocation.bind(g),oldUniform=g.uniform3fv.bind(g),locations=new WeakSet();let mode='all',light=null;
 const fragment=O.fragment.replace('color=vec4(shadow,entryVisibility,0.,1.)','color=vec4(shadow,entryVisibility,(tentacle&&nl<0.)?1.:0.,1.)');if(fragment===O.fragment)throw Error('Visibility source contract missing');
 function program(v){const p=g.createProgram();for(const [type,source]of [[g.VERTEX_SHADER,v],[g.FRAGMENT_SHADER,fragment]]){const sh=g.createShader(type);g.shaderSource(sh,source);g.compileShader(sh);if(!g.getShaderParameter(sh,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(sh));g.attachShader(p,sh);g.deleteShader(sh)}g.linkProgram(p);if(!g.getProgramParameter(p,g.LINK_STATUS))throw Error(g.getProgramInfoLog(p));return p;}
 r.program=program(r.contactVertexSource);r.bodyProgram=program(O.bodyVertex);
 g.getUniformLocation=(p,n)=>{const l=oldLocation(p,n);if(l&&n==='uLightDirection')locations.add(l);return l};g.uniform3fv=(l,v)=>{if(l&&locations.has(l))light=Array.from(v);return oldUniform(l,v)};
 g.drawElements=(...a)=>{if(g.getParameter(g.FRAMEBUFFER_BINDING)===r.shadowFBO&&(mode==='tubes-only'||mode==='none'))return;return oldDraw(...a)};
 g.drawElementsInstanced=(...a)=>{if(g.getParameter(g.FRAMEBUFFER_BINDING)===r.shadowFBO&&(mode==='body-only'||mode==='none'))return;return oldInstanced(...a)};
 window.__legalShadowProbe={set:m=>{if(!['all','body-only','tubes-only','none'].includes(m))throw Error('Bad probe');mode=m;},read:()=>{r.draw();const p=new Uint8Array(r.canvas.width*r.canvas.height*4);g.readPixels(0,0,r.canvas.width,r.canvas.height,g.RGBA,g.UNSIGNED_BYTE,p);let eligible=0,visible=0,sum=0,zero=0;for(let i=0;i<p.length;i+=4)if(p[i+2]>=250){eligible++;sum+=p[i+1]/255;if(p[i+1]>2)visible++;else zero++;}return {mode,light,eligible,entryVisible:visible,entryBlocked:zero,meanEntryVisibility:eligible?sum/eligible:null,glError:g.getError()};},restore:()=>{mode='all';g.drawElements=oldDraw;g.drawElementsInstanced=oldInstanced;g.getUniformLocation=oldLocation;g.uniform3fv=oldUniform;g.deleteProgram(r.program);g.deleteProgram(r.bodyProgram);[r.program,r.bodyProgram]=oldPrograms;delete window.__legalShadowProbe;}};
 return {scope:'Blue=backlit tentacle eligibility; green=source-exit visibility. Body-only/tubes-only/none are causal blocker-removal probes, not a deliverable material.'};});
 const results={...guard,frames:[]};
 for(const lighting of ['front','back','beauty']){
  await page.evaluate(lighting=>anemone.setOptics({lighting,debug:'visibility',frontReturnView:'beauty',frontReturn:.65,transmission:1}),lighting);
  for(const mode of ['all','body-only','tubes-only','none']){
   await page.evaluate(mode=>{__legalShadowProbe.set(mode);document.querySelector('.anemone-caption').textContent='诊断 R表面 / G入光 / B背照；阴影集合：'+mode;},mode);
   const frame=await page.evaluate(()=>__legalShadowProbe.read());frame.lighting=lighting;results.frames.push(frame);check('source-exit probe GL0 '+lighting+' '+mode,frame.glError===0,frame);
   const p=await sample(page,'legal-probe-'+lighting+'-'+mode);check('blocker probe leaves exact legal geometry '+lighting+' '+mode,p.geometry===macro.geometry);
  }
 }
 await page.evaluate(()=>{__legalShadowProbe.restore();anemone.setOptics({lighting:'front',debug:'beauty',frontReturnView:'beauty',frontReturn:.65,transmission:1});document.querySelector('.anemone-caption').textContent='180根实验 · 合法冻结groom · 全组织材质';});
 const restored=await sample(page,'legal-180-07-probe-restored');check('causal probes restore actual full material exact',restored.hash===macro.hash&&restored.geometry===macro.geometry);
 fs.writeFileSync(path.join(output,'legal-tissue-source-visibility.json'),JSON.stringify(results,null,2));
 return results;
};
