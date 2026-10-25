'use strict';
/** Regress the exact 66 MB freshness failure without launching a browser.
 * This tests actual verifier helpers and local bytes, not real CDP transport. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {pathToFileURL,fileURLToPath}=require('node:url');
const root=path.dirname(__dirname),source=fs.readFileSync(path.join(root,'verify-browser.cjs'),'utf8');
const begin='// BEGIN navigation payload receipt',end='// END navigation payload receipt.';
assert.equal(source.split(begin).length,2);assert.equal(source.split(end).length,2);
const code=source.slice(source.indexOf(begin),source.indexOf(end));
const sandbox={fs,assert,URL,Buffer,fileURLToPath};
vm.runInNewContext(code+'\nthis.helpers={prepareNavigationCapture,readNavigationBytes,NAVIGATION_NETWORK_BUFFERS};',sandbox);
const {prepareNavigationCapture,readNavigationBytes,NAVIGATION_NETWORK_BUFFERS}=sandbox.helpers;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const input=path.join(root,'preview.html'),expected=fs.readFileSync(input),build=JSON.parse(fs.readFileSync(path.join(root,'BUILD.json'),'utf8'));
assert.equal(sha(expected),build.previewSHA256,'Regression must use the actual current built HTML');
const bounded=async(label,fn)=>fn(),tests=[];
async function test(name,fn){try{await fn();tests.push({name,passed:true});}catch(error){tests.push({name,passed:false,error:error.stack});}}
function publicOptions({body=expected.toString('utf8'),base64Encoded=false}={}){
  const url='https://fixture.invalid/fixed-candidate/',calls=[];
  const response={status:()=>200,url:()=>url,finished:async()=>null,body:async()=>{throw Error('Must not read Playwright separate inspector session');}};
  const options={deliveryMode:'deployed-url',requestedURL:url,finalURL:url,input,response,bounded,
    documents:[{requestId:'navigation-1',loaderId:'loader-1',frameId:'main-frame',url,status:200,mimeType:'text/html'}],
    sendCDP:async(label,method,params)=>{calls.push({method,params});if(method==='Page.getFrameTree')return{frameTree:{frame:{id:'main-frame',loaderId:'loader-1',url}}};
      if(method==='Network.getResponseBody'){assert.equal(params.requestId,'navigation-1');return{body,base64Encoded};}throw Error('Unexpected extra transport '+method);}};
  return {options,calls};
}
(async()=>{
  await test('file response object never forces inspector-cache body reading',async()=>{
    let bodyCalls=0,cdpCalls=0;const url=pathToFileURL(input).href;
    const result=await readNavigationBytes({deliveryMode:'file-protocol',requestedURL:url,finalURL:url,input,
      response:{body:async()=>{bodyCalls++;throw Error('Request content was evicted from inspector cache');}},bounded,
      sendCDP:async()=>{cdpCalls++;throw Error('File receipt does not require network body');}});
    assert.equal(bodyCalls,0);assert.equal(cdpCalls,0);assert.equal(result.receipt.method,'exact-navigated-file-bytes');
    assert.equal(result.receipt.path,fs.realpathSync(input));assert.equal(sha(result.bytes),build.previewSHA256);assert.equal(result.bytes.length,expected.length);
  });
  await test('file receipt rejects a different navigated local file',async()=>{
    const url=pathToFileURL(path.join(root,'BUILD.json')).href;
    await assert.rejects(readNavigationBytes({deliveryMode:'file-protocol',requestedURL:url,finalURL:url,input,bounded}),/exact built file/);
  });
  await test('session-local buffers explicitly cover the complete 66 MB document',async()=>{
    const calls=[],handlers={};const session={on:(name,fn)=>{handlers[name]=fn;},send:async(method,params)=>calls.push({method,params})};
    const documents=await prepareNavigationCapture(session);
    assert.equal(calls.length,1);assert.equal(calls[0].method,'Network.enable');
    assert.equal(calls[0].params.maxResourceBufferSize,128*1024*1024);assert.equal(calls[0].params.maxTotalBufferSize,256*1024*1024);
    assert(calls[0].params.maxResourceBufferSize>expected.length);assert(calls[0].params.maxTotalBufferSize>=2*calls[0].params.maxResourceBufferSize);
    const event={type:'Document',requestId:'r',frameId:'f',loaderId:'l',response:{url:'https://fixture.invalid/',status:200,mimeType:'text/html'}};
    handlers['Network.responseReceived']({...event,type:'Image'});assert.equal(documents.length,0);
    handlers['Network.responseReceived'](event);assert.equal(documents.length,1);assert.equal(documents[0].requestId,'r');
  });
  await test('large public body is read from the same captured navigation request',async()=>{
    const {options,calls}=publicOptions();const result=await readNavigationBytes(options);
    assert.equal(sha(result.bytes),build.previewSHA256);assert.equal(result.bytes.length,expected.length);
    assert.equal(result.receipt.requestId,'navigation-1');assert.equal(result.receipt.separateHTTPFetch,false);
    assert.deepEqual(calls.map(c=>c.method),['Page.getFrameTree','Network.getResponseBody']);
  });
  await test('base64 CDP bodies preserve their exact original bytes',async()=>{
    const bytes=Buffer.from('<!doctype html><p>完整人物</p>\n','utf8'),{options}=publicOptions({body:bytes.toString('base64'),base64Encoded:true});
    const result=await readNavigationBytes(options);assert.equal(sha(result.bytes),sha(bytes));
  });
  await test('stale main-frame loader cannot supply another document body',async()=>{const {options}=publicOptions();options.documents[0].loaderId='stale-loader';await assert.rejects(readNavigationBytes(options),/Exactly one captured/);});
  await test('iframe response cannot supply the main candidate body',async()=>{const {options}=publicOptions();options.documents[0].frameId='iframe';await assert.rejects(readNavigationBytes(options),/Exactly one captured/);});
  await test('ambiguous duplicate document capture is rejected',async()=>{const {options}=publicOptions();options.documents.push({...options.documents[0]});await assert.rejects(readNavigationBytes(options),/Exactly one captured/);});
  await test('HTTP errors retain the 200 status gate',async()=>{const {options}=publicOptions();options.response.status=()=>404;await assert.rejects(readNavigationBytes(options),/HTTP 200/);});
  await test('redirect to another URL cannot masquerade as the fixed candidate',async()=>{const {options}=publicOptions();options.finalURL='https://fixture.invalid/old-version/';await assert.rejects(readNavigationBytes(options),/exact candidate URL/);});
  await test('body eviction remains a failure with no separate HTTP fallback',async()=>{const {options}=publicOptions();const previous=options.sendCDP;options.sendCDP=async(...args)=>{if(args[1]==='Network.getResponseBody')throw Error('fixture body evicted');return previous(...args);};await assert.rejects(readNavigationBytes(options),/fixture body evicted/);});
  await test('the main verifier still gates exact SHA and built byte count',()=>{
    assert(source.includes("assert.equal(report.observedPreviewSHA256,expectedSHA,'Browser loaded the exact current build')"));
    assert(source.includes("assert.equal(actual.bytes.length,build.previewBytes,'The actual candidate has the exact built byte count')"));
    assert(source.indexOf("prepareNavigationCapture(cdp)")<source.indexOf("page.goto(report.url"),'Network capture is enabled before actual navigation');
  });
  const report={schema:'kaopu/r03-navigation-payload-regression@1',scope:'Actual verifier helpers exercised with exact local candidate bytes and fake CDP transport; not browser/CDP integration evidence',
    candidateBytes:expected.length,candidateSHA256:build.previewSHA256,verifierSHA256:sha(source),testSHA256:sha(fs.readFileSync(__filename)),
    officialSources:['https://chromedevtools.github.io/devtools-protocol/tot/Network/#method-enable','https://playwright.dev/docs/api/class-cdpsession'],
    buffers:NAVIGATION_NETWORK_BUFFERS,tests,total:tests.length,passed:tests.every(t=>t.passed)};
  assert.equal(tests.length,12);fs.writeFileSync(path.join(__dirname,'audit-r03-navigation-payload.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
