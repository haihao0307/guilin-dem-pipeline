import * as THREE from '../garments-r04/vendor/three.module.js';
import {CatalogueViewer} from './catalogue-viewer.mjs';
// Camera-only extension; no geometry or material is changed.
export class R072Viewer extends CatalogueViewer {
 objectBounds(){const box=new THREE.Box3();for(const mesh of this.meshes||[]){mesh.geometry.computeBoundingBox();box.union(mesh.geometry.boundingBox);}if(this.body?.visible){this.body.geometry.computeBoundingBox();box.union(this.body.geometry.boundingBox);}return box;}
 cameraView(kind){
  if(!this.camera||!this.orbit)return;
  const box=this.objectBounds();if(box.isEmpty())return super.cameraView(kind);
  const directions={front:[0,0,1],back:[0,0,-1],side:[1,0,0],full:[.24,.08,1],angle:[.44,.08,1],top:[0,1,.001]};if(!directions[kind])return;
  const center=box.getCenter(new THREE.Vector3()),n=new THREE.Vector3(...directions[kind]).normalize();
  const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),n).normalize(),up=new THREE.Vector3().crossVectors(n,right).normalize();
  const b=this.container.getBoundingClientRect();if(b.width>0&&b.height>0)this.camera.aspect=b.width/b.height;
  const ty=Math.tan(this.camera.fov*Math.PI/360),tx=ty*this.camera.aspect;let distance=.4;
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const q=new THREE.Vector3(x,y,z).sub(center);distance=Math.max(distance,q.dot(n)+1.16*Math.max(Math.abs(q.dot(right))/tx,Math.abs(q.dot(up))/ty));}
  this.orbit.target.copy(center);this.camera.zoom=1;this.camera.position.copy(center).addScaledVector(n,distance);this.orbit.maxDistance=Math.max(5,distance*2);this.camera.far=Math.max(20,distance+box.getSize(new THREE.Vector3()).length()*2);this.camera.updateProjectionMatrix();this.camera.lookAt(center);this.orbit.update();this.camera.updateMatrixWorld();this.dirty=true;
 }
 setBody(body){super.setBody(body);this.cameraView('front');}
 setGeometry(...args){super.setGeometry(...args);this.cameraView('front');}
 framingReport(){
  this.camera.updateMatrixWorld();let count=0,maxX=0,maxY=0,outside=0;
  for(const mesh of [...(this.meshes||[]),...(this.body?.visible?[this.body]:[])]){const attr=mesh.geometry.attributes.position;for(let i=0;i<attr.count;i++){const q=new THREE.Vector3().fromBufferAttribute(attr,i).project(this.camera);count++;maxX=Math.max(maxX,Math.abs(q.x));maxY=Math.max(maxY,Math.abs(q.y));if(Math.abs(q.x)>1||Math.abs(q.y)>1||q.z< -1||q.z>1)outside++;}}
  return{vertexCount:count,outsideViewport:outside,maxAbsNdcX:maxX,maxAbsNdcY:maxY};
 }
}
