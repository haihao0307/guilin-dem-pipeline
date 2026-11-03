const EDGE_COLOURS=__EDGE_COLOURS__u;const BEND_COLOURS=__BEND_COLOURS__u;
// MP05 R02. Original metric XPBD equations; conflict-free constraint colours.
// Contact corrections use bounded fixed-point atomics, then a Jacobi gather.
struct Particle { p:vec4f, old:vec4f, v:vec4f }
struct Bend { ids:vec4u, state:vec4f }
struct Node { lo:vec4f, hi:vec4f }
struct Params { step:vec4f, a:vec4f, b:vec4f, bounds:vec4u, op:vec4u, range:vec4u }
@group(0) @binding(0) var<storage,read_write> particles:array<Particle>;
@group(0) @binding(1) var<storage,read_write> edges:array<vec4f>;
@group(0) @binding(2) var<storage,read_write> bends:array<Bend>;
@group(0) @binding(3) var<storage,read> colour:array<vec4u>;
@group(0) @binding(4) var<uniform> u:Params;
fn weight(i:u32)->f32{return particles[i].p.w;}
fn point(i:u32)->vec3f{return particles[i].p.xyz;}
fn setpoint(i:u32,p:vec3f){particles[i].p=vec4f(p,particles[i].p.w);}
fn distance(j:u32,alpha:f32){let r=edges[j];let a=u32(r.x);let b=u32(r.y);let d=point(a)-point(b);let l=length(d);if(l<1e-12){return;}let dl=(-(l-r.z)-alpha*r.w)/max(1e-20,weight(a)+weight(b)+alpha);edges[j].w+=dl;let q=d*(dl/l);setpoint(a,point(a)+q*weight(a));setpoint(b,point(b)-q*weight(b));}
fn strain(j:u32,lo:f32,hi:f32){let r=edges[j];let a=u32(r.x);let b=u32(r.y);let d=point(a)-point(b);let l=length(d);let w=weight(a)+weight(b);if(l<1e-12||w==0.){return;}let q=d*((clamp(l,r.z*lo,r.z*hi)-l)/(l*w));setpoint(a,point(a)+q*weight(a));setpoint(b,point(b)-q*weight(b));}
fn bending(j:u32,alpha:f32){let r=bends[j];let ids=r.ids;let E=point(ids.y)-point(ids.x);let U=point(ids.z)-point(ids.x);let V=point(ids.w)-point(ids.x);let N=cross(E,U);let M=cross(V,E);let e2=dot(E,E);let n2=dot(N,N);let m2=dot(M,M);if(min(e2,min(n2,m2))<1e-18){return;}let L=sqrt(e2);let q2=-L*N/n2;let q3=-L*M/m2;let q1=-dot(U,E)/e2*q2-dot(V,E)/e2*q3;let q0=-q1-q2-q3;let C=atan2(dot(E,cross(N,M))/L,dot(N,M))-r.state.y;let den=alpha+weight(ids.x)*dot(q0,q0)+weight(ids.y)*dot(q1,q1)+weight(ids.z)*dot(q2,q2)+weight(ids.w)*dot(q3,q3);let dl=(-C-alpha*r.state.x)/max(1e-20,den);bends[j].state.x+=dl;setpoint(ids.x,point(ids.x)+weight(ids.x)*q0*dl);setpoint(ids.y,point(ids.y)+weight(ids.y)*q1*dl);setpoint(ids.z,point(ids.z)+weight(ids.z)*q2*dl);setpoint(ids.w,point(ids.w)+weight(ids.w)*q3*dl);}
@compute @workgroup_size(256) fn constraints(@builtin(local_invocation_index) lane:u32,@builtin(workgroup_id) wg:vec3u){
 let g=wg.x;let descriptor=colour[g];let material=select(u.a,u.b,g==1u);
 let alpha=material.x;let ba=material.y;let lo=material.z;let hi=material.w;
 // Every colour has disjoint vertex sets. All lanes complete each colour
 // before the next one reads positions: no cross-workgroup races.
 for(var c=0u;c<EDGE_COLOURS;c++){if(c<descriptor.y){let r=colour[descriptor.x+c];for(var k=lane;k<r.y;k+=256u){if(u.op.x==0u){distance(r.x+k,alpha);}else{strain(r.x+k,lo,hi);}}}storageBarrier();}
 if(u.op.y==1u){for(var c=0u;c<BEND_COLOURS;c++){if(c<descriptor.w){let r=colour[descriptor.z+c];for(var k=lane;k<r.y;k+=256u){bending(r.x+k,ba);}}storageBarrier();}}
 if(u.op.x==0u){for(var c=0u;c<EDGE_COLOURS;c++){if(c<descriptor.y){let r=colour[descriptor.x+c];for(var k=lane;k<r.y;k+=256u){strain(r.x+k,lo,hi);}}storageBarrier();}}
}
@compute @workgroup_size(128) fn predict(@builtin(global_invocation_id) id:vec3u){let i=id.x;if(i>=u.bounds.y){return;}let g=select(0.,1.,i>=u.bounds.x);let damp=exp(-u.step.z*u.step.x);var p=particles[i];p.old=p.p;if(p.p.w>0.){p.p=vec4f(p.p.xyz+p.v.xyz*damp*u.step.x-vec3f(0.,u.step.y*u.step.x*u.step.x,0.),p.p.w);}particles[i]=p;}
@compute @workgroup_size(128) fn resetlambda(@builtin(global_invocation_id) id:vec3u){let i=id.x;if(i<arrayLength(&edges)){edges[i].w=0.;}if(i<arrayLength(&bends)){bends[i].state.x=0.;}}
@compute @workgroup_size(128) fn finish(@builtin(global_invocation_id) id:vec3u){let i=id.x;if(i>=u.bounds.y){return;}var p=particles[i];p.v=vec4f(select(vec3f(0.),clamp((p.p.xyz-p.old.xyz)/u.step.x,vec3f(-2.),vec3f(2.)),p.p.w>0.),0.);particles[i]=p;}

