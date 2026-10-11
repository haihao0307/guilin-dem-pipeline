import fs from 'node:fs';
import crypto from 'node:crypto';
const root=new URL('./',import.meta.url),lock=JSON.parse(fs.readFileSync(new URL('source-lock.json',root)));
for(const row of lock.restoredSources){const bytes=fs.readFileSync(new URL(row.localPath,root));const sha=crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');if(sha!==row.gitBlobSHA)throw Error('Original source changed: '+row.localPath);}
console.log(`${lock.restoredSources.length} original source Git blobs match ${lock.commit}`);
