// One active application and renderer per document. Existing garment modes
// retain their verified implementation; PPF loads only its replay module.
const mode=new URL(location.href).searchParams.get('case');
if(mode==='ppf'){
  await import('./ppf-teacher/player.mjs');
}else{
  document.getElementById('case-select').addEventListener('change',event=>{
    if(event.target.value!=='ppf')return;
    event.stopImmediatePropagation();
    const url=new URL(location.href);url.searchParams.set('case','ppf');url.searchParams.delete('scene');
    location.assign(url);
  },true);
  await import('./unified/app.mjs');
}