// Mesh queries share one ABI for the current body and the current bottom cloth.
struct Topology { ids:vec4u }
@group(1) @binding(0) var<storage,read> topo:array<vec4u>;
@group(1) @binding(1) var<storage,read_write> body:array<vec4f>;
@group(1) @binding(2) var<storage,read_write> nodes:array<Node>;
@group(1) @binding(3) var<storage,read> meshinfo:array<vec4u>;
@group(1) @binding(4) var<storage,read_write> cache:array<i32>;
@group(1) @binding(5) var<storage,read_write> delta:array<atomic<i32>>;
fn meshpoint(i:u32,meshTarget:u32)->vec3f{if(meshTarget==0u){return body[i].xyz;}if(meshTarget==2u){return mix(body[u.bounds.z*2u+i].xyz,body[u.bounds.z*3u+i].xyz,u.step.w-1./f32(u.op.w));}return point(i);}
fn closest(x:vec3f,f:u32,meshTarget:u32)->vec4f{
 let ids=topo[f];let A=meshpoint(ids.x,meshTarget);let U=meshpoint(ids.y,meshTarget)-A;let V=meshpoint(ids.z,meshTarget)-A;let W=x-A;let uu=dot(U,U);let vv=dot(V,V);let uv=dot(U,V);let wu=dot(W,U);let wv=dot(W,V);let den=uu*vv-uv*uv;var b=0.;var c=0.;if(den>1e-24){b=(wu*vv-wv*uv)/den;c=(wv*uu-wu*uv)/den;}
 if(b<0.||c<0.||b+c>1.||den<=1e-24){var best=1e30;for(var k=0u;k<3u;k++){var s=vec3f(0.);var e=U;if(k==1u){s=U;e=V-U;}else if(k==2u){s=V;e=-V;}let t=clamp(dot(W-s,e)/max(1e-24,dot(e,e)),0.,1.);let d=dot(s+t*e-W,s+t*e-W);if(d<best){best=d;if(k==0u){b=t;c=0.;}else if(k==1u){b=1.-t;c=t;}else{b=0.;c=1.-t;}}}}
 let q=A+U*b+V*c;return vec4f(dot(x-q,x-q),b,c,0.);
}
fn nearest(x:vec3f,meshTarget:u32,seed:i32)->i32{
 let root=meshinfo[meshTarget].x;var best=select(1e20,.045*.045,meshTarget==1u);var winner=-1;
 if(seed>=0){let q=closest(x,u32(seed),meshTarget);if(q.x<best){best=q.x;winner=seed;}}
 var stack:array<u32,64>;var head=1u;stack[0]=root;
 loop{if(head==0u){break;}head--;let j=stack[head];let n=nodes[j];let d=max(vec3f(0.),max(n.lo.xyz-x,x-n.hi.xyz));if(dot(d,d)>best){continue;}let r=topo[meshinfo[meshTarget].y+j-root];if(r.z==0xffffffffu){for(var k=r.x;k<r.y;k++){let f=topo[k].x;let q=closest(x,f,meshTarget);if(q.x<best){best=q.x;winner=i32(f);}}}else{if(head+2u>64u){atomicStore(&delta[u.bounds.y*4u],1);return -1;}let dl=max(vec3f(0.),max(nodes[r.z].lo.xyz-x,x-nodes[r.z].hi.xyz));let dr=max(vec3f(0.),max(nodes[r.w].lo.xyz-x,x-nodes[r.w].hi.xyz));let leftFirst=dot(dl,dl)<dot(dr,dr);stack[head]=select(r.z,r.w,leftFirst);stack[head+1u]=select(r.w,r.z,leftFirst);head+=2u;}}
 return winner;
}
fn addDelta(i:u32,d:vec3f){let scale=1e7;for(var k=0u;k<3u;k++){let v=i32(clamp(d[k]*scale,-2000000.,2000000.));let old=atomicAdd(&delta[i*4u+k],v);if(abs(old)>1900000000){atomicStore(&delta[u.bounds.y*4u],1);}}atomicAdd(&delta[i*4u+3u],1);}
@compute @workgroup_size(128) fn clearDelta(@builtin(global_invocation_id) id:vec3u){let i=id.x;if(i<u.bounds.y*4u){atomicStore(&delta[i],0);}}
@compute @workgroup_size(128) fn applyDelta(@builtin(global_invocation_id) id:vec3u){let i=id.x;if(i>=u.bounds.y||weight(i)==0.){return;}let n=atomicLoad(&delta[i*4u+3u]);if(n>0){let d=vec3f(f32(atomicLoad(&delta[i*4u])),f32(atomicLoad(&delta[i*4u+1u])),f32(atomicLoad(&delta[i*4u+2u])))/1e7;setpoint(i,point(i)+d/max(1.,f32(n)));}}
// Samples: particle, edge midpoint, triangle centroid. Source ids and reciprocal
// sample size are fixed at initialization. No contact samples are dropped.
@compute @workgroup_size(128) fn contact(@builtin(global_invocation_id) id:vec3u){
 let i=id.x;if(i>=u.range.y){return;}let sample=topo[u.range.x+i];let m=sample.w;let ids=sample.xyz;var x=vec3f(0.);var ws=0.;for(var k=0u;k<m;k++){x+=point(ids[k])/f32(m);ws+=weight(ids[k])/f32(m*m);}if(ws==0.){return;}
 let meshTarget=u.op.z;let slot=u.range.z+i;var f=cache[slot];if(u.op.w==1u||f<0){f=nearest(x,meshTarget,f);cache[slot]=f;}if(f<0){return;}
 let face=topo[u32(f)];let cp=closest(x,u32(f),meshTarget);let bary=vec3f(1.-cp.y-cp.z,cp.y,cp.z);let A=meshpoint(face.x,meshTarget);let B=meshpoint(face.y,meshTarget);let C=meshpoint(face.z,meshTarget);let q=A*bary.x+B*bary.y+C*bary.z;var normal=normalize(cross(B-A,C-A));var d=dot(x-q,normal);var gap=u.step.w;var correction=0.;
 if(meshTarget==0u){let vertexNormals=meshinfo[0].z;normal=normalize(body[vertexNormals+face.x].xyz*bary.x+body[vertexNormals+face.y].xyz*bary.y+body[vertexNormals+face.z].xyz*bary.z);let len=sqrt(max(0.,cp.x));let sign=select(1.,-1.,dot(x-q,normal)<0.);d=len*sign;if(len>1e-10){normal=(x-q)*sign/len;}if(m>1u){gap+=.0008;}if(d>=gap){return;}correction=min(.008,gap-d);
 }else{if(cp.x>.045*.045||d>=gap||d<-.035||cp.x-d*d>gap*gap){return;}correction=min(.012,gap-d);if(u.range.w==0u){for(var k=0u;k<3u;k++){ws+=weight(face[k])*bary[k]*bary[k];}}}
 let dl=correction/max(ws,1e-20);for(var k=0u;k<m;k++){addDelta(ids[k],normal*(weight(ids[k])/f32(m)*dl));}
 if(meshTarget==1u&&u.range.w==0u){for(var k=0u;k<3u;k++){addDelta(face[k],-normal*(weight(face[k])*bary[k]*dl));}}
}
@compute @workgroup_size(128) fn refit(@builtin(global_invocation_id) id:vec3u){let i=id.x;if(i>=u.range.y){return;}let j=topo[u.range.x+i].x;let info=meshinfo[u.op.z];let r=topo[info.y+j-info.x];var lo=vec3f(1e20);var hi=vec3f(-1e20);if(r.z==0xffffffffu){for(var k=r.x;k<r.y;k++){let f=topo[topo[k].x];for(var v=0u;v<3u;v++){let p=meshpoint(f[v],u.op.z);lo=min(lo,p);hi=max(hi,p);}}}else{lo=min(nodes[r.z].lo.xyz,nodes[r.w].lo.xyz);hi=max(nodes[r.z].hi.xyz,nodes[r.w].hi.xyz);}nodes[j].lo=vec4f(lo,0.);nodes[j].hi=vec4f(hi,0.);}
@compute @workgroup_size(128) fn bodyInterpolate(@builtin(global_invocation_id) id:vec3u){let i=id.x;if(i<u.bounds.z){body[i]=mix(body[u.bounds.z*2u+i],body[u.bounds.z*3u+i],u.step.w);}if(i<u.bounds.y&&weight(i)==0.){setpoint(i,mix(body[u.bounds.z*4u+i].xyz,body[u.bounds.z*4u+u.bounds.y+i].xyz,u.step.w));}}
@compute @workgroup_size(128) fn bodyNormals(@builtin(global_invocation_id) id:vec3u){let i=id.x;if(i>=u.bounds.z){return;}let range=topo[u.bounds.w+i];var normal=vec3f(0.);for(var j=0u;j<range.y;j++){let f=topo[topo[range.x+j].x];normal+=cross(body[f.y].xyz-body[f.x].xyz,body[f.z].xyz-body[f.x].xyz);}body[u.bounds.z+i]=vec4f(normal/max(length(normal),1e-20),0.);}
@compute @workgroup_size(256) fn refitTree(@builtin(local_invocation_index) lane:u32){
 let meshTarget=u.op.z;let info=meshinfo[meshTarget];
 for(var level=0u;level<u.range.y;level++){
  let range=topo[u.range.x+level];
  for(var k=lane;k<range.y;k+=256u){let j=topo[range.x+k].x;let r=topo[info.y+j-info.x];var lo=vec3f(1e20);var hi=vec3f(-1e20);
   if(r.z==0xffffffffu){for(var t=r.x;t<r.y;t++){let f=topo[topo[t].x];for(var v=0u;v<3u;v++){let p=meshpoint(f[v],meshTarget);lo=min(lo,p);hi=max(hi,p);}}}else{lo=min(nodes[r.z].lo.xyz,nodes[r.w].lo.xyz);hi=max(nodes[r.z].hi.xyz,nodes[r.w].hi.xyz);}
   nodes[j].lo=vec4f(lo,0.);nodes[j].hi=vec4f(hi,0.);
  }storageBarrier();
 }
}
@compute @workgroup_size(128) fn contactVertex(@builtin(global_invocation_id) id:vec3u){
 let i=id.x;if(i>=u.range.y){return;}let source=topo[u.range.x+i].x;if(weight(source)==0.){return;}let x=point(source);let meshTarget=u.op.z;let slot=u.range.z+i;var f=cache[slot];if(u.op.w==1u||f<0){f=nearest(x,meshTarget,f);cache[slot]=f;}if(f<0){return;}let face=topo[u32(f)];let cp=closest(x,u32(f),meshTarget);let bary=vec3f(1.-cp.y-cp.z,cp.y,cp.z);let A=meshpoint(face.x,meshTarget);let B=meshpoint(face.y,meshTarget);let C=meshpoint(face.z,meshTarget);let q=A*bary.x+B*bary.y+C*bary.z;var normal=normalize(cross(B-A,C-A));var dist=dot(x-q,normal);let gap=u.step.w;
 if(meshTarget==0u){let base=meshinfo[0].z;normal=normalize(body[base+face.x].xyz*bary.x+body[base+face.y].xyz*bary.y+body[base+face.z].xyz*bary.z);let len=sqrt(max(0.,cp.x));let sign=select(1.,-1.,dot(x-q,normal)<0.);dist=len*sign;if(len>1e-10){normal=(x-q)*sign/len;}if(dist<gap){setpoint(source,x+normal*min(.008,gap-dist));}}
 else if(cp.x<=.045*.045&&dist<gap&&dist>=-.035&&cp.x-dist*dist<=gap*gap){setpoint(source,x+normal*min(.012,gap-dist));}
}

