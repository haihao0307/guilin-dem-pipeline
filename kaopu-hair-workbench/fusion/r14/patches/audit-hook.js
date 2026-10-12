// Diagnostic-only ID pass: same radii, mesh, depth and MSAA coverage.
// White = visible native scalp, black = actual strands. Never used in beauty.
window.lengthGroom.coverageAudit=async()=>{
 await window.lengthGroom.whenRendered();
 const gl=renderer.getContext(),size=renderer.getDrawingBufferSize(new THREE.Vector2()),W=size.x,H=size.y;
 const corners=[[-.050,.396,-.035],[.050,.396,-.035],[-.050,.396,.055],[.050,.396,.055]].map(a=>new THREE.Vector3(...a).project(camera));
 const xmin=Math.max(0,Math.floor(Math.min(...corners.map(v=>(v.x+1)*W/2)))),xmax=Math.min(W,Math.ceil(Math.max(...corners.map(v=>(v.x+1)*W/2))));
 const ymin=Math.max(0,Math.floor(Math.min(...corners.map(v=>(v.y+1)*H/2)))),ymax=Math.min(H,Math.ceil(Math.max(...corners.map(v=>(v.y+1)*H/2))));
 const w=xmax-xmin,h=ymax-ymin;if(w<10||h<10)throw Error('Coverage audit requires the top camera');
 const saved={head:head.material,brows:brows.mesh.visible,hair:hair.visible,guide:guideMesh?.visible,roots:rootMesh?.visible,clear:renderer.getClearColor(new THREE.Color()),alpha:renderer.getClearAlpha()};
 const unlit=new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false});let bare=0,visible=0;
 try{
  head.material=unlit;brows.mesh.visible=false;if(guideMesh)guideMesh.visible=false;if(rootMesh)rootMesh.visible=false;renderer.setClearColor(0,1);
  hair.visible=false;renderer.render(scene,camera);const a=new Uint8Array(w*h*4);gl.readPixels(xmin,ymin,w,h,gl.RGBA,gl.UNSIGNED_BYTE,a);
  hair.visible=true;handle.material.uniforms.coverageAudit.value=1;renderer.render(scene,camera);const b=new Uint8Array(a.length);gl.readPixels(xmin,ymin,w,h,gl.RGBA,gl.UNSIGNED_BYTE,b);
  for(let i=0;i<a.length;i+=4){bare+=a[i]/255;visible+=Math.min(a[i],b[i])/255;}
 }finally{head.material=saved.head;brows.mesh.visible=saved.brows;hair.visible=saved.hair;if(guideMesh)guideMesh.visible=saved.guide;if(rootMesh)rootMesh.visible=saved.roots;handle.material.uniforms.coverageAudit.value=0;renderer.setClearColor(saved.clear,saved.alpha);unlit.dispose();draw();await gate.wait(180000);}
 return {view,roiWorldXZMetres:[[-.050,-.035],[.050,.055]],roiPixels:[xmin,ymin,w,h],bareScalpSamples:bare,visibleScalpSamples:visible,visibleFraction:visible/Math.max(1,bare),metric:'top-view actual strand coverage; same width/depth/MSAA; not biological density'};
};
window.lengthGroom.rootAudit=(limit=400)=>{
 const result={strands:0,rootInside:0,minRootGapMM:Infinity,maxRootGapMM:-Infinity,firstSegmentGapMM:[],shortUnder12MM:0,shortReversals:0,shortMaxTurnDegrees:0};
 const n=Math.min(limit,compiled.count);
 for(let z=0;z<n;z++){const i=Math.floor(z*compiled.count/n);if(!compiled.active[i])continue;result.strands++;
  const q=i*compiled.per*3,p=Array.from(compiled.curves.subarray(q,q+3)),a=skin.bvh.nearest(p),gap=p.reduce((s,x,k)=>s+(x-a.p[k])*a.n[k],0)*1000;
  result.minRootGapMM=Math.min(result.minRootGapMM,gap);result.maxRootGapMM=Math.max(result.maxRootGapMM,gap);if(gap<-.1)result.rootInside++;
  const p1=Array.from(compiled.curves.subarray(q+3,q+6)),a1=skin.bvh.nearest(p1);result.firstSegmentGapMM.push(p1.reduce((s,x,k)=>s+(x-a1.p[k])*a1.n[k],0)*1000);
  if(compiled.lengths[i]<.012){result.shortUnder12MM++;for(let j=1;j<compiled.per-1;j++){const k=q+j*3,aa=[0,1,2].map(t=>compiled.curves[k+t]-compiled.curves[k+t-3]),bb=[0,1,2].map(t=>compiled.curves[k+t+3]-compiled.curves[k+t]),den=Math.hypot(...aa)*Math.hypot(...bb);if(den<1e-12)continue;const c=Math.max(-1,Math.min(1,aa.reduce((s,x,t)=>s+x*bb[t],0)/den)),angle=Math.acos(c)*180/Math.PI;result.shortMaxTurnDegrees=Math.max(result.shortMaxTurnDegrees,angle);if(c<0)result.shortReversals++;}}
 }
 result.firstSegmentGapMM.sort((a,b)=>a-b);const list=result.firstSegmentGapMM;result.firstSegmentGapMM={min:list[0],median:list[Math.floor(list.length*.5)],p95:list[Math.floor(list.length*.95)],max:list.at(-1)};return result;
};
