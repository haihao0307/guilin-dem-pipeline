import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {buildClothBundles} from './cloth-bundle.mjs';
const require=createRequire(import.meta.url);
const esbuild=require(process.env.CROWD_ESBUILD_PATH||'/tmp/npc-life-build-tools/node_modules/esbuild');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const donor=await import('../src/cloth/upstream/vendor/three.module.js');
const bridge='const native=window.hairF13._raw().THREE;\n'+Object.keys(donor).map(key=>`export const ${key}=native.${key};`).join('\n');
await fs.mkdir(path.join(root,'dist'),{recursive:true});
const cloth=await buildClothBundles({esbuild,root});
const result=await esbuild.build({
  entryPoints:[path.join(root,'src/main.mjs')],outfile:path.join(root,'dist/app.js'),
  bundle:true,format:'iife',target:'es2022',minify:true,sourcemap:false,metafile:true,
  banner:{js:cloth.prelude},
  plugins:[cloth.mainPlugin,{name:'one-native-render-three',setup(build){
    build.onResolve({filter:/^(three|.*\/three\.module(?:\.min)?\.js)$/},()=>({path:'original-f13-B1',namespace:'native-three'}));
    build.onLoad({filter:/.*/,namespace:'native-three'},()=>({contents:bridge,loader:'js'}));
  }}],
});
await fs.writeFile(path.join(root,'dist/app-metafile.json'),JSON.stringify(result.metafile,null,2));
const data=await fs.readFile(path.join(root,'dist/app.js'));
console.log(JSON.stringify({appBytes:data.length,inputs:Object.keys(result.metafile.inputs).length,clothWorkers:cloth.manifest.workers,originalClothFilesVerified:cloth.manifest.originalFilesVerified}));