fn projectSample(i:u32,sampleRange:vec4u,meshTarget:u32,refresh:bool,oneWay:bool,baseGap:f32){
 let sample=topo[sampleRange.x+i];let m=sample.w;let ids=sample.xyz;var x=vec3f(0.);var ws=0.;for(var k=0u;k<m;k++){x+=point(ids[k])/f32(m);ws+=weight(ids[k])/f32(m*m);}if(ws==0.){return;}
 let slot=sampleRange.z+i;var f=cache[slot];if(refresh||f<0){f=nearest(x,meshTarget,f);cache[slot]=f;}if(f<0){return;}
 let face=topo[u32(f)];let cp=closest(x,u32(f),meshTarget);let bary=vec3f(1.-cp.y-cp.z,cp.y,cp.z);let A=meshpoint(face.x,meshTarget);let B=meshpoint(face.y,meshTarget);let C=meshpoint(face.z,meshTarget);let q=A*bary.x+B*bary.y+C*bary.z;var normal=normalize(cross(B-A,C-A));var d=dot(x-q,normal);var gap=baseGap;var correction=0.;
 if(meshTarget==0u){let vertexNormals=meshinfo[0].z;normal=normalize(body[vertexNormals+face.x].xyz*bary.x+body[vertexNormals+face.y].xyz*bary.y+body[vertexNormals+face.z].xyz*bary.z);let len=sqrt(max(0.,cp.x));let sign=select(1.,-1.,dot(x-q,normal)<0.);d=len*sign;if(len>1e-10){normal=(x-q)*sign/len;}if(m>1u){gap+=.0008;}if(d>=gap){return;}correction=min(.008,gap-d);
 }else{if(cp.x>.045*.045||d>=gap||d<-.035||cp.x-d*d>gap*gap){return;}correction=min(.012,gap-d);if(!oneWay){for(var k=0u;k<3u;k++){ws+=weight(face[k])*bary[k]*bary[k];}}}
 let dl=correction/max(ws,1e-20);for(var k=0u;k<m;k++){addDelta(ids[k],normal*(weight(ids[k])/f32(m)*dl));}
 if(meshTarget==1u&&!oneWay){for(var k=0u;k<3u;k++){addDelta(face[k],-normal*(weight(face[k])*bary[k]*dl));}}
}

