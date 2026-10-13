function meshGeometry(data){
 const started=performance.now(),n=data.count*data.per*2,g=new THREE.BufferGeometry(),position=new Float32Array(n*3),tangent=new Float32Array(n*3),normal=new Float32Array(n*3),side=new Float32Array(n),radius=new Float32Array(n),along=new Float32Array(n),rand=new Float32Array(n),index=new Uint32Array(data.activeCount*data.segments*6);let at=0;
 for(let i=0;i<data.count;i++)for(let j=0;j<data.per;j++){
  const q=i*data.per+j,src=q*3,start=q*2;
  const r=.000052*(.74+.50*data.randoms[i])*(1-.91*Math.pow(j/data.segments,3.5));
  for(let k=0;k<2;k++){const v=start+k,dst=v*3;
   for(let c=0;c<3;c++){position[dst+c]=data.curves[src+c];tangent[dst+c]=data.tangents[src+c];normal[dst+c]=data.normals[src+c];}
   side[v]=k?1:-1;along[v]=j/data.segments;rand[v]=data.randoms[i];radius[v]=r;
  }
  if(data.active[i]&&j<data.segments){index[at++]=start;index[at++]=start+1;index[at++]=start+2;index[at++]=start+1;index[at++]=start+3;index[at++]=start+2;}
 }
 for(const[name,a,k]of[['position',position,3],['tangent',tangent,3],['scalpNormal',normal,3],['strandSide',side,1],['strandRadius',radius,1],['along',along,1],['strandRandom',rand,1]])g.setAttribute(name,new THREE.BufferAttribute(a,k));g.setIndex(new THREE.BufferAttribute(index,1));g.computeBoundingSphere();runtimePerf.meshBuildMs=performance.now()-started;return g;
}
