// Fixed W3C CRD 2026-09-21, sections 16.1 and 16.2.
// https://www.w3.org/TR/2026/CRD-WGSL-20260921/#keyword-summary
// Lexical declaration gate, not a replacement for the real GPU compiler.
export const KEYWORDS='alias break case const const_assert continue continuing default diagnostic discard else enable false fn for if let loop override requires return struct switch true var while'.split(' ');
export const RESERVED='NULL Self abstract active alignas alignof as asm asm_fragment async attribute auto await become cast catch class co_await co_return co_yield coherent column_major common compile compile_fragment concept const_cast consteval constexpr constinit crate debugger decltype delete demote demote_to_helper do dynamic_cast enum explicit export extends extern external fallthrough filter final finally friend from fxgroup get goto groupshared highp impl implements import inline instanceof interface layout lowp macro macro_rules match mediump meta mod module move mut mutable namespace new nil noexcept noinline nointerpolation non_coherent noncoherent noperspective null nullptr of operator package packoffset partition pass patch pixelfragment precise precision premerge priv protected pub public readonly ref regardless register reinterpret_cast require resource restrict self set shared sizeof smooth snorm static static_assert static_cast std subroutine super target template this thread_local throw trait try type typedef typeid typename typeof union unless unorm unsafe unsized use using varying virtual volatile wgsl where with writeonly yield'.split(' ');
function uncomment(text){let out='',depth=0,line=false;for(let i=0;i<text.length;i++){const a=text[i],b=text[i+1];if(line){if(a==='\n'){line=false;out+='\n';}continue;}if(depth){if(a==='/'&&b==='*'){depth++;i++;}else if(a==='*'&&b==='/'){depth--;i++;}else if(a==='\n')out+='\n';continue;}if(a==='/'&&b==='/'){line=true;i++;continue;}if(a==='/'&&b==='*'){depth=1;i++;continue;}out+=a;}return out;}
export function scanWGSLIdentifiers(source){const tokens=uncomment(source).match(/[A-Za-z_]\w*|[^\s]/g)||[],keys=new Set(KEYWORDS),reserved=new Set(RESERVED),errors=[],stack=[];let pendingStruct=false,pendingFn=false;
 const check=(name,where)=>{if(keys.has(name)||reserved.has(name)||name==='_'||name?.startsWith('__'))errors.push({name,where});};
 for(let i=0;i<tokens.length;i++){const t=tokens[i];if(reserved.has(t))errors.push({name:t,where:'reserved token'});
 if(['fn','struct','alias','let','const','override'].includes(t)){check(tokens[i+1],'declaration after '+t);if(t==='struct')pendingStruct=true;if(t==='fn')pendingFn=true;}
 if(t==='var'){let j=i+1;if(tokens[j]==='<'){let d=1;j++;while(j<tokens.length&&d){if(tokens[j]==='<')d++;if(tokens[j]==='>')d--;j++;}}check(tokens[j],'variable');}
 if(tokens[i+1]===':'&&stack.some(x=>x==='struct'||x==='formal'))check(t,'struct member or formal parameter');
 if(t==='('){stack.push(pendingFn?'formal':'paren');pendingFn=false;}else if(t===')'){stack.pop();}else if(t==='{'){stack.push(pendingStruct?'struct':'brace');pendingStruct=false;}else if(t==='}'){stack.pop();}}
 return errors;
}

