/** R13 application transition contracts. Run with: node test-building-switch-view.mjs
 * Executes the actual app functions with a minimal DOM/renderer. This is not
 * browser layout or WebGL visual proof; that remains a separate browser check.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {nativeDisplaySize,displayStatus,fitBoundsCamera,projectBounds,cameraBasis} from './desktop-display.mjs';
let checks=0;
const ok=(value,message)=>{assert(value,message);checks++;};
const plain=value=>JSON.parse(JSON.stringify(value));
const equal=(a,b,message)=>{assert.deepEqual(plain(a),plain(b),message);checks++;};
class Element{
 constructor(tag='div'){this.tagName=tag;this.children=[];this.dataset={};this.style={};this.value='';this.hidden=false;this.classList={toggle:(key,value)=>{this[key]=value;}};}
 append(...children){for(const child of children){child.parentNode?.removeChild(child);this.children.push(child);child.parentNode=this;}}
 removeChild(child){this.children.splice(this.children.indexOf(child),1);child.parentNode=null;}
 insertBefore(child,before){child.parentNode?.removeChild(child);const index=this.children.indexOf(before);assert(index>=0,'Reference node must belong to the rail');this.children.splice(index,0,child);child.parentNode=this;}
 replaceChildren(...children){for(const child of [...this.children])this.removeChild(child);this.append(...children);}
 get firstChild(){return this.children[0];}
 getBoundingClientRect(){return this.rect??{width:1142,height:664};}
}
const ids=new Map(),get=id=>{if(!ids.has(id))ids.set(id,new Element());return ids.get(id);};
const names={lowrise:'lowrise',kcc:'kcc',warehouse:'warehouse'},buttons=Object.keys(names).map(id=>Object.assign(new Element('button'),{dataset:{building:id}})),views=['whole','cut','source','design'].map(view=>Object.assign(new Element('button'),{dataset:{view}}));
const article=new Element('article');article.append(get('viewport'),get('candidateStructurePanel'));get('evidencePanel').append(get('completeFloorPanel'));
const buildingBounds=[{min:[-8,0,-10],max:[8,9,10]},{min:[28,0,-12],max:[52,96,12]},{min:[85,0,-16],max:[135,35,16]}];
const fixtures={bounds:{min:[-8,0,-16],max:[135,96,16]},buildings:Object.keys(names).map((caseId,i)=>({caseId,buildingId:caseId+'-building',name:caseId,bounds:buildingBounds[i],floorCount:2,localModel:{},localSource:{patches:[]}})),model:{levels:[],graph:{nodes:[],edges:[]}},registry:[],source:{unchanged:true}};
for(const [index,b] of fixtures.buildings.entries()){
 fixtures.model.levels.push({caseId:b.caseId,id:b.caseId+'::L01',label:'L01'});
 fixtures.registry.push({objectId:index+1,caseId:b.caseId,buildingId:b.buildingId,buildingName:b.name,classKey:'floor',classIndex:0,floorId:b.caseId+'::L01',localFloorId:'L01',localObjectId:index+1,localId:b.caseId+'::object',nodeId:b.caseId+'::object',ownerId:b.buildingId,bounds:b.bounds,sourcePatchId:'p1'});
 fixtures.model.graph.nodes.push({id:b.buildingId,type:'building',label:b.name},{id:b.caseId+'::object',type:'floor',label:'L01'});
 fixtures.model.graph.edges.push({type:'ownedBy',from:b.caseId+'::object',to:b.buildingId});
}
const calls=[],panelCases=[],openingCallbacks={},testRenderer={options:{eye:[45,45,-65],target:[0,25,0],fov:Math.PI/4},displayLimits:{},requestRevision:0,hitDataComplete:true,
 async render(options){calls.push({options:structuredClone(options),camera:structuredClone(this.options)});await Promise.resolve();return{width:options.width,height:options.height,wallMs:1,cancelled:false};},
 async repaintSelection(){this.lastSelection={selectedId:this.options.selectedId};return true;}};
const context=vm.createContext({window:{},document:{getElementById:get,createElement:tag=>new Element(tag),querySelectorAll:selector=>selector==='[data-building]'?buttons:selector==='[data-view]'?views:[],visibilityState:'visible'},location:{search:''},devicePixelRatio:1,console,structuredClone,performance,URLSearchParams,requestAnimationFrame:fn=>fn(),readInspectionDimensions:()=>({}),showCoverage:()=>{},showUsage:()=>{},showOpeningEvidence:(element,building,onSelect)=>{openingCallbacks[building.caseId]=onSelect;},nativeDisplaySize,displayStatus,fitBoundsCamera,projectBounds,cameraBasis,BUILDING_ORDER:Object.keys(names),BUILDING_NAMES:names,CLASSES:[{key:'floor',label:'floor'}],localPoint:()=>{},fixtures,testRenderer,panelCases});
// Leave every tested production function unchanged. Remove imports and only the
// final bootstrap call, so the fixture can own I/O without creating a browser.
const app=fs.readFileSync(new URL('./semantic-app.mjs',import.meta.url),'utf8');
const source=app.replace(/^import .*;\n/gm,'').replace(/boot\(\)\.catch\(fail\);\s*$/,'');
vm.runInContext(source,context,{filename:'semantic-app.mjs'});
const run=code=>vm.runInContext(code,context);
run(`scene=fixtures;renderer=testRenderer;state.renderer=renderer;state.caseId=caseId;showEvidence=(record=null)=>{state.evidenceRecord=record;};
roomDoorRuntime={selectBuilding:q=>panelCases.push(['room',q.caseId]),beforeFrame:()=>0,afterFrame:()=>{}};
liftPanel={selectCase:id=>panelCases.push(['lift',id])};floorPanel={selectCase:id=>panelCases.push(['floor',id]),refresh:()=>{}};
observedPanel={selectCase:id=>panelCases.push(['observed',id])};candidateViewer={selectCase:id=>{$('candidateStructurePanel').hidden=id!=='kcc';panelCases.push(['candidate',id]);}};`);
const settle=async()=>{for(let n=0;n<20&&run('busy');n++)await new Promise(resolve=>setImmediate(resolve));ok(!run('busy'),'Coalesced application render settles');equal(run('state.errors'),[],'No application exception');};
const floorMode=()=>run(`view='floor';state.view=view;floorView={visibleFloorIds:['lowrise::L01']};state.floorInspection={sourceHidden:true,kind:'floor'};state.routePose={progress:.3};state.liftRidePose={followCar:true};liftFollow=true;renderer.options.cut=true;renderer.options.sliceY=[0,1.35];renderer.options.clipNormal=[1,0,0];renderer.options.clipOffset=17;renderer.options.source=false;renderer.options.design=true;state.cameraFraming='floor';state.fit=null;`);
const assertFitted=id=>{const projected=run(`projectBounds(scene.buildings.find(b=>b.caseId==='${id}').bounds,renderer.options,displaySize().aspect)`);ok(projected.minDepth>0&&Math.min(projected.minX,projected.minY)>=-.880001&&Math.max(projected.maxX,projected.maxY)<=.880001,id+' selected bounds fit completely with margin');ok(Math.max(projected.maxX-projected.minX,projected.maxY-projected.minY)>1.35,id+' fills a useful portion of the viewport');};
const assertWhole=id=>{equal(run('[caseId,state.view,view,floorView,liftFollow,state.floorInspection,state.routePose,state.liftRidePose]'),[id,'whole','whole',null,false,null,null,null],'Building switch clears every scoped-view state');equal(run('[renderer.options.cut,renderer.options.sliceY,renderer.options.clipNormal,renderer.options.clipOffset,renderer.options.source,renderer.options.design]'),[false,null,[0,0,1],0,true,true],'Building switch restores source and clears clipping');const call=calls.at(-1).options;equal([call.source,call.design,call.clipDesign,call.visibleFloorIds],[true,true,false,null],'Actual render receives whole-scene visibility');equal(run('state.fit.bounds'),fixtures.buildings.find(b=>b.caseId===id).bounds,'Camera fit targets selected building, not old floor or scene');assertFitted(id);};
run('placeCandidatePanel()');ok(get('candidateStructurePanel').parentNode===get('evidencePanel'),'Candidate panel is in independently scrollable evidence rail');ok(!article.children.includes(get('candidateStructurePanel')),'Candidate expansion is outside scene flex column');
const css=fs.readFileSync(new URL('./semantic-style.css',import.meta.url),'utf8');ok(css.includes('#viewport{flex:1 0 280px;min-width:0;min-height:280px}'),'Main viewport has a non-shrinking usable desktop minimum');ok(css.includes('article{min-height:0;overflow:auto}'),'Constrained article scrolls instead of cutting controls off');ok(css.includes('#candidateStructurePanel [hidden]{display:none!important}'),'Hidden candidate content cannot override hidden layout');
run("selectBuilding('lowrise')");await run('showComplete()');equal(run('state.fit.bounds'),fixtures.bounds,'Initial three-building overview remains available');
floorMode();run("selectBuilding('kcc')");await settle();assertWhole('kcc');ok(!get('candidateStructurePanel').hidden,'KCC still exposes its independent candidate');
const originalScene=JSON.stringify(fixtures);
for(const id of ['warehouse','lowrise','kcc','warehouse','kcc']){floorMode();run(`selectBuilding('${id}')`);await settle();assertWhole(id);}
equal(JSON.parse(JSON.stringify(fixtures)),JSON.parse(originalScene),'Switching never mutates source geometry, model, registry, or building bounds');
// A normal pick within the same building must not refit, change mode, or retrace.
run("state.cameraFraming='manual';state.fit=null;renderer.options.eye=[51,30,-55];renderer.options.target=[39,22,0]");const beforePick=plain(run('renderer.options')),countBeforePick=calls.length;
run('inspect(2)');await settle();equal(run('renderer.options.eye'),beforePick.eye,'Same-building pick keeps manual eye');equal(run('renderer.options.target'),beforePick.target,'Same-building pick keeps manual target');equal(calls.length,countBeforePick,'Same-building selection only repaints existing hit data');equal(run('[state.selected.objectId,renderer.options.selectedId,state.evidenceRecord.objectId]'),[2,2,2],'Same-building object/evidence/selection identities agree');
// Selecting an object in another building changes ownership and context without
// losing the requested object to the building-tab selection reset.
floorMode();run('inspect(3)');await settle();assertWhole('warehouse');equal(run('[state.selected.objectId,renderer.options.selectedId,state.evidenceRecord.objectId]'),[3,3,3],'Cross-building inspect retains exactly the picked object');equal(run('state.selectedOwnership.path.map(n=>n.id)'),['warehouse-building','warehouse::object'],'Cross-building ownership chain remains intact');
const beforeRepeatedTab=plain(run('renderer.options')),countBeforeRepeatedTab=calls.length;run("selectBuilding('warehouse')");await settle();equal(run('renderer.options.eye'),beforeRepeatedTab.eye,'Repeated current-building tab does not refit');equal(calls.length,countBeforeRepeatedTab,'Repeated current-building tab does not retrace');
// Focus control must also recover a scoped floor/walk camera on the same case.
floorMode();await run('focusBuilding()');assertWhole('warehouse');
for(const rect of [{width:1142,height:664},{width:720,height:720},{width:366,height:456}]){get('viewport').rect=rect;await run('render()');assertFitted('warehouse');equal(run('state.fit.aspect'),rect.width/rect.height,'Automatic selected-building fit follows resized aspect');}
run("state.cameraFraming='manual';state.fit=null");const manual=plain(run('renderer.options'));get('viewport').rect={width:1000,height:400};await run('render()');equal(run('renderer.options.eye'),manual.eye,'Resizing does not override manually positioned eye');equal(run('renderer.options.target'),manual.target,'Resizing does not override manually positioned target');
// Rapid navigation while one frame is in flight presents the latest choice.
run("selectBuilding('lowrise');selectBuilding('kcc');selectBuilding('warehouse')");await settle();assertWhole('warehouse');ok(run('state.coalescedRequests')>=2,'Rapid building switches use latest-pose coalescing');
floorMode();await run('showComplete()');equal(run('[state.view,floorView,renderer.options.sliceY,state.floorInspection]'),['whole',null,null,null],'Three-building reset clears stale floor visibility');equal(run('state.fit.bounds'),fixtures.bounds,'Three-building reset restores scene fit');
// Evidence-row focus restores source context without changing generic inspect behavior.
run("selectBuilding('lowrise')");await settle();floorMode();openingCallbacks.lowrise('p1');await settle();
equal(run('[state.view,renderer.options.sliceY,state.floorInspection,state.cameraFraming,state.selected.objectId]'),['whole',null,null,'component',1],'Opening evidence focus exits stale floor clipping and retains the requested source face');
// Bind labels against the real lowrise build, not invented screen coordinates.
const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url),'utf8'));
const {growBuilding}=await import('./building-mother.mjs');
const {deriveMeasuredCase}=await import('./kowloon-building-mother-r01/r07/cases.mjs');
const {controllerFor}=await import('./kowloon-building-mother-r01/whole-building-ground-r01/controller.mjs');
const {deriveCaseIntegration}=await import('./kowloon-building-mother-r01/whole-building-facade-r01/host-integration.mjs');
const {lowriseLevelRevision}=await import('./lowrise-level-revision.mjs');
const measured=deriveMeasuredCase(read('./hk-three-buildings-r01/geometry/B367642137201063C0.score.json')),official=read('./kowloon-building-mother-r01/r07/sources/official-footprints.json'),openingEvidence=read('./evidence/lowrise-opening-proposal.json'),controller=controllerFor('lowrise'),whole=controller.derive(measured,official,lowriseLevelRevision(measured,official,openingEvidence).parameters),integrated=deriveCaseIntegration('lowrise',whole,measured,official,{doorOpenT:1}),model=growBuilding({caseId:'lowrise',source:measured,model:integrated.model,openingEvidence}).model;
const modelBeforeLabels=JSON.stringify(model),translation=[17,3,-12];context.realBuilding={caseId:'lowrise',localModel:model,transform:{translation}};
const openingLabels=plain(run('observedOpeningLabels(realBuilding)'));
equal(openingLabels.filter(r=>r.kind==='north-window').map(r=>r.observationId),['N-U01','N-U02','N-U03'],'North labels use the three real observation IDs');
equal(openingLabels.filter(r=>r.kind==='east-glazed-group').map(r=>r.observationId),['F-E04-01','F-E04-02','F-E04-03','F-E04-04'],'East labels bind the four outer groups, not individual panes');
for(const label of openingLabels){const aperture=model.hostedComponents.apertures.find(a=>(a.observationId??a.observationGroup)===label.observationId);equal(label.worldCenter,aperture.bounds.min.map((v,k)=>(v+aperture.bounds.max[k])/2+translation[k]),'Label '+label.observationId+' anchors the retained aperture bounds plus world translation');}
ok(openingLabels.filter(r=>r.kind==='east-glazed-group').every(r=>r.label.startsWith('东玻璃组 ')&&!r.label.includes('窗')),'Eastern unknown window/door type is not mislabeled as a window');equal(JSON.stringify(model),modelBeforeLabels,'Evidence labels never mutate model geometry');
equal(run("observedOpeningLabels({...realBuilding,caseId:'kcc'})"),[],'Unknown KCC facade does not get invented window or no-window labels');
context.realLabels=openingLabels;
// Camera-space filtering uses the current completed frame, including slice and facing.
run("scene.buildings[0].localModel=realBuilding.localModel;scene.buildings[0].transform=realBuilding.transform;caseId='lowrise';state.presentedDisplay=displaySize();state.presentedCamera={eye:[17,11,-50],target:[17,8,-12],fov:Math.PI/3,sliceY:null};updateLabels()");
ok(run('state.openingLabels.length')===7,'Seven retained identities are available to screen projection');
ok(run("state.openingLabels.some(r=>r.kind==='north-window'&&r.visible)"),'Facing observed north apertures receive visible screen labels');
ok(run("state.openingLabels.filter(r=>r.kind==='east-glazed-group').every(r=>!r.visible)"),'Back-facing glazed groups do not label through the building');
run('state.presentedCamera.sliceY=[0,1];updateLabels()');ok(run('state.openingLabels.every(r=>!r.visible)'),'A clipped-away observed aperture does not get a floating label');
run("caseId='warehouse';updateLabels()");equal(run('state.openingLabels'),[],'Window overlays disappear when another building is selected');
ok(css.includes('pointer-events:none')&&css.includes('.opening-marker{'),'Opening evidence overlay cannot intercept scene picking');
console.log(`${checks} building-switch/camera/opening-label/DOM contracts passed. Browser layout/WebGL proof not claimed.`);
