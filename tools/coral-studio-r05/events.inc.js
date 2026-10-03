$('quality').value=quality;$('quality').onchange=()=>setQuality($('quality').value);
$('backTime').onclick=()=>seek(clock-30);$('forwardTime').onclick=()=>seek(clock+30);
$('jumpTime').onclick=()=>{const value=Number($('timeJump').value);if(Number.isFinite(value)&&value>=0){phase=0;seek(value)}};
new ResizeObserver(()=>{if(current==='rosette'){dirty=true;request()}}).observe($('screenB'));
window.addEventListener('resize',()=>{if(current==='rosette'){dirty=true;request()}});
document.addEventListener('fullscreenchange',()=>{dirty=true;request()});
