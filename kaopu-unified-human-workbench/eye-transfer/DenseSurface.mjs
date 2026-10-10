import * as THREE from '../full/source/registration-vendor/three.module.js';
/** Fixed head-only triangle refinement derived from the donor's normal-plane
 * midpoint construction. Body triangles and every original vertex are retained.
 * No per-frame nearest-vertex selection, no new independent head mesh. */
export class DenseSurface{
 constructor(source,bodyCount,levels=1){
  this.levels=[];let g=source,head=Array.from({length:g.attributes.position.count},(_,i)=>i>=bodyCount);
  for(let level=0;level<levels;level++){
   const edges=new Map(),pairs=[],nextHead=head.slice(),oldCount=head.length;
   const mid=(a,b)=>{if(!head[a]||!head[b])return -1;const key=a<b?a+','+b:b+','+a;if(edges.has(key))return edges.get(key);const i=oldCount+pairs.length;pairs.push([a,b]);edges.set(key,i);nextHead.push(true);return i;};
   const f=g.index.array,out=[];
   for(let k=0;k<f.length;k+=3){const a=f[k],b=f[k+1],c=f[k+2],ab=mid(a,b),bc=mid(b,c),ca=mid(c,a),count=[ab,bc,ca].filter(i=>i>=0).length;
    if(count===3)out.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);
    else if(count===0)out.push(a,b,c);
    else if(count===1){if(ab>=0)out.push(a,ab,c,ab,b,c);else if(bc>=0)out.push(a,b,bc,a,bc,c);else out.push(a,b,ca,ca,b,c);}
    else if(ab<0)out.push(a,b,bc,a,bc,ca,ca,bc,c);
    else if(bc<0)out.push(a,ab,ca,ab,b,c,ab,c,ca);
    else out.push(a,ab,c,ab,bc,c,ab,b,bc);
   }
   const next=new THREE.BufferGeometry();
   for(const[name,attr]of Object.entries(g.attributes)){
    if(name==='normal')continue;const size=attr.itemSize,data=new Float32Array(nextHead.length*size);data.set(attr.array);
    for(let j=0;j<pairs.length;j++){const[a,b]=pairs[j],i=oldCount+j;for(let q=0;q<size;q++)data[i*size+q]=(attr.array[a*size+q]+attr.array[b*size+q])*.5;}
    next.setAttribute(name,new THREE.BufferAttribute(data,size));
   }
   next.setIndex(out);this.levels.push({geometry:next,pairs,oldCount});g=next;head=nextHead;
  }
  this.geometry=g;this.source=source;this.update(source);
 }
 update(source=this.source){
  let g=source;for(const layer of this.levels){
   const {geometry,pairs,oldCount}=layer,P=g.attributes.position,N=g.attributes.normal,Q=geometry.attributes.position;
   Q.array.set(P.array);for(let j=0;j<pairs.length;j++){
    const[a,b]=pairs[j],ai=a*3,bi=b*3,qi=(oldCount+j)*3;let x=(P.array[ai]+P.array[bi])*.5,y=(P.array[ai+1]+P.array[bi+1])*.5,z=(P.array[ai+2]+P.array[bi+2])*.5;
    const na=[N.array[ai],N.array[ai+1],N.array[ai+2]],nb=[N.array[bi],N.array[bi+1],N.array[bi+2]],agreement=na[0]*nb[0]+na[1]*nb[1]+na[2]*nb[2];
    // Preserve folds / semantic material boundaries instead of smoothing across them.
    const type=g.attributes.csType,same=!type||Math.abs(type.array[a]-type.array[b])<.01;
    if(same&&agreement>.72){const da=(x-P.array[ai])*na[0]+(y-P.array[ai+1])*na[1]+(z-P.array[ai+2])*na[2],db=(x-P.array[bi])*nb[0]+(y-P.array[bi+1])*nb[1]+(z-P.array[bi+2])*nb[2];x-=.32*(da*na[0]+db*nb[0]);y-=.32*(da*na[1]+db*nb[1]);z-=.32*(da*na[2]+db*nb[2]);}
    Q.array[qi]=x;Q.array[qi+1]=y;Q.array[qi+2]=z;
   }
   const color=g.attributes.color;if(color){const c=geometry.attributes.color;c.array.set(color.array);for(let j=0;j<pairs.length;j++){const[a,b]=pairs[j];for(let q=0;q<3;q++)c.array[(oldCount+j)*3+q]=(color.array[a*3+q]+color.array[b*3+q])*.5;}c.needsUpdate=true;}
   Q.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();g=geometry;
  }
  return this.geometry;
 }
 dispose(){for(const l of this.levels)l.geometry.dispose();}
}
