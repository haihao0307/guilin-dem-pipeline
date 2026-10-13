from pathlib import Path
p=Path(__file__).resolve().parent
b=p/'build.cjs';s=b.read_text();old="let page=html.replace('</head>',"
assert s.count(old)==1
native='https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/475ead2759159b83927a1aa8ae6879595e1d18bc/kaopu-unified-human-workbench/human-integrated-r05/'
s=s.replace(old,'let page=html.replace(\'assetBase:new URL(".",u7).href\',\'assetBase:"'+native+'"\').replace(\'</head>\',')
b.write_text(s)
c=p/'style.css';c.write_text(c.read_text()+'\nhtml:has(.mp06-body){height:auto;overflow:auto}body.mp06-body{min-width:0!important;display:block!important;height:auto!important}#mp06{display:block!important;position:relative!important;width:100%!important;height:auto!important;min-height:100vh;overflow:visible!important;padding:0!important}#mp06 header{height:auto!important;min-height:64px}#mp-view #stage #load-overlay[hidden]{display:none!important}#mp06 .mp-layout{width:100%;color-scheme:light}#mp-view #stage>.load-overlay{max-width:100%}\n')
f=p/'app.mjs';s=f.read_text();old='while(!window.__R05_PRESET_READY__||!window.__IDENTITY_QA__?.model()?.positions?.length)await sleep(100);while(!window.__LIP_P3__?.ready)await sleep(100);'
new='const deadline=performance.now()+120000;while(!window.__R05_PRESET_READY__||!window.__IDENTITY_QA__?.model()?.positions?.length||!window.__LIP_P3__?.ready){message(window.__LIP_STARTUP__?.stage||"载入 R05 原生人物分块");if(performance.now()>deadline)throw Error("R05 载入未完成："+document.getElementById("load-status")?.textContent);await sleep(100);}'
assert s.count(old)==1;s=s.replace(old,new);s=s.replace('function report(){return{','function report(){return{loader:{ready:window.__LIP_P3__?.ready,errors:window.__LIP_P3__?.errors,preset:window.__R05_PRESET_READY__,stage:window.__LIP_STARTUP__?.stage},');f.write_text(s)
f=p/'qa.cjs';s=f.read_text().replace("a.lighting.version,'1.1.0'","a.lighting.version,'EB1-1.1.0'");s=s.replace("}catch(e){report.errors.push(e.stack||String(e));", "}catch(e){report.diagnostic=await page.evaluate(()=>({mp:window.__MP06__?.report(),load:document.getElementById('load-status')?.textContent,status:document.getElementById('model-status')?.textContent,entry:document.getElementById('entry-status')?.textContent})).catch(()=>null);report.errors.push(e.stack||String(e));");f.write_text(s)
print('Prepared exact donor transport, isolated layout, explicit bootstrap diagnostics; donor geometry unchanged')
