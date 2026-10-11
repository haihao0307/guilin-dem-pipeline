// CPU-only module resolution for this isolated restoration package.
// Never use this helper in the browser deployment.
import {registerHooks} from 'node:module';
import {pathToFileURL} from 'node:url';
const file=process.env.NATIVE_HOST_THREE_FILE;
if(!file)throw Error('Set NATIVE_HOST_THREE_FILE to the verified same host r170 source');
registerHooks({resolve(specifier,context,nextResolve){if(specifier.endsWith('/vendor/three.module.js'))return {url:pathToFileURL(file).href,shortCircuit:true};return nextResolve(specifier,context);}});
