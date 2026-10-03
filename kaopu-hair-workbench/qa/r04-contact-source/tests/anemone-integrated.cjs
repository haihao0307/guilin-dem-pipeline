/* Source/DOM/WebGL-call mocks only: no GPU compilation, framebuffer, visual acceptance or performance claim. */
{
 const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),vm=require('node:vm');
 const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
 const frozen={
  'src/anemone-contact-renderer.js':'3f6e34da498bb1abb56e7e010745af0c78fe6e10ddc0b9fb13c632d00f1756fa',
  'src/anemone-contact-host.js':'11542b1bf913209135e8af81cb6140f3280c31ae1643270a2ca9dfbb17125d2c',
  'src/anemone-optics.js':'2ce8733ccb174f945b0337825bb170f848894bd07c2ea3f1328161d92289a518',
  'src/anemone-core.js':'7a8e2aa0385e1c17ce1bbf7687d3455d139df60c82c1b815fdb59979d7ea1d32',
  'src/anemone-body.js':'03abd329f5e91ea612488b8d659787053d2affdbd38f300a765463953de671b2',
  'src/anemone-contact.js':'edf16cbb0cd60c22ec013b927e066e644bdc6ce0412f5711eb5a0466a70713cd',
  'src/anemone-guides.js':'da6bfda0b7ac21e60bdefc657f29688a7e6fe72a0f79865fa16c9e3413483d93',
  'src/host.js':'30afee70b2f27d1616ade1d9182f5fcfae70d5fc05c471fb520914afaa89c519',
  'src/frame.js':'2cfed9c41d2c76b63d13fb8b94a1e436b0d3218861bcd2896b125fdb48c59f57',
  'src/workbench.html':'609ceeeed72ec3329a5e63475fadafa6da5da87ac07f472126657c2d3f2fb8d8'};
 for(const [file,hash] of Object.entries(frozen))assert.equal(sha(read(file)),hash,'frozen source '+file);
 let restored=read('src/anemone-integrated-renderer.js');
 restored=restored.replace('/* Isolated KAOPU integrated tissue/contact study. Camera-only extension of the\n * frozen r04 contact renderer; the front-return shader set is selected by build.','/* Original KAOPU r04 contact renderer, isolated from the r03/optics-stage renderer.');
 restored=restored.replace('const cam=this.camera,target=cam.target||[0,.55,0],dist=cam.distance*Math.max(1,1.42/(w/h)),eye=[target[0]+Math.sin(cam.azimuth)*Math.cos(cam.elevation)*dist,target[1]+Math.sin(cam.elevation)*dist,target[2]+Math.cos(cam.azimuth)*Math.cos(cam.elevation)*dist],vp=matrix(eye,target,w/h);','const cam=this.camera,dist=cam.distance*Math.max(1,1.42/(w/h)),eye=[Math.sin(cam.azimuth)*Math.cos(cam.elevation)*dist,.55+Math.sin(cam.elevation)*dist,Math.cos(cam.azimuth)*Math.cos(cam.elevation)*dist],vp=matrix(eye,[0,.55,0],w/h);');
 restored=restored.replace("const direction=cam.target&&(this.optics.lighting==='front'||this.optics.lighting==='back')?norm(eye.map((v,i)=>(v-target[i])*(this.optics.lighting==='back'?-1:1))):O.lighting(this.optics.lighting,eye)",'const direction=O.lighting(this.optics.lighting,eye)');
 restored=restored.replace('camera:copy(this.camera)','camera:{...this.camera}');
 assert.equal(restored,read('src/anemone-contact-renderer.js'),'only camera-only changes plus defensive metric copy; solver, mesh, sampling and contact certification exact');
 const html=read('dist/KAOPU-r04-合法组织微距候选.html'),bundle=JSON.parse(html.match(/window\.WORKBENCH_BUNDLE=([\s\S]*?);<\/script>/)[1]);
 assert.equal(Object.keys(bundle.modules).length,20);assert.equal(Object.keys(bundle.assets).length,10);assert.equal(Object.keys(bundle.sha256).length,78);
 const manifest=JSON.parse(read('source-manifest.json'));assert.deepEqual(bundle.sha256,manifest.sha256);assert.equal(bundle.commit,manifest.commit);assert.equal(bundle.license,read('teacher-original/LICENCE.md'));
 for(const [name,hash] of Object.entries(bundle.sha256))assert.equal(sha(fs.readFileSync(path.join(root,'teacher-original',name))),hash);
 for(const [name,source] of Object.entries(bundle.modules))assert.equal(source,read('teacher-original/js/app/'+name+'.js'));
 for(const [name,source] of Object.entries(bundle.assets)){const file=fs.readFileSync(path.join(root,'teacher-original',name));assert.equal(source,name.endsWith('.png')?'data:image/png;base64,'+file.toString('base64'):file.toString())}
 assert(html.includes('data:image/jpeg;base64,'+fs.readFileSync(path.join(root,'references/anemone-macro/wootton-magnifica-original.jpg')).toString('base64')));
 const select='window.AnemoneOptics=window.AnemoneOptics.frontReturn;\n';
 assert(html.includes(read('src/anemone-optics.js')+'\n'+select+read('src/anemone-integrated-renderer.js')+'\n'+read('src/anemone-integrated-host.js')),'exact shader set selected before renderer evaluates');
 assert(html.includes('2026-10-03-anemone-r04-integrated-tissue-contact'));
}
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=require('path').resolve(__dirname,'..'),C=require(root+'/src/anemone-core.js');
const sourceTests=[];
const nodes=new Map(),raf=new Map(),listeners={};let nextRAF=0, intersectionCallback;
class El{
 constructor(attrs={}){this.id=attrs.id;this.dataset={};this.value=attrs.value||'';this.disabled=false;this.hidden='hidden' in attrs;this.events={};this.children=[];this.classes=new Set((attrs.class||'').split(' '));this.classList={contains:x=>this.classes.has(x),toggle:(x,force)=>{const add=force===undefined?!this.classes.has(x):force;add?this.classes.add(x):this.classes.delete(x);}};this.contentWindow={postMessage(){}};if(this.id)nodes.set(this.id,this);}
 set innerHTML(s){parse(s)}append(x){this.children.push(x)}addEventListener(n,f){this.events[n]=f}click(){if(!this.disabled)this.onclick?.()}setPointerCapture(){}toBlob(fn){fn(new Blob(['png']))}
}
function parse(s){for(const m of s.matchAll(/<(\w+)(\s[^>]*?)?>/g)){let attrs={};for(const a of (m[2]||'').matchAll(/([\w-]+)(?:="([^"]*)")?/g))attrs[a[1]]=a[2]??'';new El(attrs);}}
parse(fs.readFileSync(root+'/src/anemone-integrated-panel.html','utf8'));for(const id of ['teacherFrame','candidateFrame','viewports'])new El({id});
const document={hidden:false,body:{dataset:{}},getElementById:id=>{assert(nodes.has(id),id);return nodes.get(id)},createElement:()=>new El(),addEventListener:(k,fn)=>listeners[k]=fn};
const workbench={ready:{teacher:true,candidate:true},frameStats:{teacher:{frames:2},candidate:{frames:2}}};
let resets=0,steps=[],draws=0;
class Renderer{
 constructor(canvas){this.canvas=canvas;this.camera={azimuth:.25,elevation:.84,distance:4.6};this.optics={...globalThis.O.DEFAULTS,shadowEnabled:true};this.errors=[];this.frames=0;this.roots=[{}];this.tubeCount=12;this.bodyCount=12;this.reset(C.DEFAULTS)}
 reset(p){if(p.count===560&&p.thickness===.045)throw Error('ROOT_LAYOUT_INFEASIBLE');this.geometry(p);this.state={...p};this.system={state:this.state,time:0,fallbacks:0,proposalScale:1};this.dynamic={solverVersion:'r04-contact-coherent-v1',positions:[1,2,3],previous:[1,2,3],time:0,steps:0,proposalScale:1,lastDt:1/30,fallbackcount:0,solverLimited:false};resets++;return this}
 setFlowState(p){for(const k of ['count','length','thickness','curvature','seed'])assert.equal(p[k],this.state[k]);this.state=this.system.state={...p};return this}
 advance(dt){steps.push(dt);this.dynamic.previous=[...this.dynamic.positions];this.dynamic.positions[0]+=dt;this.dynamic.time+=dt;this.dynamic.steps++;this.system.time=this.dynamic.time;return this.metrics().contact}
 draw(){draws++;this.frames++}
 snapshotDynamic(){return structuredClone(this.dynamic)}
 geometry(p){this.roots=Array.from({length:p.count},(_,i)=>({x:i===1?.36:-1,z:i===1?.79:-1}));this.data=new Float32Array(p.count*(C.SEGMENTS+1)*4);this.data.set([.4,1.2,.7],((C.SEGMENTS+1)+24)*4)}
 restoreDynamic(p,d){if(!Array.isArray(d.positions)||d.positions.length!==3||d.positions.some(x=>!Number.isFinite(x))||d.previous.some(x=>!Number.isFinite(x))||d.positions[0]<0)throw Error('invalid dynamic');this.geometry(p);this.state=this.system.state={...p};this.dynamic=structuredClone(d);this.system.time=d.time;return this}
 metrics(){return {time:this.system.time,cpuSolveMsLast:2,solverLimited:false,contact:{finite:true,contactsChecked:true,bodyChecked:true,rootError:0,lengthRelative:0,arcRelative:0,maxPenetration:0,contactViolations:0,bodyPenetration:0,bendViolation:0,collarViolation:0,accepted:true,targetRms:0}}}
 pixels(){this.draw();return {hash:JSON.stringify(this.dynamic)}}
}
const window={workbench,addEventListener:(k,f)=>listeners[k]=f},ctx={window,document,workbench,AnemoneCore:C,AnemoneRenderer:Renderer,TextEncoder,Blob,URL:{createObjectURL:()=>'',revokeObjectURL(){}},setTimeout:()=>0,cancelAnimationFrame:id=>raf.delete(id),requestAnimationFrame:f=>{raf.set(++nextRAF,f);return nextRAF},ResizeObserver:class{observe(){}},IntersectionObserver:class{constructor(f){intersectionCallback=f}observe(){}},console};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(root+'/src/anemone-optics.js','utf8'),ctx);globalThis.O=ctx.AnemoneOptics=window.AnemoneOptics=window.AnemoneOptics.frontReturn;
vm.runInContext(fs.readFileSync(root+'/src/anemone-integrated-host.js','utf8'),ctx);const a=window.anemone;
const tests=[];function test(name,fn){fn();tests.push(name)}function flush(now){const f=raf.values().next().value;assert(f,'raf scheduled');raf.delete(raf.keys().next().value);f(now)}
test('initial renderer and flow aliases consistent',()=>{assert(a.ready);assert.strictEqual(a.renderer.state,a.renderer.system.state);assert.equal(a.state.version,2)});
test('actual elapsed dt capped at .1',()=>{flush(1000);assert.equal(steps.length,0);flush(1050);assert.equal(steps.at(-1),.05);flush(1500);assert.equal(steps.at(-1),.1)});
test('pause cancels pending RAF and redraw-only controls preserve all dynamic state',()=>{a.pause();assert.equal(raf.size,0);const old=JSON.stringify(a.state.dynamic);a.set({current:.89,direction:80});a.setOptics({palette:'pomfret-amber-yellow'});nodes.get('anemoneCamera').click();nodes.get('anemoneCapture').click();a.pixels();assert.equal(JSON.stringify(a.state.dynamic),old);assert.strictEqual(a.renderer.state,a.renderer.system.state);assert.equal(a.renderer.system.state.current,.89);assert.match(nodes.get('anemoneFlowIntent').textContent,/只更新/)});
test('shape input is preview, change commits once',()=>{const n=resets,range=nodes.get('anemone-length');range.value='.85';range.events.input({target:range});assert.equal(resets,n);assert.notEqual(a.state.params.length,.85);range.events.change({target:range});assert.equal(resets,n+1);assert.equal(a.state.params.length,.85);assert.equal(a.state.dynamic.time,0)});
test('rejected shape keeps state/UI and does not create fatal JS error',()=>{const before=JSON.stringify(a.state);assert.throws(()=>a.set({count:560,thickness:.045}));assert.equal(JSON.stringify(a.state),before);assert.equal(Number(nodes.get('anemone-count').value),360);assert.equal(a.errors.length,0);assert.equal(nodes.get('anemoneError').hidden,true);assert.match(nodes.get('anemoneMessage').textContent,/未应用更改/)});
test('explicit paused advance, seek(0) rebuild, nonzero seek rejects',()=>{a.advance(.02);assert.equal(a.state.dynamic.time,.02);assert.throws(()=>a.advance(.11));const n=resets;a.seek(0);assert.equal(resets,n+1);assert.equal(a.state.dynamic.time,0);assert.throws(()=>a.seek(2));});
test('valid v2 exact state roundtrip',()=>{a.advance(.03);const original=a.exportState();a.setOptics({palette:'wootton-olive-ivory'});a.advance(.01);a.importState(original);assert.equal(JSON.stringify(a.exportState()),JSON.stringify(original));});
test('imports validate host values before dynamic commit and atomically reject bad solver state',()=>{const before=JSON.stringify(a.state);for(const patch of [{optics:{...a.state.optics,palette:'oops'}},{camera:{...a.state.camera,distance:99}},{dynamic:{...a.state.dynamic,positions:[-1,2,3]}},{params:{...a.state.params,count:360.5}},{time:999},{optics:{...a.state.optics,unexpected:123}},{version:1}]){assert.throws(()=>a.importState({...a.state,...patch}));assert.equal(JSON.stringify(a.state),before)}assert.throws(()=>a.importState(' '.repeat(2*1024*1024+1)));assert.throws(()=>a.importState({...a.state,unexpected:'x'.repeat(2*1024*1024)}));assert.equal(a.errors.length,0)});
test('resume restarts clock without accumulated paused time',()=>{a.pause(false);const n=steps.length;flush(90000);assert.equal(steps.length,n);flush(90040);assert.equal(steps.at(-1),.04);assert.throws(()=>a.advance(.01));a.pause()});
test('repeated module switches preserve dynamic geometry and schedule one tick',()=>{const before=JSON.stringify(a.state.dynamic);window.platform.select('rabbit');window.platform.select('anemone');window.platform.select('anemone');assert.equal(JSON.stringify(a.state.dynamic),before);assert.equal(raf.size,0);a.pause(false);window.platform.select('rabbit');assert.equal(raf.size,0);window.platform.select('anemone');window.platform.select('anemone');assert.equal(raf.size,1);a.pause()});
test('UI invalid shape rejection is contained by event handler',()=>{a.set({thickness:.045});const r=nodes.get('anemone-count');r.value='560';assert.doesNotThrow(()=>r.events.change({target:r}));assert.equal(a.state.params.count,360);assert.equal(Number(r.value),360);assert.equal(a.errors.length,0)});
test('offscreen canvas stops clock and resumes without changing paused preference or jumping time',()=>{a.pause(false);flush(100000);const n=steps.length;intersectionCallback([{target:nodes.get('anemoneCanvas'),isIntersecting:false,intersectionRatio:0}]);assert.equal(a.state.params.paused,false);assert.equal(raf.size,0);intersectionCallback([{target:nodes.get('anemoneCanvas'),isIntersecting:true,intersectionRatio:.2}]);assert.equal(raf.size,1);flush(999000);assert.equal(steps.length,n);flush(999016);assert.equal(steps.at(-1),.016);a.pause()});

test('additive optics default .65 and legacy contact v2 imports remain exact',()=>{
 a.reset();a.pause();const old=a.exportState();delete old.optics.frontReturn;delete old.optics.frontReturnView;
 a.setOptics({frontReturn:.13,frontReturnView:'return-only'});a.importState(old);
 assert.equal(a.state.optics.frontReturn,.65);assert.equal(a.state.optics.frontReturnView,'beauty');assert.equal(a.state.optics.transmission,1);
 const bad=a.exportState();delete bad.optics.transmission;assert.throws(()=>a.importState(bad));
});
test('macro camera picks actual uploaded node 24 nearest (.35,.8), never solving geometry',()=>{
 const before=JSON.stringify(a.state.dynamic),n=resets,s=steps.length,data=a.renderer.data.slice();nodes.get('anemoneMacroCamera').click();
 const c=a.state.camera;assert.equal(c.preset,'macro-tip');assert.equal(c.distance,.55);assert.equal(c.elevation,.22);assert.equal(c.azimuth,.25);
 assert.deepEqual(Array.from(c.target),Array.from(data.slice(((C.SEGMENTS+1)+24)*4,((C.SEGMENTS+1)+24)*4+3)));
 assert.equal(JSON.stringify(a.state.dynamic),before);assert.deepEqual(a.renderer.data,data);assert.equal(resets,n);assert.equal(steps.length,s);assert(nodes.get('anemoneMacroCamera').classes.has('active'));
});
test('camera snapshot and imported target cannot alias live camera',()=>{
 const out=a.exportState(),target=Array.from(out.camera.target);out.camera.target[0]=4;assert.deepEqual(Array.from(a.state.camera.target),target);
 const imported=a.exportState();a.importState(imported);imported.camera.target[0]=-4;assert.deepEqual(Array.from(a.state.camera.target),target);
});
test('full macro v2 JSON state roundtrips and UI reflects optical and camera state',()=>{
 a.setOptics({frontReturn:.31,frontReturnView:'return-only',debug:'visibility',transmission:0});
 const state=JSON.parse(JSON.stringify(a.exportState()));a.cameraPreset('overview');a.setOptics({frontReturn:.72,frontReturnView:'beauty',transmission:1});a.importState(state);
 assert.equal(JSON.stringify(a.exportState()),JSON.stringify(state));assert.equal(Number(nodes.get('anemoneFrontReturn').value),.31);assert.equal(nodes.get('anemoneFrontReturnValue').textContent,'0.31');assert.equal(nodes.get('anemoneFrontReturnView').value,'return-only');assert.equal(nodes.get('anemoneDebug').value,'visibility');assert.equal(nodes.get('anemoneTransmission').checked,false);assert(nodes.get('anemoneMacroCamera').classes.has('active'));
});
test('new diagnostic and slider preserve separate old debug and all dynamics',()=>{
 const before=JSON.stringify(a.state.dynamic),n=resets;nodes.get('anemoneFrontReturn').oninput({target:{value:'0.47'}});nodes.get('anemoneFrontReturnView').onchange({target:{value:'layer-reflectance'}});
 assert.equal(a.state.optics.frontReturn,.47);assert.equal(a.state.optics.frontReturnView,'layer-reflectance');assert.equal(a.state.optics.debug,'visibility');assert.equal(a.state.optics.transmission,0);assert.equal(JSON.stringify(a.state.dynamic),before);assert.equal(resets,n);
});
test('all invalid camera and optics variants atomically reject without geometry or UI mutation',()=>{
 const old=JSON.stringify(a.state),base=a.state.camera,n=resets,s=steps.length;
 const variants=[{...base,target:[1,2]}, {...base,target:new Array(3)}, {...base,target:[1,2,NaN]}, {...base,target:[1,2,Infinity]}, {...base,target:[1,2,5.01]}, {...base,target:['1',2,3]}, {...base,target:null}, {...base,target:new Float32Array([1,2,3])}, {...base,target:[1,2,3],distance:.249}, {...base,preset:'front'}, {...base,unknown:1}, {azimuth:0,elevation:.2,distance:1.99}, {elevation:.2,distance:4.6}, {...base,distance:8.01}, {...base,elevation:.149}];
 for(const camera of variants){assert.throws(()=>a.importState({...a.state,camera}));assert.equal(JSON.stringify(a.state),old)}
 for(const patch of [{frontReturn:-1},{frontReturn:1.01},{frontReturn:NaN},{frontReturnView:'glow'}]){assert.throws(()=>a.importState({...a.state,optics:{...a.state.optics,...patch}}));assert.equal(JSON.stringify(a.state),old)}
 assert.throws(()=>a.cameraPreset('bad'));assert.equal(JSON.stringify(a.state),old);assert.equal(resets,n);assert.equal(steps.length,s);assert.equal(Number(nodes.get('anemoneFrontReturn').value),.47);assert.equal(a.errors.length,0);
});
test('macro versus overview wheel lower bounds and reset preserve geometry',()=>{
 const before=JSON.stringify(a.state.dynamic),event={deltaY:-100000,preventDefault(){}};nodes.get('anemoneCanvas').events.wheel(event);assert.equal(a.state.camera.distance,.25);
 a.cameraPreset('overview');assert.equal(a.state.camera.distance,4.6);assert(!Object.hasOwn(a.state.camera,'target'));assert(!Object.hasOwn(a.state.camera,'preset'));assert(nodes.get('anemoneCamera').classes.has('active'));nodes.get('anemoneCanvas').events.wheel(event);assert.equal(a.state.camera.distance,2);assert.equal(JSON.stringify(a.state.dynamic),before);
});
test('explicit 180 and default 360 retain actual density controls, macro, v2 state, and reset UI',()=>{
 a.set({count:180});a.cameraPreset('macro');const state=a.exportState();assert.equal(state.params.count,180);assert.equal(a.renderer.roots.length,180);assert.match(nodes.get('anemoneStats').textContent,/^180 TENTACLES/);
 a.set({count:360});a.importState(state);assert.equal(a.state.params.count,180);assert.equal(Number(nodes.get('anemone-count').value),180);assert.equal(a.renderer.roots.length,180);assert.match(nodes.get('anemoneStats').textContent,/^180 TENTACLES/);
 a.reset();assert.equal(a.state.params.count,360);assert.equal(a.renderer.roots.length,360);assert.equal(a.state.optics.frontReturn,.65);assert.equal(a.state.optics.frontReturnView,'beauty');assert.equal(Number(nodes.get('anemoneFrontReturn').value),.65);assert.equal(nodes.get('anemoneFrontReturnView').value,'beauty');assert.equal(a.state.optics.transmission,1);assert.equal(a.state.camera.distance,4.6);assert(!Object.hasOwn(a.state.camera,'target'));a.pause();
});

test('actual renderer draw emits target-relative macro camera and preserves overview light math',()=>{
 const O=require('../src/anemone-optics.js').frontReturn,calls=[];
 const gl=new Proxy({getError:()=>0,getUniformLocation:(p,n)=>n}, {get(t,n){if(n in t)return t[n];if(n.toUpperCase()===n)return t[n]=Object.keys(t).length+1;return t[n]=(...args)=>calls.push([n,...args.map(v=>Array.isArray(v)||ArrayBuffer.isView(v)?Array.from(v):v)])}});
 const rw={AnemoneCore:C,AnemoneBody:{},AnemoneContact:{},AnemoneGuides:{},AnemoneOptics:O},rc={window:rw,performance,Float32Array,Float64Array,Uint16Array,Uint8Array,ArrayBuffer,DataView,console};
 vm.runInNewContext(fs.readFileSync(root+'/src/anemone-integrated-renderer.js','utf8'),rc);
 const r=Object.create(rw.AnemoneRenderer.prototype);Object.assign(r,{canvas:{clientWidth:600,clientHeight:400,width:600,height:400},gl,errors:[],frames:0,time:0,drawMsTotal:0,drawMsMax:0,camera:{azimuth:.25,elevation:.84,distance:4.6},optics:O.options({...O.DEFAULTS,shadowEnabled:true,lighting:'front'}),texture:{},shadowTexture:{},shadowFBO:{},bodyProgram:{},program:{},shadowProgram:{},shadowBodyProgram:{},body:{},tube:{},bodyCount:12,tubeCount:12,tubeVertexCount:637,roots:[{},{}],data:new Float32Array([1,2,3,4]),system:{positions:new Float64Array([1,2,3]),previous:new Float64Array([1,2,3]),time:0,steps:0,proposalScale:1,lastDt:1/30,fallbacks:0,solverLimited:false,failedAttempts:0,metricsLast:{accepted:true},restReceipt:{}},_timings:Object.fromEntries(['solve','upload','submit'].map(k=>[k,{last:0,total:0,max:0,count:0}]))});
 const close=(v,w)=>assert(v.every((n,i)=>Math.abs(n-w[i])<1e-12));
 const uniform=name=>calls.filter(c=>c[0]==='uniform3fv'&&c[1]===name).at(-1)[2];
 const before=JSON.stringify(r.snapshotDynamic()),data=r.data.slice();r.draw();
 const d=4.6,eye=[Math.sin(.25)*Math.cos(.84)*d,.55+Math.sin(.84)*d,Math.cos(.25)*Math.cos(.84)*d];close(uniform('eye'),eye);close(uniform('uLightDirection'),O.lighting('front',eye));
 assert(!calls.some(c=>['texImage2D','texSubImage2D'].includes(c[0])));assert(calls.some(c=>c[0]==='depthMask'&&c[1]===true));assert(calls.some(c=>c[0]==='disable'&&c[1]===gl.BLEND));
 r.camera={azimuth:.25,elevation:.22,distance:.55,target:[.4,1.2,.7],preset:'macro-tip'};calls.length=0;r.draw();
 const axis=[Math.sin(.25)*Math.cos(.22),Math.sin(.22),Math.cos(.25)*Math.cos(.22)],macroEye=axis.map((v,i)=>r.camera.target[i]+v*.55);close(uniform('eye'),macroEye);close(uniform('uLightDirection'),axis);
 const target=r.camera.target.slice(),metric=r.metrics();metric.camera.target[0]=4;assert.deepEqual(r.camera.target,target);assert.equal(JSON.stringify(r.snapshotDynamic()),before);assert.deepEqual(r.data,data);
 for(const light of ['beauty','back']){r.optics=O.options({...r.optics,lighting:light});r.draw();close(uniform('uLightDirection'),light==='back'?axis.map(x=>-x):O.lighting(light,macroEye));}
 assert.throws(()=>r.draw(1),e=>e.code==='MOTION_ADVANCE_REQUIRED');assert.equal(JSON.stringify(r.snapshotDynamic()),before);
 assert.equal(rw.AnemoneRenderer.contactVertexSource,O.tentacleVertex.replace('float s=param.x<.85?param.x/.85*(1.-capLength):(1.-capLength)+capLength*(param.x-.85)/.15;','float s=param.x;'));
});
console.log(JSON.stringify({passed:true,tests,note:'Frozen source equality, standalone archive contract, minimal DOM mock and actual draw-method/WebGL-call recorder only; shader compilation, pixels and browser integration remain required.'},null,2));
