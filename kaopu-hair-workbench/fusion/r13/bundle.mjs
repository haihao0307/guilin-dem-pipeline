import esbuild from 'esbuild';
import path from 'node:path';import {fileURLToPath} from 'node:url';
const p=path.dirname(fileURLToPath(import.meta.url));
await esbuild.build({entryPoints:[p+'/src/app.js'],bundle:true,format:'esm',outfile:p+'/bundle.js',target:'es2022',minify:true,legalComments:'inline',alias:{three:p+'/vendor/three.module.js'}});
