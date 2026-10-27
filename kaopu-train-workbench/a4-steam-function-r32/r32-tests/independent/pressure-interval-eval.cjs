// Read-only independent CPU interpreter of the saved pressure GLSL interval
// declarations. Helpers preserve their source algebra and pad constants; this
// is double precision evidence, not a GLSL highp rounding certification.
const vm=require('vm');
module.exports=function(source,name='pr_boiler_outer_steel_shell_range'){
 const v=(x,y=x)=>({x,y}),pad=a=>{const e=.000002*(1+Math.max(Math.abs(a.x),Math.abs(a.y)));return v(a.x-e,a.y+e);};
 const h={vec2:v,min:Math.min,max:Math.max,abs:Math.abs,sqrt:Math.sqrt,prPad:pad,
  prC:x=>pad(v(x)),prAdd:(a,b)=>pad(v(a.x+b.x,a.y+b.y)),prSub:(a,b)=>pad(v(a.x-b.y,a.y-b.x)),prNeg:a=>v(-a.y,-a.x),
  prMul:(a,b)=>{const x=[a.x*b.x,a.x*b.y,a.y*b.x,a.y*b.y];return pad(v(Math.min(...x),Math.max(...x)));},
  prAbs:a=>pad(v(a.x<=0&&a.y>=0?0:Math.min(Math.abs(a.x),Math.abs(a.y)),Math.max(Math.abs(a.x),Math.abs(a.y)))),
  prMin:(a,b)=>v(Math.min(a.x,b.x),Math.min(a.y,b.y)),prMax:(a,b)=>v(Math.max(a.x,b.x),Math.max(a.y,b.y)),
  prSelect:(a,b,c,d)=>a.y<=b.x?c:a.x>b.y?d:v(Math.min(c.x,d.x),Math.max(c.y,d.y))};
 h.prDiv=(a,b)=>b.x<=0&&b.y>=0?v(-1e25,1e25):h.prMul(a,pad(v(1/b.y,1/b.x)));
 h.prSquare=a=>{const b=h.prAbs(a);return pad(v(Math.max(b.x,0)**2,b.y*b.y));};
 h.prSqrt=a=>pad(v(Math.sqrt(Math.max(a.x,0)),Math.sqrt(Math.max(a.y,0))));
 h.prNorm2=(a,b)=>h.prSqrt(h.prAdd(h.prSquare(a),h.prSquare(b)));
 h.prNorm3=(a,b,c)=>h.prSqrt(h.prAdd(h.prAdd(h.prSquare(a),h.prSquare(b)),h.prSquare(c)));
 const funcs=[],re=/\b(?:float|vec2)\s+(prInterp(?:Range)?\d+|pr_boiler_outer_steel_shell_range)\s*\(([^)]*)\)\s*\{/g;let m;
 while((m=re.exec(source))){let end=re.lastIndex,depth=1;for(;depth&&end<source.length;end++){if(source[end]==='{')depth++;if(source[end]==='}')depth--;}if(depth)throw Error('Unclosed source');const body=source.slice(re.lastIndex,end-1).replace(/\b(?:float|vec2)\s+/g,'let '),args=m[2].split(',').map(x=>x.trim().replace(/^(?:float|vec2|vec3)\s+/,''));funcs.push(`function ${m[1]}(${args}){${body}}`);re.lastIndex=end;}
 vm.createContext(h);const f=vm.runInContext(funcs.join('\n')+'\n'+name,h);
 return (lo,hi)=>{const q=a=>({x:a[0],y:a[1],z:a[2]}),r=f(q(lo),q(hi));return[r.x,r.y];};
};
