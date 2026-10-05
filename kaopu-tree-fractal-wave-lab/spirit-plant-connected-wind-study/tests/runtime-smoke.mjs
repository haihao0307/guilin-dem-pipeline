import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import * as Three from '../vendor/three.module.js';import {makeConnectedWind,RULE_VERSION} from '../src/connected-wind.js';
function load(kind){
 const html=fs.readFileSync(new URL(`../${kind}/index.html`,import.meta.url),'utf8'),elements=new Map();
 for(const match of html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)){const tag=match[0],id=match[1],events={};elements.set(id,{id,value:tag.match(/\bvalue="([^"]*)"/)?.[1]??'',checked:tag.includes('checked'),hidden:tag.includes('hidden'),textContent:'',clientWidth:1068,clientHeight:760,addEventListener:(n,f)=>events[n]=f,prepend(){},classList:{toggle(){},add(){},remove(){}},events});}
 const meshes=[];class InstancedMesh extends Three.InstancedMesh{constructor(...a){super(...a);meshes.push(this);}}
 const document={documentElement:{dataset:{}},getElementById:id=>{if(!elements.has(id))throw Error('Missing DOM element '+id);return elements.get(id);},createElement:()=>({click(){}})};
 class Renderer{constructor(){this.domElement={};this.info={memory:{geometries:0}};}setPixelRatio(){}setSize(){}render(){}}
 class Controls{constructor(){this.target=new Three.Vector3();}update(){}}
 const c=vm.createContext({THREE:{...Three,WebGLRenderer:Renderer,InstancedMesh},OrbitControls:Controls,makeConnectedWind,RULE_VERSION,document,devicePixelRatio:1,console,performance,setTimeout:()=>0,clearTimeout(){},setInterval:()=>1,clearInterval(){},requestAnimationFrame(){},Blob,URL:{createObjectURL:()=>'',revokeObjectURL(){}},window:{addEventListener(){}}});
 vm.runInContext(fs.readFileSync(new URL(`../${kind}/runtime.js`,import.meta.url),'utf8').replace(/^import .*;$/gm,''),c);
 return {elements,c,meshes,click:id=>elements.get(id).events.click(),input:(id,value)=>{const e=elements.get(id);e.value=String(value);e.events.input({target:e});}};
}
const baseline=load('baseline'),study=load('src');assert(study.c.window.__native3dR03Ready);const s=()=>study.c.window.SpiritR03Study.getState();const initial=JSON.stringify(s().identity);
study.click('windOn');assert.equal(s().motion.enabled,false);
for(let i=0;i<4;i++){assert.equal(study.meshes[i].count,baseline.meshes[i].count);assert.deepEqual(Array.from(study.meshes[i].instanceMatrix.array),Array.from(baseline.meshes[i].instanceMatrix.array),'Zero wind rendered matrix differs '+i);}
for(const id of ['windOn','localFrames','windField','restOverlay','windPlay','windReset','front','side','top','fit','buds','buds','field','field','probe','probe','rebuild'])study.click(id);
assert.equal(JSON.stringify(s().identity),initial,'non-morphology controls alter identity');
study.input('windTime',8.1);assert.equal(s().motion.playing,false);assert.equal(s().motion.time,8.1);
study.input('windStrength',1.5);study.input('windAz',-90);study.input('worldOffset',8);assert(s().metrics.rootError===0);
study.elements.get('plantSeed').value='42';study.click('applySeed');assert.notEqual(JSON.stringify(s().identity),initial);study.click('originalSeed');assert.equal(JSON.stringify(s().identity),initial);
for(const id of ['windOn','windOn','windReset','localFrames','windField','restOverlay'])study.click(id);
assert.equal(study.meshes.length,4,'unexpected instanced meshes');assert(s().metrics.connectionError<1e-12&&s().metrics.lengthError<1e-12);
const report={status:'LOGIC_SMOKE_PASS',scope:'Node VM, actual Three r186 geometry/matrices with fake renderer and minimal DOM. NOT a browser test.',zeroWindInstanceMatricesBitIdentical:true,instanceMeshCount:study.meshes.length,controlsChecked:30,identityStable:true,metrics:s().metrics,browserPassed:false};fs.writeFileSync(new URL('../qa/RUNTIME_LOGIC_QA.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
