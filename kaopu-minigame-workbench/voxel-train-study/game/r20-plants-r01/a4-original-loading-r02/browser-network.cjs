/* Run only in the authorized CI browser environment. Do not start a local browser for this task.
 * From repository root: node <path>/a4-original-loading-r02/browser-network.cjs
 * Requires Playwright + Chromium already provisioned by CI. No model files are downloaded or altered.
 */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {startTestServer}=require('./test-server.cjs');
const isFields=url=>/\/fields\.bin\.gz(?:\?|$)/.test(url);
const forbidden=url=>/\/mark3\/|a6-native|student-native|rod-rebuild|wheel-rebuild|rule-conversion/i.test(url);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function snapshot(page){return page.evaluate(()=>{
  const q=window.A4_REPLICA,s=q?.source,l=window.LOAD_STATE;
  const textureBindings=s?s.primitives.flatMap(p=>{const material=p.definition.material,texture=s.g.materials[material]?.pbrMetallicRoughness?.baseColorTexture?.index;if(texture===undefined)return[];
    const image=s.g.textures[texture].source,map=p.object.material.map;return[{node:p.sourceNode,material,texture,image,payload:s.object.content.images[image].payload,
      visible:p.object.visible,width:Number(map?.image?.width||0),height:Number(map?.image?.height||0)}];}):[];
  return {ready:!!q?.ready,errors:(q?.errors||[]).map(String),status:document.querySelector('#status')?.textContent||'',
    load:l?{stage:l.stage,url:String(l.url||''),loaded:l.loaded,total:l.total,attempt:l.attempt,failed:l.failed,error:String(l.error||''),events:JSON.parse(JSON.stringify(l.events||[]))}:null,
    source:s?{nodes:s.g.nodes.length,meshes:s.g.meshes.length,materials:s.g.materials.length,images:s.g.images.length,textures:s.g.textures.length,
      clips:s.model.animations.length,tracks:s.model.animations.reduce((n,c)=>n+c.tracks.length,0),allPrimitivesVisible:s.primitives.every(p=>p.object.visible),
      sourceObjectSHA256:s.root.userData.recovery?.sourceObjectSHA256,generatedReplacementParts:s.root.userData.recovery?.generatedReplacementParts,textureBindings}:null,
    cameraType:q?.camera?.type,geometryOrMaterialReplacement:q?.geometryOrMaterialReplacement,uiSamples:window.__networkQaUiSamples||[],fieldsProgress:window.__networkQaFieldsProgress||[],downloadCompletions:window.__networkQaDownloadCompletions||[]};
});}
function assertComplete(state){
  assert(state.ready,JSON.stringify(state));assert.deepEqual(state.errors,[]);assert.equal(state.load?.failed,false);
  assert.equal(state.source.nodes,331);assert.equal(state.source.meshes,200);assert.equal(state.source.materials,22);
  assert.equal(state.source.images,2);assert.equal(state.source.textures,3);assert.equal(state.source.clips,1);assert.equal(state.source.tracks,71);
  assert(state.source.allPrimitivesVisible);assert.equal(state.source.generatedReplacementParts,false);
  assert.equal(state.source.sourceObjectSHA256,'749efd6d1b1a19aa97d9d024baa33f4f5df382eb19a2be88c10ef7ba6e1a5fe4');
  assert.notEqual(state.geometryOrMaterialReplacement,true);
  assert.equal(state.cameraType,'OrthographicCamera');
  assert.equal(new Set(state.source.textureBindings.map(b=>b.texture)).size,3,'All three original texture bindings must exist');
  assert(state.source.textureBindings.every(b=>b.visible&&b.width>0&&b.height>0),'An original texture image is absent or undecoded');
}

