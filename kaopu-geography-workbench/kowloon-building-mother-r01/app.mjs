// Compatibility entry for HTML cached before immutable release paths.
// The unversioned first HTML uses the preserved first implementation.
// The intermediate floor/window HTML has the same controls as r03.
const version=document.querySelector('meta[name="kaopu-build"]')?.content??'';
const entry=version.includes('floor-window-pbr')?'./r03/app.mjs':'./legacy-r01-app.mjs';
import(entry).catch(error=>{const loading=document.getElementById('loading'),failure=document.getElementById('failure');if(loading)loading.hidden=true;if(failure){failure.hidden=false;failure.textContent='试验载入失败：'+error.message;}});
