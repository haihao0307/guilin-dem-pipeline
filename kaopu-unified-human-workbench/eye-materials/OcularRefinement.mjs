import * as THREE from '../full/source/registration-vendor/three.module.js';
/** A derived display surface, not a second head or a replacement canonical mesh.
 * Every existing vertex and every non-ocular triangle remains unchanged. New
 * ocular edge points use endpoint tangent planes; material boundaries remain
 * linear. The displacement cap is an engineering safety limit, not a biological
 * measurement. Native pose, eyeball coordinates, eyelids and rig are untouched.
 */
export class OcularRefinement{
 constructor(source){
  this.source=source;this.pairs=[];this.oldCount=source.attributes.position.count;const edges=new Map(),type=source.attributes.csType.array,index=source.index.array,out=[];this.originalEyeTriangles=0;
  const mid=(a,b)=>{const k=a<b?a+','+b:b+','+a;if(edges.has(k))return edges.get(k);const i=this.oldCount+this.pairs.length;edges.set(k,i);this.pairs.push([a,b]);return i;};
  for(let i=0;i<index.length;i+=3){const a=index[i],b=index[i+1],c=index[i+2];if(type[a]>3.5&&type[b]>3.5&&type[c]>3.5){this.originalEyeTriangles++;const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);out.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);}else out.push(a,b,c);}
  this.geometry=new THREE.BufferGeometry();for(const[k,attr]of Object.entries(source.attributes)){if(k==='normal')continue;const size=attr.itemSize,data=new Float32Array((this.oldCount+this.pairs.length)*size);data.set(attr.array);for(let j=0;j<this.pairs.length;j++){const[a,b]=this.pairs[j];for(let q=0;q<size;q++)data[(this.oldCount+j)*size+q]=(attr.array[a*size+q]+attr.array[b*size+q])*.5;}this.geometry.setAttribute(k,new THREE.BufferAttribute(data,size));}
  this.geometry.setIndex(out);this.update();
 }
 update(){
  const source=this.source,P=source.attributes.position.array,N=source.attributes.normal.array,T=source.attributes.csType.array,Q=this.geometry.attributes.position.array;Q.set(P);this.maxCorrectionMM=0;
  for(let j=0;j<this.pairs.length;j++){const[a,b]=this.pairs[j],ai=a*3,bi=b*3,qi=(this.oldCount+j)*3;let x=(P[ai]+P[bi])*.5,y=(P[ai+1]+P[bi+1])*.5,z=(P[ai+2]+P[bi+2])*.5;const agreement=N[ai]*N[bi]+N[ai+1]*N[bi+1]+N[ai+2]*N[bi+2];
   if(Math.abs(T[a]-T[b])<.01&&agreement>.72){const da=(x-P[ai])*N[ai]+(y-P[ai+1])*N[ai+1]+(z-P[ai+2])*N[ai+2],db=(x-P[bi])*N[bi]+(y-P[bi+1])*N[bi+1]+(z-P[bi+2])*N[bi+2];let dx=-.25*(da*N[ai]+db*N[bi]),dy=-.25*(da*N[ai+1]+db*N[bi+1]),dz=-.25*(da*N[ai+2]+db*N[bi+2]);const length=Math.hypot(dx,dy,dz),s=length>.00008?.00008/length:1;x+=dx*s;y+=dy*s;z+=dz*s;this.maxCorrectionMM=Math.max(this.maxCorrectionMM,length*s*1000);}
   Q[qi]=x;Q[qi+1]=y;Q[qi+2]=z;
  }
  const originalColor=source.attributes.color,targetColor=this.geometry.attributes.color;if(originalColor&&targetColor){targetColor.array.set(originalColor.array);for(let j=0;j<this.pairs.length;j++){const[a,b]=this.pairs[j];for(let k=0;k<3;k++)targetColor.array[(this.oldCount+j)*3+k]=(originalColor.array[a*3+k]+originalColor.array[b*3+k])*.5;}targetColor.needsUpdate=true;}
  this.geometry.attributes.position.needsUpdate=true;this.geometry.computeVertexNormals();this.geometry.computeBoundingSphere();return this.geometry;
 }
 report(){return{mode:'eye-only tangent-plane midpoint refinement',addedVertices:this.pairs.length,eyeTrianglesBefore:this.originalEyeTriangles,eyeTrianglesAfter:this.originalEyeTriangles*4,maxCorrectionMM:this.maxCorrectionMM,correctionCapMM:.08,nativeVerticesMoved:0,nonOcularTrianglesChanged:0};}
 dispose(){this.geometry.dispose();}
}
