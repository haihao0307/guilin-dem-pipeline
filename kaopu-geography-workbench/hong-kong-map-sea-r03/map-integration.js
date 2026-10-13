// R02 bounded fictional story world: source DSM plus explicitly documented water-body terrain synthesis.
const HK = window.HK_MAP_DATA;
async function unpack64(s,type){let b=Uint8Array.from(atob(s),c=>c.charCodeAt(0));let a=await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();return type==='f32'?new Float32Array(a):new Uint8Array(a)}
const hkHeights=await unpack64(HK.heights,'f32'),hkMask=await unpack64(HK.mask,'u8');
if(hkHeights.length!==HK.width*HK.height||hkMask.length!==hkHeights.length)throw Error('香港源数据尺寸校验失败');
const hkBox=[HK.x0-HK.origin[0],HK.origin[1]-HK.y0,HK.step*(HK.width-1),HK.step*(HK.height-1)];
// CEDD source remains native 0.5m. Runtime levels are explicit 2m/5m displays.
const detailSpec=window.HK_DETAIL_DATA,detailPatches=[];
for(const p of detailSpec.patches){let q={...p,levels:{}};for(const [key,l]of Object.entries(p.levels)){q.levels[key]={...l,heights:await unpack64(l.heights,'f32'),mask:await unpack64(l.mask,'u8'),weight:await unpack64(l.weight,'u8')};}detailPatches.push(q)}
function rectLocal(p){let b=p.bounds_epsg2326;return[b[0]-HK.origin[0],HK.origin[1]-b[3],b[2]-b[0],b[3]-b[1]]}
function insideDetail(x,z){return detailPatches.some(p=>{let b=rectLocal(p);return x>b[0]&&z>b[1]&&x<b[0]+b[2]&&z<b[1]+b[3]})}
function sampleDetail(x,z){for(let p of detailPatches){let l=p.levels['2'],col=(x+HK.origin[0]-l.x0)/l.step,row=(HK.origin[1]-z-l.y0)/-l.step;if(col<0||row<0||col>l.width-1||row>l.height-1)continue;let c=Math.min(l.width-2,Math.floor(col)),r=Math.min(l.height-2,Math.floor(row)),u=col-c,v=row-r,j=r*l.width+c,A=l.heights[j],B=l.heights[j+1],C=l.heights[j+l.width],D=l.heights[j+l.width+1];return u+v<=1?A+(B-A)*u+(C-A)*v:D+(C-D)*(1-u)+(B-D)*(1-v)}return null}
function makeDetailMesh(l){let vs=new Float32Array(l.width*l.height*7),ix=[];for(let r=0;r<l.height;r++)for(let c=0;c<l.width;c++){let j=r*l.width+c,h=l.heights[j],xm=l.heights[r*l.width+Math.max(0,c-1)],xp=l.heights[r*l.width+Math.min(l.width-1,c+1)],zm=l.heights[Math.max(0,r-1)*l.width+c],zp=l.heights[Math.min(l.height-1,r+1)*l.width+c],n=norm([xm-xp,l.step*2,zm-zp]);vs.set([l.x0-HK.origin[0]+c*l.step,h,HK.origin[1]-l.y0+r*l.step,...n,l.mask[j]],j*7);if(c<l.width-1&&r<l.height-1){for(let ids of[[j,j+l.width,j+1],[j+1,j+l.width,j+l.width+1]])if(ids.every(k=>l.mask[k]!==0))ix.push(...ids)}}return hkMesh(vs,ix,7)}
function initDetailMeshes(){for(let p of detailPatches)for(let l of Object.values(p.levels))l.mesh=makeDetailMesh(l)}
function drawDetails(now,s,e,c){let fine=[];for(let p of detailPatches){let b=rectLocal(p),cx=b[0]+b[2]/2,cz=b[1]+b[3]/2,near=Math.hypot(c.cam[0]-cx,c.cam[2]-cz,c.cam[1])<6000;let l=p.levels[near?'2':'5'];if(near)fine.push(p.id);common(hkProgram,now,s,e,c);gl.bindVertexArray(l.mesh.vao);gl.drawElements(gl.TRIANGLES,l.mesh.count,gl.UNSIGNED_INT,0)}qa.detailLevel2m=fine;qa.detailPatches=detailPatches.length;if(mapState.coverage){gl.disable(gl.DEPTH_TEST);for(let p of detailPatches){common(routeProgram,now,s,e,c);v3(routeProgram,'color',[.96,.87,.29]);gl.bindVertexArray(p.outline.vao);gl.drawElements(gl.TRIANGLES,p.outline.count,gl.UNSIGNED_INT,0)}gl.enable(gl.DEPTH_TEST)}}

