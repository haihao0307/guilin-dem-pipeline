/* Compact view controls only. Model core and material functions are unchanged. */
(function(){'use strict';
const $=id=>document.getElementById(id),header=document.querySelector('header');
const toolbar=document.createElement('div');toolbar.id='studioToolbar';toolbar.innerHTML='<div class="studio-title"><strong>海葵工作台</strong><small>自然色型 · 实时 3D</small></div><div class="studio-nav"><button id="referenceToggle" aria-label="打开或关闭摄影参考" aria-haspopup="dialog">参考</button><button id="controlsToggle" aria-label="打开调整面板" aria-haspopup="dialog">调整</button><button id="learningToggle" aria-label="打开老师资料" aria-haspopup="dialog">老师</button></div>';
header.insertBefore(toolbar,header.querySelector('.header-divider'));
const returnButton=$('speciesAnemone');returnButton.textContent='← 海葵工作台';returnButton.className='studio-return';header.append(returnButton);
function drawer(id,title){const d=document.createElement('dialog');d.id=id;d.className='studio-drawer';d.setAttribute('aria-label',title);d.innerHTML='<div class="drawer-head"><strong>'+title+'</strong><button id="'+id.replace('Drawer','Close')+'" aria-label="关闭'+title+'">关闭 ×</button></div><div class="drawer-content"></div>';document.body.append(d);d.querySelector('button').onclick=()=>d.close();d.addEventListener('click',e=>{if(e.target!==d)return;const b=d.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)d.close();});d.addEventListener('close',()=>{anemone.clearPointers();anemone.redraw();});return d;}
const reference=drawer('referenceDrawer','摄影参考与来源'),controls=drawer('controlsDrawer','调整海葵'),learning=drawer('learningDrawer','老师与学习基线');
reference.querySelector('.drawer-content').append(document.querySelector('.anemone-reference'));
for(const q of ['.cluster-sources','.anemone-boundary'])reference.querySelector('.drawer-content').append(document.querySelector(q));
const inspector=document.querySelector('.anemone-inspector');inspector.open=true;controls.querySelector('.drawer-content').append(inspector);
const quick=document.createElement('div');quick.className='studio-quick-controls';quick.innerHTML='<div class="control"><label for="studioZoom">镜头远近 <output id="studioZoomValue"></output></label><input type="range" id="studioZoom" min="2" max="8" step=".01" aria-label="镜头远近"></div><div class="control"><label for="anemoneOrbitSpeed">环绕速度</label><select id="anemoneOrbitSpeed" aria-label="海葵自动环绕速度"><option value="0.06">很慢</option><option value="0.12" selected>慢速</option><option value="0.24">常速</option></select></div><div class="control"><label for="studioTranslucency">侧缘透光 <output id="studioTranslucencyValue"></output></label><input type="range" id="studioTranslucency" min="0" max="1" step=".01" aria-label="侧缘透光"></div>';
inspector.insertBefore(quick,inspector.querySelector('.anemone-controls'));
for(const k of ['length','thickness','current','turbulence'])quick.append($('anemone-'+k).closest('.control'));
const orbitButton=document.createElement('button');orbitButton.id='anemoneAutoRotate';orbitButton.type='button';orbitButton.setAttribute('aria-controls','anemoneCanvas');$('anemonePause').before(orbitButton);
function syncOrbit(){const s=anemone.orbit;orbitButton.textContent=s.playing?'Ⅱ 暂停环绕':'▶ 自动环绕';orbitButton.setAttribute('aria-label',s.playing?'暂停海葵相机自动环绕':'播放海葵相机自动环绕');orbitButton.setAttribute('aria-pressed',String(s.playing));orbitButton.classList.toggle('active',s.playing);$('anemoneOrbitSpeed').value=String(s.speed);}
orbitButton.onclick=()=>anemone.setOrbit({playing:!anemone.orbit.playing});$('anemoneOrbitSpeed').onchange=e=>anemone.setOrbit({speed:Number(e.target.value)});window.addEventListener('anemoneorbit',syncOrbit);syncOrbit();
const more=document.createElement('details');more.className='studio-more-controls';more.innerHTML='<summary>更多形态与水流</summary>';inspector.append(more);more.append(inspector.querySelector('.anemone-controls'));
learning.querySelector('.drawer-content').innerHTML='<p>老师与旧基线保留在这里，关闭后回到自己的作品</p>';
for(const id of ['speciesKuko','speciesRabbit'])learning.querySelector('.drawer-content').append($(id));
learning.querySelector('.drawer-content').append($('clusterBaseline'));
// camera.distance is normalized: the renderer applies its existing aspect-ratio
// framing factor at draw time. Keep one immutable home baseline across resizes,
// imports, pinch gestures and repeated preset clicks; never rebase from live zoom.
const HOME_CAMERA_DISTANCE=4.6;
const stage=document.querySelector('.anemone-stage');
const observation=document.createElement('section');
observation.id='anemoneQuickPanel';
observation.className='anemone-quick-panel';
observation.setAttribute('aria-label','海葵镜头与冷暖灯光');
observation.innerHTML='<div class="anemone-zoom-presets"><span>镜头 <output id="anemoneQuickZoomValue" aria-label="当前海葵镜头缩放">100%</output></span><div id="anemoneZoomPresets" role="group" aria-label="海葵镜头绝对缩放">'+[1,1.5,2].map(value=>'<button type="button" data-anemone-zoom="'+value+'" aria-label="海葵镜头缩放至 '+value*100+'%" aria-controls="anemoneCanvas" aria-pressed="false">'+value*100+'%</button>').join('')+'</div></div><div id="anemoneQuickLighting" class="anemone-quick-lighting" role="group" aria-label="海葵冷暖双侧光" hidden></div>';
stage.querySelector('.cluster-palette').after(observation);
function zoomRatio(){return HOME_CAMERA_DISTANCE/anemone.state.camera.distance;}
function setZoom(value){
  if(!Number.isFinite(value)||value<HOME_CAMERA_DISTANCE/8||value>HOME_CAMERA_DISTANCE/2)throw Error('海葵镜头缩放超出范围');
  if(!anemone.ready)return false;
  anemone.pauseOrbit();
  anemone.clearPointers();
  // Preserve the user's orbit angles and the native gesture distance limits.
  anemone.renderer.camera.distance=HOME_CAMERA_DISTANCE/value;
  anemone.redraw();
  window.dispatchEvent(new Event('anemonecamera'));
  return true;
}
for(const button of observation.querySelectorAll('[data-anemone-zoom]'))button.onclick=()=>setZoom(Number(button.dataset.anemoneZoom));
function sync(){
  const ratio=zoomRatio();
  $('anemoneQuickZoomValue').textContent=Math.round(ratio*100)+'%';
  for(const button of observation.querySelectorAll('[data-anemone-zoom]')){
    const active=Math.abs(Number(button.dataset.anemoneZoom)-ratio)<.000001;
    button.disabled=!anemone.ready;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  }
  if(!anemone.ready)return;
  $('studioZoom').value=anemone.state.camera.distance;
  $('studioZoomValue').textContent=anemone.state.camera.distance.toFixed(2);
  $('studioTranslucency').value=anemone.material.translucency;
  $('studioTranslucencyValue').textContent=Math.round(anemone.material.translucency*100)+'%';
}
// object-lighting-ui.js runs later in this same build script. Move the live form
// nodes after it installs objectLighting; IDs, handlers, state and disabled rules
// remain owned by that shared API. There is no second set of lighting controls.
function mountQuickLighting(){
  const mode=$('anemoneLightingMode'),warm=$('anemone-warmPower'),cool=$('anemone-coolPower');
  if(!window.objectLighting||!mode||!warm||!cool)return false;
  const target=$('anemoneQuickLighting');
  for(const control of [mode,warm,cool])target.append(control.closest('.control'));
  mode.closest('.control').classList.add('anemone-light-mode');
  mode.options[0].textContent='冷暖双侧光';
  mode.options[1].textContent='原始单灯';
  mode.title='选择冷暖双侧光或原始单灯参考';
  target.hidden=false;
  // Read the same public API used by the original inputs, without changing it.
  target.dataset.mode=window.objectLighting.get('anemone').mode;
  target.addEventListener('change',()=>{target.dataset.mode=window.objectLighting.get('anemone').mode;});
  sync();
  anemone.redraw();
  return true;
}
queueMicrotask(mountQuickLighting);
window.addEventListener('platformchange',sync);
new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['data-module']});
const drawers=[reference,controls,learning];function closeAll(){drawers.forEach(d=>{if(d.open)d.close()});}
for(const [id,d]of [['referenceToggle',reference],['controlsToggle',controls],['learningToggle',learning]])$(id).onclick=()=>{const was=d.open;closeAll();anemone.clearPointers();if(!was){if(d===reference)for(const image of d.querySelectorAll('img[data-reference-src]')){image.src=image.dataset.referenceSrc;delete image.dataset.referenceSrc;}sync();d.showModal();}};
$('studioZoom').oninput=e=>{anemone.pauseOrbit();anemone.renderer.camera.distance=Number(e.target.value);anemone.redraw();sync();};$('studioTranslucency').oninput=e=>{anemone.setMaterial({translucency:Number(e.target.value)});sync();};
window.addEventListener('anemonecamera',sync);window.addEventListener('anemonestate',sync);for(const id of ['anemoneCamera','anemoneReset','clusterMacro'])$(id).addEventListener('click',sync);
for(const id of ['speciesKuko','speciesRabbit','speciesAnemone'])$(id).addEventListener('click',closeAll);
$('clusterBaseline').addEventListener('click',()=>learning.close());
stage.querySelector('.anemone-hint').textContent='单指旋转 · 双指缩放 · 鼠标拖动 / 滚轮';
$('anemoneCamera').textContent='视角归位';$('clusterMacro').textContent='微距';$('anemoneResetTime').textContent='时间归零';$('anemoneCapture').textContent='保存画面';
const status=$('anemoneStatus');document.querySelector('.anemone-stage-foot').lastElementChild.replaceWith(status);
function viewport(){document.documentElement.style.setProperty('--studio-height',(window.visualViewport?.height||window.innerHeight)+'px');anemone.redraw();sync();}
window.visualViewport?.addEventListener('resize',viewport);window.addEventListener('resize',viewport);
window.studioUI={setZoom,get zoom(){return zoomRatio();},get homeCameraDistance(){return HOME_CAMERA_DISTANCE;},closeAll,openReference:()=>$('referenceToggle').click(),openControls:()=>$('controlsToggle').click(),openLearning:()=>$('learningToggle').click()};
sync();viewport();
})();
