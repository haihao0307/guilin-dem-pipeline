const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/index.html','utf8');
const script=html.match(/<script>([\s\S]*)<\/script>/)[1];
const els=new Map();const get=id=>{if(!els.has(id))els.set(id,{id,hidden:false,style:{},textContent:'',value:0,dataset:{},addEventListener(){},setAttribute(){},classList:{toggle(){}},getContext(){return null}});return els.get(id)};
const sandbox={window:{addEventListener(){}},document:{getElementById:get,querySelectorAll:()=>[]},cancelAnimationFrame(){},console,Math,performance};
vm.runInNewContext(script,sandbox);const q=sandbox.window.MIXTURE_QA;
for(const [w,angle,a,b] of [[.5,0,.020860756700940907,.12141888865308904],[.5,30,.010944334172070547,.005437526439756391],[(298/301)**2,0,.20898268723987534,.23356363195468668],[(298/301)**2,30,.007344215593394204,.006679036740767538]]){const v=q.models(w,angle);assert(Math.abs(v.average-a)<1e-12);assert(Math.abs(v.mixture-b)<1e-12);}
let checks=0;for(const w of [0,.1,.5,.9801657818346377,1])for(let l=-70;l<=70;l++){const v=q.models(w,l);assert(v.average>=0&&v.mixture>=0);assert(Math.abs(q.models(w,-l).mixture-v.mixture)<1e-12);if(w===0||w===1)assert(Math.abs(v.average-v.mixture)<1e-12);checks++;}
assert(!/<script[^>]+src=|<link[^>]+stylesheet|<img|<iframe|fetch\(|XMLHttpRequest|new WebSocket|getContext\(\s*['"]webgl2?|createImageBitmap|drawImage/i.test(html.replace('webglContexts:0','')),'Unexpected external assets or renderer dependency');
console.log(JSON.stringify({passed:true,fixture_pairs:4,angle_checks:checks,script_parse:true,external_core_assets:0,source_bytes:Buffer.byteLength(html),source_sha256:require('crypto').createHash('sha256').update(html).digest('hex')},null,2));
