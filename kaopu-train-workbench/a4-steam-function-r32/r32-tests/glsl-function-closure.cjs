'use strict';
// Source-size candidate only: retain every reachable function byte for byte.
// All non-function text (version/precision/uniforms/structs/prototypes/macros) stays.
const crypto=require('crypto');
function maskComments(s){return s.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,m=>m.replace(/[^\n]/g,' '));}
function analyze(source){
 // Deliberately not a GLSL preprocessor: reject replacement macros/continuations.
 const commentsMasked=maskComments(source);
 for(const line of commentsMasked.split('\n'))if(/^\s*#\s*define\b/.test(line)&&!/^\s*#\s*define\s+[A-Za-z_]\w*\s*$/.test(line))throw Error('Unsupported replacement macro');
 if(/^\s*#.*\\\s*$/m.test(commentsMasked))throw Error('Unsupported preprocessor continuation');
 const masked=commentsMasked.replace(/^\s*#[^\n]*/gm,m=>m.replace(/[^\n]/g,' ')),types=new Set(['void','float','int','uint','bool','vec2','vec3','vec4','ivec2','ivec3','ivec4','uvec2','uvec3','uvec4','bvec2','bvec3','bvec4','mat2','mat3','mat4',...[...masked.matchAll(/\bstruct\s+(\w+)\s*\{/g)].map(m=>m[1])]),defs=[];
 const re=/\b(\w+)\s+(\w+)\s*\(([^(){};]*)\)\s*\{/g;let m;
 while((m=re.exec(masked))){if(!types.has(m[1]))continue;const start=m.index,bodyStart=re.lastIndex;let end=bodyStart,depth=1;for(;depth&&end<masked.length;end++){if(masked[end]==='{')depth++;if(masked[end]==='}')depth--;}if(depth)throw Error('Unclosed GLSL function '+m[2]);defs.push({name:m[2],start,end,text:source.slice(start,end),masked:masked.slice(start,end)});re.lastIndex=end;}
 if(!defs.some(d=>d.name==='main'))throw Error('Missing main');
 const names=new Set(defs.map(d=>d.name)),calls=s=>[...new Set([...s.matchAll(/\b(\w+)\s*\(/g)].map(m=>m[1]).filter(n=>names.has(n)))];
 let globals='',at=0;for(const d of defs){globals+=masked.slice(at,d.start)+' '.repeat(d.end-d.start);at=d.end;}globals+=masked.slice(at);
 const kept=new Set(['main',...calls(globals)]);let changed=true;while(changed){changed=false;for(const d of defs)if(kept.has(d.name))for(const n of calls(d.masked))if(!kept.has(n)){kept.add(n);changed=true;}}
 let result='',cursor=0;for(const d of defs){result+=source.slice(cursor,d.start);result+=kept.has(d.name)?d.text:'\n/* unreachable function omitted: '+d.name+' */\n';cursor=d.end;}result+=source.slice(cursor);
 const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
 for(const d of defs.filter(d=>kept.has(d.name)))if(!result.includes(d.text)||calls(d.masked).some(n=>!kept.has(n)))throw Error('Closure/body invariant failed');
 return{source:result,manifest:{beforeBytes:Buffer.byteLength(source),afterBytes:Buffer.byteLength(result),beforeSHA:hash(source),afterSHA:hash(result),totalDefinitions:defs.length,keptDefinitions:defs.filter(d=>kept.has(d.name)).map(d=>({name:d.name,sha256:hash(d.text),bytes:Buffer.byteLength(d.text)})),removedDefinitions:defs.filter(d=>!kept.has(d.name)).map(d=>d.name),allNonFunctionTextPreserved:true,keptFunctionBytesUnchanged:true}};
}
module.exports=analyze;
