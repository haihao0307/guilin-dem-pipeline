/* QA-only: intercept only four reviewed text paths while loading current public pages. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
exports.apply=async(context,report)=>{
 const enabled=process.env.OVERVIEW_LIFECYCLE_CANDIDATE==='true';
 report.candidateTextOverrides={enabled,files:[],routingPolicy:"Both modes use the same routing hook and HTTP cache policy; baseline continues every request without replacing bytes."};
 if(process.env.OVERVIEW_LIFECYCLE_PUBLISHED==='true'){if(enabled)throw Error('Published validation must not override any resource');report.candidateTextOverrides.routingPolicy='Native public requests; no route handler installed';return;}
 const scope=JSON.parse(fs.readFileSync(path.join(__dirname,'overview-lifecycle-scope.json'),'utf8'));
 const files=new Map();
 for(const item of scope.files){
  if(!/\.(mjs|json)$/.test(item.path))throw Error('Only reviewed text candidates are permitted');
  const data=fs.readFileSync(item.path);if(crypto.createHash('sha256').update(data).digest('hex')!==item.sha256)throw Error('Candidate text hash mismatch: '+item.path);
  files.set('/guilin-dem-pipeline/'+item.path,{item,data});
  report.candidateTextOverrides.files.push({path:item.path,sha256:item.sha256,hits:0});
 }
 await context.route('https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/**',async route=>{
  const url=new URL(route.request().url()),entry=files.get(url.pathname);
  if(!enabled||!entry)return route.continue();
  report.candidateTextOverrides.files.find(x=>x.path===entry.item.path).hits++;
  await route.fulfill({status:200,contentType:entry.item.path.endsWith('.json')?'application/json':'text/javascript',body:entry.data});
 });
};
