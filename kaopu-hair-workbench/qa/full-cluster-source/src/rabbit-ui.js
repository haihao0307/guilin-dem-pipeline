/* Compact rabbit studio: UI/input/display adapters only. SEDDI modules and assets are unchanged. */
(function(){'use strict';
const $=id=>document.getElementById(id),header=document.querySelector('header');
const toolbar=document.createElement('div');toolbar.id='rabbitToolbar';toolbar.innerHTML='<div class="studio-title"><strong>兔子工作台</strong><small>毛发细调 · 实时 3D</small></div><div class="studio-nav"><button id="rabbitControlsToggle" aria-haspopup="dialog">调整</button><button id="rabbitTeacherToggle" aria-haspopup="dialog">老师</button><button id="rabbitBack">海葵</button></div>';header.append(toolbar);
function drawer(id,title){const d=document.createElement('dialog');d.id=id;d.className='studio-drawer rabbit-drawer';d.setAttribute('aria-label',title);d.innerHTML='<div class="drawer-head"><strong>'+title+'</strong><button id="'+id.replace('Drawer','Close')+'" aria-label="关闭'+title+'">关闭 ×</button></div><div class="drawer-content"></div>';document.body.append(d);d.querySelector('button').onclick=()=>d.close();d.addEventListener('click',e=>{if(e.target!==d)return;const b=d.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)d.close()});return d;}
const controls=drawer('rabbitControlsDrawer','调整毛发与镜头'),teacher=drawer('rabbitTeacherDrawer','老师兔子 · 原始基线');
const teacherCard=document.querySelector('.viewport-card.teacher');teacher.querySelector('.drawer-content').append(teacherCard);teacherCard.querySelector('.viewport-head').hidden=true;
const inspector=$('inspector');controls.querySelector('.drawer-content').append(inspector);
const zoom=document.createElement('div');zoom.className='section';zoom.innerHTML='<div class="control"><label for="rabbitZoom">镜头放大 <output id="rabbitZoomValue">1.00×</output></label><input type="range" id="rabbitZoom" min=".3" max="2.5" step=".01" aria-label="兔子镜头放大"></div><div class="control"><label for="rabbitOrbitSpeed">环绕速度</label><select id="rabbitOrbitSpeed" aria-label="兔子自动环绕速度"><option value="0.06">很慢</option><option value="0.12" selected>慢速</option><option value="0.24">常速</option></select></div>';inspector.insertBefore(zoom,inspector.children[1]);
const saves=document.createElement('div');saves.className='rabbit-save-tools';for(const id of ['importButton','exportButton','captureButton'])saves.append($(id));inspector.append(saves);
controls.querySelector('.drawer-content').append(document.querySelector('.lower-info'));
$('inspector').querySelector('.inspector-title small').textContent='只调整自己的工作副本，老师形态保留';
const actions=document.querySelector('#rabbitModule .stage-tools');const macro=document.createElement('button');macro.id='rabbitMacro';macro.textContent='拉近细看';actions.insertBefore(macro,$('resetCamera'));
$('orbitButton').textContent='旋转';$('combButton').textContent='梳理';$('resetCombButton').textContent='还原梳理';$('resetCamera').textContent='视角归位';$('autoRotate').setAttribute('aria-controls','candidateFrame');
$('interactionHint').textContent='单指旋转 · 双指缩放 · 选择梳理后拖动毛发';
$('candidateTag').hidden=true;document.querySelector('.candidate .viewport-head strong').textContent='我的工作副本';
$('viewports').classList.add('single');
let orbitSpeed=.12;
function orbitState(){return {playing:auto,speed:orbitSpeed};}
function syncOrbit(){const b=$('autoRotate');b.textContent=auto?'Ⅱ 暂停环绕':'▶ 自动环绕';b.setAttribute('aria-label',auto?'暂停兔子相机自动环绕':'播放兔子相机自动环绕');b.setAttribute('aria-pressed',String(auto));b.classList.toggle('active',auto);b.disabled=!workbench.ready.candidate;$('rabbitOrbitSpeed').value=String(orbitSpeed);}
// Stop synchronously across same-origin frames before a manual gesture or reset.
// Epochs prevent a queued playback camera message from undoing a newer reset.
stopAuto=function(){auto=false;for(const role of ['teacher','candidate']){const r=$(role+'Frame').contentWindow?.runtime;if(r)r.setOrbit({playing:false});else post(role,'auto',{active:false});}syncOrbit();};
function setOrbit(values={}){if('speed'in values&&(!Number.isFinite(values.speed)||![.06,.12,.24].includes(values.speed)))throw Error('Invalid orbit speed');if('speed'in values)orbitSpeed=values.speed;if('playing'in values){if(!values.playing){const s=$('candidateFrame').contentWindow?.runtime?.state();if(s){candidate.angles=s.angles.slice();candidate.size=s.size;baseline.angles=s.angles.slice();baseline.size=s.size;}stopAuto();return orbitState();}auto=workbench.ready.candidate&&platform.module==='rabbit'&&!document.hidden;if(auto)clearPointers();}const r=$('candidateFrame').contentWindow?.runtime;if(r)r.setOrbit({playing:auto,speed:orbitSpeed});syncOrbit();return orbitState();}
$('autoRotate').onclick=()=>setOrbit({playing:!auto});$('rabbitOrbitSpeed').onchange=e=>setOrbit({speed:Number(e.target.value)});
window.addEventListener('message',e=>{const d=e.data;if(d?.kaopu&&d.type==='camera'&&['teacher','candidate'].includes(d.role)&&e.source===$(d.role+'Frame').contentWindow&&d.orbitEpoch!==undefined&&d.orbitEpoch!==e.source.runtime?.cameraEpoch)e.stopImmediatePropagation();},true);
function clearPointers(){for(const role of ['teacher','candidate'])$(role+'Frame').contentWindow?.runtime?.clearPointers();}
function redraw(){for(const role of ['teacher','candidate'])$(role+'Frame').contentWindow?.runtime?.requestDraw();}
function sync(){if(!window.workbench)return;syncOrbit();const s=workbench.candidate;$('rabbitZoom').value=s.size;$('rabbitZoomValue').textContent=s.size.toFixed(2)+'×';$('rabbitTeacherToggle').classList.toggle('active',teacher.open);}
function setCamera(size){if(!workbench.ready.candidate)return;clearPointers();stopAuto();candidate.size=size;baseline.size=size;both('apply',{values:{size}});sync();}
function closeAll(){if(teacher.open)teacher.close();if(controls.open)controls.close();clearPointers();}
function showTeacher(show){if(show&&(!workbench.ready.teacher||!workbench.ready.candidate)){toast('老师模型仍在装载');return;}clearPointers();if(show){stopAuto();if(controls.open)controls.close();if(!teacher.open)teacher.showModal();post('teacher','active',{active:true});post('teacher','resize');}else{if(teacher.open)teacher.close();post('teacher','active',{active:false});}$('viewports').classList.add('single');sync();}
// Legacy mesh switching may request compare internally; it must not open a dialog.
setView=function(){$('viewports').classList.add('single');both('resize');};
workbench.setView=single=>showTeacher(!single);$('compareView').onclick=()=>showTeacher(true);$('singleView').onclick=()=>showTeacher(false);
$('rabbitTeacherToggle').onclick=()=>showTeacher(!teacher.open);$('rabbitControlsToggle').onclick=()=>{const was=controls.open;closeAll();if(!was){sync();controls.showModal();}};
$('rabbitBack').onclick=()=>platform.select('anemone');$('rabbitZoom').oninput=e=>setCamera(Number(e.target.value));macro.onclick=()=>setCamera(1.65);
teacher.addEventListener('close',()=>{clearPointers();post('teacher','active',{active:false});sync();});controls.addEventListener('close',()=>{clearPointers();redraw();});
for(const id of ['resetCamera','sourceReset','resetAll'])$(id).addEventListener('click',()=>{clearPointers();sync();});
const oldMode=setMode;setMode=function(next){oldMode(next);$('interactionHint').textContent=next==='comb'?'单指梳理毛发 · 双指缩放 · 还原梳理恢复方向':'单指旋转 · 双指缩放 · 鼠标拖动 / 滚轮';};workbench.setMode=setMode;
const oldUI=updateUI;updateUI=function(){oldUI();sync();};
const oldImport=workbench.importState;workbench.importState=async data=>{await oldImport(data);sync();};
const originalSelect=platform.select;platform.select=function(module){if(module!==platform.module)stopAuto();closeAll();originalSelect(module);if(module==='rabbit'){document.body.dataset.module='rabbit';post('candidate','active',{active:true});post('teacher','active',{active:false});redraw();sync();}};
$('speciesRabbit').onclick=()=>platform.select('rabbit');$('speciesAnemone').onclick=()=>platform.select('anemone');$('speciesKuko').onclick=()=>platform.select('kuko');
window.addEventListener('message',e=>{const d=e.data;if(!d?.kaopu||!['teacher','candidate'].includes(d.role)||e.source!==$(d.role+'Frame').contentWindow)return;if(d.type==='orbit-paused'){stopAuto();}if(d.type==='camera'){sync();}if(d.type==='ready'){clearPointers();sync();if(d.role==='teacher'&&(teacher.open||workbench.frameStats.teacher?.frames>=2))post('teacher','active',{active:teacher.open});}});
window.addEventListener('blur',()=>{if(!['teacherFrame','candidateFrame'].includes(document.activeElement?.id))clearPointers();});document.addEventListener('visibilitychange',()=>{if(document.hidden){stopAuto();clearPointers();}});window.addEventListener('pagehide',()=>{stopAuto();clearPointers();});
window.visualViewport?.addEventListener('resize',redraw);window.addEventListener('resize',redraw);
window.rabbitUI={clearPointers,sync,closeAll,showTeacher,setCamera,setOrbit,pauseOrbit:()=>setOrbit({playing:false}),get orbit(){return orbitState();}};
$('aboutDialog').innerHTML=$('aboutDialog').innerHTML.replace('采用按需绘制、1:1 CSS 像素渲染','采用按需绘制、设备像素比清晰渲染，颜色与深度缓冲同尺寸');$('closeAbout').onclick=()=>$('aboutDialog').close();
sync();
})();
