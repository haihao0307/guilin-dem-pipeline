import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base=new URL(process.env.TEST_URL),expected=createHash('sha256').update(await readFile(new URL('./view.mjs',import.meta.url))).digest('hex'),deadline=Date.now()+600000;
while(Date.now()<deadline){try{const u=new URL('./view.mjs',base);u.searchParams.set('deployment-check','4b2ccd2d');const r=await fetch(u,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('HTTP '+r.status);const bytes=Buffer.from(await r.arrayBuffer()),observed=createHash('sha256').update(bytes).digest('hex');if(observed!==expected)throw Error('Waiting for expected runtime hash');console.log('Expected public runtime is live',observed);process.exit(0);}catch(e){console.log('Pages deployment pending:',e.message);}await new Promise(r=>setTimeout(r,10000));}
throw Error('Public deployment did not expose expected runtime within 10 minutes');
