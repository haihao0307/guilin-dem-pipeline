/** Lossless measurement helpers. No quantization, geometry changes or rendering.
 * The separately versioned qualification contract below covers measured cells only.
 * Materialize every own data property and every native prototype getter, so compact
 * organ views are compared in full instead of disappearing under JSON.stringify.
 * All reachable typed arrays retain their exact type, length and original bytes.
 */
export function captureNativeSpecimen(specimen){
 const arrays=[],active=new Set();
 function visit(value,path){
  if(typeof value==='number')return Object.is(value,-0)?{$number:'-0'}:Number.isNaN(value)?{$number:'NaN'}:!Number.isFinite(value)?{$number:String(value)}:value;
  if(value===undefined)return {$undefined:true};
  if(value===null||typeof value==='string'||typeof value==='boolean')return value;
  if(typeof value!=='object')throw Error('Unsupported native data at '+path+': '+typeof value);
  if(ArrayBuffer.isView(value)){
   if(value instanceof DataView)throw Error('Unexpected DataView at '+path);
   arrays.push({path,type:value.constructor.name,length:value.length,bytes:value.byteLength,array:value});
   return {$typedArray:{path,type:value.constructor.name,length:value.length,bytes:value.byteLength}};
  }
  if(active.has(value))throw Error('Native graph cycle at '+path);
  active.add(value);let result;
  if(Array.isArray(value))result=Array.from({length:value.length},(_,i)=>visit(value[i],path+'['+i+']'));
  else{
   const keys=Object.keys(value),prototypes=[];
   for(let p=Object.getPrototypeOf(value);p&&p!==Object.prototype;p=Object.getPrototypeOf(p)){
    prototypes.push(p.constructor?.name??null);
    for(const key of Object.getOwnPropertyNames(p)){const d=Object.getOwnPropertyDescriptor(p,key);if(d.get&&!keys.includes(key))keys.push(key);}
   }
   result={$object:value.constructor?.name??null,$prototypes:prototypes,$properties:keys.map(key=>[key,visit(value[key],path+'.'+key)])};
  }
  active.delete(value);return result;
 }
 const graph=visit(specimen,'specimen');
 // The original compact blade class also exposes its exact 44-column storage.
 // Compare the live rows as Float64 bytes in addition to all materialized getters.
 const blades=specimen.growth.blades;
 if(blades.length&&typeof blades[0].chunk77==='function'){
  for(let start=0;start<blades.length;start+=4096){const count=Math.min(4096,blades.length-start),array=blades[start].chunk77(count);arrays.push({path:'specimen.growth.bladeStorage['+start+']',type:array.constructor.name,length:array.length,bytes:array.byteLength,array});}
 }
 return {graph,arrays};
}
export function compareNativeGraphs(node,browser){
 const result={exact:true,numbers:0,differentNumbers:0,maxAbs:0,maxRel:0,nodeNaNs:0,browserNaNs:0,nodeInfinities:0,browserInfinities:0,signedZeroDifferences:0,nonNumericDifferences:0,examples:[]};
 const numeric=v=>typeof v==='number'||v&&typeof v==='object'&&Object.hasOwn(v,'$number');
 const number=v=>typeof v==='number'?v:v.$number==='-0'?-0:Number(v.$number);
 const example=v=>{if(result.examples.length<100)result.examples.push(v);};
 function walk(a,b,path){
  if(numeric(a)&&numeric(b)){
   const x=number(a),y=number(b);result.numbers++;
   if(Number.isNaN(x))result.nodeNaNs++;if(Number.isNaN(y))result.browserNaNs++;
   if(!Number.isFinite(x)&&!Number.isNaN(x))result.nodeInfinities++;if(!Number.isFinite(y)&&!Number.isNaN(y))result.browserInfinities++;
   if(!Object.is(x,y)){result.exact=false;result.differentNumbers++;if(x===0&&y===0)result.signedZeroDifferences++;const d=Math.abs(x-y);if(Number.isFinite(d)){result.maxAbs=Math.max(result.maxAbs,d);result.maxRel=Math.max(result.maxRel,d/Math.max(Math.abs(x),Math.abs(y),Number.MIN_VALUE));}example({path,node:a,browser:b,abs:Number.isFinite(d)?d:String(d)});}return;
  }
  if(a===null||b===null||typeof a!=='object'||typeof b!=='object'){
   if(a!==b){result.exact=false;result.nonNumericDifferences++;example({path,node:a,browser:b});}return;
  }
  const ak=Object.keys(a),bk=Object.keys(b);
  if(Array.isArray(a)!==Array.isArray(b)||JSON.stringify(ak)!==JSON.stringify(bk)){result.exact=false;result.nonNumericDifferences++;example({path,keysNode:ak,keysBrowser:bk});}
  for(const k of new Set([...ak,...bk]))walk(a[k],b[k],path+'.'+k);
 }
 walk(node,browser,'$');return result;
}

/** Versioned contract for the actual Node22.23.3 / Chromium143 measurement.
 * Evidence: qualification run 38103398263, source commit 3b287126.
 * Rendering geometry and all six resources remain fully byte-exact. Only the
 * observed five Float64 blade cells and seven graph cells can differ, within
 * 2e-16 absolute error, with the exact measured whole native hash pair required.
 * This contract does not admit engines, seeds, stages or unknown hash outputs.
 */
