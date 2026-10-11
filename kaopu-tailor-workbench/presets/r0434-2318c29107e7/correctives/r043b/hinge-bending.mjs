/** Zero-curvature hinge energy derived from each original material panel.
 * New static regularizer, not a claim of measured fabric bending stiffness.
 * No display smoothing, UV edits, remeshing or seam reindexing.
 */
export function configureMaterialBending(lab,{weight=2}={}){
 const ids=[],coefs=[],weights=[];let offset=0;
 for(const p of lab.spec.panels){const edges=new Map();for(const tri of p.triangles)for(let k=0;k<3;k++){const a=tri[k],b=tri[(k+1)%3],c=tri[(k+2)%3],key=a<b?a+':'+b:b+':'+a;if(!edges.has(key))edges.set(key,{a,b,c:[]});edges.get(key).c.push(c);}
  for(const {a,b,c}of edges.values()){if(c.length!==2)continue;const A=p.uvMm[a],B=p.uvMm[b],C=p.uvMm[c[0]],D=p.uvMm[c[1]],e=[B[0]-A[0],B[1]-A[1]],L=Math.hypot(...e);if(L<1e-10)throw Error('BENDING_ZERO_MATERIAL_EDGE');
   const t=x=>((x[0]-A[0])*e[0]+(x[1]-A[1])*e[1])/(L*L),h=x=>(e[0]*(x[1]-A[1])-e[1]*(x[0]-A[0]))/L,hc=h(C),hd=h(D);if(hc*hd>=0||Math.abs(hd)<1e-9)throw Error('BENDING_INVALID_MATERIAL_ADJACENCY');const r=hc/hd,tc=t(C),td=t(D),q=[-(1-tc)+r*(1-td),-tc+r*td,1,-r],norm=Math.hypot(...q);ids.push(offset+a,offset+b,offset+c[0],offset+c[1]);coefs.push(...q.map(v=>v/norm));weights.push(weight*L/Math.max(1e-5,Math.abs(hc)+Math.abs(hd)));
  }offset+=p.uvMm.length;
 }
 if(ids.length>lab.strainTriangles.length*6)throw Error('BENDING_CAPACITY');new Int32Array(lab.kernel.memory.buffer,lab.ptr.b43ids,ids.length).set(ids);new Float64Array(lab.kernel.memory.buffer,lab.ptr.b43coeff,coefs.length).set(coefs);new Float64Array(lab.kernel.memory.buffer,lab.ptr.b43weights,weights.length).set(weights);lab.kernel.setMaterialBending43b(lab.ptr.b43ids,lab.ptr.b43coeff,lab.ptr.b43weights,weights.length);
 lab.bending43b={enabled:true,hinges:weights.length,weight,source:'zero-flat-curvature affine dependencies of original adjacent material triangles',model:'quadratic static bending regularizer',calibrated:false,restUVChanged:false,displayOnlySmoothing:false};return lab.bending43b;
}