function classifyRequestFailures(row,serverRequests){
  row.unexpectedFailures=[];row.completedBodyLifecycleEvents=[];
  for(const failure of row.requestFailures){
    const request=row.networkRequests.find(r=>r.id===failure.requestId);
    if(isFields(failure.url)&&((row.scenario==='partial-fields-disconnect'&&request.attempt===1)||row.scenario==='permanent-fields-failure')){failure.classification='injectedFailure';continue;}
    const served=serverRequests.filter(r=>r.method==='GET'&&r.pathname===new URL(failure.url).pathname)[request.attempt-1];
    const completed=row.state.downloadCompletions.find(e=>e.url===failure.url&&e.attempt===request.attempt);
    // Keep the raw failure. Accept only an ERR_ABORTED for a body independently proven complete at BOTH ends,
    // after the original loader's SHA/parse gates and actual material-image decoding have passed.
    const verified=row.state.ready&&!row.state.load.failed&&row.state.errors.length===0&&row.state.source?.sourceObjectSHA256==='749efd6d1b1a19aa97d9d024baa33f4f5df382eb19a2be88c10ef7ba6e1a5fe4';
    const textures=row.state.source?.textureBindings;
    if(failure.error==='net::ERR_ABORTED'&&request.resourceType==='fetch'&&request.responseStatus===200&&verified&&
      textures?.length&&textures.every(b=>b.visible&&b.width>0&&b.height>0)&&new Set(textures.map(b=>b.texture)).size===3&&
      completed&&completed.total>0&&completed.loaded===completed.total&&served?.finishedAt&&!served.closedEarly&&!served.cut&&
      served.bytesSent===served.totalBytes&&completed.loaded===served.totalBytes){
      failure.classification='completedBodyLifecycleEvent';row.completedBodyLifecycleEvents.push({failure,clientCompletion:completed,serverCompletion:{bytesSent:served.bytesSent,totalBytes:served.totalBytes,finishedAt:served.finishedAt},shaAndTextureDecodePassed:true});
    }else{failure.classification='unexpectedFailure';row.unexpectedFailures.push(failure);}
  }
}

