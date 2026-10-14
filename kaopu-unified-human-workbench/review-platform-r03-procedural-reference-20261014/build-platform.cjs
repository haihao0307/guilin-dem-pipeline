const fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');
const read=p=>fs.readFileSync(__dirname+'/'+p,'utf8');let html=read('r06-preview.html');assert.equal(crypto.createHash('sha256').update(html).digest('hex'),'b33c0a651570f2671ac61ea546279abfe06ebb07c966a70964e428df966420fd');
function once(a,b){assert.equal(html.split(a).length,2,'Bundled source anchor changed');html=html.replace(a,()=>b);}
once('{strength:.35,slack:.4,forehead:.25,eyes:.3}','{strength:0,slack:.4,forehead:.25,eyes:.3}');
once('[n.foldLights.key,n.foldLights.fill,n.earLight].map','(n.skinDNALights||[n.foldLights.key,n.foldLights.fill,n.earLight]).map');
once('let o=n.model.foldProfile.settings.light!=="original";n.skin.setEarVisibility','let o=!!n.skinDNALights||n.model.foldProfile.settings.light!=="original";n.skin.setEarVisibility');
once('hostLights:"fold key + fold fill + ear inspection lamp"','hostLights:"active studio lights or original fold rig"');
once('n.naturalEyesReady=rw().then(d=>n.disposed?!1:', 'n.naturalEyesReady=rw().then(async d=>n.disposed?!1:');
once('c.neReady.value=1,l.ready=!0,a.dispose(),n.viewer.render(),!0)).catch', 'await window.platformPackEyes(n,c),c.neReady.value=1,l.ready=!0,a.dispose(),n.viewer.render(),!0)).catch');
// Disable the previous ET lip mesh deformation/refinement stage. Surface data
// attributes below carry semantics only, with no position/index writes.
once('if(super.update(),this.model?.lipStructure?.settings.enabled){','if(super.update(),false){');
once('else this.currentLip=null}finally{this.inLipUpdate=!1}', 'else{this.currentLip=null;let g=this.geometry;if(!g.attributes.l19State){let a=new Float32Array(g.attributes.position.count*4),b=new Float32Array(a.length);for(let j=0;j<g.attributes.position.count;j++){a[j*4]=g.attributes.l19Oral?.array[j]||0;a[j*4+1]=1;b[j*4]=1;if(a[j*4]>.001){let f=g.attributes.fRest.array,x=f[j*3],y=f[j*3+1],z=f[j*3+2],r=this.model.lipStructure.rails,q=r.sample([x,y,z],0);b[j*4+3]=Math.max(0,lw(q.upper?r.innerTop:r.innerBottom,x)-z);}}g.setAttribute("l19State",new He(a,4));g.setAttribute("l19Detail",new He(b,4));}}}finally{this.inLipUpdate=!1}');
html=html.replace(/<title>[^<]*<\/title>/,'<title>人物总平台 · 程序表面 R03</title>');
once('<script>(()=>{','<script>'+read('integration/merge.bundle.js').replaceAll('</script','<\\/script')+'</script>\n<script>(()=>{');
once('</head>','<style>'+read('platform.css')+'</style></head>');
const thumbs=fs.existsSync(__dirname+'/portraits.json')?'window.__PLATFORM_THUMBNAILS__='+read('portraits.json')+';':'';
once('</body>','<script>'+thumbs+read('platform.js').replaceAll('</script','<\\/script')+'</script></body>');
fs.writeFileSync(__dirname+'/platform.html',html);fs.writeFileSync(__dirname+'/preview.html',html);console.log('Built review platform',Buffer.byteLength(html),crypto.createHash('sha256').update(html).digest('hex'));
