/* Reusable, idempotent graph-skin extension for an existing R02 native host. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const version='OWN-SKIN-GRAPH-R02-20261016',names=['SkinGraphKernel.js','SkinGraphSurface.js'],sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=n=>fs.readFileSync(path.join(__dirname,n),'utf8');
function sourceInfo(){return{version,sourceSHA256:Object.fromEntries(names.map(n=>[n,sha(read(n))]))};}
function injectGraph(html){
 const matches=[...html.matchAll(/<script data-graph-skin="R\d+">/g)],existing=matches.length?matches.at(-1).index:-1;if(existing>=0){const end=html.indexOf('</script>',existing);if(end<0)throw Error('Previous graph extension is incomplete');html=html.slice(0,existing)+html.slice(end+'</script>'.length);}
 const anchor='f.image={data:v,width:512,height:v.length/2048},f.needsUpdate=!0';html=html.replaceAll('f.dispose(),'+anchor,anchor).replaceAll(anchor,'f.dispose(),'+anchor);
 const source='window.__GRAPH_SKIN_SOURCE__='+JSON.stringify(sourceInfo())+';window.__GRAPH_KERNEL_SOURCE__='+JSON.stringify(read('SkinGraphKernel.js'))+';\n'+names.map(read).join('\n');
 const bootstrap=`(()=>{const SOURCE=${JSON.stringify(source)};const seen=new WeakSet();function visit(w){try{if(w.headProceduralSkin&&!w.__GRAPH_SKIN_PENDING__){const s=w.document.createElement('script');s.textContent=SOURCE;w.document.head.append(s);}for(const f of w.document.querySelectorAll('iframe')){if(!seen.has(f)){seen.add(f);f.addEventListener('load',()=>visit(f.contentWindow));}if(f.contentWindow)visit(f.contentWindow);}}catch(e){console.warn('GRAPH_FAMILY_ACCESS',String(e));}}visit(window);setInterval(()=>visit(window),750);window.__GRAPH_FAMILY_VERSION__='${version}';})();`;
 const end=html.lastIndexOf('</body>');if(end<0)throw Error('Document body missing');return html.slice(0,end)+'<script data-graph-skin="R02">'+bootstrap.replaceAll('</script','<\\/script')+'</script>'+html.slice(end);
}
module.exports={injectGraph,sourceInfo,version};
if(require.main===module){const[src,dst]=process.argv.slice(2);if(!src||!dst)throw Error('Source and destination required');fs.writeFileSync(dst,injectGraph(fs.readFileSync(src,'utf8')));console.log(JSON.stringify({dst,...sourceInfo()}));}
