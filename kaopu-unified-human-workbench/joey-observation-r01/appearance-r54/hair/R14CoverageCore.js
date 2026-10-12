/** Pure geometry contract for R14.2 on the current R52 common mesh.
 * Inputs are read only. Roots are original GNM triangle + barycentric records;
 * current positions come only from the corresponding actual common vertices.
 */
export const SOURCE_COMMIT = 'c40a86c92b2fe37179e29a67628bf26303745d60';
export const ROOT_LIFT = .00002;
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub=(a,b)=>a.map((x,k)=>x-b[k]);
const add=(a,b)=>a.map((x,k)=>x+b[k]);
const mul=(a,s)=>a.map(x=>x*s);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const pointAt=(a,i)=>Array.from(a.subarray(i*3,i*3+3));
export function unit(a){const n=Math.hypot(...a);if(!Number.isFinite(n)||n<1e-12)throw Error('Degenerate normal or frame');return mul(a,1/n);}
export function finiteArray(a,name,{triples=false}={}){
 if(!a||!Number.isInteger(a.length)||!a.length||(triples&&a.length%3)||!Array.from(a).every(Number.isFinite))throw Error('Invalid '+name);
 return a;
}
export function validateIndices(a,n,name){finiteArray(a,name,{triples:true});for(const x of a)if(!Number.isInteger(x)||x<0||x>=n)throw Error('Invalid '+name+' vertex index');return a;}
export function exactSourceMap(numVertices,recipes,bodyCount,vertexCount){
 if(!Number.isInteger(numVertices)||numVertices<3||!Number.isInteger(bodyCount)||bodyCount<0||!Array.isArray(recipes)||bodyCount+recipes.length!==vertexCount)throw Error('Invalid common/source mapping shape');
 const map=new Int32Array(numVertices).fill(-1);
 recipes.forEach((r,i)=>{if(!Array.isArray(r)||r.length!==3||!r.every(Number.isFinite)||!Number.isInteger(r[0])||!Number.isInteger(r[1])||r[0]<0||r[1]<0||r[0]>=numVertices||r[1]>=numVertices||r[2]<0||r[2]>1)throw Error('Invalid GNM recipe');const [a,b,t]=r;if(a===b&&t===0){if(map[a]>=0)throw Error('Duplicate exact GNM source support');map[a]=bodyCount+i;}});
 return map;
}
export function orientedFaces(faces){const result=new Set();for(let t=0;t<faces.length;t+=3){const a=faces[t],b=faces[t+1],c=faces[t+2];if(a===b||b===c||c===a)continue;result.add(`${a},${b},${c}`);result.add(`${b},${c},${a}`);result.add(`${c},${a},${b}`);}return result;}
export function verifiedRootSupport(triangle,bary,sourceTriangles,sourceMap,commonFaces,displayFaces){
 if(!Number.isInteger(triangle)||triangle<0||triangle*3+2>=sourceTriangles.length)throw Error('Invalid root triangle');
 if(bary.length!==3||!Array.from(bary).every(Number.isFinite)||Array.from(bary).some(x=>x< -1e-7||x>1+1e-7)||Math.abs(bary[0]+bary[1]+bary[2]-1)>2e-6)throw Error('Invalid root barycentrics');
 const ids=Array.from(sourceTriangles.slice(triangle*3,triangle*3+3),id=>sourceMap[id]);
 if(ids.some(id=>id<0)||!commonFaces.has(ids.join(','))||!displayFaces.has(ids.join(',')))throw Error('Missing same-oriented common/display root face at source triangle '+triangle);
 return ids;
}
function basis(a,b,c){const origin=mul(add(a,b),.5),edge=sub(b,a),sx=Math.hypot(...edge),x=unit(edge),up=sub(c,origin),vertical=sub(up,mul(x,dot(up,x))),sy=Math.hypot(...vertical),y=unit(vertical),z=unit(cross(x,y));return {origin,x,y,z,sx,sy};}
export function similarityFrame(sourceAnchors,currentAnchors){
 if(sourceAnchors.length!==3||currentAnchors.length!==3)throw Error('Three frame anchors required');
 for(const a of [...sourceAnchors,...currentAnchors]){if(a.length!==3||!a.every(Number.isFinite))throw Error('Invalid frame anchor');}
 const source=basis(...sourceAnchors),current=basis(...currentAnchors),scale=(current.sx/source.sx+current.sy/source.sy)*.5;
 if(!Number.isFinite(scale)||scale<.1||scale>10)throw Error('Invalid source/display frame scale');
 const rotate=(v,a,b)=>add(add(mul(b.x,dot(v,a.x)),mul(b.y,dot(v,a.y))),mul(b.z,dot(v,a.z)));
 return {source,current,scale,toDisplay:p=>add(current.origin,mul(rotate(sub(p,source.origin),source,current),scale)),toSource:p=>add(source.origin,mul(rotate(sub(p,current.origin),current,source),1/scale)),normalToDisplay:n=>unit(rotate(n,source,current)),normalToSource:n=>unit(rotate(n,current,source))};
}
export function vertexNormals(positions,triangles){
 const n=new Float32Array(positions.length);
 for(let t=0;t<triangles.length;t+=3){const ids=Array.from(triangles.slice(t,t+3)),p=ids.map(id=>pointAt(positions,id)),v=cross(sub(p[1],p[0]),sub(p[2],p[0]));for(const id of ids)for(let k=0;k<3;k++)n[id*3+k]+=v[k];}
 for(let i=0;i<n.length;i+=3){const len=Math.hypot(n[i],n[i+1],n[i+2]);if(len>1e-12)for(let k=0;k<3;k++)n[i+k]/=len;}
 return n;
}
export function baryPoint(positions,ids,bary){return [0,1,2].map(k=>ids.reduce((sum,id,j)=>sum+positions[id*3+k]*bary[j],0));}
export function fingerprint(a){let h=2166136261;if(ArrayBuffer.isView(a)){const bytes=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);for(const v of bytes)h=Math.imul(h^v,16777619);}else{for(const v of a){h=Math.imul(h^(v>>>0),16777619);}}return (h>>>0).toString(16).padStart(8,'0');}
export function sameArray(a,b){if(!a||!b||a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true;}
export function buildCoverageContext({source,recipes,bodyCount,positions,faces,displayFaces,expectedVertexCount=25417}){
 finiteArray(source?.template,'source template',{triples:true});const n=source.template.length/3;
 if(source.numVertices!==n||source.componentId?.length!==n)throw Error('Invalid source model shape');
 validateIndices(source.triangles,n,'source triangles');finiteArray(positions,'display positions',{triples:true});const count=positions.length/3;
 if(count!==expectedVertexCount)throw Error('R14 coverage requires the fixed '+expectedVertexCount+' vertex common mesh');
 validateIndices(faces,count,'common faces');validateIndices(displayFaces,count,'display faces');
 const sourceMap=exactSourceMap(n,recipes,bodyCount,count),targets=[[-.07,.32,.015],[.07,.32,.015],[0,.395,0]],anchors=[],anchorDistances=[];
 for(const target of targets){let best=-1,d=Infinity;for(let i=0;i<n;i++){if(sourceMap[i]<0||source.componentId[i]!==0)continue;const q=pointAt(source.template,i),e=dot(sub(q,target),sub(q,target));if(e<d){d=e;best=i;}}if(best<0||Math.sqrt(d)>.04)throw Error('GNM frame anchor unavailable');anchors.push(best);anchorDistances.push(Math.sqrt(d));}
 if(new Set(anchors).size!==3)throw Error('Duplicate GNM frame anchors');
 const frame=similarityFrame(anchors.map(i=>pointAt(source.template,i)),anchors.map(i=>pointAt(positions,sourceMap[i]))),sourcePositions=new Float32Array(positions.length);
 for(let i=0;i<count;i++)sourcePositions.set(frame.toSource(pointAt(positions,i)),i*3);
 const currentNormals=vertexNormals(positions,displayFaces),inverseNormals=new Float32Array(n*3);
 for(let i=0;i<n;i++)if(sourceMap[i]>=0){const q=pointAt(currentNormals,sourceMap[i]);if(Math.hypot(...q)>1e-12)inverseNormals.set(frame.normalToSource(q),i*3);}
 const collisionModel={numVertices:count,template:sourcePositions,triangles:Uint32Array.from(displayFaces),componentId:new Uint8Array(count)};
 const orientedCommon=orientedFaces(faces),orientedDisplay=orientedFaces(displayFaces);
 return {source,sourceMap,frame,anchors,anchorDistances,currentNormals,inverseNormals,collisionModel,orientedCommon,orientedDisplay,positions:Float32Array.from(positions),faces:Uint32Array.from(faces),displayFaces:Uint32Array.from(displayFaces),sourcePositionHash:fingerprint(source.template),positionHash:fingerprint(positions),indexHash:fingerprint(Uint32Array.from(displayFaces))};
}
export function bindCurrentRoots(binding,context){
 const {source,sourceMap,frame,positions,currentNormals,orientedCommon,orientedDisplay}=context,used=new Set(),normalRoots=new Float32Array(binding.count*3),displayRoots=new Float32Array(binding.count*3);
 binding.templateNormals=context.inverseNormals.slice();
 const originalRootHash=fingerprint(binding.templateRoots);let maxReprojection=0;
 for(let i=0;i<binding.count;i++){
  const t=binding.rootTriangles[i],b=binding.rootBarycentrics.subarray(i*3,i*3+3),ids=verifiedRootSupport(t,b,source.triangles,sourceMap,orientedCommon,orientedDisplay);
  if(Array.from(source.triangles.slice(t*3,t*3+3)).some(id=>source.componentId[id]!==0))throw Error('Root is not on source skin');
  const root=baryPoint(positions,ids,b),normal=unit(baryPoint(currentNormals,ids,b)),inverse=frame.toSource(root);binding.templateRoots.set(inverse,i*3);normalRoots.set(normal,i*3);displayRoots.set(root,i*3);used.add(t);
  maxReprojection=Math.max(maxReprojection,Math.hypot(...sub(frame.toDisplay(inverse),root)));
 }
 return {displayRoots,normalRoots,originalRootHash,currentRootHash:fingerprint(binding.templateRoots),orientedRootFaces:used.size,verifiedRoots:binding.count,missingSupports:0,maxFrameRootReprojection:maxReprojection};
}
export function compiledToDisplay(data,context,rootSupport){
 const {frame}=context;let maxRootError=0,maxRootGap=0;
 for(let q=0;q<data.curves.length;q+=3){data.curves.set(frame.toDisplay(Array.from(data.curves.subarray(q,q+3))),q);data.normals.set(frame.normalToDisplay(Array.from(data.normals.subarray(q,q+3))),q);data.tangents.set(frame.normalToDisplay(Array.from(data.tangents.subarray(q,q+3))),q);}
 for(let i=0;i<data.count;i++){const root=pointAt(rootSupport.displayRoots,i),normal=pointAt(rootSupport.normalRoots,i),expected=add(root,mul(normal,ROOT_LIFT*frame.scale)),actual=pointAt(data.curves,i*data.per);maxRootError=Math.max(maxRootError,Math.hypot(...sub(actual,expected)));maxRootGap=Math.max(maxRootGap,Math.hypot(...sub(actual,root)));}
 for(const a of [data.curves,data.normals,data.tangents,data.randoms])if(!a.every(Number.isFinite))throw Error('Nonfinite compiled coverage data');
 if(maxRootError>2e-6)throw Error('Coverage root drift exceeds 2 micrometres: '+maxRootError);
 return {maxRootError,maxRootGap,expectedRootLift:ROOT_LIFT*frame.scale,finite:true,displayCurveHash:fingerprint(data.curves)};
}
