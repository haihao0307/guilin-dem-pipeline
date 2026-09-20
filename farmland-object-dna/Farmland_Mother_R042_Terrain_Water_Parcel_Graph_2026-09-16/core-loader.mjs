const parts=['core.part-00.txt','core.part-01.txt','core.part-02.txt','core.part-03.txt'];
try{
  const responses=await Promise.all(parts.map(async path=>{
    const response=await fetch(path,{cache:'no-store'});
    if(!response.ok)throw new Error(`核心分片读取失败：${path} (${response.status})`);
    return response.text();
  }));
  (0,eval)(responses.join(''));
  if(!window.W||window.W.VERSION!=='FARMLAND_R042_TERRAIN_HYDRO_PARCEL_GRAPH_20260916')throw new Error('R042 核心没有完成安装');
  await import('./scene.mjs');
}catch(error){
  console.error('R042_CORE_STARTUP_ERROR',error);
  const fail=document.getElementById('fail');
  fail.innerHTML='<b>R042 启动失败。</b><p style="font-size:12px;line-height:1.5">'+String(error?.message||error)+'</p>';
  fail.classList.add('show');
}
