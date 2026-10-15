/** Native face diffusion renders clothing into an offscreen half-float beauty
 * target. Canvas antialias does not cover that target. Resolve four coverage
 * samples there, retaining the original geometry and native face pipeline.
 */
export function installCoverageAntialias(viewer){
 const renderer=viewer.renderer,gl=renderer.getContext(),target=viewer.faceDiffusion?.targets?.[0];
 if(!target)return null;
 const supported=Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,gl.RGBA16F,gl.SAMPLES)||[]);
 const depthSupported=Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,gl.SAMPLES)||[]);
 const samples=Math.max(0,...supported.filter(n=>n<=4&&depthSupported.includes(n)));
 const apply=n=>{if(target.samples===n)return;target.dispose();target.samples=n;target.resolveDepthBuffer=true;};
 apply(samples);
 viewer.coverageAntialias={setEnabled:on=>{apply(on?samples:0);viewer.render();},audit:()=>({method:'multisample coverage on the native offscreen beauty target',samples:target.samples,supported,depthSupported,geometryRemoved:false,temporalHistory:false})};
 return viewer.coverageAntialias;
}
