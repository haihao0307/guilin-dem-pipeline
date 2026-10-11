// CPU interpreter for the actual extracted applyParallax GLSL, not a handwritten
// second algorithm. Deliberately small, fail-closed grammar. No GLSL derivatives
// or original height field emulation is claimed: bounded height callbacks let
// tests cover arbitrary continuous AND discontinuous legal heights.
import {extractShaderFunctions} from './shader-functions.mjs';
const TYPES=new Set(['float','int','vec3']);
const precedence={'||':1,'&&':2,'==':3,'!=':3,'<':4,'>':4,'<=':4,'>=':4,'+':5,'-':5,'*':6,'/':6};
function parseFunction(text) {
 const tokens=text.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[A-Za-z_]\w*|>=|<=|==|!=|\|\||&&|\+=|-=|\*=|\/=|\+\+|[{}(),;?:+*\/<>!=\-]/g)||[];
 let at=0;
 const peek=()=>tokens[at], eat=()=>tokens[at++], expect=t=>{if(eat()!==t)throw Error('Expected '+t+' near '+tokens.slice(at-4,at+5).join(' '));};
 function expr(min=0){let node;const token=eat();if(token==='('){node=expr();expect(')');}else if(token==='-'||token==='!'){node={type:'unary',op:token,arg:expr(7)};}else if(/^\d|^\./.test(token)){node={type:'number',value:+token};}else if(/^[A-Za-z_]\w*$/.test(token)){if(peek()==='('){eat();const args=[];if(peek()!==')')do{args.push(expr());if(peek()!==',')break;eat();}while(true);expect(')');node={type:'call',name:token,args};}else node={type:'name',name:token};}else throw Error('Unsupported expression token '+token);
 while(precedence[peek()]>=min){const op=eat(),right=expr(precedence[op]+1);node={type:'binary',op,left:node,right};}
 if(min===0&&peek()==='?'){eat();const yes=expr();expect(':');const no=expr();node={type:'conditional',condition:node,yes,no};}return node;}
 function simple(){if(TYPES.has(peek())){const dtype=eat(),name=eat();expect('=');return{type:'declaration',dtype,name,value:expr()};}const name=eat(),op=eat();if(op==='++')return{type:'assignment',name,op,value:null};if(!['=','+=','-=','*=','/='].includes(op))throw Error('Unsupported assignment '+op);return{type:'assignment',name,op,value:expr()};}
 function statement(){const p=peek();if(p==='{'){eat();const statements=[];while(peek()!=='}')statements.push(statement());expect('}');return{type:'block',statements};}if(p==='if'){eat();expect('(');const condition=expr();expect(')');const yes=statement();let no=null;if(peek()==='else'){eat();no=statement();}return{type:'if',condition,yes,no};}if(p==='for'){eat();expect('(');const init=simple();expect(';');const condition=expr();expect(';');const update=simple();expect(')');return{type:'for',init,condition,update,body:statement()};}if(p==='return'){eat();const value=expr();expect(';');return{type:'return',value};}if(p==='break'){eat();expect(';');return{type:'break'};}const s=simple();expect(';');return s;}
 const returnType=eat(),name=eat();expect('(');const args=[];while(peek()!==')'){args.push({dtype:eat(),name:eat()});if(peek()!==',')break;eat();}expect(')');const body=statement();if(at!==tokens.length)throw Error('Unparsed function source');return{returnType,name,args,body};
}
export function compileExtractedParallax(shader,{float32=false}={}) {
 const source=extractShaderFunctions(shader).get('applyParallax')?.text;
 if(!source)throw Error('No applyParallax source');const ast=parseFunction(source),q=float32?Math.fround:x=>x;
 const map=(a,f)=>Array.isArray(a)?a.map(f):f(a);
 const binary=(a,b,f)=>Array.isArray(a)?a.map((v,i)=>f(v,Array.isArray(b)?b[i]:b)):Array.isArray(b)?b.map(v=>f(a,v)):f(a,b);
 const numeric={'+':(a,b)=>q(a+b),'-':(a,b)=>q(a-b),'*':(a,b)=>q(a*b),'/':(a,b)=>q(a/b)};
 const builtin={abs:a=>map(a,x=>q(Math.abs(x))),floor:a=>map(a,Math.floor),float:q,max:(a,b)=>binary(a,b,Math.max),clamp:(a,l,h)=>map(a,x=>Math.min(h,Math.max(l,x))),dot:(a,b)=>a.reduce((s,v,i)=>q(s+q(v*b[i])),0),length:a=>q(Math.sqrt(a.reduce((s,v)=>q(s+q(v*v)),0))),mix:(a,b,w)=>binary(a,b,(x,y)=>q(q(x*q(1-w))+q(y*w)))};
 return function run({baseGrain,localNormal,surfaceClass=0,viewGrain,uniforms={},height}){
  let calls=0;const samples=[];const env={...uniforms,baseGrain:baseGrain.map(q),localNormal:localNormal.map(q),surfaceClass:q(surfaceClass),viewGrain:viewGrain.map(q)};
  for(const name of Object.keys(uniforms))env[name]=q(uniforms[name]);
  const functions={...builtin,coarseRelief:(g,n,c)=>{calls++;const h=q(height(g.slice(),n.slice(),c,calls));if(!(h>=0&&h<=q(.68)))throw Error('Height outside original global bound');samples.push({grain:g.slice(),height:h});return h;}};
  function evaluate(n){switch(n.type){case'number':return q(n.value);case'name':if(!(n.name in env))throw Error('Unbound '+n.name);return env[n.name];case'call':if(!functions[n.name])throw Error('Unsupported builtin '+n.name);return functions[n.name](...n.args.map(evaluate));case'unary':return n.op==='!'?!evaluate(n.arg):map(evaluate(n.arg),a=>q(-a));case'conditional':return evaluate(n.condition)?evaluate(n.yes):evaluate(n.no);case'binary':{const a=evaluate(n.left);if(n.op==='||')return a||evaluate(n.right);if(n.op==='&&')return a&&evaluate(n.right);const b=evaluate(n.right);if(numeric[n.op])return binary(a,b,numeric[n.op]);switch(n.op){case'<':return a<b;case'>':return a>b;case'<=':return a<=b;case'>=':return a>=b;case'==':return a===b;case'!=':return a!==b;}throw Error('Unsupported binary '+n.op);}}throw Error('Unsupported AST '+n.type);}
  function execute(n){switch(n.type){case'block':for(const s of n.statements){const r=execute(s);if(r)return r;}return;case'declaration':env[n.name]=evaluate(n.value);return;case'assignment':env[n.name]=n.op==='='?evaluate(n.value):n.op==='++'?env[n.name]+1:binary(env[n.name],evaluate(n.value),numeric[n.op[0]]);return;case'if':return evaluate(n.condition)?execute(n.yes):n.no?execute(n.no):undefined;case'for':execute(n.init);for(let guard=0;evaluate(n.condition);execute(n.update)){if(++guard>32)throw Error('Loop guard');const r=execute(n.body);if(r?.type==='break')break;if(r)return r;}return;case'break':return{type:'break'};case'return':return{type:'return',value:evaluate(n.value)};}throw Error('Unsupported statement '+n.type);}
  const result=execute(ast.body);if(result?.type!=='return')throw Error('Missing return');return{grain:result.value,calls,samples};
 };
}