const mapState={target:[0,0,0],distance:45000,yaw:-.90,pitch:-.64,rail:false,story:true,labels:true,coverage:false,canopy:true,ready:false};
const hkMaskTex=gl.createTexture();gl.activeTexture(gl.TEXTURE0+6);gl.bindTexture(gl.TEXTURE_2D,hkMaskTex);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,HK.width,HK.height,0,gl.RED,gl.UNSIGNED_BYTE,hkMask);
const hkVS=`#version 300 es
precision highp float;layout(location=0) in vec3 aPos;layout(location=1) in vec3 aNormal;layout(location=2) in float aWater;uniform vec3 camera,fw,right,up;uniform float tanFov,aspect;out vec3 p,n;out float water;void main(){p=aPos;n=aNormal;water=aWater;vec3 v=p-camera;float z=dot(v,fw),near=.15,far=60000.;gl_Position=vec4(dot(v,right)/(tanFov*aspect),dot(v,up)/tanFov,(far+near)/(far-near)*z-2.*far*near/(far-near),z);}`;
const hkFS=`#version 300 es
precision highp float;in vec3 p,n;in float water;uniform vec3 uSun;uniform float exposure;out vec4 O;void main(){vec3 N=normalize(n);float h=max(p.y,0.);vec3 low=vec3(.50,.59,.36),mid=vec3(.20,.38,.22),high=vec3(.44,.48,.35);vec3 c=mix(low,mid,smoothstep(15.,350.,h));c=mix(c,high,smoothstep(450.,950.,h));if(water>1.5)c=vec3(.22,.39,.44);float light=.55+.55*max(0.,dot(N,normalize(uSun)));c*=light;O=vec4(pow(clamp(c*exposure,0.,1.),vec3(.85)),1.);}`;
const hkProgram=program(hkVS,hkFS);
function hkHeight(x,z){let detail=sampleDetail(x,z);if(detail!==null)return detail;let c=Math.round((x-hkBox[0])/HK.step),r=Math.round((z-hkBox[1])/HK.step);if(c<0||r<0||c>=HK.width||r>=HK.height)return NaN;return hkHeights[r*HK.width+c]}
const hkV=new Float32Array(HK.width*HK.height*7),hkI=[];
for(let r=0;r<HK.height;r++)for(let c=0;c<HK.width;c++){let j=r*HK.width+c,h=hkHeights[j],xm=hkHeights[r*HK.width+Math.max(0,c-1)],xp=hkHeights[r*HK.width+Math.min(HK.width-1,c+1)],zm=hkHeights[Math.max(0,r-1)*HK.width+c],zp=hkHeights[Math.min(HK.height-1,r+1)*HK.width+c],n=Number.isFinite(xm+xp+zm+zp)?norm([xm-xp,HK.step*2,zm-zp]):[0,1,0];hkV.set([hkBox[0]+c*HK.step,Number.isFinite(h)?h:0,hkBox[1]+r*HK.step,...n,hkMask[j]],j*7);if(c<HK.width-1&&r<HK.height-1){for(const ids of[[j,j+HK.width,j+1],[j+1,j+HK.width,j+HK.width+1]])if(ids.every(i=>hkMask[i]!==0&&Number.isFinite(hkHeights[i]))&&!insideDetail(hkBox[0]+(c+.5)*HK.step,hkBox[1]+(r+.5)*HK.step))hkI.push(...ids)}}
function hkMesh(v,ind,stride=6){const vao=gl.createVertexArray(),vb=gl.createBuffer(),ib=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,v,gl.STATIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(ind),gl.STATIC_DRAW);for(let i=0;i<2;i++){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,3,gl.FLOAT,false,stride*4,i*12)}if(stride===7){gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,1,gl.FLOAT,false,28,24)}return{vao,count:ind.length}}
const hkMeshData=hkMesh(hkV,hkI,7);
initDetailMeshes();
const routeFS=`#version 300 es
precision highp float;uniform vec3 color;out vec4 O;void main(){O=vec4(color,1.);}`;
const routeProgram=program(hkVS,routeFS);
function routeMesh(points,width,dashed){let v=[],idx=[],arc=0;for(let k=1;k<points.length;k++){let a=points[k-1],b=points[k],d=Math.hypot(b[0]-a[0],b[1]-a[1]),count=Math.max(1,Math.ceil(d/40));for(let j=0;j<count;j++){let t0=j/count,t1=(j+1)/count,ar=arc+d*(t0+t1)/2;if(dashed&&Math.floor(ar/180)%2)continue;let x0=a[0]+(b[0]-a[0])*t0,z0=a[1]+(b[1]-a[1])*t0,x1=a[0]+(b[0]-a[0])*t1,z1=a[1]+(b[1]-a[1])*t1,dx=-(z1-z0),dz=x1-x0,l=Math.hypot(dx,dz)||1;dx=dx/l*width;dz=dz/l*width;let base=v.length/6;for(let q of[[x0+dx,z0+dz],[x0-dx,z0-dz],[x1+dx,z1+dz],[x1-dx,z1-dz]]){let h=hkHeight(...q);if(!Number.isFinite(h))h=0;v.push(q[0],h+10,q[1],0,1,0)}idx.push(base,base+1,base+2,base+2,base+1,base+3)}arc+=d}return hkMesh(new Float32Array(v),idx)}
for(let p of detailPatches){let b=rectLocal(p);p.outline=routeMesh([[b[0],b[1]],[b[0]+b[2],b[1]],[b[0]+b[2],b[1]+b[3]],[b[0],b[1]+b[3]],[b[0],b[1]]],5,false)}
const hkRoutes=HK.routes.map(r=>({...r,mesh:routeMesh(r.points,r.kind==='story'?22:13,r.kind==='story')}));
// Lightweight planning markers only: these are not approved station architecture.
const stationVS=hkVS;
const stationFS=`#version 300 es
precision highp float;in vec3 p,n;uniform vec3 color,uSun;out vec4 O;void main(){float l=.50+.50*max(0.,dot(normalize(n),normalize(uSun)));O=vec4(color*l,1.);}`;
const stationProgram=program(stationVS,stationFS);
function planningBox(cx,cz,y,sx,sz,sy,yaw){let a=[],ix=[],c=Math.cos(yaw),s=Math.sin(yaw);const pts=[[-sx/2,0,-sz/2],[sx/2,0,-sz/2],[sx/2,0,sz/2],[-sx/2,0,sz/2],[-sx/2,sy,-sz/2],[sx/2,sy,-sz/2],[sx/2,sy,sz/2],[-sx/2,sy,sz/2]].map(q=>[cx+q[0]*c-q[2]*s,y+q[1],cz+q[0]*s+q[2]*c]);for(const f of[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]){let base=a.length/6,P=f.map(i=>pts[i]),N=norm(cross(P[1].map((v,i)=>v-P[0][i]),P[2].map((v,i)=>v-P[0][i])));for(const q of P)a.push(...q,...N);ix.push(base,base+1,base+2,base,base+2,base+3)}return hkMesh(new Float32Array(a),ix)}
const stationMeshes=[];
for(const st of HK.stations||[]){let anchors=st.platform_anchors_epsg2326?.map(p=>[p[0]-HK.origin[0],HK.origin[1]-p[1]])||[[st.point[0]-30,st.point[1]],[st.point[0]+30,st.point[1]]];let yaw=st.axis_yaw||0;for(const p of anchors){let ground=hkHeight(...p);if(!Number.isFinite(ground))continue;stationMeshes.push({mesh:planningBox(p[0],p[1],ground+2,18,240,3,yaw),color:[.89,.73,.42]});stationMeshes.push({mesh:planningBox(p[0],p[1],ground+18,26,250,3,yaw),color:[.79,.63,.39]});for(const side of[-1,1])for(const end of[-1,1]){let x=side*7,z=end*100,c=Math.cos(yaw),s=Math.sin(yaw);stationMeshes.push({mesh:planningBox(p[0]+x*c-z*s,p[1]+x*s+z*c,ground+5,3,3,13,0),color:[.67,.70,.65]})}}}
const B=hkBox,boundaryMesh=routeMesh([[B[0],B[1]],[B[0]+B[2],B[1]],[B[0]+B[2],B[1]+B[3]],[B[0],B[1]+B[3]],[B[0],B[1]]],12,false);
function drawStoryObjects(now,s,e,c){for(const m of stationMeshes){common(stationProgram,now,s,e,c);v3(stationProgram,'color',m.color);gl.bindVertexArray(m.mesh.vao);gl.drawElements(gl.TRIANGLES,m.mesh.count,gl.UNSIGNED_INT,0)}gl.disable(gl.DEPTH_TEST);common(routeProgram,now,s,e,c);v3(routeProgram,'color',[.9,.72,.36]);gl.bindVertexArray(boundaryMesh.vao);gl.drawElements(gl.TRIANGLES,boundaryMesh.count,gl.UNSIGNED_INT,0);gl.enable(gl.DEPTH_TEST);$('northCompass').style.transform=`rotate(${-mapState.yaw}rad)`;}

