import{constructionPlan,constructionView}from'./construction.mjs';
import{SEMANTIC_COLORS}from'../../building-mother-workbench-r05/semantic-colors.mjs';
import {componentLabels as prismLabels,drawLabels} from '../../building-mother-workbench-r02/component-labels.mjs';
import {fitBoundsCamera,nativeDisplaySize} from '../../building-rule-sketch-r06/desktop-display.mjs';
import {attachCameraControls} from '../../building-rule-sketch-r06/kowloon-building-mother-r01/whole-building-ground-r01/camera-controls.mjs';
export function mountWorkbench({growBuilding,StudioRenderer,instance,version,roofToggle=true}){
function componentLabels(model,{cut=false}={}){const all=prismLabels(model).concat((model.roundMembers??[]).map(p=>({id:p.nodeId,label:p.componentLabel,bounds:p.bounds,point:p.bounds.min.map((v,k)=>(v+p.bounds.max[k])/2)})));all.forEach((r,i)=>r.number=i+1);return cut?all.filter(r=>r.bounds.max[2]>1.4).map(r=>({...r,point:[r.point[0],r.point[1],(Math.max(r.bounds.min[2],1.4)+r.bounds.max[2])/2]})):all;}
const $=s=>document.querySelector(s),canvas=$('#view');
const params={...instance};
$('#colorLegend').replaceChildren(...SEMANTIC_COLORS.map(c=>{const item=document.createElement('span'),chip=document.createElement('i');chip.style.backgroundColor=c.color;chip.setAttribute('aria-hidden','true');item.append(chip,document.createTextNode(c.label));return item;}));

const state=window.buildingMotherWorkbench={version,ready:false,busy:false,errors:[],frames:[],params,implementation:'one-standard-layer-pure-functions'};
let semanticColors=false,fullResult=null,plan=null,progress=0,playing=false,timer=null,viewDirty=true;
let labelsOn=false,routeMode=false;let renderer=null,result=null,modelDirty=true,fit=true,queued=false,cut=false,stopped=false;
function fail(error){pause();stopped=true;state.ready=false;state.errors.push(String(error.stack??error));$('#notice').hidden=false;$('#notice').textContent='三维显示尚未启动\n'+error.message+'\n当前浏览器需要支持 WebGL2 浮点缓冲。没有用静态图片替代模型。';$('#status').textContent='交付检查：三维运行未通过，请保留此错误信息。';}
function request(){if(stopped)return;queued=true;if(!state.busy)render();}
async function render(){if(stopped||state.busy)return;state.busy=true;try{do{queued=false;
 if(modelDirty){fullResult=growBuilding({...params,stage:7});state.generationCount=(state.generationCount??0)+1;plan=constructionPlan(fullResult);progress=plan.steps.length-1;viewDirty=true;modelDirty=false;if(!fullResult.checks.passed)throw Error(fullResult.checks.failures.join('; '));}
 if(viewDirty){result={...fullResult,model:constructionView(fullResult,plan,progress)};viewDirty=false;state.result=result;state.model=result.model;state.checks=result.checks;state.construction={index:progress,total:plan.steps.length,label:plan.steps[progress].label,playing};$('#stage').min=0;$('#stage').max=plan.steps.length-1;$('#stage').value=progress;$('#stageLabel').textContent=`${progress+1} / ${plan.steps.length} · ${plan.steps[progress].label}`;$('#foundationInfo').textContent=`基础埋深示意 ${(-fullResult.parameters.foundationBottom).toFixed(2)} m = 0.8 + 0.05 × (层数−1) × 层高。仅教学联动；未知土质、荷载与结构类型，不是工程设计值。基础按目标整楼一次生成。`;}

 if(!renderer){renderer=new StudioRenderer(canvas);state.renderer=renderer;renderer.colorMode=semanticColors;attachCameraControls(canvas,{getCamera:()=>structuredClone(renderer.options),setCamera:c=>{Object.assign(renderer.options,c);fit=false;},onChange:request,onEnd:request});}
 if(renderer.model!==result.model)renderer.setModel(result.model,result.source);
 if(renderer.colorMode!==semanticColors)renderer.setColorMode(semanticColors);
 const rect=canvas.getBoundingClientRect(),size=nativeDisplaySize({cssWidth:rect.width,cssHeight:rect.height,dpr:devicePixelRatio||1,limits:renderer.displayLimits});if(size.hidden)continue;
 if(fit){const c=fitBoundsCamera(result.model.bounds,{aspect:size.aspect,direction:[1,.72,-1.3],margin:.87});Object.assign(renderer.options,{eye:c.eye,target:c.target,fov:c.fov});fit=false;}
 Object.assign(renderer.options,{source:false,design:true,cut,clipNormal:[0,0,1],clipOffset:1.4,sliceY:null});
 $('#status').textContent=`正在绘制共享函数生成的 ${params.floors} 层实例…`;
 const frame=await renderer.render({width:size.width,height:size.height,presentWidth:size.width,presentHeight:size.height,tileSize:96,gpuBatchTiles:8,source:false,design:true,clipDesign:cut,requestRevision:++renderer.requestRevision});
 if(stopped)return;
 if(!frame.cancelled){state.ready=true;updateLabels();state.frames.push(frame);state.frames=state.frames.slice(-20);$('#status').textContent=`1 开间 · ${params.floors} 层 · ${result.counts.stairConnections} 段层间梯 · ${result.model.archetypes.reduce((n,a)=>n+a.primitives.length,0)+(result.model.roundMembers?.length??0)} 个当前解析实体 · ${size.width} × ${size.height} · ${Math.round(frame.wallMs)} ms / 本帧`;}
 }while(queued&&!stopped);}catch(e){fail(e);}finally{state.busy=false;}}
function rebuild(refit=false){pause();modelDirty=true;fit=fit||refit;request();}
function pause(){playing=false;clearTimeout(timer);timer=null;$('#play').textContent='播放生长';if(state.construction)state.construction.playing=false;}
function advance(){if(!playing||stopped)return;if(state.busy){timer=setTimeout(advance,100);return;}if(progress>=plan.steps.length-1){pause();return;}progress++;viewDirty=true;request();timer=setTimeout(advance,650);}
function play(){if(!plan||stopped)return;playing=true;$('#play').textContent='暂停生长';if(state.construction)state.construction.playing=true;timer=setTimeout(advance,650);}
$('#play').onclick=()=>{if(playing){pause();return;}if(plan&&progress>=plan.steps.length-1){progress=0;viewDirty=true;request();}play();};
$('#replay').onclick=()=>{pause();if(!plan)return;progress=0;viewDirty=true;request();play();};
$('#stage').addEventListener('input',e=>{pause();if(!plan)return;progress=Math.max(0,Math.min(plan.steps.length-1,Number(e.target.value)));viewDirty=true;request();});
$('#height').addEventListener('change',e=>{const v=Number(e.target.value);if(!Number.isFinite(v)||v<3||v>4.2){e.target.value=params.storeyHeight;return;}params.storeyHeight=v;rebuild(true);});
function updateLabels(routeOnly=routeMode){if(!renderer||!result)return;const labels=componentLabels(result.model);state.componentLabels=labels;$('#labels').hidden=!labelsOn;if(labelsOn){const r=canvas.getBoundingClientRect();const routeLabels=(progress===plan.steps.length-1?result.transitions:[]).flatMap((t,i)=>[{id:t.id+':entry',number:'入',label:(i+1)+'层入口',point:t.entrance},{id:t.id+':exit',number:'出',label:result.claims.roofAccess&&i===result.transitions.length-1?'屋顶出口':(i+2)+'层出口',point:t.exit}]);drawLabels($('#labels'),routeOnly?routeLabels:componentLabels(result.model,{cut}),renderer.options,r.width,r.height);}$('#floorCount').textContent=params.floors;$('#columnCount').textContent=result.counts.frameColumns;$('#routeInfo').textContent=result.transitions.length?result.transitions.map(t=>`入口 ${t.entrance.map(n=>n.toFixed(3)).join(', ')} → 平台 → 出口 ${t.exit.map(n=>n.toFixed(3)).join(', ')}；每跑 ${t.stepsPerFlight} 级，步高 ${(t.stepRise*1000).toFixed(0)} mm，踏面 ${(t.tread*1000).toFixed(0)} mm。`).join('\n'):'一层：没有层间楼梯。';$('#componentList').replaceChildren(...labels.map((r,i)=>{const li=document.createElement('li');li.textContent=(i+1)+' '+r.label;li.title=r.id;return li;}));}
$('#colors').onclick=()=>{semanticColors=!semanticColors;$('#colors').setAttribute('aria-pressed',String(semanticColors));$('#colors').textContent=semanticColors?'恢复实体原色':'显示构件分色';$('#colorLegend').hidden=!semanticColors;request();};
$('#names').onclick=()=>{const fromRoute=routeMode;routeMode=false;labelsOn=fromRoute?true:!labelsOn;$('#names').setAttribute('aria-pressed',String(labelsOn));$('#names').textContent=labelsOn?'隐藏全部名称':'显示全部名称';updateLabels();};
$('#floors').onchange=e=>{params.floors=Number(e.target.value);rebuild(true);};
$('#noise').onchange=e=>{params.railNoiseAmplitude=Number(e.target.value)/1000;rebuild();};
$('#route').onclick=()=>{routeMode=true;labelsOn=true;$('#names').setAttribute('aria-pressed','false');$('#names').textContent='显示全部名称';updateLabels(true);};
$('#fit').onclick=()=>{fit=true;request();};
$('#roof').hidden=!roofToggle;$('#roof').onclick=()=>{if(!roofToggle)return;params.roofVisible=!params.roofVisible;$('#roof').setAttribute('aria-pressed',String(params.roofVisible));$('#roof').textContent=params.roofVisible?'隐藏屋顶':'显示屋顶';rebuild();};
$('#cut').onclick=()=>{cut=!cut;$('#cut').setAttribute('aria-pressed',String(cut));request();};
$('#top').onclick=()=>{if(!renderer||!result)return;const b=result.model.bounds,center=b.min.map((v,i)=>(v+b.max[i])/2),span=Math.max(b.max[0]-b.min[0],b.max[2]-b.min[2]);Object.assign(renderer.options,{target:center,eye:[center[0],b.max[1]+span*1.8,center[2]-.01]});fit=false;request();};
let down=null;canvas.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);canvas.addEventListener('pointerup',e=>{if(!down||!state.ready||state.busy||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;try{const r=canvas.getBoundingClientRect(),hit=renderer.readHit(Math.floor((e.clientX-r.left)*canvas.width/r.width),Math.floor((r.bottom-e.clientY)*canvas.height/r.height)),record=renderer.semanticRegistry.find(n=>Math.abs(n.objectId-hit.objectId)<.1);if(!record)return;const id=record.nodeId,g=result.model.graph,n=g.nodes.find(n=>n.id===id),names={ownedBy:'属于',supportedBy:'支承于',dependsOn:'生成依赖',hostedBy:'宿主',voids:'开口关系',fills:'填充',partOf:'部件属于',boundsRoom:'围合空间',opensBetween:'连接空间'};$('#selection').textContent=[record.classKey,n?.label??id,...g.edges.filter(e=>e.from===id).slice(0,10).map(e=>(names[e.type]??e.type)+'：'+(g.nodes.find(x=>x.id===e.to)?.label??e.to))].join('\n');renderer.options.selectedId=hit.objectId;request();}catch(e){fail(e);}});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fail(Error('图形上下文已丢失；请手动刷新。页面不会自动反复重载。'));});
let resizeFrame=null;window.addEventListener('resize',()=>{if(resizeFrame!==null)cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{resizeFrame=null;fit=true;request();});});
request();
}
