const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{chromium}=require('playwright'),{closeOwnedBrowser}=require('../../qa/bounded-browser.cjs'),{verifyFixture,compareFields,hash}=require('./fixture.cjs');
const out='train88-spatial-query-results',dir=__dirname,selected=(process.env.SPATIAL_VARIANTS||'capacity').split(',');
if(selected.some(x=>!['reference','capacity','hierarchy'].includes(x))||new Set(selected).size!==selected.length)throw Error('Explicit unique variants required');
fs.mkdirSync(out,{recursive:true});const report={commit:process.env.GITHUB_SHA,status:'starting',startedAt:new Date().toISOString(),scope:'one fixed 940-point state, independent process per variant, cached exact original reference, no whole scene',selected,variants:{},comparisons:[]};
const save=()=>fs.writeFileSync(out+'/receipt.json',JSON.stringify(report,null,2));
const server=http.createServer((req,res)=>{const p=path.resolve('.'+decodeURIComponent(req.url.split('?')[0]));if(!p.startsWith(process.cwd()+path.sep))return res.writeHead(403).end();try{res.setHeader('content-type',p.endsWith('.html')?'text/html':p.endsWith('.json')?'application/json':'text/javascript');res.end(fs.readFileSync(p));}catch{res.writeHead(404).end();}});
async function runVariant(variant,reference){
 let state={status:'starting',variant,startedAt:new Date().toISOString()},timer,hardTimer,owner,browser,settled=false,resolve,reject;
 const persist=()=>{report.variants[variant]=state;fs.writeFileSync(out+'/'+variant+'-receipt.json',JSON.stringify(state,null,2));save();};
 const done=new Promise((a,b)=>{resolve=a;reject=b});done.catch(()=>{});
 const fail=e=>{if(settled)return;settled=true;state.status='failed';state.failure=String(e);persist();reject(Error(String(e)));};
 const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>fail('No completed diagnostic stage for 200000ms'),200000);};
 try{
  owner=await chromium.launchServer({headless:true,args:['--no-sandbox','--disable-gpu-watchdog','--use-angle=swiftshader']});browser=await chromium.connect(owner.wsEndpoint());const page=await browser.newPage();
  await page.exposeFunction('__hierarchyReport',value=>{if(settled)return;state={...state,...value};persist();arm();if(value.status==='failed')fail(value.failure);else if(value.status==='isolated-field-and-warm-cost-measured'){settled=true;resolve();}});
  await page.exposeFunction('__saveHierarchyField',({name,bits})=>{if(!new RegExp('^'+variant+'-0\\.05-0-[012]$').test(name)||!Array.isArray(bits)||bits.length!==reference.manifest.points.length*16||bits.some(x=>!Number.isInteger(x)||x<0||x>0xffffffff))throw Error('Invalid raw bits receipt');const b=Buffer.alloc(bits.length*4);bits.forEach((x,i)=>b.writeUInt32LE(x,i*4));fs.writeFileSync(out+'/'+name+'.bin',b);});
  page.on('pageerror',e=>fail(e.stack));page.on('crash',()=>fail('Renderer process crashed'));page.on('console',m=>{if(m.text().startsWith('HALL_HIERARCHY_STAGE'))console.log(variant+' '+m.text());if(m.type()==='error')fail(m.text());});
  arm();hardTimer=setTimeout(()=>fail('Independent variant deadline 300000ms'),300000);persist();
  const navigate=page.goto('http://127.0.0.1:8789/kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01/kowloon-train88-r01/experiments/spatial-query-r01/probe.html?variant='+variant,{waitUntil:'domcontentloaded',timeout:200000});await Promise.race([navigate,done]);await done;
  if(state.adapter!==reference.fixture.adapter)throw Error('Different backend adapter from frozen reference');
  const expectedBits=Array.from(new Uint32Array(new Float32Array(reference.fixture.params).buffer));
  if(JSON.stringify(state.uniformBits)!==JSON.stringify(expectedBits))throw Error('Actual GPU uniform bits do not match fixed reference');
  for(let repeat=0;repeat<3;repeat++){const b=fs.readFileSync(out+'/'+variant+'-0.05-0-'+repeat+'.bin'),compared=compareFields(reference.field,b,reference.manifest.labels);report.comparisons.push({variant,age:.05,mode:0,repeat,fieldSHA256:hash(b),...compared});if(compared.mismatches)throw Error('Original GeometryHit changed: '+JSON.stringify(compared));}
  state.status='fixed-reference-equivalence-and-warm-cost-measured';
 }catch(e){state.status='failed';state.failure=e.stack||String(e);}finally{settled=true;clearTimeout(timer);clearTimeout(hardTimer);state.cleanup=await closeOwnedBrowser(browser,owner);state.finishedAt=new Date().toISOString();persist();}
}
(async()=>{try{const reference=verifyFixture(dir);report.reference={...reference.fixture,deflateBase64:undefined};await new Promise(r=>server.listen(8789,'127.0.0.1',r));for(const variant of selected)await runVariant(variant,reference);report.status=selected.every(x=>report.variants[x].status==='fixed-reference-equivalence-and-warm-cost-measured')?'fixed-state-capacity-query-measured':'failed';if(report.status==='failed')process.exitCode=1;}catch(e){report.status='failed';report.failure=e.stack||String(e);process.exitCode=1;}finally{report.finishedAt=new Date().toISOString();save();server.closeAllConnections();server.close();}})();
