/* v3.3.4 exact water-to-bed alignment: water vertices follow the carved cross-section normals. */
createWaterMesh=function(sections,origin,datum){
  if(!sections||sections.length<3)return null;
  const cross=10,cols=11,count=sections.length*cols;
  const positions=new Float32Array(count*3),colors=new Float32Array(count*3),uvs=new Float32Array(count*2);
  let p=0,u=0;
  for(const section of sections){
    for(let j=0;j<=cross;j++){
      const q=j/cross*2-1;
      const x=section.x+section.nx*section.width*.5*q;
      const y=section.y+section.ny*section.width*.5*q;
      const wave=.018*Math.sin(section.s*.018+q*5.2);
      positions[p]=x-origin.x;
      positions[p+1]=section.water-datum+.035+wave;
      positions[p+2]=y-origin.y;
      const edge=Math.abs(q),flow=.5+.5*Math.sin(section.s*.006+q*1.7);
      const colour=RICH_PALETTE_V330.waterDeep.clone()
        .lerp(RICH_PALETTE_V330.waterMid,smoothstep(0,.76,edge))
        .lerp(RICH_PALETTE_V330.waterEdge,smoothstep(.72,1,edge)*.58);
      colour.offsetHSL(0,0,(flow-.5)*.022);
      colors[p]=colour.r;colors[p+1]=colour.g;colors[p+2]=colour.b;p+=3;
      uvs[u++]=section.s/180;uvs[u++]=(q+1)*.5;
    }
  }
  const indices=new Uint32Array((sections.length-1)*cross*6);let k=0;
  for(let i=0;i<sections.length-1;i++)for(let j=0;j<cross;j++){
    const a=i*cols+j,b=a+1,c=a+cols,d=c+1;
    indices[k++]=a;indices[k++]=c;indices[k++]=b;indices[k++]=b;indices[k++]=c;indices[k++]=d;
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
  geometry.setIndex(new THREE.BufferAttribute(indices,1));
  geometry.computeVertexNormals();
  const surfaceMaterial=new THREE.MeshPhysicalMaterial({
    vertexColors:true,roughness:.21,metalness:0,transparent:true,opacity:.82,depthWrite:false,
    side:THREE.DoubleSide,clearcoat:.68,clearcoatRoughness:.18,ior:1.333
  });
  const underMaterial=new THREE.MeshBasicMaterial({color:0x2f6670,transparent:true,opacity:.25,depthWrite:false,side:THREE.DoubleSide});
  const surface=new THREE.Mesh(geometry,surfaceMaterial);surface.name='lijiang-water-surface';surface.renderOrder=8;surface.receiveShadow=true;
  const underGeometry=geometry.clone(),underPositions=underGeometry.getAttribute('position');
  for(let i=0;i<underPositions.count;i++)underPositions.setY(i,underPositions.getY(i)-.22);
  underPositions.needsUpdate=true;
  const under=new THREE.Mesh(underGeometry,underMaterial);under.name='lijiang-water-depth';under.renderOrder=7;
  const group=new THREE.Group();group.name='lijiang-water-system';group.add(under,surface);return group;
};

const makeQAV334Base=makeQA;
makeQA=function(build){
  const qa=makeQAV334Base(build);
  qa.richTerrainPass='v3.3.4';
  qa.waterCrossSectionAlignment='centerline-normal-exact';
  qa.waterLateralBiasMeters=0;
  return qa;
};

document.title='小王 · 桂林丰富地形蒸馏实验室 v3.3.4';
const brandSmallV334=document.querySelector('.brand small');if(brandSmallV334)brandSmallV334.textContent='XIAOWANG · GUILIN RICH TERRAIN DISTILLATION v3.3.4';
