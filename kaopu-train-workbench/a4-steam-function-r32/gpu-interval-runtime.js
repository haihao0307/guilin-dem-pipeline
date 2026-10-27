/* Native analytic interval scheduling. No mesh, CPU field evaluation, or GPU recovery.
 * A: active path bits / terminal hit float bits. B: depth6/status2/visited13.
 * Each ray keeps its original 4096-node budget and .0005 leaf threshold.
 * Caller owns whole-frame QA, run identity, uniforms, and retained fallback.
 */
(function(root){'use strict';
function invariant(ok,message){if(!ok)throw Error('A4 interval: '+message);}
function span(source,marker){const start=source.indexOf(marker);invariant(start>=0,'missing '+marker);const begin=start+marker.length;let end=begin,depth=1;for(;depth&&end<source.length;end++){if(source[end]==='{')depth++;if(source[end]==='}')depth--;}invariant(depth===0,'unclosed '+marker);return{start,begin,end,body:source.slice(begin,end-1)};}
function prune(source){
 const commentsMasked=source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,m=>m.replace(/[^\n]/g,' '));
 for(const line of commentsMasked.split('\n'))if(/^\s*#\s*define\b/.test(line)&&!/^\s*#\s*define\s+[A-Za-z_]\w*\s*$/.test(line))throw Error('Unsupported replacement macro');
 if(/^\s*#.*\\\s*$/m.test(commentsMasked))throw Error('Unsupported preprocessor continuation');
 const masked=commentsMasked.replace(/^\s*#[^\n]*/gm,m=>m.replace(/[^\n]/g,' ')),types=new Set(['void','float','int','uint','bool','vec2','vec3','vec4','ivec2','ivec3','ivec4','uvec2','uvec3','uvec4','bvec2','bvec3','bvec4','mat2','mat3','mat4',...[...masked.matchAll(/\bstruct\s+(\w+)\s*\{/g)].map(m=>m[1])]),defs=[];
 const re=/\b(\w+)\s+(\w+)\s*\(([^(){};]*)\)\s*\{/g;let m;
 while((m=re.exec(masked))){if(!types.has(m[1]))continue;const start=m.index;let end=re.lastIndex,depth=1;for(;depth&&end<masked.length;end++){if(masked[end]==='{')depth++;if(masked[end]==='}')depth--;}invariant(!depth,'unclosed function '+m[2]);defs.push({name:m[2],start,end,text:source.slice(start,end),masked:masked.slice(start,end)});re.lastIndex=end;}
 invariant(defs.some(d=>d.name==='main'),'missing main');
 const names=new Set(defs.map(d=>d.name)),calls=s=>[...new Set([...s.matchAll(/\b(\w+)\s*\(/g)].map(m=>m[1]).filter(n=>names.has(n)))];
 let globals='',at=0;for(const d of defs){globals+=masked.slice(at,d.start)+' '.repeat(d.end-d.start);at=d.end;}globals+=masked.slice(at);
 const kept=new Set(['main',...calls(globals)]);let changed=true;while(changed){changed=false;for(const d of defs)if(kept.has(d.name))for(const n of calls(d.masked))if(!kept.has(n)){kept.add(n);changed=true;}}
 let result='',cursor=0;for(const d of defs){result+=source.slice(cursor,d.start)+(kept.has(d.name)?d.text:'\n/* unreachable function omitted: '+d.name+' */\n');cursor=d.end;}result+=source.slice(cursor);
 for(const d of defs.filter(d=>kept.has(d.name)))invariant(result.includes(d.text)&&!calls(d.masked).some(n=>!kept.has(n)),'function closure');return result;
}
const unpack='uint unpackWord(vec4 v){uvec4 b=uvec4(round(v*255.));return b.x|(b.y<<8)|(b.z<<16)|(b.w<<24);}';
function build(fragment){
 invariant(typeof fragment==='string','fragment string required');
 const main=span(fragment,'void main(){'),hitAt=main.body.indexOf('float hit=-1.;'),tailAt=main.body.indexOf('if(hit<0.)');
 invariant(hitAt>0&&tailAt>hitAt,'original camera/hit/tail contract');
 const prefix=fragment.slice(0,main.start),camera=main.body.slice(0,hitAt),tail=main.body.slice(tailAt);
 invariant(prefix.includes('out vec4 outColor;')&&prefix.includes('float field(vec3 p){')&&prefix.includes('vec2 ranges(vec3 lo,vec3 hi){'),'one-part scalar/range contract');
 invariant(camera.includes('if(t>end)discard;')&&camera.includes('gl_FragCoord.xy'),'native camera/AABB contract');
 const stepPrefix=prefix.replace('out vec4 outColor;','layout(location=0) out vec4 stateA;layout(location=1) out vec4 stateB;');
 const step=`
uniform highp sampler2D previousA,previousB;uniform int initializeState,intervalNodeBudget;
${unpack}
vec4 packWord(uint b){return vec4(float(b&255u),float((b>>8)&255u),float((b>>16)&255u),float((b>>24)&255u))/255.;}
void writeState(uint a,uint b){stateA=packWord(a);stateB=packWord(b);}
void main(){
 ${camera.replace('if(t>end)discard;','')}
 if(initializeState==1){writeState(0u,t>end?128u:0u);return;}
 ivec2 pixel=ivec2(gl_FragCoord.xy);uint address=unpackWord(texelFetch(previousA,pixel,0)),meta=unpackWord(texelFetch(previousB,pixel,0));
 uint status=(meta>>6)&3u;int depth=int(meta&63u),visited=int(meta>>8);
 if(status!=0u){writeState(address,meta);return;}
 if(visited>=intervalNodeBudget){writeState(address,(meta&~192u)|192u);return;}
 float a=t,b=end;
 for(int bit=29;bit>=0;bit--){if(bit<depth){float mid=(a+b)*.5;if(((address>>uint(bit))&1u)==0u)b=mid;else a=mid;}}
 vec3 pa=eye+rd*a,pb=eye+rd*b;bool descend=false;visited++;
 if(!(min(pa.x,pb.x)>cutX)){
  vec2 rr=ranges(min(pa,pb),max(pa,pb));
  if(!(rr.x>0.)){
   if(b-a<0.0005){float mid=(a+b)*.5;vec3 pm=eye+rd*mid;if(pm.x<=cutX&&field(pm)<=0.0005){writeState(floatBitsToUint(mid),uint(depth)|64u|(uint(visited)<<8));return;}}
   else{descend=true;}
  }
 }
 if(descend&&depth<30){address*=2u;depth++;}
 else{for(int climb=0;climb<31;climb++){if(depth==0){status=2u;break;}if((address&1u)==0u){address++;break;}address>>=1;depth--;}}
 if(status==0u&&visited>=intervalNodeBudget)status=3u;
 writeState(address,uint(depth)|(status<<6)|(uint(visited)<<8));
}`;
 const textureHit='ivec2 pixel=ivec2(gl_FragCoord.xy);uint meta=unpackWord(texelFetch(hitStateB,pixel,0));if(((meta>>6)&3u)!=1u)discard;float hit=uintBitsToFloat(unpackWord(texelFetch(hitStateA,pixel,0)));';
 const tailSource=prefix+'uniform highp sampler2D hitStateA,hitStateB;'+unpack+'void main(){'+camera+textureHit+tail+'}';
 return Object.freeze({stepFragment:prune(stepPrefix+step),tailFragment:prune(tailSource),nodeBudget:4096,leafTolerance:.0005});
}
function create(gl,vertex,width,height){
 invariant(gl&&typeof vertex==='string','GL/vertex required');invariant(Number.isInteger(width)&&width>0&&Number.isInteger(height)&&height>0,'native dimensions');
 let active=null,disposed=false;const pairs=new Set(),buffers=[];
 function healthy(){invariant(!disposed,'runtime disposed');invariant(!gl.isContextLost(),'context lost');invariant(gl.drawingBufferWidth===width&&gl.drawingBufferHeight===height,'native buffer changed');const error=gl.getError();invariant(error===gl.NO_ERROR,'GL error '+error);}
 function restoreDefault(){gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.drawBuffers([gl.BACK]);gl.readBuffer(gl.BACK);gl.viewport(0,0,width,height);gl.disable(gl.SCISSOR_TEST);gl.enable(gl.DITHER);gl.disable(gl.BLEND);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.depthMask(true);}
 function makeBuffer(){const fb=gl.createFramebuffer(),textures=[];gl.bindFramebuffer(gl.FRAMEBUFFER,fb);for(let i=0;i<2;i++){const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0+i,gl.TEXTURE_2D,tex,0);textures.push(tex);}gl.drawBuffers([gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1]);invariant(gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE,'RGBA8 framebuffer incomplete');return{fb,textures};}
 healthy();try{buffers.push(makeBuffer(),makeBuffer());}finally{if(!gl.isContextLost())restoreDefault();}
 function program(fragment){const p=gl.createProgram(),shaders=[];try{for(const [type,source]of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){const s=gl.createShader(type);shaders.push(s);gl.shaderSource(s,source.replace(/\b[A-Za-z_]\w*__\w*\b/g,n=>n.replace(/__/g,'_neg_')));gl.compileShader(s);invariant(gl.getShaderParameter(s,gl.COMPILE_STATUS),gl.getShaderInfoLog(s)||'compile failed');gl.attachShader(p,s);}gl.linkProgram(p);invariant(gl.getProgramParameter(p,gl.LINK_STATUS),gl.getProgramInfoLog(p)||'link failed');return p;}catch(e){gl.deleteProgram(p);throw e;}finally{for(const s of shaders)gl.deleteShader(s);}}
 function compile(fragment){healthy();invariant(!active,'compile during active render');const built=build(fragment);let step;try{step=program(built.stepFragment);const pair={step,tail:program(built.tailFragment),built};pairs.add(pair);return pair;}catch(e){if(step)gl.deleteProgram(step);throw e;}}
 async function render(pair,box,bindUniforms,guard,onProgress){
 invariant(typeof guard==='function'&&typeof bindUniforms==='function','guard/uniform binder required');guard();healthy();invariant(pairs.has(pair),'foreign program pair');invariant(!active,'concurrent interval render');
 invariant(Array.isArray(box)&&box.length===4&&box.every(Number.isInteger),'integer bbox required');const[x,y,w,h]=box;invariant(w>=0&&h>=0,'negative bbox');
 const result={logicalFields:1,physicalStateDraws:0,tailDraws:0,passes:0,parallelPixels:w*h,nodeBudget:4096,searchComplete:false,tailSubmitted:false,tailSubmissionOnly:true};if(!w||!h)return{...result,skipped:true,searchComplete:true};
 invariant(x>=0&&y>=0&&x+w<=width&&y+h<=height,'bbox outside native buffer');const owner={};active=owner;const started=performance.now();
 const valid=()=>{invariant(active===owner,'render ownership lost');guard();healthy();};
 const bind=p=>{valid();gl.useProgram(p);const value=bindUniforms(p);invariant(!value||typeof value.then!=='function','uniform binder must be synchronous');valid();};
 const checkpoint=async phase=>{valid();if(onProgress){await onProgress({phase,...result});valid();}await new Promise(resolve=>setTimeout(resolve,0));valid();};
 let src=0,dst=1;const bytes=new Uint8Array(w*h*4),view=new DataView(bytes.buffer);
 const summary=()=>{valid();gl.bindFramebuffer(gl.FRAMEBUFFER,buffers[src].fb);gl.readBuffer(gl.COLOR_ATTACHMENT1);gl.finish();gl.readPixels(x,y,w,h,gl.RGBA,gl.UNSIGNED_BYTE,bytes);valid();const s={active:0,hit:0,miss:0,exhausted:0,totalNodes:0,maxNodes:0};for(let i=0;i<w*h;i++){const m=view.getUint32(i*4,true),n=m>>>8,status=(m>>>6)&3;invariant(n<=4096&&(m&63)<=30,'invalid per-ray state');s[['active','hit','miss','exhausted'][status]]++;s.totalNodes+=n;s.maxNodes=Math.max(s.maxNodes,n);}return s;};
 const step=initialize=>{valid();invariant(src!==dst,'state attachment feedback');gl.bindFramebuffer(gl.FRAMEBUFFER,buffers[dst].fb);gl.useProgram(pair.step);for(let i=0;i<2;i++){gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,buffers[src].textures[i]);}gl.uniform1i(gl.getUniformLocation(pair.step,'initializeState'),initialize?1:0);gl.drawArrays(gl.TRIANGLES,0,3);result.physicalStateDraws++;[src,dst]=[dst,src];};
 try{
  bind(pair.step);const budget=gl.getUniformLocation(pair.step,'intervalNodeBudget');invariant(budget!==null,'missing node budget');gl.uniform1i(budget,4096);invariant(gl.getUniform(pair.step,budget)===4096,'node budget binding');gl.uniform1i(gl.getUniformLocation(pair.step,'previousA'),0);gl.uniform1i(gl.getUniformLocation(pair.step,'previousB'),1);
  gl.disable(gl.DITHER);gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);gl.disable(gl.SCISSOR_TEST);gl.bindVertexArray(null);gl.viewport(x,y,w,h);step(true);result.final=summary();invariant(!result.final.hit&&!result.final.exhausted&&!result.final.totalNodes,'initial state');
  while(result.final.active&&result.passes<4096){const count=Math.min(8,4096-result.passes);for(let i=0;i<count;i++){step(false);result.passes++;}result.final=summary();invariant(!result.final.exhausted,'4096-node budget exhausted; frame incomplete');await checkpoint('interval-batch');}
  invariant(!result.final.active&&!result.final.exhausted,'unfinished interval rays');result.searchMs=performance.now()-started;result.searchComplete=true;valid();restoreDefault();gl.viewport(x,y,w,h);gl.enable(gl.SCISSOR_TEST);gl.scissor(x,y,w,h);bind(pair.tail);for(let i=0;i<2;i++){gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,buffers[src].textures[i]);gl.uniform1i(gl.getUniformLocation(pair.tail,i===0?'hitStateA':'hitStateB'),i);}valid();gl.drawArrays(gl.TRIANGLES,0,3);result.tailDraws=1;valid();result.tailSubmitted=true;result.ms=performance.now()-started;return result;
 }finally{
  // Never let a stale finally restore GL state after a newer initialization.
  if(active===owner){let current=false;try{guard();current=!gl.isContextLost();}catch(_){}if(current)restoreDefault();active=null;}
 }
 }
 function dispose(){invariant(!active,'dispose during render');if(disposed)return;for(const p of pairs){gl.deleteProgram(p.step);gl.deleteProgram(p.tail);}for(const b of buffers){gl.deleteFramebuffer(b.fb);for(const t of b.textures)gl.deleteTexture(t);}pairs.clear();disposed=true;}
 return Object.freeze({compile,render,dispose});
}
root.A4_INTERVAL_GPU=Object.freeze({build,create,prune});
})(typeof globalThis!=='undefined'?globalThis:this);
