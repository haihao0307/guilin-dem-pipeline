// Geometry and material output are paired samples of the same frozen R05 B source.
// Finite meshes serve the map; they do not claim the full function renderer is realtime.
const stSpec=window.HK_STATION_DATA;
if(!stSpec)throw Error('九龙同源构件采样尚未完成，禁止用占位建筑冒充');
const stP=await unpack64(stSpec.positions,'f32'),stN=await unpack64(stSpec.normals,'f32'),stC=await unpack64(stSpec.colors,'f32'),stR=await unpack64(stSpec.roughness,'f32'),stD=await unpack64(stSpec.geometryDistance,'f32');
const stIBuffer=await new Response(new Blob([Uint8Array.from(atob(stSpec.indices),c=>c.charCodeAt(0))]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(),stIndices=new Uint32Array(stIBuffer);
const stV=new Float32Array(stP.length/3*10);let stMaxShift=0;
for(let j=0;j<stP.length/3;j++){
 let d=stD[j],p=[0,1,2].map(k=>stP[j*3+k]-stN[j*3+k]*d),n=stN.subarray(j*3,j*3+3);stMaxShift=Math.max(stMaxShift,Math.abs(d));
 // Tower pivot [24,0,4] anchored to the actual old clocktower; eastward authored station axis.
 let x=1477.171-(p[2]-4),z=9824.015+(p[0]-24),y=3.90+p[1];
 stV.set([x,y,z,-n[2],n[1],n[0],stC[j*3],stC[j*3+1],stC[j*3+2],stR[j]],j*10);
}
const stVS=`#version 300 es
precision highp float;layout(location=0)in vec3 aPos;layout(location=1)in vec3 aNormal;layout(location=2)in vec3 aColor;layout(location=3)in float aRoughness;uniform vec3 camera,fw,right,up;uniform float tanFov,aspect;out vec3 n,color,world;out float rough;void main(){world=aPos;n=aNormal;color=aColor;rough=aRoughness;vec3 v=aPos-camera;float z=dot(v,fw),near=.15,far=60000.;gl_Position=vec4(dot(v,right)/(tanFov*aspect),dot(v,up)/tanFov,(far+near)/(far-near)*z-2.*far*near/(far-near),z);}`;
const stFS=`#version 300 es
precision highp float;in vec3 n,color,world;in float rough;uniform vec3 camera,uSun;uniform float exposure;out vec4 O;void main(){vec3 N=normalize(n),L=normalize(uSun),V=normalize(camera-world),H=normalize(L+V);float d=max(0.,dot(N,L)),s=pow(max(0.,dot(N,H)),mix(70.,5.,rough))*(1.-rough)*.16;vec3 c=color*(.55+.55*d)+vec3(s);O=vec4(pow(clamp(c*exposure,0.,1.),vec3(1./2.2)),1.);}`;
const stProgram=program(stVS,stFS),stVAO=gl.createVertexArray();gl.bindVertexArray(stVAO);const stVB=gl.createBuffer(),stIB=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,stVB);gl.bufferData(gl.ARRAY_BUFFER,stV,gl.STATIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,stIB);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,stIndices,gl.STATIC_DRAW);for(let k=0;k<3;k++){gl.enableVertexAttribArray(k);gl.vertexAttribPointer(k,3,gl.FLOAT,false,40,k*12)}gl.enableVertexAttribArray(3);gl.vertexAttribPointer(3,1,gl.FLOAT,false,40,36);
function drawKowloon(now,s,e,c){common(stProgram,now,s,e,c);gl.bindVertexArray(stVAO);gl.drawElements(gl.TRIANGLES,stIndices.length,gl.UNSIGNED_INT,0);qa.kowloonStation={...stSpec.metadata,renderVertices:stP.length/3,renderTriangles:stIndices.length/3,maxNormalDisplacementM:stMaxShift,footprintDatumM:3.90,footprintDatumStatus:'Authored station base using nearby DTM median; tower anchor itself is NoData',axisStatus:'Eastward authored station orientation, not a surveyed historic registration',display:'same-source geometry/material finite mesh sample, not full analytic renderer'}}