async function main(){
  const root=path.resolve(process.env.REPO_ROOT||process.cwd()),output=path.resolve(process.env.NETWORK_QA_OUT||path.join(__dirname,'qa-network'));
  const entry=path.relative(root,__dirname);assert(!entry.startsWith('..')&&!path.isAbsolute(entry),'Entry must be inside the served repository');
  fs.mkdirSync(output,{recursive:true});
  const fixture=await startTestServer({root,slowChunkBytes:512*1024,slowDelayMs:100});
  const entryURL=new URL(entry.split(path.sep).map(encodeURIComponent).join('/')+'/index.html',fixture.url+'/').href;
  let browser;const cases=[];
  try{
    browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    for(const scenario of ['normal','partial-fields-disconnect','permanent-fields-failure','slow-continuous-fields']){
      const context=await browser.newContext({viewport:{width:1440,height:960},serviceWorkers:'block'}),page=await context.newPage();
      page.setDefaultTimeout(120000);
      const row={scenario,syntheticFaultInjection:scenario!=='normal',physicalDeviceTested:false,fieldsRequests:[],networkRequests:[],requestFailures:[],cleanupFailures:[],pageErrors:[],unexpectedFailures:[],httpErrors:[],forbiddenRequests:[],maximumFieldsInFlight:0,routeCount:0,passed:false};
      cases.push(row);const inFlight=new Set(),requestRecords=new Map(),serverStart=fixture.requests.length;let firstRoute=true;
      await page.addInitScript(()=>{
        window.__networkQaUiSamples=[];window.__networkQaFieldsProgress=[];window.__networkQaDownloadCompletions=[];const seen=new WeakSet();
        const install=()=>{const element=document.querySelector('#status');if(!element)return;
          const capture=()=>{
            const text=element.textContent,list=window.__networkQaUiSamples;
            if(list.at(-1)?.text!==text){list.push({at:performance.now(),text});if(list.length>3000)list.shift();}
            for(const event of window.LOAD_STATE?.events||[])if(event.stage==='下载完成'&&!seen.has(event)){seen.add(event);window.__networkQaDownloadCompletions.push({...event,url:String(event.url),observedAt:performance.now()});}
            // Capture the real public progress while downloading. Later inflate events may evict it from LOAD_STATE's bounded history.
            const e=window.LOAD_STATE?.events?.at(-1),events=window.__networkQaFieldsProgress;
            if(e&&/\/fields\.bin\.gz(?:\?|$)/.test(String(e.url||''))&&Number(e.loaded)>0&&
              (events.at(-1)?.loaded!==e.loaded||events.at(-1)?.attempt!==e.attempt))events.push({stage:e.stage,url:String(e.url),loaded:Number(e.loaded),total:e.total,attempt:e.attempt,time:e.time,observedAt:performance.now()});
          };
          new MutationObserver(capture).observe(element,{subtree:true,childList:true,characterData:true});capture();
        };document.addEventListener('DOMContentLoaded',install,{once:true});
      });
      page.on('pageerror',e=>row.pageErrors.push(String(e)));
      page.on('request',request=>{
        if(forbidden(request.url()))row.forbiddenRequests.push(request.url());
        const record={id:row.networkRequests.length,url:request.url(),resourceType:request.resourceType(),startedAt:Date.now(),attempt:1+row.networkRequests.filter(r=>r.url===request.url()).length};row.networkRequests.push(record);requestRecords.set(request,record);
        if(isFields(request.url())){inFlight.add(request);row.maximumFieldsInFlight=Math.max(row.maximumFieldsInFlight,inFlight.size);row.fieldsRequests.push(record);}
      });
      page.on('requestfinished',request=>{const r=requestRecords.get(request);if(r)r.finishedAt=Date.now();if(isFields(request.url()))inFlight.delete(request);});
      page.on('requestfailed',request=>{
        if(isFields(request.url()))inFlight.delete(request);const r=requestRecords.get(request),error=request.failure()?.errorText;if(r){r.failure=error;r.failedAt=Date.now();}
        (row.observationClosed?row.cleanupFailures:row.requestFailures).push({requestId:r?.id,url:request.url(),error,at:Date.now()});
      });
      page.on('response',response=>{const r=requestRecords.get(response.request());if(r){r.responseStatus=response.status();r.responseAt=Date.now();}if(response.status()>=400)row.httpErrors.push({url:response.url(),status:response.status()});});
      await page.route(/\/fields\.bin\.gz(?:\?.*)?$/,async route=>{
        row.routeCount++;
        if(scenario==='permanent-fields-failure'){firstRoute=false;await route.abort('connectionreset');return;}
        if(scenario==='partial-fields-disconnect'&&firstRoute){firstRoute=false;const url=new URL(route.request().url());url.searchParams.set('_qaCut','1');await route.continue({url:url.href});return;}
        firstRoute=false;
        if(scenario==='slow-continuous-fields'){const url=new URL(route.request().url());url.searchParams.set('_qaSlow','1');await route.continue({url:url.href});}
        else await route.continue();
      });
      const url=new URL(entryURL);url.searchParams.set('loadMaxAttempts','2');
      const idleMs=scenario==='slow-continuous-fields'?500:5000;url.searchParams.set('loadIdleMs',String(idleMs));row.url=url.href;row.idleMs=idleMs;
      try{
        await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:120000});
        await page.waitForFunction(()=>window.A4_REPLICA?.ready||(window.LOAD_STATE?.failed&&window.A4_REPLICA?.errors?.length),null,{timeout:300000});
        row.state=await snapshot(page);
        assert.deepEqual(row.forbiddenRequests,[]);assert.deepEqual(row.httpErrors,[]);assert.deepEqual(row.pageErrors,[]);
        assert.equal(row.maximumFieldsInFlight,1,'Fields attempts must be serialized, not overlapping');
        if(scenario==='permanent-fields-failure'){
          assert.equal(row.state.ready,false);assert.equal(row.state.load.failed,true);assert(row.state.errors.length>0);
          assert.equal(row.routeCount,2,'Permanent failure must stop after two attempts');
          const failURL=row.fieldsRequests[0].url,stage=row.state.load.stage,errorText=[row.state.load.error,...row.state.errors].join('\n');
          assert(stage&&stage.length>0,'Failure stage must be exposed');assert.equal(row.state.load.url,failURL,'Failed resource URL must be retained');
          assert(errorText.includes(failURL),'Machine-readable error must include the full failed URL');assert(errorText.includes(stage),'Machine-readable error must include the stage');
          assert(row.state.status.includes(failURL),'Visible failure must include the full failed URL');
          assert(row.state.status.includes(stage),'Visible failure must include the stage');
          const before=row.state.status;await pause(1000);const later=await snapshot(page);
          assert.equal(row.routeCount,2,'Unexpected third attempt after terminal failure');assert.equal(later.status,before,'Final error was overwritten by later progress');
          row.terminalFailureStayedVisible=true;
        }else{
          assertComplete(row.state);
          assert.equal(row.routeCount,scenario==='partial-fields-disconnect'?2:1);
          if(scenario==='normal'){
            const pose=()=>page.evaluate(()=>A4_REPLICA.source.nodes.map(n=>[...n.position.toArray(),...n.quaternion.toArray(),...n.scale.toArray()]));
            const rest=await pose();await page.click('#play');await page.waitForTimeout(180);
            await page.waitForFunction(()=>A4_REPLICA.source.nodes.some((n,i)=>!n.position.equals(A4_REPLICA.source.rest[i].position)||!n.quaternion.equals(A4_REPLICA.source.rest[i].quaternion)),null,{timeout:15000});
            await page.click('#play');assert.equal(await page.locator('#play').textContent(),'播放原动画');
            const paused=await pose();assert.notDeepEqual(paused,rest);await page.waitForTimeout(180);assert.deepEqual(await pose(),paused,'Animation did not pause');
            await page.click('#rest');assert.deepEqual(await pose(),rest,'Original static pose was not exactly restored');
            row.animationChanged=true;row.pauseStable180ms=true;row.originalRestExactlyRestored=true;
          }
          if(scenario==='partial-fields-disconnect'){
            assert(row.fieldsRequests[0].failure,'First injected request failure was not observed');
            const served=fixture.requests.find(r=>r.cut);assert(served?.injectedTruncation);assert.equal(served.bytesSent,512*1024);assert(served.closedEarly);
            const partial=row.state.fieldsProgress.filter(e=>e.attempt===1&&e.loaded>0&&e.loaded<served.totalBytes);assert(partial.length>0,'No client byte progress before disconnection');
            row.recoveredAfterPartialBodyDisconnect=true;row.partialBytesObserved=Math.max(...partial.map(e=>e.loaded));
          }
          if(scenario==='slow-continuous-fields'){
            const served=fixture.requests.filter(r=>r.slow&&r.pathname.endsWith('/fields.bin.gz')).at(-1);assert(served,'Delayed HTTP body was not served');
            assert.equal(served.closedEarly,false);assert.equal(served.bytesSent,served.totalBytes);assert(served.chunkEvents.length>=4);
            const streamDurationMs=served.chunkEvents.at(-1).at-served.chunkEvents[0].at;
            assert(streamDurationMs>idleMs*2,'Slow stream must outlast the idle limit by a substantial margin');
            const events=row.state.fieldsProgress,loads=[...new Set(events.map(e=>Number(e.loaded)))].sort((a,b)=>a-b);
            assert(loads.length>=4,'Loader must expose increasing received-byte progress, not only completion');
            assert(loads.some(x=>x<served.totalBytes),'No partial-body progress was exposed');assert(loads.at(-1)===served.totalBytes,'Final progress byte count differs from served body');
            const uiProgress=row.state.uiSamples.filter(x=>/fields\.bin\.gz/.test(x.text)&&/[0-9]/.test(x.text));
            assert(new Set(uiProgress.map(x=>x.text)).size>=4,'Visible loader progress did not update during the streamed body');
            row.slowStream={streamDurationMs,idleMs,serverChunks:served.chunkEvents.length,clientDistinctLoadedValues:loads.length,totalBytes:served.totalBytes,visibleProgressSamples:uiProgress.length};
          }
        }
        await page.screenshot({path:path.join(output,scenario+'.png')});row.state=await snapshot(page);
        if(scenario!=='permanent-fields-failure')assertComplete(row.state);
        classifyRequestFailures(row,fixture.requests.slice(serverStart));
        assert.deepEqual(row.unexpectedFailures,[]);assert.deepEqual(row.httpErrors,[]);assert.deepEqual(row.pageErrors,[]);assert.deepEqual(row.forbiddenRequests,[]);row.passed=true;
      }catch(error){
        row.failure=error.stack||String(error);try{row.failureState=await snapshot(page);await page.screenshot({path:path.join(output,scenario+'-failed.png')});}catch{}
        throw error;
      }finally{row.observationClosed=true;await context.close();}
    }
  }finally{
    if(browser)await browser.close();await fixture.close();
    fs.writeFileSync(path.join(output,'REPORT.json'),JSON.stringify({status:cases.length===4&&cases.every(x=>x.passed)?'PASS':'FAIL',entryURL,cases,
      physicalDeviceTested:false,syntheticFaultInjection:true,sourceModelModified:false,fixtureServesRepositoryOnly:true,
      serverRequests:fixture.requests,limits:['Synthetic CI failure/slow-stream tests are not an iPhone/iPad or user-network reproduction.','No geometry, material, source animation or model files are changed.']},null,2));
  }
}
module.exports={classifyRequestFailures};
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
