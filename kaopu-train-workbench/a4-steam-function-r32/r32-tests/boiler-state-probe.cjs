'use strict';
// Test-only scheduling: exactly one interval-tree node per GPU pass. No CPU fields.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),prune=require('./glsl-function-closure.cjs');
const input=JSON.parse(fs.readFileSync(path.join(__dirname,'BOILER_PROBE_SOURCE.json'))),search=input.probes.closure_search;
const begin=search.indexOf('uniform int intervalNodeBudget;void main(){');assert(begin>0);
const prefix=search.slice(0,begin).replace('out vec4 outColor;','layout(location=0) out vec4 stateA;layout(location=1) out vec4 stateB;');
const camera=search.slice(search.indexOf('void main(){')+12,search.indexOf('float hit=-1.;')).replace('if(t>end)discard;','');
assert(camera.includes('gl_FragCoord.xy-vec2(360,200)'));
const step=`
uniform highp sampler2D previousA,previousB;uniform int initializeState,intervalNodeBudget;
uint unpackWord(vec4 v){uvec4 b=uvec4(round(v*255.));return b.x|(b.y<<8)|(b.z<<16)|(b.w<<24);}
vec4 packWord(uint b){return vec4(float(b&255u),float((b>>8)&255u),float((b>>16)&255u),float((b>>24)&255u))/255.;}
void writeState(uint a,uint b){stateA=packWord(a);stateB=packWord(b);}
void main(){
 ${camera}
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
const shader=prune(prefix+step);assert(!shader.source.includes('i<4096'));assert(!shader.source.includes('i<intervalNodeBudget'));assert(shader.source.includes(input.proof.originalFieldExpression));
// Expected transport states come only from the already-independent reference decisions.
let address=0,depth=0;const expectedStates=input.rangePathReference.trace.map((n,i)=>{let status=0;if(n.decision==='hit'){const buf=new ArrayBuffer(4);new DataView(buf).setFloat32(0,Math.fround(Math.fround(n.a+n.b)*.5),true);address=new DataView(buf).getUint32(0,true);status=1;}else if(n.decision==='split'){address*=2;depth++;}else{for(let k=0;k<31;k++){if(depth===0){status=2;break;}if((address&1)===0){address++;break;}address>>>=1;depth--;}}return{a:address,b:depth|(status<<6)|((i+1)<<8),decision:n.decision};});assert.equal(expectedStates.length,25);assert.equal((expectedStates.at(-1).b>>>6)&3,1);
const result={expectedStates,diagnosticOnly:true,wholeFrameAccepted:false,scope:'GPU one-node scheduling with twoRGBA8 integerbit state attachments; unchanged actual field/range/native ray/4096total budget/.0005 leaf; no CPU field substitution',vertex:input.vertex,firstDraw:input.firstDraw,nativePixel:input.nativePixel,nativeBuffer:input.nativeBuffer,stepFragment:shader.source,tailFragment:input.probes.post_hit_shading,reference:input.rangePathReference,closure:shader.manifest,format:{A:'active:path integer; hit:floatBits hit',B:'depth bits0..5; status bits6..7(active0,hit1,miss2,exhausted3); visited bits8..20'},hash:crypto.createHash('sha256').update(shader.source).digest('hex')};
fs.writeFileSync(path.join(__dirname,'BOILER_STATE_SOURCE.json'),JSON.stringify(result));fs.writeFileSync(path.join(__dirname,'BOILER_STATE_SOURCE_RESULT.json'),JSON.stringify({...result,stepFragment:undefined,tailFragment:undefined,reference:undefined},null,2));console.log(JSON.stringify({status:'SOURCE_ONLY',bytes:shader.source.length,sha:result.hash}));
