// Shared controller: changing view never calls seek()/stop().
let inspect={yaw:0,pitch:0,pan:[0,0],zoom:1,depth:0,light:0,warm:1,cool:.65,blend:.65};
const zoomSteps=[1,2,5,10,20,50,100],pointers=new Map();let gesture=null;
function rotationMatrix(){
 const a=inspect.yaw,b=inspect.pitch,c=Math.cos(a),s=Math.sin(a),v=Math.cos(b),w=Math.sin(b);
 return new Float32Array([c,0,-s,s*w,v,c*w,s*v,-w,c*v]);
}
function isInspect(){return inspect.yaw!==0||inspect.pitch!==0||inspect.zoom!==1||inspect.pan.some(x=>x!==0)||inspect.depth!==0||inspect.light!==0}
function inspectChanged(){
 S.inspection={...inspect,pan:inspect.pan.slice()};S.viewRevision=(S.viewRevision||0)+1;
 $('zoomNow').textContent=inspect.zoom.toFixed(inspect.zoom<10?1:0)+'×';
 $('zoomPreset').value=zoomSteps.includes(inspect.zoom)?String(inspect.zoom):'custom';
 $('depth').value=inspect.depth;$('depthNow').textContent=inspect.depth.toFixed(2);
 $('lightingMode').value=String(inspect.light);$('warmPower').value=inspect.warm;$('coolPower').value=inspect.cool;$('lightBlend').value=inspect.blend;
 $('angleNow').textContent=Math.round(inspect.yaw*180/Math.PI)+'° / '+Math.round(inspect.pitch*180/Math.PI)+'°';
 request();
}
function setZoom(z,ax=0,ay=0){
 const next=Math.max(.5,Math.min(100,Number(z)||1));
 inspect.pan[0]+=ax/inspect.zoom-ax/next;inspect.pan[1]+=ay/inspect.zoom-ay/next;
 inspect.zoom=next;inspectChanged();
}
function setInspection(x){
 if(x.yaw!==undefined)inspect.yaw=Number(x.yaw)||0;
 if(x.pitch!==undefined)inspect.pitch=Math.max(-Math.PI*.49,Math.min(Math.PI*.49,Number(x.pitch)||0));
 if(x.zoom!==undefined)inspect.zoom=Math.max(.5,Math.min(100,Number(x.zoom)||1));
 if(x.depth!==undefined)inspect.depth=Math.max(0,Math.min(12,Number(x.depth)||0));
 if(Array.isArray(x.pan)&&x.pan.length===2&&x.pan.every(Number.isFinite))inspect.pan=x.pan.slice();
 if(x.light!==undefined)inspect.light=[0,1,2].includes(Number(x.light))?Number(x.light):0;
 for(const k of ['warm','cool','blend'])if(x[k]!==undefined)inspect[k]=Math.max(0,Math.min(k==='blend'?1:2,Number(x[k])||0));
 inspectChanged();
}
function resetView(){inspect.yaw=inspect.pitch=inspect.depth=0;inspect.pan=[0,0];inspect.zoom=1;inspectChanged()}
function resetInspection(){resetView();inspect.light=0;inspect.warm=1;inspect.cool=.65;inspect.blend=.65;inspectChanged()}
function screenPoint(e){const r=$('studentCanvas').getBoundingClientRect();return[4*(e.clientX-r.left-r.width*.5)/r.height,-4*(e.clientY-r.top-r.height*.5)/r.height]}
const surface=$('studentCanvas');surface.style.touchAction='none';surface.style.cursor='grab';
surface.addEventListener('contextmenu',e=>e.preventDefault());
surface.addEventListener('pointerdown',e=>{if(e.button!==0&&e.button!==1&&e.button!==2)return;e.preventDefault();surface.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});gesture=null;surface.style.cursor='grabbing'});
surface.addEventListener('pointermove',e=>{
 if(!pointers.has(e.pointerId))return;const old=pointers.get(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const r=surface.getBoundingClientRect();
 if(pointers.size>=2){const [a,b]=[...pointers.values()],mid=[(a.x+b.x)/2,(a.y+b.y)/2],dist=Math.hypot(a.x-b.x,a.y-b.y);
  if(gesture){const [x,y]=screenPoint({clientX:mid[0],clientY:mid[1]});setZoom(inspect.zoom*dist/Math.max(1,gesture.dist),x,y);inspect.pan[0]-=4*(mid[0]-gesture.mid[0])/(r.height*inspect.zoom);inspect.pan[1]+=4*(mid[1]-gesture.mid[1])/(r.height*inspect.zoom);inspectChanged()}
  gesture={mid,dist};return;
 }
 const dx=e.clientX-old.x,dy=e.clientY-old.y;
 if(e.shiftKey||e.buttons===2||e.buttons===4){inspect.pan[0]-=4*dx/(r.height*inspect.zoom);inspect.pan[1]+=4*dy/(r.height*inspect.zoom)}
 else{inspect.yaw+=dx*.008/Math.sqrt(inspect.zoom);inspect.pitch=Math.max(-1.539,Math.min(1.539,inspect.pitch+dy*.008/Math.sqrt(inspect.zoom)))}
 inspectChanged();
});
function endPointer(e){pointers.delete(e.pointerId);gesture=null;if(!pointers.size)surface.style.cursor='grab'}
for(const n of ['pointerup','pointercancel','lostpointercapture'])surface.addEventListener(n,endPointer);
surface.addEventListener('wheel',e=>{e.preventDefault();const [x,y]=screenPoint(e);setZoom(inspect.zoom*Math.exp(-Math.max(-100,Math.min(100,e.deltaY))*.003),x,y)},{passive:false});
surface.addEventListener('dblclick',e=>{e.preventDefault();const [x,y]=screenPoint(e);inspect.pan[0]+=x/inspect.zoom;inspect.pan[1]+=y/inspect.zoom;setZoom(inspect.zoom*2)});
$('zoomPreset').onchange=()=>{if($('zoomPreset').value!=='custom')setZoom(Number($('zoomPreset').value))};
$('zoomIn').onclick=()=>setZoom(zoomSteps.find(z=>z>inspect.zoom)||100);
$('zoomOut').onclick=()=>setZoom([...zoomSteps].reverse().find(z=>z<inspect.zoom)||.5);
$('cameraReset').onclick=resetView;$('baselineReset').onclick=resetInspection;
$('depth').oninput=()=>setInspection({depth:Number($('depth').value)});
$('lightingMode').onchange=()=>setInspection({light:Number($('lightingMode').value)});
for(const [id,key]of [['warmPower','warm'],['coolPower','cool'],['lightBlend','blend']])$(id).oninput=()=>setInspection({[key]:Number($(id).value)});
$('viewSettings').onclick=()=>{const d=$('inspectionSettings');d.open=!d.open;if(d.open)d.scrollIntoView({block:'nearest'})};
$('branchStudy').onclick=()=>{const d=$('branchKnowledge');d.open=!d.open;if(d.open)d.scrollIntoView({block:'start',behavior:'smooth'})};
