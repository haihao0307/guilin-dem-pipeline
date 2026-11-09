import {register} from 'node:module';
import {fileURLToPath} from 'node:url';
process.env.THREE_PATH=fileURLToPath(new URL('./benchmark-vendor/three.package-r170.mjs',import.meta.url));
register('./mp05-r10/node-loader.mjs',import.meta.url);
await import('./shoe-counts.mjs');
