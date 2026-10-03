import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
function shaFile(file){const hash=crypto.createHash('sha256'),buffer=Buffer.allocUnsafe(65536),fd=fs.openSync(file,'r');try{let bytes;while((bytes=fs.readSync(fd,buffer,0,buffer.length,null)))hash.update(buffer.subarray(0,bytes));}finally{fs.closeSync(fd);}return hash.digest('hex');}
// Data references are repo-owned files, not executable commands or web requests.
export function verifyBindings(bindings,{required=false}={}) {
  if(!Array.isArray(bindings))return required?['EVIDENCE_BINDINGS_REQUIRED']:[];
  const errors=[];
  for(const b of bindings){
    if(typeof b?.path!=='string'||!b.path||path.isAbsolute(b.path)||b.path.split(/[\\/]/).includes('..')||! /^[0-9a-f]{64}$/.test(b.sha256||'')){errors.push('INVALID_EVIDENCE_BINDING:'+String(b?.path));continue;}
    const file=path.resolve(repo,b.path);
    if(!file.startsWith(repo+path.sep)){errors.push('OUTSIDE_REPOSITORY_BINDING:'+b.path);continue;}
    if(!fs.existsSync(file)||!fs.statSync(file).isFile()){errors.push('EVIDENCE_FILE_MISSING:'+b.path);continue;}
    const real=fs.realpathSync(file),realRepo=fs.realpathSync(repo);
    if(!real.startsWith(realRepo+path.sep)){errors.push('OUTSIDE_REPOSITORY_BINDING:'+b.path);continue;}
    if(shaFile(real)!==b.sha256)errors.push('STALE_EVIDENCE:'+b.path);
  }
  if(required&&!bindings.length)errors.push('EVIDENCE_BINDINGS_REQUIRED');
  return errors;
}
