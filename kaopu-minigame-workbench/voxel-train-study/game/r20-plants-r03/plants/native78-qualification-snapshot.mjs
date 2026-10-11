/** Measurement only. No quantization, numeric tolerance, output admission or rendering.
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
