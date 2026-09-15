(async()=>{
  const r=await fetch('./index.html',{cache:'no-store'});if(!r.ok)throw Error(`基础工作台读取失败 (${r.status})`);
  let html=await r.text();
  const needle='<script type="module" src="./bootstrap.js"></script>';
  const identity=`<script>window.__WENZHOU_HISTORY_1942=true;(function(){var p=document.querySelector('.brand p');if(p)p.textContent='1940s Map Mother · 历史海陆回退';document.documentElement.dataset.wenzhouMapMotherEpoch='1940s';})();</script>`;
  const injected=identity+'<script type="module" src="./history-1942-entry.js"></script>'+needle;
  if(!html.includes(needle))throw Error('找不到基础工作台启动入口');
  html=html.replace('<title>小温州 · 三维地形 R3.8</title>','<title>小温州 · 1940s Map Mother</title>').replace(needle,injected);
  document.open();document.write(html);document.close();
})().catch(error=>{document.body.innerHTML=`<pre style="white-space:pre-wrap;padding:20px">1940s Map Mother 启动失败\n${String(error?.stack||error)}</pre>`;});
