/** Low-level native geometry compiler. Used by the unified builder and CPU tests.
 * This file supplies no materials, shaders, renderer, camera, loop or fallback. */
export function geometryForPart(THREE,part){
 const s=part.shape;let g;
 if(s.type==='box')g=new THREE.BoxGeometry(...s.size).translate(...s.center);
 else if(s.type==='beam'){
  const a=new THREE.Vector3(...s.a),b=new THREE.Vector3(...s.b),d=b.clone().sub(a);if(d.length()<1e-7)throw Error('Zero-length member '+part.id);
  g=new THREE.BoxGeometry(s.width,d.length(),s.depth);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));g.translate(...a.add(b).multiplyScalar(.5).toArray());
 }else if(s.type==='cylinder')g=new THREE.CylinderGeometry(s.radiusTop??s.radius,s.radius,s.height,s.segments||20).translate(...s.center);
 else if(s.type==='radial-bolt'){
  g=new THREE.CylinderGeometry(s.radius,s.radius,s.depth,s.segments||6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(Math.cos(s.angle),0,Math.sin(s.angle))));g.translate(...s.center);
 }else if(s.type==='ring')g=new THREE.TorusGeometry(s.radius,s.tube,6,s.segments).rotateX(Math.PI/2).translate(...s.center);
 else if(s.type==='fluted-column'){
  const pos=[],ind=[],n=s.segments;for(let row=0;row<2;row++)for(let i=0;i<=n;i++){const a=i/n*Math.PI*2,r=s.radius-s.depth*(.5+.5*Math.cos(a*s.flutes));pos.push(s.center[0]+Math.cos(a)*r,s.center[1]+(row-.5)*s.height,s.center[2]+Math.sin(a)*r);}
  for(let i=0;i<n;i++){const a=i,b=i+1,c=n+1+i,d=c+1;ind.push(a,c,b,b,c,d);}
  const bottom=pos.length/3;pos.push(s.center[0],s.center[1]-s.height/2,s.center[2]);const top=pos.length/3;pos.push(s.center[0],s.center[1]+s.height/2,s.center[2]);for(let i=0;i<n;i++){ind.push(bottom,i,i+1);ind.push(top,n+2+i,n+1+i);}
  g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(ind);g.computeVertexNormals();
 }else if(s.type==='roof-panel'){
  const pos=s.corners.flat().concat(s.corners.flatMap(p=>[p[0],p[1]-s.thickness,p[2]])),ind=[0,2,1,0,3,2,4,5,6,4,6,7];for(let i=0;i<4;i++){const j=(i+1)%4;ind.push(i,j,j+4,i,j+4,i+4);}
  const q=new THREE.BufferGeometry();q.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));q.setIndex(ind);g=q.toNonIndexed();q.dispose();g.computeVertexNormals();
 }else throw Error('Unknown native shape '+s.type);
 g.computeBoundingBox();g.computeBoundingSphere();g.userData={...g.userData,stationPart:part.id,surfaceRole:part.surface.role,sharedConstructionFeature:part.surface.feature};return g;
}
export function measureGeometry(g){let bytes=g.index?.array.byteLength||0;for(const a of Object.values(g.attributes))bytes+=a.array.byteLength;return{triangles:(g.index?.count??g.attributes.position.count)/3,vertices:g.attributes.position.count,bytes};}
