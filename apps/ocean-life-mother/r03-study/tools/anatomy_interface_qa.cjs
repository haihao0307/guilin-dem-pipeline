const fs=require('fs'),assert=require('assert');const A=require('../src/anatomy-kernel.js');
const spec={schema:'kaopu-fish-anatomy-articulation/0.1',parts:[
 {id:'head',kind:'rigid-fixed',parent:null,anchor:[0,0,0]},
 {id:'lower-jaw',kind:'rigid-hinge',parent:'head',anchor:[0,-.02,.12],axis:[1,0,0],angleRange:[-.1,.65]},
 {id:'gill-cover-left',kind:'rigid-hinge',parent:'head',anchor:[.035,0,.02],axis:[0,1,0],angleRange:[-.18,.18]},
 {id:'eye-left',kind:'rigid-hinge',parent:'head',anchor:[.04,.035,.10],axis:[0,1,0],angleRange:[-.5,.5]},
 {id:'pectoral-fin-left',kind:'rigid-hinge',parent:'head',anchor:[.055,-.005,-.015],axis:[0,0,1],angleRange:[-.8,.8]}
]};
const K=A.compile(spec),tests=[];function test(name,fn){try{tests.push({name,pass:true,value:fn()})}catch(e){tests.push({name,pass:false,error:e.stack||e.message})}}
const near=(a,b,e=1e-10)=>Math.max(...a.map((x,i)=>Math.abs(x-b[i])))<e;
test('rest state is exact identity',()=>{const p=[.03,-.04,.2],n=[0,1,0],q=K.apply('lower-jaw',p,n,{});assert(near(q.point,p));assert(near(q.vector,n));return q});
test('hinge anchor remains invariant',()=>{const a=spec.parts[1].anchor,q=K.apply('lower-jaw',a,[0,1,0],{'lower-jaw':.6});assert(near(q.point,a));return q.point});
test('rigid hinge preserves radius to anchor',()=>{const a=spec.parts[1].anchor,p=[.02,-.08,.20],q=K.apply('lower-jaw',p,null,{'lower-jaw':.5});const r=x=>Math.hypot(...x.map((v,i)=>v-a[i]));assert(Math.abs(r(p)-r(q.point))<1e-12);return[r(p),r(q.point)]});
test('normal rotation preserves unit length',()=>{const q=K.apply('gill-cover-left',[.05,.01,.03],[1,0,0],{'gill-cover-left':.17});assert(Math.abs(Math.hypot(...q.vector)-1)<1e-12);return q.vector});
test('state is explicitly clamped to evidenced range',()=>{const q=K.apply('lower-jaw',[0,-.08,.20],null,{'lower-jaw':99});assert.equal(q.applied.at(-1).angle,.65);return q.applied.at(-1)});
test('unbound part is rejected instead of defaulting to origin',()=>{assert.throws(()=>K.apply('unknown',[0,0,0],null,{}),/Unknown anatomy part/);return true});
test('missing anchor rejected instead of zero default',()=>{assert.throws(()=>A.compile({schema:spec.schema,parts:[{id:'bad',kind:'rigid-hinge',parent:null,axis:[1,0,0],angleRange:[0,1]}]}),/anchor/);return true});
test('hierarchy cycle rejected',()=>{assert.throws(()=>A.compile({schema:spec.schema,parts:[{id:'a',kind:'rigid-fixed',parent:'b',anchor:[0,0,0]},{id:'b',kind:'rigid-fixed',parent:'a',anchor:[0,0,0]}]}),/cycle/);return true});
const pass=tests.every(t=>t.pass);fs.writeFileSync(require('path').resolve(__dirname,'../qa/ANATOMY_INTERFACE_R03A_RUN5.json'),JSON.stringify({revision:'R03.A-run5',pass,tests,scope:'synthetic articulation invariants only; no FISH-REF-001 anatomical binding or biological angle claim'},null,2));console.log(JSON.stringify({pass,tests},null,2));if(!pass)process.exit(1);
