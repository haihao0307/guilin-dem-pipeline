import{deriveMeasuredCase,intersectCaseRay}from'../building-mother-r16/kowloon-building-mother-r01/r07/cases.mjs';
import{validateStudy}from'../knowledge-lab-r01/validate-study.mjs';
import{SurfaceRenderer}from'../warehouse-analysis-3d-r01/surface-renderer.mjs?v=3d-webgl12-20261026';
import{CpuRenderer}from'./cpu-renderer.mjs';
import{createCamera,cameraEye,cameraRay,orbit,zoom,bindGestures}from'../warehouse-analysis-3d-r01/camera.mjs';
import{STATUS_LABELS,filteredClaims}from'../warehouse-analysis-3d-r01/evidence.mjs';
const $=id=>document.getElementById(id),make=(tag,value)=>{const el=document.createElement(tag);if(value!=null)el.textContent=value;return el;};
export async function mount({signal:outerSignal}={}){const controller=new AbortController,signal=controller.signal;let renderer=null,observer=null,raf=0,stopped=false,selected='',frameCount=0,drawing=false,pending=false,requestVersion=0,presentedCamera=null;
 const cleanup=()=>{stopped=true;controller.abort();observer?.disconnect();if(raf)cancelAnimationFrame(raf);raf=0;renderer?.dispose();};
 const fail=e=>{stopped=true;renderer?.dispose();if(raf)cancelAnimationFrame(raf);raf=0;$('status').textContent='显示已停止：'+e.message+'。原画面不被遮盖；可手动重新启动。';$('retry').hidden=false;};
 const earlyStop=()=>{controller.abort();fail(new Error('已取消加载/绘制'));};
 outerSignal?.addEventListener('abort',earlyStop,{once:true,signal});
 $('stop').addEventListener('click',earlyStop,{signal});
 try{
 if(outerSignal?.aborted)throw Error('加载已取消');
 const canvas=make('canvas');canvas.id='scene';canvas.setAttribute('aria-label','可拖动旋转的仓库上部外观三维分析');canvas.tabIndex=0;$('canvasHost').replaceChildren(canvas);
 const read=async url=>{const r=await fetch(url,{signal});if(!r.ok)throw Error('资料载入失败 HTTP '+r.status);return r.json();};
 $('status').textContent='正在载入同一仓库的原函数边界和独立证据…';
 const timeout=setTimeout(()=>controller.abort(),20000);let score,raw;try{[score,raw]=await Promise.all([read('../../hk-three-buildings-r01/geometry/B369121858401063C0.score.json'),read('../knowledge-lab-r01/warehouse-study.json')]);}catch(e){throw Error(signal.aborted?'载入已取消或超过 20 秒；仅手动重试':e.message);}finally{clearTimeout(timeout);}
 const spec=deriveMeasuredCase(score),study=validateStudy(raw);let camera=createCamera(spec.bounds);
 // No hidden interior, generated design assembly, ground completion, or mesh input.
 if(spec.sourceModelId!=='B369121858401063C0'||spec.patches.length!==28||spec.counts.modelTriangles!==0)throw Error('仓库源身份或边界版本与已核记录不一致');
 $('status').textContent='正在编译单次解析外观显示…';await new Promise(requestAnimationFrame);if(signal.aborted)return cleanup;
 try{renderer=new SurfaceRenderer(canvas,spec);}catch(e){if(e.message!=='本页需要 WebGL 1 或 WebGL 2；两者均不可用，未替换为静态图。')throw e;renderer=new CpuRenderer(canvas,spec);}
 const draw=async()=>{raf=0;if(stopped)return;drawing=true;pending=false;const revision=requestVersion,frameCamera={...camera,target:[...camera.target]};try{const b=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1,width=Math.max(1,Math.round(b.width*dpr)),height=Math.max(1,Math.round(b.height*dpr));const result=await renderer.render({eye:cameraEye(frameCamera),target:frameCamera.target,fov:frameCamera.fov*Math.PI/180,selectedPatchId:selected,width,height});if(stopped||revision!==requestVersion||result?.cancelled)return;presentedCamera=frameCamera;frameCount++;$('status').textContent=(renderer.backendLabel??('WebGL '+renderer.webglVersion))+' 三维已显示 · 原 28 面 / 1 孔 · 原生像素 '+width+'×'+height+(renderer.webglVersion==='CPU'?' · CPU按需计算；拖动时保留上帧，不承诺实时帧率':' · 只绘制操作后的帧');}catch(e){if(e.name!=='AbortError'&&!stopped)fail(e);}finally{drawing=false;if(pending&&!stopped&&!raf)raf=requestAnimationFrame(draw);}};
 const request=()=>{if(stopped)return;requestVersion++;pending=true;if(drawing){renderer.cancelPending?.();return;}if(!raf)raf=requestAnimationFrame(draw);};
 const showClaims=()=>{const rows=filteredClaims(study,$('stateFilter').value,selected);$('claimCount').textContent=rows.length+' / 15 条判断；状态针对命题，不给整楼盖“已证实”印章。';$('claims').replaceChildren(...rows.map(row=>{const c=row.claim,el=make('article');el.className='claim';el.dataset.status=c.status;const badge=make('div',STATUS_LABELS[c.status]);badge.className='badge';const scope=make('p',row.text);scope.className='mapped';el.append(badge,make('h3',c.subject),make('p',c.value===null?'未知（null）：不补画真实构件':typeof c.value==='string'?c.value:JSON.stringify(c.value)),make('p',c.note),scope);if(c.alternatives?.length)el.append(make('p','其他解释：'+c.alternatives.join('；')));if(c.neededEvidence?.length)el.append(make('p','需要补证：'+c.neededEvidence.join('；')));for(const ref of c.evidenceRefs){const source=study.evidence.find(e=>e.id===ref),a=make('a',source.title+' ↗');a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';el.append(a);}el.append(make('small',c.id));return el;}));};
 const select=id=>{if(stopped)return;selected=spec.patches.some(p=>p.sourcePatchId===id)?id:'';$('face').value=selected;const p=spec.patches.find(p=>p.sourcePatchId===selected);$('faceInfo').textContent=p?selected+' · 来源边界的派生外观面（'+p.sourceKind+'）。不是材料、厚度、梁柱或基础的已确认身份。':'未选中源面。';$('mapping').textContent=selected==='p024'?'p024 有既有官方图集裁片登记。可见痕迹与显示横带规则分栏，三维尺度和构造仍未现场核实。':'当前面没有经核实的照片逐面配准；照片观察仍列为照片范围，不强行贴到这个面。';showClaims();request();};
 $('face').replaceChildren(new Option('尚未选择',''),...spec.patches.map(p=>new Option(p.sourcePatchId+' · '+p.sourceKind,p.sourcePatchId)));$('stateFilter').value='all';$('face').addEventListener('change',()=>select($('face').value),{signal});$('stateFilter').addEventListener('change',showClaims,{signal});
 bindGestures(canvas,camera,request,(x,y)=>{if(stopped)return;if(drawing||pending||raf||!presentedCamera){$('status').textContent='正在计算当前视角；请等画面更新后再点选。';return;}const b=canvas.getBoundingClientRect(),r=cameraRay(presentedCamera,(x-b.left)/b.width*2-1,1-(y-b.top)/b.height*2,b.width/b.height),hit=intersectCaseRay(spec,r.eye,r.direction);select(hit.hit?hit.sourcePatchId:'');},{signal});
 const action=(id,fn)=>$(id).addEventListener('click',()=>{if(stopped)return;fn();request();},{signal});
 action('reset',()=>{const c=createCamera(spec.bounds);Object.assign(camera,c);});action('left',()=>orbit(camera,-30,0));action('right',()=>orbit(camera,30,0));action('up',()=>orbit(camera,0,20));action('down',()=>orbit(camera,0,-20));action('in',()=>zoom(camera,.85));action('out',()=>zoom(camera,1/.85));
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();fail(new Error('图形上下文丢失'))},{signal});
 observer=new ResizeObserver(request);observer.observe(canvas);select('');return cleanup;
 }catch(e){cleanup();throw e;}
}