export const MUSA_QUALIFICATION_CONTRACT=Object.freeze({version:'native78-musa-node22-chromium143-measurement/1',sourceHead:'d5f6ed0f41bdd6a4e4d1163190d3cd2135e8b122',sourceClosure:'50e4e4c3393417704f95be660c20e6bf15f7efe715ea8b8074a090e7003cd706',geometry:'90ee8e44193b450aecf7c437e45717634010f2d8f87e908dadfcca68eaa0dac9',nodeContent:'d29345d6d95a25c849930af1cbf4556486bbf1f302a131a9090639a29ee66b2c',chromiumContent:'983c3905c2adfe36079eb29369d37f70ac66bfadbe75fa7e188100be87f0a8a9',maxAbs:2e-16,maxBladeCellDifferences:5,maxGraphCellDifferences:7,graphNumbers:5914});
const bladeDifferenceIndices=Object.freeze([370,372,373,374,678]);
const graphDifferencePaths=Object.freeze([
 '$.$properties.1.1.$properties.4.1.0.$properties.8.1.2.$properties.1.1',
 '$.$properties.1.1.$properties.4.1.9.$properties.8.1.11.$properties.0.1.2',
 '$.$properties.1.1.$properties.5.1.8.$properties.16.1.1',
 '$.$properties.1.1.$properties.5.1.8.$properties.17.1.0',
 '$.$properties.1.1.$properties.5.1.8.$properties.17.1.1',
 '$.$properties.1.1.$properties.5.1.8.$properties.17.1.2',
 '$.$properties.1.1.$properties.5.1.15.$properties.16.1.1'
]);
const geometryManifest=Object.freeze([['positions','Float32Array',61896],['normals','Float32Array',61896],['colors','Float32Array',61896],['uvs','Float32Array',41264],['indices','Uint32Array',108990],['windWeights','Float32Array',20632],['windChannels','Float32Array',82528],['windAnchors','Float32Array',61896],['windLeafAxes','Float32Array',61896],['windLeafNormals','Float32Array',61896],['bladeRanges77','Uint32Array',112]]);
export function qualifyMusaMeasurements(report,knownPairs){
 const c=MUSA_QUALIFICATION_CONTRACT,profile={condition76:'normal',habitatForm:'sheltered',leafNaturalismVersion:73,material:'wild-reference',productionSystemVersion:78,profileVersion:8,reproductive76:false,seed:761014,species:'musa-balbisiana',stage:'establishing',treeLeafVersion:75,tropicalLibraryVersion:76},sort=v=>v&&typeof v==='object'?Array.isArray(v)?v.map(sort):Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;
 const manifest=[...geometryManifest.map(([key,type,length])=>['specimen.geometry.'+key,type,length]),...[16384,16384,16384,262144,262144,262144].map((length,i)=>['specimen.surfaces.resources['+i+'].bytes','Uint8Array',length]),['specimen.growth.bladeStorage[0]','Float64Array',1232]],arrays=report.arrays??[],graph=report.graph??{},blade=arrays.find(a=>a.path==='specimen.growth.bladeStorage[0]'),finite=x=>['nodeNaNs','browserNaNs','nodeInfinities','browserInfinities','signedZeroDifferences'].every(k=>x[k]===0);
 const known=s=>Array.isArray(knownPairs)&&knownPairs.some(p=>p.geometry===s?.geometryHash&&p.content===s?.contentHash),measured=s=>s?.geometryHash===c.geometry&&[c.nodeContent,c.chromiumContent].includes(s.contentHash),g=report.gates??{};
 const gates={
  originalScope:JSON.stringify(sort(report.input?.profile))===JSON.stringify(sort(profile))&&report.input?.source?.head===c.sourceHead&&report.input?.source?.closureSha256===c.sourceClosure,
  exactSourceAndInput:['sameInput','sameRuleBytes','typedArrayShape','indexExact','finiteArrays','finiteGraph','resourcesExact','topology','noUnseededRandom','noBrowserErrors'].every(k=>g[k]===true),
  exactKnownMeasuredPairs:known(report.node)&&known(report.browser)&&measured(report.node)&&measured(report.browser),
  exactArrayManifest:arrays.length===manifest.length&&manifest.every(([p,t,n],i)=>arrays[i]?.path===p&&arrays[i]?.type===t&&arrays[i]?.length===n&&arrays[i]?.bytes===n*(t==='Float64Array'?8:t==='Uint8Array'?1:4)),
  exactGeometryAndResources:arrays.filter(a=>a.path!=='specimen.growth.bladeStorage[0]').every(a=>a.byteEqual===true&&a.differentValues===0&&a.maxAbs===0&&finite(a)),
  observedBladeCells:!!blade&&finite(blade)&&blade.differentValues>=0&&blade.differentValues<=c.maxBladeCellDifferences&&blade.maxAbs>=0&&blade.maxAbs<=c.maxAbs&&blade.examples?.length===blade.differentValues&&blade.examples.every(x=>bladeDifferenceIndices.includes(x.index)&&Number.isFinite(x.abs)&&x.abs<=c.maxAbs),
  completeGraph:graph.numbers===c.graphNumbers&&graph.nonNumericDifferences===0&&finite(graph)&&graph.differentNumbers>=0&&graph.differentNumbers<=c.maxGraphCellDifferences&&graph.maxAbs>=0&&graph.maxAbs<=c.maxAbs&&graph.examples?.length===graph.differentNumbers&&graph.examples.every(x=>graphDifferencePaths.includes(x.path)&&Number.isFinite(x.abs)&&x.abs<=c.maxAbs)
 };
 return {version:c.version,gates,pass:Object.values(gates).every(Boolean),policy:'Measured whole raw pairs plus strict source/input and cell-specific direct comparison; zero render-geometry or image-resource tolerance; no quantized signatures'};
}
