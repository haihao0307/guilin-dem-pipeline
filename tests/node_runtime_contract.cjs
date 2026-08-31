/* Frontend execution contract under a DOM/WebGL stub. This is NOT browser visual QA.
 * Real HTTP requests, chunk hashes, frontend sample mapping and geometry inputs are
 * exercised. Rasterization and browser input behavior require browser_qa.py.
 */
'use strict';
const fs=require('fs');const vm=require('vm');const cryptoNode=require('crypto');
const [appPath,baseUrl,resultPath]=process.argv.slice(2);
if(!appPath||!baseUrl||!resultPath)throw new Error('node node_runtime_contract.cjs app.js http://host/guilin/ result.json');
const uploads={native:null};let drawCalls=0;const errors=[];const requests=[];
const originalFetch=global.fetch;
global.fetch=async function(input,init){
 const url=new URL(String(input),baseUrl).href;
 if(/\.tiff?(?:\?|$)|guilin-truth-data|native-r\d/.test(url))throw new Error('Forbidden old data request '+url);
 const response=await originalFetch(url,init);
 requests.push({url,range:init?.headers?.Range||null,status:response.status,bytes:Number(response.headers.get('content-length')||0)});
 return response;
};
const constants={ARRAY_BUFFER:34962,ELEMENT_ARRAY_BUFFER:34963,FLOAT:5126,UNSIGNED_INT:5125,STATIC_DRAW:35044,VERTEX_SHADER:35633,FRAGMENT_SHADER:35632,COMPILE_STATUS:35713,LINK_STATUS:35714,TRIANGLES:4,TRIANGLE_STRIP:5,POINTS:0};
const gl=new Proxy(constants,{get(target,key){
 if(key in target)return target[key];
 if(String(key).startsWith('create')||key==='getUniformLocation')return()=>({});
 if(key==='getShaderParameter'||key==='getProgramParameter')return()=>true;
 if(key==='getShaderInfoLog'||key==='getProgramInfoLog')return()=>'';
 if(key==='getError')return()=>0;
 if(key==='bufferData')return(t,data)=>{if(data instanceof Float32Array&&data.length===640*640*8)uploads.native=data;};
 if(key==='drawElements'||key==='drawArrays'||key==='drawArraysInstanced')return()=>{drawCalls++;};
 if(String(key).startsWith('texImage')||String(key).startsWith('texStorage'))return()=>{throw new Error('Texture upload forbidden');};
 if(String(key).toUpperCase()===key)return 1;
 return()=>{};
}});
class Element{
 constructor(id){this.id=id;this.hidden=['errorCard','detailLoading'].includes(id);this.style={};this.dataset={};this.clientWidth=1280;this.clientHeight=900;this.width=1280;this.height=900;this.checked=true;this.value='1.0';this.children=[];this.classList={toggle:()=>false,contains:()=>false,add(){},remove(){}};}
 addEventListener(){};setAttribute(){};getBoundingClientRect(){return{left:0,top:0,width:this.clientWidth,height:this.clientHeight};}
 getContext(){return gl;}appendChild(e){this.children.push(e);}replaceChildren(){this.children=[];}setPointerCapture(){}
}
const elements=new Map();global.window=globalThis;global.location=new URL(baseUrl);
global.document={getElementById(id){if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);},querySelectorAll(){return[];},createElement(){return new Element('created');},body:new Element('body')};
global.getComputedStyle=e=>({display:e.hidden?'none':'block'});global.addEventListener=()=>{};
global.requestAnimationFrame=f=>setTimeout(()=>f(performance.now()),1);global.devicePixelRatio=1;
const check=(v,m)=>{if(!v)throw new Error(m);};
const wait=async(fn,ms=45000)=>{const until=Date.now()+ms;while(Date.now()<until){if(fn())return;await new Promise(r=>setTimeout(r,20));}throw new Error('Runtime wait timed out: '+JSON.stringify(global.__GUILIN_FULL_MAP_QA_RESULT));};
(async()=>{
 const result={schema:'guilin-frontend-numeric-contract/v1',passed:false,real_browser:false,webgl_rasterization_performed:false,visualAcceptance:false,productionReady:false};
 try{
  vm.runInThisContext(fs.readFileSync(appPath,'utf8'),{filename:appPath});
  await wait(()=>global.__GUILIN_FULL_MAP_TEST_API&&global.__GUILIN_FULL_MAP_QA_RESULT?.passed);
  const api=global.__GUILIN_FULL_MAP_TEST_API;const initial=api.getState();
  check(initial.native_chunk_count===840,'Chunk count wrong');check(initial.canonical_range_request_count===0,'Initial detail fetch');
  result.initial=initial;result.initial_response_body_bytes=requests.reduce((s,x)=>s+x.bytes,0);result.patches=[];
  const inspect=()=>{
   const w=api.detailWindow();check(w&&w.width===640&&w.height===640,'Detail window wrong');
   const data=new Int16Array(w.width*w.height);let maxError=0,nonzero=0;
   for(let r=0;r<w.height;r++)for(let c=0;c<w.width;c++){
    const i=r*w.width+c;const v=api.sampleLoaded(w.startRow+r,w.startColumn+c);data[i]=v;
    if(v!==0){nonzero++;maxError=Math.max(maxError,Math.abs(uploads.native[i*8+6]-v));}
   }
   check(maxError===0,'Geometry input elevation mismatch');
   return{window:w,samples:data.length,valid_samples:nonzero,sha256:cryptoNode.createHash('sha256').update(Buffer.from(data.buffer)).digest('hex'),geometry_input_maximum_elevation_error_m:maxError};
  };
  for(const name of ['guilin','yangshuo','yangtang','zhenbaoding']){
   api.focusAnchor(name);await new Promise(r=>setTimeout(r,400));await api.activateNativeDetail();
   await wait(()=>api.getState().native_detail_active);result.patches.push({anchor:name,...inspect()});
  }
  await api.focusAOIPixel(17620,11930);result.patches.push({anchor:'southeast-edge',...inspect()});
  const detail=api.getState();result.detail=detail;
  const ranges=requests.filter(x=>x.url.includes('.i16pack'));
  check(ranges.length>0&&ranges.every(x=>x.range&&x.status===206&&x.bytes<=524288),'HTTP range contract failed');
  api.resetFull();await new Promise(r=>setTimeout(r,400));check(api.getState().full_aoi_overview,'Full map reset failed');
  result.range_requests=ranges;result.maximum_range_response_bytes=Math.max(...ranges.map(x=>x.bytes));result.draw_calls_dispatched_to_stub=drawCalls;
  result.source_tiff_requests=0;result.legacy_tile_requests=0;result.passed=true;
 }catch(e){result.error=String(e.stack||e);errors.push(result.error);}
 fs.writeFileSync(resultPath,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({passed:result.passed,error:result.error,patches:result.patches?.length}));process.exit(result.passed?0:1);
})();
