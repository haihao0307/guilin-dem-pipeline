import {PATCH_ATTRIBUTE_NAMES,WATER_CACHE_PROVENANCE} from './glsl.mjs';
const finite=(v,k,lo=-1e6,hi=1e6)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)throw Error(`Invalid ${k}: finite ${lo}..${hi} required`);return v;};
const vec=(v,k,lo=-1e6,hi=1e6)=>{if((!Array.isArray(v)&&!ArrayBuffer.isView(v))||v.length!==3)throw Error(`${k} must contain 3 numbers`);return Array.from(v,(n,i)=>finite(n,k+'['+i+']',lo,hi));};
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const isRecord=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const validatedDomains=new WeakSet();
export function validateWeatherDomain(input){
 if(input&&validatedDomains.has(input))return input;
 if(!isRecord(input))throw Error('Explicit parent weather domain required');
 const allowed=new Set(['id','parentOriginMetres','parentBasis','fullDimensionsMetres','fieldScaleMetres','waterSeed','weatherSeed','parentNormal']);
 for(const key of Object.keys(input))if(!allowed.has(key))throw Error('Unknown weather domain parameter '+key);
 if(typeof input.id!=='string'||!input.id.trim()||input.id.length>160)throw Error('Nonempty parent domain id required');
 const parentOriginMetres=vec(input.parentOriginMetres,'parentOriginMetres');
 const fullDimensionsMetres=vec(input.fullDimensionsMetres,'fullDimensionsMetres',.001,1000);
 const fieldScaleMetres=finite(input.fieldScaleMetres,'fieldScaleMetres',.001,1000);
 const waterSeed=Math.fround(finite(input.waterSeed,'waterSeed'));
 const weatherSeed=Math.fround(finite(input.weatherSeed??0,'weatherSeed'));
 if(!Array.isArray(input.parentBasis)||input.parentBasis.length!==3)throw Error('parentBasis requires three receiver-frame column axes');
 const parentBasis=input.parentBasis.map((v,i)=>vec(v,'parentBasis['+i+']',-1,1));
 const [x,y,z]=parentBasis;const det=x[0]*(y[1]*z[2]-y[2]*z[1])-y[0]*(x[1]*z[2]-x[2]*z[1])+z[0]*(x[1]*y[2]-x[2]*y[1]);
 if(parentBasis.some(a=>Math.abs(dot(a,a)-1)>1e-6)||Math.abs(dot(x,y))+Math.abs(dot(x,z))+Math.abs(dot(y,z))>1e-6||Math.abs(det-1)>1e-6)throw Error('parentBasis must be orthonormal, metre-preserving and right handed');
 if(Math.abs(y[0])+Math.abs(y[1]-1)+Math.abs(y[2])>1e-6)throw Error('V26 parent Y must remain receiver-up; pitched domains would rotate the source gravity convention');
 const parentNormal=vec(input.parentNormal,'parentNormal',-1,1).map(Math.fround);if(Math.abs(dot(parentNormal,parentNormal)-1)>1e-6)throw Error('Unit parentNormal in parent coordinates required');
 const horizontalAxis=Math.abs(parentNormal[0])>Math.abs(parentNormal[2])?2:0;
 const result=Object.freeze({id:input.id,parentOriginMetres:Object.freeze(parentOriginMetres),parentBasis:Object.freeze(parentBasis.map(Object.freeze)),fullDimensionsMetres:Object.freeze(fullDimensionsMetres),fieldScaleMetres,waterSeed,weatherSeed,parentNormal:Object.freeze(parentNormal),horizontalAxis});validatedDomains.add(result);return result;
}
export function toParentMetres(domain,world){const p=vec(world,'worldMetres').map((n,i)=>n-domain.parentOriginMetres[i]);return domain.parentBasis.map(a=>dot(a,p));}
export function toWorldMetres(domain,parent){const p=vec(parent,'parentLocalMetres');return domain.parentOriginMetres.map((v,i)=>v+domain.parentBasis.reduce((n,a,j)=>n+a[i]*p[j],0));}
export function makeGridLayout(domainInput,options={}){
 if(!isRecord(options))throw Error('Grid options must be an object');for(const key of Object.keys(options))if(!['targetSpacingMetres','maxNodes'].includes(key))throw Error('Unknown grid option '+key);
 const {targetSpacingMetres=[.14,.14,.14],maxNodes=262144}=options;
 const domain=validateWeatherDomain(stripDerived(domainInput)),spacing=vec(targetSpacingMetres,'targetSpacingMetres',.001,1000);
 if(!Number.isSafeInteger(maxNodes)||maxNodes<50||maxNodes>1048576)throw Error('maxNodes must be 50..1048576');
 const axes=domain.fullDimensionsMetres.map((d,i)=>{const intervals=Math.ceil(d/spacing[i]),step=d/intervals;return Object.freeze({count:intervals+5,step,origin:-d*.5-2*step});});
 const h=domain.horizontalAxis,broadCount=axes[h].count*axes[1].count,lowerCount=axes[0].count*axes[2].count,nodeCount=broadCount+lowerCount;
 if(nodeCount>maxNodes)throw Error(`Weather cache ${nodeCount} nodes exceeds explicit maxNodes ${maxNodes}`);
 const positions=new Float32Array(nodeCount*3);
 let k=0;for(let y=0;y<axes[1].count;y++)for(let x=0;x<axes[h].count;x++){positions[k*3+h]=axes[h].origin+x*axes[h].step;positions[k*3+1]=axes[1].origin+y*axes[1].step;k++;}
 for(let z=0;z<axes[2].count;z++)for(let x=0;x<axes[0].count;x++){positions[k*3]=axes[0].origin+x*axes[0].step;positions[k*3+2]=axes[2].origin+z*axes[2].step;k++;}
 return {domain,axes:Object.freeze(axes),positions,broadCount,lowerCount,nodeCount,targetSpacingMetres:spacing};
}
function stripDerived(d){if(d&&Object.isFrozen(d)&&'horizontalAxis'in d){const {horizontalAxis,...input}=d;return input;}return d;}
function assertSamples(values,n){if(!(values instanceof Float32Array)||values.length!==n*2)throw Error('GPU low samples must be Float32Array(nodeCount * 2)');for(const value of values)if(!Number.isFinite(value)||value<0||value>1)throw Error('Nonfinite or out-of-range V26 low state');}
function extentQ(axis,p){const q=(p-axis.origin)/axis.step;if(q< -1e-6||q>axis.count-1+1e-6)throw Error('Sample exceeds weather parent padded domain');const snapped=Math.abs(q-Math.round(q))<.00002?Math.round(q):q;return Math.max(0,Math.min(axis.count-1,snapped));}
const mix=(a,b,t)=>a+(b-a)*t;
function interpolate(data,width,qx,qy){const x=Math.min(width-2,Math.floor(qx)),height=data.length/width,y=Math.min(height-2,Math.floor(qy)),fx=qx-x,fy=qy-y;return mix(mix(data[y*width+x],data[y*width+x+1],fx),mix(data[(y+1)*width+x],data[(y+1)*width+x+1],fx),fy);}
export function cacheFromNumericSamples(layout,values,metrics={}){
 assertSamples(values,layout.nodeCount);const {domain,axes,broadCount,lowerCount}=layout,h=domain.horizontalAxis;
 const broad=new Float32Array(broadCount),lowerFactor=new Float32Array(lowerCount);
 for(let i=0;i<broadCount;i++)broad[i]=values[i*2];for(let i=0;i<lowerCount;i++)lowerFactor[i]=values[(broadCount+i)*2+1];
 return {domain,axes,broad,lowerFactor,metrics:{...metrics,nodes:layout.nodeCount,retainedCPUBytes:broad.byteLength+lowerFactor.byteLength,frameNoiseEvaluations:0,visibleTextures:0},provenance:WATER_CACHE_PROVENANCE,
  sampleParent(point){const p=vec(point,'parentLocalMetres'),q=p.map((v,i)=>extentQ(axes[i],v));return [interpolate(broad,axes[h].count,q[h],q[1]),interpolate(lowerFactor,axes[0].count,q[0],q[2])];},
  sampleWorld(point){return this.sampleParent(toParentMetres(domain,point));},
 };
}
export function createWeatherStateCache({sampler,domain,...gridOptions}={}){
 if(!sampler?.sampleLow)throw Error('Supply the reusable V26 numeric GPU sampler');const start=performance.now(),layout=makeGridLayout(domain,gridOptions),sample=sampler.sampleLow(layout.domain,layout.positions),cache=cacheFromNumericSamples(layout,sample.values,sample.metrics);
 cache.metrics.totalBuildMs=performance.now()-start;cache.metrics.temporaryPositionBytes=layout.positions.byteLength;cache.metrics.temporaryLowReadbackBytes=sample.values.byteLength;return cache;
}
function validateBounds(bounds){if(!isRecord(bounds))throw Error('Explicit parent-local instance bounds required');const min=vec(bounds.min,'bounds.min'),max=vec(bounds.max,'bounds.max');if(min.some((v,i)=>v>max[i]))throw Error('Bounds min exceeds max');return {min,max};}
function patchStart(axis,min,max){const q0=extentQ(axis,min),q1=extentQ(axis,max),start=Math.max(0,Math.min(axis.count-4,Math.floor(q0)));if(q1>start+3+1e-6)throw Error('Instance spans more than 3 weather grid cells; increase targetSpacingMetres or partition receiver, never duplicate brick meshes');return start;}
export function packInstancePatches(cache,boundsList){
 if(!Array.isArray(boundsList)||!boundsList.length||boundsList.length>1000000)throw Error('1..1000000 explicit parent-local bounds required');
 const count=boundsList.length,attributes=Object.fromEntries(PATCH_ATTRIBUTE_NAMES.map(n=>[n,new Float32Array(count*4)])),{axes,domain,broad,lowerFactor}=cache,h=domain.horizontalAxis;
 boundsList.forEach((input,i)=>{const b=validateBounds(input),starts=axes.map((a,j)=>patchStart(a,b.min[j],b.max[j]));const origins=[starts[h],starts[1],starts[0],starts[2]];attributes.w26PatchOrigins.set(origins,i*4);
  for(let field=0;field<2;field++){const data=field?lowerFactor:broad,width=axes[field?0:h].count,x0=origins[field*2],y0=origins[field*2+1];for(let row=0;row<4;row++)attributes['w26Patch'+(field*4+row)].set(data.subarray((y0+row)*width+x0,(y0+row)*width+x0+4),i*4);}
 });
 return {count,attributes,metrics:{instanceCPUBytes:count*144,instanceGPUBytes:count*144,additionalVertexAttributeLocations:9,requiredWithNativeBrick:15,additionalFlatVaryingVectors:9,sharedGeometryDuplicated:false,perFragmentValueNoiseEvaluations:0,perFragmentGradientNoiseEvaluations:0,perFragmentHash31Calls:5}};
}
export function samplePackedPatch(cache,payload,instance,point){
 if(!Number.isInteger(instance)||instance<0||instance>=payload.count)throw Error('Invalid patch instance index');
 const p=vec(point,'parentLocalMetres'),q=p.map((v,i)=>extentQ(cache.axes[i],v)),h=cache.domain.horizontalAxis,o=Array.from(payload.attributes.w26PatchOrigins.subarray(instance*4,instance*4+4));
 return [[q[h],q[1]],[q[0],q[2]]].map(([x,y],field)=>{const gx=Math.floor(x),gy=Math.floor(y),px=o[field*2],py=o[field*2+1];let ix=gx-px,iy=gy-py,fx=x-gx,fy=y-gy;if(ix===3){ix=2;fx=1;}if(iy===3){iy=2;fy=1;}if(ix<0||iy<0||ix>2||iy>2)throw Error('Point is outside packed instance patch');const get=(a,b)=>payload.attributes['w26Patch'+(field*4+b)][instance*4+a];return mix(mix(get(ix,iy),get(ix+1,iy),fx),mix(get(ix,iy+1),get(ix+1,iy+1),fx),fy);});
}
export function assertWeatherAttributeBudget(gl,{existingAttributes=6,existingVaryingVectors=6}={}){
 if(!gl?.getParameter)throw Error('WebGL2 context required');for(const v of [existingAttributes,existingVaryingVectors])if(!Number.isInteger(v)||v<0)throw Error('Explicit nonnegative existing attribute/varying counts required');
 const attributes=gl.getParameter(gl.MAX_VERTEX_ATTRIBS),varyings=gl.getParameter(gl.MAX_VARYING_VECTORS);if(attributes<existingAttributes+9||varyings<existingVaryingVectors+9)throw Error(`V26 patch budget needs ${existingAttributes+9} attributes/${existingVaryingVectors+9} varying vectors; device has ${attributes}/${varyings}`);return {attributes,varyings,requiredAttributes:existingAttributes+9,requiredVaryings:existingVaryingVectors+9};
}
// Reuses the SAME source BufferAttribute objects; never clones template vertices.
export function makeWeatherGeometryShell(THREE,source,payload){
 if(!THREE?.BufferGeometry||!THREE?.InstancedBufferAttribute||!source?.attributes||!payload?.attributes)throw Error('Supply THREE, source geometry and packed patches');
 const geometry=new THREE.BufferGeometry(),sharedNames=Object.keys(source.attributes);for(const name of sharedNames)geometry.setAttribute(name,source.attributes[name]);geometry.setIndex(source.index);geometry.boundingBox=source.boundingBox;geometry.boundingSphere=source.boundingSphere;geometry.groups=source.groups.map(g=>({...g}));geometry.drawRange={...source.drawRange};
 for(const name of PATCH_ATTRIBUTE_NAMES)geometry.setAttribute(name,new THREE.InstancedBufferAttribute(payload.attributes[name],4));let disposed=false;
 return {geometry,dispose(){if(disposed)return;disposed=true;for(const name of sharedNames)geometry.deleteAttribute(name);geometry.setIndex(null);geometry.dispose();}};
}
export function patchUniformValues(cache){const d=cache.domain,[x,y,z]=d.parentBasis;return {w26ParentOriginMetres:d.parentOriginMetres,w26ReceiverToParent:[x[0],y[0],z[0],x[1],y[1],z[1],x[2],y[2],z[2]],w26FullDimensionsMetres:d.fullDimensionsMetres,w26ParentNormal:d.parentNormal,w26FieldScaleMetres:d.fieldScaleMetres,w26WaterSeed:d.waterSeed,w26GridOriginMetres:cache.axes.map(a=>a.origin),w26GridStepMetres:cache.axes.map(a=>a.step),w26HorizontalAxis:d.horizontalAxis};}
export const toReceiverMetres=toWorldMetres;
export const sampleReceiverMetres=(cache,point)=>cache.sampleParent(toParentMetres(cache.domain,point));
export function waterReceiverUniformValues(cache){const {w26GridOriginMetres,w26GridStepMetres,w26HorizontalAxis,...values}=patchUniformValues(cache);return values;}
