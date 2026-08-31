// Read-only static GLB inspector. No remeshing, image sampling, external resources or source writes.
const component = {5120:[1,'getInt8'],5121:[1,'getUint8'],5122:[2,'getInt16'],5123:[2,'getUint16'],5125:[4,'getUint32'],5126:[4,'getFloat32']};
const dimensions={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
const gate=(ok,message)=>{if(!ok)throw Error(`GLB: ${message}`)};
const identity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function multiply(a,b){const out=Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)out[c*4+r]+=a[k*4+r]*b[c*4+k];return out}
function matrix(node){
 if(node.matrix){gate(node.matrix.length===16&&node.matrix.every(Number.isFinite),'invalid node matrix');return node.matrix}
 const [x,y,z,w]=node.rotation??[0,0,0,1],[sx,sy,sz]=node.scale??[1,1,1],[tx,ty,tz]=node.translation??[0,0,0];
 const m=[(1-2*(y*y+z*z))*sx,2*(x*y+z*w)*sx,2*(x*z-y*w)*sx,0,2*(x*y-z*w)*sy,(1-2*(x*x+z*z))*sy,2*(y*z+x*w)*sy,0,2*(x*z+y*w)*sz,2*(y*z-x*w)*sz,(1-2*(x*x+y*y))*sz,0,tx,ty,tz,1];
 gate(m.every(Number.isFinite),'invalid node transform');return m;
}
function transformPoint(m,p){return [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]]}
function normalMatrix(m){
 const a=m[0],b=m[4],c=m[8],d=m[1],e=m[5],f=m[9],g=m[2],h=m[6],i=m[10];
 const det=a*(e*i-f*h)-b*(d*i-f*g)+c*(d*h-e*g);gate(Number.isFinite(det)&&Math.abs(det)>1e-24,'singular node transform');
 return [(e*i-f*h)/det,(f*g-d*i)/det,(d*h-e*g)/det,(c*h-b*i)/det,(a*i-c*g)/det,(b*g-a*h)/det,(b*f-c*e)/det,(c*d-a*f)/det,(a*e-b*d)/det];
}
export function parseGLB(buffer){
 gate(buffer instanceof ArrayBuffer,'expected ArrayBuffer');gate(buffer.byteLength>=20,'incomplete header');gate(buffer.byteLength<=268435456,'reference exceeds 256 MiB inspection budget; source unchanged');
 const view=new DataView(buffer);gate(view.getUint32(0,true)===0x46546c67,'invalid glTF magic');gate(view.getUint32(4,true)===2,'requires GLB version 2');gate(view.getUint32(8,true)===buffer.byteLength,'declared length does not match original bytes');
 let offset=12,doc=null,bin=null,chunks=0;
 while(offset<buffer.byteLength){
  gate(offset+8<=buffer.byteLength,'truncated chunk header');const size=view.getUint32(offset,true),type=view.getUint32(offset+4,true);offset+=8;
  gate(size%4===0&&offset+size<=buffer.byteLength,'invalid chunk size');
  if(type===0x4e4f534a){gate(!doc&&chunks===0,'JSON must be first and unique');doc=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(new Uint8Array(buffer,offset,size)))}
  else if(type===0x004e4942){gate(doc&&!bin,'unexpected BIN chunk');bin={offset,size}}
  offset+=size;chunks++;
 }
 gate(doc?.asset?.version==='2.0'&&bin,'missing glTF 2.0 JSON or BIN');
 gate(!(doc.extensionsRequired?.length),'required extensions are not supported by this static inspector');
 gate(!(doc.animations?.length)&&!(doc.skins?.length),'animated/skinned sources need a separate inspector; original is preserved');
 gate(doc.buffers?.length===1&&!doc.buffers[0].uri,'external buffer loading is disabled');
 gate(Number.isInteger(doc.buffers[0].byteLength)&&doc.buffers[0].byteLength<=bin.size&&bin.size-doc.buffers[0].byteLength<=3,'invalid embedded buffer length');
 for(const image of doc.images??[])gate(!image.uri,'external/data URI image loading is disabled');
 const views=doc.bufferViews??[];
 for(const bv of views){gate(bv.buffer===0&&Number.isInteger(bv.byteLength)&&bv.byteLength>=0&&Number.isInteger(bv.byteOffset??0)&&(bv.byteOffset??0)>=0&&(bv.byteOffset??0)+bv.byteLength<=doc.buffers[0].byteLength,'bufferView outside source');gate(!bv.extensions,'compressed bufferViews need their explicit decoder')}
 function accessor(id){
  const a=doc.accessors?.[id];gate(a&&!a.sparse&&views[a.bufferView],'unsupported or missing accessor');const bv=views[a.bufferView],comp=component[a.componentType],n=dimensions[a.type];
  gate(comp&&n&&Number.isInteger(a.count)&&a.count>0&&a.count<=10000000,'unsupported accessor format');const [bytes,get]=comp,step=bv.byteStride??n*bytes,relative=a.byteOffset??0;
  gate(Number.isInteger(relative)&&relative>=0&&Number.isInteger(step)&&step>=n*bytes&&relative+(a.count-1)*step+n*bytes<=bv.byteLength,'accessor outside bufferView');
  const start=bin.offset+(bv.byteOffset??0)+relative,out=a.componentType===5126?new Float32Array(a.count*n):new Float64Array(a.count*n);
  for(let j=0;j<a.count;j++)for(let k=0;k<n;k++){let value=view[get](start+j*step+k*bytes,true);gate(Number.isFinite(value),'non-finite accessor value');if(a.normalized){if(a.componentType===5120)value=Math.max(-1,value/127);else if(a.componentType===5122)value=Math.max(-1,value/32767);else if(a.componentType===5121)value/=255;else if(a.componentType===5123)value/=65535;else gate(false,'unsupported normalized accessor')}out[j*n+k]=value}
  return {array:out,count:a.count,components:n,type:a.componentType};
 }
 const primitives=[],min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let vertices=0,triangles=0;
 function walk(id,parent,path){
  gate(Number.isInteger(id)&&doc.nodes?.[id]&&!path.has(id),'invalid or cyclic scene nodes');const node=doc.nodes[id],next=new Set(path);next.add(id);gate(next.size<=128,'scene hierarchy too deep');const world=multiply(parent,matrix(node));
  if(node.mesh!==undefined){
   const mesh=doc.meshes?.[node.mesh];gate(mesh,'missing mesh');const nm=normalMatrix(world);
   for(const p of mesh.primitives){
    gate((p.mode??4)===4&&!p.targets&&!p.extensions,'only uncompressed static TRIANGLES are supported');const position=accessor(p.attributes.POSITION);gate(position.components===3&&position.type===5126,'POSITION must be float VEC3');
    const originalNormal=p.attributes.NORMAL===undefined?null:accessor(p.attributes.NORMAL);gate(!originalNormal||(originalNormal.components===3&&originalNormal.count===position.count),'normal count mismatch');
    const ai=p.indices===undefined?null:accessor(p.indices);gate(!ai||(ai.components===1&&[5121,5123,5125].includes(ai.type)),'indices must be unsigned integers');
    const indices=ai?Uint32Array.from(ai.array):Uint32Array.from({length:position.count},(_,i)=>i);gate(indices.length%3===0,'triangle index count mismatch');for(const index of indices)gate(index<position.count,'index references missing vertex');
    vertices+=position.count;triangles+=indices.length/3;gate(vertices<=2000000&&triangles<=4000000,'reference geometry exceeds current viewer budget; no simplification');
    const positions=new Float32Array(position.array.length),normals=new Float32Array(position.array.length);
    for(let i=0;i<position.count;i++){
     const point=transformPoint(world,position.array.subarray(i*3,i*3+3));gate(point.every(Number.isFinite),'invalid world position');positions.set(point,i*3);for(let k=0;k<3;k++){min[k]=Math.min(min[k],point[k]);max[k]=Math.max(max[k],point[k])}
     if(originalNormal){const [x,y,z]=originalNormal.array.subarray(i*3,i*3+3),n=[nm[0]*x+nm[1]*y+nm[2]*z,nm[3]*x+nm[4]*y+nm[5]*z,nm[6]*x+nm[7]*y+nm[8]*z],len=Math.hypot(...n);gate(len>0,'zero source normal');normals.set(n.map(v=>v/len),i*3)}
    }
    if(!originalNormal){for(let i=0;i<indices.length;i+=3){const ids=[indices[i],indices[i+1],indices[i+2]],a=positions.subarray(ids[0]*3,ids[0]*3+3),b=positions.subarray(ids[1]*3,ids[1]*3+3),c=positions.subarray(ids[2]*3,ids[2]*3+3),u=b.map((v,k)=>v-a[k]),v=c.map((v,k)=>v-a[k]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];for(const id of ids)for(let k=0;k<3;k++)normals[id*3+k]+=n[k]}
     for(let i=0;i<normals.length;i+=3){const len=Math.hypot(normals[i],normals[i+1],normals[i+2])||1;for(let k=0;k<3;k++)normals[i+k]/=len}}
    primitives.push({name:node.name??mesh.name??`mesh-${node.mesh}`,positions,normals,indices,normalSource:originalNormal?'source':'computed-for-inspection'});
   }
  }
  for(const child of node.children??[])walk(child,world,next);
 }
 const scene=doc.scenes?.[doc.scene??0];gate(scene&&scene.nodes?.length,'missing default scene');for(const id of scene.nodes)walk(id,identity(),new Set());gate(primitives.length,'no supported geometry');
 const images=(doc.images??[]).map((image,index)=>{const bv=views[image.bufferView];gate(bv&&['image/jpeg','image/png'].includes(image.mimeType),'unsupported embedded image');return {index,name:bv.name??`image-${index}`,mimeType:image.mimeType,offset:bin.offset+(bv.byteOffset??0),bytes:bv.byteLength}});
 return {primitives,images,report:{format:'GLB 2.0',generator:doc.asset.generator??null,sourceBytes:buffer.byteLength,sceneCount:doc.scenes.length,meshCount:doc.meshes?.length??0,primitiveInstances:primitives.length,vertices,triangles,dimensions:max.map((v,i)=>v-min[i]),bounds:{min,max},imageCount:images.length,imageBytes:images.reduce((n,i)=>n+i.bytes,0),materialCount:doc.materials?.length??0,sourceChanged:false,sourceNodeTransformsApplied:true,sourceUVDiscardedFromPreview:true,sourceGeometrySimplified:false,textureSampling:false,externalResourcesLoaded:false,physicalScaleVerified:false,geologyVerified:false,geographicalIdentityVerified:false,visualApproved:false,productionReady:false}};
}
