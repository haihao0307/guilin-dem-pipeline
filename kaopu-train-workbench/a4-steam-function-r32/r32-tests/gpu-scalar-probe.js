/* Real generated R32 scalar tests using ordinary RGBA8 default framebuffer.
 * Test-only, not geometry or an isolated model viewer. No float render targets. */
async function runR32ScalarProbe(){
 const U=DYNAMIC.upstreamCandidate,canvas=document.createElement('canvas');canvas.width=1;canvas.height=1;
 const g=canvas.getContext('webgl2',{antialias:false,depth:false,stencil:false,preserveDrawingBuffer:true});
 if(!g)return{status:'BLOCKED',reason:'WebGL2 test context unavailable'};
 const targets=U.parts,compile=(type,source)=>{const s=g.createShader(type);g.shaderSource(s,source);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(s));return s;};
 const vs='#version 300 es\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0.,1.);}';
 const fs=`#version 300 es\nprecision highp float;precision highp int;out vec4 result;uniform vec3 samplePoint;uniform int sampleId;uniform float expected;\n${DYNAMIC.glsl}\n${U.source}\nfloat value(){${targets.map((p,i)=>`if(sampleId==${i})return ${DYNAMIC.scalar(p).replace(/\bp\b/g,'samplePoint')};`).join('\n')}return 1e20;}\nvoid main(){float f=value();result=vec4((f<0.)==(expected<0.)?1.:0.,abs(f-expected)<.0001?1.:0.,1.,1.);}`;
 const program=g.createProgram();g.attachShader(program,compile(g.VERTEX_SHADER,vs));g.attachShader(program,compile(g.FRAGMENT_SHADER,fs));g.linkProgram(program);if(!g.getProgramParameter(program,g.LINK_STATUS))throw Error(g.getProgramInfoLog(program));g.useProgram(program);g.bindVertexArray(g.createVertexArray());g.viewport(0,0,1,1);g.disable(g.DITHER);g.disable(g.BLEND);
 const loc=n=>g.getUniformLocation(program,n),pixel=new Uint8Array(4),failures=[];let samples=0;
 const probes=[];
 // Every control-to-control straight core, plus every circular fillet midpoint.
 for(const r of U.routes){const pts=r.points,fs=pts.slice(1,-1).map((p,i)=>STEAM_PATH.fillet(pts[i],p,pts[i+2],r.bend));const stations=[];
  for(let i=0;i<pts.length-1;i++){const a=i?fs[i-1].end:pts[0],b=i===pts.length-2?pts.at(-1):fs[i].start;stations.push({p:a.map((v,k)=>(v+b[k])/2),t:b.map((v,k)=>v-a[k])});}
  for(const f of fs){const a=f.angle/2;stations.push({p:f.center.map((v,k)=>v+f.r*(f.e[k]*Math.cos(a)+f.f[k]*Math.sin(a))),t:f.e.map((v,k)=>-v*Math.sin(a)+f.f[k]*Math.cos(a))});}
  for(const q of stations){const t=q.t.map(v=>v/Math.hypot(...q.t)),axis=Math.abs(t[0])<.8?[1,0,0]:[0,1,0],cross=[t[1]*axis[2]-t[2]*axis[1],t[2]*axis[0]-t[0]*axis[2],t[0]*axis[1]-t[1]*axis[0]],n=cross.map(v=>v/Math.hypot(...cross));for(const radius of [0,(r.innerRadius+r.outerRadius)/2,r.outerRadius+.003])probes.push({id:r.partId,p:q.p.map((v,k)=>v+n[k]*radius),open:1});}
 }
 for(const open of [0,1])probes.push({id:'upstream_steam/regulator_valve_disc',p:[0,3.3,-1.712],open});
 for(const q of probes){const state=DYNAMIC.snapshot({mode:'candidate',steamRevision:'r32',regulatorOpen:q.open}),expected=U.worldScalar(q.id,q.p,.4,state);g.uniform3fv(loc('samplePoint'),q.p);g.uniform1i(loc('sampleId'),targets.findIndex(p=>p.id===q.id));g.uniform1f(loc('expected'),expected);g.uniform1f(loc('regulatorOpen'),q.open);g.uniform1i(loc('upstreamCandidate'),1);g.uniform1i(loc('installationCandidate'),1);g.uniform1f(loc('middleInclination'),.126);g.uniform1f(loc('timeTheta'),.4);g.drawArrays(g.TRIANGLES,0,3);g.readPixels(0,0,1,1,g.RGBA,g.UNSIGNED_BYTE,pixel);if(pixel[0]!==255||pixel[1]!==255||pixel[2]!==255||g.getError())failures.push({...q,expected,pixel:Array.from(pixel)});samples++;}
 g.getExtension('WEBGL_lose_context')?.loseContext();return{status:failures.length?'FAIL':'PASS',samples,failures,tolerance_m:.0001,framebuffer:'ordinary RGBA8; pass/sign bytes only',GPUExecuted:true};
}
