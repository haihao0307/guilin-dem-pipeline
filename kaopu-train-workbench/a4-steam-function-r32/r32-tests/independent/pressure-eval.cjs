// Independent source-derived evaluation of retained scalar pressure GLSL only.
// No intervals, GPU or GLSL parser generality claimed. Unsupported syntax fails.
const fs=require('fs'),vm=require('vm'),path=require('path');
module.exports=function(root){
 const c={};c.window=c;vm.createContext(c);
 // Load the actual local model prelude: generated SCENE now consumes Mothers.
 // The DOM-only startup diagnostic is not a shape dependency. Legacy scene-only
 // fixtures remain supported; their original scalar interpreter below is unchanged.
 const directory=path.resolve(root),html=path.join(directory,'index.html');let inputs=['scene.js'];
 if(fs.existsSync(html)){
  const scripts=[...fs.readFileSync(html,'utf8').matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(m=>m[1]),stop=scripts.indexOf('scene.js');
  if(stop<0||scripts.filter(s=>s==='scene.js').length!==1)throw Error('One actual scene.js entry required');
  inputs=scripts.slice(0,stop+1).filter(s=>s!=='startup-diagnostics.js');
 }
 for(const src of inputs){const file=path.resolve(directory,src);if(/^[a-z]+:|^\/\//i.test(src)||!file.startsWith(directory+path.sep))throw Error('Local pressure model dependency required');vm.runInContext(fs.readFileSync(file,'utf8'),c,{filename:src});}
 const source=c.SCENE.sources.pressure, functions=[];
 const regex=/\bfloat\s+(\w+)\s*\(([^)]*)\)\s*\{/g;let m;
 while((m=regex.exec(source))){let depth=1,end=regex.lastIndex;for(;depth;end++){if(source[end]==='{')depth++;if(source[end]==='}')depth--;}const body=source.slice(regex.lastIndex,end-1).replace(/\bfloat\s+/g,'let ');const args=m[2].split(',').map(v=>v.trim().replace(/^(?:float|vec[234])\s+/,''));functions.push('function '+m[1]+'('+args.join(',')+'){'+body+'}');regex.lastIndex=end;}
 const fnames=functions.map(v=>v.match(/function (\w+)/)[1]);const code=functions.join('\n')+'\n({'+fnames.join(',')+'})';
 const math={min:Math.min,max:Math.max,sqrt:Math.sqrt,abs:Math.abs,length:a=>Math.hypot(...a),vec2:(...a)=>a.length===1?[a[0],a[0]]:a,vec3:(...a)=>a.length===1?[a[0],a[0],a[0]]:a};vm.createContext(math);const f=vm.runInContext(code,math);
 return {parts:c.SCENE.parts.filter(p=>p.source==='pressure'),functionNames:fnames,scalar:(name,p)=>f[name]({x:p[0],y:p[1],z:p[2]}),raw:f};
};
if(require.main===module){const e=module.exports(process.argv[2]);const checks=[['pr_boiler_tube_hot',[0,3.08,0]],['pr_boiler_tube_metal',[0,3.08,0]],['pr_boiler_tube_metal',[.101,3.08,0]],['pr_boiler_outer_steel_shell',[0,3.3,3.11]],['pr_boiler_water_or_steam_space',[0,3.3,0]],['pr_smokebox_superheater_header',[0,3.3,3.27]],['pr_smokebox_header_live_steam_lumen',[0,3.3,3.3]]];console.log(JSON.stringify({scalarFunctions:e.functionNames.length,checks:checks.map(([f,p])=>({f,p,value:e.scalar(f,p)}))},null,2))}
