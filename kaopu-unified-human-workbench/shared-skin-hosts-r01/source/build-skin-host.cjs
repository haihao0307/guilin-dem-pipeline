const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=__dirname,modules=path.join(root,'kaopu-unified-human-workbench/human-integrated-r07');
const names=['HeadSurface.js','SurfaceCalibration.js','SurfaceMicrostructure.js','SurfaceLookC4.js','BodySurface.js','BodyLookC2.js','RenderHealth.js'];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(fs.readFileSync(path.join(modules,'BUILD_MANIFEST.json')));
function inject(input,{presentation=true}={}){
 assert(!input.includes('window.__UNIFIED_SKIN__='),'Skin already installed');
 for(const n of names)assert.equal(hash(fs.readFileSync(path.join(modules,n))),manifest.sourceSHA256[n],n+' source drift');
 let parts=names.map(n=>fs.readFileSync(path.join(modules,n),'utf8'));
 if(presentation)parts.splice(parts.length-1,0,fs.readFileSync(path.join(root,'skin-host-adapter.js'),'utf8'));
 const script=`<script data-unified-skin="SKIN-HOST-R01-20261015">window.__HEAD_PROC_SOURCE__='50f9dd769893584dedb62f0bc62db07ebcb1dcc0';window.__FULLBODY_SOURCE__='50f9dd769893584dedb62f0bc62db07ebcb1dcc0';\n${parts.join('\n')}</script>`;
 // Preserve the inherited cache predicate when local QA rewrites URL literals.
 input=input.replace("if(raw.startsWith('https://raw.githubusercontent.com/'))","if(raw.startsWith('https:'+'//raw.githubusercontent.com/'))");
 // Clothing transfers the native canvas into its own document. On pagehide,
 // the retained native cleanup must tolerate that canvas having a new owner.
 input=input.replace('let n=ze("canvas");n.replaceWith(n.cloneNode(!1))','let n=ze("canvas");if(n)n.replaceWith(n.cloneNode(!1))');
 assert.equal(input.split('</body>').length,2);return input.replace('</body>',()=>script+'</body>');
}
module.exports={inject,hash,names};
if(require.main===module){const [src,dst]=process.argv.slice(2);assert(src&&dst);const b=fs.readFileSync(src,'utf8'),out=inject(b);fs.mkdirSync(path.dirname(path.resolve(dst)),{recursive:true});fs.writeFileSync(dst,out);console.log(JSON.stringify({src,dst,before:hash(b),after:hash(out),bytes:Buffer.byteLength(out)}));}
