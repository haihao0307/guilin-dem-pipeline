yBase,[1,0,0])),bodyR=5.1/Math.hypot(bp[0]-bpx[0],bp[1]-bpx[1]);
report.body={height:bodyH,radius:bodyR,base:bodyBase,projection:project(bodyBase)};
function capsule(){const v=[],d=[],ix=[],seg=24,n=18,r=Math.min(bodyR,bodyH*.24),half=bodyH/2-r;for(let j=0;j<=n;j++){let a=-Math.PI/2+j/n*Math.PI,y=Math.sin(a)*r+(a>=0?half:-half)+bodyH/2;for(let k=0;k<=seg;k++){let th=k/seg*Math.PI*2;v.push(bodyBase[0]+Math.cos(a)*r*Math.cos(th),bodyBase[1]+y,bodyBase[2]+Math.cos(a)*r*Math.sin(th));d.push(0,0,0,0);}}for(let j=0;j<n;j++)for(let k=0;k<seg;k++){let a=j*(seg+1)+k;ix.push(a,a+seg+1,a+1,a+1,a+seg+1,a+seg+2);}return makeMesh(v,ix,d,4);}
meshes.push(capsule());
function grassBlades(){let v=[],d=[],ix=[],N=34000;for(let i=0;i<N;i++){let x=-16+32*rnd(i,1),z=-SIZE[1]/2+SIZE[1]*rnd(i,2);if(x<grassX(z)+.06)continue;let rand=rnd(i,3),h=.13+.15*rand,y=bed(x,z),w=.011+.012*rnd(i,4),ang=6.28*rnd(i,5),dx=Math.cos(ang)*w,dz=Math.sin(ang)*w,base=v.length/3;v.push(x-dx,y,z-dz,x+dx,y,z+dz,x+dx*.4+.025,y+h*.6,z+dz*.4,x-.025,y+h,z+.022);d.push(0,rand,0,0,0,rand,0,0,.6,rand,0,0,1,rand,0,0);ix.push(base,base+1,base+2,base,base+2,base+3);}report.grassVertices=v.length/3;return makeMesh(v,ix,d,3);}
meshes.push(grassBlades());const waterMesh=grid(true),waterWall=walls(true);
// Observed foam-coverage envelope, not a shallow-water solver or evidence of the teacher algorithm.
const texture=gl.createTexture(),sz=768,field=new Float32Array(sz*sz),rgba=new Uint8Array(sz*sz*4);
const foamLine=[[475,354],[525,367],[555,382],[536,402],[493,423],[462,432],[463,452],[476,474],[493,494],[513,523],[529,553],[551,586],[567,604]].map(p=>onPlane(p,0));
function strokeWorld(points,width,strength){for(let j=0;j<points.length-1;j++){const a=points[j],b=points[j+1],length=Math.hypot(a[0]-b[0],a[2]-b[2]),steps=Math.ceil(length/.06);for(let k=0;k<=steps;k++){let t=k/steps,x=mix(a[0],b[0],t),z=mix(a[2],b[2],t),cx=(x+16)/32*sz,cy=(z+SIZE[1]/2)/SIZE[1]*sz,rx=width*sz/32*2,ry=width*sz/SIZE[1]*2;for(let iy=Math.max(0,Math.floor(cy-ry));iy<Math.min(sz,Math.ceil(cy+ry));iy++)for(let ix=Math.max(0,Math.floor(cx-rx));ix<Math.min(sz,Math.ceil(cx+rx));ix++){let dd=((ix-cx)/rx)**2+((iy-cy)/ry)**2,val=Math.exp(-dd*5)*strength;field[iy*sz+ix]=Math.max(field[iy*sz+ix],val);}}}}
strokeWorld(foamLine,.70,.92);strokeWorld(D.shore_world,.64,.48);
for(let r of rocks){let a=[];for(let i=0;i<=40;i++)a.push([r.p[0]+Math.cos(i/40*6.28)*r.r*1.15,0,r.p[2]+Math.sin(i/40*6.28)*r.r]);strokeWorld(a,.25,.60);}
for(let i=0;i<sz*sz;i++){rgba[i*4]=Math.round(clamp(field[i])*255);rgba[i*4+3]=255;}
gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,sz,sz,0,gl.RGBA,gl.UNSIGNED_BYTE,rgba);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
function matmul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
function look(eye,tgt,up){let z=norm(sub(eye,tgt)),x=norm(cross(up,z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
function persp(fov,asp){let f=1/Math.tan(fov/2),n=.05,fa=300;return new Float32Array([f/asp,0,0,0,0,f,0,0,0,0,(fa+n)/(n-fa),-1,0,0,2*fa*n/(n-fa),0]);}
function ortho(l,r,b,t){return new Float32Array([2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/250,0,-(r+l)/(r-l),-(t+b)/(t-b),-1,1]);}
let dirty=true;window.addEventListener('resize',()=>dirty=true);let view='match',eye=E.slice(),target=C.target.slice(),up=C.up.slice(),mode=0,time=0,playing=false,last=0,frame=0,foamon=1;
let vp;
function render(now){try{if(!dirty&&!playing){requestAnimationFrame(render);return;}dirty=false;
 if(last&&playing)time+=Math.min(.04,(now-last)/1000);last=now;
 const dpr=Math.min(devicePixelRatio||1,1.5),w=Math.round(root.clientWidth*dpr),h=Math.round(root.clientHeight*dpr);if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;gl.viewport(0,0,w,h);}
 gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);gl.useProgram(program);
 let p=view==='top'?ortho(-SIZE[1]*w/h/2,SIZE[1]*w/h/2,-SIZE[1]/2,SIZE[1]/2):persp(C.fov_y_deg*Math.PI/180,w/h);
 vp=matmul(p,look(eye,target,up));gl.uniformMatrix4fv(locations.uVP,false,vp);gl.uniform3fv(locations.uEye,eye);gl.uniform1f(locations.uTime,time);gl.uniform1f(locations.uMode,mode);gl.uniform1f(locations.uFoam,foamon);gl.uniform1f(locations.uWet,1);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(locations.uCoverage,0);
 const draw=m=>{gl.uniform1i(locations.uKind,m.kind);gl.bindVertexArray(m.vao);gl.drawElements(gl.TRIANGLES,m.count,gl.UNSIGNED_INT,0);};
 for(let m of meshes)draw(m);draw(waterWall);draw(waterMesh);gl.bindVertexArray(null);
 report.frames++;report.ready=true;report.glError=gl.getError();if(report.glError)throw Error('WebGL error '+report.glError);
 $('frames').textContent=report.frames+' 帧已绘制 · '+(playing?'水纹预览':'静态观察');
 requestAnimationFrame(render);
}catch(e){fail(e);}}
function setView(v){dirty=true;view=v;if(v==='top'){eye=[0,80,0];target=[0,0,0];up=[0,0,-1];}else{eye=E.slice();target=C.target.slice();up=C.up.slice();}document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===v));$('viewlabel').textContent=v==='top'?'重建顶视 · 不是老师深度图':'08.00s 同幅投影';$('ghost').style.display='none';}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
$('foam').onclick=e=>{dirty=true;foamon=1-foamon;e.currentTarget.classList.toggle('active',!!foamon);};
$('palette').onclick=e=>{dirty=true;mode=(mode+1)%3;e.currentTarget.textContent=['表面材质','分区校验','高程假设'][mode];};
$('play').onclick=e=>{dirty=true;last=0;playing=!playing;e.currentTarget.textContent=playing?'停下观察':'水纹预览';};
$('overlay').onclick=()=>{if(view!=='match')setView('match');$('ghost').style.display=$('ghost').style.display==='block'?'none':'block';};
$('trace').onclick=()=>{$('referenceMarks').classList.toggle('hidden');};
let drag=null;cv.onpointerdown=e=>{drag=[e.clientX,e.clientY];cv.setPointerCapture(e.pointerId);};cv.onpointermove=e=>{if(!drag||view==='top')return;dirty=true;let dx=e.clientX-drag[0],dy=e.clientY-drag[1];drag=[e.clientX,e.clientY];const tgt=[0,.5,1],off=sub(eye,tgt),rr=Math.hypot(