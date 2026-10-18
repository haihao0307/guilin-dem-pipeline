const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
function startupScript(skinOnly=false){const kernel=read('vendor/shared-graph-skin/SkinGraphKernel.js');return('window.__HAIR_STARTUP_CONFIG__='+JSON.stringify({kernelSource:kernel,kernelSHA256:sha(kernel)})+';'+(skinOnly?'':read('src/InitialMedia.js'))+';'+read('src/StartupWarmup.js')).replaceAll('</script','<\\/script');}
function injectEarly(html){const index=html.indexOf('<head>');if(index<0)throw Error('Native head startup anchor missing');return html.slice(0,index+6)+'<script>'+startupScript()+'</script>'+html.slice(index+6);}
function injectWarmConsumer(html){
 const generate='function generate(options){return new Promise',bridge='s.textContent=SOURCE;w.document.head.append(s);';
 if(html.split(generate).length!==2||html.split(bridge).length!==2)throw Error('Frozen graph warmup adapter anchor differs');
 // The vendor bootstrap embeds source as a JSON string; the replacement is
 // deliberately quote-free so it remains valid inside that source string.
 const image='N.src=new URL("../assets/"+C.previewFolder+"/"+C.id+".webp","https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/0b4703359efbae10ffc6c0e5fe3fc081e7eca4fe/kaopu-unified-human-workbench/full/ui/PresetBrowser.mjs").href';if(html.split(image).length!==2)throw Error('Frozen hidden preset image anchor differs');html=html.replace(image,'window.__HAIR_DEFER_IMAGE__(N,'+image.slice(6)+')');
 return html.replace(generate,'async function generate(options){const warm=window.__HAIR_SKIN_WARMUP__;if(warm){const out=await warm.take(options);if(out)return out;}return new Promise').replace(bridge,'w.__HAIR_SKIN_WARMUP__=window.__HAIR_SKIN_WARMUP__;s.textContent=SOURCE;w.document.head.append(s);');
}
module.exports={startupScript,injectEarly,injectWarmConsumer};
