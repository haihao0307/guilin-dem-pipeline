/* Coral Studio R04: shared reference-panel policy. Does not alter the accepted shader. */
(()=>{'use strict';
const $=id=>document.getElementById(id),key='coral-studio-reference-layout-v1',sizes=[.25,.4,.6,.8,1];
let pref={ratio:.4,visible:true};try{const p=JSON.parse(localStorage.getItem(key)||'null');if(p&&typeof p.visible==='boolean'&&sizes.includes(p.ratio))pref=p}catch(_){}
const clamp=v=>Math.max(.25,Math.min(1,Number(v)||.4));
const state=window.CoralStudio={version:'R04-20261003',referenceHidden:!pref.visible,referenceRatio:pref.ratio,maxRatio:1};
function persist(){try{localStorage.setItem(key,JSON.stringify(pref))}catch(_){}}
function apply(redraw=false){
 pref.ratio=clamp(pref.ratio);const grid=$('studioGrid'),p=$('teacherPanel');
 state.referenceHidden=!pref.visible;state.referenceRatio=pref.ratio;
 grid.dataset.reference=pref.visible?'open':'closed';grid.style.setProperty('--ref-ratio',pref.ratio+'fr');
 grid.style.setProperty('--reference-mobile-width',Math.max(55,pref.ratio*100)+'%');p.hidden=!pref.visible;
 $('referenceSize').textContent=Math.round(pref.ratio*100)+'%';
 $('referenceToggle').setAttribute('aria-expanded',String(pref.visible));$('referenceToggle').classList.toggle('active',pref.visible);
 $('focusView').classList.toggle('active',!pref.visible);$('focusView').setAttribute('aria-pressed',String(!pref.visible));
 $('equalView').classList.toggle('active',pref.visible&&pref.ratio===1);$('equalView').setAttribute('aria-pressed',String(pref.visible&&pref.ratio===1));
 $('referenceSmaller').disabled=pref.ratio<=.25;$('referenceLarger').disabled=pref.ratio>=1;
 if(redraw&&pref.visible)window.CoralRecovery?.redraw();persist();
}
function show(visible){pref.visible=!!visible;apply(visible)}
function resize(dir){const i=sizes.findIndex(x=>x>=pref.ratio);pref.ratio=sizes[Math.max(0,Math.min(sizes.length-1,i+dir))];apply(false)}
$('referenceToggle').onclick=()=>show(!pref.visible);$('referenceClose').onclick=()=>{show(false);$('referenceToggle').focus({preventScroll:true})};
$('referenceSmaller').onclick=()=>resize(-1);$('referenceLarger').onclick=()=>resize(1);
$('focusView').onclick=()=>show(false);$('equalView').onclick=()=>{pref.ratio=1;show(true)};
$('resetLayout').onclick=()=>{pref={ratio:.4,visible:true};apply(true)};
$('studentFullscreen').onclick=async()=>{const panel=$('studentPanel');try{if(document.fullscreenElement)await document.exitFullscreen();else if(panel.requestFullscreen)await panel.requestFullscreen();else{show(false);panel.scrollIntoView({block:'start',behavior:'smooth'})}}catch(_){show(false);panel.scrollIntoView({block:'start'})}};
window.addEventListener('keydown',e=>{if(e.ctrlKey||e.altKey||e.metaKey||/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName)||e.target?.isContentEditable)return;if(window.CoralRecoveryState?.current!=='rosette')return;if(e.code==='KeyT'){e.preventDefault();show(!pref.visible)}else if(e.code==='Space'){e.preventDefault();$('play').click()}});
window.addEventListener('coral:view',()=>apply(false));
state.showReference=show;state.setRatio=ratio=>{pref.ratio=clamp(ratio);pref.visible=true;apply(true)};
state.restoreLayout=()=>{pref={ratio:.4,visible:true};apply(true)};
state.measure=()=>{const r=el=>{const a=el.getBoundingClientRect();return{width:a.width,height:a.height,x:a.x,y:a.y}};return{student:r($('studentPanel')),teacher:r($('teacherPanel')),studentScreen:r($('screenB')),teacherScreen:r($('screenA')),referenceHidden:state.referenceHidden,ratio:pref.ratio}};
apply(false);
})();