fn projectVertex(i:u32,sampleRange:vec4u,meshTarget:u32,refresh:bool,baseGap:f32){
 let source=topo[sampleRange.x+i].x;if(weight(source)==0.){return;}let x=point(source);let slot=sampleRange.z+i;var f=cache[slot];if(refresh||f<0){f=nearest(x,meshTarget,f);cache[slot]=f;}if(f<0){return;}let face=topo[u32(f)];let cp=closest(x,u32(f),meshTarget);let bary=vec3f(1.-cp.y-cp.z,cp.y,cp.z);let A=meshpoint(face.x,meshTarget);let B=meshpoint(face.y,meshTarget);let C=meshpoint(face.z,meshTarget);let q=A*bary.x+B*bary.y+C*bary.z;var normal=normalize(cross(B-A,C-A));var dist=dot(x-q,normal);let gap=baseGap;
 if(meshTarget==0u){let base=meshinfo[0].z;normal=normalize(body[base+face.x].xyz*bary.x+body[base+face.y].xyz*bary.y+body[base+face.z].xyz*bary.z);let len=sqrt(max(0.,cp.x));let sign=select(1.,-1.,dot(x-q,normal)<0.);dist=len*sign;if(len>1e-10){normal=(x-q)*sign/len;}if(dist<gap){setpoint(source,x+normal*min(.008,gap-dist));}}
 else if(cp.x<=.045*.045&&dist<gap&&dist>=-.035&&cp.x-dist*dist<=gap*gap){setpoint(source,x+normal*min(.012,gap-dist));}
}