// Root-clamped multiscale bend adapted from the hair workbench's own anemone-core.
// A new geographic canopy test, not transferred head hair and not botanical trees.
const canopyVS=`#version 300 es
precision highp float;
layout(location=0) in vec3 root;layout(location=1) in vec4 shape;
uniform vec3 camera,fw,right,up;uniform float tanFov,aspect,windTime;out float h,edge,phase;out vec3 world;
float hash(float n){return fract(sin(n*127.1+73.)*43758.5453)*2.-1.;}
float noise(float x){float i=floor(x),f=fract(x),u=f*f*(3.-2.*f);return mix(hash(i),hash(i+1.),u);}
void main(){int k=gl_VertexID%18;int seg=k/6,corner=k%6;float u0=float(seg)/3.,u1=float(seg+1)/3.;float u=(corner==0||corner==1||corner==3)?u0:u1;float side=(corner==0||corner==3||corner==5)?-1.:1.;float a=shape.z+float(gl_VertexID/18)*1.57079633,t=windTime*.42,flex=u*u;
 float shared=sin(t*6.2831853*.55-u*1.5+root.x*.003)+.23*sin(t*6.2831853*.217+root.z*.005);
 float local=noise(t*1.9-u*.9+root.x*.07+root.z*.05);
 float flow=.55+shared*.6+(sin(t*6.2831853*.55)*.7+sin(t*6.2831853*.217+1.)*.3)*.15;
 vec2 bend=flex*shape.y*vec2(flow*.13-local*.04,flow*.06+local*.08);
 float width=shape.x*(1.-u*.82);world=root+vec3(cos(a)*side*width+bend.x,u*shape.y,sin(a)*side*width+bend.y);h=u;edge=side;phase=shape.w;
 vec3 v=world-camera;float z=dot(v,fw),near=.15,far=60000.;gl_Position=vec4(dot(v,right)/(tanFov*aspect),dot(v,up)/tanFov,(far+near)/(far-near)*z-2.*far*near/(far-near),z);
}`;
const canopyFS=`#version 300 es
precision highp float;in float h,edge,phase;in vec3 world;out vec4 O;void main(){float fringe=.86+.14*sin(h*43.+phase*23.);if(abs(edge)>fringe)discard;vec3 col=mix(vec3(.09,.22,.095),vec3(.31,.46,.19),h);col*=.82+.18*phase;O=vec4(col,1.);}`;
const canopyProgram=program(canopyVS,canopyFS),canopyRoots=[];
const canopyAreas=[{x:3331.595,z:3323.869,r:720},{x:8180,z:180,r:480},{x:-480,z:-11000,r:400}];
function canopyRand(n){return (Math.sin(n*127.1+73)*43758.5453)%1+.5}
for(let a of canopyAreas)for(let x=a.x-a.r;x<a.x+a.r;x+=5)for(let z=a.z-a.r;z<a.z+a.r;z+=5){let seed=x*.173+z*.117,j=(Math.sin(seed)*43758.5)%1,xx=x+j*6,zz=z+Math.sin(seed*3)*4,h=hkHeight(xx,zz);if(!Number.isFinite(h)||h<160||Math.hypot(xx-a.x,zz-a.z)>a.r)continue;let dx=hkHeight(xx+8,zz)-hkHeight(xx-8,zz),dz=hkHeight(xx,zz+8)-hkHeight(xx,zz-8);if(Math.hypot(dx,dz)>30)continue;canopyRoots.push(xx,h-.15,zz,1.8+Math.abs(j)*.6,4.5+Math.abs(j)*3,seed,Math.abs(j))}
const canopyVAO=gl.createVertexArray();gl.bindVertexArray(canopyVAO);const canopyVB=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,canopyVB);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(canopyRoots),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,28,0);gl.vertexAttribDivisor(0,1);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,4,gl.FLOAT,false,28,12);gl.vertexAttribDivisor(1,1);
function drawCanopy(now,s,e,c){if(!mapState.canopy)return;common(canopyProgram,now,s,e,c);f(canopyProgram,'windTime',seaTime);gl.bindVertexArray(canopyVAO);gl.drawArraysInstanced(gl.TRIANGLES,0,36,canopyRoots.length/7);qa.canopyRoots=canopyRoots.length/7;qa.canopyTime=seaTime}

