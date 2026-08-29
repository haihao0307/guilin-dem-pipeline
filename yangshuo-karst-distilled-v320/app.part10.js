/* v3.2.5 nested LOD rings and scale-aware normals to remove overlap banding. */
const buildLocalFieldsV325=buildLocalFields;
buildLocalFields=function(contextField,localCenter,mode,data,candidate,riverSections){
  state.pendingLocalCenter={x:localCenter.x,y:localCenter.y};
  const field=buildLocalFieldsV325(contextField,localCenter,mode,data,candidate,riverSections);
  return stitchFieldToParentV322(field,contextField,.16);
};

createTerrainMesh=function(field,origin,datum,layer,yOffset=0){
  const {n,worldX,worldY,final,tone,spacing}=field,count=n*n;
  const positions=new Float32Array(count*3),colors=new Float32Array(count*3),normals=new Float32Array(count*3);
  let min=Infinity,max=-Infinity;
  for(let i=0;i<final.length;i++){min=Math.min(min,final[i]);max=Math.max(max,final[i])}
  const range=Math.max(1,max-min);
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
    const i=z*n+x,o=i*3,h=final[i];positions[o]=worldX[x]-origin.x;positions[o+1]=h-datum+yOffset;positions[o+2]=worldY[z]-origin.y;
    const colour=terrainColor(tone[i]||0,(h-min)/range,worldX[x],worldY[z],layer);colors[o]=colour.r;colors[o+1]=colour.g;colors[o+2]=colour.b;
  }
  const normalRadius=layer==='local'?Math.max(3,Math.round(5/spacing)):layer==='context'?1:1;
  for(let z=0;z<n;z++)for(let x=0;x<n;x++){
    const i=z*n+x,o=i*3,x0=Math.max(0,x-normalRadius),x1=Math.min(n-1,x+normalRadius),z0=Math.max(0,z-normalRadius),z1=Math.min(n-1,z+normalRadius);
    const dx=(final[z*n+x1]-final[z*n+x0])/Math.max(1,(x1-x0)*spacing),dz=(final[z1*n+x]-final[z0*n+x])/Math.max(1,(z1-z0)*spacing);
    const inv=1/Math.hypot(dx,1,dz);normals[o]=-dx*inv;normals[o+1]=inv;normals[o+2]=-dz*inv;
  }
  let hole=null;
  if(layer==='regional')hole={x:field.center.x,y:field.center.y,extent:CONTEXT_EXTENT};
  else if(layer==='context'&&state.pendingLocalCenter)hole={x:state.pendingLocalCenter.x,y:state.pendingLocalCenter.y,extent:DETAIL_EXTENT};
  const maxIndices=(n-1)*(n-1)*6,indices=new Uint32Array(maxIndices);let p=0;
  const holeHalf=hole?hole.extent*.5:0;
  for(let z=0;z<n-1;z++)for(let x=0;x<n-1;x++){
    if(hole){
      const cellX=(worldX[x]+worldX[x+1])*.5,cellY=(worldY[z]+worldY[z+1])*.5;
      if(Math.abs(cellX-hole.x)<holeHalf&&Math.abs(cellY-hole.y)<holeHalf)continue;
    }
    const a=z*n+x,b=a+1,c=a+n,d=c+1;
    if((x+z)&1){indices[p++]=a;indices[p++]=c;indices[p++]=d;indices[p++]=a;indices[p++]=d;indices[p++]=b}
    else{indices[p++]=a;indices[p++]=c;indices[p++]=b;indices[p++]=b;indices[p++]=c;indices[p++]=d}
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));
  geometry.setIndex(new THREE.BufferAttribute(indices.slice(0,p),1));
  geometry.computeBoundingSphere();
  const material=makeTerrainMaterial(layer);material.polygonOffset=false;
  const mesh=new THREE.Mesh(geometry,material);mesh.name=`terrain-${layer}`;mesh.renderOrder=layer==='regional'?0:layer==='context'?1:2;mesh.castShadow=layer!=='regional';mesh.receiveShadow=true;
  return mesh;
};