@compute @workgroup_size(128) fn contactCached(@builtin(global_invocation_id) id:vec3u){
 let i=id.x;if(i>=u.range.y){return;}let sample=topo[u.range.x+i];let m=sample.w;let ids=sample.xyz;var x=vec3f(0.);var ws=0.;for(var k=0u;k<m;k++){x+=point(ids[k])/f32(m);ws+=weight(ids[k])/f32(m*m);}if(ws==0.){return;}
 let meshTarget=u.op.z;let slot=u.range.z+i;let f=cache[slot];if(f<0){return;}
 let face=topo[u32(f)];let cp=closest(x,u32(f),meshTarget);let bary=vec3f(1.-cp.y-cp.z,cp.y,cp.z);let A=meshpoint(face.x,meshTarget);let B=meshpoint(face.y,meshTarget);let C=meshpoint(face.z,meshTarget);let q=A*bary.x+B*bary.y+C*bary.z;var normal=normalize(cross(B-A,C-A));var d=dot(x-q,normal);var gap=u.step.w;var correction=0.;
 if(meshTarget==0u){let vertexNormals=meshinfo[0].z;normal=normalize(body[vertexNormals+face.x].xyz*bary.x+body[vertexNormals+face.y].xyz*bary.y+body[vertexNormals+face.z].xyz*bary.z);let len=sqrt(max(0.,cp.x));let sign=select(1.,-1.,dot(x-q,normal)<0.);d=len*sign;if(len>1e-10){normal=(x-q)*sign/len;}if(m>1u){gap+=.0008;}if(d>=gap){return;}correction=min(.008,gap-d);
 }else{if(cp.x>.045*.045||d>=gap||d<-.035||cp.x-d*d>gap*gap){return;}correction=min(.012,gap-d);if(u.range.w==0u){for(var k=0u;k<3u;k++){ws+=weight(face[k])*bary[k]*bary[k];}}}
 let dl=correction/max(ws,1e-20);for(var k=0u;k<m;k++){addDelta(ids[k],normal*(weight(ids[k])/f32(m)*dl));}
 if(meshTarget==1u&&u.range.w==0u){for(var k=0u;k<3u;k++){addDelta(face[k],-normal*(weight(face[k])*bary[k]*dl));}}
}

