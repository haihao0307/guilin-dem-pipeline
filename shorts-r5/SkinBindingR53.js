/* Reuse the original body's solved eight-influence rows. No new skeleton. */
function shortsTransferOriginalBinding(meshes,vertices,scale){
 const samples=[];
 for(const m of meshes){if(m.name!=='skin'||!m.binding)continue;
  for(let i=0;i<m.vertices;i++){
   const mask=m.regionMasks[i];if(mask&(16|32|256|512))continue;
   const p=[-(m.positions[i*3]*m.extent[0]+m.origin[0]),m.positions[i*3+1]*m.extent[1]+m.origin[1],m.positions[i*3+2]*m.extent[2]+m.origin[2]];
   if(p[1]<.40*scale||p[1]>1.05*scale||Math.abs(p[0])>.26*scale)continue;
   samples.push({p,ids:Array.from(m.binding.ids.subarray(i*8,i*8+8)),w:Array.from(m.binding.weights.subarray(i*8,i*8+8),v=>v/65535)});
  }
 }
 if(samples.length<200)throw Error('原人体蒙皮数据不完整，拒绝重新猜测服装骨骼权重。');
 const tree=(a,depth=0)=>{if(!a.length)return null;const axis=depth%3;a.sort((x,y)=>x.p[axis]-y.p[axis]);const k=a.length>>1;return{s:a[k],axis,left:tree(a.slice(0,k),depth+1),right:tree(a.slice(k+1),depth+1)};};
 const root=tree(samples.slice());let maximumDistance=0;
 const rows=vertices.map(v=>{
  const best=[];const visit=node=>{if(!node)return;const d2=node.s.p.reduce((n,x,k)=>n+(x-v.p[k])**2,0);if(best.length<6||d2<best.at(-1).d2){best.push({s:node.s,d2});best.sort((a,b)=>a.d2-b.d2);if(best.length>6)best.pop();}const delta=v.p[node.axis]-node.s.p[node.axis];visit(delta<0?node.left:node.right);if(best.length<6||delta*delta<best.at(-1).d2)visit(delta<0?node.right:node.left);};visit(root);
  maximumDistance=Math.max(maximumDistance,Math.sqrt(best[0].d2));const weights=new Map();
  for(const {s,d2} of best){const proximity=1/(d2+.000025*scale*scale);for(let k=0;k<8;k++)if(s.w[k]>0)weights.set(s.ids[k],(weights.get(s.ids[k])||0)+s.w[k]*proximity);}
  const list=[...weights].sort((a,b)=>b[1]-a[1]).slice(0,8),total=list.reduce((n,p)=>n+p[1],0),ids=new Array(8).fill(list[0][0]),w=new Array(8).fill(0);list.forEach(([id,value],k)=>{ids[k]=id;w[k]=value/total;});return{ids,w};
 });
 return {rows,report:{method:'original-body-solved-skin-row-transfer',influences:8,nearestSamples:6,bodySamples:samples.length,maximumSourceDistanceM:maximumDistance,poseAuthority:'original-R2-compact-palette',fullCollisionCertification:false}};
}
class BodyBoundShortsR53 extends TailoredShortsR5{
 constructor(surface,meshes){super(surface,meshes);const gl=this.gl;
  try{
   const mesh=shortsMeshR5(this.fit),binding=shortsTransferOriginalBinding(meshes,mesh.values,surface.statureScale);
   const data=new Float32Array(mesh.values.length*28);for(let i=0;i<mesh.values.length;i++){data.set(mesh.packed.subarray(i*12,i*12+12),i*28);data.set(binding.rows[i].ids,i*28+12);data.set(binding.rows[i].w,i*28+20);}
   let vs=SHORTS_R5_VS.replace('uniform mat4 viewProjection;', 'layout(location=5)in vec4 sourceJointsA;layout(location=6)in vec4 sourceJointsB;layout(location=7)in vec4 sourceWeightsA;layout(location=8)in vec4 sourceWeightsB;uniform mat4 viewProjection;');
   const start=vs.indexOf('void main(){'),end=vs.indexOf('float clearance=',start);if(start<0||end<0)throw Error('原服装蒙皮接口发生变化。');
   vs=vs.slice(0,start)+`void main(){vec4 qr=vec4(0),qd=vec4(0),reference=texelFetch(compactPalette,ivec2(0,int(sourceJointsA.x+.5)),0);for(int k=0;k<8;k++){int id=int((k<4?sourceJointsA[k%4]:sourceJointsB[k%4])+.5);float base=k<4?sourceWeightsA[k%4]:sourceWeightsB[k%4];vec4 q=texelFetch(compactPalette,ivec2(0,id),0),d=texelFetch(compactPalette,ivec2(1,id),0);float w=base*(dot(reference,q)<0.?-1.:1.);qr+=w*q;qd+=w*d;}float l=length(qr);qr/=l;qd/=l;qd-=qr*dot(qr,qd);P=spin(qr,position)+2.*(qr.w*qd.xyz-qd.w*qr.xyz+cross(qr.xyz,qd.xyz));N=spin(qr,normal);\n`+vs.slice(end);
   vs=vs.replace('float clearance=smoothstep(.075,.15,(hipY-position.y)/scale);','float clearance=smoothstep(.075,.15,(hipY-position.y)/scale)*smoothstep(.005,.04,abs(position.x)/scale);');
   for(const p of [this.main,this.depth])gl.deleteProgram(p.p);for(const b of this.buffers)gl.deleteBuffer(b);gl.deleteVertexArray(this.vao);this.buffers=[];
   this.main=program(gl,vs,SHORTS_R5_FS);this.depth=program(gl,vs,'#version 300 es\nprecision highp float;void main(){}');
   for(const p of [this.main,this.depth])for(const name of ['compactPalette','shortsJoints','thighEnds[0]','thighRadii[0]','thighWidths[0]','hipY','scale','waistbandHeight'])p.u[name]=gl.getUniformLocation(p.p,name);
   this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);for(const [target,contents]of [[gl.ARRAY_BUFFER,data],[gl.ELEMENT_ARRAY_BUFFER,mesh.indices]]){const b=gl.createBuffer();this.buffers.push(b);gl.bindBuffer(target,b);gl.bufferData(target,contents,gl.STATIC_DRAW);}
   for(const [at,size,offset]of [[0,3,0],[1,3,3],[2,2,6],[3,3,8],[4,1,11],[5,4,12],[6,4,16],[7,4,20],[8,4,24]]){gl.enableVertexAttribArray(at);gl.vertexAttribPointer(at,size,gl.FLOAT,false,112,offset*4);}gl.bindVertexArray(null);
   this.geometryBytes=data.byteLength+mesh.indices.byteLength;this.card.binding=binding.report;this.card.revision='R5.3-body-binding';this.report.generator='original-body-shorts-r5.3';this.report.binding=binding.report;
  }catch(error){this.dispose();throw error;}
 }
}
