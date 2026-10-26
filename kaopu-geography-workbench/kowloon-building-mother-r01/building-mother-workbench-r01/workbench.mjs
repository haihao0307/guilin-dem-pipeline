import {growSketch} from '../building-rule-sketch-r06/sketch-model.mjs';
import {fitBoundsCamera,nativeDisplaySize} from '../building-rule-sketch-r06/desktop-display.mjs';
import {attachCameraControls} from '../building-rule-sketch-r06/kowloon-building-mother-r01/whole-building-ground-r01/camera-controls.mjs';
import {StudioRenderer} from './studio-renderer.mjs';
const $=s=>document.querySelector(s),canvas=$('#view');
const params={caseId:'cell',stage:7,storeys:1,groundHeight:3.6,typicalHeight:3,roofVisible:false};
const labels=['','基础','地梁','柱','梁','楼板 / 屋顶','通行关系','围护与门窗位置'];
const state=window.buildingMotherWorkbench={version:'WORKBENCH-R01',ready:false,busy:false,errors:[],frames:[],params,implementation:'shared-R06-cell-not-new-core'};
let renderer=null,result=null,modelDirty=true,fit=true,queued=false,cut=false,stopped=false;
function fail(error){stopped=true;state.ready=false;state.errors.push(String(error.stack??error));$('#notice').hidden=false;$('#notice').textContent='三维显示尚未启动\n'+error.message+'\n当前浏览器需要支持 WebGL2 浮点缓冲。没有用静态图片替代模型。';$('#status').textContent='交付检查：三维运行未通过，请保留此错误信息。';}
function request(){if(stopped)return;queued=true;if(!state.busy)render();}
async function render(){if(stopped||state.busy)return;state.busy=true;try{do{queued=false;
 if(modelDirty){result=growSketch(params);state.result=result;state.model=result.model;state.checks=result.checks;modelDirty=false;if(!result.checks.passed)throw Error(result.checks.failures.join('; '));}
 if(!renderer){renderer=new StudioRenderer(canvas);state.renderer=renderer;attachCameraControls(canvas,{getCamera:()=>structuredClone(renderer.options),setCamera:c=>{Object.assign(renderer.options,c);fit=false;},onChange:request,onEnd:request});}
 if(renderer.model!==result.model)renderer.setModel(result.model,result.source);
 const rect=canvas.getBoundingClientRect(),size=nativeDisplaySize({cssWidth:rect.width,cssHeight:rect.height,dpr:devicePixelRatio||1,limits:renderer.displayLimits});if(size.hidden)continue;
 if(fit){const c=fitBoundsCamera(result.model.bounds,{aspect:size.aspect,direction:[1,.72,-1.3],margin:.87});Object.assign(renderer.options,{eye:c.eye,target:c.target,fov:c.fov});fit=false;}
 Object.assign(renderer.options,{source:false,design:true,cut,clipNormal:[0,0,1],clipOffset:1.4,sliceY:null});
 $('#status').textContent='正在绘制共享函数生成的单层实例…';
 const frame=await renderer.render({width:size.width,height:size.height,presentWidth:size.width,presentHeight:size.height,tileSize:96,gpuBatchTiles:8,source:false,design:true,requestRevision:++renderer.requestRevision});
 if(!frame.cancelled){state.ready=true;state.frames.push(frame);state.frames=state.frames.slice(-20);$('#status').textContent=`1 开间 · 1 层 · ${result.counts.primitives} 个解析实体 · ${size.width} × ${size.height} · ${Math.round(frame.wallMs)} ms / 本帧`;}
 }while(queued&&!stopped);}catch(e){fail(e);}finally{state.busy=false;}}
function rebuild(refit=false){modelDirty=true;fit=fit||refit;request();}
$('#stage').addEventListener('input',e=>$('#stageLabel').textContent=`${e.target.value} · ${labels[e.target.value]}`);
$('#stage').addEventListener('change',e=>{params.stage=Number(e.target.value);rebuild();});
$('#height').addEventListener('change',e=>{const v=Number(e.target.value);if(!Number.isFinite(v)||v<2.6||v>5){e.target.value=params.groundHeight;return;}params.groundHeight=v;rebuild(true);});
$('#fit').onclick=()=>{fit=true;request();};
$('#roof').onclick=()=>{params.roofVisible=!params.roofVisible;$('#roof').setAttribute('aria-pressed',String(params.roofVisible));$('#roof').textContent=params.roofVisible?'隐藏屋顶':'显示屋顶';rebuild();};
$('#cut').onclick=()=>{cut=!cut;$('#cut').setAttribute('aria-pressed',String(cut));request();};
$('#top').onclick=()=>{if(!renderer||!result)return;const b=result.model.bounds,center=b.min.map((v,i)=>(v+b.max[i])/2),span=Math.max(b.max[0]-b.min[0],b.max[2]-b.min[2]);Object.assign(renderer.options,{target:center,eye:[center[0],b.max[1]+span*1.8,center[2]-.01]});fit=false;request();};
let down=null;canvas.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);canvas.addEventListener('pointerup',e=>{if(!down||!state.ready||state.busy||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;try{const r=canvas.getBoundingClientRect(),hit=renderer.readHit(Math.floor((e.clientX-r.left)*canvas.width/r.width),Math.floor((r.bottom-e.clientY)*canvas.height/r.height)),record=renderer.semanticRegistry.find(n=>Math.abs(n.objectId-hit.objectId)<.1);if(!record)return;const id=record.nodeId,g=result.model.graph,n=g.nodes.find(n=>n.id===id),names={ownedBy:'属于',supportedBy:'支承于',dependsOn:'生成依赖',hostedBy:'宿主',voids:'开口关系',fills:'填充',partOf:'部件属于',boundsRoom:'围合空间',opensBetween:'连接空间'};$('#selection').textContent=[record.classKey,n?.label??id,...g.edges.filter(e=>e.from===id).slice(0,10).map(e=>(names[e.type]??e.type)+'：'+(g.nodes.find(x=>x.id===e.to)?.label??e.to))].join('\n');renderer.options.selectedId=hit.objectId;request();}catch(e){fail(e);}});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fail(Error('图形上下文已丢失；请手动刷新。页面不会自动反复重载。'));});
let resizeFrame=null;window.addEventListener('resize',()=>{if(resizeFrame!==null)cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{resizeFrame=null;fit=true;request();});});
request();