// Geometry and material output are paired samples of the same frozen R05 B source.
// Finite meshes serve the map; they do not claim the full function renderer is realtime.
const stSpec=window.HK_STATION_DATA;
let drawKowloon=()=>{qa.kowloonStation={status:'not-yet-sampled'}};
if(stSpec){
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
drawKowloon=(now,s,e,c)=>{common(stProgram,now,s,e,c);gl.bindVertexArray(stVAO);gl.drawElements(gl.TRIANGLES,stIndices.length,gl.UNSIGNED_INT,0);qa.kowloonStation={...stSpec.metadata,renderVertices:stP.length/3,renderTriangles:stIndices.length/3,maxNormalDisplacementM:stMaxShift,footprintDatumM:3.90,footprintDatumStatus:'Authored station base using nearby DTM median; tower anchor itself is NoData',axisStatus:'Eastward authored station orientation, not a surveyed historic registration',display:'same-source geometry/material finite mesh sample, not full analytic renderer'}}

}
const labelLayer=document.createElement('div');labelLayer.id='mapLabels';document.body.append(labelLayer);
const hkLabels=HK.labels.map((p,k)=>{let el=document.createElement('div');el.className='mapLabel '+(p.kind||'');el.textContent=p.text;labelLayer.append(el);return{...p,el}});
function mapCamera(){const fw=norm([Math.sin(mapState.yaw)*Math.cos(mapState.pitch),Math.sin(mapState.pitch),-Math.cos(mapState.yaw)*Math.cos(mapState.pitch)]),cam=mapState.target.map((v,i)=>v-fw[i]*mapState.distance),right=norm(cross(fw,[0,1,0])),up=cross(right,fw);return{cam,fw,right,up,flat:norm([fw[0],0,fw[2]])}}
function drawHK(now,s,e,c){common(hkProgram,now,s,e,c);gl.bindVertexArray(hkMeshData.vao);gl.drawElements(gl.TRIANGLES,hkMeshData.count,gl.UNSIGNED_INT,0);drawDetails(now,s,e,c);drawCanopy(now,s,e,c);drawKowloon(now,s,e,c);drawStoryObjects(now,s,e,c);gl.disable(gl.DEPTH_TEST);for(const r of hkRoutes){if(!(r.kind==='story'?mapState.story:mapState.rail))continue;common(routeProgram,now,s,e,c);v3(routeProgram,'color',r.kind==='story'?[1,.48,.70]:[.3,.75,1]);gl.bindVertexArray(r.mesh.vao);gl.drawElements(gl.TRIANGLES,r.mesh.count,gl.UNSIGNED_INT,0)}gl.enable(gl.DEPTH_TEST);
let visible=0,placed=[];for(const p of hkLabels){let h=hkHeight(...p.point),v=[p.point[0]-c.cam[0],(Number.isFinite(h)?h:0)+45-c.cam[1],p.point[1]-c.cam[2]],z=v.reduce((a,b,i)=>a+b*c.fw[i],0),x=v.reduce((a,b,i)=>a+b*c.right[i],0)/(z*Math.tan(55*Math.PI/360)*canvas.width/canvas.height),y=v.reduce((a,b,i)=>a+b*c.up[i],0)/(z*Math.tan(55*Math.PI/360)),show=mapState.labels&&(!p.detail||mapState.distance<18000)&&z>0&&z<mapState.distance*1.85&&Math.abs(x)<.95&&Math.abs(y)<.87;p.el.style.display=show?'block':'none';if(show){let px=(x*.5+.5)*innerWidth,py=(.5-y*.5)*innerHeight,w=p.el.offsetWidth,h=p.el.offsetHeight,dy=0;for(let k=0;k<8;k++){let b=[px-w/2-4,py-dy-h-4,px+w/2+4,py-dy+3];if(!placed.some(a=>b[0]<a[2]&&b[2]>a[0]&&b[1]<a[3]&&b[3]>a[1])){placed.push(b);break}dy+=h+4}if(innerHeight<520&&(py-dy-h<125||py>innerHeight-50)){p.el.style.display='none';continue}p.el.style.left=px+'px';p.el.style.top=(py-dy)+'px';p.el.style.setProperty('--leader',(dy+5)+'px');visible++}}qa.mapLabelCount=visible;qa.mapCamera=c;qa.terrainTriangles=hkMeshData.count/3;qa.mapAssembled=true;mapState.ready=true;}
function mapFocus(key){const p=HK.views[key];if(!p)return;if(['harboursea','kowloon','vegetation','bridge'].includes(key)){if(!mapState.routeBeforeSea)mapState.routeBeforeSea=[mapState.story,mapState.rail];mapState.story=false;mapState.rail=false}else if(mapState.routeBeforeSea){[mapState.story,mapState.rail]=mapState.routeBeforeSea;delete mapState.routeBeforeSea}$('showStory').textContent='故事线 '+(mapState.story?'开':'关');$('showRail').textContent='参照线 '+(mapState.rail?'开':'关');Object.assign(mapState,{target:[...p.target],distance:p.distance,yaw:p.yaw,pitch:p.pitch});needFrame=true;document.querySelectorAll('[data-map-view]').forEach(el=>el.classList.toggle('active',el.dataset.mapView===key));}
window.HKMap={getState:()=>({build:HK.build,ready:mapState.ready,source:HK.source,storyWorld:HK.storyWorld,stationMarkers:HK.stations.map(s=>({id:s.id,center:s.center_epsg2326})),northAligned:HK.storyWorld.northAligned,resolutionM:HK.step,detailResolutionM:[2,5],detailNativeSourceM:.5,detailMetadata:detailSpec.metadata,canopyRoots:canopyRoots.length/7,heightExaggeration:1,sourceDatum:HK.datum,seaDatum:'display zero in EGM2008; no tidal model',mapState:{...mapState},terrainTriangles:hkMeshData.count/3,routeLabels:HK.routes.map(r=>({kind:r.kind,title:r.title})),qa:{...qa}}),focus:mapFocus,sampleHeight:hkHeight};
