import {fileURLToPath,pathToFileURL} from 'node:url';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const [sourceArg,dependencyArg]=process.argv.slice(2);
if(!sourceArg||!dependencyArg)throw Error('Usage: node build-musa-bundle.mjs CANONICAL_CHECKOUT PINNED_FICUS_RUNTIME_PROBE');
const sourceRoot=path.resolve(sourceArg),probe=path.resolve(dependencyArg),rules=path.dirname(fileURLToPath(import.meta.url)),esbuild=await import(pathToFileURL(probe+'/node_modules/esbuild/lib/main.js'));
if(esbuild.version!=='0.25.10')throw Error('Pinned esbuild 0.25.10 required');
const sha=b=>createHash('sha256').update(b).digest('hex');
const source=sourceRoot+'/src/TropicalLibrary/BarkData76.ts', original=await readFile(source),text=original.toString(),marker='export const BARK_DATA76:readonly BarkRow76[]=',start=text.indexOf('[',text.indexOf(marker)+marker.length),end=text.lastIndexOf('] as const;');
if(start<0||end<start)throw Error('Unexpected original bark table');
const rows=JSON.parse(text.slice(start,end+1));if(rows.some(r=>r.species==='musa-balbisiana'))throw Error('Musa bark data unexpectedly required');
const replacement=text.slice(0,start+1)+text.slice(end);
if(replacement!==await readFile(rules+'/build-inputs/BarkData76.musa.ts','utf8'))throw Error('Pinned Musa bark-table transform changed');
const result=await esbuild.build({absWorkingDir:probe,entryPoints:['author-entry.ts'],bundle:true,format:'esm',platform:'neutral',target:'es2022',outfile:rules+'/native78-musa-author.mjs',metafile:true,legalComments:'eof',plugins:[{name:'musa-no-unused-wood-table',setup(build){
 build.onResolve({filter:/^three$/},()=>({path:'../vendor/three.module.min.js',external:true}));
 build.onResolve({filter:/^three\/examples\/jsm\/objects\/MarchingCubes\.js$/},()=>({path:probe+'/node_modules/three/examples/jsm/objects/MarchingCubes.js'}));
 build.onResolve({filter:/^three\/addons\/libs\/fflate\.module\.js$/},()=>({path:probe+'/node_modules/three/examples/jsm/libs/fflate.module.js'}));
 build.onLoad({filter:/[/\\]BarkData76\.ts$/},async args=>{if(path.resolve(args.path)!==source)throw Error('Unexpected bark input');return{contents:replacement,loader:'ts'};});
}}]});
const inputs=[];for(const name of Object.keys(result.metafile.inputs)){const full=path.resolve(probe,name),raw=await readFile(full);inputs.push({path:full.startsWith(sourceRoot+'/')?path.relative(sourceRoot,full):path.relative(probe,full),source:full.startsWith(sourceRoot+'/')?'canonical':full.includes('/node_modules/')?'npm-three-0.179.1':'adapter',bytes:raw.length,sha256:sha(raw),...(full===source?{transform:'remove-unused-bark-table-for-guarded-musa-only-profile',transformedSha256:sha(replacement)}:{})});}
const bundle=await readFile(rules+'/native78-musa-author.mjs');const closure={sourceHead:'d5f6ed0f41bdd6a4e4d1163190d3cd2135e8b122',esbuildVersion:esbuild.version,threePeer:'0.179.1',bundle:{file:'native78-musa-author.mjs',bytes:bundle.length,sha256:sha(bundle)},inputCount:inputs.length,inputs};
await writeFile(rules+'/native78-source-closure.json',JSON.stringify(closure,null,2)+'\n');
const transform={sourceHead:closure.sourceHead,sourcePath:path.relative(sourceRoot,source),sourceBytes:original.length,sourceSha256:sha(original),originalRows:rows.length,retainedRows:0,guardedSpecies:'musa-balbisiana',transformedModuleBytes:Buffer.byteLength(replacement),transformedModuleSha256:sha(replacement),method:'esbuild onLoad empty unused wood bark data table only; canonical files untouched; actual full-source comparison required',bundle:closure.bundle};
await writeFile(rules+'/native78-musa-resource-slice.json',JSON.stringify(transform,null,2)+'\n');
console.log(JSON.stringify({closureSha256:sha(await readFile(rules+'/native78-source-closure.json')),bundle:closure.bundle,inputs:inputs.length}));
