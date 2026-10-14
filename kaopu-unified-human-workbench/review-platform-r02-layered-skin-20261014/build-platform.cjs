const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');
const read=p=>fs.readFileSync(__dirname+'/'+p,'utf8');let html=read('r06-preview.html');assert.equal(crypto.createHash('sha256').update(html).digest('hex'),'b33c0a651570f2671ac61ea546279abfe06ebb07c966a70964e428df966420fd');
function once(a,b){assert.equal(html.split(a).length,2,'Bundled source anchor changed');html=html.replace(a,()=>b);}
once('{strength:.35,slack:.4,forehead:.25,eyes:.3}','{strength:0,slack:.4,forehead:.25,eyes:.3}');
once('[n.foldLights.key,n.foldLights.fill,n.earLight].map','(n.skinDNALights||[n.foldLights.key,n.foldLights.fill,n.earLight]).map');
once('let o=n.model.foldProfile.settings.light!=="original";n.skin.setEarVisibility','let o=!!n.skinDNALights||n.model.foldProfile.settings.light!=="original";n.skin.setEarVisibility');
once('hostLights:"fold key + fold fill + ear inspection lamp"','hostLights:"active studio lights or original fold rig"');
once('n.naturalEyesReady=rw().then(d=>n.disposed?!1:', 'n.naturalEyesReady=rw().then(async d=>n.disposed?!1:');
once('c.neReady.value=1,l.ready=!0,a.dispose(),n.viewer.render(),!0)).catch', 'await window.platformPackEyes(n,c),c.neReady.value=1,l.ready=!0,a.dispose(),n.viewer.render(),!0)).catch');
html=html.replace(/<title>[^<]*<\/title>/,'<title>人物总平台 · 分层皮肤 R02</title>');
once('<script>(()=>{','<script>'+read('integration/merge.bundle.js').replaceAll('</script','<\\/script')+'</script>\n<script>(()=>{');
once('</head>','<style>'+read('platform.css')+'</style></head>');
const thumbs=fs.existsSync(__dirname+'/portraits.json')?'window.__PLATFORM_THUMBNAILS__='+read('portraits.json')+';':'';
once('</body>','<script>'+thumbs+read('platform.js').replaceAll('</script','<\\/script')+'</script></body>');
fs.writeFileSync(__dirname+'/platform.html',html);console.log('Built review platform',Buffer.byteLength(html),crypto.createHash('sha256').update(html).digest('hex'));
