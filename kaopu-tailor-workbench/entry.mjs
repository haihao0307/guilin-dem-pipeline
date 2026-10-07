// A single active document application. Archived experiments retain their old code.
const mode=new URL(location.href).searchParams.get('case');
if(mode==='ppf') await import('./ppf-teacher/player.mjs');
else if(mode==='swatch'||mode==='structured'){
 document.getElementById('case-select').addEventListener('change',event=>{
  const id=event.target.value;if(id==='swatch'||id==='structured')return;
  event.stopImmediatePropagation();const url=new URL(location.href);url.searchParams.set('case',id);url.searchParams.delete('scene');location.assign(url);
 },true);
 await import('./unified/app.mjs');
}else await import('./catalogue/workbench-app.mjs');