@compute @workgroup_size(128) fn contactVertexCached(@builtin(global_invocation_id) id:vec3u){
 let i=id.x;if(i>=u.range.y){return;}let source=topo[u.range.x+i].x;if(weight(source)==0.){return;}let x=point(source);let meshTarget=u.op.z;let slot=u.range.z+i;let f=cache[slot];if(f<0){return;}let face=topo[u32(f)];let cp=closest(x,u32(f),meshTarget);let bary=vec3f(1.-cp.y-cp.z,cp.y,cp.z);let A=meshpoint(face.x,meshTarget);let B=meshpoint(face.y,meshTarget);let C=meshpoint(face.z,meshTarget);let q=A*bary.x+B*bary.y+C*bary.z;var normal=normalize(cross(B-A,C-A));var dist=dot(x-q,normal);let gap=u.step.w;
 if(meshTarget==0u){let base=meshinfo[0].z;normal=normalize(body[base+face.x].xyz*bary.x+body[base+face.y].xyz*bary.y+body[base+face.z].xyz*bary.z);let len=sqrt(max(0.,cp.x));let sign=select(1.,-1.,dot(x-q,normal)<0.);dist=len*sign;if(len>1e-10){normal=(x-q)*sign/len;}if(dist<gap){setpoint(source,x+normal*min(.008,gap-dist));}}
 else if(cp.x<=.045*.045&&dist<gap&&dist>=-.035&&cp.x-dist*dist<=gap*gap){setpoint(source,x+normal*min(.012,gap-dist));}
}
@compute @workgroup_size(32) fn queryContacts(@builtin(global_invocation_id) id:vec3u){let i=id.x;if(i>=u.range.y){return;}let slot=u.range.z+i;if(u.op.w==0u&&cache[slot]>=0){return;}let r=topo[u.range.x+i];var x=vec3f(0.);for(var k=0u;k<r.w;k++){x+=point(r[k])/f32(r.w);}if(u.op.z==1u){let n=nodes[meshinfo[1].x];if(any(x<n.lo.xyz-vec3f(.045))||any(x>n.hi.xyz+vec3f(.045))){cache[slot]=-1;return;}}cache[slot]=nearest(x,u.op.z,cache[slot]);if(u.op.z==0u&&cache[slot]>=0){storeBodyTriangle(slot,u32(cache[slot]));}}
@compute @workgroup_size(32) fn constraintColour(@builtin(global_invocation_id) id:vec3u){let k=id.x;if(k>=u.range.y+u.range.w){return;}let j=select(u.range.x+k,u.range.z+k-u.range.y,k>=u.range.y);if(u.op.x==2u){let material=select(u.a,u.b,bends[j].ids.x>=u.bounds.x);bending(j,material.y);}else{let material=select(u.a,u.b,u32(edges[j].x)>=u.bounds.x);if(u.op.x==1u){strain(j,material.z,material.w);}else{distance(j,material.x);}}}
fn storeBodyTriangle(slot:u32,f:u32){let face=topo[f];let A=body[face.x].xyz;let U=body[face.y].xyz-A;let V=body[face.z].xyz-A;let base=meshinfo[8].x+slot*6u;body[base]=vec4f(A,dot(U,V));body[base+1u]=vec4f(U,dot(U,U));body[base+2u]=vec4f(V,dot(V,V));let n=meshinfo[0].z;body[base+3u]=body[n+face.x];body[base+4u]=body[n+face.y];body[base+5u]=body[n+face.z];}
@compute @workgroup_size(128) fn refreshBodyTriangles(@builtin(global_invocation_id) id:vec3u){let slot=id.x;if(slot>=meshinfo[8].y){return;}let f=cache[slot];if(f>=0){storeBodyTriangle(slot,u32(f));}}
fn bodyClosest(x:vec3f,slot:u32)->vec4f{let base=meshinfo[8].x+slot*6u;let ar=body[base];let ur=body[base+1u];let vr=body[base+2u];let A=ar.xyz;let U=ur.xyz;let V=vr.xyz;let W=x-A;let uu=ur.w;let vv=vr.w;let uv=ar.w;let den=uu*vv-uv*uv;var b=0.;var c=0.;if(den>1e-24){let wu=dot(W,U);let wv=dot(W,V);b=(wu*vv-wv*uv)/den;c=(wv*uu-wu*uv)/den;}if(b<0.||c<0.||b+c>1.||den<=1e-24){var best=1e30;for(var k=0u;k<3u;k++){var s=vec3f(0.);var e=U;if(k==1u){s=U;e=V-U;}else if(k==2u){s=V;e=-V;}let t=clamp(dot(W-s,e)/max(1e-24,dot(e,e)),0.,1.);let d=dot(s+t*e-W,s+t*e-W);if(d<best){best=d;if(k==0u){b=t;c=0.;}else if(k==1u){b=1.-t;c=t;}else{b=0.;c=1.-t;}}}}let q=A+U*b+V*c;return vec4f(q,b+2.*c);}
@compute @workgroup_size(128) fn bodyVertexCoefficients(@builtin(global_invocation_id) id:vec3u){let i=id.x;if(i>=u.range.y){return;}let source=topo[u.range.x+i].x;if(weight(source)==0.){return;}let slot=u.range.z+i;if(cache[slot]<0){return;}let x=point(source);let base=meshinfo[8].x+slot*6u;
 // Closest result stores the point. Recover barycentrics directly for the
 // smooth normal; edge clamping is recomputed from the point, not screen data.
 let q=bodyClosest(x,slot).xyz;let A=body[base].xyz;let U=body[base+1u].xyz;let V=body[base+2u].xyz;let uu=body[base+1u].w;let vv=body[base+2u].w;let uv=body[base].w;let den=uu*vv-uv*uv;let W=q-A;let b=select(0.,(dot(W,U)*vv-dot(W,V)*uv)/max(den,1e-24),den>1e-24);let c=select(0.,(dot(W,V)*uu-dot(W,U)*uv)/max(den,1e-24),den>1e-24);var normal=normalize(body[base+3u].xyz*(1.-b-c)+body[base+4u].xyz*b+body[base+5u].xyz*c);let len=length(x-q);let sign=select(1.,-1.,dot(x-q,normal)<0.);let dist=len*sign;if(len>1e-10){normal=(x-q)*sign/len;}if(dist<u.step.w){setpoint(source,x+normal*min(.008,u.step.w-dist));}
}

fn projectCachedSample(i:u32){
 if(i>=u.range.y){return;}let sample=topo[u.range.x+i];let m=sample.w;let ids=sample.xyz;var x=vec3f(0.);var ws=0.;for(var k=0u;k<m;k++){x+=point(ids[k])/f32(m);ws+=weight(ids[k])/f32(m*m);}if(ws==0.){return;}
 let meshTarget=u.op.z;let slot=u.range.z+i;let f=cache[slot];if(f<0){return;}
 let face=topo[u32(f)];let cp=closest(x,u32(f),meshTarget);let bary=vec3f(1.-cp.y-cp.z,cp.y,cp.z);let A=meshpoint(face.x,meshTarget);let B=meshpoint(face.y,meshTarget);let C=meshpoint(face.z,meshTarget);let q=A*bary.x+B*bary.y+C*bary.z;var normal=normalize(cross(B-A,C-A));var d=dot(x-q,normal);var gap=u.step.w;var correction=0.;
 if(meshTarget==0u){let vertexNormals=meshinfo[0].z;normal=normalize(body[vertexNormals+face.x].xyz*bary.x+body[vertexNormals+face.y].xyz*bary.y+body[vertexNormals+face.z].xyz*bary.z);let len=sqrt(max(0.,cp.x));let sign=select(1.,-1.,dot(x-q,normal)<0.);d=len*sign;if(len>1e-10){normal=(x-q)*sign/len;}if(m>1u){gap+=.0008;}if(d>=gap){return;}correction=min(.008,gap-d);
 }else{if(cp.x>.045*.045||d>=gap||d<-.035||cp.x-d*d>gap*gap){return;}correction=min(.012,gap-d);if(u.range.w==0u){for(var k=0u;k<3u;k++){ws+=weight(face[k])*bary[k]*bary[k];}}}
 let dl=correction/max(ws,1e-20);for(var k=0u;k<m;k++){addDelta(ids[k],normal*(weight(ids[k])/f32(m)*dl));}
 if(meshTarget==1u&&u.range.w==0u){for(var k=0u;k<3u;k++){addDelta(face[k],-normal*(weight(face[k])*bary[k]*dl));}}
}
@compute @workgroup_size(256) fn pairVertexGatherWG(@builtin(local_invocation_index) lane:u32){for(var k=lane;k<u.bounds.y*4u;k+=256u){atomicStore(&delta[k],0);}storageBarrier();for(var i=lane;i<u.range.y;i+=256u){projectCachedSample(i);}storageBarrier();for(var i=lane;i<u.bounds.y;i+=256u){let n=atomicLoad(&delta[i*4u+3u]);if(n>0&&weight(i)>0.){let d=vec3f(f32(atomicLoad(&delta[i*4u])),f32(atomicLoad(&delta[i*4u+1u])),f32(atomicLoad(&delta[i*4u+2u])))/1e7;setpoint(i,point(i)+d/f32(n));}}}
@compute @workgroup_size(128) fn bodyInteriorEvaluate(@builtin(global_invocation_id) id:vec3u){let i=id.x;if(i>=u.range.y){return;}let output=meshinfo[9].x+i;body[output]=vec4f(0.);let sample=topo[u.range.x+i];let slot=u.range.z+i;if(cache[slot]<0){return;}var x=vec3f(0.);var ws=0.;for(var k=0u;k<sample.w;k++){x+=point(sample[k])/f32(sample.w);ws+=weight(sample[k])/f32(sample.w*sample.w);}if(ws==0.){return;}let q=bodyClosest(x,slot).xyz;let base=meshinfo[8].x+slot*6u;let A=body[base].xyz;let U=body[base+1u].xyz;let V=body[base+2u].xyz;let uu=body[base+1u].w;let vv=body[base+2u].w;let uv=body[base].w;let den=max(1e-24,uu*vv-uv*uv);let W=q-A;let b=(dot(W,U)*vv-dot(W,V)*uv)/den;let c=(dot(W,V)*uu-dot(W,U)*uv)/den;var n=normalize(body[base+3u].xyz*(1.-b-c)+body[base+4u].xyz*b+body[base+5u].xyz*c);let L=length(x-q);let sign=select(1.,-1.,dot(x-q,n)<0.);let dist=L*sign;if(L>1e-10){n=(x-q)*sign/L;}let gap=u.step.w+.0008;if(dist<gap){body[output]=vec4f(n*(min(.008,gap-dist)/ws/f32(sample.w)),1.);}}
@compute @workgroup_size(128) fn bodyInteriorGather(@builtin(global_invocation_id) id:vec3u){let i=id.x;if(i>=u.bounds.y||weight(i)==0.){return;}let info=meshinfo[9];let r=topo[info.y+i];var d=vec3f(0.);var n=0.;for(var k=0u;k<r.y;k++){let j=topo[r.x+k].x;let q=body[info.x+j];d+=q.xyz*weight(i);n+=q.w;}if(n>0.){setpoint(i,point(i)+d/n);}}
// Swept contact carry is restricted to an existing near-surface contact.
// Tangential transport is bounded by a Coulomb-style friction budget; this is
// not whole-cloth skinning or a rest-shape attraction force.
@compute @workgroup_size(128) fn bodyCarry(@builtin(global_invocation_id) id:vec3u){let i=id.x;if(i>=u.bounds.y||weight(i)==0.){return;}let f=cache[i];if(f<0){return;}let x=point(i);let face=topo[u32(f)];let a=meshpoint(face.x,2u);let b=meshpoint(face.y,2u);let c=meshpoint(face.z,2u);let rawN=cross(b-a,c-a);if(length(rawN)<1e-14){return;}let N=normalize(rawN);let cp=closest(x,u32(f),2u);let bary=vec3f(1.-cp.y-cp.z,cp.y,cp.z);let q=a*bary.x+b*bary.y+c*bary.z;let dist=sqrt(max(0.,cp.x))*select(1.,-1.,dot(x-q,N)<0.);if(dist>u.a.w+.0015||dist<-.006){return;}let deltaBody=(body[face.x].xyz-a)*bary.x+(body[face.y].xyz-b)*bary.y+(body[face.z].xyz-c)*bary.z;let vn=dot(deltaBody,N);let normalMove=max(0.,vn);let tangent=deltaBody-N*vn;let friction=.4*(normalMove+max(0.,u.a.w-dist)+max(0.,N.y)*9.81*u.step.x*u.step.x);let T=tangent*min(1.,friction/max(1e-20,length(tangent)));let D=N*normalMove+T;setpoint(i,x+D*min(1.,.01/max(1e-20,length(D))));}




// Bounded, explicit untangling search for a closing body/body corridor. Only
// contact-adjacent overstrained particles participate. Every proposed exit is
// checked against the full current triangle BVH and oriented ray winding.









